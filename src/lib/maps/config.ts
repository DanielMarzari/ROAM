import type { BasemapStyle } from '@/types/map';

/**
 * All tile sources are free and require no API keys.
 */

export const BASEMAP_STYLES: Record<BasemapStyle, { name: string; url: string; attribution: string }> = {
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
    name: 'Topographic',
    url: 'https://tiles.openfreemap.org/styles/positron',
    attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
export const DEFAULT_TRAIL_COLOR = '#eab308'; // yellow-500

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

export const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283]; // Center of US
export const DEFAULT_ZOOM = 4;

/**
 * Keywords to identify basemap trail/path layers (NOT roads or service tracks).
 * Used to dynamically find and restyle trail layers in any basemap style.
 * "path" and "pedestrian" match hiking/walking paths across all OpenFreeMap styles.
 */
export const PATH_LAYER_KEYWORDS = ['path', 'pedestrian'];

/**
 * Keywords to EXCLUDE — these match road/service layers that should stay untouched.
 */
export const PATH_LAYER_EXCLUDE = ['service', 'track', 'landuse'];
