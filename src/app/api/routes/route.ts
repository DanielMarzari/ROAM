import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Custom user-created routes.
 * Table `custom_routes` is created on demand.
 */
function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      total_miles REAL NOT NULL DEFAULT 0,
      geojson TEXT NOT NULL,
      segments_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_custom_routes_created ON custom_routes(created_at DESC);
  `);
}

export async function GET() {
  try {
    ensureTable();
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, name, description, total_miles, geojson, segments_json, created_at
       FROM custom_routes
       ORDER BY created_at DESC
       LIMIT 200`,
    ).all() as Array<{ id: string; name: string; description: string | null; total_miles: number; geojson: string; segments_json: string; created_at: string }>;

    const routes = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      total_miles: r.total_miles,
      geometry: JSON.parse(r.geojson),
      segments: JSON.parse(r.segments_json),
      created_at: r.created_at,
    }));
    return NextResponse.json({ routes });
  } catch (err) {
    console.error('[ROAM] routes GET:', err);
    return NextResponse.json({ routes: [], _error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureTable();
    const body = await request.json();
    const { id, name, description, total_miles, geometry, segments } = body || {};
    if (!name || !geometry) {
      return NextResponse.json({ error: 'name and geometry required' }, { status: 400 });
    }
    const db = getDb();
    const rowId = id || `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO custom_routes (id, name, description, total_miles, geojson, segments_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        description=excluded.description,
        total_miles=excluded.total_miles,
        geojson=excluded.geojson,
        segments_json=excluded.segments_json,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      rowId,
      String(name),
      description ? String(description) : null,
      Number(total_miles) || 0,
      JSON.stringify(geometry),
      JSON.stringify(segments || []),
    );
    return NextResponse.json({ id: rowId, ok: true });
  } catch (err) {
    console.error('[ROAM] routes POST:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    ensureTable();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const db = getDb();
    db.prepare('DELETE FROM custom_routes WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
