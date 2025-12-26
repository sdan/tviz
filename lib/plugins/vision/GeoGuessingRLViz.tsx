"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

// Sample images from OSv5M with geolocation metadata
const IMAGES = [
  { id: "2057366217739411", city: "Panagar", region: "Madhya Pradesh", country: "IN", lat: 23.274160, lng: 79.986495 },
  { id: "2937019983177088", city: "Malpica", region: "Galicia", country: "ES", lat: 43.261569, lng: -8.820610 },
  { id: "365121168251226", city: "Tomina", region: "Chuquisaca", country: "BO", lat: -19.123342, lng: -64.628402 },
  { id: "396423669108226", city: "Cuyamel", region: "Cortes", country: "HN", lat: 15.663155, lng: -88.163811 },
  { id: "227737085792542", city: "Phan Rang", region: "Ninh Thuan", country: "VN", lat: 11.580035, lng: 108.942887 },
  { id: "174510417891701", city: "Gul'cha", region: "Osh", country: "KG", lat: 39.679820, lng: 72.921363 },
  { id: "816656172565477", city: "Ziniare", region: "Plateau-Central", country: "BF", lat: 12.582215, lng: -1.351188 },
  { id: "485309792671627", city: "Patu", region: "Rio Grande do Norte", country: "BR", lat: -6.130738, lng: -37.643291 },
];

// Multi-scale kernel definitions (continent -> street)
const KERNELS = [
  { name: "Continent", scale: 5000, color: "#0071e3" },
  { name: "Country", scale: 750, color: "#34c759" },
  { name: "Region", scale: 100, color: "#ff9500" },
  { name: "City", scale: 25, color: "#5ac8fa" },
  { name: "Street", scale: 1, color: "#af52de" },
];

// Curriculum stages
const STAGES = [
  { name: "Early", weights: [1.0, 0.5, 0.2, 0.1, 0.0] },
  { name: "Mid", weights: [0.3, 1.0, 0.8, 0.3, 0.1] },
  { name: "Late", weights: [0.1, 0.3, 0.5, 1.0, 0.8] },
];

// Token color palette
const TOKEN_COLORS = [
  "#ffe5e5", "#d4f1f4", "#e0f7e0", "#fff8dc", "#ffe5f9",
  "#fff4e0", "#d9f0ff", "#ffe5dc", "#d9f7ea", "#ffe0e6",
];

// Haversine distance (km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Kernel reward: exp(-distance / scale)
function kernelReward(distance: number, scale: number): number {
  return Math.exp(-distance / scale);
}

// Multi-scale reward with curriculum weights
function multiScaleReward(distance: number, weights: number[]) {
  const rewards = KERNELS.map((k, i) => kernelReward(distance, k.scale) * weights[i]);
  const total = rewards.reduce((a, b) => a + b, 0) / weights.reduce((a, b) => a + b, 0);
  return { total, rewards };
}

// Tokenize location output
function tokenize(city: string, region: string, country: string, lat: number, lng: number) {
  const text = `City: ${city}\nRegion: ${region}\nCountry: ${country}\nLat: ${lat.toFixed(4)}\nLng: ${lng.toFixed(4)}`;
  const tokens: { text: string; color: string | null }[] = [];
  let colorIdx = 0;

  for (const char of text) {
    if (char === " " || char === "\n" || char === ":") {
      tokens.push({ text: char, color: null });
    } else {
      if (tokens.length === 0 || tokens[tokens.length - 1].color === null) {
        tokens.push({ text: char, color: TOKEN_COLORS[colorIdx++ % TOKEN_COLORS.length] });
      } else {
        tokens[tokens.length - 1].text += char;
      }
    }
  }
  return tokens;
}

type Props = {
  imagePath?: string;
};

