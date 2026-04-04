-- Update trails_as_geojson to return longest trails first.
-- This ensures the 2000-trail limit prioritizes major trails
-- over short connector segments at zoomed-out levels.

CREATE OR REPLACE FUNCTION trails_as_geojson(
  bbox_west FLOAT DEFAULT -180,
  bbox_south FLOAT DEFAULT -90,
  bbox_east FLOAT DEFAULT 180,
  bbox_north FLOAT DEFAULT 90,
  max_results INTEGER DEFAULT 500
)
RETURNS JSON AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', t.id,
        'geometry', ST_AsGeoJSON(t.geometry)::json,
        'properties', json_build_object(
          'id', t.id,
          'name', t.name,
          'difficulty', t.difficulty,
          'length_miles', t.length_miles,
          'elevation_gain_ft', t.elevation_gain_ft,
          'route_type', t.route_type
        )
      )
    ), '[]'::json)
  )
  FROM (
    SELECT *
    FROM trails
    WHERE geometry IS NOT NULL
      AND ST_Intersects(
        geometry,
        ST_MakeEnvelope(bbox_west, bbox_south, bbox_east, bbox_north, 4326)
      )
    ORDER BY length_miles DESC NULLS LAST
    LIMIT max_results
  ) t;
$$ LANGUAGE sql STABLE;
