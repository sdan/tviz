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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const step = url.searchParams.get("step");

    const db = getDb();

    let query = `
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
          'output_text', t.output_text,
          'output_tokens', t.output_tokens,
          'logprobs', json(t.logprobs),
          'pred_lat', t.pred_lat,
          'pred_lon', t.pred_lon,
          'distance_km', t.distance_km,
          'step_rewards', t.step_rewards,
          'format_valid', 1
        )) as trajectories
      FROM rollouts r
      LEFT JOIN trajectories t ON t.rollout_id = r.id
      WHERE r.run_id = ?
    `;

    const queryParams: (string | number)[] = [runId];

    if (step !== null) {
      query += ` AND r.step = ?`;
      queryParams.push(parseInt(step));
    }

    query += ` GROUP BY r.id ORDER BY r.step ASC, r.group_idx ASC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    // Get total count for pagination
    const totalQuery = step !== null
      ? `SELECT COUNT(*) as total FROM rollouts WHERE run_id = ? AND step = ?`
      : `SELECT COUNT(*) as total FROM rollouts WHERE run_id = ?`;
    const totalParams = step !== null ? [runId, parseInt(step)] : [runId];
    const { total } = db.prepare(totalQuery).get(...totalParams) as { total: number };

    const rollouts = db.prepare(query).all(...queryParams) as RolloutRow[];
    db.close();

    const parsed = rollouts.map((r) => ({
      ...r,
      trajectories: JSON.parse(r.trajectories),
    }));

    return NextResponse.json({
      rollouts: parsed,
      total,
      hasMore: offset + rollouts.length < total,
      nextOffset: offset + rollouts.length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
