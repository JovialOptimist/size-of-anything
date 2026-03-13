/**
 * Cesium implementation of IMapAdapter for the main 3D map.
 */
import type { Viewer } from "cesium";
import {
  Cartographic,
  Cartesian3,
  Math as CesiumMath,
  SceneTransforms,
} from "cesium";
import type { IMapAdapter } from "./mapAdapter";

/** Convert Leaflet-style zoom level (0–22) to approximate Cesium camera height in meters. */
export function zoomLevelToCameraHeight(zoom: number): number {
  const t = Math.max(0, Math.min(22, zoom));
  const minH = 500;
  const maxH = 40_000_000;
  const factor = Math.pow(maxH / minH, (22 - t) / 22);
  return minH * factor;
}

/** Convert Cesium camera height in meters to approximate Leaflet zoom level. */
export function cameraHeightToZoomLevel(height: number): number {
  const minH = 500;
  const maxH = 40_000_000;
  const clamped = Math.max(minH, Math.min(maxH, height));
  const ratio = clamped / minH;
  const t = 22 - (22 * Math.log(ratio)) / Math.log(maxH / minH);
  return Math.max(0, Math.min(22, t));
}

export function createCesiumMapAdapter(viewer: Viewer): IMapAdapter {
  const camera = viewer.camera;
  const scene = viewer.scene;
  const canvas = viewer.canvas;

  const moveEndListeners: (() => void)[] = [];
  camera.moveEnd.addEventListener(() => {
    moveEndListeners.forEach((fn) => fn());
  });

  return {
    getCenter(): { lat: number; lng: number } {
      const carto = camera.positionCartographic;
      return {
        lat: CesiumMath.toDegrees(carto.latitude),
        lng: CesiumMath.toDegrees(carto.longitude),
      };
    },

    getZoom(): number {
      return cameraHeightToZoomLevel(camera.positionCartographic.height);
    },

    getSize(): { x: number; y: number } {
      return {
        x: canvas.clientWidth,
        y: canvas.clientHeight,
      };
    },

    flyTo(
      center: [number, number],
      zoom?: number,
      options?: { duration?: number }
    ): void {
      const [lat, lng] = center;
      const height =
        zoom !== undefined
          ? zoomLevelToCameraHeight(zoom)
          : camera.positionCartographic.height;
      const destination = Cartesian3.fromDegrees(lng, lat, height);
      camera.flyTo({
        destination,
        duration: options?.duration ?? 0.4,
      });
    },

    latLngToContainerPoint(latLng: {
      lat: number;
      lng: number;
    }): { x: number; y: number } {
      const carto = Cartographic.fromDegrees(latLng.lng, latLng.lat, 0);
      const cartesian = Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        carto.height
      );
      const windowPos = SceneTransforms.wgs84ToWindowCoordinates(
        scene,
        cartesian
      );
      if (!windowPos) return { x: 0, y: 0 };
      return { x: windowPos.x, y: windowPos.y };
    },

    containerPointToLatLng(xy: {
      x: number;
      y: number;
    }): { lat: number; lng: number } {
      const ray = camera.getPickRay({ x: xy.x, y: xy.y });
      if (!ray) return { lat: 0, lng: 0 };
      const position = scene.globe.pick(ray, scene);
      if (!position) {
        // Fallback: intersect with ellipsoid
        const ellipsoid = scene.globe.ellipsoid;
        const intersection = ellipsoid.intersectRay(ray);
        if (!intersection) return { lat: 0, lng: 0 };
        const carto = ellipsoid.cartesianToCartographic(intersection);
        return {
          lat: CesiumMath.toDegrees(carto.latitude),
          lng: CesiumMath.toDegrees(carto.longitude),
        };
      }
      const carto = scene.globe.ellipsoid.cartesianToCartographic(position);
      return {
        lat: CesiumMath.toDegrees(carto.latitude),
        lng: CesiumMath.toDegrees(carto.longitude),
      };
    },

    on(event: string, fn: () => void): void {
      if (event === "move" || event === "moveend" || event === "zoom" || event === "zoomend") {
        moveEndListeners.push(fn);
      }
    },

    off(_event: string, fn: () => void): void {
      const i = moveEndListeners.indexOf(fn);
      if (i !== -1) moveEndListeners.splice(i, 1);
    },
  };
}
