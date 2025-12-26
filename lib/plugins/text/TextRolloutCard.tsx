"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatReward, rewardToColor } from "./index";

interface Trajectory {
  id: number;
  trajectory_idx: number;
  reward: number;
  output_text?: string | null;
  logprobs?: string | null; // JSON string from DB
}

interface Rollout {
  id: number;
  step: number;
  group_idx: number;
  prompt_text?: string | null;
  mean_reward?: number | null;
  best_reward?: number | null;
  trajectories: Trajectory[];
}

interface TextRolloutCardProps {
  rollout: Rollout;
  onClick: () => void;
}

/**
 * Compact card for text rollout in grid view.
 * Shows prompt preview and trajectory rewards.
 */
export function TextRolloutCard({ rollout, onClick }: TextRolloutCardProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Sort by reward to show best first
  const sorted = [...rollout.trajectories].sort((a, b) => b.reward - a.reward);
  const bestReward = sorted[0]?.reward ?? 0;
  const worstReward = sorted[sorted.length - 1]?.reward ?? 0;

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      onClick={onClick}
    >
      {/* Prompt preview */}
      <div className="bg-muted/30 p-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Prompt
        </div>
        <pre className="text-xs font-mono line-clamp-3 text-foreground/80">
          {rollout.prompt_text || "(no prompt)"}
        </pre>
      </div>

      {/* Trajectory reward bar */}
      <CardContent className="p-3" onClick={(e) => e.stopPropagation()}>
        {/* Mini reward bars */}
        <div className="flex gap-0.5 mb-2 h-6">
          {sorted.map((t, i) => (
            <div
              key={t.id}
              className="flex-1 rounded-sm transition-all cursor-pointer relative"
              style={{
                backgroundColor: rewardToColor(t.reward, worstReward, bestReward),
                opacity: hoverIdx === i ? 1 : 0.7,
                transform: hoverIdx === i ? "scaleY(1.2)" : "scaleY(1)",
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              title={`#${i + 1}: ${t.reward.toFixed(4)}`}
            />
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {rollout.trajectories.length} rollouts
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>
              <span className="text-muted-foreground">best: </span>
              <span className={formatReward(bestReward).className}>
                {formatReward(bestReward).text}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">mean: </span>
              <span className={formatReward(rollout.mean_reward ?? 0).className}>
                {formatReward(rollout.mean_reward ?? 0).text}
              </span>
            </span>
          </div>
        </div>

        {/* Hover preview */}
        {hoverIdx !== null && sorted[hoverIdx] && (
          <div className="mt-2 p-2 bg-background border rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground">#{hoverIdx + 1}</span>
              <span className={`font-mono ${formatReward(sorted[hoverIdx].reward).className}`}>
                {formatReward(sorted[hoverIdx].reward).text}
              </span>
            </div>
            <pre className="font-mono text-[11px] line-clamp-2 text-foreground/70">
              {sorted[hoverIdx].output_text || "(no output)"}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
