import { getDb, Step } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("run_id");
  const delay = parseInt(url.searchParams.get("delay") || "1000"); // ms between steps

  if (!runId) {
    return new Response("Missing run_id parameter", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const db = getDb();

        // Get all steps for this run with all metrics
        const allSteps = db
          .prepare(
            `
            SELECT
              id,
              run_id,
              step,
              created_at as timestamp,
              loss,
              reward_mean,
              reward_std,
              kl_divergence,
              entropy,
              learning_rate,
              ac_tokens_per_turn,
              ob_tokens_per_turn,
              total_ac_tokens,
              total_turns,
              sampling_time_mean,
              time_total,
              frac_mixed,
              frac_all_good,
              frac_all_bad,
              extras
            FROM steps
            WHERE run_id = ?
            ORDER BY step ASC
          `
          )
          .all(runId) as Step[];

        // Get all unique step numbers that have rollouts
        const stepNumbers = db
          .prepare("SELECT DISTINCT step FROM rollouts WHERE run_id = ? ORDER BY step ASC")
          .all(runId) as { step: number }[];

        db.close();

        if (allSteps.length === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "No data for this run" })}\n\n`)
          );
          controller.close();
          return;
        }

        // Send initial message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "replay_start", total_steps: allSteps.length })}\n\n`)
        );

        // Replay each step with delay
        for (let i = 0; i < allSteps.length; i++) {
          const step = allSteps[i];

          // Send step data
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "steps", data: allSteps.slice(0, i + 1) })}\n\n`)
          );

          // Get rollouts for this step
          const db2 = getDb();
          const rollouts = db2
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
              WHERE r.run_id = ? AND r.step = ?
              GROUP BY r.id
              ORDER BY r.group_idx ASC
            `
            )
            .all(runId, step.step) as RolloutRow[];
          db2.close();

          if (rollouts.length > 0) {
            const parsed = rollouts.map((r) => ({
              ...r,
              trajectories: JSON.parse(r.trajectories),
            }));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "rollouts", data: parsed })}\n\n`)
            );
          }

          // Wait before next step (except for last one)
          if (i < allSteps.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        // Send completion message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "replay_end" })}\n\n`)
        );
        controller.close();
      } catch (e) {
        console.error("Replay error:", e);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(e) })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
