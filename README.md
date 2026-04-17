# pgVector Demo

A self-contained demo showing how vector embeddings and RAG (Retrieval-Augmented Generation) work, using PostgreSQL + pgvector, Docker Model Runner (GPU-accelerated local LLMs), Angular frontend, and Flask backend — all in one `docker compose up`.

## Prerequisites

- **Docker Desktop** (Mac with Apple Silicon recommended)
- **Docker Model Runner enabled**: Docker Desktop → Settings → Features in development → "Enable Docker Model Runner"

## Quick Start

```bash
./start.sh
```

Or manually: `docker compose up --build -d`

> **First run**: Docker Model Runner pulls `ai/llama3.1:8B-Q4_K_M` (~4.7GB) and `ai/mxbai-embed-large` (~670MB). This takes a few minutes. Models run on your Apple Silicon GPU directly (not in a container), so inference is fast.

Open **http://localhost:8080** (the app) and **http://localhost:5050** (pgAdmin).

## Demo Flow

1. **Chat (no knowledge base)** — Ask something specific the AI wouldn't know (e.g. your company's refund policy)
2. **Knowledge Base** — Upload a `.txt` or `.pdf`. Watch the progress bar as each chunk is embedded and stored in pgvector in real time
3. **Visualization** — See all text chunks plotted in 2D vector space (PCA projection of 1024-dim embeddings). Semantically similar text clusters together
4. **Chat with RAG** — Toggle **RAG Mode ON**, ask the same question. The AI now retrieves relevant chunks and answers correctly. Gold dots in the visualization show which chunks were used

## Architecture

| Service | Image / Build | Port | Purpose |
|---------|---------------|------|---------|
| postgres | pgvector/pgvector:pg16 | 5432 | Vector DB |
| pgadmin | dpage/pgadmin4 | 5050 | DB browser (pre-registered connection) |
| backend | ./backend (Python/Flask) | 5001 | API |
| frontend | ./frontend (Angular + nginx) | 8080 | UI |
| **Model Runner** | Docker Desktop (host process) | — | LLM + embeddings on GPU |

### pgAdmin access

- URL: **http://localhost:5050**
- Login: `admin@example.com` / `demo`
- The `pgvector demo` server is pre-registered and auto-connects (password from mounted pgpass file)

Useful demo queries once connected:

```sql
-- Show the vector column type in action
SELECT id, name, created_at FROM documents;
SELECT id, chunk_index, LEFT(text, 80) AS preview,
       vector_dims(embedding) AS dims
FROM chunks LIMIT 10;

-- Cosine similarity search (what RAG does under the hood)
SELECT d.name, c.chunk_index, LEFT(c.text, 100) AS preview,
       1 - (c.embedding <=> (SELECT embedding FROM chunks WHERE id = 1)) AS similarity
FROM chunks c JOIN documents d ON d.id = c.document_id
ORDER BY c.embedding <=> (SELECT embedding FROM chunks WHERE id = 1)
LIMIT 5;
```

Models are declared in `docker-compose.yml` under the `models:` top-level element. Compose injects the endpoint URL and model name as env vars into the backend (`LLM_URL`, `LLM_MODEL`, `EMBED_URL`, `EMBED_MODEL`). The backend uses the OpenAI Python SDK against Model Runner's OpenAI-compatible API.

## Configuration

Edit `docker-compose.yml`:

| Setting | Default | Description |
|---------|---------|-------------|
| `models.llm.model` | `ai/llama3.1:8B-Q4_K_M` | Chat model (~4.7GB) |
| `models.embedding.model` | `ai/mxbai-embed-large` | Embedding model (1024-dim) |
| `backend.environment.EMBED_DIM` | `1024` | Must match embedding model output |

**Alternatives** (browse at [hub.docker.com/u/ai](https://hub.docker.com/u/ai)):
- Smaller/faster LLM: `ai/llama3.2:3B-Q4_K_M`
- Larger/better LLM: `ai/qwen2.5:14B-Q4_K_M`
- Smaller embedding (768d): `ai/nomic-embed-text-v1.5` (set `EMBED_DIM: "768"`)

## Teardown

```bash
./stop.sh          # remove containers + volumes (postgres data wiped)
./stop.sh --keep   # preserve volumes
./stop.sh --nuke   # also remove built images, build cache, and pulled models
```
