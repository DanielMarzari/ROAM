export type BasemapStyle = 'outdoor' | 'light' | 'dark' | 'topo';

export interface MapViewport {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapLayer {
  id: string;
  name: string;
  type: 'basemap' | 'overlay';
  visible: boolean;
  icon?: string;
}

export const DEFAULT_VIEWPORT: MapViewport = {
  center: [-98.5795, 39.8283], // Center of US
  zoom: 4,
};

export interface FilterState {
  nationalParks: boolean;
  nationalForests: boolean;
  stateParks: boolean;
  monuments: boolean;
  conservation: boolean;
  tribalLands: boolean;
  climbing: boolean;
  caves: boolean;
  camping: boolean;
  viaFerrata: boolean;
  offroad: boolean;
  kayaking: boolean;
  fishing: boolean;
  darkSky: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  nationalParks: true,
  nationalForests: true,
  stateParks: true,
  monuments: true,
  conservation: true,
  tribalLands: false,
  climbing: false,
  caves: false,
  camping: false,
  viaFerrata: false,
  offroad: false,
  kayaking: false,
  fishing: false,
  darkSky: false,
};

export const BASEMAP_STYLES: Record<BasemapStyle, { name: string; url: string }> = {
  outdoor: {
    name: 'Outdoor',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  light: {
    name: 'Light',
    url: 'https://tiles.openfreemap.org/styles/bright',
  },
  dark: {
    name: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
  },
  topo: {
    name: 'Topo',
    url: 'https://tiles.openfreemap.org/styles/positron',
  },
};
