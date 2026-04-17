import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ChatMessage, RetrievedChunk } from '../services/api.service';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  retrievedChunks?: RetrievedChunk[];
  usedRag?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages: DisplayMessage[] = [];
  input = '';
  useRag = signal(false);
  loading = false;
  expandedChunks: Set<number> = new Set();

  constructor(private api: ApiService) {}

  get history(): ChatMessage[] {
    return this.messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }));
  }

  toggleRag() {
    this.useRag.update(v => !v);
  }

  toggleChunk(idx: number) {
    if (this.expandedChunks.has(idx)) {
      this.expandedChunks.delete(idx);
    } else {
      this.expandedChunks.add(idx);
    }
  }

  async send() {
    const text = this.input.trim();
    if (!text || this.loading) return;

    this.input = '';
    this.messages.push({ role: 'user', content: text });
    const loadingMsg: DisplayMessage = { role: 'assistant', content: '', loading: true };
    this.messages.push(loadingMsg);
    this.loading = true;
    this.scrollToBottom();

    this.api.chat(text, this.useRag(), this.history.slice(0, -1)).subscribe({
      next: res => {
        const idx = this.messages.indexOf(loadingMsg);
        this.messages[idx] = {
          role: 'assistant',
          content: res.response,
          retrievedChunks: res.retrieved_chunks,
          usedRag: res.used_rag
        };
        if (res.retrieved_chunk_ids?.length) {
          this.api.lastRetrievedChunkIds.set(res.retrieved_chunk_ids);
        }
        this.loading = false;
        this.scrollToBottom();
      },
      error: err => {
        const idx = this.messages.indexOf(loadingMsg);
        this.messages[idx] = {
          role: 'assistant',
          content: `Error: ${err.error?.error ?? err.message ?? 'Something went wrong'}`,
        };
        this.loading = false;
        this.scrollToBottom();
      }
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  clearChat() {
    this.messages = [];
    this.api.lastRetrievedChunkIds.set([]);
  }

  private scrollToBottom() {
    setTimeout(() => {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }
}
