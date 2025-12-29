"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Run, Step, RolloutWithTrajectories } from "@/lib/db";

export function useRunData(runId: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [rollouts, setRollouts] = useState<RolloutWithTrajectories[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(-1); // -1 = show all
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load all data on mount
  useEffect(() => {
    if (!runId) return;

    setIsLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/runs/${runId}`).then((r) => r.json()),
      fetch(`/api/runs/${runId}/rollouts?limit=10000`).then((r) => r.json()),
    ])
      .then(([runData, rolloutsData]) => {
        setRun(runData.run);
        setSteps(runData.steps || []);
        setRollouts(rolloutsData.rollouts || []);
      })
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [runId]);

  // Replay: animate through steps
  const startReplay = useCallback(() => {
    if (steps.length === 0) return;
    setIsReplaying(true);
    setReplayStep(0);

    let current = 0;
    const maxStep = Math.max(...steps.map((s) => s.step));

    replayIntervalRef.current = setInterval(() => {
      current++;
      if (current > maxStep) {
        if (replayIntervalRef.current) {
          clearInterval(replayIntervalRef.current);
          replayIntervalRef.current = null;
        }
        setIsReplaying(false);
        setReplayStep(-1); // Show all when done
      } else {
        setReplayStep(current);
      }
    }, 150);
  }, [steps]);

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsReplaying(false);
    setReplayStep(-1); // Show all
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
    };
  }, []);

  return {
    run,
    steps,
    rollouts,
    isLoading,
    error,
    isReplaying,
    replayStep,
    startReplay,
    stopReplay,
    setReplayStep,
  };
}
