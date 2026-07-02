'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { RouteSegment } from '@/components/route/RouteCreatorMap';
import { sendRouteToNavigator, buildRouteExport, type RouteExport } from '@/lib/navigator';

const RouteCreatorMap = dynamic(() => import('@/components/route/RouteCreatorMap'), { ssr: false });

interface SavedRoute {
  id: string;
  name: string;
  description: string | null;
  total_miles: number;
  segments: RouteSegment[];
  geometry: GeoJSON.Feature;
  created_at: string;
}

const metersToMiles = (m: number) => m / 1609.344;

export default function CreatePage() {
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [routeName, setRouteName] = useState('');
  const [routeDesc, setRouteDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const totalMeters = segments.reduce((s, seg) => s + seg.distanceMeters, 0);
  const totalMiles = metersToMiles(totalMeters);
  const trailMiles = metersToMiles(segments.filter((s) => s.kind === 'trail').reduce((a, s) => a + s.distanceMeters, 0));
  const connectorMiles = metersToMiles(segments.filter((s) => s.kind === 'connector').reduce((a, s) => a + s.distanceMeters, 0));

  const fetchSaved = async () => {
    try {
      const res = await fetch('/api/routes');
      const data = await res.json();
      setSaved(data.routes || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchSaved(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const buildGeometry = (): GeoJSON.Feature | null => {
    if (segments.length === 0) return null;
    const coords: [number, number][] = [];
    for (const seg of segments) {
      for (const c of seg.coordinates) {
        // Skip duplicate junction points
        if (coords.length && coords[coords.length - 1][0] === c[0] && coords[coords.length - 1][1] === c[1]) continue;
        coords.push(c);
      }
    }
    return {
      type: 'Feature',
      properties: { name: routeName, total_miles: totalMiles },
      geometry: { type: 'LineString', coordinates: coords },
    };
  };

  const handleSave = async () => {
    if (!routeName.trim()) { showToast('Give your route a name first.'); return; }
    const geom = buildGeometry();
    if (!geom) { showToast('Add at least one trail first.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: routeName.trim(),
          description: routeDesc.trim() || null,
          total_miles: totalMiles,
          geometry: geom,
          segments,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Saved "${routeName}"`);
        setRouteName('');
        setRouteDesc('');
        setSegments([]);
        fetchSaved();
      } else {
        showToast(`Save failed: ${data.error}`);
      }
    } catch (err) {
      showToast(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSON = () => {
    const geom = buildGeometry();
    if (!geom) { showToast('Nothing to export.'); return; }
    const payload: RouteExport = buildRouteExport(routeName || 'Untitled route', routeDesc, totalMiles, geom, segments);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(routeName || 'route').replace(/[^a-z0-9]+/gi, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToNavigator = () => {
    const geom = buildGeometry();
    if (!geom) { showToast('Nothing to send.'); return; }
    const payload = buildRouteExport(routeName || 'Untitled route', routeDesc, totalMiles, geom, segments);
    sendRouteToNavigator(payload);
  };

  const handleDeleteSaved = async (id: string) => {
    if (!confirm('Delete this route?')) return;
    await fetch(`/api/routes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    fetchSaved();
  };

  const handleLoadSaved = (r: SavedRoute) => {
    setSegments(r.segments || []);
    setRouteName(r.name);
    setRouteDesc(r.description || '');
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: 360,
        flexShrink: 0,
        borderRight: '1px solid #e7e5e4',
        backgroundColor: '#fafaf9',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui',
      }}>
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #e7e5e4' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1c1917' }}>Route Builder</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78716c' }}>
            Click trails on the map to string them together. Gaps auto-connect via walking routes.
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
          padding: '10px 12px', backgroundColor: '#fff', borderBottom: '1px solid #e7e5e4',
        }}>
          <Stat label="Total" value={`${totalMiles.toFixed(2)} mi`} />
          <Stat label="Trails" value={`${trailMiles.toFixed(2)} mi`} />
          <Stat label="Connect" value={`${connectorMiles.toFixed(2)} mi`} />
        </div>

        {/* Route meta */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e7e5e4' }}>
          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Route name…"
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              border: '1px solid #d6d3d1', borderRadius: 6, marginBottom: 6, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <textarea
            value={routeDesc}
            onChange={(e) => setRouteDesc(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 12,
              border: '1px solid #d6d3d1', borderRadius: 6, resize: 'vertical', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={handleSave} disabled={saving || segments.length === 0} primary>
              {saving ? 'Saving…' : '💾 Save'}
            </ActionButton>
            <ActionButton onClick={handleExportJSON} disabled={segments.length === 0}>📤 JSON</ActionButton>
            <ActionButton onClick={handleSendToNavigator} disabled={segments.length === 0}>🧭 Navigator</ActionButton>
            <ActionButton onClick={() => setSegments([])} disabled={segments.length === 0}>🗑️ Clear</ActionButton>
          </div>
        </div>

        {/* Segments list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {segments.length === 0 && (
            <p style={{ padding: '20px 16px', textAlign: 'center', color: '#a8a29e', fontSize: 12 }}>
              Click a trail on the map to start.
            </p>
          )}
          {segments.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderBottom: '1px solid #eeeceb',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                backgroundColor: s.kind === 'connector' ? '#f59e0b' : '#dc2626',
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: '#1c1917',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 10, color: '#78716c' }}>
                  {metersToMiles(s.distanceMeters).toFixed(2)} mi
                  {s.kind === 'connector' && ' · walking'}
                </div>
              </div>
              <button
                onClick={() => removeSegment(s.id)}
                title="Remove"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#a8a29e', padding: 4, fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Saved routes */}
        <div style={{ borderTop: '1px solid #e7e5e4', maxHeight: 220, overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a8a29e' }}>
            Saved Routes ({saved.length})
          </div>
          {saved.length === 0 && (
            <p style={{ padding: '4px 12px 12px', fontSize: 11, color: '#a8a29e' }}>None yet.</p>
          )}
          {saved.map((r) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderTop: '1px solid #eeeceb',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 10, color: '#78716c' }}>
                  {r.total_miles.toFixed(2)} mi · {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => handleLoadSaved(r)} title="Load" style={iconBtn}>📂</button>
              <button onClick={() => handleDeleteSaved(r.id)} title="Delete" style={iconBtn}>🗑️</button>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <RouteCreatorMap segments={segments} onSegmentsChange={setSegments} />
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1c1917', color: '#fff',
          padding: '8px 16px', borderRadius: 20, fontSize: 13, fontFamily: 'system-ui',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '2px 4px', fontSize: 12,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>{value}</div>
    </div>
  );
}

function ActionButton({ onClick, children, disabled, primary }: {
  onClick: () => void; children: React.ReactNode; disabled?: boolean; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px', fontSize: 11, fontWeight: 600,
        border: primary ? 'none' : '1px solid #d6d3d1',
        borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: primary ? '#16a34a' : '#fff',
        color: primary ? '#fff' : '#44403c',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'system-ui',
      }}
    >
      {children}
    </button>
  );
}
