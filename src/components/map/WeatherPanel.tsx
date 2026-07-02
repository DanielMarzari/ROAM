'use client';

import { useEffect, useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  onClose: () => void;
  showPrecip: boolean;
  onPrecipToggle: (v: boolean) => void;
}

interface Forecast {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    is_day: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
  };
  hourly?: {
    time: string[];
    us_aqi?: number[];
  };
}

// WMO weather codes → emoji + label. See open-meteo docs.
const WMO: Record<number, [string, string]> = {
  0: ['☀️', 'Clear'],
  1: ['🌤️', 'Mainly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌦️', 'Dense drizzle'],
  61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
  77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Rain showers'], 81: ['🌧️', 'Rain showers'], 82: ['⛈️', 'Violent rain'],
  85: ['🌨️', 'Snow showers'], 86: ['❄️', 'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunder + hail'], 99: ['⛈️', 'Severe thunder'],
};

function wmo(code: number): [string, string] {
  return WMO[code] || ['❔', `Code ${code}`];
}

function aqiLabel(v?: number): { label: string; color: string } {
  if (v == null) return { label: '—', color: '#9ca3af' };
  if (v <= 50) return { label: 'Good', color: '#16a34a' };
  if (v <= 100) return { label: 'Moderate', color: '#eab308' };
  if (v <= 150) return { label: 'Unhealthy (sensitive)', color: '#f97316' };
  if (v <= 200) return { label: 'Unhealthy', color: '#dc2626' };
  if (v <= 300) return { label: 'Very unhealthy', color: '#9333ea' };
  return { label: 'Hazardous', color: '#7f1d1d' };
}

export default function WeatherPanel({ lat, lng, onClose, showPrecip, onPrecipToggle }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const where = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;

  useEffect(() => {
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lng.toFixed(3),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      forecast_days: '5',
    });
    const aqiParams = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lng.toFixed(3),
      current: 'us_aqi',
      timezone: 'auto',
    });
    Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params}`).then((r) => r.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqiParams}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([wx, air]) => {
        setForecast(wx as Forecast);
        setAqi(air?.current?.us_aqi ?? null);
      })
      .catch((e) => setErr(e?.message || 'Weather fetch failed'))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  return (
    <div style={{
      position: 'absolute',
      top: 68, right: 12,
      width: 300,
      backgroundColor: '#fff',
      border: '1px solid #d6d3d1',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      padding: 14,
      zIndex: 15,
      fontFamily: 'system-ui',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1c1917' }}>Weather</h3>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', padding: 4,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#78716c', marginBottom: 8 }}>Map center · {where}</div>

      {loading && <div style={{ fontSize: 13, color: '#78716c', padding: '12px 0' }}>Loading…</div>}
      {err && <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 0' }}>{err}</div>}

      {forecast && (
        <>
          {/* Current */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f4' }}>
            <span style={{ fontSize: 36 }}>{wmo(forecast.current.weather_code)[0]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1c1917' }}>{Math.round(forecast.current.temperature_2m)}°F</div>
              <div style={{ fontSize: 11, color: '#57534e' }}>Feels {Math.round(forecast.current.apparent_temperature)}° · {wmo(forecast.current.weather_code)[1]}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#57534e', padding: '6px 0' }}>
            <span>💨 {Math.round(forecast.current.wind_speed_10m)} mph</span>
            <span>💧 {forecast.current.relative_humidity_2m}%</span>
            <span style={{ color: aqiLabel(aqi ?? undefined).color, fontWeight: 600 }}>
              AQI {aqi ?? '—'}
            </span>
          </div>
          {aqi != null && (
            <div style={{ fontSize: 10, color: aqiLabel(aqi).color, marginBottom: 8 }}>{aqiLabel(aqi).label}</div>
          )}

          {/* 5-day */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#78716c', fontWeight: 600, marginBottom: 4 }}>5-day forecast</div>
            {forecast.daily.time.map((day, i) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{ width: 38, color: '#57534e' }}>
                  {new Date(day).toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span style={{ fontSize: 18, width: 24 }}>{wmo(forecast.daily.weather_code[i])[0]}</span>
                <span style={{ flex: 1, fontSize: 11, color: '#78716c' }}>
                  {forecast.daily.precipitation_probability_max[i] > 0 && `${forecast.daily.precipitation_probability_max[i]}%`}
                </span>
                <span style={{ color: '#1c1917' }}>
                  <b>{Math.round(forecast.daily.temperature_2m_max[i])}°</b>
                  <span style={{ color: '#a8a29e', marginLeft: 4 }}>{Math.round(forecast.daily.temperature_2m_min[i])}°</span>
                </span>
              </div>
            ))}
          </div>

          {/* Radar toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 0 0', borderTop: '1px solid #f5f5f4', cursor: 'pointer', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showPrecip}
              onChange={(e) => onPrecipToggle(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: '#1c1917' }}>Show precipitation radar</span>
          </label>
        </>
      )}
    </div>
  );
}
