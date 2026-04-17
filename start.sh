#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not on PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running. Start Docker Desktop first." >&2
  exit 1
fi

echo "=========================================="
echo "  Starting pgVector Demo"
echo "=========================================="
echo

docker compose up --build -d

echo
echo "Waiting for Ollama to pull models (first run may take a few minutes)..."
echo "Tailing ollama-init logs — Ctrl+C to stop tailing (services keep running)."
echo

docker compose logs -f ollama-init &
TAIL_PID=$!

while true; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$(docker compose ps -q ollama-init 2>/dev/null)" 2>/dev/null || echo "missing")
  if [ "$STATUS" = "exited" ]; then
    break
  fi
  sleep 2
done

kill "$TAIL_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true

echo
echo "=========================================="
echo "  Ready!"
echo "=========================================="
echo "  Frontend:  http://localhost:8080"
echo "  Backend:   http://localhost:5000/api/health"
echo "  Ollama:    http://localhost:11434"
echo "  Postgres:  localhost:5432 (demo/demo)"
echo
echo "  Logs:  docker compose logs -f"
echo "  Stop:  ./stop.sh          (remove containers + volumes)"
echo "         ./stop.sh --keep   (preserve volumes)"
echo "         ./stop.sh --nuke   (also remove built images + build cache)"
echo "=========================================="
