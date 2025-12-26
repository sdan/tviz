"""
Adapter for converting Tinker Cookbook data structures to tviz format.

This module provides conversion functions for:
- TrajectoryGroup → list of RolloutData
- Trajectory → TrajectoryData
- Datum → observation data
"""

from typing import Any, Protocol, Optional


# Protocol definitions for Tinker types (to avoid hard dependency)
class TinkerDatum(Protocol):
    """Protocol matching tinker Datum type."""
    prompt: str
    output: str


class TinkerTransition(Protocol):
    """Protocol matching tinker Transition type."""
    datum: TinkerDatum
    reward: float
    logprob: Optional[float]


class TinkerTrajectory(Protocol):
    """Protocol matching tinker Trajectory type."""
    transitions: list[TinkerTransition]

    @property
    def total_reward(self) -> float: ...


class TinkerTrajectoryGroup(Protocol):
    """Protocol matching tinker TrajectoryGroup type."""
    trajectories: list[TinkerTrajectory]


def from_tinker_trajectory(
    traj: TinkerTrajectory,
    trajectory_idx: int = 0,
) -> dict:
    """
    Convert a Tinker Trajectory to tviz TrajectoryData dict.

    Args:
        traj: Tinker Trajectory object
        trajectory_idx: Index within the trajectory group

    Returns:
        Dict compatible with tviz TrajectoryData
    """
    # Collect logprobs and step rewards from transitions
    logprobs = []
    step_rewards = []
    output_text = ""

    for trans in traj.transitions:
        if hasattr(trans, "logprob") and trans.logprob is not None:
            logprobs.append(trans.logprob)
        step_rewards.append(trans.reward)
        # Accumulate output text from transitions
        if hasattr(trans.datum, "output"):
            output_text = trans.datum.output  # Use the last output

    return {
        "trajectory_idx": trajectory_idx,
        "reward": traj.total_reward,
        "output_text": output_text,
        "logprobs": logprobs if logprobs else None,
        "step_rewards": step_rewards if step_rewards else None,
    }


def from_tinker_trajectory_group(
    group: TinkerTrajectoryGroup,
    group_idx: int = 0,
    prompt_text: Optional[str] = None,
) -> dict:
    """
    Convert a Tinker TrajectoryGroup to tviz RolloutData dict.

    Args:
        group: Tinker TrajectoryGroup object
        group_idx: Index for this rollout group
        prompt_text: Optional prompt text (extracted from first trajectory if not provided)

    Returns:
        Dict compatible with tviz RolloutData
    """
    trajectories = [
        from_tinker_trajectory(traj, idx)
        for idx, traj in enumerate(group.trajectories)
    ]

    # Extract prompt from first trajectory if not provided
    if prompt_text is None and group.trajectories:
        first_traj = group.trajectories[0]
        if first_traj.transitions:
            prompt_text = first_traj.transitions[0].datum.prompt

    # Calculate aggregate metrics
    rewards = [t["reward"] for t in trajectories]
    mean_reward = sum(rewards) / len(rewards) if rewards else 0.0
    best_reward = max(rewards) if rewards else 0.0

    return {
        "group_idx": group_idx,
        "prompt_text": prompt_text,
        "trajectories": trajectories,
        "mean_reward": mean_reward,
        "best_reward": best_reward,
    }


def from_tinker_batch(
    groups: list[TinkerTrajectoryGroup],
    prompts: Optional[list[str]] = None,
) -> list[dict]:
    """
    Convert a batch of Tinker TrajectoryGroups to tviz format.

    This is the main entry point for logging a training batch from
    tinker_cookbook RL training loops.

    Args:
        groups: List of TrajectoryGroup objects from prepare_minibatch
        prompts: Optional list of prompts (one per group)

    Returns:
        List of rollout dicts ready for client.log_rollout()

    Usage:
        # In tinker_cookbook RL training loop:
        from tviz.adapters.tinker import from_tinker_batch

        rollouts = from_tinker_batch(trajectory_groups)
        client.log_rollout(i_batch, rollouts)
    """
    return [
        from_tinker_trajectory_group(
            group,
            group_idx=idx,
            prompt_text=prompts[idx] if prompts else None,
        )
        for idx, group in enumerate(groups)
    ]


# Convenience function for vision modality (geospot-style)
def from_geo_rollout(
    image_path: str,
    gt_lat: float,
    gt_lon: float,
    predictions: list[dict],  # [{pred_lat, pred_lon, reward, distance_km}, ...]
    group_idx: int = 0,
    city: Optional[str] = None,
    country: Optional[str] = None,
) -> dict:
    """
    Create a vision rollout from geospot-style data.

    Args:
        image_path: Path to the image file
        gt_lat: Ground truth latitude
        gt_lon: Ground truth longitude
        predictions: List of prediction dicts with lat/lon, reward, distance
        group_idx: Index for this rollout group
        city: Optional city name
        country: Optional country name

    Returns:
        Dict compatible with tviz RolloutData for vision modality
    """
    trajectories = [
        {
            "trajectory_idx": idx,
            "reward": pred.get("reward", 0.0),
            "pred_lat": pred.get("pred_lat"),
            "pred_lon": pred.get("pred_lon"),
            "distance_km": pred.get("distance_km"),
        }
        for idx, pred in enumerate(predictions)
    ]

    rewards = [t["reward"] for t in trajectories]

    return {
        "group_idx": group_idx,
        "image_path": image_path,
        "gt_lat": gt_lat,
        "gt_lon": gt_lon,
        "city": city,
        "country": country,
        "trajectories": trajectories,
        "mean_reward": sum(rewards) / len(rewards) if rewards else 0.0,
        "best_reward": max(rewards) if rewards else 0.0,
    }
