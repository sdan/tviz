import Database from "better-sqlite3";
import os from "os";
import path from "path";

const envDbPath = process.env.TVIZ_DB_PATH;
const DB_PATH = envDbPath && envDbPath.length > 0
  ? envDbPath
  : path.join(os.homedir(), ".tviz", "tviz.db");

export function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

// =============================================================================
// Core Types - Modality-agnostic
// =============================================================================

export type Modality = "text" | "vision";

export interface Run {
  id: string;
  name: string;
  type: "sft" | "rl";
  modality: Modality;
  started_at: string;
  ended_at: string | null;
  config: string; // JSON string
}

export interface Step {
  id: number;
  run_id: string;
  step: number;
  timestamp: string;
  // Core metrics
  loss: number | null;
  reward_mean: number | null;
  reward_std: number | null;
  kl_divergence: number | null;
  entropy: number | null;
  learning_rate: number | null;
  // Token metrics (tinker-cookbook)
  ac_tokens_per_turn: number | null;
  ob_tokens_per_turn: number | null;
  total_ac_tokens: number | null;
  total_turns: number | null;
  // Timing metrics (tinker-cookbook)
  sampling_time_mean: number | null;
  time_total: number | null;
  // Group analysis metrics (GRPO)
  frac_mixed: number | null;
  frac_all_good: number | null;
  frac_all_bad: number | null;
  // Extensible metrics stored as JSON
  extras: string | null; // JSON object for additional metrics
}

// =============================================================================
// Rollout Types - One rollout = one group of trajectories at a step
// =============================================================================

export interface Rollout {
  id: number;
  run_id: string;
  step: number;
  group_idx: number;
  timestamp: string;
  // Vision-specific (null for text modality)
  image_path: string | null;
  gt_lat: number | null;
  gt_lon: number | null;
  gt_city: string | null;
  gt_country: string | null;
  // Text-specific (null for vision modality)
  prompt_text: string | null;
  mean_reward: number | null;
  best_reward: number | null;
  // Group-level metrics
  group_metrics: string | null; // JSON object
}

// =============================================================================
// Trajectory Types - Individual samples within a rollout group
// =============================================================================

export interface Trajectory {
  id: number;
  rollout_id: number;
  trajectory_idx: number; // 0-15 within group (G dimension)
  // Common fields
  reward: number;
  total_reward: number | null;
  // Text output (always present)
  output_text: string | null;
  output_tokens: string | null; // JSON array of token IDs
  // Logprobs for analysis
  mean_logprob: number | null;
  logprobs: string | null; // JSON array of per-token logprobs
  // Vision-specific predictions
  pred_lat: number | null;
  pred_lon: number | null;
  distance_km: number | null;
  // Validation
  format_valid: number; // 0 or 1
  // Extensible metrics
  step_rewards: string | null; // JSON array or object
  metrics: string | null; // JSON object
}

// =============================================================================
// Joined Views for Frontend
// =============================================================================

export interface RolloutWithTrajectories extends Rollout {
  trajectories: Trajectory[];
}

// =============================================================================
// Legacy Compatibility - Aliases for geospot-vlm migration
// =============================================================================

/** @deprecated Use Rollout instead */
export type Image = Rollout;

/** @deprecated Use Trajectory instead */
export type Sample = Trajectory;

/** @deprecated Use RolloutWithTrajectories instead */
export type ImageWithSamples = RolloutWithTrajectories;
