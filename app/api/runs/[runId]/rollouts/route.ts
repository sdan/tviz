import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

interface RolloutRow {
  id: number;
  run_id: string;
  step: number;
  group_idx: number;
  timestamp: string;
  image_path: string | null;
  gt_lat: number | null;
  gt_lon: number | null;
  gt_city: string | null;
  gt_country: string | null;
  prompt_text: string | null;
  mean_reward: number | null;
  best_reward: number | null;
  group_metrics: string | null;
  trajectories: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const db = getDb();
    const rollouts = db
      .prepare(
        `
        SELECT
          r.id,
          r.run_id,
          r.step,
          r.group_idx,
          r.created_at as timestamp,
          r.image_path,
          r.gt_lat,
          r.gt_lon,
          r.city as gt_city,
          r.country as gt_country,
          r.prompt_text,
          r.mean_reward,
          r.best_reward,
          NULL as group_metrics,
          json_group_array(json_object(
            'id', t.id,
            'trajectory_idx', t.trajectory_idx,
            'reward', t.reward,
            'total_reward', NULL,
            'output_text', t.output_text,
            'output_tokens', t.output_tokens,
            'mean_logprob', NULL,
            'logprobs', t.logprobs,
            'pred_lat', t.pred_lat,
            'pred_lon', t.pred_lon,
            'distance_km', t.distance_km,
            'step_rewards', t.step_rewards,
            'format_valid', 1,
            'metrics', NULL
          )) as trajectories
        FROM rollouts r
        LEFT JOIN trajectories t ON t.rollout_id = r.id
        WHERE r.run_id = ?
        GROUP BY r.id
        ORDER BY r.step ASC, r.group_idx ASC
      `
      )
      .all(runId) as RolloutRow[];
    db.close();

    const parsed = rollouts.map((r) => ({
      ...r,
      trajectories: JSON.parse(r.trajectories),
    }));

    return NextResponse.json({ rollouts: parsed });
  } catch (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
