'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mlcontour from 'maplibre-contour';
import {
  BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM,
  TRAIL_LINE_COLOR, TRAIL_DASH_PATTERN,
  PATH_LAYER_KEYWORDS, PATH_LAYER_EXCLUDE,
  HIGHWAY_LAYERS, HIGHWAY_COLOR, HIGHWAY_CASING_COLOR,
  MINOR_ROAD_LAYERS, MINOR_ROAD_COLOR, MINOR_ROAD_CASING_COLOR,
  CONTOUR_CONFIG,
} from '@/lib/maps/config';
import { satelliteSource, satelliteLayer, contourLineLayer, contourLabelLayer } from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import MapControls from './MapControls';
import TrailSidebar from './TrailSidebar';

// Boundary / admin layers to hide
const HIDDEN_LAYERS = ['boundary_3', 'boundary_2', 'boundary_disputed'];

// Our custom trail layer IDs (hidden by default — only selected trail highlights)
const TRAIL_LAYER_IDS = ['trail-lines', 'trail-lines-casing'];
const SELECTED_TRAIL_LAYER_IDS = ['selected-trail-casing', 'selected-trail'];

// Contour layer IDs
const CONTOUR_LAYER_IDS = ['contour-lines', 'contour-labels'];

// Min zoom to start loading trail data
const MIN_DATA_ZOOM = 3;

// ── DEM source for contour lines (singleton, shared across style changes) ──
let demSourceInstance: ReturnType<typeof mlcontour.DemSource.prototype.contourProtocolUrl> | null = null;
let demSource: InstanceType<typeof mlcontour.DemSource> | null = null;

function getDemSource() {
  if (!demSource) {
    demSource = new mlcontour.DemSource({
      url: CONTOUR_CONFIG.demUrl,
      encoding: CONTOUR_CONFIG.encoding,
      maxzoom: CONTOUR_CONFIG.maxzoom,
      worker: true,
      cacheSize: 100,
      timeoutMs: 10000,
    });
    demSource.setupMaplibre(maplibregl);
  }
  if (!demSourceInstance) {
    demSourceInstance = demSource.contourProtocolUrl({
      multiplier: CONTOUR_CONFIG.multiplier,
      thresholds: CONTOUR_CONFIG.thresholds,
    });
  }
  return demSourceInstance;
}

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

/** Compute midpoint of a LineString coordinate array */
function midpoint(coords: number[][]): [number, number] | null {
  if (!coords || coords.length < 2) return null;
  let totalDist = 0;
  const dists = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    totalDist += Math.sqrt(dx * dx + dy * dy);
    dists.push(totalDist);
  }
  const half = totalDist / 2;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= half) {
      const segLen = dists[i] - dists[i - 1];
      const t = segLen > 0 ? (half - dists[i - 1]) / segLen : 0;
      return [
        coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
        coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
      ];
    }
  }
  return [coords[0][0], coords[0][1]];
}

/** Build point FeatureCollection with length labels at trail midpoints */
function buildLengthLabels(geojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const feature of geojson.features) {
    const props = feature.properties || {};
    const miles = props.length_miles;
    if (!miles || miles < 0.3) continue;
    const geom = feature.geometry;
    let coords: number[][] | null = null;
    if (geom.type === 'LineString') {
      coords = geom.coordinates as number[][];
    } else if (geom.type === 'MultiLineString') {
      const segments = geom.coordinates as number[][][];
      let longest: number[][] = [];
      for (const seg of segments) if (seg.length > longest.length) longest = seg;
      coords = longest;
    }
    const mid = coords ? midpoint(coords) : null;
    if (!mid) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: mid },
      properties: { label: `${miles} mi`, name: props.name || '' },
    });
  }
  return { type: 'FeatureCollection', features };
}

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
}

export interface TrailGroup {
  name: string;
  trailCount: number;
  totalMiles: number;
  trails: TrailItem[];
  center: [number, number] | null;
}

