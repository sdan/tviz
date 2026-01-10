"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Run, Step, RolloutWithTrajectories } from "@/lib/db";

const POLL_INTERVAL_MS = 3000;

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data (used for initial load and polling)
  const fetchData = useCallback(async (isInitial = false) => {
    if (!runId) return;

    if (isInitial) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const [runData, rolloutsData] = await Promise.all([
        fetch(`/api/runs/${runId}`).then((r) => r.json()),
        fetch(`/api/runs/${runId}/rollouts?limit=10000`).then((r) => r.json()),
      ]);

      setRun(runData.run);
      setSteps(runData.steps || []);
      setRollouts(rolloutsData.rollouts || []);

      // Return whether run is still live (for polling logic)
      return !runData.run?.ended_at;
    } catch (e) {
      if (isInitial) {
        setError(e instanceof Error ? e.message : "Failed to fetch");
      }
      return false;
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [runId]);

  // Initial load + start polling for live runs
  useEffect(() => {
    if (!runId) return;

    // Clear any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Initial fetch
    fetchData(true).then((isLive) => {
      // Start polling if run is live
      if (isLive) {
        pollIntervalRef.current = setInterval(async () => {
          const stillLive = await fetchData(false);
          // Stop polling when run ends
          if (!stillLive && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, POLL_INTERVAL_MS);
      }
    });

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [runId, fetchData]);

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
