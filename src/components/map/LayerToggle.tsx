'use client';

import { useState } from 'react';
import type { BasemapStyle } from '@/types/map';
import { TRAIL_COLOR_PRESETS } from '@/lib/maps/config';

interface LayerToggleProps {
  basemap: BasemapStyle;
  showSatellite: boolean;
  showTrails: boolean;
  trailColor: string;
  onBasemapChange: (style: BasemapStyle) => void;
  onSatelliteToggle: (visible: boolean) => void;
  onTrailToggle: (visible: boolean) => void;
  onTrailColorChange: (color: string) => void;
}

const BASEMAP_OPTIONS: { value: BasemapStyle; label: string; icon: string }[] = [
  { value: 'outdoor', label: 'Outdoor', icon: '🏔' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'topo', label: 'Topo', icon: '📐' },
];

export default function LayerToggle({
  basemap,
  showSatellite,
  showTrails,
  trailColor,
  onBasemapChange,
  onSatelliteToggle,
  onTrailToggle,
  onTrailColorChange,
}: LayerToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 left-3 z-10">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-2"
        aria-label="Toggle map layers"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        Layers
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-lg shadow-lg p-4 w-56">
          {/* Basemap selection */}
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Base Map</p>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {BASEMAP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onBasemapChange(opt.value)}
                className={`text-xs px-2.5 py-2 rounded-md transition-colors ${
                  basemap === opt.value
                    ? 'bg-green-600 text-white font-medium'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          {/* Overlay toggles */}
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Overlays</p>
          <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => onTrailToggle(e.target.checked)}
              className="w-4 h-4 rounded accent-green-600"
            />
            <span className="text-sm text-stone-700">Trails</span>
          </label>
          <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSatellite}
              onChange={(e) => onSatelliteToggle(e.target.checked)}
              className="w-4 h-4 rounded accent-green-600"
            />
            <span className="text-sm text-stone-700">Satellite</span>
          </label>

          {/* Trail color picker */}
          {showTrails && (
            <div className="mt-3 pt-3 border-t border-stone-200">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Trail Color</p>
              <div className="flex flex-wrap gap-1.5">
                {TRAIL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => onTrailColorChange(preset.color)}
                    title={preset.name}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                    style={{
                      backgroundColor: preset.color,
                      border: preset.color === '#ffffff' ? '2px solid #d6d3d1' : '2px solid transparent',
                      boxShadow: trailColor === preset.color ? '0 0 0 2px #16a34a' : 'none',
                      outline: trailColor === preset.color ? '2px solid #16a34a' : 'none',
                      outlineOffset: '1px',
                    }}
                  >
                    {trailColor === preset.color && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={preset.color === '#ffffff' ? '#333' : '#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
