import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon, Snowflake, Sun, type LucideIcon } from 'lucide-react';
import type { WeatherIconName } from './weather';

const ICONS: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  cloud: Cloud,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning,
  snowflake: Snowflake,
  'cloud-fog': CloudFog,
};

/** A decorative weather icon for an icon name from `iconNameFor`. */
export function WeatherIcon({ name, size = 20, className }: { name: WeatherIconName; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon size={size} aria-hidden="true" className={className} />;
}
