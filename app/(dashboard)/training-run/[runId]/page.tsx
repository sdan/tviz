"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with pigeon-maps
// @ts-expect-error - pigeon-maps types are incompatible with next/dynamic
const PigeonMap = dynamic(() => import("pigeon-maps").then((mod) => mod.Map), { ssr: false });
const PigeonMarker = dynamic(() => import("pigeon-maps").then((mod) => mod.Marker), { ssr: false });
import { useLiveTraining } from "@/hooks/useLiveTraining";
import { useReplayTraining } from "@/hooks/useReplayTraining";
import { TextRolloutView } from "@/lib/plugins/text/TextRolloutView";
import { Button } from "@/components/ui/button";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  ComposedChart,
  Line,
} from "recharts";
import type { Run, RolloutWithTrajectories } from "@/lib/db";

// ============================================================================
// Utility functions
// ============================================================================

function rewardColor(r: number): string {
  if (r >= 0.8) return "#22c55e";
  if (r >= 0.5) return "#34c759";
  if (r >= 0.2) return "#ff9500";
  if (r >= 0) return "#f97316";
  return "#ef4444";
}

function formatReward(r: number): string {
  return r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2);
}

function tokenCount(outputTokens: string | null): number {
  if (!outputTokens) return 0;
  try {
    const tokens = JSON.parse(outputTokens);
    return Array.isArray(tokens) ? tokens.length : 0;
  } catch {
    return 0;
  }
}

function formatCount(count: number, label: string): string {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}

type RewardBreakdownItem = {
  label: string;
  value: string;
};

function formatRewardValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(3) : String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return JSON.stringify(value);
}

function parseStepRewards(raw: string | null): RewardBreakdownItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const numeric = parsed.filter((value) => typeof value === "number") as number[];
      if (numeric.length === 0) return [];
      const sum = numeric.reduce((acc, value) => acc + value, 0);
      const mean = sum / numeric.length;
      const min = Math.min(...numeric);
      const max = Math.max(...numeric);
      return [
        { label: "step_sum", value: formatRewardValue(sum) },
        { label: "step_mean", value: formatRewardValue(mean) },
        { label: "step_min", value: formatRewardValue(min) },
        { label: "step_max", value: formatRewardValue(max) },
        { label: "steps", value: String(numeric.length) },
      ];
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([label, value]) => ({
        label,
        value: formatRewardValue(value),
      }));
    }
  } catch {
    return [];
  }
  return [];
}

// Convert filesystem path to API route for serving images
function getImageUrl(imagePath: string | null): string {
  if (!imagePath) return "";
  // Encode the path and serve through API
  const encoded = encodeURIComponent(imagePath);
  return `/api/images/${encoded}`;
}

// ============================================================================
// Rollout Modal (for detailed view)
// ============================================================================

