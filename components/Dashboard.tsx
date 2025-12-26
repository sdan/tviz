"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
} from "recharts";

// Chart colors
const CHART_COLORS = {
  red: "#ef4444",
  lime: "#84cc16",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  orange: "#f97316",
  teal: "#14b8a6",
  blue: "#2563eb",
  green: "#22c55e",
  purple: "#a855f7",
  pink: "#ec4899",
};

const MODEL_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.teal,
  CHART_COLORS.amber,
  CHART_COLORS.red,
];

interface DashboardStats {
  totalRuns: number;
  runningRuns: number;
  totalTokens: number;
  totalTrajectories: number;
  runs: {
    id: string;
    name: string;
    model: string;
    started_at: string;
    ended_at: string | null;
  }[];
  tokensPerDay: { day: string; tokens: number }[];
  modelTokens: Record<string, number>;
  perfStats: {
    avgTokensPerTurn: number | null;
    totalActionTokens: number | null;
    totalTurns: number | null;
    avgSamplingTime: number | null;
    avgStepTime: number | null;
  };
  perfOverTime: { day: string; tokens_per_turn: number | null; tokens_per_step: number | null; num_steps: number }[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function formatMetric(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function StatsCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-0 px-4 py-4">
        <CardDescription className="text-sm text-muted-foreground uppercase mb-0.5">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-normal">{value}</CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardHeader>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!stats || stats.totalRuns === 0) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-semibold">tviz Dashboard</h1>
        <Card className="p-12 text-center">
          <div className="text-muted-foreground mb-4">No training runs yet</div>
          <div className="text-sm text-muted-foreground">
            Start a training run with TvizLogger to see metrics here.
          </div>
          <pre className="mt-4 p-4 bg-muted rounded-lg text-left text-xs overflow-x-auto max-w-lg mx-auto">
{`from tviz import TvizLogger

logger = TvizLogger(run_name="my_run")
logger.log_hparams({"model": "Qwen3-8B"})
logger.log_metrics({"reward": 0.5}, step=i)
logger.log_rollouts(rollouts, step=i)
logger.close()`}
          </pre>
        </Card>
      </div>
    );
  }

  const avgTokensPerDay = stats.tokensPerDay.length > 0
    ? stats.tokensPerDay.reduce((sum, d) => sum + d.tokens, 0) / stats.tokensPerDay.length
    : 0;

  // Prepare model breakdown data for pie chart
  const modelData = Object.entries(stats.modelTokens)
    .map(([name, tokens], i) => ({
      name: name.length > 20 ? name.slice(0, 20) + "..." : name,
      fullName: name,
      tokens,
      color: MODEL_COLORS[i % MODEL_COLORS.length],
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // Format tokens per day for chart
  const tokenChartData = stats.tokensPerDay.map(d => ({
    date: formatDate(d.day),
    tokens: d.tokens / 1000, // Convert to K
  }));

  const perfChartData = stats.perfOverTime
    .filter((d) => d.tokens_per_step !== null)
    .map((d) => ({
      date: formatDate(d.day),
      tokensPerStep: d.tokens_per_step ?? 0,
    }));

  const hasPerfStats = [
    stats.perfStats.avgTokensPerTurn,
    stats.perfStats.totalActionTokens,
    stats.perfStats.avgSamplingTime,
    stats.perfStats.avgStepTime,
  ].some((value) => value !== null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">tviz Dashboard</h1>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Training Runs"
          value={stats.totalRuns.toString()}
          subtitle={stats.runningRuns > 0 ? `${stats.runningRuns} currently running` : undefined}
        />
        <StatsCard
          label="Total Tokens"
          value={formatNumber(stats.totalTokens)}
          subtitle={avgTokensPerDay > 0 ? `Avg per day: ${formatNumber(avgTokensPerDay)}` : undefined}
        />
        <StatsCard
          label="Rollouts"
          value={formatNumber(stats.totalTrajectories)}
          subtitle="Total rollout samples"
        />
        <StatsCard
          label="Models Used"
          value={Object.keys(stats.modelTokens).length.toString()}
          subtitle="Unique base models"
        />
      </div>

      {/* Two column: Tokens per day + Model breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tokens per Day Chart */}
        {tokenChartData.length > 0 && (
          <Card className="shadow-none pb-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Tokens per day</CardTitle>
              <CardDescription>Daily token generation (thousands)</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 pb-3">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={tokenChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      dy={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(v) => `${v}K`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => [`${(Number(value) * 1000).toLocaleString()} tokens`, "Tokens"]}
                    />
                    <Bar dataKey="tokens" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Model Breakdown */}
        {modelData.length > 0 && (
          <Card className="shadow-none pb-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Tokens by model</CardTitle>
              <CardDescription>Distribution across base models</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 pb-3">
              <div className="h-[240px] w-full flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="tokens"
                    >
                      {modelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                      formatter={(value) => [formatNumber(Number(value)), "Tokens"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {modelData.slice(0, 5).map((model, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block size-3 rounded-sm shrink-0"
                        style={{ backgroundColor: model.color }}
                      />
                      <span className="text-muted-foreground truncate flex-1" title={model.fullName}>
                        {model.name}
                      </span>
                      <span className="font-mono text-xs">{formatNumber(model.tokens)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(hasPerfStats || perfChartData.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Performance</h2>
            <span className="text-xs text-muted-foreground">Averages across logged steps</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Step metrics</CardTitle>
                <CardDescription>Token and timing averages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Avg tokens / turn</div>
                    <div className="font-mono">{formatMetric(stats.perfStats.avgTokensPerTurn, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total action tokens</div>
                    <div className="font-mono">
                      {stats.perfStats.totalActionTokens !== null
                        ? formatNumber(stats.perfStats.totalActionTokens)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total turns</div>
                    <div className="font-mono">
                      {stats.perfStats.totalTurns !== null
                        ? formatNumber(stats.perfStats.totalTurns)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg sampling time</div>
                    <div className="font-mono">{formatDuration(stats.perfStats.avgSamplingTime)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Avg step time</div>
                    <div className="font-mono">{formatDuration(stats.perfStats.avgStepTime)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {perfChartData.length > 0 && (
              <Card className="shadow-none pb-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Action tokens per step</CardTitle>
                  <CardDescription>Daily average</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 pb-3">
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={perfChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          dy={10}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        />
                        <Tooltip
                          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                          formatter={(value) => [formatNumber(Number(value)), "Tokens"]}
                        />
                        <Bar dataKey="tokensPerStep" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Training Runs Table */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-medium">Recent Training Runs</CardTitle>
              <CardDescription>View and manage your training runs</CardDescription>
            </div>
            <Link href="/training-runs" className="text-sm text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/training-run/${run.id}`} className="font-mono text-sm hover:underline">
                      {run.name || run.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {run.model}
                  </TableCell>
                  <TableCell>
                    <Badge variant={run.ended_at ? "secondary" : "green"}>
                      {run.ended_at ? "completed" : "running"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(run.started_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
