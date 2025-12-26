"""
tviz - Tinker Training Visualization Library

A modality-agnostic visualization library for RL training runs,
supporting both text-only LLM RL and vision-language model workflows.
"""

from tviz.client import TvizClient, tviz_sweep, TvizEnvMixin
from tviz.types import (
    Modality,
    StepMetrics,
    TextObservation,
    VisionObservation,
    TrajectoryData,
    RolloutData,
)

__version__ = "0.1.0"

__all__ = [
    # Client
    "TvizClient",
    "tviz_sweep",
    "TvizEnvMixin",
    # Types
    "Modality",
    "StepMetrics",
    "TextObservation",
    "VisionObservation",
    "TrajectoryData",
    "RolloutData",
]
