import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'chat', pathMatch: 'full' },
  {
    path: 'chat',
    loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent)
  },
  {
    path: 'knowledge-base',
    loadComponent: () => import('./knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent)
  },
  {
    path: 'visualization',
    loadComponent: () => import('./visualization/visualization.component').then(m => m.VisualizationComponent)
  }
];
