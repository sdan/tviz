"use client";

import { useState, useEffect } from "react";
import type { Step, RolloutWithTrajectories } from "@/lib/db";

export function useLiveTraining(runId: string | null) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [rollouts, setRollouts] = useState<RolloutWithTrajectories[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(`/api/live/stream?run_id=${runId}`);

    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);

    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === "steps") {
        setSteps((prev) => [...prev, ...data]);
      } else if (type === "rollouts") {
        setRollouts(data); // Replace with latest step's rollouts
      }
    };

    return () => eventSource.close();
  }, [runId]);

  return { steps, rollouts, connected };
}
