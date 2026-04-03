-- ROAM: Initial Database Schema
-- Requires PostGIS extension (enable in Supabase Dashboard → Database → Extensions)

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- TRAILS (core table)
-- ============================================
CREATE TABLE trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty VARCHAR(50) CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  length_miles NUMERIC(10, 2),
  elevation_gain_ft INTEGER,
  elevation_loss_ft INTEGER,
  route_type VARCHAR(50) CHECK (route_type IN ('loop', 'out_and_back', 'point_to_point')),
  surface_type VARCHAR(100),

  -- Geospatial (SRID 4326 = WGS84, standard GPS coordinates)
  geometry GEOMETRY(LINESTRING, 4326),
  center_point GEOMETRY(POINT, 4326),

  -- Source tracking
  source VARCHAR(50) NOT NULL CHECK (source IN ('osm', 'nps', 'usfs')),
  external_id VARCHAR(255) NOT NULL,
  source_data JSONB DEFAULT '{}',
  original_source_url TEXT,
  checksum VARCHAR(64),

  -- Metadata
  season_open VARCHAR(50),
  pet_friendly BOOLEAN,
  water_available BOOLEAN,
  maintained_by VARCHAR(255),
  region VARCHAR(100),
  state VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,

  -- Prevent duplicate imports
  UNIQUE(source, external_id)
);

-- Spatial indexes for fast geo queries
CREATE INDEX idx_trails_geometry ON trails USING GIST (geometry);
CREATE INDEX idx_trails_center_point ON trails USING GIST (center_point);

-- Filter indexes
CREATE INDEX idx_trails_difficulty ON trails (difficulty);
CREATE INDEX idx_trails_source ON trails (source);
CREATE INDEX idx_trails_state ON trails (state);
CREATE INDEX idx_trails_length ON trails (length_miles);
CREATE INDEX idx_trails_name_trgm ON trails USING GIN (name gin_trgm_ops);

-- Full-text search
ALTER TABLE trails ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(state, ''))
  ) STORED;
CREATE INDEX idx_trails_fts ON trails USING GIN (fts);

-- ============================================
-- TRAIL POINTS (elevation profile)
-- ============================================
CREATE TABLE trail_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  location GEOMETRY(POINT, 4326) NOT NULL,
  elevation_ft NUMERIC(10, 2),
  distance_miles NUMERIC(10, 3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trail_points_trail ON trail_points (trail_id, sequence);

-- ============================================
-- TRAIL TAGS (flexible metadata)
-- ============================================
CREATE TABLE trail_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  value VARCHAR(255),
  UNIQUE(trail_id, tag)
);

CREATE INDEX idx_trail_tags_trail ON trail_tags (trail_id);
CREATE INDEX idx_trail_tags_tag ON trail_tags (tag);

-- ============================================
-- SYNC LOGS (data pipeline monitoring)
-- ============================================
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  region VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  trails_fetched INTEGER DEFAULT 0,
  trails_created INTEGER DEFAULT 0,
  trails_updated INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for all trail data
CREATE POLICY "Trails are publicly readable"
  ON trails FOR SELECT
  USING (true);

CREATE POLICY "Trail points are publicly readable"
  ON trail_points FOR SELECT
  USING (true);

CREATE POLICY "Trail tags are publicly readable"
  ON trail_tags FOR SELECT
  USING (true);

-- Service role can do everything (for data sync)
CREATE POLICY "Service role full access on trails"
  ON trails FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on trail_points"
  ON trail_points FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on trail_tags"
  ON trail_tags FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sync_logs"
  ON sync_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trails_updated_at
  BEFORE UPDATE ON trails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to get trails as GeoJSON FeatureCollection
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
    LIMIT max_results
  ) t;
$$ LANGUAGE sql STABLE;
