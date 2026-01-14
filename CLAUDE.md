# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is tviz?

tviz is a local W&B-like dashboard for visualizing RL training runs with Tinker. It has two components:
1. **Python client** (`tviz/`) - Published to PyPI, logs metrics/rollouts to SQLite
2. **Next.js dashboard** (`app/`, `components/`) - Reads from SQLite, displays in real-time via SSE

## Commands

### Dashboard Development
```bash
bun install          # Install dependencies
bun dev              # Start dev server on port 3003
bun build            # Production build
bun start            # Start production server
```

### Python Development
```bash
pip install -e ".[dev]"    # Install with dev dependencies
ruff check tviz/           # Lint Python code
ruff format tviz/          # Format Python code
pytest tests/              # Run tests (requires TINKER_API_KEY)
```

### Running Examples
```bash
export TINKER_API_KEY=your-key
python examples/quickstart.py    # Minimal SFT example
python examples/gsm8k_rl.py      # Math reasoning with GRPO
```

## Architecture

```
Python Training Loop → TvizLogger → SQLite (~/.tviz/tviz.db)
                                          ↓
Next.js API Routes ←────────────── better-sqlite3 (read-only)
        ↓
React Dashboard ← SSE streaming (500ms polling via /api/live/stream)
```

### Data Flow
1. `TvizLogger` writes to SQLite: runs, steps (metrics), rollouts, trajectories
2. API routes (`app/api/`) read from SQLite via `better-sqlite3`
3. `useLiveTraining` hook consumes `/api/live/stream` SSE endpoint
4. Dashboard renders charts (Recharts) and trajectory cards

### Database Schema
- **runs**: Training job metadata (name, type, modality, config)
- **steps**: Per-step metrics (loss, reward_mean, kl_divergence, etc.)
- **rollouts**: Groups of trajectories per prompt (includes vision fields: gt_lat/lon, image_path)
- **trajectories**: Individual samples with output_text, logprobs, rewards

### Key Files
- `tviz/logger.py` - Core SQLite logger, all DB writes
- `tviz/adapters/tinker.py` - Converts Tinker TrajectoryGroup → tviz format
- `lib/db.ts` - TypeScript DB types and connection (reads `TVIZ_DB_PATH`)
- `hooks/useLiveTraining.ts` - EventSource hook for real-time updates
- `app/api/live/stream/route.ts` - SSE endpoint, polls DB every 500ms

### Modalities
- **text**: prompt_text, output_text, logprobs (default)
- **vision**: image_path, gt_lat/lon, pred_lat/lon, distance_km (geo-guessing)
- Extensible via `modality` param and `/lib/plugins/`

## Environment Variables

- `TVIZ_DB_PATH` - SQLite database path (default: `~/.tviz/tviz.db`)
- `TINKER_API_KEY` - Required for running examples/tests

## Conventions

- Python: Ruff for linting (line-length 100, py310+)
- TypeScript: Strict mode, path alias `@/*` → project root
- API routes: All use `force-dynamic`, no caching
- Commits: Format as `[LIN-XXX] message` with Linear ticket
