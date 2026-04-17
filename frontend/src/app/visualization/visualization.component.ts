import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ScatterController, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { ApiService, VisualizationPoint } from '../services/api.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend);

const COLORS = [
  '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'
];

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './visualization.component.html',
  styleUrl: './visualization.component.scss'
})
export class VisualizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  chart: Chart | null = null;
  points = signal<VisualizationPoint[]>([]);
  hoveredPoint = signal<VisualizationPoint | null>(null);
  totalPoints = signal(0);
  uniqueDocs = signal(0);
  highlightedIds = signal<number[]>([]);
  private pollSub?: Subscription;
  private viewInit = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.highlightedIds = this.api.lastRetrievedChunkIds;

    this.pollSub = interval(3000).pipe(
      startWith(0),
      switchMap(() => this.api.getVisualization())
    ).subscribe(pts => {
      this.points.set(pts);
      this.totalPoints.set(pts.length);
      const docIds = new Set(pts.map(p => p.document_id));
      this.uniqueDocs.set(docIds.size);
      if (this.viewInit) this.updateChart(pts);
    });
  }

  ngAfterViewInit() {
    this.viewInit = true;
    this.initChart();
    const pts = this.points();
    if (pts.length) this.updateChart(pts);
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.chart?.destroy();
  }

  private initChart() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              boxWidth: 12,
              padding: 16,
              font: { size: 12, family: 'Inter' }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pt = ctx.raw as { x: number; y: number; pointData: VisualizationPoint };
                return pt.pointData?.text_preview ?? '';
              },
              title: (items) => {
                const pt = items[0].raw as { pointData: VisualizationPoint };
                return pt.pointData?.document_name ?? '';
              }
            },
            backgroundColor: 'rgba(18, 18, 42, 0.95)',
            borderColor: '#2a2a5a',
            borderWidth: 1,
            titleColor: '#9f5cf5',
            bodyColor: '#94a3b8',
            padding: 12,
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            maxWidth: 300
          }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: 'rgba(42, 42, 90, 0.5)' }
          },
          y: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: 'rgba(42, 42, 90, 0.5)' }
          }
        }
      }
    });
  }

  private updateChart(pts: VisualizationPoint[]) {
    if (!this.chart) return;

    const highlighted = new Set(this.highlightedIds());
    const docMap = new Map<number, { name: string; color: string; points: VisualizationPoint[] }>();

    pts.forEach(pt => {
      if (!docMap.has(pt.document_id)) {
        const colorIdx = docMap.size % COLORS.length;
        docMap.set(pt.document_id, { name: pt.document_name, color: COLORS[colorIdx], points: [] });
      }
      docMap.get(pt.document_id)!.points.push(pt);
    });

    const datasets = Array.from(docMap.values()).map(doc => ({
      label: doc.name,
      data: doc.points.map(p => ({
        x: p.x,
        y: p.y,
        pointData: p
      })),
      backgroundColor: doc.points.map(p =>
        highlighted.size > 0 && highlighted.has(p.id)
          ? '#fbbf24'
          : doc.color + 'cc'
      ),
      borderColor: doc.points.map(p =>
        highlighted.size > 0 && highlighted.has(p.id)
          ? '#f59e0b'
          : doc.color
      ),
      pointRadius: doc.points.map(p =>
        highlighted.size > 0 && highlighted.has(p.id) ? 10 : 6
      ),
      pointHoverRadius: 10,
      borderWidth: doc.points.map(p =>
        highlighted.size > 0 && highlighted.has(p.id) ? 2 : 1
      )
    }));

    this.chart.data.datasets = datasets as any;
    this.chart.update('none');
  }

  get docList(): { id: number; name: string; count: number; color: string }[] {
    const pts = this.points();
    const map = new Map<number, { name: string; count: number; color: string }>();
    pts.forEach(p => {
      if (!map.has(p.document_id)) {
        map.set(p.document_id, { name: p.document_name, count: 0, color: COLORS[map.size % COLORS.length] });
      }
      map.get(p.document_id)!.count++;
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }
}
