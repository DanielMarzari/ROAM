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
 * Trail line styling by difficulty — bold, saturated colors.
 */
export const TRAIL_COLORS: Record<string, string> = {
  easy: '#15803d',      // bold green
  moderate: '#2563eb',  // bold blue
  hard: '#d97706',      // bold amber
  expert: '#dc2626',    // bold red
  unknown: '#7c3aed',   // bold purple
};

export const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283]; // Center of US
export const DEFAULT_ZOOM = 4;

/**
 * Basemap layers that render paths/trails — we toggle these
 * alongside our custom trail layer so the user can fully hide trails.
 */
export const BASEMAP_PATH_LAYERS = [
  'road_path_pedestrian',
  'road_service_track',
  'road_service_track_casing',
  'tunnel_path_pedestrian',
  'tunnel_service_track',
  'tunnel_service_track_casing',
  'bridge_path_pedestrian',
  'bridge_path_pedestrian_casing',
  'bridge_service_track',
  'bridge_service_track_casing',
  'highway-name-path',
  'landuse_track',
];
