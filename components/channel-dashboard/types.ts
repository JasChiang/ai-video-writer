export interface ChannelStats {
  // 頻道總體統計（不受時間範圍影響）
  totalSubscribers: number;
  totalViews: number;
  totalVideos: number; // 頻道總影片數

  // 時間範圍內的統計（基於 Analytics API）
  viewsInRange: number; // 時間範圍內實際產生的觀看數
  watchTimeHours: number; // 時間範圍內的觀看時長（小時）
  subscribersGained: number; // 時間範圍內新增訂閱數
  videosInRange: number; // 時間範圍內的影片數
}

export interface VideoItem {
  id: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  avgViewPercentage?: number;
  shareCount?: number;
  publishedAt: string;
  thumbnailUrl: string;
  description?: string;
}

export interface TrendTopVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  views: number;
}

export interface TrendDataPoint {
  date: string;
  views: number;
  subscribers: number;
  topVideo?: TrendTopVideo | null;
}

export interface MonthlyDataPoint {
  month: string; // 格式: YYYY-MM
  views: number;
  watchTimeHours: number;
  subscribersGained: number; // 新增訂閱
  subscribersLost: number; // 取消訂閱
  subscribersNet: number; // 淨增長 = subscribersGained - subscribersLost
  isCurrentMonth?: boolean; // 是否為本月至今
}

export interface TrafficSourceItem {
  source: string; // 流量來源類型或名稱
  views: number; // 觀看次數
  percentage: number; // 百分比
}

export interface SearchTermItem {
  term: string; // 搜尋字詞
  views: number; // 觀看次數
}

export interface DemographicsItem {
  ageGroup: string; // 年齡層
  gender: string; // 性別
  viewsPercentage: number; // 觀看百分比
}

export interface GeographyItem {
  country: string; // 國家代碼
  views: number; // 觀看次數
  percentage: number; // 百分比
}

export interface DeviceItem {
  deviceType: string; // 裝置類型
  views: number; // 觀看次數
  percentage: number; // 百分比
}

export interface ViewingHourData {
  dayOfWeek: number; // 0=星期日, 6=星期六
  hour: number; // 小時 (0-23)
  views: number; // 觀看次數
}

export interface SubscriberSourceItem {
  videoId: string; // 影片 ID
  videoTitle: string; // 影片標題
  subscribersGained: number; // 獲得訂閱數
}

export interface ComparisonData {
  current: number; // 當前期間數據
  previous: number; // 環比：前一期數據
  yearAgo: number; // 同比：去年同期數據
  changeFromPrevious: number; // 環比變化量
  changeFromPreviousPercent: number; // 環比變化百分比
  changeFromYearAgo: number; // 同比變化量
  changeFromYearAgoPercent: number; // 同比變化百分比
}

export interface ContentTypeMetrics {
  shorts: {
    views: number;
    watchTime: number;
    likes: number;
    shares: number;
    comments: number;
    videoCount: number;
  };
  regularVideos: {
    views: number;
    watchTime: number;
    likes: number;
    shares: number;
    comments: number;
    videoCount: number;
  };
}

export type ChartMetric = 'views' | 'watchTime' | 'subscribers';
export type QuickDateRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month';
