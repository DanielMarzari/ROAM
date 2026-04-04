'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_TRAIL_COLOR, BASEMAP_PATH_LAYERS } from '@/lib/maps/config';
import { satelliteSource, satelliteLayer } from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import LayerToggle from './LayerToggle';

// Boundary / admin layers to hide
const HIDDEN_LAYERS = ['boundary_3', 'boundary_2', 'boundary_disputed'];

// Our custom trail layer IDs
const TRAIL_LAYER_IDS = ['trail-lines', 'trail-lines-casing'];

// Helper: compute midpoint of a LineString coordinate array
function midpoint(coords: number[][]): [number, number] | null {
  if (!coords || coords.length < 2) return null;

  // Calculate cumulative distances
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

// Build a point FeatureCollection with length labels at trail midpoints
function buildLengthLabels(trailsGeoJSON: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const feature of trailsGeoJSON.features) {
    const props = feature.properties || {};
    const miles = props.length_miles;
    if (!miles || miles < 0.3) continue; // Only label trails >= 0.3mi

    const geom = feature.geometry;
    let coords: number[][] | null = null;

    if (geom.type === 'LineString') {
      coords = geom.coordinates as number[][];
    } else if (geom.type === 'MultiLineString') {
      // Use the longest segment
      const segments = geom.coordinates as number[][][];
      let longest: number[][] = [];
      for (const seg of segments) {
        if (seg.length > longest.length) longest = seg;
      }
      coords = longest;
    }

    const mid = coords ? midpoint(coords) : null;
    if (!mid) continue;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: mid },
      properties: {
        label: `${miles} mi`,
        name: props.name || '',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

export default function MapContainer() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [trailColor, setTrailColor] = useState(DEFAULT_TRAIL_COLOR);

  /** Hide admin boundary layers */
  const hideBoundaryLayers = useCallback((map: maplibregl.Map) => {
    for (const id of HIDDEN_LAYERS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
  }, []);

  /** Toggle basemap path/trail layers visibility */
  const setBasemapPathsVisibility = useCallback((map: maplibregl.Map, visible: boolean) => {
    const vis = visible ? 'visible' : 'none';
    for (const id of BASEMAP_PATH_LAYERS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', vis);
      }
    }
  }, []);

  /** Recolor basemap's built-in path/trail layers to match user's trail color */
  const colorBasemapPaths = useCallback((map: maplibregl.Map, color: string) => {
    for (const id of BASEMAP_PATH_LAYERS) {
      if (map.getLayer(id)) {
        try {
          // Line layers use line-color, symbol layers use text-color
          const layer = map.getLayer(id);
          if (layer && layer.type === 'line') {
            map.setPaintProperty(id, 'line-color', color);
          } else if (layer && layer.type === 'symbol') {
            map.setPaintProperty(id, 'text-color', color);
          }
        } catch {
          // Some layers might not support color changes
        }
      }
    }
  }, []);

  /** Add custom sources + layers */
  const addSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource('trails')) {
      map.addSource('trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getSource('trail-labels')) {
      map.addSource('trail-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getSource('satellite')) {
      map.addSource('satellite', satelliteSource());
    }

    if (!map.getLayer('satellite-layer')) {
      map.addLayer(satelliteLayer);
    }

    // Trail casing (dark outline underneath for contrast)
    if (!map.getLayer('trail-lines-casing')) {
      map.addLayer({
        id: 'trail-lines-casing',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#000000',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 7, 16, 10],
          'line-opacity': 0.3,
        },
      });
    }

    // Trail lines — single user-selected color
    if (!map.getLayer('trail-lines')) {
      map.addLayer({
        id: 'trail-lines',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': trailColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 4.5, 16, 7],
          'line-opacity': 1,
        },
      });
    }

    // Trail length labels at midpoints
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
    colorBasemapPaths(map, trailColor);
  }, [hideBoundaryLayers, trailColor, colorBasemapPaths]);

  /** Fetch trails for current viewport */
  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    if (map.getZoom() < 5) return;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
      const res = await fetch(`/api/trails/geojson?bbox=${bbox}`);
      if (!res.ok) return;
      const geojson = await res.json();

      const source = map.getSource('trails') as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);

      // Build and set length labels
      lastGeoJSONRef.current = geojson;
      const labels = buildLengthLabels(geojson);
      const labelSource = map.getSource('trail-labels') as maplibregl.GeoJSONSource;
      if (labelSource) labelSource.setData(labels);
    } catch (err) {
      console.error('Failed to load trails:', err);
    }
  }, []);

  /** Create the pulsing user location marker */
  const createUserMarker = useCallback((map: maplibregl.Map, lng: number, lat: number) => {
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

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

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);

    userMarkerRef.current = marker;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.outdoor.url,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
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

      // Auto-locate user and fly to their position
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { longitude, latitude } = pos.coords;
            createUserMarker(map, longitude, latitude);
            map.flyTo({ center: [longitude, latitude], zoom: 11, speed: 1.5 });
          },
          () => {
            loadTrailsForViewport(map);
          },
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

  // Update trail color when user changes it (both custom layers AND basemap paths)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer('trail-lines')) {
      map.setPaintProperty('trail-lines', 'line-color', trailColor);
    }
    colorBasemapPaths(map, trailColor);
  }, [trailColor, mapLoaded, colorBasemapPaths]);

  // Basemap switch
  const handleBasemapChange = useCallback((style: BasemapStyle) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(style);
    map.setStyle(BASEMAP_STYLES[style].url);

    map.once('style.load', () => {
      addSourcesAndLayers(map);
      if (showSatellite) map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      if (!showTrails) setBasemapPathsVisibility(map, false);
      loadTrailsForViewport(map);

      // Re-add user marker if it existed
      if (userMarkerRef.current) {
        const lngLat = userMarkerRef.current.getLngLat();
        createUserMarker(map, lngLat.lng, lngLat.lat);
      }
    });
  }, [showSatellite, showTrails, addSourcesAndLayers, loadTrailsForViewport, setBasemapPathsVisibility, createUserMarker]);

  // Satellite toggle
  const handleSatelliteToggle = useCallback((visible: boolean) => {
    setShowSatellite(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setLayoutProperty('satellite-layer', 'visibility', visible ? 'visible' : 'none');
  }, [mapLoaded]);

  // Trail toggle — hides BOTH our custom layers AND basemap path layers
  const handleTrailToggle = useCallback((visible: boolean) => {
    setShowTrails(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';

    // Our custom trail layers + labels
    for (const id of [...TRAIL_LAYER_IDS, 'trail-length-labels']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }

    // Basemap's built-in path/trail layers
    setBasemapPathsVisibility(map, visible);
  }, [mapLoaded, setBasemapPathsVisibility]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Pulse animation for user marker */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {mapLoaded && (
        <LayerToggle
          basemap={basemap}
          showSatellite={showSatellite}
          showTrails={showTrails}
          trailColor={trailColor}
          onBasemapChange={handleBasemapChange}
          onSatelliteToggle={handleSatelliteToggle}
          onTrailToggle={handleTrailToggle}
          onTrailColorChange={setTrailColor}
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
  );
}
