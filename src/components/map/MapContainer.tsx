'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM, TRAIL_COLORS, BASEMAP_PATH_LAYERS } from '@/lib/maps/config';
import { satelliteSource, satelliteLayer } from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import LayerToggle from './LayerToggle';

// Boundary / admin layers to hide
const HIDDEN_LAYERS = ['boundary_3', 'boundary_2', 'boundary_disputed'];

// Our custom trail layer IDs
const TRAIL_LAYER_IDS = ['trail-lines', 'trail-lines-casing'];

export default function MapContainer() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);

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

  /** Add custom sources + layers */
  const addSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource('trails')) {
      map.addSource('trails', {
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

    // Trail casing (white outline underneath for contrast)
    if (!map.getLayer('trail-lines-casing')) {
      map.addLayer({
        id: 'trail-lines-casing',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 7, 16, 10],
          'line-opacity': 0.6,
        },
      });
    }

    // Trail lines — bold colors by difficulty
    if (!map.getLayer('trail-lines')) {
      map.addLayer({
        id: 'trail-lines',
        type: 'line',
        source: 'trails',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match', ['get', 'difficulty'],
            'easy', TRAIL_COLORS.easy,
            'moderate', TRAIL_COLORS.moderate,
            'hard', TRAIL_COLORS.hard,
            'expert', TRAIL_COLORS.expert,
            TRAIL_COLORS.unknown,
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 4.5, 16, 7],
          'line-opacity': 1,
        },
      });
    }

    hideBoundaryLayers(map);
  }, [hideBoundaryLayers]);

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
    } catch (err) {
      console.error('Failed to load trails:', err);
    }
  }, []);

  /** Create the pulsing user location marker */
  const createUserMarker = useCallback((map: maplibregl.Map, lng: number, lat: number) => {
    // Remove existing marker if any
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Outer pulsing ring + inner dot
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
                ${props.difficulty ? `<span style="color:${TRAIL_COLORS[props.difficulty] || TRAIL_COLORS.unknown};font-weight:600;text-transform:capitalize;">${props.difficulty}</span>` : ''}
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
            // Permission denied or error — just load trails at default view
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

    // Our custom trail layers
    for (const id of TRAIL_LAYER_IDS) {
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
          onBasemapChange={handleBasemapChange}
          onSatelliteToggle={handleSatelliteToggle}
          onTrailToggle={handleTrailToggle}
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
