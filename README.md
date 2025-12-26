# tviz

Tinker Training Visualization - a modality-agnostic visualization library for RL training runs.

## Installation

```bash
pip install tviz
```

## Quick Start

```python
from tviz import TvizClient, tviz_sweep

# Option 1: Direct client usage
client = TvizClient("./tviz.db")
run_id = client.start_run("my_experiment", config={"lr": 1e-4})

for step in range(1000):
    client.log_step(step, {"reward_mean": 0.5, "loss": 0.1})
    client.log_rollout(step, rollouts)

client.end_run()

# Option 2: Context manager
with tviz_sweep("my_sweep", config={"lr": 1e-4}) as client:
    for step in range(1000):
        client.log_step(step, {"reward_mean": 0.5})
```

## Dashboard

Start the visualization dashboard:

```bash
cd tviz
bun install
bun dev
```

Open http://localhost:3000 to view your training runs.

## License

MIT
