import os
import json
import io
import logging
import time

import numpy as np
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
from sklearn.decomposition import PCA
import ollama
import PyPDF2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://demo:demo@localhost:5432/pgvector_demo')
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')
EMBED_MODEL = os.environ.get('EMBED_MODEL', 'nomic-embed-text')
LLM_MODEL = os.environ.get('LLM_MODEL', 'llama3.2:3b')
EMBED_DIM = int(os.environ.get('EMBED_DIM', '768'))

ollama_client = ollama.Client(host=OLLAMA_HOST)


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    return conn


def init_db():
    retries = 10
    for i in range(retries):
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS chunks (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                    chunk_index INTEGER,
                    text TEXT NOT NULL,
                    embedding vector({EMBED_DIM}),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
                ON chunks USING hnsw (embedding vector_cosine_ops)
            """)
            conn.commit()
            cur.close()
            conn.close()
            logger.info("Database initialized successfully")
            return
        except Exception as e:
            logger.warning(f"DB init attempt {i+1}/{retries} failed: {e}")
            time.sleep(3)
    raise RuntimeError("Failed to initialize database after retries")


def get_embedding(text: str) -> np.ndarray:
    response = ollama_client.embed(model=EMBED_MODEL, input=text)
    return np.array(response.embeddings[0])


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100):
    text = ' '.join(text.split())
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


def extract_text(file) -> str:
    filename = file.filename.lower()
    content = file.read()
    if filename.endswith('.pdf'):
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        return ' '.join(
            page.extract_text() or '' for page in reader.pages
        )
    return content.decode('utf-8', errors='replace')


@app.route('/api/health', methods=['GET'])
def health():
    try:
        models = ollama_client.list()
        model_names = [m.model for m in models.models]
        embed_ready = any(EMBED_MODEL in m for m in model_names)
        llm_ready = any(LLM_MODEL in m for m in model_names)
        return jsonify({
            'status': 'ok',
            'embed_model': EMBED_MODEL,
            'llm_model': LLM_MODEL,
            'embed_ready': embed_ready,
            'llm_ready': llm_ready,
            'available_models': model_names
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 503


@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    filename = file.filename

    try:
        text = extract_text(file)
    except Exception as e:
        return jsonify({'error': f'Failed to extract text: {e}'}), 400

    chunks = chunk_text(text)
    if not chunks:
        return jsonify({'error': 'No text content found in file'}), 400

    def generate():
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute("INSERT INTO documents (name) VALUES (%s) RETURNING id", (filename,))
            doc_id = cur.fetchone()['id']
            conn.commit()

            total = len(chunks)
            yield f"data: {json.dumps({'type': 'start', 'doc_id': doc_id, 'name': filename, 'total': total})}\n\n"

            for i, chunk in enumerate(chunks):
                embedding = get_embedding(chunk)
                cur.execute(
                    "INSERT INTO chunks (document_id, chunk_index, text, embedding) VALUES (%s, %s, %s, %s)",
                    (doc_id, i, chunk, embedding)
                )
                conn.commit()
                yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': total, 'chunk_preview': chunk[:80]})}\n\n"

            yield f"data: {json.dumps({'type': 'complete', 'doc_id': doc_id, 'name': filename, 'total_chunks': total})}\n\n"
        except Exception as e:
            logger.error(f"Upload error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            cur.close()
            conn.close()

    return Response(
        stream_with_context(generate()),
        content_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


@app.route('/api/documents', methods=['GET'])
def list_documents():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT d.id, d.name, d.created_at::text, COUNT(c.id) as chunk_count
        FROM documents d
        LEFT JOIN chunks c ON c.document_id = d.id
        GROUP BY d.id
        ORDER BY d.created_at DESC
    """)
    docs = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(docs)


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/visualization', methods=['GET'])
def get_visualization():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT c.id, c.text, c.embedding, d.name as document_name, d.id as document_id
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        ORDER BY d.id, c.chunk_index
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if len(rows) < 2:
        return jsonify([])

    embeddings = np.array([row['embedding'] for row in rows])
    n_components = min(2, len(embeddings))
    pca = PCA(n_components=n_components)
    coords = pca.fit_transform(embeddings)

    result = []
    for i, row in enumerate(rows):
        preview = row['text'][:120].replace('\n', ' ')
        if len(row['text']) > 120:
            preview += '...'
        result.append({
            'id': row['id'],
            'x': float(coords[i][0]),
            'y': float(coords[i][1]),
            'text_preview': preview,
            'document_name': row['document_name'],
            'document_id': row['document_id']
        })

    return jsonify(result)


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    message = data.get('message', '').strip()
    use_rag = data.get('use_rag', False)
    history = data.get('history', [])

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    retrieved_chunks = []
    retrieved_chunk_ids = []

    if use_rag:
        try:
            query_embedding = get_embedding(message)
            conn = get_db()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT c.id, c.text, d.name as document_name,
                       1 - (c.embedding <=> %s) as similarity
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                ORDER BY c.embedding <=> %s
                LIMIT 5
            """, (query_embedding, query_embedding))
            results = cur.fetchall()
            cur.close()
            conn.close()
            retrieved_chunks = [
                {'id': r['id'], 'text': r['text'], 'document': r['document_name'], 'similarity': float(r['similarity'])}
                for r in results
            ]
            retrieved_chunk_ids = [r['id'] for r in retrieved_chunks]
        except Exception as e:
            logger.error(f"RAG retrieval error: {e}")

    messages = []
    if retrieved_chunks:
        context = '\n\n'.join(
            f"[Source: {c['document']} | Relevance: {c['similarity']:.2f}]\n{c['text']}"
            for c in retrieved_chunks
        )
        messages.append({
            'role': 'system',
            'content': (
                "You are a helpful assistant with access to a knowledge base. "
                "Answer questions using the following retrieved context. "
                "If the context doesn't contain relevant information, say so clearly.\n\n"
                f"CONTEXT:\n{context}"
            )
        })
    else:
        messages.append({
            'role': 'system',
            'content': 'You are a helpful assistant.' + (
                ' Note: RAG mode is enabled but no relevant documents were found in the knowledge base.'
                if use_rag else ''
            )
        })

    for msg in history[-10:]:
        messages.append({'role': msg['role'], 'content': msg['content']})
    messages.append({'role': 'user', 'content': message})

    try:
        response = ollama_client.chat(model=LLM_MODEL, messages=messages)
        reply = response.message.content
    except Exception as e:
        return jsonify({'error': f'LLM error: {e}'}), 503

    return jsonify({
        'response': reply,
        'retrieved_chunks': retrieved_chunks,
        'retrieved_chunk_ids': retrieved_chunk_ids,
        'used_rag': use_rag and len(retrieved_chunks) > 0
    })


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
