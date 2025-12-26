/**
 * Text modality plugin for LLM RL visualization.
 * Displays prompts, completions, rewards, and logprob heatmaps.
 */

export { TextTrajectoryCard } from "./TextTrajectoryCard";
export { TextRolloutView } from "./TextRolloutView";
export { TextRolloutCard } from "./TextRolloutCard";
export { TokenHeatmap } from "./TokenHeatmap";

// Utility: color scale for logprobs (green = high prob, red = low prob)
export function logprobToColor(logprob: number): string {
  // logprob is typically negative, closer to 0 = higher probability
  // Range roughly -10 (very unlikely) to 0 (certain)
  const normalized = Math.max(0, Math.min(1, (logprob + 5) / 5));
  const r = Math.round(255 * (1 - normalized));
  const g = Math.round(255 * normalized);
  return `rgb(${r}, ${g}, 100)`;
}

// Utility: color scale for rewards
export function rewardToColor(reward: number, min = -1, max = 1): string {
  const normalized = Math.max(0, Math.min(1, (reward - min) / (max - min)));
  if (normalized >= 0.5) {
    // Green gradient for positive
    const intensity = (normalized - 0.5) * 2;
    return `rgb(${Math.round(100 - 100 * intensity)}, ${Math.round(150 + 105 * intensity)}, 100)`;
  } else {
    // Red gradient for negative
    const intensity = (0.5 - normalized) * 2;
    return `rgb(${Math.round(150 + 105 * intensity)}, ${Math.round(100 - 50 * intensity)}, 100)`;
  }
}

// Utility: format reward with color indicator
export function formatReward(reward: number): { text: string; className: string } {
  const text = reward >= 0 ? `+${reward.toFixed(3)}` : reward.toFixed(3);
  const className = reward >= 0 ? "text-green-600" : "text-red-600";
  return { text, className };
}
