// src/components/map/MapView.tsx
/**
 * Main map component for the Size of Anything application.
 * Uses Cesium for 3D globe with extruded area polygons.
 */
import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  CustomDataSource,
  Math as CesiumMath,
  Rectangle,
  UrlTemplateImageryProvider,
  ArcGisMapServerImageryProvider,
  Color,
  CallbackProperty,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "../../styles/mapDarkMode.css";
import "../../styles/ShareButton.css";
import "../../styles/LayerToggleButton.css";
import "../../styles/markerLabels.css";
import { useMapStore } from "../../state/mapStore";
import { useSettings, applyMapTheme } from "../../state/settingsStore";
import type { GeoJSONFeature, MapState } from "../../state/mapStoreTypes";
import Portals from "./Portals";
import { createCesiumMapAdapter } from "./cesiumMapAdapter";
import type { IMapAdapter } from "./mapAdapter";
import {
  featureToEntities,
  featureToHoverEntities,
  createAreasDataSource,
  getCoords,
} from "./cesiumUtils";
import { ScreenSpaceEventType, Cartesian3 as CesiumCartesian3 } from "cesium";
import { hybridProjectAndTranslateGeometry } from "../utils/geometryUtils";
import { getShapeCenter, getShapeCenterFromCoords } from "./portalUtils";

