'use client';

import { useState } from 'react';
import { NATIONAL_PARKS } from '@/data/nationalParks';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { date: string; trailName: string; miles: number; parkId?: string; notes?: string }) => void;
}

export default function HikeLogModal({ open, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trailName, setTrailName] = useState('');
  const [miles, setMiles] = useState('');
  const [parkId, setParkId] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseFloat(miles);
    if (!trailName.trim() || !Number.isFinite(m) || m <= 0) return;
    onSubmit({
      date,
      trailName: trailName.trim(),
      miles: m,
      parkId: parkId || undefined,
      notes: notes.trim() || undefined,
    });
    // Reset
    setTrailName('');
    setMiles('');
    setParkId('');
    setNotes('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Log a Hike</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Trail Name</label>
            <input
              type="text"
              value={trailName}
              onChange={(e) => setTrailName(e.target.value)}
              placeholder="e.g. Half Dome"
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Miles</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">National Park (optional)</label>
            <select
              value={parkId}
              onChange={(e) => setParkId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— None —</option>
              {NATIONAL_PARKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name} ({p.state})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
            >
              Log Hike
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
