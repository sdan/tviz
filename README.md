<h1 align="center">tviz</h1>
<div align="center">
  <img src="https://github.com/user-attachments/assets/58bb9adb-3866-40ad-a0fb-1b265c638743" alt="tviz dashboard" width="80%" />
</div>

tviz is a local dashboard for visualizing RL training runs with [Tinker](https://thinkingmachines.ai/tinker). Similar to wandb, you add a logger to your training loop. Metrics, rollouts, and trajectories are stored in a local SQLite database and displayed in real-time.

## Installation

1. Install the Python client via `pip install tviz`
2. Clone and run the dashboard:
```bash
git clone https://github.com/sdan/tviz.git
cd tviz && bun install && bun dev
```
3. Open http://localhost:3003 to view your runs.

Data is stored in `~/.tviz/tviz.db` by default.

## Usage

```python
from tviz import TvizLogger
from tviz.adapters.tinker import from_tinker_batch

logger = TvizLogger(run_name="gsm8k_grpo")
logger.log_hparams({"model": "llama-3.2-1b", "lr": 1e-4})

for step in range(100):
    # Your Tinker training loop
    trajectory_groups = rollout(...)

    # Log to tviz
    rollouts = from_tinker_batch(trajectory_groups, tokenizer=tokenizer)
    logger.log_rollouts(rollouts, step=step)
    logger.log_metrics({"reward": avg_reward, "loss": loss}, step=step)

logger.close()
```

## Examples

We include several examples in the [`examples/`](./examples) folder:

1. **[Quickstart](examples/quickstart.py)**: Pig Latin SFT with minimal tviz integration.
2. **[GSM8K RL](examples/gsm8k_rl.py)**: Math reasoning with GRPO.
3. **[RL Loop](examples/rl_loop.py)**: Generic RL loop with rollout logging.

To run an example:
```bash
export TINKER_API_KEY=your-api-key
python examples/quickstart.py
```

## Documentation

For the full API reference and guides, visit [tviz.sdan.io/docs](https://tviz.sdan.io/docs).

## License

MIT
