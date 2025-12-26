<h1 align="center">tviz</h1>

Training visualization for Tinker. Watch your RL runs in real-time.

## Installation

```bash
pip install tviz
```

## Usage

```python
from tviz import tviz_sweep

with tviz_sweep("math_rl_exp", config={"lr": 1e-4}) as client:
    for step in range(1000):
        client.log_step(step, {"reward_mean": 0.5, "loss": 0.1})
        client.log_rollout(step, rollouts)
```

### With Tinker Cookbook

```python
from tviz import TvizClient
from tviz.adapters.tinker import from_tinker_batch

client = TvizClient()
client.start_run("math_rl", config)

# In training loop:
client.log_rollout(i_batch, from_tinker_batch(trajectory_groups))
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

