#!/usr/bin/env python3
"""
Tinker Quickstart with tviz

This is the Tinker Pig Latin tutorial with tviz logging added.
Lines marked with # >>> tviz <<< show the additions.

Based on: https://tinker-docs.thinkingmachines.ai/

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/quickstart.py
"""

import numpy as np
import tinker
from tinker import types

# >>> tviz <<<
from tviz import TvizLogger
# >>> tviz <<<


def main():
    # === Setup ===

    service_client = tinker.ServiceClient()

    base_model = "Qwen/Qwen3-VL-30B-A3B-Instruct"
    training_client = service_client.create_lora_training_client(
        base_model=base_model
    )
    tokenizer = training_client.get_tokenizer()

    # >>> tviz <<<
    # Create tviz logger
    logger = TvizLogger(run_name="pig-latin-quickstart")
    logger.log_hparams({
        "base_model": base_model,
        "learning_rate": 1e-4,
        "num_steps": 6,
    })
    print(f"View training at: {logger.get_logger_url()}")
    # >>> tviz <<<

    # === Training Data ===

    examples = [
        {"input": "banana split", "output": "anana-bay plit-say"},
        {"input": "quantum physics", "output": "uantum-qay ysics-phay"},
        {"input": "donut shop", "output": "onut-day op-shay"},
        {"input": "pickle jar", "output": "ickle-pay ar-jay"},
        {"input": "space exploration", "output": "ace-spay exploration-way"},
        {"input": "rubber duck", "output": "ubber-ray uck-day"},
        {"input": "coding wizard", "output": "oding-cay izard-way"},
    ]

    def process_example(example: dict) -> types.Datum:
        prompt = f"English: {example['input']}\nPig Latin:"
        prompt_tokens = tokenizer.encode(prompt, add_special_tokens=True)
        prompt_weights = [0] * len(prompt_tokens)

        completion_tokens = tokenizer.encode(f" {example['output']}\n\n", add_special_tokens=False)
        completion_weights = [1] * len(completion_tokens)

        tokens = prompt_tokens + completion_tokens
        weights = prompt_weights + completion_weights

        input_tokens = tokens[:-1]
        target_tokens = tokens[1:]
        weights = weights[1:]

        return types.Datum(
            model_input=types.ModelInput.from_ints(tokens=input_tokens),
            loss_fn_inputs=dict(weights=weights, target_tokens=target_tokens)
        )

    processed_examples = [process_example(ex) for ex in examples]

    # === Training Loop ===

    for step in range(6):
        fwdbwd_future = training_client.forward_backward(processed_examples, "cross_entropy")
        optim_future = training_client.optim_step(types.AdamParams(learning_rate=1e-4))

        fwdbwd_result = fwdbwd_future.result()
        optim_result = optim_future.result()

        # Compute loss
        logprobs = np.concatenate([output['logprobs'].tolist() for output in fwdbwd_result.loss_fn_outputs])
        weights = np.concatenate([example.loss_fn_inputs['weights'].tolist() for example in processed_examples])
        loss = -np.dot(logprobs, weights) / weights.sum()

        print(f"Step {step}: loss={loss:.4f}")

        # >>> tviz <<<
        # Log metrics to tviz
        logger.log_metrics({
            "loss": loss,
        }, step=step)
        # >>> tviz <<<

    # === Sampling ===

    sampling_client = training_client.save_weights_and_get_sampling_client(name='pig-latin-model')

    prompt = types.ModelInput.from_ints(tokenizer.encode("English: coffee break\nPig Latin:"))
    params = types.SamplingParams(max_tokens=20, temperature=0.0, stop=["\n"])
    result = sampling_client.sample(prompt=prompt, sampling_params=params, num_samples=8).result()

    print("\nSampling results:")
    for i, seq in enumerate(result.sequences):
        print(f"  {i}: {repr(tokenizer.decode(seq.tokens))}")

    # >>> tviz <<<
    logger.close()
    print(f"\nTraining complete! View at: {logger.get_logger_url()}")
    # >>> tviz <<<


if __name__ == "__main__":
    main()
