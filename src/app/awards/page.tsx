'use client';

import { useEffect, useMemo, useState } from 'react';
import BadgeSticker from '@/components/awards/BadgeSticker';
import HikeLogModal from '@/components/awards/HikeLogModal';
import { ALL_BADGES, BADGES_BY_CATEGORY, CATEGORY_INFO } from '@/data/badges';
import { NATIONAL_PARKS } from '@/data/nationalParks';
import {
  loadAwardsState,
  saveAwardsState,
  totalMiles,
  isBadgeUnlocked,
  logHike,
  toggleParkVisited,
  logActivity,
  toggleSpecialFlag,
  removeHike,
  resetAwards,
  newlyUnlocked,
} from '@/lib/awards';
import type { AwardsState, Badge } from '@/types/awards';
import { DEFAULT_AWARDS_STATE } from '@/types/awards';

type Filter = 'all' | 'unlocked' | 'locked';

const ACTIVITY_KEYS: { key: string; label: string; emoji: string }[] = [
  { key: 'climbing',    label: 'Climbing',    emoji: '🧗' },
  { key: 'cave',        label: 'Caving',      emoji: '🦇' },
  { key: 'camping',     label: 'Camping',     emoji: '⛺' },
  { key: 'via_ferrata', label: 'Via Ferrata', emoji: '🪜' },
  { key: 'offroad',     label: 'Off-roading', emoji: '🚙' },
  { key: 'kayak',       label: 'Kayaking',    emoji: '🛶' },
  { key: 'fishing',     label: 'Fishing',     emoji: '🎣' },
];

const SPECIAL_FLAGS: { key: string; label: string; emoji: string }[] = [
  { key: 'dark_sky_visit',    label: 'Dark Sky visit',  emoji: '🌌' },
  { key: 'tribal_land_visit', label: 'Tribal Lands visit', emoji: '🪶' },
  { key: 'big_elevation',     label: '5,000+ ft hike',  emoji: '🏔️' },
];

export default function AwardsPage() {
  const [state, setState] = useState<AwardsState>(DEFAULT_AWARDS_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('park');
  const [showHikeModal, setShowHikeModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setState(loadAwardsState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveAwardsState(state);
  }, [state, hydrated]);

  const apply = (next: AwardsState) => {
    const fresh = newlyUnlocked(state, next);
    setState(next);
    if (fresh.length) {
      setToast(`🎉 Unlocked: ${fresh.map((b) => b.name).join(', ')}`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const unlockedSet = useMemo(() => new Set(state.unlockedBadges), [state.unlockedBadges]);
  const miles = totalMiles(state);
  const unlockedCount = ALL_BADGES.filter((b) => isBadgeUnlocked(b, state)).length;

  const filteredBadges = (badges: Badge[]) =>
    badges.filter((b) => {
      const u = unlockedSet.has(b.id);
      if (filter === 'unlocked') return u;
      if (filter === 'locked') return !u;
      return true;
    });

  const sectionBadges = BADGES_BY_CATEGORY[activeCategory as keyof typeof BADGES_BY_CATEGORY] || [];
  const visible = filteredBadges(sectionBadges);

  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Awards & Patches</h1>
          <p className="text-stone-600 mt-1">
            Collect patches for the parks you visit and earn medals as your trail miles add up.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Badges Earned" value={`${unlockedCount} / ${ALL_BADGES.length}`} />
          <StatCard label="Total Miles" value={miles.toFixed(1)} />
          <StatCard label="Hikes Logged" value={state.hikes.length.toString()} />
          <StatCard label="Parks Visited" value={`${state.visitedParks.length} / 63`} />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setShowHikeModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm"
          >
            + Log a Hike
          </button>
          <button
            onClick={() => {
              if (confirm('Reset all badges and hikes? This cannot be undone.')) {
                setState(resetAwards());
              }
            }}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-md border border-stone-300"
          >
            Reset Progress
          </button>
        </div>

        {/* Activity quick-log */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-stone-900 mb-2">Quick Log Activities</h3>
          <p className="text-xs text-stone-500 mb-3">Tap to add one. Counter shows total logged.</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_KEYS.map((a) => (
              <button
                key={a.key}
                onClick={() => apply(logActivity(state, a.key))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-sm"
              >
                <span>{a.emoji}</span>
                <span>{a.label}</span>
                <span className="text-xs font-mono text-stone-500 ml-1">
                  ×{state.activities[a.key] || 0}
                </span>
              </button>
            ))}
            {SPECIAL_FLAGS.map((f) => {
              const has = state.specialFlags.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => apply(toggleSpecialFlag(state, f.key))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    has ? 'bg-green-100 text-green-800' : 'bg-stone-100 hover:bg-stone-200'
                  }`}
                >
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                  {has && <span className="text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 border-b border-stone-200 mb-4">
          {Object.keys(CATEGORY_INFO).map((key) => {
            const info = CATEGORY_INFO[key];
            const total = (BADGES_BY_CATEGORY[key as keyof typeof BADGES_BY_CATEGORY] || []).length;
            const earned = (BADGES_BY_CATEGORY[key as keyof typeof BADGES_BY_CATEGORY] || []).filter(
              (b) => unlockedSet.has(b.id),
            ).length;
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
              >
                {info.label}{' '}
                <span className="text-xs text-stone-400">
                  ({earned}/{total})
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter chips */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-stone-600">{CATEGORY_INFO[activeCategory]?.description}</p>
          <div className="flex gap-1">
            {(['all', 'unlocked', 'locked'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full ${
                  filter === f
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Badge grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 mb-12">
          {visible.map((badge) => (
            <BadgeSticker
              key={badge.id}
              badge={badge}
              unlocked={unlockedSet.has(badge.id)}
              unlockedAt={state.unlockTimes[badge.id]}
              onClick={() => {
                if (badge.requirement.type === 'park_visit') {
                  apply(toggleParkVisited(state, badge.requirement.parkId));
                }
              }}
            />
          ))}
          {visible.length === 0 && (
            <p className="col-span-full text-center text-stone-400 py-12 text-sm">
              No badges to show with the current filter.
            </p>
          )}
        </div>

        {activeCategory === 'park' && (
          <p className="text-xs text-stone-500 -mt-8 mb-8">
            Tip: tap any park patch to mark it visited (or unmark). Logging a hike with a park selected
            does the same automatically.
          </p>
        )}

        {/* Hike log */}
        {state.hikes.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <h3 className="text-sm font-semibold text-stone-900 px-4 py-3 border-b border-stone-200">
              Hike Journal
            </h3>
            <ul className="divide-y divide-stone-100">
              {[...state.hikes]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((h) => {
                  const park = NATIONAL_PARKS.find((p) => p.id === h.parkId);
                  return (
                    <li key={h.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium text-stone-900 truncate">{h.trailName}</p>
                          {park && (
                            <span className="text-xs text-stone-500">
                              {park.emoji} {park.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500">
                          {new Date(h.date).toLocaleDateString()} · {h.miles.toFixed(1)} mi
                          {h.notes ? ` · ${h.notes}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => apply(removeHike(state, h.id))}
                        className="text-xs text-stone-400 hover:text-red-600"
                        title="Remove hike"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toast}
        </div>
      )}

      <HikeLogModal
        open={showHikeModal}
        onClose={() => setShowHikeModal(false)}
        onSubmit={(data) => {
          apply(logHike(state, data));
          setShowHikeModal(false);
        }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-2xl font-bold text-stone-900 mt-0.5">{value}</p>
    </div>
  );
}
