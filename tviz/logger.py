"""
TvizLogger - Logger interface compatible with tinker-cookbook.

Implements the Logger ABC from tinker_cookbook.utils.ml_log so it can be
added to MultiplexLogger alongside WandbLogger, NeptuneLogger, etc.
"""

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class TvizLogger:
    """
    Logger for tviz training visualization.

    Compatible with tinker-cookbook's Logger interface. Add to MultiplexLogger:

        logger = setup_logging(...)
        logger.loggers.append(TvizLogger("./tviz.db"))

    Or use standalone:

        logger = TvizLogger("./tviz.db", run_name="math_rl")
        logger.log_metrics({"reward": 0.5}, step=i)
        logger.log_rollouts(rollouts, step=i)
        logger.close()
    """

    def __init__(
        self,
        db_path: str = "tviz.db",
        run_name: Optional[str] = None,
        modality: str = "text",
    ):
        self.db_path = Path(db_path)
        self.run_id: str = str(uuid.uuid4())[:8]
        self.run_name = run_name or self.run_id
        self.modality = modality
        self._conn: Optional[sqlite3.Connection] = None
        self._config_logged = False
        self._ensure_schema()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _ensure_schema(self) -> None:
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'rl',
                modality TEXT DEFAULT 'text',
                config TEXT,
                started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT
            );

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

            CREATE TABLE IF NOT EXISTS rollouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                step INTEGER NOT NULL,
                group_idx INTEGER NOT NULL,
                image_path TEXT,
                gt_lat REAL,
                gt_lon REAL,
                city TEXT,
                country TEXT,
                prompt_text TEXT,
                prompt_tokens TEXT,
                mean_reward REAL,
                best_reward REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            );

            CREATE TABLE IF NOT EXISTS trajectories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rollout_id INTEGER NOT NULL,
                trajectory_idx INTEGER NOT NULL,
                reward REAL NOT NULL,
                output_text TEXT,
                output_tokens TEXT,
                logprobs TEXT,
                pred_lat REAL,
                pred_lon REAL,
                distance_km REAL,
                step_rewards TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rollout_id) REFERENCES rollouts(id)
            );

            CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id);
            CREATE INDEX IF NOT EXISTS idx_rollouts_run_id ON rollouts(run_id);
            CREATE INDEX IF NOT EXISTS idx_rollouts_step ON rollouts(run_id, step);
            CREATE INDEX IF NOT EXISTS idx_trajectories_rollout ON trajectories(rollout_id);
        """)
        conn.commit()

    # -------------------------------------------------------------------------
    # Logger interface (tinker-cookbook compatible)
    # -------------------------------------------------------------------------

    def log_hparams(self, config: Any) -> None:
        """Log hyperparameters/configuration. Creates the run."""
        if self._config_logged:
            return

        conn = self._get_conn()
        config_json = json.dumps(config) if config else None
        conn.execute(
            "INSERT INTO runs (id, name, type, modality, config) VALUES (?, ?, ?, ?, ?)",
            (self.run_id, self.run_name, "rl", self.modality, config_json),
        )
        conn.commit()
        self._config_logged = True

    def log_metrics(self, metrics: Dict[str, Any], step: Optional[int] = None) -> None:
        """Log scalar metrics for a training step."""
        # Auto-create run if not yet created
        if not self._config_logged:
            self.log_hparams({})

        if step is None:
            return

        # Extract known columns
        data = dict(metrics)
        reward_mean = data.pop("reward_mean", data.pop("reward", None))
        reward_std = data.pop("reward_std", None)
        loss = data.pop("loss", None)
        kl_divergence = data.pop("kl_divergence", data.pop("kl", data.pop("kl_sample_train", None)))
        entropy = data.pop("entropy", None)
        learning_rate = data.pop("learning_rate", data.pop("lr", None))

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
                json.dumps(data) if data else None,
            ),
        )
        conn.commit()

    def log_rollouts(self, rollouts: List[Dict], step: int) -> None:
        """
        Log rollouts (trajectories) for visualization.

        Each rollout dict should have:
            - group_idx: int
            - prompt_text: str (for text modality)
            - image_path: str (for vision modality)
            - trajectories: list of dicts with reward, output_text, etc.
        """
        if not self._config_logged:
            self.log_hparams({})

        conn = self._get_conn()

        for rollout in rollouts:
            trajectories = rollout.get("trajectories", [])
            rewards = [t.get("reward", 0) for t in trajectories]
            mean_reward = sum(rewards) / len(rewards) if rewards else None
            best_reward = max(rewards) if rewards else None

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
                    rollout.get("group_idx", 0),
                    rollout.get("image_path"),
                    rollout.get("gt_lat"),
                    rollout.get("gt_lon"),
                    rollout.get("city"),
                    rollout.get("country"),
                    rollout.get("prompt_text"),
                    json.dumps(rollout.get("prompt_tokens")) if rollout.get("prompt_tokens") else None,
                    mean_reward,
                    best_reward,
                ),
            )
            rollout_id = cursor.lastrowid

            for traj in trajectories:
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

    def close(self) -> None:
        """Mark run as complete and close connection."""
        if self._conn is not None:
            self._conn.execute(
                "UPDATE runs SET ended_at = CURRENT_TIMESTAMP WHERE id = ?",
                (self.run_id,),
            )
            self._conn.commit()
            self._conn.close()
            self._conn = None

    def sync(self) -> None:
        """Force sync (no-op for SQLite, included for interface compat)."""
        pass

    def get_logger_url(self) -> Optional[str]:
        """Return URL to view this run (local dashboard)."""
        return f"http://localhost:3000/training-run/{self.run_id}"