function RolloutModal({
  rollout,
  open,
  onOpenChange,
}: {
  rollout: RolloutWithTrajectories;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [idx, setIdx] = useState(0);
  const trajectory = rollout.trajectories[idx];
  const isVision = rollout.image_path !== null;
  const rewardBreakdown = parseStepRewards(trajectory?.step_rewards ?? null);

  // For text modality, use the TextRolloutView component
  if (!isVision) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
            <div className="flex items-center gap-2">
                <span className="font-semibold">Group</span>
                <Badge variant="outline" className="text-xs">Step {rollout.step}</Badge>
                <Badge variant="outline" className="text-xs">Group {rollout.group_idx}</Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          <TextRolloutView
            rollout={rollout}
            trajectories={rollout.trajectories.map(t => ({
              trajectory_idx: t.trajectory_idx,
              reward: t.reward,
              output_text: t.output_text ?? undefined,
              logprobs: t.logprobs ? JSON.parse(t.logprobs) : undefined,
            }))}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Vision modality
  const mapCenter: [number, number] = trajectory?.pred_lat && trajectory?.pred_lon && rollout.gt_lat && rollout.gt_lon
    ? [(rollout.gt_lat + trajectory.pred_lat) / 2, (rollout.gt_lon + trajectory.pred_lon) / 2]
    : rollout.gt_lat && rollout.gt_lon
      ? [rollout.gt_lat, rollout.gt_lon]
      : [0, 0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {rollout.gt_city || "Unknown"}, {rollout.gt_country || "Unknown"}
              </span>
              <Badge variant="outline" className="text-xs">Step {rollout.step}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-2">
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img src={getImageUrl(rollout.image_path)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rollout.trajectories.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setIdx(i)}
                  className={`w-8 h-8 text-sm font-mono rounded border-2 transition-all ${
                    idx === i ? "bg-foreground text-background scale-110" : "bg-background hover:bg-muted"
                  }`}
                  style={{ borderColor: rewardColor(t.reward) }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {rollout.gt_lat && rollout.gt_lon && (
              <div className="h-[280px] rounded-lg overflow-hidden border border-border">
                <PigeonMap defaultCenter={mapCenter} defaultZoom={2} center={mapCenter} zoom={2} height={280}>
                  <PigeonMarker anchor={[rollout.gt_lat, rollout.gt_lon]} color="#ff3b30" />
                  {rollout.trajectories
                    .filter((t) => t.pred_lat && t.pred_lon)
                    .map((t, i) => (
                      <PigeonMarker
                        key={t.id}
                        anchor={[t.pred_lat!, t.pred_lon!]}
                        color={i === idx ? "#fff" : rewardColor(t.reward)}
                        onClick={() => setIdx(i)}
                      />
                    ))}
                </PigeonMap>
              </div>
            )}

            {trajectory && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Reward: </span>
                    <span className="font-mono font-bold" style={{ color: rewardColor(trajectory.reward) }}>
                      {formatReward(trajectory.reward)}
                    </span>
                  </div>
                  {trajectory.distance_km !== null && (
                    <div>
                      <span className="text-muted-foreground">Distance: </span>
                      <span className="font-mono">{trajectory.distance_km.toFixed(1)} km</span>
                    </div>
                  )}
                </div>
                {trajectory.output_text && (
                  <pre className="text-xs font-mono bg-black/30 p-2 rounded overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {trajectory.output_text}
                  </pre>
                )}
                {rewardBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {rewardBreakdown.map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded">
                        <span className="text-muted-foreground">{item.label}:</span>
                        <span className="font-mono">{item.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Trajectory Row - unified for text AND vision
// ============================================================================

function VisionTrajectoryRow({
  trajectory,
  rank,
  isVision,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
}: {
  trajectory: RolloutWithTrajectories["trajectories"][0];
  rank: number;
  isVision: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const preview = trajectory.output_text?.slice(0, 100) || "(no output)";
  const distanceText = trajectory.distance_km !== null && trajectory.distance_km !== undefined
    ? trajectory.distance_km < 1
      ? `${(trajectory.distance_km * 1000).toFixed(0)}m`
      : `${trajectory.distance_km.toFixed(0)}km`
    : null;
  const rewardBreakdown = parseStepRewards(trajectory.step_rewards);

  return (
    <div
      className={`border-l-4 pl-3 pr-10 py-2 cursor-pointer hover:bg-muted/30 transition-colors relative ${
        isExpanded ? "bg-muted/50" : ""
      } ${isSelected ? "bg-muted/40" : ""}`}
      style={{ borderLeftColor: isSelected ? "#000" : rewardColor(trajectory.reward) }}
      onClick={() => { onSelect(); onToggle(); }}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="text-xs text-muted-foreground shrink-0">#{rank + 1}</span>
        <span className="font-mono font-medium shrink-0" style={{ color: rewardColor(trajectory.reward) }}>
          {formatReward(trajectory.reward)}
        </span>
        {isVision && distanceText && (
          <span className="text-xs text-muted-foreground shrink-0">{distanceText}</span>
        )}
        {!isExpanded && (
          <span className="text-muted-foreground font-mono text-xs truncate min-w-0">
            {preview}
          </span>
        )}
      </div>
      <span className="absolute right-4 top-2 text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
      {isExpanded && trajectory.output_text && (
        <pre className="mt-2 text-xs font-mono bg-background border rounded p-2 whitespace-pre-wrap max-h-48 overflow-auto">
          {trajectory.output_text}
        </pre>
      )}
      {isExpanded && rewardBreakdown.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {rewardBreakdown.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded">
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="font-mono">{item.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rollout Row (compact, expandable) - unified for text AND vision
// ============================================================================

function RolloutRow({
  rollout,
  onOpenModal,
  getImageUrl,
}: {
  rollout: RolloutWithTrajectories;
  onOpenModal: () => void;
  getImageUrl?: (path: string | null) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTrajIdx, setExpandedTrajIdx] = useState<number | null>(null);
  const [selectedTrajIdx, setSelectedTrajIdx] = useState(0);

  const sorted = useMemo(
    () => [...rollout.trajectories].sort((a, b) => b.reward - a.reward),
    [rollout.trajectories]
  );

  const bestReward = sorted[0]?.reward ?? 0;
  const meanReward = rollout.mean_reward ?? (sorted.reduce((s, t) => s + t.reward, 0) / sorted.length);
  const promptPreview = rollout.prompt_text?.slice(0, 60) || "(no prompt)";
  const isVision = rollout.image_path !== null;
  const location = isVision
    ? [rollout.gt_city, rollout.gt_country].filter(Boolean).join(", ") || "Unknown"
    : "";
  const selectedTraj = sorted[selectedTrajIdx] || sorted[0];

  // Map center for vision modality
  const mapCenter: [number, number] = useMemo(() => {
    if (!isVision || !rollout.gt_lat || !rollout.gt_lon) return [0, 0];
    const t = selectedTraj;
    if (t?.pred_lat && t?.pred_lon) {
      return [(rollout.gt_lat + t.pred_lat) / 2, (rollout.gt_lon + t.pred_lon) / 2];
    }
    return [rollout.gt_lat, rollout.gt_lon];
  }, [isVision, rollout, selectedTraj]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-xs text-muted-foreground font-mono w-24">Group {rollout.group_idx}</span>

        {/* Reward indicators */}
        <div className="flex items-center gap-3 w-40">
          <div className="text-xs">
            <span className="text-muted-foreground">best:</span>
            <span className="font-mono ml-1" style={{ color: rewardColor(bestReward) }}>
              {formatReward(bestReward)}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">μ:</span>
            <span className="font-mono ml-1" style={{ color: rewardColor(meanReward) }}>
              {formatReward(meanReward)}
            </span>
          </div>
        </div>

        {/* Mini reward bars */}
        <div className="flex gap-0.5 h-4 flex-1 max-w-48">
          {sorted.map((t) => (
            <div
              key={t.id}
              className="flex-1 rounded-sm"
              style={{ backgroundColor: rewardColor(t.reward), opacity: 0.8 }}
              title={`#${t.trajectory_idx}: ${formatReward(t.reward)}`}
            />
          ))}
        </div>

        {/* Prompt/Location preview */}
        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
          {isVision ? `📍 ${location}` : promptPreview}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{rollout.trajectories.length} rollouts</span>
          <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Vision: Image + Map header */}
          {isVision && getImageUrl && (
            <div className="flex gap-4 p-3 bg-muted/20 border-b border-border">
              {/* Image */}
              <div className="rounded-lg overflow-hidden bg-muted flex-shrink-0" style={{ width: 200, height: 140 }}>
                {rollout.image_path && (
                  <img
                    src={getImageUrl(rollout.image_path)}
                    alt={location}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Map */}
              <div className="rounded-lg overflow-hidden bg-muted flex-shrink-0" style={{ width: 280, height: 140 }}>
                {rollout.gt_lat && rollout.gt_lon && (
                  <PigeonMap center={mapCenter} zoom={3} width={280} height={140}>
                    <PigeonMarker anchor={[rollout.gt_lat, rollout.gt_lon]} color="#ef4444" />
                    {sorted
                      .filter(t => t.pred_lat && t.pred_lon)
                      .map((t, i) => (
                        <PigeonMarker
                          key={t.id}
                          anchor={[t.pred_lat!, t.pred_lon!]}
                          color={i === selectedTrajIdx ? "#000" : rewardColor(t.reward)}
                        />
                      ))}
                  </PigeonMap>
                )}
              </div>

              {/* Legend */}
              <div className="text-xs text-muted-foreground space-y-1 pt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Ground truth</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-black" />
                  <span>Selected</span>
                </div>
              </div>
            </div>
          )}

          {/* Trajectory list (same for both text and vision) */}
          <div className="divide-y divide-border/50">
            {sorted.map((t, rank) => (
              <VisionTrajectoryRow
                key={t.id}
                trajectory={t}
                rank={rank}
                isVision={isVision}
                isExpanded={expandedTrajIdx === t.trajectory_idx}
                isSelected={selectedTrajIdx === rank}
                onToggle={() => setExpandedTrajIdx(
                  expandedTrajIdx === t.trajectory_idx ? null : t.trajectory_idx
                )}
                onSelect={() => setSelectedTrajIdx(rank)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Section (groups rollouts by step)
// ============================================================================

function StepSection({
  step,
  rollouts,
  onOpenModal,
  defaultExpanded = false,
}: {
  step: number;
  rollouts: RolloutWithTrajectories[];
  onOpenModal: (rollout: RolloutWithTrajectories) => void;
  defaultExpanded?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(!defaultExpanded);

  // Compute step-level stats
  const allTrajectories = rollouts.flatMap(r => r.trajectories);
  const bestReward = Math.max(...allTrajectories.map(t => t.reward));
  const meanReward = allTrajectories.reduce((s, t) => s + t.reward, 0) / allTrajectories.length;
  const avgOutputLen = allTrajectories.length > 0
    ? allTrajectories.reduce((sum, t) => sum + tokenCount(t.output_tokens), 0) / allTrajectories.length
    : 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Step header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer transition-colors bg-muted/50 hover:bg-muted/70"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-4">
          <span className="font-semibold">Step {step}</span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">best:</span>
            <span className="font-mono ml-1" style={{ color: rewardColor(bestReward) }}>
              {formatReward(bestReward)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">mean:</span>
            <span className="font-mono ml-1" style={{ color: rewardColor(meanReward) }}>
              {formatReward(meanReward)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">avg len:</span>
            <span className="font-mono ml-1">{avgOutputLen.toFixed(0)}</span>
          </div>
          <div className="text-muted-foreground">
            {formatCount(rollouts.length, "group")} · {formatCount(allTrajectories.length, "rollout")}
          </div>
          <span className="text-muted-foreground">{isCollapsed ? "▼" : "▲"}</span>
        </div>
      </div>

      {/* Rollouts - unified layout for both text and vision */}
      {!isCollapsed && (
        <div className="p-3 space-y-2 bg-background">
          {rollouts.map((rollout) => (
            <RolloutRow
              key={rollout.id}
              rollout={rollout}
              onOpenModal={() => onOpenModal(rollout)}
              getImageUrl={getImageUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TrainingRunPage() {
  const params = useParams();
  const runId = params.runId as string;
  const decodedRunId = decodeURIComponent(runId);
  const [run, setRun] = useState<Run | null>(null);
  const [selectedRollout, setSelectedRollout] = useState<RolloutWithTrajectories | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [storedRollouts, setStoredRollouts] = useState<RolloutWithTrajectories[]>([]);

  const live = useLiveTraining(decodedRunId);
  const replay = useReplayTraining(decodedRunId);

  const steps = isReplayMode ? replay.steps : live.steps;
  const rollouts = isReplayMode ? replay.rollouts : (storedRollouts.length > 0 ? storedRollouts : live.rollouts);
  const connected = isReplayMode ? replay.isReplaying : live.connected;

  // Group rollouts by step
  const rolloutsByStep = useMemo(() => {
    const grouped = new Map<number, RolloutWithTrajectories[]>();
    for (const r of rollouts) {
      const existing = grouped.get(r.step) || [];
      existing.push(r);
      grouped.set(r.step, existing);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[0] - a[0]); // Latest step first
  }, [rollouts]);

  // Compute chart data with reward spread
  const chartData = useMemo(() => {
    return steps.map((s) => {
      const stepRollouts = rollouts.filter(r => r.step === s.step);
      const allTrajs = stepRollouts.flatMap(r => r.trajectories);
      const rewards = allTrajs.map(t => t.reward);
      const bestReward = rewards.length > 0 ? Math.max(...rewards) : 0;
      const worstReward = rewards.length > 0 ? Math.min(...rewards) : 0;
      const avgOutputLen = allTrajs.length > 0
        ? allTrajs.reduce((sum, t) => sum + tokenCount(t.output_tokens), 0) / allTrajs.length
        : 0;

      return {
        step: s.step,
        mean: s.reward_mean ?? 0,
        best: bestReward,
        worst: worstReward,
        avgOutputLen,
      };
    });
  }, [steps, rollouts]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const allTrajs = rollouts.flatMap(r => r.trajectories);
    const totalTokens = allTrajs.reduce((sum, t) => sum + tokenCount(t.output_tokens), 0);
    const totalTrajectories = allTrajs.length;
    return { totalTokens, totalTrajectories };
  }, [rollouts]);

  useEffect(() => {
    fetch(`/api/runs/${decodedRunId}`)
      .then((r) => r.json())
      .then((d) => setRun(d.run))
      .catch(() => {});
  }, [decodedRunId]);

  useEffect(() => {
    setStoredRollouts([]);
  }, [decodedRunId]);

  useEffect(() => {
    if (isReplayMode) return;
    if (!run?.ended_at) return;
    if (storedRollouts.length > 0) return;

    fetch(`/api/runs/${decodedRunId}/rollouts`)
      .then((r) => r.json())
      .then((d) => setStoredRollouts(d.rollouts || []))
      .catch(() => {});
  }, [decodedRunId, isReplayMode, run?.ended_at, storedRollouts.length]);

  useEffect(() => {
    if (isReplayMode) return;
    const interval = setInterval(() => {
      fetch(`/api/runs/${decodedRunId}`)
        .then((r) => r.json())
        .then((d) => setRun(d.run))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [decodedRunId, isReplayMode]);

  const config = run?.config ? JSON.parse(run.config) : {};
  const latest = steps[steps.length - 1];
  const isEnded = !!run?.ended_at;

  return (
    <div className="p-4 space-y-4 max-w-[1400px] mx-auto">
      {/* Compact Header */}
      <header className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold font-mono">{decodedRunId}</h1>
          <Badge variant={isEnded ? "secondary" : connected ? "green" : "destructive"}>
            {isReplayMode
              ? (replay.isReplaying ? "Replaying" : "Done")
              : (isEnded ? "Ended" : (connected ? "Live" : "Disconnected"))}
          </Badge>
          {run?.type && <Badge variant="outline" className="text-xs uppercase">{run.type}</Badge>}
          {run?.modality && <Badge variant="secondary" className="text-xs uppercase">{run.modality}</Badge>}
        </div>

        <div className="flex items-center gap-4">
          {!isReplayMode ? (
            <Button variant="primary" size="sm" onClick={() => { setIsReplayMode(true); replay.startReplay(200); }}>
              ▶ Replay run
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => { setIsReplayMode(false); replay.stopReplay(); }}>
              ■ Stop replay
            </Button>
          )}
          {latest && (
            <div className="text-right">
              <div className="font-mono font-bold">Step {latest.step}</div>
              <div className="text-xs text-muted-foreground">
                reward: {latest.reward_mean?.toFixed(3)} · {summaryStats.totalTrajectories.toLocaleString()} trajs · {summaryStats.totalTokens.toLocaleString()} tokens
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Compact Config */}
      {Object.keys(config).length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm py-2 px-3 bg-muted/30 rounded-lg">
          {Object.entries(config).map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span>
              <span className="font-mono ml-1">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts - Reward Spread + Output Length */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Reward (best / mean / worst)</div>
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="step" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} domain={[-1, 1]} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                formatter={(value) => typeof value === "number" ? value.toFixed(3) : value}
              />
              <Area type="monotone" dataKey="best" stroke="#22c55e" fill="#22c55e22" strokeWidth={1} />
              <Line type="monotone" dataKey="mean" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="worst" stroke="#ef4444" fill="#ef444422" strokeWidth={1} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Avg Output Length</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="step" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                formatter={(value) => typeof value === "number" ? value.toFixed(1) : value}
              />
              <Area type="monotone" dataKey="avgOutputLen" stroke="#5ac8fa" fill="#5ac8fa33" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Performance Charts - only show if we have actual timing data */}
      {steps.filter(s => typeof s.sampling_time_mean === 'number' || typeof s.time_total === 'number').length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Performance Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            {steps.some(s => typeof s.ac_tokens_per_turn === 'number') && (
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Tokens per Turn</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={steps.map(s => ({ step: s.step, value: s.ac_tokens_per_turn }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="step" stroke="#888" fontSize={10} />
                    <YAxis stroke="#888" fontSize={10} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => typeof value === "number" ? value.toFixed(2) : value}
                    />
                    <Area type="monotone" dataKey="value" stroke="#a855f7" fill="#a855f733" strokeWidth={2} name="tokens/turn" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {steps.some(s => typeof s.total_ac_tokens === 'number') && (
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Total Action Tokens</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={steps.map(s => ({ step: s.step, value: s.total_ac_tokens }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="step" stroke="#888" fontSize={10} />
                    <YAxis stroke="#888" fontSize={10} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => typeof value === "number" ? value.toLocaleString() : value}
                    />
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} name="tokens" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {steps.some(s => typeof s.sampling_time_mean === 'number') && (
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Sampling Time (s)</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={steps.map(s => ({ step: s.step, value: s.sampling_time_mean }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="step" stroke="#888" fontSize={10} />
                    <YAxis stroke="#888" fontSize={10} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => typeof value === "number" ? `${value.toFixed(2)}s` : value}
                    />
                    <Area type="monotone" dataKey="value" stroke="#14b8a6" fill="#14b8a633" strokeWidth={2} name="time" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {steps.some(s => typeof s.time_total === 'number') && (
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Step Time (s)</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={steps.map(s => ({ step: s.step, value: s.time_total }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="step" stroke="#888" fontSize={10} />
                    <YAxis stroke="#888" fontSize={10} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => typeof value === "number" ? `${value.toFixed(2)}s` : value}
                    />
                    <Area type="monotone" dataKey="value" stroke="#ec4899" fill="#ec489933" strokeWidth={2} name="time" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {/* Groups by Step */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Groups by Step</h2>
          <span className="text-sm text-muted-foreground">
            {formatCount(rolloutsByStep.length, "step")} · {formatCount(rollouts.length, "group")}
          </span>
        </div>

        {rolloutsByStep.length > 0 ? (
          <div className="space-y-2">
            {rolloutsByStep.map(([step, stepRollouts], idx) => (
              <StepSection
                key={step}
                step={step}
                rollouts={stepRollouts}
                onOpenModal={setSelectedRollout}
                defaultExpanded={idx === 0}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            {isEnded && !isReplayMode
              ? "Run ended - no group data"
              : (connected ? "Waiting for training data..." : "Not connected")}
          </Card>
        )}
      </div>

      {/* Modal */}
      {selectedRollout && (
        <RolloutModal
          rollout={selectedRollout}
          open={!!selectedRollout}
          onOpenChange={(open) => !open && setSelectedRollout(null)}
        />
      )}
    </div>
  );
}
