import type { YouTubeVideo } from '../../types';

export interface AnalysisMarkdownProps {
  children: string;
  videos?: YouTubeVideo[]; // 影片数据，用于根据 ID 查找影片信息
  isStreaming?: boolean;
}

export type ChartValue = number | string | boolean | null;
export type ChartRecord = Record<string, ChartValue>;

export interface ChartListItem {
  label?: string;
  value?: ChartValue;
}

export interface ChartData {
  type: 'bar' | 'pie' | 'doughnut';
  title?: string;
  labels?: unknown;
  values?: unknown;
  data?: ChartListItem[] | ChartRecord;
  items?: ChartListItem[] | ChartRecord;
  datasets?: any[];
  colors?: string[];
  raw?: string;
}
