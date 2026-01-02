"use client";

import { useState } from "react";
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
 * Includes toggle for logprobs heatmap visualization.
 */
export function TextTrajectoryCard({
  trajectory,
  rank,
  isExpanded = false,
  onToggle,
}: TextTrajectoryCardProps) {
  const [showLogprobs, setShowLogprobs] = useState(false);
  const { text: rewardText, className: rewardClass } = formatReward(trajectory.reward);
  const hasLogprobs = trajectory.logprobs && trajectory.logprobs.length > 0;

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
          {hasLogprobs && (
            <span className="text-xs text-muted-foreground font-light tracking-wide">
              {trajectory.logprobs!.length} tokens
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {isExpanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Output preview or full */}
      <div className="mt-2">
        {isExpanded ? (
          <div className="space-y-2">
            {/* Logprobs toggle button */}
            {hasLogprobs && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLogprobs(!showLogprobs);
                }}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  showLogprobs
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {showLogprobs ? "Hide Logprobs" : "Show Logprobs"}
              </button>
            )}

            {/* Content area */}
            <div className="bg-background border rounded p-2 max-h-64 overflow-auto">
              {showLogprobs && hasLogprobs ? (
                <div className="space-y-2">
                  {/* Color scale legend */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 font-light tracking-wide border-b border-border/50 pb-2 mb-2">
                    <span className="uppercase">Confidence</span>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)" }}>Low</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(234, 179, 8, 0.2)" }}>Med</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(34, 197, 94, 0.2)" }}>High</span>
                    </div>
                  </div>
                  <TokenHeatmap
                    text={trajectory.output_text || ""}
                    logprobs={trajectory.logprobs!}
                  />
                </div>
              ) : (
                <pre className="font-mono text-sm whitespace-pre-wrap">
                  {trajectory.output_text || "(no output)"}
                </pre>
              )}
            </div>
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
