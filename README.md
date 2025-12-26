<h1 align="center">tviz</h1>
<div align="center">
  <img src="https://github.com/user-attachments/assets/58bb9adb-3866-40ad-a0fb-1b265c638743" alt="tviz dashboard" width="80%" />
</div>

tviz is a local dashboard for visualizing RL training runs. Similar to wandb, you add a logger to your training loop. Metrics, rollouts, and trajectories are stored in a local SQLite database and displayed in real-time.

## Installation

```bash
pip install tviz
```

## Usage

```python
from tviz import TvizLogger

logger = TvizLogger(run_name="math_rl")
logger.log_hparams(config)

for step in range(1000):
    logger.log_metrics({"reward": 0.5, "loss": 0.1}, step=step)
    logger.log_rollouts(rollouts, step=step)

logger.close()
```

### With Tinker Cookbook

```python
from tinker_cookbook.utils.ml_log import setup_logging
from tviz import TvizLogger
from tviz.adapters.tinker import from_tinker_batch

# Add TvizLogger to the multiplex logger
ml_logger = setup_logging(log_dir, wandb_project="my_project", config=config)
tviz_logger = TvizLogger(run_name="math_rl")
ml_logger.loggers.append(tviz_logger)

# In training loop - after rollouts:
rollouts = from_tinker_batch(trajectory_groups_P, tokenizer=tokenizer)
tviz_logger.log_rollouts(rollouts, step=i_batch)

# Metrics are logged automatically via multiplex
ml_logger.log_metrics(metrics, step=i_batch)
```

## Dashboard

```bash
cd tviz && bun install && bun dev
```

Open `http://localhost:3003` to view training runs.

By default, tviz stores data in `~/.tviz/tviz.db`. You can override this
with `TVIZ_DB_PATH`.

## Modalities

- **text**: LLM RL (math_rl, code_rl, chat_sl)
- **vision**: VLM tasks with images and maps

## License

MIT