async function findUserLocation(timeout = 3000): Promise<[number, number]> {
  const defaultCenter: [number, number] = [47.615, -122.035];
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch("https://geolocation-db.com/json/", {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return defaultCenter;
    const data = await res.json();
    if (data?.latitude && data?.longitude) {
      return [Number(data.latitude), Number(data.longitude)] as [number, number];
    }
    return defaultCenter;
  } catch {
    return defaultCenter;
  }
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const mapAdapterRef = useRef<IMapAdapter | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const geojsonAreas = useMapStore(
    (state: MapState) => state.geojsonAreas
  ) as GeoJSONFeature[];
  const isSelectingArea = useMapStore(
    (state: MapState) => state.isSelectingArea
  );
  const setClickedPosition = useMapStore(
    (state: MapState) => state.setClickedPosition
  );
  const activeAreaId = useMapStore(
    (state: MapState) => state.activeAreaId
  );
  const setActiveArea = useMapStore(
    (state: MapState) => state.setActiveArea
  );
  const setCurrentMapCenter = useMapStore(
    (state: MapState) => state.setCurrentMapCenter
  );
  const clearBringToFocus = useMapStore(
    (state: MapState) => state.clearBringToFocus
  );
  const hoveredCandidate = useMapStore(
    (state: MapState) => state.hoveredCandidate
  );
  const magicWandMode = useMapStore(
    (state: MapState) => state.magicWandMode
  );
  const { mapLayerType, pinSettings } = useSettings();

  const areasDataSourceRef = useRef<ReturnType<typeof createAreasDataSource> | null>(null);
  const labelsDataSourceRef = useRef<CustomDataSource | null>(null);
  const hoverDataSourceRef = useRef<CustomDataSource | null>(null);
  const dragStateRef = useRef<{
    featureId: string;
    /** [lng, lat] where the mouse was on the globe when drag started */
    initialMouse: [number, number];
    /** [lng, lat] shape center when drag started */
    initialCenter: [number, number];
  } | null>(null);
  const didDragRef = useRef(false);
  const dragLastCoordsRef = useRef<number[][][] | number[][][][] | null>(null);
  /** Live coordinates for area polygons; CallbackProperty reads this so drag updates in real time. */
  const liveCoordsRef = useRef<Record<string, number[][][] | number[][][][]>>({});
  /** Center [lat, lng] per featureId so labels follow the shape during drag. */
  const centerRef = useRef<Record<string, [number, number]>>({});

  // Create Cesium Viewer and map adapter once
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    const initMap = async () => {
      const center = await findUserLocation();
      if (cancelled) return;

      if (!viewerRef.current) {
        const viewer = new Viewer(mapRef.current!, {
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          vrButton: false,
          infoBox: false,
          selectionIndicator: false,
          useDefaultRenderLoop: true,
          requestRenderMode: false,
        });

        viewerRef.current = viewer;
        const adapter = createCesiumMapAdapter(viewer);
        mapAdapterRef.current = adapter;

        setCurrentMapCenter(center);
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(center[1], center[0], 500000),
          duration: 0,
        });

        viewer.camera.moveEnd.addEventListener(() => {
          const carto = viewer.camera.positionCartographic;
          setCurrentMapCenter([
            CesiumMath.toDegrees(carto.latitude),
            CesiumMath.toDegrees(carto.longitude),
          ]);
        });

        const areasDataSource = createAreasDataSource();
        viewer.dataSources.add(areasDataSource);
        areasDataSourceRef.current = areasDataSource;

        const labelsDataSource = new CustomDataSource("areaLabels");
        viewer.dataSources.add(labelsDataSource);
        labelsDataSourceRef.current = labelsDataSource;

        const hoverDataSource = new CustomDataSource("hoverHighlight");
        viewer.dataSources.add(hoverDataSource);
        hoverDataSourceRef.current = hoverDataSource;

        const handler = viewer.screenSpaceEventHandler;
        handler.setInputAction((click: { position?: { x: number; y: number } }) => {
          if (didDragRef.current || !click.position) return;
          const picked = viewer.scene.pick(click.position);
          const entity = picked?.id;
          if (entity && entity.name) {
            setActiveArea(entity.name);
            return;
          }
          setActiveArea(null);
          const isSelecting = useMapStore.getState().isSelectingArea;
          if (isSelecting) {
            const ray = viewer.camera.getPickRay(click.position);
            if (ray) {
              const position = viewer.scene.globe.pick(ray, viewer.scene);
              if (position) {
                const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
                setClickedPosition([
                  CesiumMath.toDegrees(carto.latitude),
                  CesiumMath.toDegrees(carto.longitude),
                ]);
              }
            }
          }
          const onMapClickFn = useMapStore.getState().onMapClick;
          if (onMapClickFn && viewer.scene.globe.ellipsoid) {
            const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            if (cartesian) {
              const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
              onMapClickFn({ lat: CesiumMath.toDegrees(carto.latitude), lng: CesiumMath.toDegrees(carto.longitude) } as any);
            }
          }
        }, ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement: { endPosition?: { x: number; y: number } }) => {
          const dragState = dragStateRef.current;
          if (!dragState || !movement.endPosition) return;
          didDragRef.current = true;
          const ray = viewer.camera.getPickRay(movement.endPosition);
          if (!ray) return;
          const position = viewer.scene.globe.pick(ray, viewer.scene) ?? viewer.scene.globe.ellipsoid.intersectRay(ray);
          if (!position) return;
          const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
          const currentMouseLng = CesiumMath.toDegrees(carto.longitude);
          const currentMouseLat = CesiumMath.toDegrees(carto.latitude);
          const deltaLng = currentMouseLng - dragState.initialMouse[0];
          const deltaLat = currentMouseLat - dragState.initialMouse[1];
          const targetCoordinates: [number, number] = [
            dragState.initialCenter[0] + deltaLng,
            dragState.initialCenter[1] + deltaLat,
          ];
          const store = useMapStore.getState();
          const feature = store.geojsonAreas.find(
            (f) =>
              f.properties?.id === dragState.featureId ||
              (f.properties?.index != null && `geojson-${f.properties.index}` === dragState.featureId)
          );
          if (!feature) return;
          const baseCoords =
            dragLastCoordsRef.current ??
            (feature.geometry as any).currentCoordinates ??
            (feature.geometry as any).rotatedCoordinates ??
            feature.geometry.coordinates;
          const featureForTransform = {
            type: "Feature" as const,
            properties: feature.properties,
            geometry: {
              type: feature.geometry.type,
              coordinates: baseCoords,
            },
          };
          const translated = hybridProjectAndTranslateGeometry(
            featureForTransform as any,
            targetCoordinates
          );
          const newCoords = (translated.geometry as any).coordinates;
          dragLastCoordsRef.current = newCoords;
          liveCoordsRef.current[dragState.featureId] = newCoords;
          centerRef.current[dragState.featureId] = getShapeCenterFromCoords(
            newCoords,
            feature.geometry.type as "Polygon" | "MultiPolygon"
          );
        }, ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction((_click: unknown) => {
          const controller = viewer.scene.screenSpaceCameraController;
          controller.enableRotate = true;
          controller.enableTranslate = true;
          const wasDragging = didDragRef.current;
          const dragState = dragStateRef.current;
          const lastCoords = dragLastCoordsRef.current;
          dragStateRef.current = null;
          didDragRef.current = false;
          dragLastCoordsRef.current = null;
          if (wasDragging && dragState && lastCoords) {
            useMapStore.getState().updateCurrentCoordinates(dragState.featureId, lastCoords);
          }
        }, ScreenSpaceEventType.LEFT_UP);

        handler.setInputAction((click: { position?: { x: number; y: number } }) => {
          if (!click.position) return;
          const picked = viewer.scene.pick(click.position);
          const entity = picked?.id;
          if (entity && entity.name) {
            const featureId = entity.name;
            const feature = useMapStore.getState().geojsonAreas.find(
              (f) =>
                f.properties?.id === featureId ||
                (f.properties?.index != null && `geojson-${f.properties.index}` === featureId)
            );
            if (!feature) return;
            const baseCoords =
              (feature.geometry as any).currentCoordinates ??
              (feature.geometry as any).rotatedCoordinates ??
              feature.geometry.coordinates;
            const [centerLat, centerLng] = getShapeCenterFromCoords(
              baseCoords,
              feature.geometry.type as "Polygon" | "MultiPolygon"
            );
            const ray = viewer.camera.getPickRay(click.position);
            const position = ray
              ? (viewer.scene.globe.pick(ray, viewer.scene) ?? viewer.scene.globe.ellipsoid.intersectRay(ray))
              : null;
            if (!position) return;
            const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
            const initialMouse: [number, number] = [
              CesiumMath.toDegrees(carto.longitude),
              CesiumMath.toDegrees(carto.latitude),
            ];
            dragStateRef.current = {
              featureId,
              initialMouse,
              initialCenter: [centerLng, centerLat],
            };
            const controller = viewer.scene.screenSpaceCameraController;
            controller.enableRotate = false;
            controller.enableTranslate = false;
          }
        }, ScreenSpaceEventType.LEFT_DOWN);

        (window as any).cesiumViewerRef = viewerRef;
        setMapReady(true);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        if (areasDataSourceRef.current) {
          viewerRef.current.dataSources.remove(areasDataSourceRef.current);
          areasDataSourceRef.current = null;
        }
        if (labelsDataSourceRef.current) {
          viewerRef.current.dataSources.remove(labelsDataSourceRef.current);
          labelsDataSourceRef.current = null;
        }
        if (hoverDataSourceRef.current) {
          viewerRef.current.dataSources.remove(hoverDataSourceRef.current);
          hoverDataSourceRef.current = null;
        }
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      mapAdapterRef.current = null;
      (window as any).cesiumViewerRef = undefined;
    };
  }, [setCurrentMapCenter]);

  // Resize observer
  useEffect(() => {
    if (!mapReady || !viewerRef.current) return;
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      viewerRef.current?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapReady]);

  // Apply map theme (CSS variables + Cesium globe base color)
  useEffect(() => {
    const { mapTheme, theme } = useSettings.getState();
    applyMapTheme(mapTheme, theme);
    const unsubscribe = useSettings.subscribe((state) => {
      applyMapTheme(state.mapTheme, state.theme);
    });
    return () => unsubscribe();
  }, []);

  // Cesium globe base color from theme
  useEffect(() => {
    if (!viewerRef.current) return;
    const { mapTheme, theme } = useSettings.getState();
    const effective =
      mapTheme === "system"
        ? theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
        : mapTheme === "dark";
    viewerRef.current.scene.globe.baseColor = effective
      ? new Color(0.15, 0.15, 0.2, 1)
      : new Color(0.5, 0.6, 0.7, 1);
  }, [mapReady]);

  useEffect(() => {
    const unsub = useSettings.subscribe((state) => {
      if (!viewerRef.current) return;
      const { mapTheme, theme } = state;
      const effective =
        mapTheme === "system"
          ? theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
          : mapTheme === "dark";
      viewerRef.current.scene.globe.baseColor = effective
        ? new Color(0.15, 0.15, 0.2, 1)
        : new Color(0.5, 0.6, 0.7, 1);
    });
    return () => unsub();
  }, []);

  // Imagery layer: OSM or Esri World Imagery (replace default)
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const layers = viewer.imageryLayers;
    while (layers.length > 0) {
      layers.remove(layers.get(0));
    }
    const provider =
      mapLayerType === "satellite"
        ? new ArcGisMapServerImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          })
        : new UrlTemplateImageryProvider({
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            subdomains: ["a", "b", "c"],
          });
    layers.addImageryProvider(provider);
  }, [mapReady, mapLayerType]);

  // Sync geojsonAreas to Cesium polygon entities (with extrusion and active highlight).
  // Entities use CallbackProperty for hierarchy reading from liveCoordsRef so drag is smooth.
  useEffect(() => {
    const ds = areasDataSourceRef.current;
    const live = liveCoordsRef.current;
    if (!ds) return;
    // Snapshot coords for this run so callbacks have data even on first frame (creation from History etc.)
    const initialCoords: Record<string, number[][][] | number[][][][]> = {};
    geojsonAreas.forEach((feature) => {
      const featureId = feature.properties?.id ?? (feature.properties?.index != null ? `geojson-${feature.properties.index}` : "");
      const coords = getCoords(feature);
      if (featureId) {
        live[featureId] = coords;
        initialCoords[featureId] = coords;
        centerRef.current[featureId] = getShapeCenter(feature);
      }
    });
    ds.entities.removeAll();
    const getCoordsForEntity = (featureId: string, partIndex?: number): number[][][] => {
      const c = live[featureId] ?? initialCoords[featureId];
      if (!c) return [];
      if (partIndex === undefined) return c as number[][][];
      return (c as number[][][][])[partIndex] ?? [];
    };
    geojsonAreas.forEach((feature) => {
      const entities = featureToEntities(feature, activeAreaId, getCoordsForEntity);
      entities.forEach((e) => ds.entities.add(e));
    });
  }, [geojsonAreas, activeAreaId]);

  // Sync labels (and optional pins) from pin settings. Position uses CallbackProperty so labels move with shape during drag.
  useEffect(() => {
    const ds = labelsDataSourceRef.current;
    const centers = centerRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (pinSettings.mode === "disabled") return;
    geojsonAreas.forEach((feature) => {
      const name = feature.properties?.name ?? "Unnamed Area";
      if (!name && pinSettings.labelMode !== "always") return;
      const featureId = feature.properties?.id ?? (feature.properties?.index != null ? `geojson-${feature.properties.index}` : "");
      if (!featureId) return;
      const positionCallback = new CallbackProperty(() => {
        const c = centers[featureId];
        return c ? CesiumCartesian3.fromDegrees(c[1], c[0], 0) : undefined;
      }, false);
      if (pinSettings.labelMode === "always" || pinSettings.mode === "always") {
        ds.entities.add({
          position: positionCallback,
          label: {
            text: name,
            font: `bold ${pinSettings.fontSize ?? 16}px sans-serif`,
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 3,
            style: 0,
            verticalOrigin: 1,
            pixelOffset: new Cartesian2(0, -20),
          },
        });
      }
    });
  }, [geojsonAreas, pinSettings.mode, pinSettings.labelMode, pinSettings.fontSize]);

  // Hover candidate highlight
  useEffect(() => {
    const ds = hoverDataSourceRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (hoveredCandidate) {
      featureToHoverEntities(hoveredCandidate).forEach((e) => ds.entities.add(e));
    }
  }, [hoveredCandidate]);

  // Fly to new shape when shouldBringToFocus
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const toFocus = geojsonAreas.find((f) => f.properties?.shouldBringToFocus === true);
    if (!toFocus) return;
    const coords = (toFocus.geometry as any).currentCoordinates ?? (toFocus.geometry as any).rotatedCoordinates ?? toFocus.geometry.coordinates;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    const expand = (ring: number[][]) => {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
      }
    };
    if (toFocus.geometry.type === "Polygon") {
      (coords as number[][][]).forEach(expand);
    } else {
      (coords as number[][][][]).forEach((part) => part.forEach(expand));
    }
    if (minLng !== Infinity) {
      const west = (minLng * Math.PI) / 180;
      const south = (minLat * Math.PI) / 180;
      const east = (maxLng * Math.PI) / 180;
      const north = (maxLat * Math.PI) / 180;
      viewer.camera.flyTo({
        destination: Rectangle.fromRadians(west, south, east, north),
        duration: 0.5,
      });
      clearBringToFocus(toFocus.properties?.id ?? "");
    }
  }, [geojsonAreas, clearBringToFocus]);

  return (
    <div
      className={`map-container ${isSelectingArea ? "selecting-area" : ""} ${
        magicWandMode ? "magic-wand-active" : ""
      }`}
    >
      <div id="map" ref={mapRef} className="cesium-map-container" />
      {mapReady && (
        <Portals mapRef={mapRef} mapAdapterRef={mapAdapterRef} />
      )}
    </div>
  );
}
