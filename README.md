<h1 align="center">tviz</h1>

Training visualization for Tinker. Watch your RL runs in real-time.

## Installation

```bash
pip install tviz
```

## Usage

```python
from tviz import TvizLogger

logger = TvizLogger("./tviz.db", run_name="math_rl")
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

logger = setup_logging(log_dir, wandb_project="my_project", config=config)
logger.loggers.append(TvizLogger("./tviz.db", run_name="math_rl"))

# training loop - tviz receives all log_metrics calls automatically
logger.log_metrics({"reward": mean_reward}, step=i)
```

## Dashboard

```bash
cd tviz && bun install && bun dev
```

Open `http://localhost:3000` to view training runs.

## Modalities

- **text**: LLM RL (math_rl, code_rl, chat_sl)
- **vision**: VLM tasks with images and maps

## License

MIT
