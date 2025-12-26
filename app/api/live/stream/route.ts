import { getDb, Step } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RolloutRow {
  id: number;
  run_id: string;
  step: number;
  group_idx: number;
  timestamp: string;
  // Vision fields
  image_path: string | null;
  gt_lat: number | null;
  gt_lon: number | null;
  gt_city: string | null;
  gt_country: string | null;
  // Text fields
  prompt_text: string | null;
  mean_reward: number | null;
  best_reward: number | null;
  group_metrics: string | null;
  // Joined trajectories
  trajectories: string; // JSON string from json_group_array
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("run_id");
  const afterStep = parseInt(url.searchParams.get("after_step") || "-1");

  if (!runId) {
    return new Response("Missing run_id parameter", { status: 400 });
  }

  const encoder = new TextEncoder();
  let lastStep = afterStep;
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const poll = async () => {
        if (!isActive) return;

        try {
          // Heartbeat to keep the SSE connection alive even before data arrives.
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));

          const db = getDb();

          // Get new steps with all metrics
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
            WHERE run_id = ? AND step > ?
            ORDER BY step ASC LIMIT 100
          `
            )
            .all(runId, lastStep) as Step[];

          if (steps.length > 0) {
            lastStep = steps[steps.length - 1].step;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "steps", data: steps })}\n\n`)
            );
          }

          // Get rollouts + trajectories for latest step (joined)
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
            WHERE r.run_id = ? AND r.step = ?
            GROUP BY r.id
            ORDER BY r.group_idx ASC
          `
            )
            .all(runId, lastStep) as RolloutRow[];

          if (rollouts.length > 0) {
            // Parse nested JSON trajectories
            const parsed = rollouts.map((r) => ({
              ...r,
              trajectories: JSON.parse(r.trajectories),
            }));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "rollouts", data: parsed })}\n\n`)
            );
          }

          db.close();
        } catch (e) {
          // DB might not exist yet, that's ok
          console.error("SSE poll error:", e);
        }

        setTimeout(poll, 500); // Poll every 500ms
      };

      poll();
    },
    cancel() {
      isActive = false;
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
