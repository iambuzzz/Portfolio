// Live weather for where I am (Open-Meteo: free, no API key).
const LOCATION = { name: "Kota", lat: 25.2138, lon: 75.8648, tz: "Asia/Kolkata" };

interface Weather {
  temp: number;
  high: number;
  low: number;
  humidity: number;
  wind: number;
  condition: string;
  icon: string;
}

// WMO weather codes -> label + icon
const describe = (code: number, isDay: boolean): [string, string] => {
  if (code === 0) return ["Clear", isDay ? "sunny" : "moon"];
  if (code <= 2) return ["Partly Cloudy", isDay ? "partly-cloudy" : "moon"];
  if (code === 3) return ["Cloudy", "cloudy"];
  if (code <= 48) return ["Foggy", "cloudy"];
  if (code <= 67 || (code >= 80 && code <= 82)) return ["Rain", "rainy"];
  if (code <= 77 || code === 85 || code === 86) return ["Snow", "cloudy"];
  return ["Thunderstorms", "rainy"];
};

let cached: Promise<Weather | null> | null = null;
const fetchWeather = () =>
  (cached ??= fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
      "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day" +
      `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=${encodeURIComponent(LOCATION.tz)}`
  )
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d): Weather => {
      const [condition, icon] = describe(d.current.weather_code, d.current.is_day === 1);
      return {
        temp: Math.round(d.current.temperature_2m),
        high: Math.round(d.daily.temperature_2m_max[0]),
        low: Math.round(d.daily.temperature_2m_min[0]),
        humidity: Math.round(d.current.relative_humidity_2m),
        wind: Math.round(d.current.wind_speed_10m),
        condition,
        icon
      };
    })
    .catch(() => null));

function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    let alive = true;
    fetchWeather().then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, []);
  return weather;
}

const localTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: LOCATION.tz });


// SF Symbol-style SVG weather icons
const WeatherIcon = ({ type, size = 36 }: { type: string; size?: number }) => {
  const s = size;
  if (type === "sunny") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" fill="#FFD60A" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => (
        <line key={i} x1="12" y1="2.5" x2="12" y2="5"
          stroke="#FFD60A" strokeWidth="2" strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  );
  if (type === "rainy") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 13a5 5 0 1 1 9.9-1H17a3 3 0 0 1 0 6H7a4 4 0 0 1-1-7.87" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none"/>
      <line x1="9" y1="19" x2="7" y2="22" stroke="#64D2FF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="19" x2="11" y2="22" stroke="#64D2FF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (type === "cloudy") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 13a5 5 0 1 1 9.9-1H16a3 3 0 0 1 0 6H7a4 4 0 0 1-2-7.46" stroke="rgba(200,210,230,0.8)" strokeWidth="1.5" fill="rgba(200,210,230,0.12)"/>
    </svg>
  );
  // Moon icon (for night / partly-cloudy-night)
  if (type === "moon") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="rgba(200,220,255,0.9)" strokeWidth="1.6" fill="rgba(160,180,255,0.15)" strokeLinejoin="round"/>
    </svg>
  );
  // partly-cloudy default
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8.5" r="3.5" fill="#FFD60A" opacity="0.95"/>
      {[0,60,120,180,240,300].map((deg, i) => (
        <line key={i} x1="9" y1="1.5" x2="9" y2="3.2"
          stroke="#FFD60A" strokeWidth="1.6" strokeLinecap="round"
          transform={`rotate(${deg} 9 8.5)`} />
      ))}
      <path d="M8 14a4.5 4.5 0 1 1 8.9-.9H18a2.8 2.8 0 0 1 0 5.6H9a3.4 3.4 0 0 1-1-6.35"
        stroke="rgba(255,255,255,0.82)" strokeWidth="1.4" fill="rgba(255,255,255,0.14)"/>
    </svg>
  );
};

interface WeatherWidgetProps {
  compact?: boolean;
}

export default function WeatherWidget({ compact }: WeatherWidgetProps) {
  const w = useWeather();
  const WEATHER_DATA = {
    location: LOCATION.name,
    temp: w ? w.temp : "–",
    high: w ? w.high : "–",
    low: w ? w.low : "–",
    humidity: w ? w.humidity : "–",
    wind: w ? w.wind : "–",
    condition: w ? w.condition : "Loading…",
    icon: w ? w.icon : "partly-cloudy",
    alert: `Local time ${localTime()} IST`
  };

  const GLASS: React.CSSProperties = {
    background: "linear-gradient(145deg, rgba(22,28,42,0.84) 0%, rgba(16,22,36,0.92) 100%)",
    backdropFilter: "blur(64px) saturate(200%)",
    WebkitBackdropFilter: "blur(64px) saturate(200%)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.42), inset 0 0.5px 0 rgba(255,255,255,0.16)",
    fontFamily: "var(--font-system)",
  };

  if (compact) {
    return (
      <div style={{
        ...GLASS,
        borderRadius: 16,
        padding: "14px 16px 12px",
        userSelect: "none",
        width: 162,
      }}>
        {/* Location */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.72)", marginBottom: 4 }}>
          {WEATHER_DATA.location}
        </div>
        {/* Big temp */}
        <div style={{
          fontSize: 48,
          fontWeight: 200,
          color: "white",
          lineHeight: 1,
          letterSpacing: "-2px",
          fontVariantNumeric: "tabular-nums",
          marginBottom: 6,
        }}>
          {WEATHER_DATA.temp}°
        </div>
        {/* Alert row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          paddingTop: 8,
          borderTop: "0.5px solid rgba(255,255,255,0.09)",
        }}>
          <span className="i-ph:clock" style={{ width: 12, height: 12, color: "rgba(255,255,255,0.55)" }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.01em" }}>
            {WEATHER_DATA.alert}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...GLASS, borderRadius: 18, padding: "16px 18px", userSelect: "none", width: 200 }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 4, fontWeight: 500 }}>
            {WEATHER_DATA.location}
          </div>
          <div style={{ fontSize: 42, fontWeight: 200, color: "white", lineHeight: 1, letterSpacing: "-1.5px" }}>
            {WEATHER_DATA.temp}°
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 5 }}>
            {WEATHER_DATA.condition}
          </div>
        </div>
        <WeatherIcon type={WEATHER_DATA.icon} size={48} />
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.09)" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>H:{WEATHER_DATA.high}° L:{WEATHER_DATA.low}°</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>💧 {WEATHER_DATA.humidity}%</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>💨 {WEATHER_DATA.wind}km/h</span>
      </div>

      {/* Alert */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        paddingTop: 8,
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
      }}>
        <span className="i-ph:clock" style={{ width: 14, height: 14, color: "rgba(255,255,255,0.5)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)" }}>{WEATHER_DATA.alert}</span>
      </div>
    </div>
  );
}
