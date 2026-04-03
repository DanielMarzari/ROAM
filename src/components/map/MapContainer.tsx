'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM, TRAIL_COLORS } from '@/lib/maps/config';
import {
  trailLineLayer,
  trailClusterLayer,
  trailClusterCountLayer,
  satelliteSource,
  satelliteLayer,
} from '@/lib/maps/layers';
import type { BasemapStyle } from '@/types/map';
import LayerToggle from './LayerToggle';

export default function MapContainer() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);

  const addSourcesAndLayers = useCallback((map: maplibregl.Map) => {
    // Trail GeoJSON source
    if (!map.getSource('trails')) {
      map.addSource('trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });
    }

    // Satellite source
    if (!map.getSource('satellite')) {
      map.addSource('satellite', satelliteSource());
    }

    // Add layers (order matters: satellite under trails)
    if (!map.getLayer('satellite-layer')) map.addLayer(satelliteLayer);
    if (!map.getLayer('trail-lines')) map.addLayer(trailLineLayer);
    if (!map.getLayer('trail-clusters')) map.addLayer(trailClusterLayer);
    if (!map.getLayer('trail-cluster-count')) map.addLayer(trailClusterCountLayer);
  }, []);

  // Fetch trails for current map viewport
  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < 7) return;

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

    // Controls
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

      // Trail click popup
      map.on('click', 'trail-lines', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;

        new maplibregl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: system-ui; max-width: 240px;">
              <h3 style="margin: 0 0 6px; font-size: 15px; font-weight: 600;">${props.name || 'Unnamed Trail'}</h3>
              <div style="display: flex; gap: 8px; font-size: 12px; color: #666;">
                ${props.difficulty ? `<span style="color: ${TRAIL_COLORS[props.difficulty] || TRAIL_COLORS.unknown}; font-weight: 600; text-transform: capitalize;">${props.difficulty}</span>` : ''}
                ${props.length_miles ? `<span>${props.length_miles} mi</span>` : ''}
                ${props.elevation_gain_ft ? `<span>${props.elevation_gain_ft} ft gain</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map);
      });

      // Cluster click to zoom
      map.on('click', 'trail-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['trail-clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource('trails') as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          });
        });
      });

      // Cursor changes
      for (const layer of ['trail-lines', 'trail-clusters']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }

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

  // Switch basemap style
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
    map.setLayoutProperty('trail-clusters', 'visibility', vis);
    map.setLayoutProperty('trail-cluster-count', 'visibility', vis);
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
