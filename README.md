<h1 align="center">tviz</h1>
<div align="center">
  <img src="https://github.com/user-attachments/assets/58bb9adb-3866-40ad-a0fb-1b265c638743" alt="tviz dashboard" width="80%" />
</div>

tviz is a local dashboard for visualizing RL training runs. Similar to wandb, you add a logger to your training loop. Metrics, rollouts, and trajectories are stored in a local SQLite database and displayed in real-time.

## Installation

```bash
pip install tviz
```

## Quick Start

```python
from tviz import TvizLogger

logger = TvizLogger(run_name="gsm8k_rl")
logger.log_hparams({"model": "llama-3.2-1b", "lr": 1e-4})
print(f"View at: {logger.get_logger_url()}")

for step in range(100):
    # ... training code ...
    logger.log_metrics({"reward": 0.5, "loss": 0.1}, step=step)
    logger.log_rollouts(rollouts, step=step)

logger.close()
```

## Dashboard

```bash
git clone https://github.com/sdan/tviz.git
cd tviz && bun install && bun dev
```

Open `http://localhost:3003` to view training runs.

By default, tviz stores data in `~/.tviz/tviz.db`. Override with `TVIZ_DB_PATH`.

## API Reference

### TvizLogger

```python
TvizLogger(
    db_path: str | None = None,    # Path to SQLite db (default: ~/.tviz/tviz.db)
    run_name: str | None = None,   # Human-readable run name
    modality: str = "text"         # "text" or "vision"
)
```

### Methods

| Method | Description |
|--------|-------------|
| `log_hparams(config)` | Log hyperparameters dict |
| `log_metrics(metrics, step)` | Log scalar metrics for a step |
| `log_rollouts(rollouts, step)` | Log trajectory rollouts |
| `get_logger_url()` | Get dashboard URL for this run |
| `close()` | Mark run complete, close connection |

### Rollout Format

```python
logger.log_rollouts([
    {
        "group_idx": 0,
        "prompt_text": "What is 2+2?",
        "trajectories": [
            {"trajectory_idx": 0, "reward": 1.0, "output_text": "4"},
            {"trajectory_idx": 1, "reward": 0.0, "output_text": "5"},
        ],
    }
], step=100)
```

## Tinker Integration

```python
from tviz.adapters.tinker import from_tinker_batch

# After rollouts:
rollouts = from_tinker_batch(trajectory_groups_P, tokenizer=tokenizer)
logger.log_rollouts(rollouts, step=i_batch)
```

## Modalities

- **text**: LLM RL (math, code, chat)
- **vision**: VLM tasks with images and maps

## License

MIT
