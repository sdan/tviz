import {
  Notebook,
  NotebookHeader,
  MarkdownCell,
  CodeCell,
  TerminalCell,
  Callout,
} from "@/components/notebook-server";

const multiplexCode = `from tinker_cookbook.utils.ml_log import setup_logging
from tviz import TvizLogger

# Setup logging (WandB, Neptune, etc.)
ml_logger = setup_logging(
    log_dir="./logs",
    wandb_project="my_project",
    config=config
)

# >>> tviz <<<
# Add tviz to the multiplex logger
tviz_logger = TvizLogger(run_name="math_rl_experiment")
ml_logger.loggers.append(tviz_logger)
# >>> tviz <<<

# Metrics are logged automatically via multiplex
ml_logger.log_metrics(metrics, step=i_batch)`;

const rolloutsCode = `from tviz import TvizLogger
from tviz.adapters.tinker import from_tinker_batch

logger = TvizLogger(run_name="math_rl")

# In your training loop, after rollouts:
trajectory_groups = env.step(...)  # Returns list[TrajectoryGroup]

# >>> tviz <<<
# Convert to tviz format
rollouts = from_tinker_batch(
    trajectory_groups,
    tokenizer=tokenizer  # Optional: decodes tokens to text
)

# Log rollouts
logger.log_rollouts(rollouts, step=i_batch)
# >>> tviz <<<`;

export default function TinkerIntegrationPage() {
  return (
    <Notebook>
      <NotebookHeader level={1}>Tinker Integration</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80 leading-relaxed">
          Use tviz to visualize your{" "}
          <a href="https://thinkingmachines.ai/tinker/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Tinker</a>{" "}
          training runs.
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>Setup</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Install both packages:</p>
      </MarkdownCell>

      <TerminalCell code="pip install tviz tinker tinker-cookbook" />

      <NotebookHeader level={2}>With MultiplexLogger</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          The cleanest integration is adding TvizLogger to tinker-cookbook's MultiplexLogger:
        </p>
      </MarkdownCell>

      <CodeCell code={multiplexCode} executionCount={1} />

      <NotebookHeader level={2}>Logging Rollouts</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          tviz shines when visualizing rollouts. Use the Tinker adapter:
        </p>
      </MarkdownCell>

      <CodeCell code={rolloutsCode} executionCount={2} />

      <Callout type="info">
        <p className="text-sm">
          <strong>Full example:</strong> See the{" "}
          <a href="/docs/getting-started" className="text-blue-600 hover:underline">
            Getting Started guide
          </a>{" "}
          for a complete RL training loop using raw Tinker API with tviz.
        </p>
      </Callout>

      <NotebookHeader level={2}>View Dashboard</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">While training, start the dashboard:</p>
      </MarkdownCell>

      <TerminalCell code="cd tviz && bun dev" />

      <MarkdownCell>
        <p className="text-foreground/80">
          Open <a href="http://localhost:3003" className="text-blue-600 hover:underline">http://localhost:3003</a> to see:
        </p>
        <ul className="list-disc list-inside text-foreground/70 mt-2 space-y-1">
          <li>Real-time reward curves</li>
          <li>Loss and KL divergence plots</li>
          <li>Individual rollout trajectories</li>
          <li>Token-level logprobs (if logged)</li>
        </ul>
      </MarkdownCell>

      <Callout type="info">
        <p className="text-sm">
          <strong>Full working example:</strong>{" "}
          <a href="https://github.com/sdan/tviz/blob/main/examples/gsm8k_rl.py" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            examples/gsm8k_rl.py
          </a>{" "}
          — Complete GSM8K RL training with tviz logging.
        </p>
      </Callout>
    </Notebook>
  );
}
