'use client';

import { useEffect, useRef, useState } from 'react';

export interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
  importance?: number;
}

interface Props {
  onSelect: (result: SearchResult) => void;
}

// Nominatim usage policy: max 1 req/sec, must set a UA. We debounce 400ms.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Prefer parks/mountains/water bodies for outdoor use, then anything.
const CATEGORY_ICON: Record<string, string> = {
  peak: '⛰️', mountain: '🏔️', volcano: '🌋',
  water: '💧', lake: '🏞️', river: '🌊', reservoir: '💧',
  park: '🌲', national_park: '🌲', nature_reserve: '🍃',
  glacier: '🧊', beach: '🏖️', island: '🏝️',
  city: '🏙️', town: '🏘️', village: '🏘️',
  place: '📍',
};

function pickIcon(r: SearchResult): string {
  return CATEGORY_ICON[r.type] || CATEGORY_ICON[r.class] || '📍';
}

export default function SearchBox({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          format: 'json',
          countrycodes: 'us',
          limit: '8',
          addressdetails: '0',
          'accept-language': 'en',
        });
        const res = await fetch(`${NOMINATIM}?${params}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = (await res.json()) as SearchResult[];
        // Sort: prioritise natural features + national parks over cities
        const ranked = [...data].sort((a, b) => {
          const outdoorClasses = new Set(['natural', 'leisure', 'boundary', 'waterway', 'water']);
          const aOutdoor = outdoorClasses.has(a.class) ? 1 : 0;
          const bOutdoor = outdoorClasses.has(b.class) ? 1 : 0;
          if (aOutdoor !== bOutdoor) return bOutdoor - aOutdoor;
          return (b.importance || 0) - (a.importance || 0);
        });
        setResults(ranked);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q]);

  const handleSelect = (r: SearchResult) => {
    onSelect(r);
    setQ(r.display_name.split(',')[0]);
    setOpen(false);
  };

  return (
    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 380, maxWidth: 'calc(100% - 24px)', zIndex: 15 }}>
      <div style={{ position: 'relative' }}>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#78716c"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search parks, mountains, lakes…"
          style={{
            width: '100%',
            padding: '10px 34px 10px 38px',
            fontSize: 14,
            border: '1px solid #d6d3d1',
            borderRadius: 24,
            outline: 'none',
            backgroundColor: '#fff',
            color: '#1c1917',
            fontFamily: 'system-ui',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, border: '2px solid #d6d3d1', borderTopColor: '#16a34a',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
        )}
        {!loading && q && (
          <button
            onClick={() => { setQ(''); setResults([]); }}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: '#78716c',
            }}
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', top: 44, left: 0, right: 0,
          margin: 0, padding: 4, listStyle: 'none',
          backgroundColor: '#fff',
          border: '1px solid #d6d3d1',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 340, overflowY: 'auto',
          fontFamily: 'system-ui',
        }}>
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                onMouseDown={(e) => e.preventDefault()} // don't blur before click
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px',
                  border: 'none', borderRadius: 8,
                  backgroundColor: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{pickIcon(r)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.display_name.split(',')[0]}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.display_name.split(',').slice(1, 4).join(',').trim()}
                  </span>
                </span>
                <span style={{ fontSize: 10, color: '#a8a29e', textTransform: 'capitalize', flexShrink: 0 }}>
                  {r.type.replace(/_/g, ' ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
