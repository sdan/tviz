"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend as RechartsLegend,
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
};

// Sample model data
const MODELS = [
  { name: "Qwen3-VL-30B-A3B-Instruct", color: CHART_COLORS.red, key: "model1" },
  { name: "Qwen3-235B-A22B-Instruct-2507", color: CHART_COLORS.lime, key: "model2" },
  { name: "Qwen3-4B-Instruct-2507", color: CHART_COLORS.amber, key: "model3" },
  { name: "Llama-3.1-8B-Instruct", color: CHART_COLORS.sky, key: "model4" },
  { name: "Qwen3-VL-235B-A22B-Instruct", color: CHART_COLORS.orange, key: "model5" },
  { name: "DeepSeek-V3.1", color: CHART_COLORS.blue, key: "model6" },
];

const TOKEN_TYPES = [
  { name: "Training", color: CHART_COLORS.blue, key: "training" },
  { name: "Sampler Prefill", color: CHART_COLORS.sky, key: "prefill" },
  { name: "Sampling", color: CHART_COLORS.teal, key: "sampling" },
];

// Sample training runs
const TRAINING_RUNS = [
  {
    id: "run_abc123",
    model: "Qwen3-VL-30B",
    status: "completed",
    tokens: "73.5M",
    duration: "2h 34m",
    created: "Dec 13, 2024",
  },
  {
    id: "run_def456",
    model: "Llama-3.1-8B",
    status: "running",
    tokens: "12.3M",
    duration: "45m",
    created: "Dec 14, 2024",
  },
  {
    id: "run_ghi789",
    model: "Qwen3-4B",
    status: "pending",
    tokens: "0",
    duration: "-",
    created: "Dec 14, 2024",
  },
];

// Dummy data generation
const generateTimeSeriesData = (days = 30) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      reward: 0.5 + Math.random() * 0.4 + (days - i) * 0.01,
      tokens: 2 + Math.random() * 5,
    });
  }
  return data;
};

const generateModelBreakdownData = (days = 30) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      model1: Math.random() * 10,
      model2: Math.random() * 5,
      model3: Math.random() * 8,
      model4: Math.random() * 12,
      model5: Math.random() * 3,
      model6: Math.random() * 7,
    });
  }
  return data;
};

const generateTokenTypeData = (days = 30) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      training: Math.random() * 50,
      prefill: Math.random() * 20,
      sampling: Math.random() * 30,
    });
  }
  return data;
};

const timeSeriesData = generateTimeSeriesData();
const modelData = generateModelBreakdownData();
const tokenTypeData = generateTokenTypeData();

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
        <CardDescription className="text-sm text-table-header uppercase mb-0.5">
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

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded-md shadow-sm text-xs">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="capitalize text-muted-foreground">
              {entry.name}:
            </span>
            <span className="font-mono">
              {entry.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const [modelBreakdownMode, setModelBreakdownMode] = useState("tokens");
  const [tokenTypeMode, setTokenTypeMode] = useState("tokens");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tinker-ing</h1>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Training Runs"
          value="24"
          subtitle="3 currently running"
        />
        <StatsCard
          label="Total Token Usage"
          value="86.04M"
          subtitle="Avg per day: 5.74M"
        />
        <StatsCard
          label="Avg Reward"
          value="0.847"
          subtitle="+12% from baseline"
        />
        <StatsCard
          label="Best Performance"
          value="0.92"
          subtitle="math_rl experiment"
        />
      </div>

      {/* Reward Over Time Chart */}
      <Card className="shadow-none pb-3">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-medium">
                Reward over time
              </CardTitle>
              <CardDescription>
                Training reward progression (0-1 scale)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 pb-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  dy={10}
                  interval={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  domain={[0, 1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="reward"
                  stroke={CHART_COLORS.blue}
                  fillOpacity={1}
                  fill="url(#colorReward)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Model Breakdown Chart */}
      <Card className="shadow-none pb-3">
        <CardHeader className="pt-4 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-medium">
                Model breakdown
              </CardTitle>
              <CardDescription>
                Stacked daily tokens by base model (Millions)
              </CardDescription>
            </div>
            <ToggleGroup
              value={modelBreakdownMode}
              onValueChange={setModelBreakdownMode}
              options={[
                { value: "usd", label: "USD" },
                { value: "tokens", label: "Tokens" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 pb-3">
          <div className="h-[384px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={modelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  dy={10}
                  interval={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                {MODELS.map((model) => (
                  <Bar
                    key={model.key}
                    dataKey={model.key}
                    stackId="a"
                    fill={model.color}
                    name={model.name}
                  />
                ))}
                <RechartsLegend
                  content={({ payload }) => (
                     <ul className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-4">
                      {payload?.map((entry, index) => (
                        <li key={`item-${index}`} className="flex items-center gap-2">
                           <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Token Type Breakdown Chart */}
      <Card className="shadow-none pb-3">
        <CardHeader className="pt-4 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-medium">
                Token type breakdown
              </CardTitle>
              <CardDescription>
                Stacked daily tokens by token type (Millions)
              </CardDescription>
            </div>
            <ToggleGroup
              value={tokenTypeMode}
              onValueChange={setTokenTypeMode}
              options={[
                { value: "usd", label: "USD" },
                { value: "tokens", label: "Tokens" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 pb-3">
          <div className="h-[384px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={tokenTypeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  dy={10}
                  interval={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                {TOKEN_TYPES.map((type) => (
                  <Bar
                    key={type.key}
                    dataKey={type.key}
                    stackId="a"
                    fill={type.color}
                    name={type.name}
                  />
                ))}
                <RechartsLegend
                   content={({ payload }) => (
                     <ul className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-4">
                      {payload?.map((entry, index) => (
                        <li key={`item-${index}`} className="flex items-center gap-2">
                           <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Training Runs Table */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-medium">
              Recent Training Runs
            </CardTitle>
            <CardDescription>
              View and manage your training runs
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TRAINING_RUNS.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-sm">{run.id}</TableCell>
                  <TableCell>{run.model}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "completed"
                          ? "green"
                          : run.status === "running"
                            ? "blue"
                            : "gray"
                      }
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{run.tokens}</TableCell>
                  <TableCell>{run.duration}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {run.created}
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
