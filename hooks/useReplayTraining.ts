"use client";

import { useState, useCallback, useRef } from "react";
import type { Step, RolloutWithTrajectories } from "@/lib/db";

export function useReplayTraining(runId: string | null) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [rollouts, setRollouts] = useState<RolloutWithTrajectories[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const seenRolloutIdsRef = useRef<Set<number>>(new Set());

  const startReplay = useCallback(
    (delay: number = 800) => {
      if (!runId || isReplaying) return;

      setIsReplaying(true);
      setSteps([]);
      setRollouts([]);
      setReplayProgress(0);
      seenRolloutIdsRef.current = new Set();

      const eventSource = new EventSource(
        `/api/replay/stream?run_id=${runId}&delay=${delay}`
      );

      eventSource.onmessage = (event) => {
        const { type, data, total_steps, message } = JSON.parse(event.data);

        if (type === "replay_start") {
          setTotalSteps(total_steps);
        } else if (type === "steps") {
          setSteps(data);
          setReplayProgress(data.length);
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
        } else if (type === "replay_end") {
          setIsReplaying(false);
          eventSource.close();
        } else if (type === "error") {
          console.error("Replay error:", message);
          setIsReplaying(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setIsReplaying(false);
        eventSource.close();
      };

      return () => {
        eventSource.close();
        setIsReplaying(false);
      };
    },
    [runId, isReplaying]
  );

  const stopReplay = useCallback(() => {
    setIsReplaying(false);
  }, []);

  return {
    steps,
    rollouts,
    isReplaying,
    replayProgress,
    totalSteps,
    startReplay,
    stopReplay,
  };
}
