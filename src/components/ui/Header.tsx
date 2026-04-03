'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Explore' },
  { href: '/trails', label: 'Trails' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-stone-200 px-4 h-14 flex items-center justify-between shrink-0 z-20">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl font-bold text-green-700 tracking-tight">ROAM</span>
        <span className="hidden sm:inline text-xs text-stone-400 mt-0.5">Routes · Outdoors · Adventure · Maps</span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-green-50 text-green-700'
                : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
