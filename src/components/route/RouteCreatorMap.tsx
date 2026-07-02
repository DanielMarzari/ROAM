'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_STYLES, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/maps/config';
import {
  trailTileSource, trailLinesSolid, trailLinesDashed, trailLinesCasing,
  hillshadeSource, hillshadeLayer,
  customRouteSource, customRouteLayer,
  parkFillLayerFor, parkOutlineLayerFor, parkLabelLayerFor, PARK_CATEGORIES,
} from '@/lib/maps/layers';
import { routeBetween, orientSegment, lineStringLength, haversine } from '@/lib/routing';

export interface RouteSegment {
  id: string;
  kind: 'trail' | 'connector';
  name: string;
  coordinates: [number, number][];
  distanceMeters: number;
  highway?: string;
  osmId?: number;
}

interface Props {
  segments: RouteSegment[];
  onSegmentsChange: (segments: RouteSegment[]) => void;
}

export default function RouteCreatorMap({ segments, onSegmentsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const segmentsRef = useRef<RouteSegment[]>(segments);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  // Push current segments into the map source
  const refreshRouteSource = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('custom-route');
    if (!src || !('setData' in src)) return;
    const features: GeoJSON.Feature[] = segmentsRef.current.map((s, i) => ({
      type: 'Feature',
      properties: { kind: s.kind, name: s.name, index: i },
      geometry: { type: 'LineString', coordinates: s.coordinates },
    }));
    (src as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, []);

  useEffect(() => {
    if (loaded) refreshRouteSource();
  }, [segments, loaded, refreshRouteSource]);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;
    // Strict-mode remount safety: if a prior map is still attached, tear it down first.
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch { /* noop */ }
      mapRef.current = null;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.outdoor.url,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    const onReady = () => {
      // Sources
      if (!map.getSource('osm-trails')) map.addSource('osm-trails', trailTileSource());
      if (!map.getSource('hillshade')) map.addSource('hillshade', hillshadeSource());
      if (!map.getSource('custom-route')) map.addSource('custom-route', customRouteSource());

      // Layers
      if (!map.getLayer('hillshade-layer')) map.addLayer(hillshadeLayer);
      for (const cat of PARK_CATEGORIES) {
        if (!map.getLayer(`park-fill-${cat}`)) map.addLayer(parkFillLayerFor(cat));
        if (!map.getLayer(`park-outline-${cat}`)) map.addLayer(parkOutlineLayerFor(cat));
      }
      if (!map.getLayer('trail-lines-casing')) map.addLayer(trailLinesCasing);
      if (!map.getLayer('trail-lines-solid')) map.addLayer(trailLinesSolid);
      if (!map.getLayer('trail-lines')) map.addLayer(trailLinesDashed);
      for (const cat of PARK_CATEGORIES) {
        if (!map.getLayer(`park-labels-${cat}`)) map.addLayer(parkLabelLayerFor(cat));
      }
      if (!map.getLayer('custom-route-line')) map.addLayer(customRouteLayer);

      // Click handler — add clicked trail as a segment
      const clickableLayers = ['trail-lines-solid', 'trail-lines', 'trail-lines-casing'];
      map.on('click', async (e) => {
        const layers = clickableLayers.filter((id) => map.getLayer(id));
        const feats = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
        if (feats.length === 0) return;

        const feat = feats[0];
        const props = feat.properties || {};
        const name = (props.name as string) || 'Unnamed trail';
        const highway = (props.highway as string) || undefined;
        const osmId = typeof props.OSM_ID === 'number' ? (props.OSM_ID as number) : undefined;

        // Get coordinates from the tile-clipped feature
        const geom = feat.geometry;
        let coords: [number, number][] = [];
        if (geom.type === 'LineString') coords = geom.coordinates as [number, number][];
        else if (geom.type === 'MultiLineString') coords = geom.coordinates[0] as [number, number][];
        else return;

        if (coords.length < 2) return;

        // Orient to nearest end of previous segment
        const current = segmentsRef.current;
        const prev = current[current.length - 1];
        const anchor = prev ? prev.coordinates[prev.coordinates.length - 1] : (e.lngLat.toArray() as [number, number]);
        coords = orientSegment(coords, anchor);

        const trailSeg: RouteSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'trail',
          name,
          coordinates: coords,
          distanceMeters: lineStringLength(coords),
          highway,
          osmId,
        };

        // If there's a gap from previous endpoint, ask OSRM for a connector
        const newSegs: RouteSegment[] = [...current];
        if (prev) {
          const prevEnd = prev.coordinates[prev.coordinates.length - 1];
          const gap = haversine(prevEnd, coords[0]);
          if (gap > 40) {
            // Meaningful gap — request a walking route to connect
            setConnecting(true);
            const rt = await routeBetween(prevEnd, coords[0]);
            setConnecting(false);
            if (rt) {
              newSegs.push({
                id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                kind: 'connector',
                name: 'Connector (walking)',
                coordinates: rt.geometry.coordinates as [number, number][],
                distanceMeters: rt.distanceMeters,
              });
            } else {
              // Fallback: straight-line connector
              newSegs.push({
                id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                kind: 'connector',
                name: 'Straight connector',
                coordinates: [prevEnd, coords[0]],
                distanceMeters: gap,
              });
            }
          }
        }
        newSegs.push(trailSeg);
        onSegmentsChange(newSegs);
        setError(null);
      });

      map.on('mousemove', (e) => {
        const layers = clickableLayers.filter((id) => map.getLayer(id));
        const feats = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
        map.getCanvas().style.cursor = feats.length ? 'pointer' : '';
      });

      setLoaded(true);
      refreshRouteSource();

      map.resize();

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, speed: 1.5 }),
          () => {},
          { enableHighAccuracy: true, timeout: 6000 },
        );
      }
    };

    // Robust ready detection: fire onReady once the style has loaded.
    // Strict-mode dev remounts + Turbopack HMR can cause the map's `load` event
    // to fire before our listener is attached; poll isStyleLoaded() as a backstop.
    let readyFired = false;
    const fireOnce = () => {
      if (readyFired) return;
      readyFired = true;
      onReady();
    };
    map.on('load', fireOnce);
    map.on('style.load', () => { if (map.isStyleLoaded()) fireOnce(); });
    const poll = setInterval(() => {
      if (!mapRef.current) { clearInterval(poll); return; }
      if (map.isStyleLoaded()) { fireOnce(); clearInterval(poll); }
    }, 250);

    mapRef.current = map;
    return () => {
      clearInterval(poll);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {connecting && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff',
          padding: '6px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'system-ui',
          zIndex: 10,
        }}>
          Finding walking connector…
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#fef2f2', color: '#991b1b',
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'system-ui',
        }}>
          {error}
        </div>
      )}
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#f5f5f4',
        }}>
          <p style={{ fontSize: 14, color: '#78716c' }}>Loading map…</p>
        </div>
      )}
    </div>
  );
}
