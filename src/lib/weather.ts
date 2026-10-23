import { today, daysFromNow } from "./utils";

export interface WeatherDay {
  day: string;
  date: string;
  temp: number;
  lowTemp: number;
  rainChance: number;
  wind: number;
  humidity: number;
  condition: string;
  description: string;
}

export interface WeatherCurrent {
  temp: number;
  lowTemp: number;
  rainChance: number;
  wind: number;
  humidity: number;
  condition: string;
  description: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherDay[];
}

// ─── Seed / fallback weather ──────────────────────────────────────────────────

export const seedWeather: WeatherData = {
  current: {
    temp: 72,
    lowTemp: 58,
    rainChance: 10,
    wind: 8,
    humidity: 45,
    condition: "clear_sky",
    description: "Clear sky",
  },
  forecast: [
    { day: "Today",    date: today(),           temp: 72, lowTemp: 58, rainChance: 10, wind: 8,  humidity: 45, condition: "clear_sky",       description: "Clear sky"         },
    { day: "Tomorrow", date: daysFromNow(1),    temp: 68, lowTemp: 54, rainChance: 25, wind: 12, humidity: 55, condition: "partly_cloudy",    description: "Partly cloudy"     },
    { day: "Wed",      date: daysFromNow(2),    temp: 61, lowTemp: 49, rainChance: 70, wind: 18, humidity: 80, condition: "rain",             description: "Rain likely"       },
    { day: "Thu",      date: daysFromNow(3),    temp: 55, lowTemp: 42, rainChance: 40, wind: 14, humidity: 65, condition: "overcast_clouds",  description: "Overcast"          },
    { day: "Fri",      date: daysFromNow(4),    temp: 74, lowTemp: 60, rainChance: 5,  wind: 7,  humidity: 40, condition: "clear_sky",       description: "Sunny"             },
    { day: "Sat",      date: daysFromNow(5),    temp: 78, lowTemp: 62, rainChance: 5,  wind: 6,  humidity: 38, condition: "clear_sky",       description: "Perfect wash day"  },
    { day: "Sun",      date: daysFromNow(6),    temp: 65, lowTemp: 51, rainChance: 35, wind: 10, humidity: 60, condition: "few_clouds",      description: "Partly cloudy"     },
  ],
};

// ─── Real OpenWeatherMap fetch ────────────────────────────────────────────────

// FIX 12 — was hardcoded to your area regardless of where the business
// actually operates. fetchRealWeather now takes the location string from
// Settings → Company (a zip code or "City,ST" both work with OWM's `q=`
// param) and only falls back to your area if the owner hasn't set one — a
// deployment now used by owners in other states could silently show the
// original single-tenant demo business's weather. Callers should now pass
// deriveWeatherLocation(settings) instead of settings.weatherLocation
// directly, so an owner who never filled in the dedicated field still gets
// their OWN city (parsed from their company address) rather than PA.
// No default city — weather stays off until the owner sets a location or a
// company address (Settings → Company).
const DEFAULT_WEATHER_LOCATION = "";
const OWM_UNITS = "imperial";

// Best-effort "City,ST" extraction from a free-text street address like
// "123 Main St, your area 17403" — good enough for OWM's `q=` param, which
// only needs a city (state disambiguates same-named cities). Falls through
// to the hardcoded PA default only if there's truly nothing to parse.
export const deriveWeatherLocation = (weatherLocation?: string, companyAddress?: string): string => {
  const explicit = (weatherLocation || "").trim();
  if (explicit) return explicit;
  const addr = (companyAddress || "").trim();
  if (!addr) return DEFAULT_WEATHER_LOCATION;
  const parts = addr.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return DEFAULT_WEATHER_LOCATION;
  // Drop the street (first segment); the city is typically the next one.
  const city = parts[1];
  // The state (+ zip) usually lives in the last segment, e.g. "PA 17403" —
  // strip trailing digits to leave just the state abbreviation/name.
  const stateSeg = parts[parts.length - 1].replace(/\d+/g, "").trim();
  if (!city) return DEFAULT_WEATHER_LOCATION;
  return stateSeg ? `${city},${stateSeg}` : city;
};

interface OWMCurrentResponse {
  main: { temp: number; temp_min: number; humidity: number };
  wind: { speed: number };
  weather: Array<{ main: string; description: string }>;
  pop?: number;
}

interface OWMForecastItem {
  dt: number;
  dt_txt: string;
  main: { temp: number; temp_min: number; humidity: number };
  wind: { speed: number };
  weather: Array<{ main: string; description: string }>;
  pop: number;
}

interface OWMForecastResponse {
  list: OWMForecastItem[];
}

const conditionMap: Record<string, string> = {
  Clear: "clear_sky",
  Clouds: "few_clouds",
  Rain: "rain",
  Drizzle: "rain",
  Thunderstorm: "thunderstorm",
  Snow: "snow",
  Mist: "mist",
  Fog: "fog",
};

const dayLabel = (dt: number): string => {
  const d = new Date(dt * 1000);
  return d.toLocaleDateString("en-US", { weekday: "short" });
};

export const fetchRealWeather = async (apiKey: string, location?: string): Promise<WeatherData> => {
  const base = `https://api.openweathermap.org/data/2.5`;
  const loc = (location || "").trim() || DEFAULT_WEATHER_LOCATION;
  // A bare US zip code needs OWM's `zip=` param instead of `q=` (which expects
  // a city name) — detect a plain 5-digit string and route it correctly.
  const locParam = /^\d{5}$/.test(loc) ? `zip=${loc},US` : `q=${encodeURIComponent(loc)}`;
  const params = `${locParam}&units=${OWM_UNITS}&appid=${apiKey}`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${base}/weather?${params}`),
    fetch(`${base}/forecast?${params}&cnt=40`),
  ]);

  if (!currentRes.ok || !forecastRes.ok) {
    throw new Error("Weather API error");
  }

  const currentData = await currentRes.json() as OWMCurrentResponse;
  const forecastData = await forecastRes.json() as OWMForecastResponse;

  const current: WeatherCurrent = {
    temp: Math.round(currentData.main.temp),
    lowTemp: Math.round(currentData.main.temp_min),
    rainChance: Math.round((currentData.pop ?? 0) * 100),
    wind: Math.round(currentData.wind.speed),
    humidity: currentData.main.humidity,
    condition: conditionMap[currentData.weather[0]?.main] ?? "clear_sky",
    description: currentData.weather[0]?.description ?? "",
  };

  // Group forecast by day (take noon reading each day)
  const dayMap = new Map<string, OWMForecastItem>();
  forecastData.list.forEach(item => {
    const date = item.dt_txt.slice(0, 10);
    const existing = dayMap.get(date);
    if (!existing || Math.abs(item.dt % 86400 - 43200) < Math.abs(existing.dt % 86400 - 43200)) {
      dayMap.set(date, item);
    }
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const forecast: WeatherDay[] = Array.from(dayMap.entries()).slice(0, 7).map(([date, item], i) => ({
    day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : days[new Date(date + "T12:00:00").getDay()],
    date,
    temp: Math.round(item.main.temp),
    lowTemp: Math.round(item.main.temp_min),
    rainChance: Math.round(item.pop * 100),
    wind: Math.round(item.wind.speed),
    humidity: item.main.humidity,
    condition: conditionMap[item.weather[0]?.main] ?? "clear_sky",
    description: item.weather[0]?.description ?? "",
  }));

  return { current, forecast };
};
