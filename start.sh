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

if ! docker model --help >/dev/null 2>&1; then
  echo "Error: Docker Model Runner is not available." >&2
  echo "Enable it in Docker Desktop → Settings → Features in development → Enable Docker Model Runner." >&2
  exit 1
fi

echo "=========================================="
echo "  Starting pgVector Demo"
echo "=========================================="
echo
echo "Models will be pulled on first run (ai/llama3.1:8B-Q4_K_M ~4.7GB, ai/mxbai-embed-large ~670MB)."
echo "This may take several minutes. Subsequent starts are instant."
echo

docker compose up --build -d

echo
echo "Waiting for backend to become healthy..."
for i in {1..90}; do
  if curl -fs http://localhost:5001/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fs http://localhost:5001/api/health >/dev/null 2>&1; then
  echo "Warning: backend not responding yet. Models may still be loading."
  echo "Check: docker compose logs -f backend"
fi

echo
echo "=========================================="
echo "  Ready!"
echo "=========================================="
echo "  Frontend:  http://localhost:8080"
echo "  Backend:   http://localhost:5001/api/health"
echo "  pgAdmin:   http://localhost:5050   (admin@demo.local / demo)"
echo "  Postgres:  localhost:5432          (demo / demo)"
echo "  Models:    docker model ls"
echo
echo "  Logs:  docker compose logs -f"
echo "  Stop:  ./stop.sh          (remove containers + volumes)"
echo "         ./stop.sh --keep   (preserve volumes)"
echo "         ./stop.sh --nuke   (also remove built images, build cache, and pulled models)"
echo "=========================================="
