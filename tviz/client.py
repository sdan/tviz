"""
tviz client - Python client for logging training data to the visualization dashboard.

Supports three integration levels:
1. TvizClient - Direct client for custom logging
2. TvizEnvMixin - Mixin for RL environments to auto-log rollouts
3. tviz_sweep - Context manager for sweep-level logging
"""

import sqlite3
import uuid
import json
import time
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional, Union

from tviz.types import (
    Modality,
    StepMetrics,
    TextObservation,
    VisionObservation,
    TrajectoryData,
    RolloutData,
    RawRollout,
)


class TvizClient:
    """
    Core client for logging training data to tviz dashboard.

    Usage:
        client = TvizClient("./tviz.db")
        run_id = client.start_run("my_experiment", config={"lr": 1e-4})

        for step in range(1000):
            # Log scalar metrics
            client.log_step(step, {"reward_mean": 0.5, "loss": 0.1})

            # Log rollouts for visualization
            client.log_rollout(step, rollouts)

        client.end_run()
    """

    def __init__(self, db_path: str = "tviz.db"):
        """
        Initialize the tviz client.

        Args:
            db_path: Path to the SQLite database. Will be created if it doesn't exist.
        """
        self.db_path = Path(db_path)
        self.run_id: Optional[str] = None
        self._modality: Optional[Modality] = None
        self._conn: Optional[sqlite3.Connection] = None
        self._ensure_schema()

    def _get_conn(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _ensure_schema(self) -> None:
        """Create database tables if they don't exist."""
        conn = self._get_conn()
        conn.executescript("""
            -- Training runs
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'rl',
                modality TEXT DEFAULT 'text',
                config TEXT,
                started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT
            );

            -- Training steps with scalar metrics
            CREATE TABLE IF NOT EXISTS steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                step INTEGER NOT NULL,
                reward_mean REAL,
                reward_std REAL,
                loss REAL,
                kl_divergence REAL,
                entropy REAL,
                learning_rate REAL,
                extras TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES runs(id),
                UNIQUE(run_id, step)
            );

            -- Rollouts (observations with multiple trajectories)
            CREATE TABLE IF NOT EXISTS rollouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                step INTEGER NOT NULL,
                group_idx INTEGER NOT NULL,
                -- Vision-specific
                image_path TEXT,
                gt_lat REAL,
                gt_lon REAL,
                city TEXT,
                country TEXT,
                -- Text-specific
                prompt_text TEXT,
                prompt_tokens TEXT,
                -- Aggregate metrics
                mean_reward REAL,
                best_reward REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            );

            -- Trajectories within rollouts
            CREATE TABLE IF NOT EXISTS trajectories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rollout_id INTEGER NOT NULL,
                trajectory_idx INTEGER NOT NULL,
                reward REAL NOT NULL,
                output_text TEXT,
                output_tokens TEXT,
                logprobs TEXT,
                -- Vision-specific
                pred_lat REAL,
                pred_lon REAL,
                distance_km REAL,
                -- Per-step rewards
                step_rewards TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rollout_id) REFERENCES rollouts(id)
            );

            -- Indexes for common queries
            CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id);
            CREATE INDEX IF NOT EXISTS idx_rollouts_run_id ON rollouts(run_id);
            CREATE INDEX IF NOT EXISTS idx_rollouts_step ON rollouts(run_id, step);
            CREATE INDEX IF NOT EXISTS idx_trajectories_rollout ON trajectories(rollout_id);
        """)
        conn.commit()

    def start_run(
        self,
        name: str,
        config: Optional[dict] = None,
        modality: Union[str, Modality] = Modality.TEXT,
        run_type: str = "rl",
    ) -> str:
        """
        Start a new training run.

        Args:
            name: Human-readable name for the run
            config: Training configuration dict (will be JSON serialized)
            modality: "text" or "vision"
            run_type: Type of training (e.g., "rl", "sft", "dpo")

        Returns:
            run_id: Unique identifier for this run
        """
        if isinstance(modality, str):
            modality = Modality(modality)

        self.run_id = str(uuid.uuid4())[:8]
        self._modality = modality

        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO runs (id, name, type, modality, config)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                self.run_id,
                name,
                run_type,
                modality.value,
                json.dumps(config) if config else None,
            ),
        )
        conn.commit()

        return self.run_id

    def log_step(
        self,
        step: int,
        metrics: Union[StepMetrics, dict[str, float]],
    ) -> None:
        """
        Log scalar metrics for a training step.

        Args:
            step: Training step number
            metrics: Either a StepMetrics object or a dict with metric names as keys
        """
        if self.run_id is None:
            raise RuntimeError("Must call start_run() before log_step()")

        if isinstance(metrics, StepMetrics):
            data = asdict(metrics)
        else:
            data = metrics

        # Extract known columns
        reward_mean = data.pop("reward_mean", None)
        reward_std = data.pop("reward_std", None)
        loss = data.pop("loss", None)
        kl_divergence = data.pop("kl_divergence", data.pop("kl", None))
        entropy = data.pop("entropy", None)
        learning_rate = data.pop("learning_rate", data.pop("lr", None))

        # Remaining metrics go to extras
        extras = data.pop("extras", {})
        extras.update(data)  # Add any remaining keys

        conn = self._get_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO steps
            (run_id, step, reward_mean, reward_std, loss, kl_divergence, entropy, learning_rate, extras)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.run_id,
                step,
                reward_mean,
                reward_std,
                loss,
                kl_divergence,
                entropy,
                learning_rate,
                json.dumps(extras) if extras else None,
            ),
        )
        conn.commit()

    def log_rollout(
        self,
        step: int,
        rollouts: list[Union[RolloutData, RawRollout, dict]],
    ) -> None:
        """
        Log rollouts (observations with trajectories) for visualization.

        Args:
            step: Training step number
            rollouts: List of rollouts, each containing observation and trajectories
        """
        if self.run_id is None:
            raise RuntimeError("Must call start_run() before log_rollout()")

        conn = self._get_conn()

        for rollout in rollouts:
            # Convert to dict if needed
            if isinstance(rollout, RolloutData):
                rollout_dict = self._rollout_data_to_dict(rollout)
            else:
                rollout_dict = dict(rollout)

            # Insert rollout
            cursor = conn.execute(
                """
                INSERT INTO rollouts
                (run_id, step, group_idx, image_path, gt_lat, gt_lon, city, country,
                 prompt_text, prompt_tokens, mean_reward, best_reward)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    self.run_id,
                    step,
                    rollout_dict.get("group_idx", 0),
                    rollout_dict.get("image_path"),
                    rollout_dict.get("gt_lat"),
                    rollout_dict.get("gt_lon"),
                    rollout_dict.get("city"),
                    rollout_dict.get("country"),
                    rollout_dict.get("prompt_text"),
                    json.dumps(rollout_dict.get("prompt_tokens")) if rollout_dict.get("prompt_tokens") else None,
                    rollout_dict.get("mean_reward"),
                    rollout_dict.get("best_reward"),
                ),
            )
            rollout_id = cursor.lastrowid

            # Insert trajectories
            trajectories = rollout_dict.get("trajectories", [])
            for traj in trajectories:
                if isinstance(traj, TrajectoryData):
                    traj = asdict(traj)

                conn.execute(
                    """
                    INSERT INTO trajectories
                    (rollout_id, trajectory_idx, reward, output_text, output_tokens, logprobs,
                     pred_lat, pred_lon, distance_km, step_rewards)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rollout_id,
                        traj.get("trajectory_idx", 0),
                        traj.get("reward", 0.0),
                        traj.get("output_text"),
                        json.dumps(traj.get("output_tokens")) if traj.get("output_tokens") else None,
                        json.dumps(traj.get("logprobs")) if traj.get("logprobs") else None,
                        traj.get("pred_lat"),
                        traj.get("pred_lon"),
                        traj.get("distance_km"),
                        json.dumps(traj.get("step_rewards")) if traj.get("step_rewards") else None,
                    ),
                )

        conn.commit()

    def _rollout_data_to_dict(self, rollout: RolloutData) -> dict:
        """Convert RolloutData to a flat dict for database insertion."""
        result = {
            "group_idx": rollout.group_idx,
            "mean_reward": rollout.mean_reward,
            "best_reward": rollout.best_reward,
            "trajectories": [asdict(t) for t in rollout.trajectories],
        }

        obs = rollout.observation
        if isinstance(obs, TextObservation):
            result["prompt_text"] = obs.prompt_text
            result["prompt_tokens"] = obs.prompt_tokens
        elif isinstance(obs, VisionObservation):
            result["image_path"] = obs.image_path
            result["prompt_text"] = obs.prompt_text
            result["gt_lat"] = obs.gt_lat
            result["gt_lon"] = obs.gt_lon
            result["city"] = obs.city
            result["country"] = obs.country

        return result

    def end_run(self) -> None:
        """Mark the current run as complete."""
        if self.run_id is None:
            return

        conn = self._get_conn()
        conn.execute(
            "UPDATE runs SET ended_at = CURRENT_TIMESTAMP WHERE id = ?",
            (self.run_id,),
        )
        conn.commit()

        self.run_id = None
        self._modality = None

    def close(self) -> None:
        """Close the database connection."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> "TvizClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.end_run()
        self.close()


@contextmanager
def tviz_sweep(
    name: str,
    config: Optional[dict] = None,
    modality: Union[str, Modality] = Modality.TEXT,
    db_path: str = "tviz.db",
):
    """
    Context manager for sweep-level logging.

    Usage:
        with tviz_sweep("my_sweep", config={"lr": 1e-4}) as client:
            for step in range(1000):
                rollouts = sample_rollouts(env, policy)
                client.log_rollout(step, rollouts)
                client.log_step(step, {"reward_mean": mean_reward})

    Args:
        name: Human-readable name for the run
        config: Training configuration dict
        modality: "text" or "vision"
        db_path: Path to the SQLite database

    Yields:
        TvizClient: Configured client for logging
    """
    client = TvizClient(db_path)
    client.start_run(name, config=config, modality=modality)
    try:
        yield client
    finally:
        client.end_run()
        client.close()


class TvizEnvMixin:
    """
    Mixin for RL environments to auto-log rollouts.

    Usage:
        class MyEnv(TvizEnvMixin, gym.Env):
            def step(self, action):
                obs, reward, done, truncated, info = ...
                if done:
                    self.tviz_log_episode(trajectory, self.current_step)
                return obs, reward, done, truncated, info

        # In training script:
        client = TvizClient("./tviz.db")
        client.start_run("my_experiment", config)
        env = MyEnv()
        env.tviz_enable(client)
    """

    _tviz_client: Optional[TvizClient] = None
    _tviz_current_step: int = 0

    def tviz_enable(self, client: TvizClient) -> None:
        """Enable tviz logging for this environment."""
        self._tviz_client = client

    def tviz_disable(self) -> None:
        """Disable tviz logging."""
        self._tviz_client = None

    def tviz_set_step(self, step: int) -> None:
        """Set the current training step for logging."""
        self._tviz_current_step = step

    def tviz_log_episode(
        self,
        trajectory: Union[TrajectoryData, dict],
        step: Optional[int] = None,
        observation: Optional[Union[TextObservation, VisionObservation, dict]] = None,
        group_idx: int = 0,
    ) -> None:
        """
        Log a completed episode trajectory.

        Args:
            trajectory: The trajectory data for this episode
            step: Training step (uses internal counter if not provided)
            observation: The observation for this rollout
            group_idx: Index within the trajectory group
        """
        if self._tviz_client is None:
            return

        step = step if step is not None else self._tviz_current_step

        rollout: dict[str, Any] = {
            "group_idx": group_idx,
            "trajectories": [trajectory if isinstance(trajectory, dict) else asdict(trajectory)],
        }

        if observation is not None:
            if isinstance(observation, TextObservation):
                rollout["prompt_text"] = observation.prompt_text
                rollout["prompt_tokens"] = observation.prompt_tokens
            elif isinstance(observation, VisionObservation):
                rollout["image_path"] = observation.image_path
                rollout["prompt_text"] = observation.prompt_text
                rollout["gt_lat"] = observation.gt_lat
                rollout["gt_lon"] = observation.gt_lon
            elif isinstance(observation, dict):
                rollout.update(observation)

        self._tviz_client.log_rollout(step, [rollout])
