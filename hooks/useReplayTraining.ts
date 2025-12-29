"use client";

import { useState, useCallback, useEffect } from "react";
import type { Step, RolloutWithTrajectories } from "@/lib/db";

export function useReplayTraining(runId: string | null) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [rollouts, setRollouts] = useState<RolloutWithTrajectories[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load data on mount or when runId changes
  useEffect(() => {
    if (!runId) return;

    setIsLoading(true);
    fetch(`/api/runs/${runId}`)
      .then(res => res.json())
      .then(data => {
        setSteps(data.steps || []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [runId]);

  const startReplay = useCallback(async () => {
    if (!runId) return;
    setIsReplaying(true);

    // Load all rollouts when replay is clicked
    try {
      const res = await fetch(`/api/runs/${runId}/rollouts?limit=1000`);
      const data = await res.json();
      setRollouts(data.rollouts || []);
    } catch (e) {
      console.error("Error loading rollouts:", e);
    }
  }, [runId]);

  const stopReplay = useCallback(() => {
    setIsReplaying(false);
    setRollouts([]);
  }, []);

  return {
    steps,
    rollouts,
    isReplaying,
    isLoading,
    startReplay,
    stopReplay,
  };
}
