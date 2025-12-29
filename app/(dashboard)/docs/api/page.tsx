import {
  Notebook,
  NotebookHeader,
  MarkdownCell,
  CodeCell,
} from "@/components/notebook-server";

const importCode = `from tviz import TvizLogger`;

const constructorCode = `TvizLogger(
    db_path: str | None = None,
    run_name: str | None = None,
    modality: str = "text"
)`;

const hparamsCode = `logger.log_hparams({
    "learning_rate": 1e-4,
    "batch_size": 32,
    "model": "meta-llama/Llama-3.2-1B",
    "rank": 32,
})`;

const metricsCode = `logger.log_metrics({
    "reward": 0.75,
    "loss": 0.23,
    "kl_divergence": 0.01,
    "entropy": 1.5,
}, step=100)`;

const rolloutsCode = `logger.log_rollouts([
    {
        "group_idx": 0,
        "prompt_text": "What is 2+2?",
        "trajectories": [
            {"trajectory_idx": 0, "reward": 1.0, "output_text": "4"},
            {"trajectory_idx": 1, "reward": 0.0, "output_text": "5"},
        ],
    }
], step=100)`;

const adapterImportCode = `from tviz.adapters.tinker import from_tinker_batch`;

const adapterCode = `# After your rollout step:
rollouts = from_tinker_batch(
    trajectory_groups_P,
    tokenizer=tokenizer  # Decodes tokens to readable text
)
logger.log_rollouts(rollouts, step=i_batch)`;

export default function APIReferencePage() {
  return (
    <Notebook>
      <NotebookHeader level={1}>API Reference</NotebookHeader>

      <NotebookHeader level={2}>TvizLogger</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">The main class for logging training data.</p>
      </MarkdownCell>

      <CodeCell code={importCode} executionCount={1} />

      <NotebookHeader level={3}>Constructor</NotebookHeader>

      <CodeCell code={constructorCode} />

      <MarkdownCell>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 pr-4 font-medium">Default</th>
                <th className="text-left py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-sm">db_path</td>
                <td className="py-2 pr-4 font-mono text-sm">str | None</td>
                <td className="py-2 pr-4 font-mono text-sm">None</td>
                <td className="py-2">Path to SQLite database. Falls back to TVIZ_DB_PATH env var, then ~/.tviz/tviz.db</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-sm">run_name</td>
                <td className="py-2 pr-4 font-mono text-sm">str | None</td>
                <td className="py-2 pr-4 font-mono text-sm">None</td>
                <td className="py-2">Human-readable name for the run. Auto-generated if not provided</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-sm">modality</td>
                <td className="py-2 pr-4 font-mono text-sm">str</td>
                <td className="py-2 pr-4 font-mono text-sm">"text"</td>
                <td className="py-2">Either "text" for LLM tasks or "vision" for VLM tasks</td>
              </tr>
            </tbody>
          </table>
        </div>
      </MarkdownCell>

      <NotebookHeader level={2}>Methods</NotebookHeader>

      <NotebookHeader level={3}>log_hparams(config)</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Log hyperparameters/configuration. Call once at the start of training.</p>
      </MarkdownCell>

      <CodeCell code={hparamsCode} executionCount={2} />

      <NotebookHeader level={3}>log_metrics(metrics, step)</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Log scalar metrics for a training step.</p>
      </MarkdownCell>

      <CodeCell code={metricsCode} executionCount={3} />

      <MarkdownCell>
        <p className="text-foreground/80 mb-2"><strong>Built-in metric keys</strong> (automatically extracted):</p>
        <ul className="list-disc list-inside text-foreground/70 text-sm space-y-0.5">
          <li><code className="bg-neutral-100 px-1 rounded">reward_mean</code>, <code className="bg-neutral-100 px-1 rounded">reward_std</code></li>
          <li><code className="bg-neutral-100 px-1 rounded">loss</code></li>
          <li><code className="bg-neutral-100 px-1 rounded">kl_divergence</code>, <code className="bg-neutral-100 px-1 rounded">kl</code></li>
          <li><code className="bg-neutral-100 px-1 rounded">entropy</code></li>
          <li><code className="bg-neutral-100 px-1 rounded">learning_rate</code>, <code className="bg-neutral-100 px-1 rounded">lr</code></li>
          <li><code className="bg-neutral-100 px-1 rounded">frac_mixed</code>, <code className="bg-neutral-100 px-1 rounded">frac_all_good</code>, <code className="bg-neutral-100 px-1 rounded">frac_all_bad</code></li>
        </ul>
        <p className="text-foreground/60 text-sm mt-2">Other metrics are stored in an extras JSON field.</p>
      </MarkdownCell>

      <NotebookHeader level={3}>log_rollouts(rollouts, step)</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Log trajectory rollouts for visualization.</p>
      </MarkdownCell>

      <CodeCell code={rolloutsCode} executionCount={4} />

      <NotebookHeader level={3}>close()</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Mark run as complete and close the database connection.</p>
      </MarkdownCell>

      <CodeCell code="logger.close()" executionCount={5} />

      <NotebookHeader level={3}>get_logger_url()</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Get the URL to view this run in the dashboard.</p>
      </MarkdownCell>

      <CodeCell
        code="logger.get_logger_url()"
        executionCount={6}
        output={<span className="text-neutral-600">'http://localhost:3003/training-run/a1b2c3d4'</span>}
      />

      <NotebookHeader level={2}>Tinker Adapter</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Convert Tinker Cookbook data structures to tviz format.</p>
      </MarkdownCell>

      <CodeCell code={adapterImportCode} executionCount={7} />

      <NotebookHeader level={3}>from_tinker_batch(groups, prompts, tokenizer)</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">Convert a batch of Tinker TrajectoryGroups to tviz format.</p>
      </MarkdownCell>

      <CodeCell code={adapterCode} executionCount={8} />

      <MarkdownCell>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-sm">groups</td>
                <td className="py-2 pr-4 font-mono text-sm">list[TrajectoryGroup]</td>
                <td className="py-2">Trajectory groups from prepare_minibatch</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-mono text-sm">prompts</td>
                <td className="py-2 pr-4 font-mono text-sm">list[str] | None</td>
                <td className="py-2">Optional prompt texts (one per group)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-sm">tokenizer</td>
                <td className="py-2 pr-4 font-mono text-sm">Any | None</td>
                <td className="py-2">Optional tokenizer for decoding tokens</td>
              </tr>
            </tbody>
          </table>
        </div>
      </MarkdownCell>
    </Notebook>
  );
}
