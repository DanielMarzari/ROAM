'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM,
  TRAIL_LINE_COLOR, TRAIL_DASH_PATTERN,
  PATH_LAYER_KEYWORDS, PATH_LAYER_EXCLUDE,
  HIGHWAY_LAYERS, HIGHWAY_COLOR, HIGHWAY_CASING_COLOR,
  MINOR_ROAD_LAYERS, MINOR_ROAD_COLOR, MINOR_ROAD_CASING_COLOR,
  ACTIVITY_TYPES, FILTER_LAYER_MAP,
} from '@/lib/maps/config';
import {
  satelliteSource, satelliteLayer,
  hillshadeSource, hillshadeLayer,
  trailTileSource, trailLinesSolid, trailLinesDashed, trailLinesCasing,
  contourTileSource, contourLineLayer, contourLabelLayer,
  parkFillLayer, parkOutlineLayer, parkLabelLayer,
  tribalLandsSource, tribalLandsFillLayer, tribalLandsOutlineLayer, tribalLandsLabelLayer,
  recreationSource, recreationLayer,
  darkSkySource, darkSkyMarkerLayer,
} from '@/lib/maps/layers';
import type { BasemapStyle, FilterState } from '@/types/map';
import { DEFAULT_FILTERS } from '@/types/map';
import MapControls from './MapControls';
import TrailSidebar from './TrailSidebar';

// Boundary / admin layers to hide (keep boundary_2 = country outlines visible)
const HIDDEN_LAYERS = ['boundary_disputed'];

// Our custom trail layer IDs (hidden by default — only selected trail highlights)
const TRAIL_LAYER_IDS = ['trail-lines-solid', 'trail-lines', 'trail-lines-casing'];
const HOVER_LAYER_IDS = ['trail-hover-casing', 'trail-hover-line'];

// Contour layer IDs
const CONTOUR_LAYER_IDS = ['contour-lines', 'contour-labels'];

// Min zoom to start loading trail data (for sidebar metadata from DB)
const MIN_DATA_ZOOM = 3;

// ── helpers ──

/** Dynamically find basemap layers that are paths/trails (not roads/service tracks) */
function findBasemapPathLayers(map: maplibregl.Map): string[] {
  const style = map.getStyle();
  if (!style?.layers) return [];
  return style.layers
    .filter((layer) => {
      const id = layer.id.toLowerCase();
      const isPath = PATH_LAYER_KEYWORDS.some((kw) => id.includes(kw));
      if (!isPath) return false;
      const isExcluded = PATH_LAYER_EXCLUDE.some((kw) => id.includes(kw));
      return !isExcluded;
    })
    .map((layer) => layer.id);
}

// midpoint() and buildLengthLabels() removed — trail names now come from vector tile labels

// ── Trail types for sidebar ──
export interface TrailItem {
  id: string;
  name: string;
  difficulty: string | null;
  length_miles: number | null;
  elevation_gain_ft: number | null;
  route_type: string | null;
  region: string | null;
  center: [number, number] | null;
  bbox: [number, number, number, number] | null; // [west, south, east, north]
}

export interface TrailGroup {
  name: string;
  trailCount: number;
  totalMiles: number;
  trails: TrailItem[];
  center: [number, number] | null;
}

/** Extract trail list from metadata, grouped by region */
function extractTrailGroups(trails: TrailItem[]): TrailGroup[] {
  const regionMap = new Map<string, TrailItem[]>();

  for (const trail of trails) {
    const key = trail.region || 'Other Trails';
    if (!regionMap.has(key)) regionMap.set(key, []);
    regionMap.get(key)!.push(trail);
  }

  const groups: TrailGroup[] = [];
  for (const [name, regionTrails] of regionMap) {
    regionTrails.sort((a, b) => (b.length_miles || 0) - (a.length_miles || 0));
    const totalMiles = regionTrails.reduce((sum, t) => sum + (t.length_miles || 0), 0);
    const center = regionTrails[0]?.center || null;
    groups.push({ name, trailCount: regionTrails.length, totalMiles: Math.round(totalMiles * 10) / 10, trails: regionTrails, center });
  }

  groups.sort((a, b) => b.totalMiles - a.totalMiles);
  return groups;
}

