import requests
import shapely.geometry
import shapely.ops
import geopandas as gpd
import folium

# --- 1. Find the place boundary (New York City as an example) ---
def fetch_place_boundary(place_name):
    query = f"""
    [out:json];
    relation["name"="{place_name}"]["boundary"="administrative"];
    out geom;
    """
    url = "https://overpass-api.de/api/interpreter"
    r = requests.get(url, params={"data": query})
    data = r.json()
    for el in data["elements"]:
        if el["type"] == "relation":
            coords = [(p["lon"], p["lat"]) for m in el["members"] if m["type"] == "way" for p in m["geometry"]]
            return shapely.geometry.Polygon(coords)
    return None

# --- 2. Fetch water polygons inside that boundary ---
def fetch_water(boundary):
    minx, miny, maxx, maxy = boundary.bounds
    query = f"""
    [out:json];
    (
      way["natural"="water"]({miny},{minx},{maxy},{maxx});
      way["waterway"]({miny},{minx},{maxy},{maxx});
      way["landuse"="reservoir"]({miny},{minx},{maxy},{maxx});
    );
    out geom;
    """
    url = "https://overpass-api.de/api/interpreter"
    r = requests.get(url, params={"data": query})
    data = r.json()

    water_polys = []
    for el in data["elements"]:
        if "geometry" in el:
            coords = [(p["lon"], p["lat"]) for p in el["geometry"]]

            # Skip if not enough coords
            if len(coords) < 4:
                continue

            # Ensure the ring is closed
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            try:
                poly = shapely.geometry.Polygon(coords)
                if poly.is_valid and not poly.is_empty:
                    water_polys.append(poly)
            except Exception:
                # Skip any invalid geometry
                continue

    return shapely.ops.unary_union(water_polys) if water_polys else None


# --- 3. Subtract water from land boundary ---
def land_only_boundary(place_name):
    boundary = fetch_place_boundary(place_name)
    water = fetch_water(boundary)
    if boundary and water:
        # Ensure both geometries are valid before difference
        if not boundary.is_valid:
            boundary = boundary.buffer(0)
        if not water.is_valid:
            water = water.buffer(0)
        land = boundary.difference(water)
        return land
    return boundary

# --- Example: get NYC land-only boundary ---
land_nyc = land_only_boundary("Monaco")
gdf = gpd.GeoDataFrame(geometry=[land_nyc], crs="EPSG:4326")
print(gdf.to_json())

# Show the result on a map
# Center the map on the centroid of the geometry
center = [land_nyc.centroid.y, land_nyc.centroid.x]
m = folium.Map(location=center, zoom_start=13)

# Add the land-only boundary as a GeoJson layer with a popup
geojson = folium.GeoJson(
    land_nyc,
    name="Land Only Boundary",
    style_function=lambda x: {"color": "blue", "weight": 2, "fillOpacity": 0.1},
    tooltip="Land Only Boundary",
    popup=folium.Popup("Land Only Boundary Outline", max_width=300)
)
geojson.add_to(m)

m.save("land_only_boundary_map.html")
print("Map saved to land_only_boundary_map.html")
