import {
  Notebook,
  NotebookHeader,
  MarkdownCell,
  CodeCell,
  TerminalCell,
  Callout,
} from "@/components/notebook-server";

const setupCode = `import re
import numpy as np
import tinker
from tinker import types
from datasets import load_dataset
from transformers import AutoTokenizer

from tviz import TvizLogger`;

const configCode = `# Config
model_name = "meta-llama/Llama-3.1-8B"
batch_size = 4
group_size = 4
learning_rate = 4e-5
max_tokens = 256

# Setup tviz
logger = TvizLogger(run_name="gsm8k_rl")
logger.log_hparams({
    "model_name": model_name,
    "batch_size": batch_size,
    "group_size": group_size,
    "learning_rate": learning_rate,
})
print(f"View training at: {logger.get_logger_url()}")`;

const tinkerSetupCode = `# Setup Tinker
service_client = tinker.ServiceClient()
training_client = service_client.create_lora_training_client(
    base_model=model_name,
    rank=32,
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Load GSM8K
dataset = load_dataset("gsm8k", "main", split="train")
problems = list(dataset)`;

const rewardCode = `def extract_boxed(text: str) -> str:
    """Extract answer from \\boxed{...} format."""
    match = re.search(r"\\boxed\\{([^}]+)\\}", text)
    if match:
        return match.group(1).strip()
    raise ValueError("No boxed answer found")

def compute_reward(response: str, answer: str) -> tuple[float, dict]:
    """Compute reward: 1[correct] + 0.1 * (1[formatted] - 1)"""
    try:
        pred = extract_boxed(response)
        is_formatted = True
        is_correct = pred.replace(",", "") == answer.replace(",", "")
    except ValueError:
        is_formatted = False
        is_correct = False

    reward = float(is_correct) + 0.1 * (float(is_formatted) - 1)
    return reward, {"format": float(is_formatted), "correct": float(is_correct)}`;

const loopCode1 = `for step in range(20):
    # Get sampling client with current weights
    sampling_client = training_client.save_weights_and_get_sampling_client(name=f"step_{step}")

    # Sample batch of problems
    batch = [problems[i] for i in np.random.choice(len(problems), batch_size)]

    all_rewards, training_data = [], []

    for problem in batch:
        question = problem["question"] + " Write your answer in \\boxed{} format."
        answer = problem["answer"].split("####")[-1].strip()

        prompt_text = f"User: {question}\\n\\nAssistant:"
        prompt_tokens = tokenizer.encode(prompt_text)

        # Sample multiple completions (group)
        result = sampling_client.sample(
            prompt=types.ModelInput.from_ints(prompt_tokens),
            sampling_params=types.SamplingParams(max_tokens=max_tokens, temperature=0.7),
            num_samples=group_size,
        ).result()

        # Compute rewards
        group_rewards = []
        for seq in result.sequences:
            response = tokenizer.decode(seq.tokens)
            reward, _ = compute_reward(response, answer)
            group_rewards.append(reward)
            all_rewards.append(reward)

            training_data.append({
                "tokens": prompt_tokens + list(seq.tokens),
                "weights": [0] * len(prompt_tokens) + [1] * len(seq.tokens),
                "advantage": reward - np.mean(group_rewards),
            })`;

const loopCode2 = `    # GRPO: train on positive advantages only
    positive_data = [td for td in training_data if td["advantage"] > 0]

    if positive_data:
        data = [
            types.Datum(
                model_input=types.ModelInput.from_ints(tokens=td["tokens"][:-1]),
                loss_fn_inputs=dict(
                    weights=[w * td["advantage"] for w in td["weights"][1:]],
                    target_tokens=td["tokens"][1:],
                ),
            )
            for td in positive_data
        ]

        # Forward-backward + optimizer step
        fwdbwd = training_client.forward_backward(data, "cross_entropy").result()
        training_client.optim_step(types.AdamParams(learning_rate=learning_rate)).result()

        # Compute loss
        logprobs = np.concatenate([out["logprobs"].tolist() for out in fwdbwd.loss_fn_outputs])
        weights = np.concatenate([d.loss_fn_inputs["weights"].tolist() for d in data])
        loss = -np.dot(logprobs, weights) / max(sum(weights), 1e-8)
    else:
        loss = 0.0

    # Log to tviz
    logger.log_metrics({
        "loss": loss,
        "reward_mean": np.mean(all_rewards),
    }, step=step)

    print(f"Step {step}: loss={loss:.4f}, reward={np.mean(all_rewards):.3f}")

logger.close()`;

