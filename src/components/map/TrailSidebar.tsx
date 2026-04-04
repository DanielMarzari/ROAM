'use client';

import { useState } from 'react';
import type { TrailItem } from './MapContainer';

interface TrailSidebarProps {
  trails: TrailItem[];
  open: boolean;
  onToggle: () => void;
  onSelect: (trail: TrailItem) => void;
  trailColor: string;
}

export default function TrailSidebar({ trails, open, onToggle, onSelect, trailColor }: TrailSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = trails.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Sidebar panel */}
      <div
        style={{
          width: open ? 320 : 0,
          minWidth: open ? 320 : 0,
          height: '100%',
          transition: 'width 0.25s ease, min-width 0.25s ease',
          overflow: 'hidden',
          backgroundColor: '#fafaf9',
          borderRight: open ? '1px solid #e7e5e4' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid #e7e5e4',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1c1917', fontFamily: 'system-ui' }}>
              Trails
            </h2>
            <span style={{ fontSize: 12, color: '#78716c', fontFamily: 'system-ui' }}>
              {filtered.length} in view
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8a29e"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trails..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: 13,
                border: '1px solid #d6d3d1',
                borderRadius: 8,
                outline: 'none',
                backgroundColor: '#fff',
                color: '#1c1917',
                fontFamily: 'system-ui',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Trail list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#a8a29e', fontSize: 13, fontFamily: 'system-ui' }}>
              {trails.length === 0 ? 'Zoom in to see trails' : 'No trails match your search'}
            </div>
          )}

          {filtered.map((trail) => (
            <button
              key={trail.id}
              onClick={() => onSelect(trail)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                border: 'none',
                borderBottom: '1px solid #f5f5f4',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontFamily: 'system-ui',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {/* Trail name with colored dot */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: trailColor,
                  marginTop: 5, flexShrink: 0,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#1c1917',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 250,
                  }}>
                    {trail.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {trail.length_miles && (
                      <span style={{ fontSize: 11, color: '#78716c' }}>
                        {trail.length_miles} mi
                      </span>
                    )}
                    {trail.difficulty && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: trail.difficulty === 'easy' ? '#16a34a'
                          : trail.difficulty === 'moderate' ? '#2563eb'
                          : trail.difficulty === 'hard' ? '#d97706'
                          : trail.difficulty === 'expert' ? '#dc2626'
                          : '#78716c',
                      }}>
                        {trail.difficulty}
                      </span>
                    )}
                    {trail.elevation_gain_ft && (
                      <span style={{ fontSize: 11, color: '#78716c' }}>
                        {trail.elevation_gain_ft} ft
                      </span>
                    )}
                    {trail.route_type && (
                      <span style={{ fontSize: 11, color: '#a8a29e', textTransform: 'capitalize' }}>
                        {trail.route_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toggle button (always visible, on the edge) */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: open ? 320 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 20,
          width: 24,
          height: 48,
          backgroundColor: '#fff',
          border: '1px solid #e7e5e4',
          borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
          transition: 'left 0.25s ease',
        }}
        aria-label={open ? 'Close trail list' : 'Open trail list'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            <polyline points="15 18 9 12 15 6" />
          ) : (
            <polyline points="9 18 15 12 9 6" />
          )}
        </svg>
      </button>
    </>
  );
}
