import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { TRAIL_COLORS, OVERLAY_TILES } from './config';

/**
 * Trail GeoJSON source definition.
 */
export function trailSource(geojsonUrl: string): SourceSpecification {
  return {
    type: 'geojson',
    data: geojsonUrl,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 50,
  };
}

/**
 * Trail line layer — colored by difficulty.
 */
export const trailLineLayer: LayerSpecification = {
  id: 'trail-lines',
  type: 'line',
  source: 'trails',
  filter: ['!', ['has', 'point_count']],
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
      14, 4,
      18, 6,
    ],
    'line-opacity': 0.85,
  },
};

/**
 * Cluster circle layer for zoomed-out view.
 */
export const trailClusterLayer: LayerSpecification = {
  id: 'trail-clusters',
  type: 'circle',
  source: 'trails',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step', ['get', 'point_count'],
      '#22c55e',   // green < 10
      10, '#3b82f6', // blue 10-50
      50, '#f59e0b', // amber 50-100
      100, '#ef4444', // red 100+
    ],
    'circle-radius': [
      'step', ['get', 'point_count'],
      18,    // < 10
      10, 24, // 10-50
      50, 30, // 50-100
      100, 36, // 100+
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
};

/**
 * Cluster count label.
 */
export const trailClusterCountLayer: LayerSpecification = {
  id: 'trail-cluster-count',
  type: 'symbol',
  source: 'trails',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-size': 13,
    'text-font': ['Open Sans Bold'],
  },
  paint: {
    'text-color': '#ffffff',
  },
};

/**
 * Satellite raster source.
 */
export function satelliteSource(): SourceSpecification {
  return {
    type: 'raster',
    tiles: [OVERLAY_TILES.satellite.url],
    tileSize: 256,
    maxzoom: OVERLAY_TILES.satellite.maxZoom,
    attribution: OVERLAY_TILES.satellite.attribution,
  };
}

/**
 * Satellite raster layer.
 */
export const satelliteLayer: LayerSpecification = {
  id: 'satellite-layer',
  type: 'raster',
  source: 'satellite',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.8 },
};
