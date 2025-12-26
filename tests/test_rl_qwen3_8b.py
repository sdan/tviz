"""
Test tviz integration with text RL using Qwen3-8B on GSM8K.

This test:
1. Creates a TvizLogger
2. Loads Qwen3-8B and runs rollouts on GSM8K math problems
3. Logs trajectories via the tinker adapter
4. Verifies data in SQLite

Default configuration (env-configurable):
- TVIZ_BATCH_SIZE: 12 problems per step
- TVIZ_GROUP_SIZE: 16 trajectories per problem (G)
- TVIZ_NUM_STEPS: 10 training steps
- TVIZ_MAX_TOKENS: 768 tokens per trajectory
- Total: 12 × 16 × 10 = 1,920 trajectories

Requires TINKER_API_KEY environment variable.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add master-tinker to path
sys.path.insert(0, "/Users/sdan/Developer/master-tinker")


async def test_rl_qwen3_8b():
    """Run text RL rollouts with Qwen3-8B on GSM8K."""
    import tinker
    from tinker_cookbook import renderers, model_info
    from tinker_cookbook.completers import TinkerTokenCompleter
    from tinker_cookbook.recipes.math_rl.math_env import Gsm8kDatasetBuilder
    from tinker_cookbook.rl.types import TrajectoryGroup, Trajectory, Transition
    from tinker_cookbook.tokenizer_utils import get_tokenizer

    from tviz import TvizLogger
    from tviz.adapters.tinker import from_tinker_batch

    print("=" * 60)
    print("tviz Test: Text RL with Qwen3-8B on GSM8K")
    print("=" * 60)

    # Config - scaled up for richer visualization data
    model_name = "Qwen/Qwen3-8B"
    batch_size = int(os.environ.get("TVIZ_BATCH_SIZE", "12"))  # 12 problems per step
    group_size = int(os.environ.get("TVIZ_GROUP_SIZE", "16"))  # G=16 trajectories per problem
    max_tokens = int(os.environ.get("TVIZ_MAX_TOKENS", "768"))  # longer responses
    num_steps = int(os.environ.get("TVIZ_NUM_STEPS", "10"))  # 10 steps

    # Initialize tviz logger (uses TVIZ_DB_PATH or default ~/.tviz/tviz.db)
    logger = TvizLogger(run_name="gsm8k_qwen3_8b", modality="text")
    db_path = Path(logger.db_path)
    config = {
        "model": model_name,
        "task": "gsm8k",
        "batch_size": batch_size,
        "group_size": group_size,
        "max_tokens": max_tokens,
    }
    logger.log_hparams(config)
    print(f"\n✓ TvizLogger initialized")
    print(f"  Dashboard: {logger.get_logger_url()}")
    print(f"  DB path: {db_path}")

    # Create tinker clients
    service_client = tinker.ServiceClient()
    sampling_client = await service_client.create_sampling_client_async(base_model=model_name)
    tokenizer = get_tokenizer(model_name)
    print(f"✓ Model loaded: {model_name}")

    # Create dataset
    renderer_name = model_info.get_recommended_renderer_name(model_name)
    dataset_builder = Gsm8kDatasetBuilder(
        batch_size=batch_size,
        group_size=group_size,
        renderer_name=renderer_name,
        model_name_for_tokenizer=model_name,
    )
    dataset, _ = await dataset_builder()
    print(f"✓ Dataset: {len(dataset)} batches")

    # Create completer
    completer = TinkerTokenCompleter(
        sampling_client=sampling_client,
        max_tokens=max_tokens,
        temperature=1.0,
    )

    total_batches = len(dataset)
    steps_to_run = min(num_steps, total_batches)
    rollouts_per_step = batch_size * group_size
    total_expected = steps_to_run * rollouts_per_step

    print(f"\n✓ Running {steps_to_run} steps (of {total_batches} available)")
    print(f"  Each step: {batch_size} problems × {group_size} trajectories = {rollouts_per_step} rollouts")
    print(f"  Total expected: {total_expected} trajectories")
    print(f"  Max tokens per trajectory: {max_tokens}")

    all_rewards: list[float] = []
    all_token_counts: list[int] = []
    correct_count = 0
    total_count = 0

    for step in range(steps_to_run):
        env_group_builders = dataset.get_batch(step)
        print(f"\n{'='*60}")
        print(f"Step {step + 1}/{steps_to_run}: {len(env_group_builders)} environment groups")
        print(f"{'='*60}")

        # Run rollouts
        trajectory_groups: list[TrajectoryGroup] = []

        for i, env_group_builder in enumerate(env_group_builders):
            print(f"\n  Group {i + 1}/{len(env_group_builders)}: Running {group_size} trajectories...")

            envs = await env_group_builder.make_envs()
            trajectories = await asyncio.gather(*[
                _do_rollout(env, completer) for env in envs
            ])

            rewards_and_metrics = await env_group_builder.compute_group_rewards(trajectories, envs)
            final_rewards = [r for r, _ in rewards_and_metrics]
            metrics = [m for _, m in rewards_and_metrics]

            traj_group = TrajectoryGroup(
                trajectories_G=trajectories,
                final_rewards_G=final_rewards,
                metrics_G=metrics,
            )
            trajectory_groups.append(traj_group)

            total_rewards = traj_group.get_total_rewards()
            all_rewards.extend(total_rewards)

            # Show reward distribution for this group
            sorted_rewards = sorted(total_rewards, reverse=True)
            print(f"    Rewards: {[f'{r:.2f}' for r in sorted_rewards]}")
            print(f"    Best: {max(total_rewards):.2f}, Mean: {sum(total_rewards)/len(total_rewards):.2f}, Worst: {min(total_rewards):.2f}")

        # Convert and log to tviz
        print(f"\n  Converting {len(trajectory_groups)} groups to tviz format...")
        rollouts = from_tinker_batch(trajectory_groups, tokenizer=tokenizer)

        step_rewards = [r for tg in trajectory_groups for r in tg.get_total_rewards()]

        # Count tokens and correctness
        step_token_counts = []
        step_correct = 0
        for tg in trajectory_groups:
            for traj in tg.trajectories_G:
                token_count = sum(len(t.ac.tokens) for t in traj.transitions)
                step_token_counts.append(token_count)
            for r in tg.get_total_rewards():
                if r > 0.5:  # Correct answer threshold
                    step_correct += 1

        all_token_counts.extend(step_token_counts)
        correct_count += step_correct
        total_count += len(step_rewards)

        metrics = {
            # Reward statistics
            "reward_mean": sum(step_rewards) / len(step_rewards),
            "reward_max": max(step_rewards),
            "reward_min": min(step_rewards),
            "reward_std": _std(step_rewards),
            # Token statistics
            "tokens_mean": sum(step_token_counts) / len(step_token_counts),
            "tokens_max": max(step_token_counts),
            "tokens_min": min(step_token_counts),
            # Accuracy tracking
            "step_accuracy": step_correct / len(step_rewards),
            "cumulative_accuracy": correct_count / total_count,
            # Counts
            "num_trajectories": len(step_rewards),
            "cumulative_trajectories": len(all_rewards),
            # Running averages
            "running_reward_mean": sum(all_rewards) / len(all_rewards) if all_rewards else 0.0,
        }
        logger.log_metrics(metrics, step=step)
        logger.log_rollouts(rollouts, step=step)

        print(f"  ✓ Logged {len(rollouts)} rollouts at step {step}")
        print(f"  Step stats: mean={metrics['reward_mean']:.3f}, max={metrics['reward_max']:.3f}, accuracy={metrics['step_accuracy']:.1%}")
        print(f"  Tokens: mean={metrics['tokens_mean']:.0f}, max={metrics['tokens_max']}")

    logger.close()

    print(f"\n{'='*60}")
    print("Run Complete")
    print(f"{'='*60}")
    print(f"✓ Logged {len(all_rewards)} total trajectories across {steps_to_run} steps")
    print(f"  Overall mean reward: {sum(all_rewards)/len(all_rewards):.3f}")
    print(f"  Overall max reward: {max(all_rewards):.3f}")
    print(f"  Overall min reward: {min(all_rewards):.3f}")
    print(f"  Overall accuracy: {correct_count}/{total_count} = {correct_count/total_count:.1%}")
    print(f"  Token stats: mean={sum(all_token_counts)/len(all_token_counts):.0f}, max={max(all_token_counts)}")

    # Verify database
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    runs = conn.execute("SELECT * FROM runs").fetchall()
    rollouts_db = conn.execute("SELECT * FROM rollouts").fetchall()
    trajectories_db = conn.execute("SELECT * FROM trajectories").fetchall()
    steps_db = conn.execute("SELECT * FROM steps ORDER BY step").fetchall()

    print(f"\n{'='*60}")
    print("Database Verification")
    print(f"{'='*60}")
    print(f"  Runs: {len(runs)}")
    print(f"  Steps: {len(steps_db)}")
    print(f"  Rollouts: {len(rollouts_db)}")
    print(f"  Trajectories: {len(trajectories_db)}")

    # Show reward progression
    print(f"\n  Reward progression by step:")
    for s in steps_db:
        print(f"    Step {s['step']}: mean={s['reward_mean']:.3f}")

    # Show sample outputs
    print(f"\n  Top 5 trajectories by reward:")
    top_trajs = conn.execute(
        "SELECT * FROM trajectories ORDER BY reward DESC LIMIT 5"
    ).fetchall()
    for i, traj in enumerate(top_trajs):
        text = traj['output_text']
        if text:
            text = text[:200] + "..." if len(text) > 200 else text
            print(f"\n    #{i+1} (reward={traj['reward']:.3f}):")
            print(f"      {text}")

    # Show worst trajectories for comparison
    print(f"\n  Bottom 3 trajectories by reward:")
    bottom_trajs = conn.execute(
        "SELECT * FROM trajectories ORDER BY reward ASC LIMIT 3"
    ).fetchall()
    for i, traj in enumerate(bottom_trajs):
        text = traj['output_text']
        if text:
            text = text[:150] + "..." if len(text) > 150 else text
            print(f"\n    #{i+1} (reward={traj['reward']:.3f}):")
            print(f"      {text}")

    conn.close()

    print(f"\n{'='*60}")
    print("✓ Test passed!")
    print(f"{'='*60}")


def _std(values: list[float]) -> float:
    """Compute standard deviation."""
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return variance ** 0.5


async def _do_rollout(env, completer):
    """Run a single trajectory."""
    from tinker_cookbook.rl.types import Trajectory, Transition

    transitions = []
    ob, stop_condition = await env.initial_observation()

    while True:
        action = await completer(ob, stop_condition)
        step_result = await env.step(action.tokens)

        transitions.append(Transition(
            ob=ob,
            ac=action,
            reward=step_result.reward,
            episode_done=step_result.episode_done,
            metrics=step_result.metrics,
        ))

        if step_result.episode_done:
            break

        ob = step_result.next_observation
        stop_condition = step_result.next_stop_condition

    return Trajectory(transitions=transitions, final_ob=ob)


if __name__ == "__main__":
    if not os.environ.get("TINKER_API_KEY"):
        print("ERROR: TINKER_API_KEY not set")
        sys.exit(1)
    asyncio.run(test_rl_qwen3_8b())
