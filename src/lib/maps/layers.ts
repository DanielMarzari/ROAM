import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';
import { OVERLAY_TILES, ACTIVITY_TYPES } from './config';

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

// ── Park layers (enhanced with type-based styling) ──
// The OpenTrailMap `park` source-layer includes national parks, forests, state parks, etc.
// Fields available: name, boundary, protect_class, protection_title, operator, operator_type

/**
 * Park type classification based on vector tile properties.
 * Uses protection_title, boundary, operator, and name fields.
 */
export type ParkCategory = 'national_park' | 'national_forest' | 'state_park' | 'monument' | 'conservation';

/** Park fill colors by category */
const PARK_COLORS: Record<ParkCategory, string> = {
  national_park: '#a3d4a0',
  national_forest: '#c5dbb8',
  state_park: '#cce5c4',
  monument: '#d4c9a8',
  conservation: '#d0e0c8',
};

/** General park fill from OpenTrailMap trails source — base layer for all parks */
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

/** Park outline — dashed border for all park polygons */
export const parkOutlineLayer: LayerSpecification = {
  id: 'osm-park-outline',
  type: 'line',
  source: 'osm-trails',
  'source-layer': 'park',
  paint: {
    'line-color': '#6b8f60',
    'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 8, 0.6, 12, 1],
    'line-opacity': 0.4,
    'line-dasharray': [3, 2],
  },
};

/** Park name labels */
export const parkLabelLayer: LayerSpecification = {
  id: 'osm-park-labels',
  type: 'symbol',
  source: 'osm-trails',
  'source-layer': 'park',
  minzoom: 7,
  filter: ['has', 'name'],
  layout: {
    'text-field': ['get', 'name'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 10, 11, 14, 13],
    'text-font': ['Noto Sans Bold'],
    'text-max-width': 8,
    'text-allow-overlap': false,
    'text-padding': 4,
  },
  paint: {
    'text-color': '#2d5a27',
    'text-halo-color': 'rgba(255,255,255,0.85)',
    'text-halo-width': 1.5,
    'text-halo-blur': 0.5,
  },
};

// ── Tribal Lands layers ──

export function tribalLandsSource(): SourceSpecification {
  return {
    type: 'geojson',
    data: '/data/tribal-lands.geojson',
  };
}

export const tribalLandsFillLayer: LayerSpecification = {
  id: 'tribal-lands-fill',
  type: 'fill',
  source: 'tribal-lands',
  layout: { visibility: 'none' },
  paint: {
    'fill-color': '#9ca3af',
    'fill-opacity': 0.2,
  },
};

export const tribalLandsOutlineLayer: LayerSpecification = {
  id: 'tribal-lands-outline',
  type: 'line',
  source: 'tribal-lands',
  layout: { visibility: 'none' },
  paint: {
    'line-color': '#6b7280',
    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1, 12, 1.5],
    'line-opacity': 0.5,
  },
};

export const tribalLandsLabelLayer: LayerSpecification = {
  id: 'tribal-lands-labels',
  type: 'symbol',
  source: 'tribal-lands',
  minzoom: 7,
  layout: {
    visibility: 'none',
    'text-field': ['get', 'NAME'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 10, 11, 14, 13],
    'text-font': ['Noto Sans Bold'],
    'text-max-width': 8,
    'text-allow-overlap': false,
    'text-padding': 4,
  },
  paint: {
    'text-color': '#4b5563',
    'text-halo-color': 'rgba(255,255,255,0.8)',
    'text-halo-width': 1.5,
  },
};

// ── Recreation activity layers ──

export function recreationSource(): SourceSpecification {
  return {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  };
}

/** Generate a circle layer for a specific activity type */
export function recreationLayer(activityType: string): LayerSpecification {
  const config = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
  const color = config?.color || '#6b7280';
  return {
    id: `recreation-${activityType}`,
    type: 'circle',
    source: 'recreation-sites',
    filter: ['==', ['get', 'activity_type'], activityType],
    layout: { visibility: 'none' },
    minzoom: 6,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 10, 5, 14, 8],
      'circle-color': color,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 1, 14, 2],
      'circle-opacity': 0.85,
    },
  };
}

// ── Dark Sky layers ──

export function darkSkySource(): SourceSpecification {
  return {
    type: 'geojson',
    data: '/data/dark-sky-places.json',
  };
}

export const darkSkyMarkerLayer: LayerSpecification = {
  id: 'dark-sky-markers',
  type: 'circle',
  source: 'dark-sky',
  layout: { visibility: 'none' },
  minzoom: 4,
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 7, 12, 10],
    'circle-color': '#4338ca',
    'circle-stroke-color': '#a5b4fc',
    'circle-stroke-width': 2,
    'circle-opacity': 0.8,
  },
};
