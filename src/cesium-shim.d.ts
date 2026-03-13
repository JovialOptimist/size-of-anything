/**
 * Minimal type shim for Cesium when node_modules/cesium is not yet installed.
 * Run: npm install
 * After install, the real Cesium types from the package are used.
 */
declare module "cesium" {
  export class Viewer {
    constructor(container: string | HTMLElement, options?: Record<string, unknown>);
    destroy(): void;
    resize(): void;
    camera: Camera;
    scene: Scene;
    canvas: HTMLCanvasElement;
    imageryLayers: ImageryLayerCollection;
    dataSources: DataSourceCollection;
    screenSpaceEventHandler: ScreenSpaceEventHandler;
  }
  export interface Camera {
    positionCartographic: Cartographic;
    flyTo(options: { destination: Cartesian3 | Rectangle; duration?: number }): void;
    getPickRay(position: { x: number; y: number }): Ray | undefined;
    pickEllipsoid(position: { x: number; y: number }, ellipsoid: Ellipsoid): Cartesian3 | undefined;
    moveEnd: CesiumEvent;
  }
  export class Cartographic {
    latitude: number;
    longitude: number;
    height: number;
    static fromDegrees(longitude: number, latitude: number, height?: number): Cartographic;
  }
  export class Cartesian2 {
    x: number;
    y: number;
    constructor(x: number, y: number);
  }
  export class Cartesian3 {
    static fromDegrees(longitude: number, latitude: number, height?: number): Cartesian3;
    static fromDegreesArray(coords: number[]): Cartesian3[];
    static fromRadians(longitude: number, latitude: number, height?: number): Cartesian3;
  }
  export class Color {
    static BLUE: Color;
    static WHITE: Color;
    static BLACK: Color;
    static fromCssColorString(color: string): Color | undefined;
    withAlpha(alpha: number): Color;
    constructor(red: number, green: number, blue: number, alpha?: number);
  }
  export class Rectangle {
    static fromRadians(west: number, south: number, east: number, north: number): Rectangle;
  }
  export namespace Math {
    export function toDegrees(radians: number): number;
  }
  export class PolygonHierarchy {
    constructor(positions: Cartesian3[], holes?: PolygonHierarchy[]);
  }
  export class Entity {
    constructor(options?: Record<string, unknown>);
    id?: string;
    name?: string;
    position?: unknown;
    label?: unknown;
    polygon?: unknown;
  }
  export class CustomDataSource {
    constructor(name: string);
    entities: EntityCollection;
  }
  export interface EntityCollection {
    add(entity: Entity | Record<string, unknown>): Entity;
    removeAll(): void;
    remove(entity: Entity): boolean;
  }
  export interface DataSourceCollection {
    add(dataSource: CustomDataSource): Promise<CustomDataSource>;
    remove(dataSource: CustomDataSource): boolean;
  }
  export interface Scene {
    pick(position: { x: number; y: number }): { id?: Entity };
    globe: Globe;
    camera: Camera;
  }
  export interface Globe {
    ellipsoid: Ellipsoid;
    baseColor?: Color;
    pick(ray: Ray, scene: Scene): Cartesian3 | undefined;
  }
  export interface Ellipsoid {
    cartesianToCartographic(cartesian: Cartesian3): Cartographic;
    intersectRay(ray: Ray): Cartesian3 | undefined;
  }
  export interface Ray {}
  export interface ImageryLayerCollection {
    length: number;
    get(index: number): ImageryLayer;
    remove(layer: ImageryLayer): boolean;
    addImageryProvider(provider: ImageryProvider): ImageryLayer;
  }
  export interface ImageryLayer {}
  export interface ImageryProvider {}
  export class UrlTemplateImageryProvider {
    constructor(options: { url: string; subdomains?: string[] });
  }
  export class ArcGisMapServerImageryProvider {
    constructor(options: { url: string });
  }
  export namespace SceneTransforms {
    export function wgs84ToWindowCoordinates(scene: Scene, position: Cartesian3): Cartesian2 | undefined;
  }
  export interface CesiumEvent {
    addEventListener(callback: () => void): () => void;
  }
  export class ScreenSpaceEventHandler {
    setInputAction(action: (arg: { position?: { x: number; y: number } }) => void, type: number): void;
  }
  export const ScreenSpaceEventType: {
    LEFT_DOWN: number;
    LEFT_UP: number;
    LEFT_CLICK: number;
    MOUSE_MOVE: number;
  };
}

declare module "cesium/Build/Cesium/Widgets/widgets.css" {
  const url: string;
  export default url;
}

declare module "vite-plugin-cesium" {
  import type { Plugin } from "vite";
  const cesium: () => Plugin;
  export default cesium;
}
