// Awards & Badges types

export type BadgeCategory = 'park' | 'mileage' | 'collector' | 'activity' | 'special';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  // Visual config
  emoji: string;        // Center icon
  color: string;        // Primary color (tailwind name e.g. 'emerald')
  shape: 'patch' | 'medal' | 'shield' | 'star';
  // Unlock criteria (interpreted client-side)
  requirement: BadgeRequirement;
}

export type BadgeRequirement =
  | { type: 'park_visit'; parkId: string }
  | { type: 'park_count'; count: number }
  | { type: 'miles_hiked'; miles: number }
  | { type: 'activity'; activity: string; count?: number }
  | { type: 'special'; key: string };

export interface NationalPark {
  id: string;
  name: string;
  state: string;
  established: number;
  emoji: string;
  color: string;        // Tailwind color name
}

export interface HikeLog {
  id: string;
  date: string;          // ISO
  trailName: string;
  miles: number;
  parkId?: string;       // If hike was in a national park
  notes?: string;
}

export interface AwardsState {
  hikes: HikeLog[];
  visitedParks: string[];   // park ids
  activities: Record<string, number>;  // activity -> count
  specialFlags: string[];
  unlockedBadges: string[]; // badge ids that have been unlocked (with timestamps in unlockTimes)
  unlockTimes: Record<string, string>; // badge id -> ISO date
}

export const DEFAULT_AWARDS_STATE: AwardsState = {
  hikes: [],
  visitedParks: [],
  activities: {},
  specialFlags: [],
  unlockedBadges: [],
  unlockTimes: {},
};