export default function GeoGuessingRLViz({ imagePath = "/osv5m_samples" }: Props) {
  const [idx, setIdx] = useState(0);
  const [stageIdx, setStageIdx] = useState(1);
  const [tokenCount, setTokenCount] = useState(0);

  const img = IMAGES[idx];
  const stage = STAGES[stageIdx];

  // Simulate prediction with random error
  const prediction = useMemo(() => ({
    lat: img.lat + (Math.random() - 0.5) * 1.5,
    lng: img.lng + (Math.random() - 0.5) * 2,
  }), [img, idx]);

  const distance = useMemo(() => haversine(prediction.lat, prediction.lng, img.lat, img.lng), [prediction, img]);
  const { total, rewards } = useMemo(() => multiScaleReward(distance, stage.weights), [distance, stage]);
  const tokens = useMemo(() => tokenize(img.city, img.region, img.country, img.lat, img.lng), [img]);

  // Auto-cycle images
  useEffect(() => {
    const timer = setTimeout(() => {
      setIdx((i) => (i + 1) % IMAGES.length);
      setTokenCount(0);
    }, 4000);
    return () => clearTimeout(timer);
  }, [idx]);

  // Animate token reveal
  useEffect(() => {
    if (tokenCount < tokens.length) {
      const timer = setTimeout(() => setTokenCount((c) => c + 1), 30);
      return () => clearTimeout(timer);
    }
  }, [tokenCount, tokens.length]);

  const restart = useCallback(() => {
    setIdx((i) => (i + 1) % IMAGES.length);
    setTokenCount(0);
  }, []);

  return (
    <div className="bg-muted rounded-xl p-8 max-w-3xl mx-auto">
      <div className="text-lg font-medium text-foreground/80 text-center mb-6 tracking-tight">
        Learning Geolocation from Graded Distance Rewards
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start mb-6">
        {/* Image */}
        <div>
          <div
            className="relative w-full aspect-[16/10] bg-card border border-border rounded-lg overflow-hidden cursor-pointer"
            onClick={restart}
          >
            <img
              src={`${imagePath}/${img.id}.jpg`}
              alt={`${img.city}, ${img.country}`}
              className="w-full h-full object-cover animate-fade-in"
            />
          </div>
          <div className="font-mono text-[0.7rem] text-muted-foreground text-center mt-2 px-2 py-1.5 bg-foreground/[0.03] rounded">
            {img.city}, {img.region}, {img.country} · {img.lat.toFixed(4)}°, {img.lng.toFixed(4)}°
          </div>
        </div>

        {/* Panel */}
        <Card>
          <CardContent className="p-4 flex flex-col gap-3">
            <div
              className="font-mono text-[0.6rem] text-muted-foreground text-right cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => setStageIdx((s) => (s + 1) % STAGES.length)}
            >
              Stage: {stage.name}
            </div>

            <div className="flex justify-around gap-6 pb-4 border-b border-border">
              <div className="flex flex-col items-center gap-1">
                <div className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-wider">
                  Δ Distance
                </div>
                <div className="font-mono text-xl font-semibold">
                  {distance.toFixed(0)}km
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-wider">
                  Reward
                </div>
                <div
                  className="font-mono text-xl font-semibold"
                  style={{ color: total > 0.5 ? "#34c759" : "#ff3b30" }}
                >
                  {total.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Kernel bars */}
            {KERNELS.map((k, i) => {
              const raw = kernelReward(distance, k.scale);
              return (
                <div key={k.name} className="grid grid-cols-[70px_1fr_90px] items-center gap-2">
                  <span className="font-mono text-[0.7rem] text-muted-foreground text-right">
                    {k.name}
                  </span>
                  <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(raw * 100, 1)}%`, backgroundColor: k.color }}
                    />
                  </div>
                  <span className="font-mono text-[0.7rem] text-foreground">
                    {raw.toFixed(3)}
                    {stage.weights[i] > 0 && (
                      <span className="text-muted-foreground text-[0.65rem]"> · {rewards[i].toFixed(3)}</span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Token output */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="font-mono text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-2">
                Model Output
              </div>
              <div className="font-mono text-[0.75rem] leading-relaxed bg-foreground/[0.02] p-3 rounded-md border border-border min-h-[100px]">
                {tokens.slice(0, tokenCount).map((t, i) => (
                  <span
                    key={i}
                    className="inline-block px-1 py-0.5 rounded-sm"
                    style={{
                      backgroundColor: t.color || "transparent",
                      whiteSpace: t.text === "\n" ? "pre" : "normal",
                    }}
                  >
                    {t.text}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
        Kernel rewards: exp(-distance / scale) · Click image to advance
      </div>
    </div>
  );
}
