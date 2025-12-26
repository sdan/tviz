"""
Test tviz integration with VLM RL using Qwen3-VL-30B on OSV-5M geolocation.

This test:
1. Creates a TvizLogger with vision modality
2. Loads Qwen3-VL-30B and runs rollouts on OSV-5M images
3. Logs trajectories with image paths, coordinates, distances
4. Verifies vision-specific data in SQLite

Requires TINKER_API_KEY environment variable.
"""

import asyncio
import math
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

# Add geospot-vlm and master-tinker to path
sys.path.insert(0, "/Users/sdan/Developer/geospot-vlm")
sys.path.insert(0, "/Users/sdan/Developer/master-tinker")


async def test_vlm_rl_qwen3vl_30b():
    """Run VLM RL rollouts with Qwen3-VL-30B on OSV-5M."""
    import tinker
    from geospot.datasets import iterate_samples, GeoSample
    from geospot.renderers import get_renderer
    from geospot.envs import (
        SingleTurnGeoEnv,
        SingleTurnGeoEnvConfig,
        GeoLocation,
        haversine_km,
        parse_geo_response,
        SINGLE_TURN_PROMPT,
    )
    from geospot.train_rl import (
        get_tokenizer,
        get_image_processor,
        TokensWithLogprobs,
        TinkerTokenCompleter,
    )

    from tviz import TvizLogger

    import sys
    def log(msg):
        print(msg, flush=True)

    log("=" * 60)
    log("tviz Test: VLM RL with Qwen3-VL-30B on OSV-5M")
    log("=" * 60)

    # Config
    model_name = "Qwen/Qwen3-VL-30B-A3B-Instruct"
    renderer_name = "qwen3_vl"
    num_groups = int(os.environ.get("TVIZ_NUM_GROUPS", os.environ.get("TVIZ_NUM_SAMPLES", "8")))
    group_size = int(os.environ.get("TVIZ_GROUP_SIZE", "8"))  # trajectories per group (GRPO-style)
    max_tokens = 256
    traj_timeout_s = int(os.environ.get("TVIZ_TRAJ_TIMEOUT_S", "300"))

    # Use persistent tviz directory (same as frontend reads from)
    tviz_dir = Path.home() / ".tviz"
    tviz_dir.mkdir(exist_ok=True)
    db_path = tviz_dir / "tviz.db"
    images_dir = tviz_dir / "images"
    images_dir.mkdir(exist_ok=True)

    # Indent reduced - no longer using tempdir context manager
    if True:  # Keep indentation for minimal diff

        # Initialize tviz logger with vision modality
        logger = TvizLogger(str(db_path), run_name="osv5m_qwen3vl_30b", modality="vision")
        config = {
            "model": model_name,
            "task": "osv5m_geolocation",
            "num_groups": num_groups,
            "group_size": group_size,
            "max_tokens": max_tokens,
        }
        logger.log_hparams(config)
        log(f"\n✓ TvizLogger initialized (vision modality)")
        log(f"  Dashboard: {logger.get_logger_url()}")
        log(f"  Groups: {num_groups}, trajectories/group: {group_size}, total trajectories: {num_groups * group_size}")

        # Create tinker clients
        log(f"  Creating service client...")
        service_client = tinker.ServiceClient()
        log(f"  Creating sampling client for {model_name}...")
        sampling_client = await service_client.create_sampling_client_async(base_model=model_name)
        log(f"  Loading tokenizer...")
        tokenizer = get_tokenizer(model_name)
        log(f"  Loading image processor...")
        image_processor = get_image_processor(model_name)
        log(f"  Creating renderer...")
        renderer = get_renderer(renderer_name, tokenizer, image_processor)
        log(f"✓ Model loaded: {model_name}")

        # Create completer
        completer = TinkerTokenCompleter(
            sampling_client=sampling_client,
            max_tokens=max_tokens,
            temperature=1.0,
        )

        # Stream samples from OSV-5M
        log(f"\n✓ Streaming from OSV-5M dataset...")
        sample_iter = iterate_samples(
            hf_repo="osv5m/osv5m",
            split="train",
            seed=42,
            max_image_size=480,
        )

        all_rollouts = []
        step = 0

        for sample_idx, sample in enumerate(sample_iter):
            if sample_idx >= num_groups:
                break

            log(f"\n  Sample {sample_idx}: lat={sample.lat:.4f}, lon={sample.lon:.4f}")
            log(f"    Location: {sample.city or '?'}, {sample.region or '?'}, {sample.country or '?'}")

            # Save image to temp directory
            image_path = str(images_dir / f"sample_{sample_idx}.jpg")
            sample.image.save(image_path)

            # Ground truth
            gt = GeoLocation(
                lat=sample.lat,
                lon=sample.lon,
                country=sample.country,
                region=sample.region,
                city=sample.city,
            )

            # Run G trajectories for this image
            trajectories = []
            for traj_idx in range(group_size):
                log(f"    Traj {traj_idx}: starting...")
                try:
                    traj_data = await asyncio.wait_for(
                        _run_single_trajectory(
                            sample, gt, renderer, completer, tokenizer, traj_idx
                        ),
                        timeout=traj_timeout_s,
                    )
                except asyncio.TimeoutError:
                    log(f"    Traj {traj_idx}: timed out after {traj_timeout_s}s")
                    traj_data = {
                        "trajectory_idx": traj_idx,
                        "reward": -0.1,
                        "output_text": "[timeout]",
                        "output_tokens": [],
                        "logprobs": None,
                        "pred_lat": None,
                        "pred_lon": None,
                        "distance_km": None,
                    }
                trajectories.append(traj_data)
                log(f"    Traj {traj_idx}: reward={traj_data['reward']:.3f}, dist={traj_data.get('distance_km', '?')}km")

            # Compute aggregate metrics
            rewards = [t["reward"] for t in trajectories]
            mean_reward = sum(rewards) / len(rewards)
            best_reward = max(rewards)
            grpo_advantages, grpo_adv_mean, grpo_adv_std = _compute_grpo_advantages(rewards)
            for traj, advantage in zip(trajectories, grpo_advantages):
                traj["grpo_advantage"] = advantage
                step_rewards = traj.get("step_rewards") or {}
                step_rewards["grpo_advantage"] = advantage
                traj["step_rewards"] = step_rewards

            # Build rollout dict for tviz
            rollout = {
                "group_idx": sample_idx,
                "image_path": image_path,
                "gt_lat": gt.lat,
                "gt_lon": gt.lon,
                "city": gt.city,
                "country": gt.country,
                "trajectories": trajectories,
                "mean_reward": mean_reward,
                "best_reward": best_reward,
            }
            all_rollouts.append(rollout)

            # Log metrics for this step
            metrics = {
                "reward_mean": mean_reward,
                "reward_best": best_reward,
                "num_trajectories": len(trajectories),
                "grpo_adv_mean": grpo_adv_mean,
                "grpo_adv_std": grpo_adv_std,
            }
            logger.log_metrics(metrics, step=step)
            logger.log_rollouts([rollout], step=step)
            step += 1

        logger.close()
        log(f"\n✓ Logged {len(all_rollouts)} rollouts, {len(all_rollouts) * group_size} trajectories")

        # Verify database
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row

        runs = conn.execute("SELECT * FROM runs").fetchall()
        rollouts_db = conn.execute("SELECT * FROM rollouts").fetchall()
        trajectories_db = conn.execute("SELECT * FROM trajectories").fetchall()

        log("\n" + "=" * 60)
        log("Database Verification")
        log("=" * 60)
        log(f"  Runs: {len(runs)}")
        log(f"  Rollouts: {len(rollouts_db)}")
        log(f"  Trajectories: {len(trajectories_db)}")

        # Check vision-specific fields (filter for rollouts with image_path)
        sample_rollout = conn.execute("SELECT * FROM rollouts WHERE image_path IS NOT NULL LIMIT 1").fetchone()
        if sample_rollout:
            log(f"\n  Sample rollout:")
            log(f"    Image: {sample_rollout['image_path']}")
            log(f"    GT coords: ({sample_rollout['gt_lat']:.4f}, {sample_rollout['gt_lon']:.4f})")
            log(f"    Location: {sample_rollout['city']}, {sample_rollout['country']}")

        sample_traj = conn.execute(
            "SELECT * FROM trajectories ORDER BY reward DESC LIMIT 1"
        ).fetchone()
        if sample_traj:
            log(f"\n  Best trajectory:")
            log(f"    Reward: {sample_traj['reward']:.3f}")
            log(f"    Pred coords: ({sample_traj['pred_lat']}, {sample_traj['pred_lon']})")
            log(f"    Distance: {sample_traj['distance_km']}km")

        conn.close()

        log("\n" + "=" * 60)
        log("✓ Test passed!")
        log("=" * 60)


