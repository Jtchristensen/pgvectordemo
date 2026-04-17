import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Document, UploadEvent } from '../services/api.service';

interface UploadState {
  file: File;
  status: 'uploading' | 'complete' | 'error';
  current: number;
  total: number;
  chunkPreview: string;
  message?: string;
}

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.scss'
})
export class KnowledgeBaseComponent implements OnInit {
  documents = signal<Document[]>([]);
  uploadState = signal<UploadState | null>(null);
  isDragging = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.api.getDocuments().subscribe(docs => this.documents.set(docs));
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.uploadFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadFile(file);
    input.value = '';
  }

  uploadFile(file: File) {
    if (!['text/plain', 'application/pdf', 'text/markdown'].includes(file.type) &&
        !file.name.endsWith('.txt') && !file.name.endsWith('.pdf') && !file.name.endsWith('.md')) {
      alert('Please upload a .txt, .pdf, or .md file');
      return;
    }

    this.uploadState.set({ file, status: 'uploading', current: 0, total: 0, chunkPreview: '' });

    this.api.uploadFile(file).subscribe({
      next: (event: UploadEvent) => {
        if (event.type === 'start') {
          this.uploadState.update(s => s ? { ...s, total: event.total ?? 0 } : s);
        } else if (event.type === 'progress') {
          this.uploadState.update(s => s ? {
            ...s,
            current: event.current ?? s.current,
            total: event.total ?? s.total,
            chunkPreview: event.chunk_preview ?? s.chunkPreview
          } : s);
        } else if (event.type === 'complete') {
          this.uploadState.update(s => s ? { ...s, status: 'complete' } : s);
          this.loadDocuments();
          setTimeout(() => this.uploadState.set(null), 3000);
        } else if (event.type === 'error') {
          this.uploadState.update(s => s ? { ...s, status: 'error', message: event.message } : s);
        }
      },
      error: err => {
        this.uploadState.update(s => s ? { ...s, status: 'error', message: String(err) } : s);
      }
    });
  }

  deleteDocument(doc: Document) {
    if (!confirm(`Delete "${doc.name}" and its ${doc.chunk_count} chunks?`)) return;
    this.api.deleteDocument(doc.id).subscribe(() => {
      this.loadDocuments();
      this.api.lastRetrievedChunkIds.set([]);
    });
  }

  get uploadProgress(): number {
    const s = this.uploadState();
    if (!s || s.total === 0) return 0;
    return Math.round((s.current / s.total) * 100);
  }
}