// ── Component ──

export default function MapContainer() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const basemapPathLayersRef = useRef<string[]>([]);
  // trailGeoJsonRef removed — trails now render from vector tiles
  const hoveredOsmIdRef = useRef<number | null>(null);

  // Refs for stable callbacks
  const showTrailsRef = useRef(true);
  const showBasemapPathsRef = useRef(true);
  const showSatelliteRef = useRef(false);
  const showContoursRef = useRef(false);
  const basemapRef = useRef<BasemapStyle>('outdoor');

  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showBasemapPaths, setShowBasemapPaths] = useState(true);
  const [showContours, setShowContours] = useState(false);
  const [trailGroups, setTrailGroups] = useState<TrailGroup[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const filtersRef = useRef<FilterState>({ ...DEFAULT_FILTERS });
  const recreationLoadedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { showTrailsRef.current = showTrails; }, [showTrails]);
  useEffect(() => { showBasemapPathsRef.current = showBasemapPaths; }, [showBasemapPaths]);
  useEffect(() => { showSatelliteRef.current = showSatellite; }, [showSatellite]);
  useEffect(() => { showContoursRef.current = showContours; }, [showContours]);
  useEffect(() => { basemapRef.current = basemap; }, [basemap]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // ── Basemap helpers ──

  const hideBoundaryLayers = useCallback((map: maplibregl.Map) => {
    for (const id of HIDDEN_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    }
  }, []);

  /** Style basemap path layers as dashed black */
  const setupBasemapPaths = useCallback((map: maplibregl.Map, visible: boolean) => {
    const pathLayers = findBasemapPathLayers(map);
    basemapPathLayersRef.current = pathLayers;
    const vis = visible ? 'visible' : 'none';

    for (const id of pathLayers) {
      if (!map.getLayer(id)) continue;
      const layer = map.getLayer(id);
      map.setLayoutProperty(id, 'visibility', vis);
      try {
        if (layer?.type === 'line') {
          map.setPaintProperty(id, 'line-color', TRAIL_LINE_COLOR);
          map.setPaintProperty(id, 'line-opacity', 0.7);
          map.setPaintProperty(id, 'line-width', 1.5);
          map.setPaintProperty(id, 'line-dasharray', TRAIL_DASH_PATTERN);
        }
      } catch { /* skip */ }
    }
  }, []);

  /** Desaturate roads: highways → grey, minor roads → off-white */
  const desaturateRoads = useCallback((map: maplibregl.Map) => {
    if (basemapRef.current === 'dark') return;

    for (const id of HIGHWAY_LAYERS) {
      if (!map.getLayer(id)) continue;
      try {
        const isCasing = id.includes('casing');
        map.setPaintProperty(id, 'line-color', isCasing ? HIGHWAY_CASING_COLOR : HIGHWAY_COLOR);
      } catch { /* skip */ }
    }
    for (const id of MINOR_ROAD_LAYERS) {
      if (!map.getLayer(id)) continue;
      try {
        const isCasing = id.includes('casing');
        map.setPaintProperty(id, 'line-color', isCasing ? MINOR_ROAD_CASING_COLOR : MINOR_ROAD_COLOR);
      } catch { /* skip */ }
    }
  }, []);

  /** Make parks/greenery green and water blue on topo basemap.
   *  Positron uses specific layer IDs: park, landcover_wood, landuse_residential, water, etc.
   */
  const adjustTopoStyle = useCallback((map: maplibregl.Map) => {
    const style = map.getStyle();
    if (!style?.layers) return;

    for (const layer of style.layers) {
      try {
        const id = layer.id;

        // ── Water → blue ──
        if (id === 'water' && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#aad4e8');
        }
        if (id === 'waterway' && layer.type === 'line') {
          map.setPaintProperty(id, 'line-color', '#8cc4dc');
        }

        // ── Park → green (this covers parks, memorial parks, preserves, etc.) ──
        if (id === 'park' && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#c2e2b8');
          map.setPaintProperty(id, 'fill-opacity', 0.8);
        }

        // ── Landcover wood/forest → darker green ──
        if (id === 'landcover_wood' && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#a8d4a0');
        }

        // ── Landcover ice/glacier — keep white-ish ──
        // landcover_ice_shelf, landcover_glacier — no change needed

        // ── Landuse residential — subtle warm tone ──
        if (id === 'landuse_residential' && layer.type === 'fill') {
          map.setPaintProperty(id, 'fill-color', '#f0eeec');
        }

      } catch { /* skip */ }
    }
  }, []);

  /** Adjust dark mode for better contrast */
  const adjustDarkMode = useCallback((map: maplibregl.Map) => {
    const style = map.getStyle();
    if (!style?.layers) return;
    for (const layer of style.layers) {
      try {
        if (layer.id === 'background') {
          map.setPaintProperty('background', 'background-color', '#191c24');
        }
        if (layer.id.includes('landcover') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#1e2e28');
        }
        if (layer.id.includes('landuse') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#1c2a24');
        }
        if (layer.id.includes('water') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#14253a');
        }
        if (layer.id.includes('building') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#252830');
        }
        if ((layer.id.startsWith('road') || layer.id.startsWith('bridge') || layer.id.startsWith('tunnel')) && layer.type === 'line') {
          const isCasing = layer.id.includes('casing');
          const isHighway = layer.id.includes('motorway') || layer.id.includes('trunk');
          if (isHighway) {
            map.setPaintProperty(layer.id, 'line-color', isCasing ? '#3a3e4a' : '#555e70');
          } else {
            map.setPaintProperty(layer.id, 'line-color', isCasing ? '#2e3040' : '#404558');
          }
        }
        if (layer.type === 'symbol') {
          try {
            map.setPaintProperty(layer.id, 'text-color', '#d0d4e0');
            map.setPaintProperty(layer.id, 'text-halo-color', '#191c24');
            map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
          } catch { /* skip */ }
        }
        // State boundaries lighter in dark mode
        if (layer.id === 'boundary_3') {
          try {
            map.setPaintProperty('boundary_3', 'line-color', '#6b7280');
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }, []);

  const setBasemapPathsVisibility = useCallback((map: maplibregl.Map, visible: boolean) => {
    const vis = visible ? 'visible' : 'none';
    for (const id of basemapPathLayersRef.current) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, []);

  // ── Add all sources and layers ──

  const addSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    // ── Tile sources ──

    // OpenTrailMap trail vector tiles (z5–z14, pre-built from OSM)
    if (!map.getSource('osm-trails')) {
      map.addSource('osm-trails', trailTileSource());
    }

    // Satellite raster overlay
    if (!map.getSource('satellite')) {
      map.addSource('satellite', satelliteSource());
    }

    // Hillshade raster tiles (pre-rendered from OSMU)
    if (!map.getSource('hillshade')) {
      map.addSource('hillshade', hillshadeSource());
    }

    // Contour vector tiles (pre-computed feet, from OSMU)
    if (!map.getSource('contour-source')) {
      map.addSource('contour-source', contourTileSource());
    }

    // (selected-trail GeoJSON source removed — highlights now use vector tile filter)

    // ── Tribal lands source (GeoJSON) ──
    if (!map.getSource('tribal-lands')) {
      map.addSource('tribal-lands', tribalLandsSource());
    }

    // ── Recreation sites source (dynamic GeoJSON) ──
    if (!map.getSource('recreation-sites')) {
      map.addSource('recreation-sites', recreationSource());
    }

    // ── Dark sky source (GeoJSON) ──
    if (!map.getSource('dark-sky')) {
      map.addSource('dark-sky', darkSkySource());
    }

    // ── Overlay layers (added early so trails render on top) ──
    if (!map.getLayer('satellite-layer')) map.addLayer(satelliteLayer);
    if (!map.getLayer('hillshade-layer')) map.addLayer(hillshadeLayer);
    if (!map.getLayer('osm-park-fill')) map.addLayer(parkFillLayer);
    if (!map.getLayer('osm-park-outline')) map.addLayer(parkOutlineLayer);

    // Tribal lands layers (before trails so trails render on top)
    if (!map.getLayer('tribal-lands-fill')) map.addLayer(tribalLandsFillLayer);
    if (!map.getLayer('tribal-lands-outline')) map.addLayer(tribalLandsOutlineLayer);
    if (!map.getLayer('tribal-lands-labels')) map.addLayer(tribalLandsLabelLayer);

    if (!map.getLayer('contour-lines')) map.addLayer(contourLineLayer);
    if (!map.getLayer('contour-labels')) map.addLayer(contourLabelLayer);

    // ── Trail lines from OpenTrailMap vector tiles ──
    if (!map.getLayer('trail-lines-solid')) map.addLayer(trailLinesSolid);
    if (!map.getLayer('trail-lines')) map.addLayer(trailLinesDashed);
    if (!map.getLayer('trail-lines-casing')) map.addLayer(trailLinesCasing);

    // Trail name labels from vector tiles (at higher zoom)
    if (!map.getLayer('trail-name-labels')) {
      map.addLayer({
        id: 'trail-name-labels',
        type: 'symbol',
        source: 'osm-trails',
        'source-layer': 'trail',
        minzoom: 13,
        filter: ['all',
          ['has', 'name'],
          ['has', 'highway'],
          ['in', ['get', 'highway'], ['literal', ['path', 'footway', 'track', 'cycleway', 'bridleway', 'steps']]],
        ],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 15, 11, 17, 13],
          'text-font': ['Noto Sans Bold'],
          'symbol-placement': 'line',
          'text-rotation-alignment': 'map',
          'text-max-angle': 25,
          'text-allow-overlap': false,
          'text-padding': 8,
        },
        paint: {
          'text-color': '#1a1a1a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 1,
        },
      });
    }

    // ── Hover highlight layers (vector tile, filtered by OSM_ID) ──
    // These use the same osm-trails source but filter to only the hovered trail.
    // Initially hidden via impossible filter; updated on mousemove.
    if (!map.getLayer('trail-hover-casing')) {
      map.addLayer({
        id: 'trail-hover-casing',
        type: 'line',
        source: 'osm-trails',
        'source-layer': 'trail',
        filter: ['==', ['get', 'OSM_ID'], -1], // impossible match = hidden
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#065f46',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 10, 18, 14],
          'line-opacity': 0.35,
        },
      });
    }
    if (!map.getLayer('trail-hover-line')) {
      map.addLayer({
        id: 'trail-hover-line',
        type: 'line',
        source: 'osm-trails',
        'source-layer': 'trail',
        filter: ['==', ['get', 'OSM_ID'], -1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#22c55e',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 18, 7],
          'line-opacity': 1,
        },
      });
    }

    // Park labels (above trails for readability)
    if (!map.getLayer('osm-park-labels')) map.addLayer(parkLabelLayer);

    // Recreation activity layers
    for (const actType of Object.keys(ACTIVITY_TYPES)) {
      const layerId = `recreation-${actType}`;
      if (!map.getLayer(layerId)) map.addLayer(recreationLayer(actType));
    }

    // Dark sky markers
    if (!map.getLayer('dark-sky-markers')) map.addLayer(darkSkyMarkerLayer);

    // Restore filter visibility
    for (const [filterKey, layerIds] of Object.entries(FILTER_LAYER_MAP)) {
      const visible = filtersRef.current[filterKey as keyof FilterState];
      const vis = visible ? 'visible' : 'none';
      for (const id of layerIds) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      }
    }

    hideBoundaryLayers(map);

    // Style country outline (boundary_2) — subtle dark line
    if (map.getLayer('boundary_2')) {
      try {
        map.setPaintProperty('boundary_2', 'line-color', '#444444');
        map.setPaintProperty('boundary_2', 'line-width', ['interpolate', ['linear'], ['zoom'], 2, 0.8, 6, 1.5, 10, 2]);
        map.setPaintProperty('boundary_2', 'line-opacity', 0.6);
        map.setLayoutProperty('boundary_2', 'visibility', 'visible');
      } catch { /* skip */ }
    }

    // Style state boundaries (boundary_3) — thinner dashed line
    if (map.getLayer('boundary_3')) {
      try {
        map.setPaintProperty('boundary_3', 'line-color', basemapRef.current === 'dark' ? '#6b7280' : '#888888');
        map.setPaintProperty('boundary_3', 'line-width', ['interpolate', ['linear'], ['zoom'], 3, 0.3, 6, 0.6, 10, 1]);
        map.setPaintProperty('boundary_3', 'line-opacity', 0.4);
        map.setPaintProperty('boundary_3', 'line-dasharray', [4, 2]);
        map.setLayoutProperty('boundary_3', 'visibility', 'visible');
      } catch { /* skip */ }
    }

    setupBasemapPaths(map, showBasemapPathsRef.current);
    desaturateRoads(map);

    // Style adjustments per basemap
    if (basemapRef.current === 'dark') {
      adjustDarkMode(map);
    } else if (basemapRef.current === 'topo') {
      adjustTopoStyle(map);
    }
  }, [hideBoundaryLayers, setupBasemapPaths, desaturateRoads, adjustDarkMode, adjustTopoStyle]);

  // ── Data loading (sidebar metadata from DB, trails render from vector tiles) ──
  // Trail lines render instantly from OpenTrailMap vector tiles — no DB geometry needed.
  // DB is only used for: sidebar metadata + selected trail highlighting.

  const trailMetaCacheRef = useRef<Map<string, TrailItem>>(new Map());
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportAbortRef = useRef<AbortController | null>(null);

  /** Compute minimum trail length (miles) based on zoom level */
  const minLengthForZoom = useCallback((zoom: number): number => {
    if (zoom >= 10) return 0.1;
    if (zoom <= 3) return 100;
    return Math.max(Math.round((50 / Math.pow(3, zoom - 4)) * 10) / 10, 0.1);
  }, []);

  /** Compute max results based on zoom */
  const maxResultsForZoom = useCallback((zoom: number): number => {
    if (zoom <= 3) return 50;
    if (zoom <= 5) return 300;
    if (zoom <= 7) return 1000;
    return 2000;
  }, []);

  /** Fetch sidebar metadata from DB for current viewport (debounced) */
  const loadSidebarMetadata = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < MIN_DATA_ZOOM) return;

    if (viewportAbortRef.current) viewportAbortRef.current.abort();
    const controller = new AbortController();
    viewportAbortRef.current = controller;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    const minLen = minLengthForZoom(zoom);
    const maxRes = maxResultsForZoom(zoom);

    try {
      const res = await fetch(
        `/api/trails/geojson?bbox=${bbox}&min_length=${minLen}&max_results=${maxRes}`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (data._error) { console.error(`[ROAM] API error: ${data._error}`); return; }

      const trails: TrailItem[] = (data.trails || []).map((t: { id: string; name: string; difficulty: string | null; length_miles: number; elevation_gain_ft: number | null; route_type: string | null; region: string | null; bbox: [number, number, number, number] }) => ({
        id: t.id, name: t.name, difficulty: t.difficulty,
        length_miles: t.length_miles, elevation_gain_ft: t.elevation_gain_ft,
        route_type: t.route_type, region: t.region, bbox: t.bbox,
        center: t.bbox ? [(t.bbox[0] + t.bbox[2]) / 2, (t.bbox[1] + t.bbox[3]) / 2] as [number, number] : null,
      }));

      for (const trail of trails) trailMetaCacheRef.current.set(trail.id, trail);
      console.log(`[ROAM] Sidebar: ${trails.length} trails at z${zoom.toFixed(1)}`);
      setTrailGroups(extractTrailGroups(trails));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Failed to load sidebar:', err);
    }
  }, [minLengthForZoom, maxResultsForZoom]);

  /** Debounced wrapper for sidebar metadata loading */
  const loadTrailsForViewport = useCallback((map: maplibregl.Map, immediate?: boolean) => {
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = null;
    }
    if (immediate) { loadSidebarMetadata(map); return; }
    viewportTimerRef.current = setTimeout(() => {
      viewportTimerRef.current = null;
      loadSidebarMetadata(map);
    }, 300);
  }, [loadSidebarMetadata]);

  // ── Recreation data loading ──

  const recreationAbortRef = useRef<AbortController | null>(null);

  const loadRecreationSites = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < 6) return; // Too zoomed out for recreation POIs

    // Only fetch if at least one activity filter is on
    const activeTypes = Object.entries(filtersRef.current)
      .filter(([key, val]) => val && key in ACTIVITY_TYPES)
      .map(([key]) => key);
    // Map filter keys to activity type keys
    const typeMap: Record<string, string> = {
      climbing: 'climbing', caves: 'cave', camping: 'camping',
      viaFerrata: 'via_ferrata', offroad: 'offroad', kayaking: 'kayak', fishing: 'fishing',
    };
    const apiTypes = Object.entries(filtersRef.current)
      .filter(([key, val]) => val && typeMap[key])
      .map(([key]) => typeMap[key]);
    if (apiTypes.length === 0) return;

    if (recreationAbortRef.current) recreationAbortRef.current.abort();
    const controller = new AbortController();
    recreationAbortRef.current = controller;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
      const res = await fetch(
        `/api/recreation?bbox=${bbox}&types=${apiTypes.join(',')}&limit=1000`,
        { signal: controller.signal },
      );
      const data = await res.json();
      const source = map.getSource('recreation-sites');
      if (source && 'setData' in source) {
        (source as maplibregl.GeoJSONSource).setData(data);
      }
      recreationLoadedRef.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Failed to load recreation sites:', err);
    }
  }, []);

  // ── User marker ──

  const createUserMarker = useCallback((map: maplibregl.Map, lng: number, lat: number) => {
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;top:-6px;left:-6px;width:36px;height:36px;
          background:rgba(37,99,235,0.2);border-radius:50%;
          animation:pulse 2s ease-out infinite;"></div>
        <div style="width:24px;height:24px;background:#2563eb;border:3px solid #fff;
          border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      </div>
    `;
    const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    userMarkerRef.current = marker;
  }, []);

  // ── Init map ──

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.outdoor.url,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
    });

    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      addSourcesAndLayers(map);

      // ── Hover highlight: update filter on mousemove to match OSM_ID ──
      const interactiveLayers = ['trail-lines-solid', 'trail-lines', 'trail-lines-casing'];

      const setHoveredOsmId = (osmId: number | null) => {
        if (osmId === hoveredOsmIdRef.current) return; // no change
        hoveredOsmIdRef.current = osmId;
        const filter: maplibregl.FilterSpecification = osmId !== null
          ? ['==', ['get', 'OSM_ID'], osmId]
          : ['==', ['get', 'OSM_ID'], -1]; // impossible match = hidden
        if (map.getLayer('trail-hover-casing')) map.setFilter('trail-hover-casing', filter);
        if (map.getLayer('trail-hover-line')) map.setFilter('trail-hover-line', filter);
      };

      map.on('mousemove', (e) => {
        const layers = interactiveLayers.filter(id => map.getLayer(id));
        const feats = layers.length > 0 ? map.queryRenderedFeatures(e.point, { layers }) : [];

        if (feats.length > 0) {
          const osmId = feats[0].properties?.OSM_ID;
          if (typeof osmId === 'number') {
            setHoveredOsmId(osmId);
            map.getCanvas().style.cursor = 'pointer';
          }
        } else {
          setHoveredOsmId(null);
          map.getCanvas().style.cursor = '';
        }
      });

      map.on('mouseleave', () => {
        setHoveredOsmId(null);
        map.getCanvas().style.cursor = '';
      });

      // Click on trail → show popup with trail info from vector tile properties
      map.on('click', (e) => {
        // Check recreation layers first
        const recLayers = Object.keys(ACTIVITY_TYPES).map(t => `recreation-${t}`).filter(id => map.getLayer(id));
        const recFeats = recLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: recLayers }) : [];
        if (recFeats.length > 0) {
          const props = recFeats[0].properties || {};
          const name = props.name || 'Unnamed Location';
          const actType = props.activity_type || '';
          const config = ACTIVITY_TYPES[actType as keyof typeof ACTIVITY_TYPES];
          const label = config?.label || actType;
          new maplibregl.Popup({ offset: 10, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family:system-ui;">
                <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;">${name}</h3>
                <div style="font-size:12px;color:${config?.color || '#666'};font-weight:600;margin-bottom:4px;">${label}</div>
              </div>
            `)
            .addTo(map);
          return;
        }

        // Check dark sky layer
        const darkFeats = map.getLayer('dark-sky-markers') ? map.queryRenderedFeatures(e.point, { layers: ['dark-sky-markers'] }) : [];
        if (darkFeats.length > 0) {
          const props = darkFeats[0].properties || {};
          new maplibregl.Popup({ offset: 10, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family:system-ui;">
                <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;">${props.name || 'Dark Sky Place'}</h3>
                <div style="font-size:12px;color:#4338ca;font-weight:600;margin-bottom:4px;">Dark Sky ${props.type || 'Place'}</div>
                ${props.state ? `<div style="font-size:12px;color:#666;">${props.state}</div>` : ''}
              </div>
            `)
            .addTo(map);
          return;
        }

        const layers = interactiveLayers.filter(id => map.getLayer(id));
        const trailFeats = layers.length > 0 ? map.queryRenderedFeatures(e.point, { layers }) : [];

        // Also check basemap path layers
        const pathLayers = basemapPathLayersRef.current.filter(id => map.getLayer(id));
        const pathFeats = pathLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: pathLayers }) : [];

        if (trailFeats.length > 0 || pathFeats.length > 0) {
          const feat = trailFeats[0] || pathFeats[0];
          const props = feat?.properties || {};
          const name = props.name || 'Unnamed Trail';
          const highway = props.highway || '';
          const surface = props.surface || '';
          const sacScale = props.sac_scale || '';

          new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family:system-ui;">
                <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;">${name}</h3>
                <div style="display:flex;gap:8px;font-size:12px;color:#666;flex-wrap:wrap;">
                  ${highway ? `<span style="text-transform:capitalize;">${highway}</span>` : ''}
                  ${surface ? `<span>${surface}</span>` : ''}
                  ${sacScale ? `<span>${sacScale}</span>` : ''}
                </div>
              </div>
            `)
            .addTo(map);
        }
      });

      setMapLoaded(true);

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { longitude, latitude } = pos.coords;
            createUserMarker(map, longitude, latitude);
            map.flyTo({ center: [longitude, latitude], zoom: 11, speed: 1.5 });
          },
          () => loadTrailsForViewport(map, true),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        loadTrailsForViewport(map, true);
      }
    });

    map.on('moveend', () => {
      loadTrailsForViewport(map);
      loadRecreationSites(map);
    });
    map.on('zoom', () => {
      setZoomLevel(Math.round(map.getZoom() * 10) / 10);
    });

    mapRef.current = map;
    return () => {
      // Clean up debounce timer and abort in-flight requests
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      if (viewportAbortRef.current) viewportAbortRef.current.abort();
      if (recreationAbortRef.current) recreationAbortRef.current.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [addSourcesAndLayers, loadTrailsForViewport, loadRecreationSites, createUserMarker]);

  // ── Basemap switch ──

  const handleBasemapChange = useCallback((style: BasemapStyle) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(style);
    map.setStyle(BASEMAP_STYLES[style].url);

    map.once('style.load', () => {
      addSourcesAndLayers(map);

      // Restore overlay visibility
      if (showSatelliteRef.current && map.getLayer('satellite-layer')) {
        map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      }
      if (showContoursRef.current) {
        for (const id of CONTOUR_LAYER_IDS) {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
        }
        if (map.getLayer('hillshade-layer')) {
          map.setLayoutProperty('hillshade-layer', 'visibility', 'visible');
        }
      }

      loadTrailsForViewport(map, true);

      if (userMarkerRef.current) {
        const lngLat = userMarkerRef.current.getLngLat();
        createUserMarker(map, lngLat.lng, lngLat.lat);
      }
    });
  }, [addSourcesAndLayers, loadTrailsForViewport, createUserMarker]);

  // ── Toggles ──

  const handleSatelliteToggle = useCallback((visible: boolean) => {
    setShowSatellite(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setLayoutProperty('satellite-layer', 'visibility', visible ? 'visible' : 'none');
  }, [mapLoaded]);

  const handleContourToggle = useCallback((visible: boolean) => {
    setShowContours(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of CONTOUR_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
    // Toggle hillshade together with contours
    if (map.getLayer('hillshade-layer')) {
      map.setLayoutProperty('hillshade-layer', 'visibility', vis);
    }
  }, [mapLoaded]);

  const handleTrailToggle = useCallback((visible: boolean) => {
    setShowTrails(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of [...TRAIL_LAYER_IDS, 'trail-name-labels', ...HOVER_LAYER_IDS]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [mapLoaded]);

  const handleBasemapPathsToggle = useCallback((visible: boolean) => {
    setShowBasemapPaths(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    setBasemapPathsVisibility(map, visible);
  }, [mapLoaded, setBasemapPathsVisibility]);

  // ── Filters ──

  const handleFilterChange = useCallback((key: keyof FilterState, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const layerIds = FILTER_LAYER_MAP[key] || [];
    const vis = value ? 'visible' : 'none';
    for (const id of layerIds) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }

    // If toggling on a recreation activity, trigger data fetch
    const typeMap: Record<string, string> = {
      climbing: 'climbing', caves: 'cave', camping: 'camping',
      viaFerrata: 'via_ferrata', offroad: 'offroad', kayaking: 'kayak', fishing: 'fishing',
    };
    if (value && typeMap[key]) {
      loadRecreationSites(map);
    }
  }, [mapLoaded, loadRecreationSites]);

  // ── Sidebar ──

  const handleTrailSelect = useCallback((trail: TrailItem) => {
    const map = mapRef.current;
    if (!map) return;

    // Zoom to fit using bbox (always available from metadata)
    // The hover highlight will appear when the user mouses over the trail
    if (trail.bbox) {
      const [w, s, e, n] = trail.bbox;
      map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 16, duration: 1200 });
      return;
    }

    // Fallback: fly to center
    if (trail.center) map.flyTo({ center: trail.center, zoom: 15, speed: 1.2 });
  }, []);

  const handleGroupSelect = useCallback((group: TrailGroup) => {
    const map = mapRef.current;
    if (!map || !group.center) return;
    map.flyTo({ center: group.center, zoom: 13, speed: 1.2 });
  }, []);

  // ── Custom zoom & locate ──

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 300 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 300 });
  }, []);

  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        createUserMarker(map, longitude, latitude);
        map.flyTo({ center: [longitude, latitude], zoom: 14, speed: 1.5 });
      },
      (err) => console.warn('Geolocation failed:', err),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [createUserMarker]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      {/* Trail sidebar */}
      <TrailSidebar
        groups={trailGroups}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onTrailSelect={handleTrailSelect}
        onGroupSelect={handleGroupSelect}
        trailColor={TRAIL_LINE_COLOR}
      />

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {mapLoaded && (
          <MapControls
            basemap={basemap}
            showSatellite={showSatellite}
            showTrails={showTrails}
            showContours={showContours}
            showBasemapPaths={showBasemapPaths}
            filters={filters}
            onBasemapChange={handleBasemapChange}
            onSatelliteToggle={handleSatelliteToggle}
            onTrailToggle={handleTrailToggle}
            onContourToggle={handleContourToggle}
            onBasemapPathsToggle={handleBasemapPathsToggle}
            onFilterChange={handleFilterChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocate={handleLocate}
          />
        )}

        {/* Zoom level debug indicator */}
        {mapLoaded && (
          <div style={{
            position: 'absolute',
            bottom: 36,
            right: 12,
            backgroundColor: 'rgba(0,0,0,0.65)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: 600,
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            z{zoomLevel}
          </div>
        )}

        {!mapLoaded && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#f5f5f4',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 32, height: 32, border: '3px solid #16a34a',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 1s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ fontSize: 14, color: '#78716c' }}>Loading map...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
