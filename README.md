# pgVector Demo

A self-contained demo showing how vector embeddings and RAG (Retrieval-Augmented Generation) work, using PostgreSQL + pgvector, Ollama (local LLM), Angular frontend, and Flask backend — all in one `docker compose up`.

## Quick Start

```bash
docker compose up --build
```

> **First run**: Ollama will download `nomic-embed-text` (~274MB) and `llama3.2:3b` (~2GB). This takes a few minutes. The backend will start after models are ready.

Open **http://localhost:8080**

## Demo Flow

1. **Chat (no knowledge base)** — Ask something specific the AI wouldn't know (e.g. your company's refund policy)
2. **Knowledge Base** — Upload a `.txt` or `.pdf`. Watch the progress bar as each chunk is embedded and stored in pgvector in real time
3. **Visualization** — See all text chunks plotted in 2D vector space (PCA projection of 768-dim embeddings). Semantically similar text clusters together
4. **Chat with RAG** — Toggle **RAG Mode ON**, ask the same question. The AI now retrieves relevant chunks and answers correctly. Gold dots in the visualization show which chunks were used

## Architecture

| Service    | Image / Build | Port  | Purpose |
|-----------|--------------|-------|---------|
| postgres  | pgvector/pgvector:pg16 | 5432 | Vector DB |
| ollama    | ollama/ollama | 11434 | Local LLM + embeddings |
| backend   | ./backend (Python/Flask) | 5000 | API |
| frontend  | ./frontend (Angular + nginx) | 8080 | UI |

## Configuration

Edit `docker-compose.yml` environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_MODEL` | `llama3.2:3b` | Ollama model for chat |
| `EMBED_MODEL` | `nomic-embed-text` | Embedding model (768-dim) |
| `EMBED_DIM` | `768` | Must match model output dim |

To use a larger model (better quality, slower): change `LLM_MODEL` to `llama3.1:8b` or `mistral:7b` and update `ollama-init` accordingly.

## Teardown

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop + delete all data
```
