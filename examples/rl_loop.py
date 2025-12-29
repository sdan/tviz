#!/usr/bin/env python3
"""
RL Loop with tviz

Minimal reinforcement learning training loop using raw Tinker API.
Based on tinker_cookbook/recipes/rl_loop.py with tviz logging.

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/rl_loop.py
"""

import re
import numpy as np
import tinker
from tinker import types
from datasets import load_dataset
from transformers import AutoTokenizer

from tviz import TvizLogger


# Config
MODEL_NAME = "meta-llama/Llama-3.1-8B"
BATCH_SIZE = 8  # Number of problems per step
GROUP_SIZE = 4  # Rollouts per problem
NUM_STEPS = 20
LEARNING_RATE = 4e-5
MAX_TOKENS = 256
LORA_RANK = 32


def extract_boxed(text: str) -> str:
    """Extract answer from \\boxed{...} format."""
    match = re.search(r"\\boxed\{([^}]+)\}", text)
    if match:
        return match.group(1).strip()
    raise ValueError("No boxed answer found")


def get_reward(response: str, answer: str) -> float:
    """Compute reward: 1.0 if correct, 0.0 otherwise."""
    try:
        pred = extract_boxed(response)
        pred_clean = pred.replace(",", "").strip()
        ans_clean = answer.replace(",", "").strip()
        try:
            return 1.0 if abs(float(pred_clean) - float(ans_clean)) < 1e-6 else 0.0
        except ValueError:
            return 1.0 if pred_clean.lower() == ans_clean.lower() else 0.0
    except ValueError:
        return 0.0


def extract_gsm8k_answer(answer_text: str) -> str:
    """Extract numeric answer from GSM8K answer field."""
    match = re.search(r"####\s*([\d,]+)", answer_text)
    if match:
        return match.group(1).replace(",", "")
    return answer_text.strip()


def main():
    # Setup tviz
    logger = TvizLogger(run_name="rl_loop")
    logger.log_hparams({
        "model_name": MODEL_NAME,
        "batch_size": BATCH_SIZE,
        "group_size": GROUP_SIZE,
        "learning_rate": LEARNING_RATE,
        "max_tokens": MAX_TOKENS,
        "lora_rank": LORA_RANK,
    })
    print(f"View training at: {logger.get_logger_url()}")

    # Setup Tinker
    service_client = tinker.ServiceClient()
    training_client = service_client.create_lora_training_client(
        base_model=MODEL_NAME,
        rank=LORA_RANK,
    )
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    # Load GSM8K
    dataset = load_dataset("gsm8k", "main", split="train")
    problems = list(dataset)

    # Training loop
    for step in range(NUM_STEPS):
        # Get sampling client with current weights
        sampling_client = training_client.save_weights_and_get_sampling_client(name=f"step_{step}")

        # Sample batch of problems
        batch_indices = np.random.choice(len(problems), BATCH_SIZE, replace=False)
        batch = [problems[i] for i in batch_indices]

        all_rewards = []
        training_data = []

        for problem in batch:
            question = problem["question"] + " Write your answer in \\boxed{} format."
            answer = extract_gsm8k_answer(problem["answer"])

            # Build prompt
            prompt_text = f"User: {question}\n\nAssistant:"
            prompt_tokens = tokenizer.encode(prompt_text)
            prompt = types.ModelInput.from_ints(prompt_tokens)

            # Sample multiple completions (group)
            params = types.SamplingParams(
                max_tokens=MAX_TOKENS,
                temperature=0.7,
                stop=["\n\nUser:", "\n\n\n"],
            )
            result = sampling_client.sample(
                prompt=prompt,
                sampling_params=params,
                num_samples=GROUP_SIZE,
            ).result()

            # Compute rewards
            group_rewards = []
            for seq in result.sequences:
                response = tokenizer.decode(seq.tokens)
                reward = get_reward(response, answer)
                group_rewards.append(reward)
                all_rewards.append(reward)

                # Build training datum
                full_tokens = prompt_tokens + list(seq.tokens)
                weights = [0] * len(prompt_tokens) + [1] * len(seq.tokens)

                training_data.append({
                    "tokens": full_tokens,
                    "weights": weights,
                    "reward": reward,
                })

            # Compute advantages (GRPO: reward - mean)
            mean_reward = np.mean(group_rewards)
            for td in training_data[-GROUP_SIZE:]:
                td["advantage"] = td["reward"] - mean_reward

        # Filter to positive advantages only
        positive_data = [td for td in training_data if td["advantage"] > 0]

        if positive_data:
            # Build Datum objects
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

            # Forward-backward pass
            fwdbwd_result = training_client.forward_backward(data, "cross_entropy").result()
            training_client.optim_step(types.AdamParams(learning_rate=LEARNING_RATE)).result()

            # Compute loss
            logprobs = np.concatenate([out["logprobs"].tolist() for out in fwdbwd_result.loss_fn_outputs])
            weights = np.concatenate([d.loss_fn_inputs["weights"].tolist() for d in data])
            loss = -np.dot(logprobs, weights) / max(sum(weights), 1e-8)
        else:
            loss = 0.0

        # Compute metrics
        mean_reward = np.mean(all_rewards)
        accuracy = np.mean([1.0 if r > 0 else 0.0 for r in all_rewards])

        # Log to tviz
        logger.log_metrics({
            "loss": loss,
            "reward_mean": mean_reward,
            "env/all/correct": accuracy,
        }, step=step)

        print(f"Step {step}: loss={loss:.4f}, reward={mean_reward:.3f}, correct={accuracy:.3f}")

    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")


if __name__ == "__main__":
    main()
