import type { BasemapStyle } from '@/types/map';

/**
 * Basemap styles — all OpenFreeMap vector tiles.
 */
export const BASEMAP_STYLES: Record<BasemapStyle, { name: string; url: string; attribution: string }> = {
  outdoor: {
    name: 'Outdoor',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  topo: {
    name: 'Topo',
    url: 'https://tiles.openfreemap.org/styles/positron',
    attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  light: {
    name: 'Light',
    url: 'https://tiles.openfreemap.org/styles/bright',
    attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    name: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
    attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

/**
 * Raster tile overlays.
 */
export const OVERLAY_TILES = {
  satellite: {
    name: 'Satellite',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: '© USGS',
    maxZoom: 16,
  },
};

/**
 * Elevation contour line settings (maplibre-contour).
 * Uses AWS Terrain tiles (free, public domain, global coverage).
 */
export const CONTOUR_CONFIG = {
  demUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  encoding: 'terrarium' as const,
  maxzoom: 13,
  /** Multiplier: 3.28084 converts meters → feet */
  multiplier: 3.28084,
  /** minor/major intervals per zoom level (in feet) */
  thresholds: {
    11: [200, 1000],
    12: [100, 500],
    13: [50, 200],
    14: [40, 200],
    15: [20, 100],
  } as Record<number, [number, number]>,
};

/**
 * Trail rendering — always dashed black lines.
 */
export const TRAIL_LINE_COLOR = '#1a1a1a';
export const TRAIL_DASH_PATTERN: [number, number] = [2, 1.5];

export const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
export const DEFAULT_ZOOM = 4;

/**
 * Keywords to identify basemap trail/path layers (not roads).
 */
export const PATH_LAYER_KEYWORDS = ['path', 'pedestrian'];
export const PATH_LAYER_EXCLUDE = ['service', 'track', 'landuse'];

/**
 * Road layer groups for desaturation.
 * Highways → grey, minor roads → off-white.
 */
export const HIGHWAY_LAYERS = [
  'road_motorway', 'road_motorway_casing', 'road_motorway_link', 'road_motorway_link_casing',
  'road_trunk_primary', 'road_trunk_primary_casing',
  'bridge_motorway', 'bridge_motorway_casing', 'bridge_motorway_link', 'bridge_motorway_link_casing',
  'bridge_trunk_primary', 'bridge_trunk_primary_casing',
  'tunnel_motorway', 'tunnel_motorway_casing', 'tunnel_motorway_link', 'tunnel_motorway_link_casing',
  'tunnel_trunk_primary', 'tunnel_trunk_primary_casing',
];
export const HIGHWAY_COLOR = '#b8b8b8';
export const HIGHWAY_CASING_COLOR = '#a8a8a8';

export const MINOR_ROAD_LAYERS = [
  'road_secondary_tertiary', 'road_secondary_tertiary_casing',
  'road_link', 'road_link_casing',
  'road_minor', 'road_minor_casing',
  'road_service_track', 'road_service_track_casing',
];
export const MINOR_ROAD_COLOR = '#e8e8e8';
export const MINOR_ROAD_CASING_COLOR = '#dcdcdc';
