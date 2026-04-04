import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { OVERLAY_TILES } from './config';

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
 * Satellite raster layer (hidden by default).
 */
export const satelliteLayer: LayerSpecification = {
  id: 'satellite-layer',
  type: 'raster',
  source: 'satellite',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.8 },
};

/**
 * Contour line layer (vector, from maplibre-contour DEM source).
 * Hidden by default. Minor contours are thin, major contours are thicker.
 */
export const contourLineLayer: LayerSpecification = {
  id: 'contour-lines',
  type: 'line',
  source: 'contour-source',
  'source-layer': 'contours',
  layout: {
    visibility: 'none',
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': [
      'case',
      ['==', ['coalesce', ['get', 'level'], 0], 1],
      'rgba(120, 90, 50, 0.45)',   // major contours — darker brown
      'rgba(140, 110, 70, 0.25)',  // minor contours — lighter
    ],
    'line-width': [
      'case',
      ['==', ['coalesce', ['get', 'level'], 0], 1],
      1.2,   // major
      0.5,   // minor
    ],
  },
};

/**
 * Contour elevation labels (only on major contours).
 */
export const contourLabelLayer: LayerSpecification = {
  id: 'contour-labels',
  type: 'symbol',
  source: 'contour-source',
  'source-layer': 'contours',
  filter: ['all',
    ['==', ['get', 'level'], 1],
    ['has', 'ele'],
    ['!=', ['get', 'ele'], null],
  ],
  layout: {
    visibility: 'none',
    'text-field': [
      'concat',
      ['to-string', ['round', ['get', 'ele']]],
      ' ft',
    ],
    'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 15, 11],
    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
    'symbol-placement': 'line',
    'text-rotation-alignment': 'map',
    'text-max-angle': 25,
    'text-padding': 5,
  },
  paint: {
    'text-color': 'rgba(100, 70, 40, 0.7)',
    'text-halo-color': 'rgba(255, 255, 255, 0.8)',
    'text-halo-width': 1.5,
  },
};
