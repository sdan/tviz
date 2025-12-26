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
    const steps = db
      .prepare(
        `
        SELECT
          id,
          run_id,
          step,
          created_at as timestamp,
          loss,
          reward_mean,
          ac_tokens_per_turn,
          ob_tokens_per_turn,
          total_ac_tokens,
          total_turns,
          sampling_time_mean,
          time_total,
          extras
        FROM steps
        WHERE run_id = ?
        ORDER BY step
      `
      )
      .all(runId) as Step[];
    db.close();

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({ run, steps });
  } catch (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
