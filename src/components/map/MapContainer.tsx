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
} from '@/lib/maps/config';
import { satelliteSource, satelliteLayer, contourSource, contourLayer } from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import MapControls from './MapControls';
import TrailSidebar from './TrailSidebar';

// Boundary / admin layers to hide
const HIDDEN_LAYERS = ['boundary_3', 'boundary_2', 'boundary_disputed'];

// Our custom trail layer IDs
const TRAIL_LAYER_IDS = ['trail-lines', 'trail-lines-casing'];

// Min zoom to start loading trail data
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

  // Refs for values needed in stable callbacks
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

  /** Style basemap path layers as dashed black (matching our trail style) */
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
    // Don't desaturate on dark mode — roads are already subdued
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

  /** Lighten dark mode so it's not pitch-black */
  const adjustDarkMode = useCallback((map: maplibregl.Map) => {
    const style = map.getStyle();
    if (!style?.layers) return;
    for (const layer of style.layers) {
      try {
        if (layer.id === 'background') {
          map.setPaintProperty('background', 'background-color', '#1e1e2a');
        }
        // Lighten land / landcover layers
        if (layer.id.includes('landcover') || layer.id.includes('landuse')) {
          if (layer.type === 'fill') {
            map.setPaintProperty(layer.id, 'fill-color', '#262632');
          }
        }
        // Slightly lighten water
        if (layer.id.includes('water') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#1a2535');
        }
        // Make building fills a bit lighter
        if (layer.id.includes('building') && layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#2a2a38');
        }
        // Lighten road lines in dark mode
        if ((layer.id.startsWith('road') || layer.id.startsWith('bridge') || layer.id.startsWith('tunnel')) && layer.type === 'line') {
          const isCasing = layer.id.includes('casing');
          map.setPaintProperty(layer.id, 'line-color', isCasing ? '#3a3a48' : '#454558');
        }
        // Make labels more readable
        if (layer.type === 'symbol') {
          try { map.setPaintProperty(layer.id, 'text-color', '#c8c8d8'); } catch { /* skip */ }
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
    if (!map.getSource('contours')) {
      map.addSource('contours', contourSource());
    }

    // Overlay layers (added early so trails render on top)
    if (!map.getLayer('satellite-layer')) {
      map.addLayer(satelliteLayer);
    }
    if (!map.getLayer('contour-layer')) {
      map.addLayer(contourLayer);
    }

    // Trail casing (subtle shadow) — visible from any zoom
    if (!map.getLayer('trail-lines-casing')) {
      map.addLayer({
        id: 'trail-lines-casing',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': '#000000',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 3, 10, 5, 14, 7, 18, 10],
          'line-opacity': 0.15,
        },
      });
    }

    // Trail lines — dashed black, visible from any zoom
    if (!map.getLayer('trail-lines')) {
      map.addLayer({
        id: 'trail-lines',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: {
          'line-color': TRAIL_LINE_COLOR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.5, 10, 3, 14, 5, 18, 7],
          'line-opacity': 1,
          'line-dasharray': TRAIL_DASH_PATTERN,
        },
      });
    }

    // Length labels
    if (!map.getLayer('trail-length-labels')) {
      map.addLayer({
        id: 'trail-length-labels',
        type: 'symbol',
        source: 'trail-labels',
        minzoom: 11,
        layout: {
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

    hideBoundaryLayers(map);
    setupBasemapPaths(map, showTrailsRef.current);
    desaturateRoads(map);

    // Lighten dark mode
    if (basemapRef.current === 'dark') {
      adjustDarkMode(map);
    }
  }, [hideBoundaryLayers, setupBasemapPaths, desaturateRoads, adjustDarkMode]);

  // ── Data loading ──

  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    if (map.getZoom() < MIN_DATA_ZOOM) return;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
      const res = await fetch(`/api/trails/geojson?bbox=${bbox}`);
      if (!res.ok) return;
      const geojson = await res.json();

      const source = map.getSource('trails') as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);

      const labels = buildLengthLabels(geojson);
      const labelSource = map.getSource('trail-labels') as maplibregl.GeoJSONSource;
      if (labelSource) labelSource.setData(labels);

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

      // Trail click popup
      map.on('click', 'trail-lines', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:system-ui;">
              <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;">${props.name || 'Unnamed Trail'}</h3>
              <div style="display:flex;gap:8px;font-size:12px;color:#666;flex-wrap:wrap;">
                ${props.difficulty ? `<span style="font-weight:600;text-transform:capitalize;">${props.difficulty}</span>` : ''}
                ${props.length_miles ? `<span>${props.length_miles} mi</span>` : ''}
                ${props.elevation_gain_ft ? `<span>${props.elevation_gain_ft} ft gain</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map);
      });
      map.on('mouseenter', 'trail-lines', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'trail-lines', () => { map.getCanvas().style.cursor = ''; });

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
      if (showContoursRef.current && map.getLayer('contour-layer')) {
        map.setLayoutProperty('contour-layer', 'visibility', 'visible');
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
    map.setLayoutProperty('contour-layer', 'visibility', visible ? 'visible' : 'none');
  }, [mapLoaded]);

  const handleTrailToggle = useCallback((visible: boolean) => {
    setShowTrails(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';
    for (const id of [...TRAIL_LAYER_IDS, 'trail-length-labels']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
    setBasemapPathsVisibility(map, visible);
  }, [mapLoaded, setBasemapPathsVisibility]);

  // ── Sidebar ──

  const handleTrailSelect = useCallback((trail: TrailItem) => {
    const map = mapRef.current;
    if (!map || !trail.center) return;
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