/** Extract trail list from GeoJSON, grouped by region */
function extractTrailGroups(geojson: GeoJSON.FeatureCollection): TrailGroup[] {
  const regionMap = new Map<string, TrailItem[]>();

  for (const f of geojson.features) {
    const p = f.properties || {};
    let center: [number, number] | null = null;
    const geom = f.geometry;
    if (geom.type === 'LineString') {
      center = midpoint(geom.coordinates as number[][]);
    } else if (geom.type === 'MultiLineString') {
      const segs = geom.coordinates as number[][][];
      let longest: number[][] = [];
      for (const seg of segs) if (seg.length > longest.length) longest = seg;
      center = midpoint(longest);
    }

    const trail: TrailItem = {
      id: p.id || f.id?.toString() || '',
      name: p.name || 'Unnamed Trail',
      difficulty: p.difficulty || null,
      length_miles: p.length_miles || null,
      elevation_gain_ft: p.elevation_gain_ft || null,
      route_type: p.route_type || null,
      region: p.region || null,
      center,
    };

    const key = trail.region || 'Other Trails';
    if (!regionMap.has(key)) regionMap.set(key, []);
    regionMap.get(key)!.push(trail);
  }

  const groups: TrailGroup[] = [];
  for (const [name, trails] of regionMap) {
    trails.sort((a, b) => (b.length_miles || 0) - (a.length_miles || 0));
    const totalMiles = trails.reduce((sum, t) => sum + (t.length_miles || 0), 0);
    const center = trails[0]?.center || null;
    groups.push({ name, trailCount: trails.length, totalMiles: Math.round(totalMiles * 10) / 10, trails, center });
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
  const trailGeoJsonRef = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const selectedTrailIdRef = useRef<string | null>(null);

  // Refs for stable callbacks
  const showTrailsRef = useRef(true);
  const showSatelliteRef = useRef(false);
  const showContoursRef = useRef(false);
  const basemapRef = useRef<BasemapStyle>('outdoor');

  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showContours, setShowContours] = useState(false);
  const [trailGroups, setTrailGroups] = useState<TrailGroup[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  // Keep refs in sync
  useEffect(() => { showTrailsRef.current = showTrails; }, [showTrails]);
  useEffect(() => { showSatelliteRef.current = showSatellite; }, [showSatellite]);
  useEffect(() => { showContoursRef.current = showContours; }, [showContours]);
  useEffect(() => { basemapRef.current = basemap; }, [basemap]);

  // ── Basemap helpers ──

  const hideBoundaryLayers = useCallback((map: maplibregl.Map) => {
    for (const id of HIDDEN_LAYERS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    }
  }, []);

  /** Style basemap path layers — DEBUG: bright RED so we can identify them */
  const setupBasemapPaths = useCallback((map: maplibregl.Map, visible: boolean) => {
    const pathLayers = findBasemapPathLayers(map);
    basemapPathLayersRef.current = pathLayers;
    const vis = visible ? 'visible' : 'none';

    console.log('[ROAM DEBUG] Basemap path layers (RED):', pathLayers);

    for (const id of pathLayers) {
      if (!map.getLayer(id)) continue;
      const layer = map.getLayer(id);
      map.setLayoutProperty(id, 'visibility', vis);
      try {
        if (layer?.type === 'line') {
          map.setPaintProperty(id, 'line-color', '#ff0000');  // DEBUG: RED
          map.setPaintProperty(id, 'line-opacity', 0.9);
          map.setPaintProperty(id, 'line-width', 3);
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
    // Data sources
    if (!map.getSource('trails')) {
      map.addSource('trails', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getSource('trail-labels')) {
      map.addSource('trail-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    // Overlay sources
    if (!map.getSource('satellite')) {
      map.addSource('satellite', satelliteSource());
    }

    // Contour DEM vector source
    if (!map.getSource('contour-source')) {
      const contourUrl = getDemSource();
      map.addSource('contour-source', {
        type: 'vector',
        tiles: [contourUrl],
      });
    }

    // Overlay layers (added early so trails render on top)
    if (!map.getLayer('satellite-layer')) {
      map.addLayer(satelliteLayer);
    }
    if (!map.getLayer('contour-lines')) {
      map.addLayer(contourLineLayer);
    }
    if (!map.getLayer('contour-labels')) {
      map.addLayer(contourLabelLayer);
    }

    // Trail casing — DEBUG: BLUE, forced VISIBLE
    if (!map.getLayer('trail-lines-casing')) {
      map.addLayer({
        id: 'trail-lines-casing',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'butt', visibility: 'visible' },
        paint: {
          'line-color': '#0000ff',  // DEBUG: BLUE
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 6, 3, 10, 5, 14, 7, 18, 10],
          'line-opacity': 0.5,
        },
      });
    }

    // Trail lines — DEBUG: ORANGE, forced VISIBLE
    if (!map.getLayer('trail-lines')) {
      map.addLayer({
        id: 'trail-lines',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'butt', visibility: 'visible' },
        paint: {
          'line-color': '#ff8800',  // DEBUG: ORANGE
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 3.5, 14, 5, 18, 7],
          'line-opacity': 1,
        },
      });
    }

    // Length labels — HIDDEN by default
    if (!map.getLayer('trail-length-labels')) {
      map.addLayer({
        id: 'trail-length-labels',
        type: 'symbol',
        source: 'trail-labels',
        minzoom: 11,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'label'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 13, 16, 15],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
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

    // ── Selected trail highlight layers ──
    if (!map.getSource('selected-trail')) {
      map.addSource('selected-trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    // Selected trail outer glow/casing — DEBUG: GREEN (only shows when trail selected)
    if (!map.getLayer('selected-trail-casing')) {
      map.addLayer({
        id: 'selected-trail-casing',
        type: 'line',
        source: 'selected-trail',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#00ff00',  // DEBUG: BRIGHT GREEN
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 10, 18, 14],
          'line-opacity': 0.5,
        },
      });
    }

    // Selected trail solid line
    if (!map.getLayer('selected-trail')) {
      map.addLayer({
        id: 'selected-trail',
        type: 'line',
        source: 'selected-trail',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#22c55e',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 18, 7],
          'line-opacity': 1,
        },
      });
    }

    hideBoundaryLayers(map);
    setupBasemapPaths(map, showTrailsRef.current);
    desaturateRoads(map);

    // Style adjustments per basemap
    if (basemapRef.current === 'dark') {
      adjustDarkMode(map);
    } else if (basemapRef.current === 'topo') {
      adjustTopoStyle(map);
    }
  }, [hideBoundaryLayers, setupBasemapPaths, desaturateRoads, adjustDarkMode, adjustTopoStyle]);

  // ── Data loading ──

  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < MIN_DATA_ZOOM) return;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
      const res = await fetch(`/api/trails/geojson?bbox=${bbox}`);
      const geojson = await res.json();

      // Surface API-level errors
      if (geojson._error) {
        console.error(`[ROAM] API error: ${geojson._error}`);
      }

      // Debug: log trail count at each load
      const count = geojson.features?.length ?? 0;
      console.log(`[ROAM] Loaded ${count} trails at z${zoom.toFixed(1)} | bbox: ${bbox} | status: ${res.status}`);
      if (count === 0 && !geojson._error) {
        console.warn('[ROAM] No trails returned — check if Supabase is reachable and has data for this bbox');
      }

      // Store full GeoJSON for selection filtering
      trailGeoJsonRef.current = geojson;

      const source = map.getSource('trails') as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);

      const labels = buildLengthLabels(geojson);
      const labelSource = map.getSource('trail-labels') as maplibregl.GeoJSONSource;
      if (labelSource) labelSource.setData(labels);

      // If a trail is currently selected, keep it highlighted with the new data
      if (selectedTrailIdRef.current) {
        const selectedFeature = geojson.features?.find(
          (f: GeoJSON.Feature) => f.properties?.id === selectedTrailIdRef.current
        );
        const selectedSource = map.getSource('selected-trail') as maplibregl.GeoJSONSource;
        if (selectedSource) {
          selectedSource.setData(selectedFeature
            ? { type: 'FeatureCollection', features: [selectedFeature] }
            : { type: 'FeatureCollection', features: [] }
          );
        }
      }

      setTrailGroups(extractTrailGroups(geojson));
    } catch (err) {
      console.error('Failed to load trails:', err);
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
    });

    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      addSourcesAndLayers(map);

      // Click on basemap path layers → find nearest trail from data and highlight it
      map.on('click', (e) => {
        // Check if we clicked on the selected-trail highlight layer
        const selectedFeats = map.queryRenderedFeatures(e.point, { layers: ['selected-trail'] });
        // Check if we clicked on a basemap path
        const pathLayers = basemapPathLayersRef.current.filter(id => map.getLayer(id));
        const pathFeats = pathLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: pathLayers }) : [];

        if (selectedFeats.length > 0 || pathFeats.length > 0) {
          // Find nearest trail from our data
          const features = trailGeoJsonRef.current.features || [];
          if (features.length === 0) return;

          let nearest: GeoJSON.Feature | null = null;
          let nearestDist = Infinity;
          const clickPt = e.lngLat;

          for (const f of features) {
            const geom = f.geometry;
            let coords: number[][] = [];
            if (geom.type === 'LineString') coords = geom.coordinates as number[][];
            else if (geom.type === 'MultiLineString') {
              for (const seg of geom.coordinates as number[][][]) coords.push(...seg);
            }
            for (const c of coords) {
              const d = Math.sqrt((c[0] - clickPt.lng) ** 2 + (c[1] - clickPt.lat) ** 2);
              if (d < nearestDist) { nearestDist = d; nearest = f; }
            }
          }

          if (nearest && nearest.properties) {
            selectedTrailIdRef.current = nearest.properties.id || null;
            const src = map.getSource('selected-trail') as maplibregl.GeoJSONSource;
            if (src) src.setData({ type: 'FeatureCollection', features: [nearest] });

            new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="font-family:system-ui;">
                  <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;">${nearest.properties.name || 'Unnamed Trail'}</h3>
                  <div style="display:flex;gap:8px;font-size:12px;color:#666;flex-wrap:wrap;">
                    ${nearest.properties.difficulty ? `<span style="font-weight:600;text-transform:capitalize;">${nearest.properties.difficulty}</span>` : ''}
                    ${nearest.properties.length_miles ? `<span>${nearest.properties.length_miles} mi</span>` : ''}
                    ${nearest.properties.elevation_gain_ft ? `<span>${nearest.properties.elevation_gain_ft} ft gain</span>` : ''}
                  </div>
                </div>
              `)
              .addTo(map);
          }
        } else {
          // Clicked elsewhere — deselect
          selectedTrailIdRef.current = null;
          const src = map.getSource('selected-trail') as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: 'FeatureCollection', features: [] });
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
          () => loadTrailsForViewport(map),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        loadTrailsForViewport(map);
      }
    });

    map.on('moveend', () => loadTrailsForViewport(map));
    map.on('zoom', () => setZoomLevel(Math.round(map.getZoom() * 10) / 10));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [addSourcesAndLayers, loadTrailsForViewport, createUserMarker]);

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
      }

      loadTrailsForViewport(map);

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
  }, [mapLoaded]);

  const handleTrailToggle = useCallback((visible: boolean) => {
    setShowTrails(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';
    // Basemap paths toggle
    setBasemapPathsVisibility(map, visible);
    // Selected trail highlight toggle
    for (const id of SELECTED_TRAIL_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [mapLoaded, setBasemapPathsVisibility]);

  // ── Sidebar ──

  const handleTrailSelect = useCallback((trail: TrailItem) => {
    const map = mapRef.current;
    if (!map || !trail.center) return;

    // Highlight this trail on the map
    selectedTrailIdRef.current = trail.id;
    const feature = trailGeoJsonRef.current.features?.find(
      (f: GeoJSON.Feature) => f.properties?.id === trail.id
    );
    const src = map.getSource('selected-trail') as maplibregl.GeoJSONSource;
    if (src) {
      src.setData(feature
        ? { type: 'FeatureCollection', features: [feature] }
        : { type: 'FeatureCollection', features: [] }
      );
    }

    map.flyTo({ center: trail.center, zoom: 15, speed: 1.2 });
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
            onBasemapChange={handleBasemapChange}
            onSatelliteToggle={handleSatelliteToggle}
            onTrailToggle={handleTrailToggle}
            onContourToggle={handleContourToggle}
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
