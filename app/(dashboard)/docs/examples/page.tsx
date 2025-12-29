import {
  Notebook,
  NotebookHeader,
  MarkdownCell,
  CodeCell,
  TerminalCell,
  Callout,
} from "@/components/notebook-server";

const gsm8kCode = `from tviz import TvizLogger

logger = TvizLogger(run_name="gsm8k_rl")
logger.log_hparams({"model": "llama-8b", "lr": 4e-5})

for step in range(num_steps):
    # Sample, compute rewards, GRPO update...
    logger.log_metrics({
        "loss": loss,
        "reward_mean": np.mean(rewards),
        "env/all/correct": accuracy,
    }, step=step)

logger.close()`;

const rlLoopCode = `# Config
MODEL_NAME = "meta-llama/Llama-3.1-8B"
BATCH_SIZE = 8
GROUP_SIZE = 4
LEARNING_RATE = 4e-5

# Setup
logger = TvizLogger(run_name="rl_loop")
training_client = service_client.create_lora_training_client(
    base_model=MODEL_NAME, rank=32
)

for step in range(NUM_STEPS):
    sampling_client = training_client.save_weights_and_get_sampling_client(f"step_{step}")

    # Sample completions, compute rewards, build training data...
    for problem in batch:
        result = sampling_client.sample(prompt, params, num_samples=GROUP_SIZE).result()
        for seq in result.sequences:
            reward = get_reward(tokenizer.decode(seq.tokens), answer)
            # Build datum with advantage weighting...

    # GRPO: train on positive advantages
    training_client.forward_backward(data, "cross_entropy").result()
    training_client.optim_step(types.AdamParams(learning_rate=LEARNING_RATE)).result()

    logger.log_metrics({"loss": loss, "reward_mean": mean_reward}, step=step)`;

const slLoopCode = `# Config
MODEL_NAME = "meta-llama/Llama-3.1-8B"
BATCH_SIZE = 8
LEARNING_RATE = 1e-4

# Setup
logger = TvizLogger(run_name="sl_loop")
training_client = service_client.create_lora_training_client(
    base_model=MODEL_NAME, rank=32
)
dataset = load_dataset("HuggingFaceH4/no_robots", split="train")

for step in range(NUM_STEPS):
    # Build training data from conversations
    for example in batch:
        # Tokenize, set weights=0 for prompt, weights=1 for completion
        data.append(types.Datum(
            model_input=types.ModelInput.from_ints(tokens[:-1]),
            loss_fn_inputs=dict(weights=weights[1:], target_tokens=tokens[1:]),
        ))

    # Forward-backward + optimizer step
    fwdbwd = training_client.forward_backward(data, "cross_entropy").result()
    training_client.optim_step(types.AdamParams(learning_rate=LEARNING_RATE)).result()

    # Compute mean NLL
    mean_nll = -sum(lp * w for lp, w in zip(logprobs, weights)) / sum(weights)
    logger.log_metrics({"loss": mean_nll}, step=step)`;

export default function ExamplesPage() {
  return (
    <Notebook>
      <NotebookHeader level={1}>Examples</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80 leading-relaxed">
          Ready-to-run examples for common training scenarios with tviz.
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>GSM8K RL (GRPO)</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          Fine-tune Llama-3.1-8B on math problems using Group Relative Policy Optimization.
          Uses raw Tinker API without tinker-cookbook.
        </p>
      </MarkdownCell>

      <TerminalCell code="python examples/gsm8k_rl.py" />

      <CodeCell code={gsm8kCode} executionCount={1} />

      <MarkdownCell>
        <p className="text-sm text-foreground/60">
          <a href="https://github.com/sdan/tviz/blob/main/examples/gsm8k_rl.py" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            View full source →
          </a>
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>RL Loop</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          Minimal RL training loop on GSM8K math with GRPO. Uses raw Tinker API.
        </p>
      </MarkdownCell>

      <TerminalCell code="python examples/rl_loop.py" />

      <CodeCell code={rlLoopCode} executionCount={2} />

      <MarkdownCell>
        <p className="text-sm text-foreground/60">
          <a href="https://github.com/sdan/tviz/blob/main/examples/rl_loop.py" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            View full source →
          </a>
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>SL Loop</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          Minimal supervised fine-tuning loop on NoRobots. Uses raw Tinker API.
        </p>
      </MarkdownCell>

      <TerminalCell code="python examples/sl_loop.py" />

      <CodeCell code={slLoopCode} executionCount={3} />

      <MarkdownCell>
        <p className="text-sm text-foreground/60">
          <a href="https://github.com/sdan/tviz/blob/main/examples/sl_loop.py" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            View full source →
          </a>
        </p>
      </MarkdownCell>

      <Callout type="info">
        <p className="text-sm">
          <strong>More examples:</strong> Check the{" "}
          <a href="https://github.com/sdan/tviz/tree/main/examples" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            examples/
          </a>{" "}
          directory for complete, runnable scripts.
        </p>
      </Callout>
    </Notebook>
  );
}
