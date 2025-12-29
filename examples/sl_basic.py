#!/usr/bin/env python3
"""
SL Basic with tviz

Supervised fine-tuning on a simple dataset using raw Tinker API with tviz logging.

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/sl_basic.py
"""

import numpy as np
import tinker
from tinker import types
from transformers import AutoTokenizer

from tviz import TvizLogger


def main():
    # Config
    model_name = "meta-llama/Llama-3.1-8B"
    batch_size = 4
    num_steps = 20
    learning_rate = 2e-4
    max_length = 512

    # Setup tviz
    logger = TvizLogger(run_name="sl_basic")
    logger.log_hparams({
        "model_name": model_name,
        "batch_size": batch_size,
        "learning_rate": learning_rate,
        "max_length": max_length,
    })
    print(f"View training at: {logger.get_logger_url()}")

    # Setup Tinker
    service_client = tinker.ServiceClient()
    training_client = service_client.create_lora_training_client(
        base_model=model_name,
        rank=32,
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Simple instruction-following dataset
    examples = [
        {"instruction": "What is 2 + 2?", "response": "2 + 2 = 4"},
        {"instruction": "Say hello in French.", "response": "Bonjour!"},
        {"instruction": "What is the capital of France?", "response": "The capital of France is Paris."},
        {"instruction": "Count to 5.", "response": "1, 2, 3, 4, 5"},
        {"instruction": "What color is the sky?", "response": "The sky is blue."},
        {"instruction": "What is 10 * 5?", "response": "10 * 5 = 50"},
        {"instruction": "Say goodbye in Spanish.", "response": "¡Adiós!"},
        {"instruction": "What is the capital of Japan?", "response": "The capital of Japan is Tokyo."},
        {"instruction": "Count backwards from 3.", "response": "3, 2, 1"},
        {"instruction": "What is the largest planet?", "response": "Jupiter is the largest planet in our solar system."},
    ]

    # Training loop
    for step in range(num_steps):
        # Sample a batch
        batch_indices = np.random.choice(len(examples), batch_size, replace=True)
        batch = [examples[i] for i in batch_indices]

        training_data = []
        for example in batch:
            # Format as chat
            prompt = f"User: {example['instruction']}\n\nAssistant:"
            completion = f" {example['response']}"
            full_text = prompt + completion

            # Tokenize
            prompt_tokens = tokenizer.encode(prompt, add_special_tokens=False)
            full_tokens = tokenizer.encode(full_text, add_special_tokens=False)

            # Weights: 0 for prompt, 1 for completion
            weights = [0] * len(prompt_tokens) + [1] * (len(full_tokens) - len(prompt_tokens))

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
        training_client.optim_step(types.AdamParams(learning_rate=learning_rate)).result()

        # Compute loss
        logprobs = np.concatenate([out["logprobs"].tolist() for out in fwdbwd_result.loss_fn_outputs])
        weights = np.concatenate([d.loss_fn_inputs["weights"].tolist() for d in data])
        loss = -np.dot(logprobs, weights) / max(sum(weights), 1e-8)

        # Log to tviz
        logger.log_metrics({
            "loss": loss,
        }, step=step)

        print(f"Step {step}: loss={loss:.4f}")

    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")


if __name__ == "__main__":
    main()
