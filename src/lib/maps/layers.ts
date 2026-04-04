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
 * Contour/topo raster source (OpenTopoMap).
 */
export function contourSource(): SourceSpecification {
  return {
    type: 'raster',
    tiles: [OVERLAY_TILES.contours.url],
    tileSize: 256,
    maxzoom: OVERLAY_TILES.contours.maxZoom,
    attribution: OVERLAY_TILES.contours.attribution,
  };
}

/**
 * Contour/topo raster layer (hidden by default, semi-transparent).
 */
export const contourLayer: LayerSpecification = {
  id: 'contour-layer',
  type: 'raster',
  source: 'contours',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.35 },
};
