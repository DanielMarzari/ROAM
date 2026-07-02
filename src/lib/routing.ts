// OSRM (public demo) — free foot-routing between two points.
// Returns a walking route along roads/paths as GeoJSON LineString.
// Rate limit is generous but not documented; ok for interactive route building.

const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/foot';

export interface RouteResult {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
}

export async function routeBetween(
  from: [number, number], // [lng, lat]
  to: [number, number],
): Promise<RouteResult | null> {
  const url = `${OSRM_ENDPOINT}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      geometry: r.geometry as GeoJSON.LineString,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
    };
  } catch {
    return null;
  }
}

/** Haversine distance in meters between two [lng, lat] points. */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Total length of a LineString in meters. */
export function lineStringLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

/** Orient a segment so its first point is closest to the anchor. */
export function orientSegment(
  coords: [number, number][],
  anchor: [number, number],
): [number, number][] {
  if (coords.length < 2) return coords;
  const distStart = haversine(coords[0], anchor);
  const distEnd = haversine(coords[coords.length - 1], anchor);
  return distEnd < distStart ? [...coords].reverse() : coords;
}
