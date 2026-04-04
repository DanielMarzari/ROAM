'use client';

import { useState } from 'react';
import type { TrailItem, TrailGroup } from './MapContainer';

interface TrailSidebarProps {
  groups: TrailGroup[];
  open: boolean;
  onToggle: () => void;
  onTrailSelect: (trail: TrailItem) => void;
  onGroupSelect: (group: TrailGroup) => void;
  trailColor: string;
}

export default function TrailSidebar({ groups, open, onToggle, onTrailSelect, onGroupSelect, trailColor }: TrailSidebarProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Filter groups and trails by search
  const filteredGroups = groups.map((g) => {
    if (!search) return g;
    const q = search.toLowerCase();
    // Match group name or individual trail names
    const matchedTrails = g.trails.filter(
      (t) => t.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
    );
    if (matchedTrails.length === 0) return null;
    return { ...g, trails: matchedTrails, trailCount: matchedTrails.length };
  }).filter(Boolean) as TrailGroup[];

  const totalTrails = filteredGroups.reduce((sum, g) => sum + g.trailCount, 0);

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
              {totalTrails} in view
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

        {/* Trail groups */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filteredGroups.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#a8a29e', fontSize: 13, fontFamily: 'system-ui' }}>
              {groups.length === 0 ? 'Zoom in to see trails' : 'No trails match your search'}
            </div>
          )}

          {filteredGroups.map((group) => {
            const isExpanded = expanded.has(group.name);

            return (
              <div key={group.name} style={{ borderBottom: '1px solid #e7e5e4' }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'system-ui',
                    gap: 8,
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Expand arrow */}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  {/* Color dot */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: trailColor,
                    flexShrink: 0,
                  }} />

                  {/* Group info */}
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: '#1c1917',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {group.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#78716c', marginTop: 1 }}>
                      {group.trailCount} trail{group.trailCount !== 1 ? 's' : ''} · {group.totalMiles} mi total
                    </div>
                  </div>

                  {/* Fly-to button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onGroupSelect(group); }}
                    title="Fly to area"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: '#a8a29e', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#16a34a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#a8a29e'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </button>

                {/* Expanded trail list */}
                {isExpanded && (
                  <div style={{ backgroundColor: '#f5f5f4' }}>
                    {group.trails.map((trail) => (
                      <button
                        key={trail.id}
                        onClick={() => onTrailSelect(trail)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 16px 8px 46px',
                          border: 'none',
                          borderTop: '1px solid #eeeceb',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'system-ui',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eeecea'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div style={{
                          fontSize: 12, fontWeight: 500, color: '#292524',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          maxWidth: 230,
                        }}>
                          {trail.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          {trail.length_miles != null && (
                            <span style={{ fontSize: 10, color: '#78716c' }}>
                              {trail.length_miles} mi
                            </span>
                          )}
                          {trail.difficulty && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
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
                          {trail.elevation_gain_ft != null && (
                            <span style={{ fontSize: 10, color: '#78716c' }}>
                              {trail.elevation_gain_ft} ft
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Toggle button */}
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
