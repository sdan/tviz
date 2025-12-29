#!/usr/bin/env python3
"""
SL Loop with tviz

Minimal supervised fine-tuning loop using raw Tinker API.
Based on tinker_cookbook/recipes/sl_loop.py with tviz logging.

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/sl_loop.py
"""

import numpy as np
import tinker
from tinker import types
from datasets import load_dataset
from transformers import AutoTokenizer

from tviz import TvizLogger


# Config
MODEL_NAME = "meta-llama/Llama-3.1-8B"
BATCH_SIZE = 8
NUM_STEPS = 20
LEARNING_RATE = 1e-4
MAX_LENGTH = 2048
LORA_RANK = 32


def main():
    # Setup tviz
    logger = TvizLogger(run_name="sl_loop")
    logger.log_hparams({
        "model_name": MODEL_NAME,
        "batch_size": BATCH_SIZE,
        "learning_rate": LEARNING_RATE,
        "max_length": MAX_LENGTH,
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
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load No Robots dataset (instruction-following)
    print("Loading dataset...")
    dataset = load_dataset("HuggingFaceH4/no_robots", split="train")
    examples = list(dataset)
    print(f"Loaded {len(examples)} examples")

    # Training loop
    for step in range(NUM_STEPS):
        # Sample batch
        batch_indices = np.random.choice(len(examples), BATCH_SIZE, replace=False)
        batch = [examples[i] for i in batch_indices]

        training_data = []
        total_tokens = 0

        for example in batch:
            # Format conversation as prompt + completion
            messages = example["messages"]

            # Build prompt from all but last assistant message
            prompt_parts = []
            completion = ""

            for msg in messages:
                role = msg["role"]
                content = msg["content"]

                if role == "user":
                    prompt_parts.append(f"User: {content}")
                elif role == "assistant":
                    completion = f"Assistant: {content}"

            prompt_text = "\n\n".join(prompt_parts) + "\n\n"
            full_text = prompt_text + completion

            # Tokenize
            prompt_tokens = tokenizer.encode(prompt_text, add_special_tokens=False)
            full_tokens = tokenizer.encode(full_text, add_special_tokens=False)

            # Truncate if needed
            if len(full_tokens) > MAX_LENGTH:
                full_tokens = full_tokens[:MAX_LENGTH]
                # Adjust prompt tokens if needed
                if len(prompt_tokens) > len(full_tokens):
                    prompt_tokens = prompt_tokens[:len(full_tokens)]

            # Weights: 0 for prompt, 1 for completion (train on assistant only)
            num_completion_tokens = len(full_tokens) - len(prompt_tokens)
            weights = [0.0] * len(prompt_tokens) + [1.0] * num_completion_tokens

            total_tokens += len(full_tokens)

            training_data.append({
                "tokens": full_tokens,
                "weights": weights,
            })

        # Build Datum objects
        data = [
            types.Datum(
                model_input=types.ModelInput.from_ints(tokens=td["tokens"][:-1]),
                loss_fn_inputs=dict(
                    weights=td["weights"][1:],
                    target_tokens=td["tokens"][1:],
                ),
            )
            for td in training_data
        ]

        # Forward-backward pass
        fwdbwd_result = training_client.forward_backward(data, "cross_entropy").result()
        training_client.optim_step(types.AdamParams(learning_rate=LEARNING_RATE)).result()

        # Compute loss (negative log likelihood)
        all_logprobs = []
        all_weights = []
        for i, out in enumerate(fwdbwd_result.loss_fn_outputs):
            all_logprobs.extend(out["logprobs"].tolist())
            all_weights.extend(data[i].loss_fn_inputs["weights"].tolist())

        # Mean NLL over weighted tokens
        weighted_sum = sum(lp * w for lp, w in zip(all_logprobs, all_weights))
        weight_sum = sum(all_weights)
        mean_nll = -weighted_sum / max(weight_sum, 1e-8)

        # Log to tviz
        logger.log_metrics({
            "loss": mean_nll,
            "num_tokens": total_tokens,
            "num_sequences": len(data),
        }, step=step)

        print(f"Step {step}: loss={mean_nll:.4f}, tokens={total_tokens}")

    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")


if __name__ == "__main__":
    main()
