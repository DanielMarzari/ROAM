export type BasemapStyle = 'outdoor' | 'light' | 'dark';

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
};
