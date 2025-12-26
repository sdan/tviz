"use client";

import { logprobToColor } from "./index";

interface TokenHeatmapProps {
  text: string;
  logprobs?: number[];
  tokens?: string[];
}

/**
 * Displays text with token-level logprob coloring.
 * Green = high probability, Red = low probability.
 */
export function TokenHeatmap({ text, logprobs, tokens }: TokenHeatmapProps) {
  // If no logprobs, just show plain text
  if (!logprobs || logprobs.length === 0) {
    return <span className="font-mono text-sm whitespace-pre-wrap">{text}</span>;
  }

  // If we have tokens, use them; otherwise split by whitespace (rough approximation)
  const displayTokens = tokens || text.split(/(\s+)/);

  return (
    <span className="font-mono text-sm">
      {displayTokens.map((token, i) => {
        const logprob = logprobs[i] ?? 0;
        const bg = logprobToColor(logprob);

        return (
          <span
            key={i}
            style={{ backgroundColor: bg }}
            className="px-0.5 rounded-sm"
            title={`logprob: ${logprob.toFixed(3)}`}
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}
