import type { BasemapStyle } from '@/types/map';

/**
 * Basemap styles. "topo" uses a vector base + raster contour overlay
 * for real elevation rings. All others are OpenFreeMap vector tiles.
 */

export const BASEMAP_STYLES: Record<BasemapStyle, { name: string; url: string; attribution: string; raster?: boolean }> = {
  outdoor: {
    name: 'Outdoor',
    url: 'https://tiles.openfreemap.org/styles/liberty',
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
  topo: {
    name: 'Topo',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    raster: true,
  },
};

/**
 * Raster tile overlays (can be toggled on/off independently of basemap).
 */
export const OVERLAY_TILES = {
  satellite: {
    name: 'Satellite',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: '© USGS',
    maxZoom: 16,
  },
  topo_raster: {
    name: 'USGS Topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: '© USGS',
    maxZoom: 16,
  },
};

/**
 * Default trail color (yellow) — user can override via color picker.
 */
export const DEFAULT_TRAIL_COLOR = '#eab308';

/**
 * Preset trail color options for the color picker.
 */
export const TRAIL_COLOR_PRESETS = [
  { name: 'Yellow', color: '#eab308' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'White', color: '#ffffff' },
];

export const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
export const DEFAULT_ZOOM = 4;

/**
 * Keywords to identify basemap trail/path layers (not roads).
 */
export const PATH_LAYER_KEYWORDS = ['path', 'pedestrian'];
export const PATH_LAYER_EXCLUDE = ['service', 'track', 'landuse'];

/**
 * Road layer IDs to desaturate on outdoor mode (greyscale roads
 * so trails stand out). Covers motorways, trunks, primary, secondary,
 * minor roads, and their casings.
 */
export const ROAD_LAYERS_TO_DESATURATE = [
  'road_motorway', 'road_motorway_casing', 'road_motorway_link', 'road_motorway_link_casing',
  'road_trunk_primary', 'road_trunk_primary_casing',
  'road_secondary_tertiary', 'road_secondary_tertiary_casing',
  'road_link', 'road_link_casing',
  'road_minor', 'road_minor_casing',
  'road_service_track', 'road_service_track_casing',
  'bridge_motorway', 'bridge_motorway_casing', 'bridge_motorway_link', 'bridge_motorway_link_casing',
  'bridge_trunk_primary', 'bridge_trunk_primary_casing',
  'tunnel_motorway', 'tunnel_motorway_casing', 'tunnel_motorway_link', 'tunnel_motorway_link_casing',
  'tunnel_trunk_primary', 'tunnel_trunk_primary_casing',
];

/** Gray color for desaturated roads */
export const ROAD_DESATURATED_COLOR = '#c4c4c4';
export const ROAD_CASING_DESATURATED_COLOR = '#b0b0b0';
