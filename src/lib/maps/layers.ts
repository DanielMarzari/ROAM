import type { LayerSpecification, SourceSpecification, FilterSpecification, ExpressionSpecification } from 'maplibre-gl';
import { OVERLAY_TILES, ACTIVITY_TYPES } from './config';

// ── OpenTrailMap tile sources (OSMU) ──

export function trailTileSource(): SourceSpecification {
  return {
    type: 'vector',
    url: 'https://tiles.openstreetmap.us/vector/trails.json',
    attribution: '© <a href="https://openstreetmap.us">OpenStreetMap US</a>',
  };
}

export function hillshadeSource(): SourceSpecification {
  return {
    type: 'raster',
    url: 'https://tiles.openstreetmap.us/raster/hillshade.json',
    tileSize: 256,
    attribution: '© <a href="https://openstreetmap.us">OSMU Hillshade</a>',
  };
}

export function contourTileSource(): SourceSpecification {
  return {
    type: 'vector',
    url: 'https://tiles.openstreetmap.us/vector/contours-feet.json',
    attribution: '© <a href="https://openstreetmap.us">OSMU Contours</a>',
  };
}

export function satelliteSource(): SourceSpecification {
  return {
    type: 'raster',
    tiles: [OVERLAY_TILES.satellite.url],
    tileSize: 256,
    maxzoom: OVERLAY_TILES.satellite.maxZoom,
    attribution: OVERLAY_TILES.satellite.attribution,
  };
}

export const satelliteLayer: LayerSpecification = {
  id: 'satellite-layer',
  type: 'raster',
  source: 'satellite',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.8 },
};

export const hillshadeLayer: LayerSpecification = {
  id: 'hillshade-layer',
  type: 'raster',
  source: 'hillshade',
  layout: { visibility: 'none' },
  paint: {
    'raster-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 0.1],
  },
};

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

// ── Trail layers ──

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
  layout: { 'line-join': 'round', 'line-cap': 'round' },
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
  layout: { 'line-join': 'round', 'line-cap': 'round' },
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
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#000000',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 3, 15, 4, 18, 5.5],
    'line-opacity': 0.08,
  },
};

// ── Park layers (split by category) ──

export type ParkCategory = 'national' | 'forest' | 'state' | 'monument' | 'conservation';

const PARK_COLORS: Record<ParkCategory, string> = {
  national:     '#a3d4a0',
  forest:       '#c5dbb8',
  state:        '#cce5c4',
  monument:     '#d4c9a8',
  conservation: '#d0e0c8',
};

const PARK_LABEL_COLORS: Record<ParkCategory, string> = {
  national:     '#2d5a27',
  forest:       '#3f6a2a',
  state:        '#4c7a3b',
  monument:     '#7a5c1e',
  conservation: '#4a6a3a',
};

// Case-insensitive "field contains needle" expression against tile properties.
function fieldContains(field: string, needle: string): ExpressionSpecification {
  return ['in', needle, ['downcase', ['to-string', ['coalesce', ['get', field], '']]]] as unknown as ExpressionSpecification;
}

function parkFilter(cat: ParkCategory): FilterSpecification {
  const has = fieldContains;
  switch (cat) {
    case 'national':
      return ['any',
        has('protection_title', 'national park'),
        has('boundary', 'national_park'),
        ['all',
          has('operator', 'national park service'),
          ['!', has('protection_title', 'monument')],
        ],
      ] as unknown as FilterSpecification;
    case 'forest':
      return ['any',
        has('protection_title', 'national forest'),
        has('operator', 'forest service'),
        has('name', 'national forest'),
      ] as unknown as FilterSpecification;
    case 'state':
      return ['any',
        has('protection_title', 'state park'),
        has('name', 'state park'),
        has('protection_title', 'state forest'),
      ] as unknown as FilterSpecification;
    case 'monument':
      return ['any',
        has('protection_title', 'national monument'),
        has('name', 'national monument'),
      ] as unknown as FilterSpecification;
    case 'conservation':
      return ['any',
        has('protection_title', 'wilderness'),
        has('protection_title', 'conservation'),
        has('protection_title', 'wildlife refuge'),
        has('protection_title', 'preserve'),
        has('name', 'wildlife refuge'),
        has('name', 'conservation area'),
      ] as unknown as FilterSpecification;
  }
}

export function parkFillLayerFor(cat: ParkCategory): LayerSpecification {
  return {
    id: `park-fill-${cat}`,
    type: 'fill',
    source: 'osm-trails',
    'source-layer': 'park',
    filter: parkFilter(cat),
    paint: {
      'fill-color': PARK_COLORS[cat],
      'fill-opacity': cat === 'national' ? 0.45 : 0.3,
    },
  };
}

export function parkOutlineLayerFor(cat: ParkCategory): LayerSpecification {
  return {
    id: `park-outline-${cat}`,
    type: 'line',
    source: 'osm-trails',
    'source-layer': 'park',
    filter: parkFilter(cat),
    paint: {
      'line-color': PARK_LABEL_COLORS[cat],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 8, 0.6, 12, 1],
      'line-opacity': 0.5,
      'line-dasharray': [3, 2],
    },
  };
}

export function parkLabelLayerFor(cat: ParkCategory): LayerSpecification {
  return {
    id: `park-labels-${cat}`,
    type: 'symbol',
    source: 'osm-trails',
    'source-layer': 'park',
    minzoom: 7,
    filter: ['all', parkFilter(cat), ['has', 'name']] as unknown as FilterSpecification,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 10, 11, 14, 13],
      'text-font': ['Noto Sans Bold'],
      'text-max-width': 8,
      'text-allow-overlap': false,
      'text-padding': 4,
    },
    paint: {
      'text-color': PARK_LABEL_COLORS[cat],
      'text-halo-color': 'rgba(255,255,255,0.85)',
      'text-halo-width': 1.5,
      'text-halo-blur': 0.5,
    },
  };
}

export const PARK_CATEGORIES: ParkCategory[] = ['national', 'forest', 'state', 'monument', 'conservation'];

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

// ── Weather (precipitation radar) source ──
// RainViewer serves free public radar tiles — no key required.
// See https://api.rainviewer.com/public/weather-maps.json for tile paths.
export function precipitationSource(pastTs: number): SourceSpecification {
  return {
    type: 'raster',
    tiles: [`https://tilecache.rainviewer.com/v2/radar/${pastTs}/256/{z}/{x}/{y}/2/1_1.png`],
    tileSize: 256,
    attribution: '© <a href="https://www.rainviewer.com">RainViewer</a>',
  };
}

export const precipitationLayer: LayerSpecification = {
  id: 'precipitation-layer',
  type: 'raster',
  source: 'precipitation',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.65 },
};

// ── Custom route builder source (empty by default) ──
export function customRouteSource(): SourceSpecification {
  return { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
}

export const customRouteLayer: LayerSpecification = {
  id: 'custom-route-line',
  type: 'line',
  source: 'custom-route',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': ['case', ['==', ['get', 'kind'], 'connector'], '#f59e0b', '#dc2626'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 6, 18, 9],
    'line-opacity': 0.85,
    'line-dasharray': ['case', ['==', ['get', 'kind'], 'connector'], ['literal', [2, 2]], ['literal', [1, 0]]],
  },
};
