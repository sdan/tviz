#!/usr/bin/env python3
"""
GSM8K RL Training with tviz - including logprobs

This script logs rollouts with per-token logprobs to demonstrate
the TokenHeatmap visualization.

Usage:
    python examples/gsm8k_with_logprobs.py
"""

import re
import numpy as np
import tinker
from tinker import types
from datasets import load_dataset
from transformers import AutoTokenizer

from tviz import TvizLogger


def extract_boxed(text: str) -> str:
    """Extract answer from \\boxed{...} format."""
    match = re.search(r"\\boxed\{([^}]+)\}", text)
    if match:
        return match.group(1).strip()
    raise ValueError("No boxed answer found")


def check_format(response: str) -> bool:
    """Check if response has \\boxed{} format."""
    try:
        extract_boxed(response)
        return True
    except ValueError:
        return False


def check_correct(response: str, answer: str) -> bool:
    """Check if extracted answer matches ground truth."""
    try:
        pred = extract_boxed(response)
        pred_clean = pred.replace(",", "").strip()
        ans_clean = answer.replace(",", "").strip()
        try:
            return abs(float(pred_clean) - float(ans_clean)) < 1e-6
        except ValueError:
            return pred_clean.lower() == ans_clean.lower()
    except ValueError:
        return False


def compute_reward(response: str, answer: str) -> tuple[float, dict]:
    """Compute reward: 1[correct] + 0.1 * (1[formatted] - 1)"""
    is_formatted = check_format(response)
    is_correct = check_correct(response, answer) if is_formatted else False
    reward = float(is_correct) + 0.1 * (float(is_formatted) - 1)
    return reward, {"format": float(is_formatted), "correct": float(is_correct)}


def extract_gsm8k_answer(answer_text: str) -> str:
    """Extract numeric answer from GSM8K answer field."""
    match = re.search(r"####\s*([\d,]+)", answer_text)
    if match:
        return match.group(1).replace(",", "")
    return answer_text.strip()


def main():
    # Config - small run for demo
    model_name = "Qwen/Qwen3-8B"
    batch_size = 4
    group_size = 4
    num_steps = 5
    max_tokens = 256

    # Setup tviz
    logger = TvizLogger(run_name="gsm8k_logprobs_demo", modality="text")
    logger.log_hparams({
        "model_name": model_name,
        "batch_size": batch_size,
        "group_size": group_size,
        "max_tokens": max_tokens,
    })
    print(f"View training at: {logger.get_logger_url()}")

    # Setup Tinker
    service_client = tinker.ServiceClient()
    training_client = service_client.create_lora_training_client(
        base_model=model_name,
        rank=32,
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    # Load GSM8K
    dataset = load_dataset("gsm8k", "main", split="train")
    problems = list(dataset)

    # Few-shot prefix
    fewshot_prefix = (
        "User: How many r's are in strawberry? Write your answer in \\boxed{} format.\n\n"
        "Assistant: Let me count: s-t-r-a-w-b-e-r-r-y. "
        "The letter 'r' appears at positions 3, 8, and 9. \\boxed{3}\n\n"
    )

    # Training loop
    for step in range(num_steps):
        print(f"\n=== Step {step} ===")

        # Get sampling client with current weights
        sampling_client = training_client.save_weights_and_get_sampling_client(
            name=f"gsm8k_step_{step}"
        )

        # Sample batch of problems
        batch_indices = np.random.choice(len(problems), batch_size, replace=False)
        batch = [problems[i] for i in batch_indices]

        all_rewards = []
        all_correct = []
        rollouts = []

        for group_idx, problem in enumerate(batch):
            question = problem["question"] + " Write your answer in \\boxed{} format."
            answer = extract_gsm8k_answer(problem["answer"])

            # Build prompt
            prompt_text = fewshot_prefix + f"User: {question}\n\nAssistant:"
            prompt_tokens = tokenizer.encode(prompt_text)
            prompt = types.ModelInput.from_ints(prompt_tokens)

            # Sample multiple completions with logprobs
            params = types.SamplingParams(
                max_tokens=max_tokens,
                temperature=0.7,
                stop=["\n\nUser:", "\n\n\n"],
            )
            result = sampling_client.sample(
                prompt=prompt,
                sampling_params=params,
                num_samples=group_size,
                include_logprobs=True,  # Request logprobs!
            ).result()

            # Build trajectories for this rollout group
            trajectories = []
            group_rewards = []

            for traj_idx, seq in enumerate(result.sequences):
                response = tokenizer.decode(seq.tokens)
                reward, metrics = compute_reward(response, answer)
                group_rewards.append(reward)
                all_rewards.append(reward)
                all_correct.append(metrics["correct"])

                # Extract logprobs from sequence
                logprobs = None
                if hasattr(seq, 'logprobs') and seq.logprobs is not None:
                    logprobs = list(seq.logprobs)
                elif hasattr(seq, 'token_logprobs') and seq.token_logprobs is not None:
                    logprobs = list(seq.token_logprobs)

                trajectories.append({
                    "trajectory_idx": traj_idx,
                    "reward": reward,
                    "output_text": response,
                    "output_tokens": list(seq.tokens),
                    "logprobs": logprobs,
                    "metrics": metrics,
                })

            # Build rollout
            rollouts.append({
                "group_idx": group_idx,
                "prompt_text": prompt_text,
                "trajectories": trajectories,
                "mean_reward": float(np.mean(group_rewards)),
                "best_reward": float(max(group_rewards)),
            })

        # Log rollouts with logprobs
        logger.log_rollouts(rollouts, step=step)

        # Log metrics
        mean_reward = np.mean(all_rewards)
        mean_correct = np.mean(all_correct)

        logger.log_metrics({
            "reward_mean": mean_reward,
            "env/all/correct": mean_correct,
        }, step=step)

        print(f"Step {step}: reward={mean_reward:.3f}, correct={mean_correct:.3f}")

        # Check if we got logprobs
        sample_traj = rollouts[0]["trajectories"][0]
        if sample_traj.get("logprobs"):
            print(f"  Logprobs: {len(sample_traj['logprobs'])} tokens")
        else:
            print("  No logprobs captured")

    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")


if __name__ == "__main__":
    main()
