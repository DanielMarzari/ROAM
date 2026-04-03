'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Trail, Difficulty } from '@/types/trail';

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-blue-100 text-blue-700' },
  { value: 'hard', label: 'Hard', color: 'bg-amber-100 text-amber-700' },
  { value: 'expert', label: 'Expert', color: 'bg-red-100 text-red-700' },
];

export default function TrailsPage() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);

  const fetchTrails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (selectedDifficulties.length) params.set('difficulty', selectedDifficulties.join(','));

    try {
      const res = await fetch(`/api/trails?${params.toString()}`);
      const data = await res.json();
      setTrails(data.trails || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch trails:', err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedDifficulties]);

  useEffect(() => {
    const timer = setTimeout(fetchTrails, 300);
    return () => clearTimeout(timer);
  }, [fetchTrails]);

  const toggleDifficulty = (d: Difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Explore Trails</h1>
      <p className="text-stone-500 mb-6">Discover hiking trails across the United States</p>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search trails by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Difficulty filters */}
      <div className="flex gap-2 mb-6">
        {DIFFICULTY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleDifficulty(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedDifficulties.includes(opt.value)
                ? opt.color
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-sm text-stone-400 mb-4">
        {loading ? 'Searching...' : `${total} trail${total !== 1 ? 's' : ''} found`}
      </p>

      {/* Trail list */}
      <div className="space-y-3">
        {trails.map((trail) => (
          <div
            key={trail.id}
            className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-stone-900">{trail.name}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
                  {trail.difficulty && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      DIFFICULTY_OPTIONS.find((d) => d.value === trail.difficulty)?.color || ''
                    }`}>
                      {trail.difficulty}
                    </span>
                  )}
                  {trail.length_miles && <span>{trail.length_miles} mi</span>}
                  {trail.elevation_gain_ft && <span>{trail.elevation_gain_ft} ft gain</span>}
                  {trail.route_type && (
                    <span className="capitalize">{trail.route_type.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </div>
              {trail.state && (
                <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded">
                  {trail.state}
                </span>
              )}
            </div>
            {trail.description && (
              <p className="mt-2 text-sm text-stone-600 line-clamp-2">{trail.description}</p>
            )}
          </div>
        ))}

        {!loading && trails.length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg mb-1">No trails found</p>
            <p className="text-sm">Try adjusting your search or filters. Trail data is loaded from the Explore map.</p>
          </div>
        )}
      </div>
    </div>
  );
}
