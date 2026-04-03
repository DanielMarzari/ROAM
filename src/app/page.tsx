'use client';

import dynamic from 'next/dynamic';

// MapLibre requires window/document — load client-side only
const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-stone-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Loading map...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return <MapContainer className="w-full h-full" />;
}
