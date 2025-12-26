"""
tviz type definitions - modality-agnostic data structures for RL visualization.
"""

from dataclasses import dataclass, field
from typing import Literal, Optional, TypedDict, Union
from enum import Enum


class Modality(str, Enum):
    """Supported modalities for training visualization."""
    TEXT = "text"
    VISION = "vision"


@dataclass
class StepMetrics:
    """Scalar metrics logged at each training step."""
    step: int
    reward_mean: float
    reward_std: Optional[float] = None
    loss: Optional[float] = None
    kl_divergence: Optional[float] = None
    entropy: Optional[float] = None
    learning_rate: Optional[float] = None
    # Additional custom metrics
    extras: dict[str, float] = field(default_factory=dict)


@dataclass
class TextObservation:
    """Observation for text-only modality."""
    prompt_text: str
    # Optional: token IDs for detailed visualization
    prompt_tokens: Optional[list[int]] = None


@dataclass
class VisionObservation:
    """Observation for vision modality (VLM)."""
    image_path: str
    prompt_text: Optional[str] = None
    # Ground truth for geo tasks
    gt_lat: Optional[float] = None
    gt_lon: Optional[float] = None
    # Optional metadata
    city: Optional[str] = None
    country: Optional[str] = None


Observation = Union[TextObservation, VisionObservation]


@dataclass
class TrajectoryData:
    """Single trajectory within a rollout (G trajectories per group)."""
    trajectory_idx: int
    reward: float
    # Output from the model
    output_text: Optional[str] = None
    output_tokens: Optional[list[int]] = None
    # Token-level log probabilities for visualization
    logprobs: Optional[list[float]] = None
    # Vision-specific: predicted location
    pred_lat: Optional[float] = None
    pred_lon: Optional[float] = None
    distance_km: Optional[float] = None
    # Optional per-step metrics
    step_rewards: Optional[list[float]] = None


@dataclass
class RolloutData:
    """A rollout containing G trajectories for one observation."""
    group_idx: int
    observation: Observation
    trajectories: list[TrajectoryData]
    # Aggregate metrics for this rollout
    mean_reward: Optional[float] = None
    best_reward: Optional[float] = None


# TypedDict versions for raw dict inputs (from Tinker or custom envs)
class RawTrajectory(TypedDict, total=False):
    """Raw trajectory dict format for flexible input."""
    trajectory_idx: int
    reward: float
    output_text: str
    output_tokens: list[int]
    logprobs: list[float]
    pred_lat: float
    pred_lon: float
    distance_km: float
    step_rewards: list[float]


class RawRollout(TypedDict, total=False):
    """Raw rollout dict format for flexible input."""
    group_idx: int
    # Text observation
    prompt_text: str
    prompt_tokens: list[int]
    # Vision observation
    image_path: str
    gt_lat: float
    gt_lon: float
    city: str
    country: str
    # Trajectories
    trajectories: list[RawTrajectory]
