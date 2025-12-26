"use client";

import { useState, useEffect, use } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Map, Marker } from "pigeon-maps";
import { useLiveTraining } from "@/hooks/useLiveTraining";
import { useReplayTraining } from "@/hooks/useReplayTraining";
import { TextRolloutCard } from "@/lib/plugins/text/TextRolloutCard";
import { TextRolloutView } from "@/lib/plugins/text/TextRolloutView";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import type { Run, RolloutWithTrajectories, Trajectory } from "@/lib/db";

function rewardColor(r: number) {
  if (r > 0.5) return "#34c759";
  if (r > 0.2) return "#ff9500";
  return "#ff3b30";
}

function distanceColor(d: number | null) {
  if (d === null) return "#888";
  if (d < 25) return "#34c759";
  if (d < 100) return "#5ac8fa";
  if (d < 500) return "#ff9500";
  return "#ff3b30";
}

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

  // Calculate map center for vision modality
  const mapCenter: [number, number] = trajectory?.pred_lat && trajectory?.pred_lon && rollout.gt_lat && rollout.gt_lon
    ? [(rollout.gt_lat + trajectory.pred_lat) / 2, (rollout.gt_lon + trajectory.pred_lon) / 2]
    : rollout.gt_lat && rollout.gt_lon
      ? [rollout.gt_lat, rollout.gt_lon]
      : [0, 0];

  // For text modality, use the TextRolloutView component
  if (!isVision) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">Text Rollout</span>
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

  // Vision modality - existing layout
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">
                {`${rollout.gt_city || "Unknown"}, ${rollout.gt_country || "Unknown"}`}
              </span>
              <Badge variant="outline" className="text-xs">Step {rollout.step}</Badge>
              <Badge variant="outline" className="text-xs">Group {rollout.group_idx}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-2">
          {/* Left: Image */}
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img
                src={rollout.image_path!}
                alt=""
                className="w-full h-full object-cover"
              />
              {rollout.gt_lat && rollout.gt_lon && (
                <div className="absolute bottom-3 left-3 bg-black/70 text-white text-sm px-3 py-1.5 rounded">
                  Ground Truth: {rollout.gt_lat.toFixed(4)}, {rollout.gt_lon.toFixed(4)}
                </div>
              )}
            </div>

            {/* Trajectory selector */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">
                Select trajectory (0-{rollout.trajectories.length - 1})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rollout.trajectories.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setIdx(i)}
                    className={`w-8 h-8 text-sm font-mono rounded border-2 transition-all ${
                      idx === i
                        ? "bg-foreground text-background scale-110"
                        : "bg-background hover:bg-muted"
                    }`}
                    style={{ borderColor: t.format_valid ? rewardColor(t.reward) : "#666" }}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Map + Details */}
          <div className="space-y-4">
            {rollout.gt_lat && rollout.gt_lon && (
              <div className="h-[320px] rounded-lg overflow-hidden border border-border">
                <Map center={mapCenter} zoom={2} height={320}>
                  <Marker anchor={[rollout.gt_lat, rollout.gt_lon]} color="#ff3b30" />
                  {rollout.trajectories
                    .filter((t) => t.pred_lat && t.pred_lon)
                    .map((t) => (
                      <Marker
                        key={t.id}
                        anchor={[t.pred_lat!, t.pred_lon!]}
                        color={rollout.trajectories.indexOf(t) === idx ? "#fff" : distanceColor(t.distance_km)}
                        onClick={() => setIdx(rollout.trajectories.indexOf(t))}
                      />
                    ))}
                </Map>
              </div>
            )}

            {/* Selected trajectory details */}
            {trajectory && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Distance: </span>
                    <span className="font-mono font-bold" style={{ color: distanceColor(trajectory.distance_km) }}>
                      {trajectory.distance_km?.toFixed(1) ?? "N/A"} km
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reward: </span>
                    <span className="font-mono font-bold" style={{ color: rewardColor(trajectory.reward) }}>
                      {trajectory.reward.toFixed(4)}
                    </span>
                  </div>
                  {trajectory.total_reward !== null && (
                    <div>
                      <span className="text-muted-foreground">Total Reward: </span>
                      <span className="font-mono font-bold">{trajectory.total_reward.toFixed(4)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Format: </span>
                    <span className={trajectory.format_valid ? "text-green-500" : "text-red-500"}>
                      {trajectory.format_valid ? "Valid" : "Invalid"}
                    </span>
                  </div>
                  {trajectory.mean_logprob !== null && (
                    <div>
                      <span className="text-muted-foreground">Mean Logprob: </span>
                      <span className="font-mono">{trajectory.mean_logprob.toFixed(4)}</span>
                    </div>
                  )}
                </div>

                {/* Raw output text */}
                {trajectory.output_text && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Model output:</div>
                    <pre className="text-xs font-mono bg-black/30 p-3 rounded overflow-x-auto max-h-32 whitespace-pre-wrap">
                      {trajectory.output_text}
                    </pre>
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

function RolloutCard({ rollout, onClick }: { rollout: RolloutWithTrajectories; onClick: () => void }) {
  const [idx, setIdx] = useState(0);
  const trajectory = rollout.trajectories[idx];
  const isVision = rollout.image_path !== null;

  // Use TextRolloutCard for text modality
  if (!isVision) {
    return <TextRolloutCard rollout={rollout} onClick={onClick} />;
  }

  // Vision modality - existing layout
  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      onClick={onClick}
    >
      <div className="grid grid-cols-2 gap-0">
        <div className="relative aspect-[4/3] bg-muted">
          <img src={rollout.image_path!} alt="" className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {rollout.gt_city || "Unknown"}, {rollout.gt_country || "Unknown"}
          </div>
        </div>
        <div className="aspect-[4/3]">
          {rollout.gt_lat && rollout.gt_lon && (
            <Map center={[rollout.gt_lat, rollout.gt_lon]} zoom={3} height={200}>
              <Marker anchor={[rollout.gt_lat, rollout.gt_lon]} color="#ff3b30" />
              {rollout.trajectories
                .filter((t) => t.pred_lat && t.pred_lon)
                .map((t) => (
                  <Marker key={t.id} anchor={[t.pred_lat!, t.pred_lon!]} color={distanceColor(t.distance_km)} />
                ))}
            </Map>
          )}
        </div>
      </div>
      <CardContent className="p-3 bg-muted/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1 mb-2">
          {rollout.trajectories.map((t, i) => (
            <button
              key={t.id}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`w-6 h-6 text-xs font-mono rounded border ${idx === i ? "bg-foreground text-background" : "bg-background"}`}
              style={{ borderColor: t.format_valid ? rewardColor(t.reward) : "#888" }}
            >
              {i}
            </button>
          ))}
        </div>
        {trajectory && (
          <div className="text-xs font-mono grid grid-cols-3 gap-2">
            <div>
              <span className="text-muted-foreground">Distance: </span>
              <span style={{ color: distanceColor(trajectory.distance_km) }}>{trajectory.distance_km?.toFixed(0) ?? "N/A"} km</span>
            </div>
            <div>
              <span className="text-muted-foreground">Reward: </span>
              <span style={{ color: rewardColor(trajectory.reward) }}>{trajectory.reward.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Format: </span>
              <span>{trajectory.format_valid ? "✓" : "✗"}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrainingRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const decodedRunId = decodeURIComponent(runId);
  const [run, setRun] = useState<Run | null>(null);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState<number | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);

  const live = useLiveTraining(decodedRunId);
  const replay = useReplayTraining(decodedRunId);

  // Use replay data when in replay mode, otherwise live
  const steps = isReplayMode ? replay.steps : live.steps;
  const rollouts = isReplayMode ? replay.rollouts : live.rollouts;
  const connected = isReplayMode ? replay.isReplaying : live.connected;

  // Get selected rollout from current rollouts array
  const selectedRollout = selectedGroupIdx !== null
    ? rollouts.find(r => r.group_idx === selectedGroupIdx) || rollouts[0]
    : null;

  useEffect(() => {
    fetch(`/api/runs/${decodedRunId}`)
      .then((r) => r.json())
      .then((d) => setRun(d.run))
      .catch(() => {});
  }, [decodedRunId]);

  const config = run?.config ? JSON.parse(run.config) : {};
  const latest = steps[steps.length - 1];
  const chartData = steps.map((s) => ({
    step: s.step,
    reward: s.mean_reward ?? 0,
    loss: s.loss ?? 0,
  }));

  return (
    <div className="p-6">
      {/* Header */}
      <header className="pb-6 border-b border-border mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{decodedRunId}</h1>
              <Badge variant={connected ? "green" : "destructive"}>
                {isReplayMode ? (replay.isReplaying ? "Replaying" : "Replay Done") : (connected ? "Live" : "Disconnected")}
              </Badge>
              {run?.type && <Badge variant="outline" className="uppercase">{run.type}</Badge>}
              {run?.modality && (
                <Badge variant={run.modality === "vision" ? "purple" : "secondary"} className="uppercase">
                  {run.modality}
                </Badge>
              )}
              {isReplayMode && replay.totalSteps > 0 && (
                <span className="text-sm text-muted-foreground">
                  {replay.replayProgress}/{replay.totalSteps}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {run?.name || "Loading..."} • Started {run?.started_at ? new Date(run.started_at).toLocaleString() : "..."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Replay controls */}
            <div className="flex items-center gap-2">
              {!isReplayMode ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="text-white"
                  onClick={() => {
                    setIsReplayMode(true);
                    replay.startReplay(300);
                  }}
                >
                  Replay
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="text-white"
                  onClick={() => {
                    setIsReplayMode(false);
                    replay.stopReplay();
                  }}
                >
                  Stop Replay
                </Button>
              )}
            </div>
            {latest && (
              <div className="text-right">
                <div className="text-2xl font-mono font-bold">Step {latest.step}</div>
                <div className="text-sm text-muted-foreground">
                  {latest.mean_reward?.toFixed(4)} reward
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Config */}
      {Object.keys(config).length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              {Object.entries(config).map(([k, v]) => (
                <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-mono">{String(v)}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mean Reward</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="step" stroke="#888" fontSize={10} />
                <YAxis stroke="#888" fontSize={10} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Area type="monotone" dataKey="reward" stroke="#34c759" fill="#34c75922" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loss</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="step" stroke="#888" fontSize={10} />
                <YAxis stroke="#888" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                <Line type="monotone" dataKey="loss" stroke="#ff9500" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rollouts */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Latest Rollouts {latest && `(Step ${latest.step})`}</h2>
        <span className="text-sm text-muted-foreground">{rollouts.length} rollouts</span>
      </div>

      {rollouts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rollouts.map((rollout) => (
            <RolloutCard
              key={rollout.id}
              rollout={rollout}
              onClick={() => setSelectedGroupIdx(rollout.group_idx)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {connected ? "Waiting for training data..." : "Not connected"}
          </CardContent>
        </Card>
      )}

      {/* Rollout detail modal */}
      {selectedRollout && (
        <RolloutModal
          rollout={selectedRollout}
          open={!!selectedRollout}
          onOpenChange={(open) => !open && setSelectedGroupIdx(null)}
        />
      )}
    </div>
  );
}
