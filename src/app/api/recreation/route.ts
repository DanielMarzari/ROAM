import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface RecreationRow {
  id: string;
  name: string | null;
  activity_type: string;
  lat: number;
  lng: number;
  state: string | null;
  tags_json: string | null;
}

/**
 * GET /api/recreation?bbox=west,south,east,north&types=climbing,cave&limit=1000
 * Returns GeoJSON FeatureCollection of recreation sites.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bboxParam = searchParams.get('bbox');
  const typesParam = searchParams.get('types');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam), 2000) : 1000;

  if (!bboxParam || !typesParam) {
    return NextResponse.json(
      { type: 'FeatureCollection', features: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  }

  const parts = bboxParam.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json(
      { type: 'FeatureCollection', features: [] },
      { status: 400 },
    );
  }
  const [west, south, east, north] = parts;
  const types = typesParam.split(',').filter(Boolean);

  try {
    const db = getDb();

    // Check if table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='recreation_sites'"
    ).get();
    if (!tableCheck) {
      return NextResponse.json(
        { type: 'FeatureCollection', features: [] },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
      );
    }

    const placeholders = types.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT id, name, activity_type, lat, lng, state, tags_json
      FROM recreation_sites
      WHERE activity_type IN (${placeholders})
        AND lng >= ? AND lng <= ?
        AND lat >= ? AND lat <= ?
      LIMIT ?
    `).all(...types, west, east, south, north, limit) as RecreationRow[];

    const features = rows.map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [r.lng, r.lat],
      },
      properties: {
        id: r.id,
        name: r.name || 'Unnamed',
        activity_type: r.activity_type,
        state: r.state,
      },
    }));

    return NextResponse.json(
      { type: 'FeatureCollection', features },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (err) {
    console.error('[ROAM] Recreation endpoint error:', err);
    return NextResponse.json(
      { type: 'FeatureCollection', features: [], _error: String(err) },
      { status: 500 },
    );
  }
}
