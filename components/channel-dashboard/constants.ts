import type { QuickDateRange } from './types';

export const FILTER_STORAGE_KEY = 'channel_dashboard_filters';
export const DATA_STORAGE_KEY = 'channel_dashboard_data';

export const QUICK_DATE_PRESETS: { label: string; value: QuickDateRange }[] = [
  { label: '過去 7 天', value: '7d' },
  { label: '過去 30 天', value: '30d' },
  { label: '過去 90 天', value: '90d' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
];

export const TOP_VIDEO_METRICS = [
  { label: '觀看次數', value: 'views' as const },
  { label: '平均觀看百分比', value: 'avgViewPercent' as const },
  { label: '分享次數', value: 'shares' as const },
  { label: '留言次數', value: 'comments' as const },
];

export const DAY_OF_WEEK_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export const VIEWING_HOUR_BUCKETS = [
  { label: '00:00-03:59', start: 0, end: 3 },
  { label: '04:00-07:59', start: 4, end: 7 },
  { label: '08:00-11:59', start: 8, end: 11 },
  { label: '12:00-15:59', start: 12, end: 15 },
  { label: '16:00-19:59', start: 16, end: 19 },
  { label: '20:00-23:59', start: 20, end: 23 },
];
