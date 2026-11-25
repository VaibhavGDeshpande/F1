import { Cloud, CloudRain, Sun, Wind } from "lucide-react";
import type { Forecast } from "@/lib/weather";

/** One-line session forecast: sky, air temperature, rain chance, wind. */
export function ForecastChip({ f }: { f: Forecast }) {
  const wet = f.rainChance >= 40;
  const Icon = wet ? CloudRain : f.cloud >= 60 ? Cloud : Sun;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-300"
      title={`Forecast: ${f.temp.toFixed(0)}°C air, ${f.rainChance}% chance of rain (${f.rainMm.toFixed(1)} mm), ${f.cloud.toFixed(0)}% cloud, wind ${f.wind.toFixed(0)} km/h from ${f.windFrom}`}>
      <Icon size={13} className={wet ? "text-sky-300" : f.cloud >= 60 ? "text-neutral-400" : "text-amber-300"} />
      {Math.round(f.temp)}°
      <span className={wet ? "text-sky-300" : "text-neutral-400"}>{f.rainChance}% rain</span>
      <Wind size={12} className="text-neutral-500" />{Math.round(f.wind)} km/h {f.windFrom}
    </span>
  );
}
