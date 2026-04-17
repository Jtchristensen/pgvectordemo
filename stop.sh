#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

MODE="default"
case "${1:-}" in
  --keep|-k)  MODE="keep" ;;
  --nuke|-n)  MODE="nuke" ;;
  --help|-h)
    cat <<EOF
Usage: ./stop.sh [option]

  (none)    Stop containers, remove volumes (postgres data + ollama models)
  --keep    Stop containers, preserve volumes
  --nuke    Full cleanup: containers + volumes + built images + build cache
            Leaves third-party base images (pgvector, ollama, nginx...) alone

EOF
    exit 0
    ;;
esac

echo "=========================================="
echo "  Stopping pgVector Demo"
echo "=========================================="

case "$MODE" in
  keep)
    docker compose down
    echo "Containers stopped. Volumes preserved."
    ;;
  default)
    docker compose down -v
    echo "Containers + volumes removed."
    echo "Built images and build cache retained (~4GB). Use --nuke for full cleanup."
    ;;
  nuke)
    echo "Nuking everything for this project..."
    docker compose down -v --rmi local --remove-orphans
    docker builder prune -f --filter "label=com.docker.compose.project=pgvectordemo" >/dev/null 2>&1 || true
    docker builder prune -f >/dev/null
    echo
    echo "Removed: containers, volumes, networks, built images, build cache."
    echo "Base images (pgvector, ollama, nginx, python, node) left intact —"
    echo "they may be used by other projects. To remove them too:"
    echo "  docker rmi pgvector/pgvector:pg16 ollama/ollama nginx:alpine python:3.11-slim node:20-alpine"
    ;;
esac
