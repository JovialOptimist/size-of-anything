/**
 * Map adapter interface so Portals and other consumers can work with either
 * a Leaflet map or a Cesium viewer through a single API.
 */
export interface IMapAdapter {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
  getSize(): { x: number; y: number };
  flyTo(
    center: [number, number],
    zoom?: number,
    options?: { duration?: number }
  ): void;
  latLngToContainerPoint(latLng: {
    lat: number;
    lng: number;
  }): { x: number; y: number };
  containerPointToLatLng(xy: {
    x: number;
    y: number;
  }): { lat: number; lng: number };
  on(event: string, fn: () => void): void;
  off(event: string, fn: () => void): void;
}
