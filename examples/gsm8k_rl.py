#!/usr/bin/env python3
"""
GSM8K RL Training with tviz

Fine-tune Llama-3.1-8B on GSM8K math problems using GRPO.
This example uses the raw Tinker API with tviz logging.

Reward function:
    reward = 1[correct] + 0.1 * (1[formatted] - 1)

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/gsm8k_rl.py
"""

import re
import numpy as np
import tinker
from tinker import types
from datasets import load_dataset
from transformers import AutoTokenizer

from tviz import TvizLogger


# =============================================================================
# GSM8K Utilities
# =============================================================================

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


# =============================================================================
# Training
# =============================================================================

def main():
    # Config
    model_name = "meta-llama/Llama-3.1-8B"
    batch_size = 8
    group_size = 4
    num_steps = 20
    learning_rate = 4e-5
    max_tokens = 256

    # Setup tviz
    logger = TvizLogger(run_name="gsm8k_rl")
    logger.log_hparams({
        "model_name": model_name,
        "batch_size": batch_size,
        "group_size": group_size,
        "learning_rate": learning_rate,
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
        # Get sampling client with current weights
        sampling_client = training_client.save_weights_and_get_sampling_client(name=f"step_{step}")

        # Sample batch of problems
        batch_indices = np.random.choice(len(problems), batch_size, replace=False)
        batch = [problems[i] for i in batch_indices]

        all_rewards = []
        all_correct = []
        all_format = []
        training_data = []

        for problem in batch:
            question = problem["question"] + " Write your answer in \\boxed{} format."
            answer = extract_gsm8k_answer(problem["answer"])

            # Build prompt
            prompt_text = fewshot_prefix + f"User: {question}\n\nAssistant:"
            prompt_tokens = tokenizer.encode(prompt_text)
            prompt = types.ModelInput.from_ints(prompt_tokens)

            # Sample multiple completions (group)
            params = types.SamplingParams(
                max_tokens=max_tokens,
                temperature=0.7,
                stop=["\n\nUser:", "\n\n\n"],
            )
            result = sampling_client.sample(
                prompt=prompt,
                sampling_params=params,
                num_samples=group_size,
                include_prompt_logprobs=True,
            ).result()

            # Compute rewards and collect training data
            group_rewards = []
            for seq in result.sequences:
                response = tokenizer.decode(seq.tokens)
                reward, metrics = compute_reward(response, answer)
                group_rewards.append(reward)
                all_rewards.append(reward)
                all_correct.append(metrics["correct"])
                all_format.append(metrics["format"])

                # Build training datum with full sequence
                full_tokens = prompt_tokens + list(seq.tokens)
                weights = [0] * len(prompt_tokens) + [1] * len(seq.tokens)

                training_data.append({
                    "tokens": full_tokens,
                    "weights": weights,
                    "reward": reward,
                })

            # Compute advantages (GRPO: reward - mean)
            mean_reward = np.mean(group_rewards)
            for i, td in enumerate(training_data[-group_size:]):
                td["advantage"] = td["reward"] - mean_reward

        # Filter to positive advantages only (simplified GRPO)
        positive_data = [td for td in training_data if td["advantage"] > 0]

        if positive_data:
            # Build Datum objects for training
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
            fwdbwd_future = training_client.forward_backward(data, "cross_entropy")
            optim_future = training_client.optim_step(types.AdamParams(learning_rate=learning_rate))

            fwdbwd_result = fwdbwd_future.result()
            optim_result = optim_future.result()

            # Compute loss
            logprobs = np.concatenate([out["logprobs"].tolist() for out in fwdbwd_result.loss_fn_outputs])
            weights = np.concatenate([d.loss_fn_inputs["weights"].tolist() for d in data])
            loss = -np.dot(logprobs, weights) / max(sum(weights), 1e-8)
        else:
            loss = 0.0

        # Compute batch metrics
        mean_reward = np.mean(all_rewards)
        mean_correct = np.mean(all_correct)
        mean_format = np.mean(all_format)

        # Log to tviz
        logger.log_metrics({
            "loss": loss,
            "reward_mean": mean_reward,
            "env/all/correct": mean_correct,
            "env/all/format": mean_format,
        }, step=step)

        print(f"Step {step}: loss={loss:.4f}, reward={mean_reward:.3f}, correct={mean_correct:.3f}")

    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")


if __name__ == "__main__":
    main()
