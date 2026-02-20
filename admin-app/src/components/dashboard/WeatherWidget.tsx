import { useState, useEffect } from 'react';

interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
}

const CACHE_KEY = 'hthd_weather_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function getCachedWeather(): WeatherData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_DURATION_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data as WeatherData;
  } catch {
    return null;
  }
}

function setCachedWeather(data: WeatherData): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  const zipCode = import.meta.env.VITE_WEATHER_ZIP || '80202';

  useEffect(() => {
    if (!apiKey) {
      setIsLoading(false);
      return;
    }

    const cached = getCachedWeather();
    if (cached) {
      setWeather(cached);
      setIsLoading(false);
      return;
    }

    fetch(
      `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},us&appid=${apiKey}&units=imperial`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.main && data.weather?.[0]) {
          const weatherData: WeatherData = {
            temp: Math.round(data.main.temp),
            condition: data.weather[0].main,
            icon: data.weather[0].icon,
          };
          setWeather(weatherData);
          setCachedWeather(weatherData);
        }
      })
      .catch(() => {
        // Silently fail - weather is non-critical
      })
      .finally(() => setIsLoading(false));
  }, [apiKey, zipCode]);

  // Don't render if no API key or failed to load
  if (!apiKey || (!isLoading && !weather)) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F8F6F3] animate-pulse">
        <div className="w-8 h-8 bg-gray-200 rounded" />
        <div className="w-12 h-4 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F8F6F3] border border-gray-100">
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
        alt={weather.condition}
        className="w-8 h-8"
      />
      <div>
        <p className="text-sm font-semibold text-[#1B365D] leading-tight">{weather.temp}&deg;F</p>
        <p className="text-[10px] text-gray-400 leading-tight">{weather.condition}</p>
      </div>
    </div>
  );
}
