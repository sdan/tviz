# Repository Guidelines

This repository hosts tviz, a local RL training dashboard with two parts: a Python
client that logs to SQLite and a Next.js UI that reads from the DB in real time.

## Project Structure & Module Organization

- `tviz/`: Python package (logger, adapters) published to PyPI.
- `app/`: Next.js App Router pages and API routes (`app/api/**/route.ts`).
- `components/`, `hooks/`, `lib/`: React UI, shared hooks, and DB/util helpers.
- `public/`: static assets for the dashboard.
- `examples/`: runnable Python examples for integration.
- `tests/`: pytest suite (`test_*.py`).

## Build, Test, and Development Commands

```bash
bun install              # Install dashboard dependencies
bun dev                  # Run Next.js dev server on http://localhost:3003
bun build                # Production build
bun start                # Serve production build on port 3003
pip install -e ".[dev]"  # Install Python client with dev tools
ruff check tviz/         # Lint Python code
ruff format tviz/        # Format Python code
pytest tests/            # Run Python tests (requires TINKER_API_KEY)
```

To run an example:
```bash
export TINKER_API_KEY=your-key
python examples/quickstart.py
```

## Coding Style & Naming Conventions

- Python uses Ruff with `line-length = 100` (see `pyproject.toml`).
- TypeScript/TSX uses strict mode (`tsconfig.json`); match existing formatting
  (2-space indentation and double quotes in UI code).
- React hooks are named with `use*` and live in `hooks/`.

## Testing Guidelines

- Tests live in `tests/` and follow `test_*.py` naming.
- Use `pytest tests/`; tests expect `TINKER_API_KEY` in the environment.
- No explicit coverage target; add tests for new behavior or bug fixes.

## Commit & Pull Request Guidelines

- Recent history uses short, imperative commit subjects with prefixes like
  `feat:`, `fix:`, `refactor:`, `simplify:`, `move:`, or `debug:`.
- PRs should include a concise summary, test results, and screenshots for UI
  changes. Link issues or tickets when applicable.

## Configuration & Environment

- `TVIZ_DB_PATH` overrides the SQLite location (default: `~/.tviz/tviz.db`).
- `TINKER_API_KEY` is required for running examples and tests.
