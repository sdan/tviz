"use client";

import { formatReward } from "./index";
import { TokenHeatmap } from "./TokenHeatmap";

interface Trajectory {
  trajectory_idx: number;
  reward: number;
  output_text?: string;
  logprobs?: number[];
}

interface TextTrajectoryCardProps {
  trajectory: Trajectory;
  rank?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

/**
 * Card showing a single trajectory completion with reward.
 */
export function TextTrajectoryCard({
  trajectory,
  rank,
  isExpanded = false,
  onToggle,
}: TextTrajectoryCardProps) {
  const { text: rewardText, className: rewardClass } = formatReward(trajectory.reward);

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {rank !== undefined && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              #{rank + 1}
            </span>
          )}
          <span className={`font-mono font-semibold ${rewardClass}`}>
            {rewardText}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Output preview or full */}
      <div className="mt-2">
        {isExpanded ? (
          <div className="bg-background border rounded p-2 max-h-64 overflow-auto">
            {trajectory.logprobs ? (
              <TokenHeatmap
                text={trajectory.output_text || ""}
                logprobs={trajectory.logprobs}
              />
            ) : (
              <pre className="font-mono text-sm whitespace-pre-wrap">
                {trajectory.output_text || "(no output)"}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground truncate font-mono">
            {trajectory.output_text?.slice(0, 100) || "(no output)"}
            {(trajectory.output_text?.length || 0) > 100 && "..."}
          </p>
        )}
      </div>
    </div>
  );
}
