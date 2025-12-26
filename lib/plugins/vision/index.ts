// Vision modality plugin for tviz
// Provides VLM-specific visualization components (geolocation, maps, etc.)

export { default as GeoRewardMap } from "./GeoRewardMap";

// Vision modality types
export interface VisionObservation {
  tokens: number[];
  text: string;
  imagePath: string;
}

export interface VisionMetadata {
  gtLat: number;
  gtLon: number;
  city?: string;
  country?: string;
  region?: string;
}

// Haversine distance calculation (km)
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Multi-scale kernel reward
export function kernelReward(distance: number, scale: number): number {
  return Math.exp(-distance / scale);
}

// Default kernel scales (continent -> street)
export const DEFAULT_KERNELS = [
  { name: "Continent", scale: 5000, color: "#0071e3" },
  { name: "Country", scale: 750, color: "#34c759" },
  { name: "Region", scale: 100, color: "#ff9500" },
  { name: "City", scale: 25, color: "#5ac8fa" },
  { name: "Street", scale: 1, color: "#af52de" },
];
