import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  retrieved_chunks: RetrievedChunk[];
  retrieved_chunk_ids: number[];
  used_rag: boolean;
}

export interface RetrievedChunk {
  id: number;
  text: string;
  document: string;
  similarity: number;
}

export interface Document {
  id: number;
  name: string;
  created_at: string;
  chunk_count: number;
}

export interface VisualizationPoint {
  id: number;
  x: number;
  y: number;
  text_preview: string;
  document_name: string;
  document_id: number;
}

export interface UploadEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  doc_id?: number;
  name?: string;
  total_chunks?: number;
  chunk_preview?: string;
  message?: string;
}

const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  lastRetrievedChunkIds = signal<number[]>([]);

  constructor(private http: HttpClient) {}

  chat(message: string, useRag: boolean, history: ChatMessage[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${API_BASE}/chat`, { message, use_rag: useRag, history });
  }

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${API_BASE}/documents`);
  }

  deleteDocument(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${API_BASE}/documents/${id}`);
  }

  getVisualization(): Observable<VisualizationPoint[]> {
    return this.http.get<VisualizationPoint[]>(`${API_BASE}/visualization`);
  }

  uploadFile(file: File): Observable<UploadEvent> {
    const subject = new Subject<UploadEvent>();
    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
      .then(response => {
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              subject.complete();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6)) as UploadEvent;
                  subject.next(event);
                } catch {}
              }
            }
            read();
          }).catch(err => subject.error(err));
        };
        read();
      })
      .catch(err => subject.error(err));

    return subject.asObservable();
  }
}