async def _run_single_trajectory(
    sample,
    gt,
    renderer,
    completer,
    tokenizer,
    traj_idx: int,
) -> dict:
    """Run a single trajectory and return tviz-formatted data."""
    from geospot.envs import SINGLE_TURN_PROMPT, parse_geo_response, haversine_km

    # Build prompt with image
    from geospot.renderers import ImagePart, TextPart
    messages = [
        {
            "role": "user",
            "content": [
                ImagePart(type="image", image=sample.image),
                TextPart(type="text", text=SINGLE_TURN_PROMPT),
            ],
        }
    ]
    model_input = renderer.build_generation_prompt(messages)
    stop = renderer.get_stop_sequences()

    # Get model response
    action = await completer(model_input, stop)
    output_text = tokenizer.decode(action.tokens)

    # Parse response
    parsed = parse_geo_response(output_text)

    # Compute reward
    if parsed.location is not None:
        distance_km = haversine_km(
            parsed.location.lat, parsed.location.lon,
            gt.lat, gt.lon
        )
        # Simple exponential distance reward
        distance_reward = max(0, 1.0 - (distance_km / 5000))  # 1.0 at 0km, 0.0 at 5000km
        reward = distance_reward
        pred_lat, pred_lon = parsed.location.lat, parsed.location.lon
        format_valid = True
    else:
        # Format failure
        distance_km = None
        distance_reward = 0.0
        reward = -0.1
        pred_lat, pred_lon = None, None
        format_valid = False

    return {
        "trajectory_idx": traj_idx,
        "reward": reward,
        "output_text": output_text,
        "output_tokens": action.tokens,
        "logprobs": action.logprobs,
        "pred_lat": pred_lat,
        "pred_lon": pred_lon,
        "distance_km": distance_km,
        "step_rewards": {
            "format_valid": format_valid,
            "distance_km": distance_km,
            "distance_reward": distance_reward,
            "total_reward": reward,
        },
    }


def _compute_grpo_advantages(rewards: list[float]) -> tuple[list[float], float, float]:
    if not rewards:
        return [], 0.0, 0.0
    mean_reward = sum(rewards) / len(rewards)
    advantages = [reward - mean_reward for reward in rewards]
    adv_mean = sum(advantages) / len(advantages)
    return advantages, adv_mean, _stddev(advantages)


def _stddev(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(variance)


if __name__ == "__main__":
    if not os.environ.get("TINKER_API_KEY"):
        print("ERROR: TINKER_API_KEY not set")
        sys.exit(1)
    asyncio.run(test_vlm_rl_qwen3vl_30b())
