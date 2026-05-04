'use client';

import type { Badge } from '@/types/awards';

// Tailwind 4 cannot infer dynamic color names — every color used in any badge
// must appear here as a literal string so the JIT picks it up.
// (Synced with the `color` field in src/data/badges.ts and nationalParks.ts.)
const COLOR_MAP: Record<string, { bg: string; ring: string; text: string; soft: string; border: string }> = {
  emerald:  { bg: 'bg-emerald-500',  ring: 'ring-emerald-300',  text: 'text-emerald-900',  soft: 'bg-emerald-50',  border: 'border-emerald-300' },
  green:    { bg: 'bg-green-500',    ring: 'ring-green-300',    text: 'text-green-900',    soft: 'bg-green-50',    border: 'border-green-300' },
  lime:     { bg: 'bg-lime-500',     ring: 'ring-lime-300',     text: 'text-lime-900',     soft: 'bg-lime-50',     border: 'border-lime-300' },
  teal:     { bg: 'bg-teal-500',     ring: 'ring-teal-300',     text: 'text-teal-900',     soft: 'bg-teal-50',     border: 'border-teal-300' },
  cyan:     { bg: 'bg-cyan-500',     ring: 'ring-cyan-300',     text: 'text-cyan-900',     soft: 'bg-cyan-50',     border: 'border-cyan-300' },
  sky:      { bg: 'bg-sky-500',      ring: 'ring-sky-300',      text: 'text-sky-900',      soft: 'bg-sky-50',      border: 'border-sky-300' },
  blue:     { bg: 'bg-blue-500',     ring: 'ring-blue-300',     text: 'text-blue-900',     soft: 'bg-blue-50',     border: 'border-blue-300' },
  indigo:   { bg: 'bg-indigo-500',   ring: 'ring-indigo-300',   text: 'text-indigo-900',   soft: 'bg-indigo-50',   border: 'border-indigo-300' },
  violet:   { bg: 'bg-violet-500',   ring: 'ring-violet-300',   text: 'text-violet-900',   soft: 'bg-violet-50',   border: 'border-violet-300' },
  rose:     { bg: 'bg-rose-500',     ring: 'ring-rose-300',     text: 'text-rose-900',     soft: 'bg-rose-50',     border: 'border-rose-300' },
  red:      { bg: 'bg-red-500',      ring: 'ring-red-300',      text: 'text-red-900',      soft: 'bg-red-50',      border: 'border-red-300' },
  orange:   { bg: 'bg-orange-500',   ring: 'ring-orange-300',   text: 'text-orange-900',   soft: 'bg-orange-50',   border: 'border-orange-300' },
  amber:    { bg: 'bg-amber-500',    ring: 'ring-amber-300',    text: 'text-amber-900',    soft: 'bg-amber-50',    border: 'border-amber-300' },
  yellow:   { bg: 'bg-yellow-400',   ring: 'ring-yellow-300',   text: 'text-yellow-900',   soft: 'bg-yellow-50',   border: 'border-yellow-300' },
  stone:    { bg: 'bg-stone-500',    ring: 'ring-stone-300',    text: 'text-stone-900',    soft: 'bg-stone-50',    border: 'border-stone-300' },
  slate:    { bg: 'bg-slate-500',    ring: 'ring-slate-300',    text: 'text-slate-900',    soft: 'bg-slate-50',    border: 'border-slate-300' },
};

interface Props {
  badge: Badge;
  unlocked: boolean;
  unlockedAt?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function BadgeSticker({ badge, unlocked, unlockedAt, onClick, size = 'md' }: Props) {
  const colors = COLOR_MAP[badge.color] ?? COLOR_MAP.stone;

  const sizeClasses = {
    sm: 'w-20 h-20 text-2xl',
    md: 'w-28 h-28 text-4xl',
    lg: 'w-36 h-36 text-5xl',
  }[size];

  const labelClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  // Shape decoration: shield/star get clip-paths via inline style
  const shapeStyle: React.CSSProperties = {};
  let shapeRadius = 'rounded-full';
  if (badge.shape === 'shield') {
    shapeRadius = '';
    shapeStyle.clipPath = 'polygon(50% 0%, 100% 18%, 100% 65%, 50% 100%, 0% 65%, 0% 18%)';
  } else if (badge.shape === 'star') {
    shapeRadius = '';
    shapeStyle.clipPath =
      'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
  } else if (badge.shape === 'medal') {
    shapeRadius = 'rounded-full';
  } else {
    // patch — slightly bumpy circle via radial gradient + ring
    shapeRadius = 'rounded-full';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${badge.name} — ${badge.description}${unlocked && unlockedAt ? `\nEarned ${new Date(unlockedAt).toLocaleDateString()}` : ''}`}
      className={`group flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : 'cursor-default'} transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-stone-400 rounded-lg p-1`}
    >
      <div
        className={`relative flex items-center justify-center ${sizeClasses} ${shapeRadius} ${
          unlocked
            ? `${colors.bg} ${colors.ring} ring-4 ring-offset-2 ring-offset-white shadow-md`
            : 'bg-stone-200 ring-2 ring-stone-300 ring-offset-2 ring-offset-white grayscale'
        }`}
        style={shapeStyle}
      >
        <span className={unlocked ? 'drop-shadow-sm' : 'opacity-40'}>{badge.emoji}</span>
        {unlocked && badge.shape === 'patch' && (
          <span className="absolute inset-1 rounded-full ring-1 ring-white/40 pointer-events-none" />
        )}
        {!unlocked && (
          <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 ring-1 ring-stone-300 text-xs leading-none">
            🔒
          </span>
        )}
      </div>
      <span
        className={`${labelClasses} font-medium text-center leading-tight max-w-[8rem] line-clamp-2 ${
          unlocked ? 'text-stone-900' : 'text-stone-400'
        }`}
      >
        {badge.name}
      </span>
    </button>
  );
}
