"""
RL Basic with tviz

This is tinker_cookbook/recipes/rl_basic.py with tviz logging added.
Lines marked with # >>> tviz <<< are the additions.

Usage:
    export TINKER_API_KEY=your-api-key
    python examples/rl_basic_with_tviz.py
"""

import asyncio

import chz
import sys
from tinker_cookbook import cli_utils, model_info
from tinker_cookbook.recipes.math_rl.math_env import Gsm8kDatasetBuilder
from tinker_cookbook.rl import train

# >>> tviz <<<
from tviz import TvizLogger
# >>> tviz <<<


def build_config_blueprint() -> chz.Blueprint[train.Config]:
    model_name = "meta-llama/Llama-3.1-8B"
    renderer_name = model_info.get_recommended_renderer_name(model_name)
    builder = Gsm8kDatasetBuilder(
        batch_size=128,
        group_size=16,
        renderer_name=renderer_name,
        model_name_for_tokenizer=model_name,
    )

    return chz.Blueprint(train.Config).apply(
        {
            "model_name": model_name,
            "log_path": "/tmp/tinker-examples/rl_basic",
            "dataset_builder": builder,
            "learning_rate": 4e-5,
            "max_tokens": 256,
            "eval_every": 0,
        }
    )


def main(config: train.Config):
    # Avoid clobbering log dir from your previous run:
    cli_utils.check_log_dir(config.log_path, behavior_if_exists="ask")

    # >>> tviz <<<
    # Create tviz logger before training
    tviz_logger = TvizLogger(run_name="gsm8k_rl_basic")
    tviz_logger.log_hparams({
        "model_name": config.model_name,
        "learning_rate": config.learning_rate,
        "batch_size": 128,
        "group_size": 16,
        "max_tokens": config.max_tokens,
    })
    print(f"View training at: {tviz_logger.get_logger_url()}")
    # >>> tviz <<<

    asyncio.run(train.main(config))

    # >>> tviz <<<
    tviz_logger.close()
    print(f"Training complete! View at: {tviz_logger.get_logger_url()}")
    # >>> tviz <<<


if __name__ == "__main__":
    blueprint = build_config_blueprint()
    blueprint.make_from_argv(sys.argv[1:])
    main(blueprint.make())
