/**
 * Custom Leaflet layer that draws satellite imagery (from Esri World Imagery)
 * for a fixed geographic bounds, clipped to the current polygon. The image
 * moves with the shape so it behaves like "taking a picture and dragging it."
 */
import L from "leaflet";

const TILE_SIZE = 256;
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** [minLng, minLat, maxLng, maxLat] */
type Bbox = [number, number, number, number];

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function getTileRange(bbox: Bbox, zoom: number): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    xMin: lngToTileX(minLng, zoom),
    xMax: lngToTileX(maxLng, zoom),
    yMin: latToTileY(maxLat, zoom),
    yMax: latToTileY(minLat, zoom),
  };
}

/** Choose zoom so that we use at most maxTilesPerAxis tiles (e.g. 8). */
function zoomForBounds(bbox: Bbox, maxTilesPerAxis: number): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  for (let z = 20; z >= 0; z--) {
    const r = getTileRange(bbox, z);
    const w = r.xMax - r.xMin + 1;
    const h = r.yMax - r.yMin + 1;
    if (w <= maxTilesPerAxis && h <= maxTilesPerAxis) return z;
  }
  return 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Don't set crossOrigin - Esri tiles may not send CORS headers; without it
    // tiles load and can be drawn to canvas (canvas is tainted but we only display it).
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${src}`));
    img.src = src;
  });
}

/** Composite satellite tiles for the given bbox and zoom into a single canvas. */
async function compositeTiles(
  bbox: Bbox,
  zoom: number
): Promise<HTMLCanvasElement> {
  const r = getTileRange(bbox, zoom);
  const tw = r.xMax - r.xMin + 1;
  const th = r.yMax - r.yMin + 1;
  const canvas = document.createElement("canvas");
  canvas.width = tw * TILE_SIZE;
  canvas.height = th * TILE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const positions: { x: number; y: number; url: string }[] = [];
  for (let ty = r.yMin; ty <= r.yMax; ty++) {
    for (let tx = r.xMin; tx <= r.xMax; tx++) {
      const url = ESRI_IMAGERY_URL.replace("{z}", String(zoom))
        .replace("{y}", String(ty))
        .replace("{x}", String(tx));
      positions.push({
        x: (tx - r.xMin) * TILE_SIZE,
        y: (ty - r.yMin) * TILE_SIZE,
        url,
      });
    }
  }

  await Promise.all(
    positions.map(async (pos, i) => {
      try {
        const img = await loadImage(pos.url);
        ctx.drawImage(img, pos.x, pos.y, TILE_SIZE, TILE_SIZE);
      } catch {
        // Skip failed tiles; others will still draw
      }
    })
  );

  return canvas;
}

/**
 * Get outer ring(s) from a Leaflet GeoJSON layer so the clip path exactly
 * matches the visible polygon(s). Returns array of rings; each ring is L.LatLng[].
 */
export function getOuterRingsFromGeoJSONLayer(
  layer: L.GeoJSON
): L.LatLng[][] {
  const rings: L.LatLng[][] = [];
  layer.eachLayer((inner) => {
    if (!(inner instanceof L.Polygon)) return;
    const latLngs = (inner as L.Polygon).getLatLngs();
    if (!Array.isArray(latLngs) || latLngs.length === 0) return;
    // First element is outer ring (Leaflet Polygon: [outerRing, hole1, ...])
    const outer = latLngs[0];
    if (Array.isArray(outer) && outer.length >= 3) {
      rings.push(outer as L.LatLng[]);
    }
  });
  return rings;
}

export interface SatelliteSnapshotLayerOptions extends L.LayerOptions {
  /** Fixed bounds [minLng, minLat, maxLng, maxLat] for the satellite image. */
  snapshotBounds: Bbox;
  /** Returns current outer ring(s) from the polygon layer so clip stays in sync (e.g. during drag). */
  getClipLatLngs: () => L.LatLng[][];
}

export const SatelliteSnapshotLayer = L.Layer.extend({
  options: {
    pane: "overlayPane",
  },

  initialize(options: SatelliteSnapshotLayerOptions) {
    L.Util.setOptions(this, options);
    this._getClipLatLngs = options.getClipLatLngs;
    this._snapshotBounds = options.snapshotBounds;
    this._canvas = null;
    this._imageCanvas = null;
    this._imagePromise = null;
    this._moveRaf = null;
  },

  getEvents() {
    return {
      move: this._onMove.bind(this),
      moveend: this._update.bind(this),
      zoomend: this._update.bind(this),
    };
  },

  _onMove() {
    if (this._moveRaf != null) return;
    const self = this;
    this._moveRaf = requestAnimationFrame(() => {
      self._moveRaf = null;
      self._update();
    });
  },

  onAdd(map: L.Map) {
    this._map = map;
    this._update();
    this._imagePromise = this._loadImage();
    this._imagePromise
      .then(() => this._update())
      .catch((err) => {
        console.warn("SatelliteSnapshotLayer: tile load failed", err);
        this._update();
      });
    return this;
  },

  onRemove(map: L.Map) {
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._imageCanvas = null;
    const superOnRemove = (L.Layer.prototype as any).onRemove;
    if (superOnRemove) superOnRemove.call(this, map);
    return this;
  },

  async _loadImage(): Promise<void> {
    const zoom = zoomForBounds(this._snapshotBounds, 8);
    this._imageCanvas = await compositeTiles(this._snapshotBounds, zoom);
  },

  _update() {
    const map = this._map;
    if (!map) return;

    const rings = this._getClipLatLngs();
    if (!rings.length) return;

    const container = map.getContainer();
    if (!this._canvas) {
      this._canvas = document.createElement("canvas");
      this._canvas.style.position = "absolute";
      this._canvas.style.left = "0";
      this._canvas.style.top = "0";
      this._canvas.style.pointerEvents = "none";
      const pane = (map as any).getPane(this.options.pane);
      if (pane) pane.appendChild(this._canvas);
      else container.appendChild(this._canvas);
    }

    const size = map.getSize();
    if (!size || size.x <= 0 || size.y <= 0) return;

    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this._canvas.style.width = size.x + "px";
    this._canvas.style.height = size.y + "px";

    const ctx = this._canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size.x, size.y);

    if (!this._imageCanvas) return;

    // Canvas is in the overlay pane (child of map pane). The map pane moves on pan,
    // so (0,0) of our canvas = (0,0) of the pane is at container _getMapPanePos().
    // So to draw at container position C we must draw at C - _getMapPanePos().
    const mapPanePos = (map as any)._getMapPanePos?.() || L.point(0, 0);
    const allPoints: L.Point[][] = [];
    let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;
    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      const points: L.Point[] = [];
      for (const ll of ring) {
        const latlng = ll instanceof L.LatLng ? ll : L.latLng((ll as any).lat, (ll as any).lng);
        const containerPt = map.latLngToContainerPoint(latlng);
        const pt = L.point(containerPt.x - mapPanePos.x, containerPt.y - mapPanePos.y);
        points.push(pt);
        globalMinX = Math.min(globalMinX, pt.x);
        globalMaxX = Math.max(globalMaxX, pt.x);
        globalMinY = Math.min(globalMinY, pt.y);
        globalMaxY = Math.max(globalMaxY, pt.y);
      }
      allPoints.push(points);
    }

    if (allPoints.length === 0) return;

    ctx.save();
    ctx.beginPath();
    for (const points of allPoints) {
      if (points.length < 3) continue;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
    }
    ctx.clip("nonzero");

    const w = globalMaxX - globalMinX;
    const h = globalMaxY - globalMinY;
    if (w > 0 && h > 0) {
      ctx.drawImage(this._imageCanvas, globalMinX, globalMinY, w, h);
    }
    ctx.restore();
  },
});

export function createSatelliteSnapshotLayer(
  options: SatelliteSnapshotLayerOptions
): L.Layer {
  return new (SatelliteSnapshotLayer as any)(options);
}
