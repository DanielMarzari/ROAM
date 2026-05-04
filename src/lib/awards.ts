// Client-side awards state — persisted in localStorage.
// Single-password app: no per-user accounts, so we keep state in the browser.

import type { AwardsState, Badge, HikeLog } from '@/types/awards';
import { DEFAULT_AWARDS_STATE } from '@/types/awards';
import { ALL_BADGES } from '@/data/badges';

const STORAGE_KEY = 'roam:awards:v1';

export function loadAwardsState(): AwardsState {
  if (typeof window === 'undefined') return DEFAULT_AWARDS_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AWARDS_STATE;
    const parsed = JSON.parse(raw) as Partial<AwardsState>;
    return { ...DEFAULT_AWARDS_STATE, ...parsed };
  } catch {
    return DEFAULT_AWARDS_STATE;
  }
}

export function saveAwardsState(state: AwardsState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function totalMiles(state: AwardsState): number {
  return state.hikes.reduce((sum, h) => sum + (h.miles || 0), 0);
}

export function isBadgeUnlocked(badge: Badge, state: AwardsState): boolean {
  const req = badge.requirement;
  switch (req.type) {
    case 'park_visit':
      return state.visitedParks.includes(req.parkId);
    case 'park_count':
      return state.visitedParks.length >= req.count;
    case 'miles_hiked':
      return totalMiles(state) >= req.miles;
    case 'activity':
      return (state.activities[req.activity] || 0) >= (req.count || 1);
    case 'special':
      return state.specialFlags.includes(req.key);
  }
}

/** Returns badges newly unlocked since `prev` state. */
export function newlyUnlocked(prev: AwardsState, next: AwardsState): Badge[] {
  return ALL_BADGES.filter(
    (b) => !isBadgeUnlocked(b, prev) && isBadgeUnlocked(b, next),
  );
}

/** Recompute special flags from hikes / activities, then merge. */
export function recomputeFlags(state: AwardsState): AwardsState {
  const flags = new Set(state.specialFlags);

  // big single hike
  if (state.hikes.some((h) => h.miles >= 20)) flags.add('long_single_hike');

  // all activities
  const requiredActivities = ['climbing', 'cave', 'camping', 'via_ferrata', 'offroad', 'kayak', 'fishing'];
  if (requiredActivities.every((a) => (state.activities[a] || 0) > 0)) {
    flags.add('all_activities');
  }

  return { ...state, specialFlags: Array.from(flags) };
}

/** Add a hike, update flags, and return the new state. */
export function logHike(state: AwardsState, hike: Omit<HikeLog, 'id'>): AwardsState {
  const id = `hike-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newHike: HikeLog = { id, ...hike };
  const next: AwardsState = {
    ...state,
    hikes: [...state.hikes, newHike],
    visitedParks: hike.parkId && !state.visitedParks.includes(hike.parkId)
      ? [...state.visitedParks, hike.parkId]
      : state.visitedParks,
  };
  return syncUnlockedBadges(recomputeFlags(next));
}

/** Toggle a park as visited (without adding a hike). */
export function toggleParkVisited(state: AwardsState, parkId: string): AwardsState {
  const has = state.visitedParks.includes(parkId);
  const visitedParks = has
    ? state.visitedParks.filter((p) => p !== parkId)
    : [...state.visitedParks, parkId];
  return syncUnlockedBadges(recomputeFlags({ ...state, visitedParks }));
}

/** Increment an activity counter by 1. */
export function logActivity(state: AwardsState, activity: string): AwardsState {
  const activities = { ...state.activities, [activity]: (state.activities[activity] || 0) + 1 };
  return syncUnlockedBadges(recomputeFlags({ ...state, activities }));
}

/** Toggle a special flag (e.g. dark sky visit). */
export function toggleSpecialFlag(state: AwardsState, key: string): AwardsState {
  const has = state.specialFlags.includes(key);
  const specialFlags = has
    ? state.specialFlags.filter((f) => f !== key)
    : [...state.specialFlags, key];
  return syncUnlockedBadges({ ...state, specialFlags });
}

/** Remove a hike by id. */
export function removeHike(state: AwardsState, hikeId: string): AwardsState {
  const next = { ...state, hikes: state.hikes.filter((h) => h.id !== hikeId) };
  return syncUnlockedBadges(recomputeFlags(next));
}

/** After any state mutation, refresh the unlockedBadges list and stamp times. */
export function syncUnlockedBadges(state: AwardsState): AwardsState {
  const unlockTimes = { ...state.unlockTimes };
  const unlockedBadges: string[] = [];
  const now = new Date().toISOString();
  for (const b of ALL_BADGES) {
    if (isBadgeUnlocked(b, state)) {
      unlockedBadges.push(b.id);
      if (!unlockTimes[b.id]) unlockTimes[b.id] = now;
    }
  }
  return { ...state, unlockedBadges, unlockTimes };
}

export function resetAwards(): AwardsState {
  saveAwardsState(DEFAULT_AWARDS_STATE);
  return DEFAULT_AWARDS_STATE;
}
