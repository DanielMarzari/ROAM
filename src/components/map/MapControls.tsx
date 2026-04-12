'use client';

import { useState } from 'react';
import type { BasemapStyle, FilterState } from '@/types/map';

interface MapControlsProps {
  basemap: BasemapStyle;
  showSatellite: boolean;
  showTrails: boolean;
  showContours: boolean;
  showBasemapPaths: boolean;
  filters: FilterState;
  onBasemapChange: (style: BasemapStyle) => void;
  onSatelliteToggle: (visible: boolean) => void;
  onTrailToggle: (visible: boolean) => void;
  onContourToggle: (visible: boolean) => void;
  onBasemapPathsToggle: (visible: boolean) => void;
  onFilterChange: (key: keyof FilterState, value: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

const BASEMAP_OPTIONS: { value: BasemapStyle; label: string }[] = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'topo', label: 'Topo' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const FILTER_GROUPS: { label: string; filters: { key: keyof FilterState; label: string }[] }[] = [
  {
    label: 'Protected Areas',
    filters: [
      { key: 'nationalParks', label: 'National Parks' },
      { key: 'nationalForests', label: 'National Forests' },
      { key: 'stateParks', label: 'State Parks' },
      { key: 'monuments', label: 'Monuments' },
      { key: 'conservation', label: 'Conservation Areas' },
    ],
  },
  {
    label: 'Boundaries',
    filters: [
      { key: 'tribalLands', label: 'Tribal Lands' },
    ],
  },
  {
    label: 'Activities',
    filters: [
      { key: 'climbing', label: 'Rock Climbing' },
      { key: 'caves', label: 'Caves' },
      { key: 'camping', label: 'Camping' },
      { key: 'viaFerrata', label: 'Via Ferrata' },
      { key: 'offroad', label: 'Off-Roading' },
      { key: 'kayaking', label: 'Kayaking' },
      { key: 'fishing', label: 'Fishing' },
    ],
  },
  {
    label: 'Overlays',
    filters: [
      { key: 'darkSky', label: 'Dark Sky Areas' },
    ],
  },
];

const btnBase: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
  transition: 'background-color 0.15s, box-shadow 0.15s',
  padding: 0,
  color: '#57534e',
};

export default function MapControls({
  basemap,
  showSatellite,
  showTrails,
  showContours,
  showBasemapPaths,
  filters,
  onBasemapChange,
  onSatelliteToggle,
  onTrailToggle,
  onContourToggle,
  onBasemapPathsToggle,
  onFilterChange,
  onZoomIn,
  onZoomOut,
  onLocate,
}: MapControlsProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'center',
    }}>
      {/* Layers button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => { setLayersOpen(!layersOpen); setFiltersOpen(false); }}
          style={{
            ...btnBase,
            backgroundColor: layersOpen ? '#16a34a' : '#fff',
            color: layersOpen ? '#fff' : '#57534e',
          }}
          aria-label="Toggle map layers"
          onMouseEnter={(e) => {
            if (!layersOpen) e.currentTarget.style.backgroundColor = '#f5f5f4';
          }}
          onMouseLeave={(e) => {
            if (!layersOpen) e.currentTarget.style.backgroundColor = '#fff';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>

        {/* Layers popover */}
        {layersOpen && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 58,
            backgroundColor: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: 16,
            width: 210,
            fontFamily: 'system-ui',
          }}>
            {/* Basemap selection */}
            <p style={{
              fontSize: 10, fontWeight: 700, color: '#a8a29e',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              margin: '0 0 8px',
            }}>
              Base Map
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              {BASEMAP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onBasemapChange(opt.value)}
                  style={{
                    fontSize: 12,
                    padding: '7px 0',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'system-ui',
                    fontWeight: basemap === opt.value ? 600 : 400,
                    backgroundColor: basemap === opt.value ? '#16a34a' : '#f5f5f4',
                    color: basemap === opt.value ? '#fff' : '#44403c',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (basemap !== opt.value) e.currentTarget.style.backgroundColor = '#e7e5e4';
                  }}
                  onMouseLeave={(e) => {
                    if (basemap !== opt.value) e.currentTarget.style.backgroundColor = '#f5f5f4';
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Overlay toggles */}
            <p style={{
              fontSize: 10, fontWeight: 700, color: '#a8a29e',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              margin: '0 0 8px',
            }}>
              Overlays
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => onTrailToggle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span style={{ fontSize: 13, color: '#44403c' }}>Trails</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showBasemapPaths}
                onChange={(e) => onBasemapPathsToggle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span style={{ fontSize: 13, color: '#44403c' }}>Basemap Paths</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showContours}
                onChange={(e) => onContourToggle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span style={{ fontSize: 13, color: '#44403c' }}>Contours</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSatellite}
                onChange={(e) => onSatelliteToggle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#16a34a' }}
              />
              <span style={{ fontSize: 13, color: '#44403c' }}>Satellite</span>
            </label>
          </div>
        )}
      </div>

      {/* Filter button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => { setFiltersOpen(!filtersOpen); setLayersOpen(false); }}
          style={{
            ...btnBase,
            backgroundColor: filtersOpen ? '#16a34a' : '#fff',
            color: filtersOpen ? '#fff' : '#57534e',
          }}
          aria-label="Toggle map filters"
          onMouseEnter={(e) => {
            if (!filtersOpen) e.currentTarget.style.backgroundColor = '#f5f5f4';
          }}
          onMouseLeave={(e) => {
            if (!filtersOpen) e.currentTarget.style.backgroundColor = '#fff';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {activeFilterCount > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              backgroundColor: '#16a34a', color: '#fff',
              width: 18, height: 18, borderRadius: '50%',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {activeFilterCount}
            </div>
          )}
        </button>

        {/* Filters popover */}
        {filtersOpen && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 58,
            backgroundColor: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: 16,
            width: 220,
            fontFamily: 'system-ui',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
          }}>
            {FILTER_GROUPS.map((group, gi) => (
              <div key={group.label} style={{ marginBottom: gi < FILTER_GROUPS.length - 1 ? 12 : 0 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, color: '#a8a29e',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  margin: '0 0 6px',
                }}>
                  {group.label}
                </p>
                {group.filters.map((f) => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filters[f.key]}
                      onChange={(e) => onFilterChange(f.key, e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#16a34a' }}
                    />
                    <span style={{ fontSize: 13, color: '#44403c' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 20, height: 1, backgroundColor: '#d6d3d1' }} />

      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        style={btnBase}
        aria-label="Zoom in"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        style={btnBase}
        aria-label="Zoom out"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Divider */}
      <div style={{ width: 20, height: 1, backgroundColor: '#d6d3d1' }} />

      {/* Locate me */}
      <button
        onClick={onLocate}
        style={btnBase}
        aria-label="Center on my location"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </button>
    </div>
  );
}
