"""
Adapter for converting Tinker Cookbook data structures to tviz format.

Tinker types (from tinker_cookbook/rl/types.py):
- TrajectoryGroup: trajectories_G, final_rewards_G, metrics_G
- Trajectory: transitions, final_ob
- Transition: ob, ac (TokensWithLogprobs), reward, episode_done, metrics
- TokensWithLogprobs: tokens, maybe_logprobs
"""

from typing import Any, Protocol, Optional


# Protocol definitions matching actual tinker_cookbook types
class TokensWithLogprobs(Protocol):
    """Protocol matching tinker TokensWithLogprobs type."""
    tokens: list[int]
    maybe_logprobs: list[float] | None


class TinkerTransition(Protocol):
    """Protocol matching tinker Transition type."""
    ob: Any  # tinker.ModelInput
    ac: TokensWithLogprobs
    reward: float
    episode_done: bool
    metrics: dict[str, float | int]


class TinkerTrajectory(Protocol):
    """Protocol matching tinker Trajectory type."""
    transitions: list[TinkerTransition]
    final_ob: Any  # tinker.ModelInput


class TinkerTrajectoryGroup(Protocol):
    """Protocol matching tinker TrajectoryGroup type."""
    trajectories_G: list[TinkerTrajectory]
    final_rewards_G: list[float]
    metrics_G: list[dict[str, float | int]]

    def get_total_rewards(self) -> list[float]: ...


def extract_prompt_text(ob: Any) -> Optional[str]:
    """Extract prompt text from a tinker ModelInput observation."""
    # ModelInput can be various formats - try common patterns
    if isinstance(ob, str):
        return ob
    if isinstance(ob, dict):
        # Check for common keys
        return ob.get("text") or ob.get("prompt") or ob.get("content")
    if hasattr(ob, "text"):
        return ob.text
    if hasattr(ob, "prompt"):
        return ob.prompt
    # Try to stringify as last resort
    try:
        return str(ob)
    except Exception:
        return None


def from_tinker_trajectory(
    traj: TinkerTrajectory,
    trajectory_idx: int = 0,
    total_reward: Optional[float] = None,
) -> dict:
    """
    Convert a Tinker Trajectory to tviz TrajectoryData dict.

    Args:
        traj: Tinker Trajectory object
        trajectory_idx: Index within the trajectory group
        total_reward: Pre-computed total reward (from get_total_rewards)

    Returns:
        Dict compatible with tviz TrajectoryData
    """
    logprobs = []
    step_rewards = []
    output_tokens = []
    output_text_parts = []

    for trans in traj.transitions:
        # Collect logprobs from action
        if trans.ac.maybe_logprobs is not None:
            logprobs.extend(trans.ac.maybe_logprobs)

        # Collect tokens
        output_tokens.extend(trans.ac.tokens)

        # Collect per-step rewards
        step_rewards.append(trans.reward)

    # Compute total reward if not provided
    if total_reward is None:
        total_reward = sum(step_rewards)

    return {
        "trajectory_idx": trajectory_idx,
        "reward": total_reward,
        "output_text": None,  # Would need tokenizer to decode
        "output_tokens": output_tokens if output_tokens else None,
        "logprobs": logprobs if logprobs else None,
        "step_rewards": step_rewards if step_rewards else None,
    }


def from_tinker_trajectory_group(
    group: TinkerTrajectoryGroup,
    group_idx: int = 0,
    prompt_text: Optional[str] = None,
    tokenizer: Optional[Any] = None,
) -> dict:
    """
    Convert a Tinker TrajectoryGroup to tviz RolloutData dict.

    Args:
        group: Tinker TrajectoryGroup object
        group_idx: Index for this rollout group
        prompt_text: Optional prompt text (extracted from first trajectory if not provided)
        tokenizer: Optional tokenizer for decoding tokens to text

    Returns:
        Dict compatible with tviz RolloutData
    """
    # Get total rewards from the group (includes final_rewards)
    total_rewards = group.get_total_rewards()

    trajectories = [
        from_tinker_trajectory(traj, idx, total_reward=total_rewards[idx])
        for idx, traj in enumerate(group.trajectories_G)
    ]

    # Decode output tokens if tokenizer provided
    if tokenizer is not None:
        for traj_dict in trajectories:
            if traj_dict.get("output_tokens"):
                try:
                    traj_dict["output_text"] = tokenizer.decode(traj_dict["output_tokens"])
                except Exception:
                    pass

    # Extract prompt from first trajectory's first observation
    if prompt_text is None and group.trajectories_G:
        first_traj = group.trajectories_G[0]
        if first_traj.transitions:
            prompt_text = extract_prompt_text(first_traj.transitions[0].ob)

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
    tokenizer: Optional[Any] = None,
) -> list[dict]:
    """
    Convert a batch of Tinker TrajectoryGroups to tviz format.

    This is the main entry point for logging a training batch from
    tinker_cookbook RL training loops.

    Args:
        groups: List of TrajectoryGroup objects from prepare_minibatch
        prompts: Optional list of prompts (one per group)
        tokenizer: Optional tokenizer for decoding tokens to text

    Returns:
        List of rollout dicts ready for logger.log_rollouts()

    Usage:
        from tviz import TvizLogger
        from tviz.adapters.tinker import from_tinker_batch

        logger = TvizLogger(run_name="math_rl")

        # In training loop:
        rollouts = from_tinker_batch(trajectory_groups, tokenizer=tokenizer)
        logger.log_rollouts(rollouts, step=i_batch)
    """
    return [
        from_tinker_trajectory_group(
            group,
            group_idx=idx,
            prompt_text=prompts[idx] if prompts else None,
            tokenizer=tokenizer,
        )
        for idx, group in enumerate(groups)
    ]
