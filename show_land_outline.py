"""
show_land_outline.py

Usage:
    python show_land_outline.py "New York" /path/to/land-polygons.shp

Outputs:
    land_clamped_<place_name>.html  (Folium map showing the land-only outline)
"""

import sys
import os
import requests
import json
import geopandas as gpd
from shapely.geometry import Polygon, shape, box, mapping
import shapely.ops
import folium

# -------------------------
# Config / Inputs
# -------------------------
if len(sys.argv) < 3:
    print("Usage: python show_land_outline.py \"Place Name\" /path/to/land-polygons.shp")
    sys.exit(1)

PLACE_NAME = sys.argv[1]
LAND_SHP_PATH = sys.argv[2]

# -------------------------
# Helpers
# -------------------------
def fetch_place_boundary(place_name):
    """
    Fetch an administrative relation's geometry from Overpass as a shapely polygon/multipolygon.
    This function tries to find the best matching relation by name and returns its geometry.
    """
    query = f"""
    [out:json][timeout:60];
    relation["name"="{place_name}"]["boundary"="administrative"];
    out geom;
    """
    url = "https://overpass-api.de/api/interpreter"
    r = requests.get(url, params={"data": query})
    r.raise_for_status()
    data = r.json()

    geoms = []
    for el in data.get("elements", []):
        # Relation members with geometry are included in 'members' when Overpass returns 'out geom'
        # However, sometimes Overpass returns a single 'relation' element with a 'geometry' key.
        if el.get("type") == "relation" and "members" in el:
            # Build polygons from member ways if possible: collect all coordinates in member ways
            coords = []
            # attempt to extract a closed ring from members that are ways
            for member in el["members"]:
                if member.get("type") == "way" and "geometry" in member:
                    for p in member["geometry"]:
                        coords.append((p["lon"], p["lat"]))
            if coords:
                # If it's one long ring, try to close it
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                try:
                    poly = Polygon(coords)
                    if poly.is_valid and not poly.is_empty:
                        geoms.append(poly)
                except Exception:
                    continue
        # fallback: some responses include geometry directly on the relation element
        if el.get("type") == "relation" and "geometry" in el:
            coords = [(p["lon"], p["lat"]) for p in el["geometry"]]
            if len(coords) >= 4:
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                try:
                    poly = Polygon(coords)
                    if poly.is_valid and not poly.is_empty:
                        geoms.append(poly)
                except Exception:
                    continue

    # If we built multiple polygons, union them
    if not geoms:
        raise RuntimeError(f"No relation geometry found for '{place_name}'. Try a more specific name.")
    if len(geoms) == 1:
        return geoms[0]
    return shapely.ops.unary_union(geoms)


# -------------------------
# Main
# -------------------------
def main(place_name, land_shp_path):
    # 1) Load the land polygons shapefile (may be large)
    print("Loading land polygons shapefile (this may take a moment)...")
    land_gdf = gpd.read_file(land_shp_path)

    # Ensure the land polygons are in WGS84 lon/lat (EPSG:4326)
    if land_gdf.crs is None:
        print("Warning: input shapefile has no CRS. Assuming EPSG:4326 (lon/lat).")
        land_gdf.set_crs(epsg=4326, inplace=True)
    elif land_gdf.crs.to_string() != "EPSG:4326":
        print(f"Reprojecting land polygons from {land_gdf.crs} to EPSG:4326...")
        land_gdf = land_gdf.to_crs(epsg=4326)

    # 2) Fetch admin boundary from Overpass
    print(f"Fetching administrative boundary for '{place_name}' from Overpass...")
    boundary_geom = fetch_place_boundary(place_name)
    # ensure valid
    if not boundary_geom.is_valid:
        boundary_geom = boundary_geom.buffer(0)

    # Convert to GeoDataFrame for spatial ops
    boundary_gdf = gpd.GeoDataFrame(geometry=[boundary_geom], crs="EPSG:4326")

    # 3) Spatial filter by bounding box first (faster)
    minx, miny, maxx, maxy = boundary_geom.bounds
    print("Filtering land polygons by bounding box to limit memory usage...")
    # .cx works with (minx, maxx) for x and (miny,maxy) for y if GeoDataFrame is lon/lat,
    # but use intersects for compatibility
    bbox_poly = box(minx, miny, maxx, maxy)
    land_subset = land_gdf[land_gdf.intersects(bbox_poly)].copy()
    if land_subset.empty:
        print("No land polygons found in the boundary bbox. The shapefile may not contain land in this region.")
        # Still show the boundary alone
        land_subset = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")

    # 4) Intersect the land polygons with the boundary to clamp to landmass
    print("Intersecting land polygons with the administrative boundary (this may take a bit)...")
    # Reproject to same CRS (already ensured)
    # Use overlay/intersection per-row; more efficient approach is to unary_union the land subset first
    try:
        # union the land pieces (optional step for simpler geometry)
        land_union = shapely.ops.unary_union(land_subset.geometry) if len(land_subset) > 0 else None
        if land_union:
            clamped_geom = boundary_geom.intersection(land_union)
        else:
            clamped_geom = boundary_geom  # fallback
    except Exception as e:
        print("Union/intersection failed, falling back to per-feature intersection:", e)
        parts = []
        for geom in land_subset.geometry:
            try:
                inter = geom.intersection(boundary_geom)
                if not inter.is_empty:
                    parts.append(inter)
            except Exception:
                continue
        clamped_geom = shapely.ops.unary_union(parts) if parts else boundary_geom

    # ensure valid geometry
    if not clamped_geom.is_valid:
        clamped_geom = clamped_geom.buffer(0)

    # 5) Create a Folium map and add layers
    center = [ (miny + maxy) / 2.0, (minx + maxx) / 2.0 ]
    m = folium.Map(location=center, zoom_start=11, tiles="OpenStreetMap")

    # Add original admin boundary (outline)
    folium.GeoJson(
        mapping(boundary_geom),
        name=f"{place_name} - original admin boundary",
        style_function=lambda feat: {"color": "black", "weight": 2, "fill": False},
        tooltip=f"{place_name} (admin)"
    ).add_to(m)

    # Add land polygons inside boundary (filled)
    folium.GeoJson(
        mapping(clamped_geom),
        name=f"{place_name} - land-only (clamped)",
        style_function=lambda feat: {"color": "blue", "weight": 1, "fillColor": "lightblue", "fillOpacity": 0.5},
        tooltip="Land-only clamped area"
    ).add_to(m)

    folium.LayerControl().add_to(m)

    # Save map
    safe_name = place_name.lower().replace(" ", "_")
    out_html = f"land_clamped_{safe_name}.html"
    m.save(out_html)
    print("Map saved to", out_html)

if __name__ == "__main__":
    main(PLACE_NAME, LAND_SHP_PATH)
