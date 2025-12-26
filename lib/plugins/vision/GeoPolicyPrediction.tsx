"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Sample candidates
const SAMPLE_CANDIDATES = [
  { id: 1, city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503, basePr: 0.35 },
  { id: 2, city: "Osaka", country: "JP", lat: 34.6937, lng: 135.5023, basePr: 0.22 },
  { id: 3, city: "Seoul", country: "KR", lat: 37.5665, lng: 126.9780, basePr: 0.18 },
  { id: 4, city: "Shanghai", country: "CN", lat: 31.2304, lng: 121.4737, basePr: 0.12 },
  { id: 5, city: "Beijing", country: "CN", lat: 39.9042, lng: 116.4074, basePr: 0.08 },
  { id: 6, city: "Hong Kong", country: "HK", lat: 22.3193, lng: 114.1694, basePr: 0.05 },
];

type ViewMode = "base" | "policy";

export default function GeoPolicyPrediction() {
  const [mode, setMode] = useState<ViewMode>("policy");
  const [iteration, setIteration] = useState(0);

  const candidates = useMemo(() => {
    return SAMPLE_CANDIDATES.map((c, i) => {
      const boost = i === 0 ? 0.15 : i === 2 ? 0.08 : -0.03;
      const policyPr = Math.max(0.01, Math.min(0.99, c.basePr + boost + (Math.random() - 0.5) * 0.05));
      return { ...c, policyPr };
    }).sort((a, b) => (mode === "base" ? b.basePr - a.basePr : b.policyPr - a.policyPr));
  }, [mode, iteration]);

  useEffect(() => {
    const timer = setInterval(() => setIteration((i) => i + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>Policy Re-ranking on Top-K</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={mode === "base" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("base")}
            >
              Base
            </Button>
            <Button
              variant={mode === "policy" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("policy")}
            >
              Policy
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-[1.2fr_1fr] gap-6 min-h-[360px]">
          {/* Candidate list */}
          <div className="bg-muted border border-border rounded-lg p-4">
            <div className="grid grid-cols-[50px_1fr_180px] gap-2 px-2 py-1.5 font-mono text-xs text-muted-foreground border-b border-border">
              <span>Rank</span>
              <span>Location</span>
              <span>Probability</span>
            </div>
            <div className="flex flex-col gap-2 py-2 max-h-[400px] overflow-y-auto">
              {candidates.map((c, i) => {
                const basePct = c.basePr * 100;
                const policyPct = c.policyPr * 100;
                return (
                  <div key={c.id} className="grid grid-cols-[50px_1fr_180px] gap-2 items-center bg-card border border-border rounded-lg p-2">
                    <div className="font-semibold text-sm">#{i + 1}</div>
                    <div className="font-mono text-xs text-foreground/80">{c.city}, {c.country}</div>
                    <div className="flex flex-col gap-1">
                      <div
                        className="h-2 rounded bg-foreground/10"
                        style={{ width: `${basePct}%` }}
                        title={`Base: ${basePct.toFixed(1)}%`}
                      />
                      <div
                        className="h-2 rounded bg-accent/80"
                        style={{ width: `${policyPct}%` }}
                        title={`Policy: ${policyPct.toFixed(1)}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map */}
          <div className="bg-muted border border-border rounded-lg overflow-hidden min-h-[360px]">
            <MapContainer
              center={[35, 125]}
              zoom={3}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {candidates.map((c, i) => {
                const pr = mode === "base" ? c.basePr : c.policyPr;
                return (
                  <CircleMarker
                    key={c.id}
                    center={[c.lat, c.lng]}
                    radius={8 + pr * 20}
                    pathOptions={{
                      color: mode === "base" ? "#424245" : "#0071e3",
                      fillColor: mode === "base" ? "#86868b" : "#0071e3",
                      fillOpacity: 0.4 + pr * 0.5,
                      weight: i === 0 ? 3 : 1,
                    }}
                  >
                    <Popup>
                      #{i + 1} {c.city}, {c.country}<br />
                      {mode === "base" ? "Base" : "Policy"}: {(pr * 100).toFixed(1)}%
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-center pt-4 border-t border-border">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/30" />
            <span>Base π₀</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span>Policy πθ</span>
          </div>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          Iteration: {iteration}
        </div>
      </CardFooter>
    </Card>
  );
}
