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

interface MapContainerProps {
  className?: string;
}

export default function MapContainer({ className = '' }: MapContainerProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [basemap, setBasemap] = useState<BasemapStyle>('outdoor');
  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrails, setShowTrails] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES[basemap].url,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: {},
    });

    // Add navigation controls
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
      // Add trail GeoJSON source
      map.addSource('trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      // Add satellite source
      map.addSource('satellite', satelliteSource());

      // Add layers
      map.addLayer(satelliteLayer);
      map.addLayer(trailLineLayer);
      map.addLayer(trailClusterLayer);
      map.addLayer(trailClusterCountLayer);

      // Click handler for trail lines
      map.on('click', 'trail-lines', (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const props = feature.properties;

        new maplibregl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: system-ui; max-width: 240px;">
              <h3 style="margin: 0 0 6px; font-size: 15px; font-weight: 600;">${props.name || 'Unnamed Trail'}</h3>
              <div style="display: flex; gap: 8px; font-size: 12px; color: #666;">
                ${props.difficulty ? `<span style="color: ${TRAIL_COLORS[props.difficulty] || TRAIL_COLORS.unknown}; font-weight: 600; text-transform: capitalize;">${props.difficulty}</span>` : ''}
                ${props.length_miles ? `<span>${props.length_miles} mi</span>` : ''}
                ${props.elevation_gain_ft ? `<span>↑${props.elevation_gain_ft} ft</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map);
      });

      // Click handler for clusters — zoom in
      map.on('click', 'trail-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['trail-clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource('trails') as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom,
          });
        });
      });

      // Cursor changes
      map.on('mouseenter', 'trail-lines', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'trail-lines', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'trail-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'trail-clusters', () => { map.getCanvas().style.cursor = ''; });

      setMapLoaded(true);
    });

    // Load trails when the map viewport changes
    map.on('moveend', () => {
      loadTrailsForViewport(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch trails for current map viewport
  const loadTrailsForViewport = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (zoom < 7) return; // Don't load trails when zoomed out too far

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

  // Switch basemap style
  const handleBasemapChange = useCallback((style: BasemapStyle) => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(style);
    map.setStyle(BASEMAP_STYLES[style].url);

    // Re-add sources and layers after style change
    map.once('style.load', () => {
      map.addSource('trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });
      map.addSource('satellite', satelliteSource());
      map.addLayer(satelliteLayer);
      map.addLayer(trailLineLayer);
      map.addLayer(trailClusterLayer);
      map.addLayer(trailClusterCountLayer);

      if (showSatellite) {
        map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      }

      loadTrailsForViewport(map);
    });
  }, [showSatellite, loadTrailsForViewport]);

  // Toggle satellite overlay
  const handleSatelliteToggle = useCallback((visible: boolean) => {
    setShowSatellite(visible);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setLayoutProperty('satellite-layer', 'visibility', visible ? 'visible' : 'none');
  }, [mapLoaded]);

  // Toggle trail layer
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
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />

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
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-stone-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
