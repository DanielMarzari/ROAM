import type { TrailSearchParams } from '@/types/trail';

/**
 * Build a Supabase query for trail search with filters.
 * Uses PostGIS for geospatial queries.
 */
export function buildTrailSearchQuery(params: TrailSearchParams) {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (params.query) {
    conditions.push(`name ILIKE $${values.length + 1}`);
    values.push(`%${params.query}%`);
  }

  if (params.difficulty?.length) {
    conditions.push(`difficulty = ANY($${values.length + 1})`);
    values.push(params.difficulty as unknown as string);
  }

  if (params.min_length != null) {
    conditions.push(`length_miles >= $${values.length + 1}`);
    values.push(params.min_length);
  }

  if (params.max_length != null) {
    conditions.push(`length_miles <= $${values.length + 1}`);
    values.push(params.max_length);
  }

  if (params.min_elevation != null) {
    conditions.push(`elevation_gain_ft >= $${values.length + 1}`);
    values.push(params.min_elevation);
  }

  if (params.max_elevation != null) {
    conditions.push(`elevation_gain_ft <= $${values.length + 1}`);
    values.push(params.max_elevation);
  }

  return { conditions, values };
}

/**
 * SQL for finding trails within a bounding box (map viewport).
 */
export function trailsInBboxSQL(bbox: [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  return `
    SELECT id, name, difficulty, length_miles, elevation_gain_ft, route_type,
           ST_AsGeoJSON(geometry) as geometry_json
    FROM trails
    WHERE geometry IS NOT NULL
      AND ST_Intersects(
        geometry,
        ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)
      )
    LIMIT 500
  `;
}

/**
 * SQL for finding trails near a point.
 */
export function trailsNearPointSQL(lat: number, lng: number, radiusMiles: number = 25) {
  const radiusMeters = radiusMiles * 1609.34;
  return `
    SELECT id, name, difficulty, length_miles, elevation_gain_ft, route_type,
           ST_AsGeoJSON(geometry) as geometry_json,
           ST_Distance(center_point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1609.34 as distance_miles
    FROM trails
    WHERE geometry IS NOT NULL
      AND ST_DWithin(
        center_point::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_miles
    LIMIT 100
  `;
}
