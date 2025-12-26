import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();

    // Get run counts
    const totalRuns = db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number };
    const runningRuns = db.prepare("SELECT COUNT(*) as count FROM runs WHERE ended_at IS NULL").get() as { count: number };

    // Get total tokens (sum of output tokens across all trajectories)
    const tokenStats = db.prepare(`
      SELECT
        COUNT(*) as total_trajectories,
        SUM(json_array_length(output_tokens)) as total_tokens
      FROM trajectories
      WHERE output_tokens IS NOT NULL
    `).get() as { total_trajectories: number; total_tokens: number | null };

    // Get reward stats
    const rewardStats = db.prepare(`
      SELECT
        AVG(reward) as avg_reward,
        MAX(reward) as best_reward
      FROM trajectories
    `).get() as { avg_reward: number | null; best_reward: number | null };

    // Get runs by model (from config JSON)
    const runs = db.prepare(`
      SELECT id, name, config, started_at, ended_at
      FROM runs
      ORDER BY started_at DESC
    `).all() as { id: string; name: string; config: string | null; started_at: string; ended_at: string | null }[];

    // Parse model from config for each run
    const runsWithModel = runs.map(run => {
      let model = "Unknown";
      if (run.config) {
        try {
          const config = JSON.parse(run.config);
          model = config.model || config.base_model || "Unknown";
          // Shorten model name
          if (model.includes("/")) {
            model = model.split("/").pop() || model;
          }
        } catch {}
      }
      return { ...run, model };
    });

    // Get tokens per day (approximate from trajectories created_at)
    const tokensPerDay = db.prepare(`
      SELECT
        date(created_at) as day,
        SUM(json_array_length(output_tokens)) as tokens
      FROM trajectories
      WHERE output_tokens IS NOT NULL
      GROUP BY date(created_at)
      ORDER BY day DESC
      LIMIT 30
    `).all() as { day: string; tokens: number }[];

    // Get tokens per model (aggregate by model name)
    const tokensByModel = db.prepare(`
      SELECT
        r.config,
        SUM(json_array_length(t.output_tokens)) as tokens,
        COUNT(DISTINCT ro.id) as rollouts
      FROM runs r
      JOIN rollouts ro ON ro.run_id = r.id
      JOIN trajectories t ON t.rollout_id = ro.id
      WHERE t.output_tokens IS NOT NULL
      GROUP BY r.config
    `).all() as { config: string | null; tokens: number; rollouts: number }[];

    // Parse and aggregate by model
    const modelTokens: Record<string, number> = {};
    for (const row of tokensByModel) {
      let model = "Unknown";
      if (row.config) {
        try {
          const config = JSON.parse(row.config);
          model = config.model || config.base_model || "Unknown";
          if (model.includes("/")) {
            model = model.split("/").pop() || model;
          }
        } catch {}
      }
      modelTokens[model] = (modelTokens[model] || 0) + (row.tokens || 0);
    }

    // Get performance metrics from steps table
    const perfStats = db.prepare(`
      SELECT
        AVG(ac_tokens_per_turn) as avg_tokens_per_turn,
        SUM(total_ac_tokens) as total_action_tokens,
        SUM(total_turns) as total_turns,
        AVG(sampling_time_mean) as avg_sampling_time,
        AVG(time_total) as avg_step_time
      FROM steps
      WHERE ac_tokens_per_turn IS NOT NULL
         OR total_ac_tokens IS NOT NULL
    `).get() as {
      avg_tokens_per_turn: number | null;
      total_action_tokens: number | null;
      total_turns: number | null;
      avg_sampling_time: number | null;
      avg_step_time: number | null;
    };

    // Get performance over time (tokens per step by day)
    const perfOverTime = db.prepare(`
      SELECT
        date(created_at) as day,
        AVG(ac_tokens_per_turn) as tokens_per_turn,
        AVG(total_ac_tokens) as tokens_per_step,
        COUNT(*) as num_steps
      FROM steps
      WHERE total_ac_tokens IS NOT NULL
      GROUP BY date(created_at)
      ORDER BY day ASC
      LIMIT 30
    `).all() as { day: string; tokens_per_turn: number | null; tokens_per_step: number | null; num_steps: number }[];

    db.close();

    return NextResponse.json({
      totalRuns: totalRuns.count,
      runningRuns: runningRuns.count,
      totalTokens: tokenStats.total_tokens || 0,
      totalTrajectories: tokenStats.total_trajectories || 0,
      runs: runsWithModel.slice(0, 10), // Last 10 runs
      tokensPerDay: tokensPerDay.reverse(), // Oldest first for chart
      modelTokens,
      // Performance metrics
      perfStats: {
        avgTokensPerTurn: perfStats.avg_tokens_per_turn,
        totalActionTokens: perfStats.total_action_tokens,
        totalTurns: perfStats.total_turns,
        avgSamplingTime: perfStats.avg_sampling_time,
        avgStepTime: perfStats.avg_step_time,
      },
      perfOverTime,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    // DB doesn't exist yet
    return NextResponse.json({
      totalRuns: 0,
      runningRuns: 0,
      totalTokens: 0,
      totalTrajectories: 0,
      runs: [],
      tokensPerDay: [],
      modelTokens: {},
      perfStats: {
        avgTokensPerTurn: null,
        totalActionTokens: null,
        totalTurns: null,
        avgSamplingTime: null,
        avgStepTime: null,
      },
      perfOverTime: [],
    });
  }
}
