import {
  Notebook,
  NotebookHeader,
  MarkdownCell,
  TerminalCell,
  CodeCell,
  Callout,
} from "@/components/notebook-server";

const quickExampleCode = `from tviz import TvizLogger

# Create logger
logger = TvizLogger(run_name="my-training-run")
logger.log_hparams({"model": "llama-8b", "lr": 4e-5})

# In your training loop
for step in range(num_steps):
    # ... training code ...
    logger.log_metrics({"loss": loss, "reward": reward}, step=step)

# Cleanup
logger.close()`;

export default function DocsPage() {
  return (
    <Notebook>
      <NotebookHeader level={1}>tviz Documentation</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80 leading-relaxed">
          tviz is a local visualization dashboard for RL training runs. Think TensorBoard,
          but designed for{" "}
          <a href="https://thinkingmachines.ai/tinker/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Tinker</a>{" "}
          and reinforcement learning workflows.
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>Installation</NotebookHeader>

      <TerminalCell code="pip install tviz tinker tinker-cookbook" />

      <TerminalCell code={`git clone https://github.com/sdan/tviz.git
cd tviz && bun install`} />

      <NotebookHeader level={2}>Guides</NotebookHeader>

      <MarkdownCell>
        <div className="space-y-4">
          <div className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
            <a href="/docs/getting-started" className="block">
              <h3 className="font-semibold text-foreground mb-1">Getting Started</h3>
              <p className="text-sm text-foreground/70">
                Fine-tune Llama-3.1-8B on GSM8K math problems with tviz logging.
                Based on the tinker-cookbook RL basic recipe.
              </p>
            </a>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
            <a href="/docs/examples" className="block">
              <h3 className="font-semibold text-foreground mb-1">Examples</h3>
              <p className="text-sm text-foreground/70">
                Ready-to-run examples: GSM8K RL, supervised fine-tuning, custom loops.
              </p>
            </a>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
            <a href="/docs/api" className="block">
              <h3 className="font-semibold text-foreground mb-1">API Reference</h3>
              <p className="text-sm text-foreground/70">
                Complete TvizLogger API: log_metrics, log_hparams, log_rollout, and more.
              </p>
            </a>
          </div>

          <div className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
            <a href="/docs/tinker" className="block">
              <h3 className="font-semibold text-foreground mb-1">Tinker Integration</h3>
              <p className="text-sm text-foreground/70">
                Add tviz to tinker-cookbook's MultiplexLogger for seamless visualization.
              </p>
            </a>
          </div>
        </div>
      </MarkdownCell>

      <NotebookHeader level={2}>Quick Example</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80 mb-3">
          Add tviz to any Tinker training script with just a few lines:
        </p>
      </MarkdownCell>

      <CodeCell code={quickExampleCode} />

      <NotebookHeader level={2}>View Dashboard</NotebookHeader>

      <TerminalCell code="cd tviz && bun dev" />

      <MarkdownCell>
        <p className="text-foreground/80">
          Open <a href="http://localhost:3003" className="text-blue-600 hover:underline">http://localhost:3003</a> to view your training runs.
        </p>
      </MarkdownCell>

      <Callout type="info">
        <p className="text-sm">
          <strong>Data storage:</strong> By default, tviz stores data in{" "}
          <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-mono">~/.tviz/tviz.db</code>.
          Override with <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-mono">TVIZ_DB_PATH</code>.
        </p>
      </Callout>
    </Notebook>
  );
}
