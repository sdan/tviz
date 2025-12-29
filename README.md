<h1 align="center">tviz</h1>
<div align="center">
  <img src="https://github.com/user-attachments/assets/58bb9adb-3866-40ad-a0fb-1b265c638743" alt="tviz dashboard" width="80%" />
</div>

tviz is a local dashboard for visualizing RL training runs with [Tinker](https://thinkingmachines.ai/tinker). Similar to wandb, you add a logger to your training loop. Metrics, rollouts, and trajectories are stored in a local SQLite database and displayed in real-time.

## install

```bash
pip install tviz
```

## usage

```python
from tviz import TvizLogger
from tviz.adapters.tinker import from_tinker_batch

logger = TvizLogger(run_name="gsm8k_grpo")
logger.log_hparams({"model": "llama-3.2-1b", "lr": 1e-4})

for step in range(100):
    # your tinker training loop
    trajectory_groups = rollout(...)

    # log to tviz
    rollouts = from_tinker_batch(trajectory_groups, tokenizer=tokenizer)
    logger.log_rollouts(rollouts, step=step)
    logger.log_metrics({"reward": avg_reward, "loss": loss}, step=step)

logger.close()
```

## run the dashboard

```bash
git clone https://github.com/sdan/tviz.git
cd tviz && bun install && bun dev
```

open http://localhost:3003 to view your runs.

data is stored in `~/.tviz/tviz.db` by default.

## examples

```bash
export TINKER_API_KEY=your-api-key
python examples/quickstart.py
```

check out [`examples/`](./examples) for complete scripts:
- `quickstart.py` - pig latin SFT, minimal tviz integration
- `gsm8k_rl.py` - math reasoning with GRPO
- `rl_loop.py` - generic RL loop with rollout logging

## docs

full API reference and guides: [tviz.sdan.io/docs](https://tviz.sdan.io/docs)

## license

MIT
