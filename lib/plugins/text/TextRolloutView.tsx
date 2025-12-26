"use client";

import { useState } from "react";
import { TextTrajectoryCard } from "./TextTrajectoryCard";
import { formatReward } from "./index";

interface Trajectory {
  trajectory_idx: number;
  reward: number;
  output_text?: string;
  logprobs?: number[];
}

interface Rollout {
  id: number;
  step: number;
  group_idx: number;
  prompt_text?: string | null;
  mean_reward?: number | null;
  best_reward?: number | null;
}

interface TextRolloutViewProps {
  rollout: Rollout;
  trajectories: Trajectory[];
}

/**
 * Full view of a text rollout: prompt + all trajectory completions.
 * Trajectories are sorted by reward (best first).
 */
export function TextRolloutView({ rollout, trajectories }: TextRolloutViewProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0); // Expand best by default

  // Sort trajectories by reward descending
  const sorted = [...trajectories].sort((a, b) => b.reward - a.reward);

  const meanReward = rollout.mean_reward ?? 0;
  const bestReward = rollout.best_reward ?? sorted[0]?.reward ?? 0;

  return (
    <div className="space-y-4">
      {/* Prompt section */}
      <div className="border-l-4 border-blue-500 pl-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Prompt
        </div>
        <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-auto">
          <pre className="font-mono text-sm whitespace-pre-wrap">
            {rollout.prompt_text || "(no prompt)"}
          </pre>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Rollouts:</span>
          <span className="font-semibold">{trajectories.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Best:</span>
          <span className={`font-mono font-semibold ${formatReward(bestReward).className}`}>
            {formatReward(bestReward).text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Mean:</span>
          <span className={`font-mono font-semibold ${formatReward(meanReward).className}`}>
            {formatReward(meanReward).text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Step:</span>
          <span className="font-semibold">{rollout.step}</span>
        </div>
      </div>

      {/* Trajectories list */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Rollouts (ranked by reward)
        </div>
        {sorted.map((traj, rank) => (
          <TextTrajectoryCard
            key={traj.trajectory_idx}
            trajectory={traj}
            rank={rank}
            isExpanded={expandedIdx === traj.trajectory_idx}
            onToggle={() =>
              setExpandedIdx(
                expandedIdx === traj.trajectory_idx ? null : traj.trajectory_idx
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
