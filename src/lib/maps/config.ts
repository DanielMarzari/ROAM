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
 * Trail line styling by difficulty.
 */
export const TRAIL_COLORS: Record<string, string> = {
  easy: '#22c55e',      // green
  moderate: '#3b82f6',  // blue
  hard: '#f59e0b',      // amber
  expert: '#ef4444',    // red
  unknown: '#8b5cf6',   // purple
};

export const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283]; // Center of US
export const DEFAULT_ZOOM = 4;