export default function GettingStartedPage() {
  return (
    <Notebook>
      <NotebookHeader level={1}>Getting Started</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80 leading-relaxed">
          This guide walks through building a GSM8K math RL training loop
          with the{" "}
          <a href="https://tinker-docs.thinkingmachines.ai/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Tinker API
          </a>
          {" "}and tviz logging.
        </p>
      </MarkdownCell>

      <NotebookHeader level={2}>Prerequisites</NotebookHeader>

      <MarkdownCell>
        <ul className="list-disc list-inside text-foreground/80 space-y-1">
          <li>Python 3.10+</li>
          <li>Tinker API key from <a href="https://tinker-console.thinkingmachines.ai" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">tinker-console.thinkingmachines.ai</a></li>
          <li>Node.js 18+ or Bun (for the dashboard)</li>
        </ul>
      </MarkdownCell>

      <NotebookHeader level={2}>Installation</NotebookHeader>

      <TerminalCell code="pip install tviz tinker datasets transformers" />

      <TerminalCell code={`git clone https://github.com/sdan/tviz.git
cd tviz && bun install`} />

      <NotebookHeader level={2}>Setup</NotebookHeader>

      <CodeCell code={setupCode} executionCount={1} />

      <CodeCell code={configCode} executionCount={2} />

      <CodeCell
        code="# Output"
        executionCount={2}
        output={<span className="text-neutral-600">View training at: http://localhost:3003/training-run/4c9f1322</span>}
      />

      <CodeCell code={tinkerSetupCode} executionCount={3} />

      <NotebookHeader level={2}>Reward Function</NotebookHeader>

      <MarkdownCell>
        <p className="text-foreground/80">
          GSM8K answers must be in <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-sm font-mono">\boxed&#123;&#125;</code> format.
          The reward function is:
        </p>
        <div className="my-4 p-4 bg-neutral-50 rounded-lg font-mono text-sm">
          reward = 1[correct] + 0.1 × (1[formatted] − 1)
        </div>
      </MarkdownCell>

      <CodeCell code={rewardCode} executionCount={4} />

      <NotebookHeader level={2}>Training Loop</NotebookHeader>

      <CodeCell code={loopCode1} executionCount={5} />

      <CodeCell code={loopCode2} executionCount={6} />

      <CodeCell
        code="# Output"
        executionCount={6}
        output={
          <pre className="text-neutral-600">{`Step 0: loss=0.4972, reward=0.334
Step 1: loss=0.3841, reward=0.412
Step 2: loss=0.2956, reward=0.487
...`}</pre>
        }
      />

      <NotebookHeader level={2}>View Dashboard</NotebookHeader>

      <TerminalCell code="cd tviz && bun dev" />

      <MarkdownCell>
        <p className="text-foreground/80">
          Open <a href="http://localhost:3003" className="text-blue-600 hover:underline">http://localhost:3003</a> to see:
        </p>
        <ul className="list-disc list-inside text-foreground/70 mt-2 space-y-1">
          <li>Real-time reward curves</li>
          <li>Loss over training steps</li>
          <li>Hyperparameter tracking</li>
        </ul>
      </MarkdownCell>

      <Callout type="info">
        <p className="text-sm">
          <strong>Full example:</strong>{" "}
          <a href="https://github.com/sdan/tviz/blob/main/examples/gsm8k_rl.py" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
            examples/gsm8k_rl.py
          </a>
        </p>
      </Callout>

      <NotebookHeader level={2}>Next Steps</NotebookHeader>

      <MarkdownCell>
        <ul className="list-disc list-inside text-foreground/80 space-y-1">
          <li><a href="/docs/api" className="text-blue-600 hover:underline">API Reference</a> — All TvizLogger methods</li>
          <li><a href="/docs/tinker" className="text-blue-600 hover:underline">Tinker Integration</a> — Log rollouts and trajectories</li>
        </ul>
      </MarkdownCell>
    </Notebook>
  );
}
