"use client";

import { useState, useEffect, useRef } from "react";
import type { Step, RolloutWithTrajectories } from "@/lib/db";

export function useLiveTraining(runId: string | null) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [rollouts, setRollouts] = useState<RolloutWithTrajectories[]>([]);
  const [connected, setConnected] = useState(false);
  const seenRolloutIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!runId) return;

    setSteps([]);
    setRollouts([]);
    seenRolloutIdsRef.current = new Set();

    const eventSource = new EventSource(`/api/live/stream?run_id=${runId}`);

    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);

    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === "steps") {
        setSteps((prev) => [...prev, ...data]);
      } else if (type === "rollouts") {
        setRollouts((prev) => {
          const next = [...prev];
          const seen = seenRolloutIdsRef.current;
          for (const rollout of data as RolloutWithTrajectories[]) {
            if (!seen.has(rollout.id)) {
              next.push(rollout);
              seen.add(rollout.id);
            }
          }
          return next;
        });
      }
    };

    return () => eventSource.close();
  }, [runId]);

  return { steps, rollouts, connected };
}
