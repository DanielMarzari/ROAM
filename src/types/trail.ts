export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert';
export type RouteType = 'loop' | 'out_and_back' | 'point_to_point';
export type TrailSource = 'osm' | 'nps' | 'usfs';

export interface Trail {
  id: string;
  name: string;
  description: string | null;
  difficulty: Difficulty | null;
  length_miles: number | null;
  elevation_gain_ft: number | null;
  elevation_loss_ft: number | null;
  route_type: RouteType | null;
  surface_type: string | null;
  geometry: GeoJSON.LineString | null;
  center_point: { lat: number; lng: number } | null;
  source: TrailSource;
  external_id: string;
  season_open: string | null;
  pet_friendly: boolean | null;
  water_available: boolean | null;
  maintained_by: string | null;
  region: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrailSearchParams {
  query?: string;
  difficulty?: Difficulty[];
  min_length?: number;
  max_length?: number;
  min_elevation?: number;
  max_elevation?: number;
  route_type?: RouteType[];
  near_lat?: number;
  near_lng?: number;
  radius_miles?: number;
  bbox?: [number, number, number, number]; // [west, south, east, north]
  limit?: number;
  offset?: number;
}

export interface TrailGeoJSON {
  type: 'FeatureCollection';
  features: TrailFeature[];
}

export interface TrailFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSON.LineString;
  properties: {
    id: string;
    name: string;
    difficulty: Difficulty | null;
    length_miles: number | null;
    elevation_gain_ft: number | null;
    route_type: RouteType | null;
  };
}
