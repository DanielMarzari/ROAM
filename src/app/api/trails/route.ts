import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * GET /api/trails?query=...&difficulty=easy,moderate&min_length=1&max_length=10&limit=50&offset=0
 *
 * Returns trail list with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('query') || '';
  const difficulties = searchParams.get('difficulty')?.split(',').filter(Boolean) || [];
  const minLength = searchParams.get('min_length') ? Number(searchParams.get('min_length')) : null;
  const maxLength = searchParams.get('max_length') ? Number(searchParams.get('max_length')) : null;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);
  const offset = Number(searchParams.get('offset') || 0);

  try {
    const db = getDb();
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (query) {
      where += ' AND name LIKE ?';
      params.push(`%${query}%`);
    }

    if (difficulties.length > 0) {
      where += ` AND difficulty IN (${difficulties.map(() => '?').join(',')})`;
      params.push(...difficulties);
    }

    if (minLength !== null) {
      where += ' AND length_miles >= ?';
      params.push(minLength);
    }

    if (maxLength !== null) {
      where += ' AND length_miles <= ?';
      params.push(maxLength);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM trails ${where}`);
    const countRow = countStmt.get(...params) as { total: number };

    const selectStmt = db.prepare(
      `SELECT id, name, description, difficulty, length_miles, elevation_gain_ft, elevation_loss_ft, route_type, surface_type, state, source
       FROM trails ${where} ORDER BY name LIMIT ? OFFSET ?`
    );
    const trails = selectStmt.all(...params, limit, offset);

    return NextResponse.json({
      trails: trails || [],
      total: countRow?.total || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Trail API error:', err);
    return NextResponse.json({ trails: [], total: 0 }, { status: 500 });
  }
}
