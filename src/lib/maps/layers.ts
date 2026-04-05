import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { OVERLAY_TILES } from './config';

// ── OpenTrailMap tile sources (OSMU) ──
// Free, pre-built vector + raster tiles updated every 4 hours from OSM.
// See https://github.com/osmus/OpenTrailMap

/**
 * OpenTrailMap trail vector tile source (z5–z14).
 * Layers: trail, trail_centerpoint, trail_poi, park, barrier_area, barrier_line
 */
export function trailTileSource(): SourceSpecification {
  return {
    type: 'vector',
    url: 'https://tiles.openstreetmap.us/vector/trails.json',
    attribution: '© <a href="https://openstreetmap.us">OpenStreetMap US</a>',
  };
}

/**
 * Hillshade raster tiles from OpenTrailMap (pre-rendered, z1–z12).
 */
export function hillshadeSource(): SourceSpecification {
  return {
    type: 'raster',
    url: 'https://tiles.openstreetmap.us/raster/hillshade.json',
    tileSize: 256,
    attribution: '© <a href="https://openstreetmap.us">OSMU Hillshade</a>',
  };
}

/**
 * Contour vector tiles from OpenTrailMap (feet, pre-computed).
 * source-layer: "contours", fields: ele (Number), idx (Boolean = major contour)
 */
export function contourTileSource(): SourceSpecification {
  return {
    type: 'vector',
    url: 'https://tiles.openstreetmap.us/vector/contours-feet.json',
    attribution: '© <a href="https://openstreetmap.us">OSMU Contours</a>',
  };
}

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
 * Hillshade raster layer — pre-rendered terrain shading.
 * Hidden by default; toggled together with contours.
 * Fades at higher zoom to avoid overwhelming detail.
 */
export const hillshadeLayer: LayerSpecification = {
  id: 'hillshade-layer',
  type: 'raster',
  source: 'hillshade',
  layout: { visibility: 'none' },
  paint: {
    'raster-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 0.1],
  },
};

/**
 * Contour line layer (vector tiles from OSMU).
 * idx=true → major contour (thicker). idx=false → minor (thinner).
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
  filter: ['!=', ['get', 'ele'], 0],
  paint: {
    'line-color': '#000000',
    'line-opacity': ['case', ['get', 'idx'], 0.2, 0.1],
    'line-width': ['case', ['get', 'idx'], 1.0, 0.5],
  },
};

/**
 * Contour elevation labels (major contours only).
 * Uses Noto Sans Bold which OpenFreeMap serves.
 */
export const contourLabelLayer: LayerSpecification = {
  id: 'contour-labels',
  type: 'symbol',
  source: 'contour-source',
  'source-layer': 'contours',
  minzoom: 12,
  filter: ['all',
    ['==', ['get', 'idx'], true],
    ['!=', ['get', 'ele'], 0],
  ],
  layout: {
    visibility: 'none',
    'text-field': '{ele} ft',
    'text-size': 8,
    'text-font': ['Noto Sans Bold'],
    'symbol-placement': 'line',
    'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 150, 16, 600],
  },
  paint: {
    'text-color': '#666',
    'text-halo-color': 'hsla(0, 0%, 100%, 0.5)',
    'text-halo-width': 1.5,
    'text-halo-blur': 1,
  },
};

// ── Trail layers from OpenTrailMap vector tiles ──
// source-layer: "trail", fields include: name, highway, foot, access, sac_scale, surface, etc.

/** Trail lines — visible hiking/foot trails (solid at low zoom, dashed at high zoom) */
export const trailLinesSolid: LayerSpecification = {
  id: 'trail-lines-solid',
  type: 'line',
  source: 'osm-trails',
  'source-layer': 'trail',
  minzoom: 5,
  filter: ['all',
    ['has', 'highway'],
    ['in', ['get', 'highway'], ['literal', ['path', 'footway', 'track', 'cycleway', 'bridleway', 'steps']]],
  ],
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#1a1a1a',
    'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 8, 0.6, 12, 1.5, 15, 2, 18, 3],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 10, 0],
  },
};

export const trailLinesDashed: LayerSpecification = {
  id: 'trail-lines',
  type: 'line',
  source: 'osm-trails',
  'source-layer': 'trail',
  minzoom: 5,
  filter: ['all',
    ['has', 'highway'],
    ['in', ['get', 'highway'], ['literal', ['path', 'footway', 'track', 'cycleway', 'bridleway', 'steps']]],
  ],
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#1a1a1a',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1.5, 15, 2, 18, 3],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 0.7],
    'line-dasharray': [2, 1.5],
  },
};

export const trailLinesCasing: LayerSpecification = {
  id: 'trail-lines-casing',
  type: 'line',
  source: 'osm-trails',
  'source-layer': 'trail',
  minzoom: 5,
  filter: ['all',
    ['has', 'highway'],
    ['in', ['get', 'highway'], ['literal', ['path', 'footway', 'track', 'cycleway', 'bridleway', 'steps']]],
  ],
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#000000',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 3, 15, 4, 18, 5.5],
    'line-opacity': 0.08,
  },
};

/** Park fill from OpenTrailMap trails source */
export const parkFillLayer: LayerSpecification = {
  id: 'osm-park-fill',
  type: 'fill',
  source: 'osm-trails',
  'source-layer': 'park',
  paint: {
    'fill-color': '#c2e2b8',
    'fill-opacity': 0.3,
  },
};
