import { getDb, Run, Step } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const db = getDb();

    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as Run | undefined;

    if (!run) {
      db.close();
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const steps = db
      .prepare(
        `
        SELECT
          id, run_id, step, created_at as timestamp,
          loss, reward_mean,
          ac_tokens_per_turn, ob_tokens_per_turn,
          total_ac_tokens, total_turns,
          sampling_time_mean, time_total, extras
        FROM steps
        WHERE run_id = ?
        ORDER BY step
      `
      )
      .all(runId) as Step[];

    // Get rollout summary per step (lightweight)
    const stepSummaries = db
      .prepare(
        `
        SELECT
          step,
          COUNT(*) as rollout_count,
          MAX(best_reward) as best_reward,
          AVG(mean_reward) as mean_reward
        FROM rollouts
        WHERE run_id = ?
        GROUP BY step
        ORDER BY step
      `
      )
      .all(runId) as { step: number; rollout_count: number; best_reward: number; mean_reward: number }[];

    db.close();

    return NextResponse.json({ run, steps, stepSummaries });
  } catch (error) {
    const fs = require("fs");
    let taskFiles: string[] = [];
    try { taskFiles = fs.readdirSync("/var/task").slice(0, 30); } catch {}
    return NextResponse.json({ error: String(error), taskFiles, cwd: process.cwd() }, { status: 500 });
  }
}
