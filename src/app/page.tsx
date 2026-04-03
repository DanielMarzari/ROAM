'use client';

import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f5f5f4',
    }}>
      <p style={{ fontSize: 14, color: '#78716c' }}>Loading map...</p>
    </div>
  ),
});

export default function HomePage() {
  return <MapContainer />;
}
