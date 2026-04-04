'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM, TRAIL_COLORS } from '@/lib/maps/config';
import { satelliteSource, satelliteLayer } from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import LayerToggle from './LayerToggle';

// Boundary / admin layers in OpenFreeMap styles that we want to hide
const HIDDEN_LAYERS = ['boundary_3', 'boundary_2', 'boundary_disputed'];

export default function MapContainer() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);

  /** Hide admin boundary layers from the basemap */
  const hideBoundaryLayers = useCallback((map: maplibregl.Map) => {
    for (const id of HIDDEN_LAYERS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
  }, []);

  /** Add our custom sources + layers on top of the basemap */
  const addSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    // Trail source — NO clustering (trails are LineStrings, not Points)
    if (!map.getSource('trails')) {
      map.addSource('trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Satellite raster source
    if (!map.getSource('satellite')) {
      map.addSource('satellite', satelliteSource());
    }

    // Satellite layer (hidden by default)
    if (!map.getLayer('satellite-layer')) {
      map.addLayer(satelliteLayer);
    }

    // Trail line layer — colored by difficulty
    if (!map.getLayer('trail-lines')) {
      map.addLayer({
        id: 'trail-lines',
        type: 'line',
        source: 'trails',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'easy', TRAIL_COLORS.easy,
            'moderate', TRAIL_COLORS.moderate,
            'hard', TRAIL_COLORS.hard,
            'expert', TRAIL_COLORS.expert,
            TRAIL_COLORS.unknown,
          ],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 2,
            12, 3,
            16, 5,
          ],
          'line-opacity': 0.85,
        },
      });
    }

    // Trail line casing (outline for visibility)
    if (!map.getLayer('trail-lines-casing')) {
      map.addLayer({
        id: 'trail-lines-casing',
        type: 'line',
        source: 'trails',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 4,
            12, 5,
            16, 8,
          ],
          'line-opacity': 0.4,
        },
      }, 'trail-lines'); // Insert BEFORE trail-lines so casing is underneath
    }

    hideBoundaryLayers(map);
  }, [hideBoundaryLayers]);

  /** Fetch trails for the current map viewport */
  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // At very low zoom, don't load (too many trails)
    if (zoom < 5) return;

    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    try {
      const res = await fetch(`/api/trails/geojson?bbox=${bbox}`);
      if (!res.ok) return;
      const geojson = await res.json();

      const source = map.getSource('trails') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(geojson);
      }
    } catch (err) {
      console.error('Failed to load trails:', err);
    }
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
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      addSourcesAndLayers(map);

      // Trail click → popup with info
      map.on('click', 'trail-lines', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;

        new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: system-ui;">
              <h3 style="margin: 0 0 6px; font-size: 15px; font-weight: 600;">${props.name || 'Unnamed Trail'}</h3>
              <div style="display: flex; gap: 8px; font-size: 12px; color: #666; flex-wrap: wrap;">
                ${props.difficulty ? `<span style="color: ${TRAIL_COLORS[props.difficulty] || TRAIL_COLORS.unknown}; font-weight: 600; text-transform: capitalize;">${props.difficulty}</span>` : ''}
                ${props.length_miles ? `<span>${props.length_miles} mi</span>` : ''}
                ${props.elevation_gain_ft ? `<span>${props.elevation_gain_ft} ft gain</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map);
      });

      // Cursor pointer on trails
      map.on('mouseenter', 'trail-lines', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'trail-lines', () => { map.getCanvas().style.cursor = ''; });

      setMapLoaded(true);
      loadTrailsForViewport(map);
    });

    map.on('moveend', () => loadTrailsForViewport(map));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [addSourcesAndLayers, loadTrailsForViewport]);

  // Switch basemap
  const handleBasemapChange = useCallback((style: BasemapStyle) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(style);
    map.setStyle(BASEMAP_STYLES[style].url);

    map.once('style.load', () => {
      addSourcesAndLayers(map);
      if (showSatellite) {
        map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      }
      loadTrailsForViewport(map);
    });
  }, [showSatellite, addSourcesAndLayers, loadTrailsForViewport]);

  const handleSatelliteToggle = useCallback((visible: boolean) => {
    setShowSatellite(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setLayoutProperty('satellite-layer', 'visibility', visible ? 'visible' : 'none');
  }, [mapLoaded]);

  const handleTrailToggle = useCallback((visible: boolean) => {
    setShowTrails(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = visible ? 'visible' : 'none';
    map.setLayoutProperty('trail-lines', 'visibility', vis);
    map.setLayoutProperty('trail-lines-casing', 'visibility', vis);
  }, [mapLoaded]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
