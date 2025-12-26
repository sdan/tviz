"""Quick test that writes to the default tviz db for the dashboard."""
import asyncio
import os
import sys

sys.path.insert(0, "/Users/sdan/Developer/master-tinker")

async def main():
    import tinker
    from tinker_cookbook import model_info
    from tinker_cookbook.completers import TinkerTokenCompleter
    from tinker_cookbook.recipes.math_rl.math_env import Gsm8kDatasetBuilder
    from tinker_cookbook.rl.types import TrajectoryGroup, Trajectory, Transition
    from tinker_cookbook.tokenizer_utils import get_tokenizer

    from tviz import TvizLogger
    from tviz.adapters.tinker import from_tinker_batch

    print("Starting tviz test run...")

    # Config
    model_name = "Qwen/Qwen3-8B"
    
    # Write to default tviz db (where dashboard reads from)
    logger = TvizLogger(run_name="gsm8k_test", modality="text")
    logger.log_hparams({"model": model_name, "task": "gsm8k"})
    print(f"Dashboard: http://localhost:3003/training-run/{logger.run_id}")

    # Setup
    service_client = tinker.ServiceClient()
    sampling_client = await service_client.create_sampling_client_async(base_model=model_name)
    tokenizer = get_tokenizer(model_name)
    
    renderer_name = model_info.get_recommended_renderer_name(model_name)
    dataset_builder = Gsm8kDatasetBuilder(
        batch_size=2, group_size=4,
        renderer_name=renderer_name,
        model_name_for_tokenizer=model_name,
    )
    dataset, _ = await dataset_builder()
    
    completer = TinkerTokenCompleter(
        sampling_client=sampling_client,
        max_tokens=256,
        temperature=1.0,
    )

    # Run 1 batch
    env_group_builders = dataset.get_batch(0)
    trajectory_groups = []

    for i, builder in enumerate(env_group_builders):
        print(f"  Running group {i}...")
        envs = await builder.make_envs()
        
        async def do_rollout(env):
            transitions = []
            ob, stop = await env.initial_observation()
            while True:
                ac = await completer(ob, stop)
                step = await env.step(ac.tokens)
                transitions.append(Transition(ob=ob, ac=ac, reward=step.reward, 
                                              episode_done=step.episode_done, metrics=step.metrics))
                if step.episode_done:
                    break
                ob, stop = step.next_observation, step.next_stop_condition
            return Trajectory(transitions=transitions, final_ob=ob)
        
        trajectories = await asyncio.gather(*[do_rollout(env) for env in envs])
        rewards_and_metrics = await builder.compute_group_rewards(trajectories, envs)
        
        traj_group = TrajectoryGroup(
            trajectories_G=trajectories,
            final_rewards_G=[r for r, _ in rewards_and_metrics],
            metrics_G=[m for _, m in rewards_and_metrics],
        )
        trajectory_groups.append(traj_group)
        
        rewards = traj_group.get_total_rewards()
        print(f"    Rewards: {[f'{r:.2f}' for r in rewards]}")

    # Log to tviz
    rollouts = from_tinker_batch(trajectory_groups, tokenizer=tokenizer)
    all_rewards = [r for tg in trajectory_groups for r in tg.get_total_rewards()]
    
    logger.log_metrics({
        "reward_mean": sum(all_rewards) / len(all_rewards),
        "reward_max": max(all_rewards),
    }, step=0)
    logger.log_rollouts(rollouts, step=0)
    logger.close()

    print(f"\n✓ Done! View at: http://localhost:3003/training-run/{logger.run_id}")

if __name__ == "__main__":
    if not os.environ.get("TINKER_API_KEY"):
        print("Set TINKER_API_KEY first")
        sys.exit(1)
    asyncio.run(main())
