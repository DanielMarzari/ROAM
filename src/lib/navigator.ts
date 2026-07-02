// Integration with navigator.danmarzari.com (user's separate trip-planner app).
// We hand off routes / awards data via a base64-encoded JSON payload in the URL hash.
// The Navigator app can decode it and merge into its own state.

import type { RouteSegment } from '@/components/route/RouteCreatorMap';
import type { AwardsState } from '@/types/awards';

const NAVIGATOR_URL = 'https://navigator.danmarzari.com';

export interface RouteExport {
  kind: 'roam.route';
  version: 1;
  exported_at: string;
  name: string;
  description: string;
  total_miles: number;
  geometry: GeoJSON.Feature;
  segments: RouteSegment[];
  source: 'roam.danmarzari.com';
}

export interface AwardsExport {
  kind: 'roam.awards';
  version: 1;
  exported_at: string;
  awards: AwardsState;
  source: 'roam.danmarzari.com';
}

export function buildRouteExport(
  name: string,
  description: string,
  totalMiles: number,
  geometry: GeoJSON.Feature,
  segments: RouteSegment[],
): RouteExport {
  return {
    kind: 'roam.route',
    version: 1,
    exported_at: new Date().toISOString(),
    name,
    description,
    total_miles: totalMiles,
    geometry,
    segments,
    source: 'roam.danmarzari.com',
  };
}

export function buildAwardsExport(awards: AwardsState): AwardsExport {
  return {
    kind: 'roam.awards',
    version: 1,
    exported_at: new Date().toISOString(),
    awards,
    source: 'roam.danmarzari.com',
  };
}

/** Base64url-encode a JS object for URL-hash transport. */
function encodePayload(obj: unknown): string {
  const json = JSON.stringify(obj);
  // Browser-safe UTF-8 base64 → base64url
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Open Navigator in a new tab with the payload attached in the URL hash. */
export function sendRouteToNavigator(payload: RouteExport): void {
  const encoded = encodePayload(payload);
  const url = `${NAVIGATOR_URL}/import#roam=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function sendAwardsToNavigator(payload: AwardsExport): void {
  const encoded = encodePayload(payload);
  const url = `${NAVIGATOR_URL}/import#roam=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Download any object as a pretty-printed JSON file. */
export function downloadJSON(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
