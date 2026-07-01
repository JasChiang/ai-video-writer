/**
 * 頻道儀錶板組件
 *
 * 數據獲取策略（分層策略）：
 *
 * 1. 頻道等級資料（使用 YouTube Data API + OAuth）
 *    - 訂閱數 (subscriberCount)
 *    - 總觀看數 (viewCount)
 *    - 配額成本：1 單位 (channels.list with part=statistics)
 *
 * 2. 影片等級資料（使用 Gist 快取）
 *    - 影片總數（從快取計算）
 *    - 熱門影片列表（標題、觀看數、讚數、評論數）
 *    - 影片縮圖（使用快取中的 thumbnail 字段）
 *    - 配額成本：0 單位（零配額！）
 *
 *    Gist 快取數據結構：
 *    {
 *      videoId: string,          // 影片 ID
 *      title: string,            // 標題
 *      thumbnail: string,        // 縮圖 URL（注意字段名是 thumbnail）
 *      publishedAt: string,      // 發布日期
 *      viewCount: number,        // 觀看數
 *      likeCount: number,        // 讚數
 *      commentCount: number,     // 評論數
 *      tags: string[],           // 標籤
 *      categoryId: string,       // 分類 ID
 *      privacyStatus: string     // 隱私狀態
 *    }
 *
 * 優勢：
 * - 相比傳統方式節省 90% 配額
 * - 影片數據與快取一致，避免數據不同步
 * - 縮圖直接使用快取位置，無需額外請求
 *
 * 前置條件：
 * - 需要登入 YouTube 帳號（OAuth）
 * - 需要設定 GITHUB_GIST_ID 環境變數
 * - 需要先運行 `npm run update-cache` 生成影片快取
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  Eye,
  Users,
  Video,
  Clock,
  ThumbsUp,
  MessageSquare,
  Calendar,
  BarChart3,
  RefreshCw,
  Share2,
  Monitor,
  Smartphone,
  Tablet,
  Tv,
  Gamepad2,
  Crown,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import * as youtubeService from '../services/youtubeService';
import { ChannelAnalysisPanel } from './ChannelAnalysisPanel';

declare const gapi: any;

// 註冊 Chart.js 組件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChannelStats {
  // 頻道總體統計（不受時間範圍影響）
  totalSubscribers: number;
  totalViews: number;
  totalVideos: number;         // 頻道總影片數

  // 時間範圍內的統計（基於 Analytics API）
  viewsInRange: number;        // 時間範圍內實際產生的觀看數
  watchTimeHours: number;      // 時間範圍內的觀看時長（小時）
  subscribersGained: number;   // 時間範圍內新增訂閱數
  videosInRange: number;       // 時間範圍內的影片數
}

interface VideoItem {
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

interface TrendTopVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  views: number;
}

interface TrendDataPoint {
  date: string;
  views: number;
  subscribers: number;
  topVideo?: TrendTopVideo | null;
}

interface TrendChartCoordinate {
  date: string;
  views: number;
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
  topVideo?: TrendTopVideo | null;
}

interface MonthlyDataPoint {
  month: string;           // 格式: YYYY-MM
  views: number;
  watchTimeHours: number;
  subscribersGained: number;  // 新增訂閱
  subscribersLost: number;    // 取消訂閱
  subscribersNet: number;     // 淨增長 = subscribersGained - subscribersLost
  isCurrentMonth?: boolean;   // 是否為本月至今
}

interface TrafficSourceItem {
  source: string;          // 流量來源類型或名稱
  views: number;           // 觀看次數
  percentage: number;      // 百分比
}

interface SearchTermItem {
  term: string;            // 搜尋字詞
  views: number;           // 觀看次數
}

interface DemographicsItem {
  ageGroup: string;        // 年齡層
  gender: string;          // 性別
  viewsPercentage: number; // 觀看百分比
}

interface GeographyItem {
  country: string;         // 國家代碼
  views: number;           // 觀看次數
  percentage: number;      // 百分比
}

interface DeviceItem {
  deviceType: string;      // 裝置類型
  views: number;           // 觀看次數
  percentage: number;      // 百分比
}

interface ViewingHourData {
  dayOfWeek: number;       // 0=星期日, 6=星期六
  hour: number;            // 小時 (0-23)
  views: number;           // 觀看次數
}

interface SubscriberSourceItem {
  videoId: string;         // 影片 ID
  videoTitle: string;      // 影片標題
  subscribersGained: number; // 獲得訂閱數
}

interface ComparisonData {
  current: number;                    // 當前期間數據
  previous: number;                   // 環比：前一期數據
  yearAgo: number;                    // 同比：去年同期數據
  changeFromPrevious: number;         // 環比變化量
  changeFromPreviousPercent: number;  // 環比變化百分比
  changeFromYearAgo: number;          // 同比變化量
  changeFromYearAgoPercent: number;   // 同比變化百分比
}

interface ContentTypeMetrics {
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

type ChartMetric = 'views' | 'watchTime' | 'subscribers';
type QuickDateRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month';

const FILTER_STORAGE_KEY = 'channel_dashboard_filters';
const DATA_STORAGE_KEY = 'channel_dashboard_data';

const QUICK_DATE_PRESETS: { label: string; value: QuickDateRange }[] = [
  { label: '過去 7 天', value: '7d' },
  { label: '過去 30 天', value: '30d' },
  { label: '過去 90 天', value: '90d' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
];

const TOP_VIDEO_METRICS = [
  { label: '觀看次數', value: 'views' as const },
  { label: '平均觀看百分比', value: 'avgViewPercent' as const },
  { label: '分享次數', value: 'shares' as const },
  { label: '留言次數', value: 'comments' as const },
];

const DAY_OF_WEEK_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const VIEWING_HOUR_BUCKETS = [
  { label: '00:00-03:59', start: 0, end: 3 },
  { label: '04:00-07:59', start: 4, end: 7 },
  { label: '08:00-11:59', start: 8, end: 11 },
  { label: '12:00-15:59', start: 12, end: 15 },
  { label: '16:00-19:59', start: 16, end: 19 },
  { label: '20:00-23:59', start: 20, end: 23 },
];

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
const YT_VIDEO_BASE_URL = 'https://www.youtube.com/watch?v=';
const ENABLE_PUBLISHING_SLOTS = false;
const ANALYTICS_DATA_DELAY_DAYS = 3; // API 數據比 YouTube Studio 晚 1 天，實際最晚僅能查到今天往前 3 天

const getAnalyticsAvailableEndDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ANALYTICS_DATA_DELAY_DAYS);
  return date;
};

// 使用本地時區格式化，避免 UTC 時區偏移
const formatDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 計算快速日期範圍
const getQuickDateRange = (range: QuickDateRange): { start: string; end: string } => {
  const today = new Date();
  const analyticsEndDate = getAnalyticsAvailableEndDate();
  let endDate = new Date(analyticsEndDate);
  let startDate = new Date(endDate);

  switch (range) {
    case '7d':
      startDate.setDate(endDate.getDate() - 6); // 包含今日可用日的 7 天
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 29); // 包含今日可用日的 30 天
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 89); // 包含今日可用日的 90 天
      break;
    case 'this_month': {
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = startOfCurrentMonth;
      endDate = analyticsEndDate < endOfCurrentMonth ? new Date(analyticsEndDate) : endOfCurrentMonth;
      break;
    }
    case 'last_month': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      startDate = startOfLastMonth;
      endDate = analyticsEndDate < endOfLastMonth ? new Date(analyticsEndDate) : endOfLastMonth;
      break;
    }
  }

  if (startDate > endDate) {
    startDate = new Date(endDate);
  }

  return {
    start: formatDateString(startDate),
    end: formatDateString(endDate),
  };
};

// 計算默認日期範圍（過去30天）- 使用台灣時間
const getDefaultDateRange = () => {
  return getQuickDateRange('30d');
};

export function ChannelDashboard() {
  // 狀態管理
  const defaultDates = getDefaultDateRange();
  // YouTube-style card design
  const cardBaseClass = 'rounded-xl border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-200';
  const compactCardClass = `${cardBaseClass} p-6 self-start`;
  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [topVideos, setTopVideos] = useState<VideoItem[]>([]);

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('views');
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSourceItem[]>([]);
  const [externalSources, setExternalSources] = useState<TrafficSourceItem[]>([]);
  const [searchTerms, setSearchTerms] = useState<SearchTermItem[]>([]);
  const [showDataSourceInfo, setShowDataSourceInfo] = useState(false);

  // 新增功能的狀態
  const [demographics, setDemographics] = useState<DemographicsItem[]>([]);
  const [geography, setGeography] = useState<GeographyItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [viewingHours, setViewingHours] = useState<ViewingHourData[]>([]);
  const [viewingHoursSource, setViewingHoursSource] = useState<'analytics' | 'cache' | 'none'>('none');
  const [subscriberSources, setSubscriberSources] = useState<SubscriberSourceItem[]>([]);
  const [avgViewDuration, setAvgViewDuration] = useState<number>(0);
  const [avgViewPercentage, setAvgViewPercentage] = useState<number>(0);
  const [viewsComparison, setViewsComparison] = useState<ComparisonData | null>(null);
  const [watchTimeComparison, setWatchTimeComparison] = useState<ComparisonData | null>(null);
  const [subscribersComparison, setSubscribersComparison] = useState<ComparisonData | null>(null);
  const [topVideoMetric, setTopVideoMetric] = useState<'views' | 'avgViewPercent' | 'shares' | 'comments'>('views');
  const [contentTypeMetrics, setContentTypeMetrics] = useState<ContentTypeMetrics | null>(null);
  const [topShorts, setTopShorts] = useState<VideoItem[]>([]);
  const [topRegularVideos, setTopRegularVideos] = useState<VideoItem[]>([]);

  // 排行榜展開/收起狀態
const [isTopVideosExpanded, setIsTopVideosExpanded] = useState(true);
const [isTopShortsExpanded, setIsTopShortsExpanded] = useState(true);
const [isTopRegularVideosExpanded, setIsTopRegularVideosExpanded] = useState(true);
const showVideoRankingsDoubleColumn =
  topShorts.length > 0 &&
  topRegularVideos.length > 0 &&
  isTopShortsExpanded &&
  isTopRegularVideosExpanded;

  // 影片卡片展開狀態
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // 切換影片卡片展開狀態
  const toggleVideoExpanded = (videoId: string) => {
    console.log('[Dashboard] 🎬 Toggle video expansion:', videoId);
    setExpandedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        console.log('[Dashboard] ⬆️ Collapsing video:', videoId);
        newSet.delete(videoId);
        // 收起影片時，同時收起描述
        setExpandedDescriptions(prevDesc => {
          const newDescSet = new Set(prevDesc);
          newDescSet.delete(videoId);
          return newDescSet;
        });
      } else {
        console.log('[Dashboard] ⬇️ Expanding video:', videoId);
        newSet.add(videoId);
      }
      console.log('[Dashboard] 📋 Currently expanded videos:', Array.from(newSet));
      return newSet;
    });
  };

  // 切換描述展開狀態
  const toggleDescriptionExpanded = (videoId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const analyticsAvailableDate = getAnalyticsAvailableEndDate();
  const maxSelectableDate = formatDateString(analyticsAvailableDate);
  const todayDate = new Date();
  const startOfCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const endOfLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
  const isCurrentMonthSelectable = analyticsAvailableDate >= startOfCurrentMonth;
  const isLastMonthSelectable = analyticsAvailableDate >= endOfLastMonth;
  const isQuickPresetDisabled = (value: QuickDateRange) => {
    if (value === 'this_month') return !isCurrentMonthSelectable;
    if (value === 'last_month') return !isLastMonthSelectable;
    return false;
  };

  const hasHydratedRef = useRef(false);
  const videoCacheRef = useRef<Record<string, any> | null>(null);

  // 載入快取的日期與數據
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedFilters = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (storedFilters) {
        const parsed = JSON.parse(storedFilters);
        if (parsed?.startDate) setStartDate(parsed.startDate);
        if (parsed?.endDate) setEndDate(parsed.endDate);
        if (parsed?.topVideoMetric) setTopVideoMetric(parsed.topVideoMetric);
      }

      const storedData = window.localStorage.getItem(DATA_STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed?.startDate) setStartDate(parsed.startDate);
        if (parsed?.endDate) setEndDate(parsed.endDate);
        if (parsed?.topVideoMetric) setTopVideoMetric(parsed.topVideoMetric);
        if (parsed?.channelStats) setChannelStats(parsed.channelStats);
        if (Array.isArray(parsed?.topVideos)) setTopVideos(parsed.topVideos);
        if (Array.isArray(parsed?.monthlyData)) setMonthlyData(parsed.monthlyData);
        if (Array.isArray(parsed?.trafficSources)) setTrafficSources(parsed.trafficSources);
        if (Array.isArray(parsed?.externalSources)) setExternalSources(parsed.externalSources);
        if (Array.isArray(parsed?.searchTerms)) setSearchTerms(parsed.searchTerms);
        if (Array.isArray(parsed?.trendData)) setTrendData(parsed.trendData);
        if (Array.isArray(parsed?.demographics)) setDemographics(parsed.demographics);
        if (Array.isArray(parsed?.geography)) setGeography(parsed.geography);
        if (Array.isArray(parsed?.devices)) setDevices(parsed.devices);
        if (Array.isArray(parsed?.viewingHours)) setViewingHours(parsed.viewingHours);
        if (parsed?.viewingHoursSource) setViewingHoursSource(parsed.viewingHoursSource);
        if (Array.isArray(parsed?.subscriberSources)) setSubscriberSources(parsed.subscriberSources);
        if (typeof parsed?.avgViewDuration === 'number') setAvgViewDuration(parsed.avgViewDuration);
        if (typeof parsed?.avgViewPercentage === 'number') setAvgViewPercentage(parsed.avgViewPercentage);
        if (parsed?.viewsComparison) setViewsComparison(parsed.viewsComparison);
        if (parsed?.watchTimeComparison) setWatchTimeComparison(parsed.watchTimeComparison);
        if (parsed?.subscribersComparison) setSubscribersComparison(parsed.subscribersComparison);
        if (parsed?.contentTypeMetrics) setContentTypeMetrics(parsed.contentTypeMetrics);
        if (Array.isArray(parsed?.topShorts)) setTopShorts(parsed.topShorts);
        if (Array.isArray(parsed?.topRegularVideos)) setTopRegularVideos(parsed.topRegularVideos);
      }
    } catch (err) {
      console.warn('[Dashboard] ⚠️ 無法還原快取資料:', err);
    } finally {
      hasHydratedRef.current = true;
    }
  }, []);

  // 儲存日期選擇
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasHydratedRef.current) return;
    window.localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ startDate, endDate, topVideoMetric })
    );
  }, [startDate, endDate, topVideoMetric]);

  // 受限於 API 數據延遲，確保選取的日期不會超出可查詢範圍
  useEffect(() => {
    let nextStart = startDate;
    let nextEnd = endDate;

    if (startDate > maxSelectableDate) {
      nextStart = maxSelectableDate;
    }
    if (endDate > maxSelectableDate) {
      nextEnd = maxSelectableDate;
    }

    if (nextStart !== startDate) {
      setStartDate(nextStart);
    }
    if (nextEnd !== endDate) {
      setEndDate(nextEnd);
    }
  }, [startDate, endDate, maxSelectableDate]);

  // 儲存儀表板數據
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasHydratedRef.current) return;
    if (!channelStats) return;

    const payload = {
      timestamp: Date.now(),
      startDate,
      endDate,
      channelStats,
      topVideos,
      monthlyData,
      trafficSources,
      externalSources,
      searchTerms,
      trendData,
      demographics,
      geography,
      devices,
      viewingHours,
      viewingHoursSource,
      subscriberSources,
      avgViewDuration,
      avgViewPercentage,
      viewsComparison,
      watchTimeComparison,
      subscribersComparison,
      topVideoMetric,
      contentTypeMetrics,
      topShorts,
      topRegularVideos,
    };

    window.localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(payload));
  }, [
    channelStats,
    topVideos,
    monthlyData,
    trafficSources,
    externalSources,
    searchTerms,
    trendData,
    demographics,
    geography,
    devices,
    viewingHours,
    viewingHoursSource,
    subscriberSources,
    avgViewDuration,
    avgViewPercentage,
    viewsComparison,
    watchTimeComparison,
    subscribersComparison,
    startDate,
    endDate,
    topVideoMetric,
    contentTypeMetrics,
    topShorts,
    topRegularVideos,
  ]);

  // 計算日期範圍
  const parseDateAtTaipei = (dateStr: string, endOfDay = false) => {
    const parsed = new Date(`${dateStr}T00:00:00+08:00`);
    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    }
    return parsed;
  };

  const computeComparisonPeriods = (start: Date, end: Date) => {
    const normalizedStart = new Date(start);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(end);
    normalizedEnd.setHours(0, 0, 0, 0);

    const daysDiff =
      Math.ceil((normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const isFullMonthRange =
      normalizedStart.getFullYear() === normalizedEnd.getFullYear() &&
      normalizedStart.getMonth() === normalizedEnd.getMonth() &&
      normalizedStart.getDate() === 1 &&
      normalizedEnd.getDate() === new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth() + 1, 0).getDate();

    const isFullYearRange =
      normalizedStart.getFullYear() === normalizedEnd.getFullYear() &&
      normalizedStart.getMonth() === 0 &&
      normalizedStart.getDate() === 1 &&
      normalizedEnd.getMonth() === 11 &&
      normalizedEnd.getDate() === 31;

    let previousStart: Date;
    let previousEnd: Date;

    if (isFullMonthRange) {
      previousStart = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth() - 1, 1);
      previousEnd = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth(), 0);
    } else if (isFullYearRange) {
      previousStart = new Date(normalizedStart.getFullYear() - 1, 0, 1);
      previousEnd = new Date(normalizedStart.getFullYear() - 1, 11, 31);
    } else {
      previousEnd = new Date(normalizedStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - daysDiff + 1);
    }

    const yearAgoStart = new Date(normalizedStart);
    yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
    const yearAgoEnd = new Date(normalizedEnd);
    yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);

    return { previousStart, previousEnd, yearAgoStart, yearAgoEnd, daysDiff };
  };

  const getDateRange = (): { startDate: Date; endDate: Date } => {
    const start = parseDateAtTaipei(startDate, false);
    const end = parseDateAtTaipei(endDate, true);

    console.log('[Dashboard] 📅 日期範圍解析:', {
      原始字串: { startDate, endDate },
      解析後: {
        start: start.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        end: end.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      },
    });

    return { startDate: start, endDate: end };
  };

  // 獲取儀錶板數據
  const countPublicUploadsInRange = async (startDate: Date, endDate: Date) => {
    const cache = await ensureVideoCache();
    const allVideos = Object.values(cache);
      const uploads = allVideos.filter((v: any) => {
        if (!v.publishedAt) return false;
        const status = (v.privacyStatus || v.status?.privacyStatus || 'public').toLowerCase();
        if (status && status !== 'public') return false;
        const utcDate = new Date(v.publishedAt);
        const publishDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000); // convert to GMT+8
        return publishDate >= startDate && publishDate <= endDate;
      });
    return uploads.length;
  };

  // 使用 gapi.client 統一查詢 YouTube Analytics API（自動處理認證）
  const queryYoutubeAnalytics = async (params: Record<string, string>) => {
    try {
      const response = await gapi.client.request({
        path: 'https://youtubeanalytics.googleapis.com/v2/reports',
        method: 'GET',
        params,
      });
      return response.result;
    } catch (error: any) {
      if (error?.result?.error?.code === 401) {
        youtubeService.logout();
        throw new Error('YouTube 驗證過期，請重新登入後再試');
      }
      throw error;
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = youtubeService.getAccessToken();
      if (!token) {
        throw new Error('未登入 YouTube');
      }

      const { startDate, endDate } = getDateRange();
      const publicUploadsCount = await countPublicUploadsInRange(startDate, endDate);
      setChannelStats(prev => prev ? { ...prev, videosInRange: publicUploadsCount } : {
        totalSubscribers: 0,
        totalViews: 0,
        totalVideos: 0,
        viewsInRange: 0,
        watchTimeHours: 0,
        subscribersGained: 0,
        videosInRange: publicUploadsCount,
      });

      // 策略 1: 頻道總體資料 - 使用 YouTube Data API（總訂閱數調整為期末值）
      await fetchChannelStats(token, endDate);

      // 獲取過去 12 個月的月度數據（用於圖表）
      await fetchMonthlyData(token);

      // 策略 2: 優先使用 YouTube Analytics API 獲取時間範圍內真實數據
      console.log('[Dashboard] 🚀 嘗試使用 YouTube Analytics API...');

      // 2A: 獲取頻道級別數據（觀看次數、觀看時間）
      const channelAnalytics = await fetchChannelAnalytics(startDate, endDate, token);

      // 2B: 獲取影片級別數據（熱門影片）
      const videoAnalytics = await fetchVideoAnalytics(startDate, endDate, token);

      if (channelAnalytics && channelAnalytics.rows && channelAnalytics.rows.length > 0) {
        // 成功獲取 Analytics 數據
        console.log('[Dashboard] ✅ 使用 Analytics API 數據');

        // 處理頻道級別數據
        const channelRow = channelAnalytics.rows[0]; // 頻道級別只有一行數據
        const views = parseInt(channelRow[0]) || 0;
        const watchTimeMinutes = parseInt(channelRow[1]) || 0;
        const subscribersGained = parseInt(channelRow[2]) || 0;
        const subscribersLost = parseInt(channelRow[3]) || 0;
        const avgDuration = parseInt(channelRow[4]) || 0; // 平均觀看時長（秒）
        const avgPercentage = parseFloat(channelRow[5]) || 0; // 平均觀看百分比
        const subscribersNet = subscribersGained - subscribersLost; // 淨增長
        const watchTimeHours = Math.floor(watchTimeMinutes / 60);

        console.log('[Dashboard] 📊 頻道統計 (Analytics API):', {
          views,
          watchTimeHours,
          subscribersGained,
          subscribersLost,
          subscribersNet,
          avgViewDuration: avgDuration,
          avgViewPercentage: avgPercentage,
        });

        // 更新觀看指標
        setAvgViewDuration(avgDuration);
        setAvgViewPercentage(avgPercentage);

        // 更新頻道統計
        setChannelStats((prev) => ({
          totalSubscribers: prev?.totalSubscribers || 0,
          totalViews: prev?.totalViews || 0,
          totalVideos: prev?.totalVideos || 0,
          viewsInRange: views,
          watchTimeHours: watchTimeHours,
          subscribersGained: subscribersNet, // 使用淨增長（新增 - 取消）
          videosInRange: publicUploadsCount,
        }));

        // 處理影片級別數據（熱門影片）
        if (videoAnalytics && videoAnalytics.rows && videoAnalytics.rows.length > 0) {
          await fetchTopVideosFromAnalytics(videoAnalytics.rows, startDate, endDate, token);
        } else {
          console.log('[Dashboard] ⚠️ 無影片數據，使用空列表');
          setTopVideos([]);
        }

        // 獲取流量來源數據
        await fetchTrafficSourcesData(startDate, endDate, token);

        // 獲取對比數據（環比、同比）
        await fetchComparisonData(startDate, endDate, views, watchTimeHours, subscribersNet, token);

        // 獲取人口統計數據
        await fetchDemographicsData(startDate, endDate, token);

        // 獲取裝置類型數據
        await fetchDeviceData(startDate, endDate, token);

        // 獲取訂閱來源數據
        await fetchSubscriberSourcesData(startDate, endDate, token);

        // 獲取 Shorts vs 一般影片對比數據
        await fetchContentTypeMetrics(startDate, endDate, token);

        // 獲取熱門 Shorts 排行榜
        await fetchTopShorts(startDate, endDate, token);

        // 獲取熱門一般影片排行榜
        await fetchTopRegularVideos(startDate, endDate, token);

        // 獲取日趨勢與最佳時段
        await fetchTrendData(startDate, endDate, token);
        if (ENABLE_PUBLISHING_SLOTS) {
          await fetchViewingHoursData(startDate, endDate, token);
        } else {
          setViewingHours([]);
          setViewingHoursSource('none');
        }
      } else {
        // Analytics API 不可用，回退到 Gist 快取方案
        console.log('[Dashboard] ℹ️  回退到 Gist 快取方案');
        setError(
          '⚠️ YouTube Analytics API 不可用。' +
          '顯示的是時間範圍內發布影片的累計數據，而非該時間段內產生的觀看數。' +
          '如需真實時間段數據，請在 Google Cloud Console 啟用 YouTube Analytics API。'
        );
        await fetchVideosInRange(startDate, endDate);
        setTrendData([]);
        if (ENABLE_PUBLISHING_SLOTS) {
          await generateViewingHoursFromCache(startDate, endDate);
        } else {
          setViewingHours([]);
          setViewingHoursSource('none');
        }
      }
    } catch (err: any) {
      console.error('[Dashboard] ❌ 獲取儀錶板數據失敗:', err);
      setError(err.message || '獲取數據失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 從 Analytics 結果獲取熱門影片
  const fetchTopVideosFromAnalytics = async (analyticsRows: any[], startDate: Date, endDate: Date, token: string) => {
    try {
      // Analytics rows: [videoId, views, avgViewPercentage, comments, likes, shares]
      const topVideoIds = analyticsRows.slice(0, 50).map((row: any[]) => row[0]);

      console.log('[Dashboard] 🎯 準備獲取影片描述，影片數量:', topVideoIds.length);
      console.log('[Dashboard] 🎯 影片 IDs:', topVideoIds.slice(0, 5).join(', '), '...');

      // 批量獲取影片描述
      const descriptionsMap = await fetchVideoDescriptions(topVideoIds, token);

      console.log('[Dashboard] 🎯 取得的描述數量:', Object.keys(descriptionsMap).length);
      console.log('[Dashboard] 🎯 描述內容範例:', Object.entries(descriptionsMap).slice(0, 2));

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      console.log('[Dashboard] 🔍 快取中的影片數量:', allVideos.length);
      if (allVideos.length > 0) {
        console.log('[Dashboard] 🔍 快取影片範例:', allVideos[0]);
      }

      const topVideosWithDetails = analyticsRows.slice(0, 50).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const comments = parseInt(row[3]) || 0;
        const likes = parseInt(row[4]) || 0; // ✅ 使用時間範圍內的按讚數
        const shares = parseInt(row[5]) || 0; // ✅ 使用時間範圍內的分享數
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        if (!video) {
          console.warn('[Dashboard] ⚠️ 找不到影片資料:', videoId);
        }

        return {
          id: videoId,
          title: video?.title || `影片 ${videoId}`,
          viewCount: views, // Analytics API 的觀看數（時間範圍內）
          likeCount: likes, // ✅ Analytics API 的按讚數（時間範圍內）
          commentCount: comments, // Analytics API 的留言數（時間範圍內）
          avgViewPercentage: avgViewPercent,
          shareCount: shares, // ✅ Analytics API 的分享數（時間範圍內）
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
          description: descriptionsMap[videoId] || '',
        };
      });

      console.log(`[Dashboard] 🏆 Analytics 熱門影片: ${topVideosWithDetails.length} 支`);
      setTopVideos(topVideosWithDetails);
    } catch (err) {
      console.error('[Dashboard] ⚠️  獲取熱門影片詳情失敗:', err);
    }
  };

  // 取得某日期結束時的累積訂閱數（直接從 Analytics API 取得淨增長總和）
  const fetchTotalSubscribersAtDate = async (endDate: Date): Promise<number | null> => {
    try {
      const earliestSupportedDate = '2006-01-01';
      const formattedEndDate = formatDateString(endDate);

      console.log('[Dashboard] 📈 計算期末累積訂閱數...', {
        startDate: earliestSupportedDate,
        endDate: formattedEndDate,
      });

      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: earliestSupportedDate,
        endDate: formattedEndDate,
        metrics: 'subscribersGained,subscribersLost',
      });

      if (data && data.rows && data.rows.length > 0) {
        const gained = parseInt(data.rows[0][0]) || 0;
        const lost = parseInt(data.rows[0][1]) || 0;
        const lifetimeTotal = gained - lost;

        console.log('[Dashboard] ✅ 取得累積訂閱數成功:', {
          gained,
          lost,
          lifetimeTotal,
        });

        return lifetimeTotal;
      }

      console.log('[Dashboard] ⚠️ 累積訂閱數資料為空');
      return null;
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ 無法取得累積訂閱數:', err?.message || err);
      return null;
    }
  };

  // 策略 1: 獲取頻道等級統計（使用 OAuth + YouTube Data API）
  // 配額成本: 1 單位（channels.list with part=statistics）
  // 注意：總訂閱數會調整為期間結束日的值（而非當前值）
  const fetchChannelStats = async (token: string, endDate: Date) => {
    try {
      console.log('[Dashboard] 📊 獲取頻道總體統計（使用 OAuth + YouTube Data API）...');

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Dashboard] ❌ YouTube API 錯誤:', errorData);
        throw new Error(errorData.error?.message || '無法獲取頻道統計');
      }

      const data = await response.json();
      const stats = data.items?.[0]?.statistics;

      if (!stats) {
        throw new Error('找不到頻道統計資料');
      }

      const currentTotalSubscribers = parseInt(stats.subscriberCount || '0');
      const currentTotalViews = parseInt(stats.viewCount || '0');
      const currentTotalVideos = parseInt(stats.videoCount || '0');

      console.log('[Dashboard] ✅ 頻道當前統計:', {
        currentTotalSubscribers,
        currentTotalViews,
        currentTotalVideos,
      });

      // 優先透過 Analytics API 直接取得該日截止的累積訂閱數
      let endPeriodTotalSubscribers = await fetchTotalSubscribersAtDate(endDate);

      if (typeof endPeriodTotalSubscribers !== 'number') {
        console.log('[Dashboard] ⚠️ 累積訂閱數取得失敗，回退到即時訂閱數調整策略');
        // 獲取從期間結束日到今天的訂閱數變化
        const subscribersAfter = await fetchSubscribersAfterEndDate(endDate, token);
        const subscribersChangeAfterEnd = subscribersAfter.subscribersGained - subscribersAfter.subscribersLost;

        // 計算期間結束日的總訂閱數
        endPeriodTotalSubscribers = currentTotalSubscribers - subscribersChangeAfterEnd;

        console.log('[Dashboard] 📊 總訂閱數調整（回退策略）:', {
          當前總訂閱數: currentTotalSubscribers,
          期後新增訂閱: subscribersAfter.subscribersGained,
          期後取消訂閱: subscribersAfter.subscribersLost,
          期後淨變化: subscribersChangeAfterEnd,
          期末總訂閱數: endPeriodTotalSubscribers,
        });
      } else {
        console.log('[Dashboard] 📊 使用累積訂閱數計算期末總訂閱數:', {
          期末總訂閱數: endPeriodTotalSubscribers,
          當前總訂閱數: currentTotalSubscribers,
        });
      }

      // 設置頻道統計（總訂閱數使用期末值）
      setChannelStats((prev) => ({
        totalSubscribers: endPeriodTotalSubscribers,
        totalViews: currentTotalViews,
        totalVideos: currentTotalVideos,
        viewsInRange: prev?.viewsInRange || 0,
        watchTimeHours: prev?.watchTimeHours || 0,
        subscribersGained: prev?.subscribersGained || 0,
        videosInRange: prev?.videosInRange || 0,
      }));
    } catch (err) {
      console.error('[Dashboard] ❌ 獲取頻道統計失敗:', err);
      throw err;
    }
  };

  // 策略 2A: 獲取頻道級別的統計數據（觀看次數、觀看時間）
  const fetchChannelAnalytics = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 📊 從 Analytics API 獲取頻道級別數據...');

      // 使用本地時區（台灣時間）格式化日期
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const formattedStartDate = formatDate(startDate);
      const formattedEndDate = formatDate(endDate);

      console.log('[Dashboard] 📡 API 請求參數:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage'
      });

      // 頻道級別數據：不使用 dimensions，直接獲取頻道整體統計
      // 同時獲取 subscribersGained、subscribersLost、averageViewDuration、averageViewPercentage
      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage',
      });
      console.log('[Dashboard] ✅ 頻道級別數據獲取成功');
      console.log('[Dashboard] 📊 API 原始返回:', {
        columnHeaders: data.columnHeaders,
        rows: data.rows
      });
      return data;
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ Analytics API 不可用:', err.message);
      return null;
    }
  };

  // 獲取從期間結束日到今天的訂閱數變化（用於計算期末總訂閱數）
  const fetchSubscribersAfterEndDate = async (endDate: Date, token: string) => {
    try {
      const today = new Date();
      // 如果結束日期是今天或未來，則不需要調整
      if (endDate >= today) {
        console.log('[Dashboard] ℹ️  期間結束日是今天或未來，無需調整總訂閱數');
        return { subscribersGained: 0, subscribersLost: 0 };
      }

      console.log('[Dashboard] 📊 獲取期間結束日後的訂閱數變化...');

      // 使用本地時區（台灣時間）格式化日期
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 計算從結束日的下一天到今天
      const dayAfterEnd = new Date(endDate);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);

      const formattedStartDate = formatDate(dayAfterEnd);
      const formattedEndDate = formatDate(today);

      console.log('[Dashboard] 📡 獲取期後訂閱變化，日期範圍:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });

      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        metrics: 'subscribersGained,subscribersLost',
      });

      if (data && data.rows && data.rows.length > 0) {
        const subscribersGained = parseInt(data.rows[0][0]) || 0;
        const subscribersLost = parseInt(data.rows[0][1]) || 0;
        console.log('[Dashboard] ✅ 期後訂閱變化:', { subscribersGained, subscribersLost });
        return { subscribersGained, subscribersLost };
      } else {
        console.log('[Dashboard] ⚠️ 無期後訂閱數據');
        return { subscribersGained: 0, subscribersLost: 0 };
      }
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ 無法獲取期後訂閱變化:', err.message);
      return { subscribersGained: 0, subscribersLost: 0 };
    }
  };

  // 策略 2B: 獲取影片級別的統計數據（熱門影片）
  const fetchVideoAnalytics = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 🎬 從 Analytics API 獲取影片級別數據...');

      // 使用本地時區（台灣時間）格式化日期
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 影片級別數據：使用 video dimension，獲取每個影片的統計
      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        metrics: 'views,averageViewPercentage,comments,likes,shares',
        dimensions: 'video',
        sort: '-views',
        maxResults: '50',
      });
      console.log('[Dashboard] ✅ 熱門影片數據獲取成功');

      return data;
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ 無法獲取影片數據:', err.message);
      return null;
    }
  };

  // 獲取 Shorts vs 一般影片對比數據
  const fetchContentTypeMetrics = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 📱 從 Analytics API 獲取內容類型數據...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&dimensions=creatorContentType` +
        `&metrics=views,estimatedMinutesWatched,likes,shares,comments` +
        `&sort=-views`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Dashboard] ❌ 內容類型 API 錯誤:', errorData);
        throw new Error('無法獲取內容類型數據');
      }

      const data = await response.json();
      console.log('[Dashboard] 📊 內容類型 API 原始返回:', data);

      // 解析回傳數據（注意：API 返回小寫駝峰式，不是大寫蛇形）
      const shorts = data.rows?.find((row: any[]) => row[0] === 'shorts' || row[0] === 'SHORTS') || [];
      const regular = data.rows?.find((row: any[]) => row[0] === 'videoOnDemand' || row[0] === 'VIDEO_ON_DEMAND') || [];

      const metrics: ContentTypeMetrics = {
        shorts: {
          views: parseInt(shorts[1]) || 0,
          watchTime: Math.floor((parseInt(shorts[2]) || 0) / 60), // 分鐘轉小時
          likes: parseInt(shorts[3]) || 0,
          shares: parseInt(shorts[4]) || 0,
          comments: parseInt(shorts[5]) || 0,
          videoCount: 0, // 需要另外計算
        },
        regularVideos: {
          views: parseInt(regular[1]) || 0,
          watchTime: Math.floor((parseInt(regular[2]) || 0) / 60), // 分鐘轉小時
          likes: parseInt(regular[3]) || 0,
          shares: parseInt(regular[4]) || 0,
          comments: parseInt(regular[5]) || 0,
          videoCount: 0, // 需要另外計算
        }
      };

      console.log('[Dashboard] ✅ 內容類型數據獲取成功:', {
        shorts: metrics.shorts,
        regularVideos: metrics.regularVideos,
        hasData: metrics.shorts.views > 0 || metrics.regularVideos.views > 0
      });

      setContentTypeMetrics(metrics);
      return metrics;
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 無法獲取內容類型數據:', err.message);
      // 設置空數據以便 UI 可以顯示
      const emptyMetrics: ContentTypeMetrics = {
        shorts: { views: 0, watchTime: 0, likes: 0, shares: 0, comments: 0, videoCount: 0 },
        regularVideos: { views: 0, watchTime: 0, likes: 0, shares: 0, comments: 0, videoCount: 0 }
      };
      setContentTypeMetrics(emptyMetrics);
      return null;
    }
  };

  // 獲取熱門 Shorts 排行榜
  const fetchTopShorts = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 🎬 從 Analytics API 獲取熱門 Shorts...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: 'video',
        filters: 'creatorContentType==shorts',
        metrics: 'views,averageViewPercentage,comments,likes,shares',
        sort: '-views',
        maxResults: '10',
      });

      if (!data.rows || data.rows.length === 0) {
        console.log('[Dashboard] ℹ️ 時間範圍內沒有 Shorts 數據');
        setTopShorts([]);
        return;
      }

      // 批量獲取影片描述
      const topShortsIds = data.rows.slice(0, 10).map((row: any[]) => row[0]);
      console.log('[Dashboard] 🎯 [Shorts] 準備獲取影片描述，影片數量:', topShortsIds.length);
      const descriptionsMap = await fetchVideoDescriptions(topShortsIds, token);
      console.log('[Dashboard] 🎯 [Shorts] 取得的描述數量:', Object.keys(descriptionsMap).length);

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      // Analytics rows: [videoId, views, avgViewPercentage, comments, likes, shares]
      const topShortsWithDetails = data.rows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const comments = parseInt(row[3]) || 0;
        const likes = parseInt(row[4]) || 0; // ✅ 使用時間範圍內的按讚數
        const shares = parseInt(row[5]) || 0; // ✅ 使用時間範圍內的分享數
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `Shorts ${videoId}`,
          viewCount: views, // Analytics API 的觀看數（時間範圍內）
          likeCount: likes, // ✅ Analytics API 的按讚數（時間範圍內）
          commentCount: comments, // Analytics API 的留言數（時間範圍內）
          avgViewPercentage: avgViewPercent,
          shareCount: shares, // ✅ Analytics API 的分享數（時間範圍內）
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
          description: descriptionsMap[videoId] || '',
        };
      });

      console.log(`[Dashboard] 🏆 熱門 Shorts: ${topShortsWithDetails.length} 支`);
      setTopShorts(topShortsWithDetails);
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ 獲取熱門 Shorts 失敗:', err.message);
      setTopShorts([]);
    }
  };

  // 獲取熱門一般影片排行榜（非 Shorts）
  const fetchTopRegularVideos = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 🎥 從 Analytics API 獲取熱門一般影片...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const data = await queryYoutubeAnalytics({
        ids: 'channel==MINE',
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: 'video',
        filters: 'creatorContentType==videoOnDemand',
        metrics: 'views,averageViewPercentage,comments,likes,shares',
        sort: '-views',
        maxResults: '10',
      });

      if (!data.rows || data.rows.length === 0) {
        console.log('[Dashboard] ℹ️ 時間範圍內沒有一般影片數據');
        setTopRegularVideos([]);
        return;
      }

      // 批量獲取影片描述
      const topRegularVideosIds = data.rows.slice(0, 10).map((row: any[]) => row[0]);
      console.log('[Dashboard] 🎯 [Regular] 準備獲取影片描述，影片數量:', topRegularVideosIds.length);
      const descriptionsMap = await fetchVideoDescriptions(topRegularVideosIds, token);
      console.log('[Dashboard] 🎯 [Regular] 取得的描述數量:', Object.keys(descriptionsMap).length);

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      // Analytics rows: [videoId, views, avgViewPercentage, comments, likes, shares]
      const topRegularVideosWithDetails = data.rows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const comments = parseInt(row[3]) || 0;
        const likes = parseInt(row[4]) || 0; // ✅ 使用時間範圍內的按讚數
        const shares = parseInt(row[5]) || 0; // ✅ 使用時間範圍內的分享數
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `影片 ${videoId}`,
          viewCount: views, // Analytics API 的觀看數（時間範圍內）
          likeCount: likes, // ✅ Analytics API 的按讚數（時間範圍內）
          commentCount: comments, // Analytics API 的留言數（時間範圍內）
          avgViewPercentage: avgViewPercent,
          shareCount: shares, // ✅ Analytics API 的分享數（時間範圍內）
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
          description: descriptionsMap[videoId] || '',
        };
      });

      console.log(`[Dashboard] 🏆 熱門一般影片: ${topRegularVideosWithDetails.length} 支`);
      setTopRegularVideos(topRegularVideosWithDetails);
    } catch (err: any) {
      console.log('[Dashboard] ⚠️ 獲取熱門一般影片失敗:', err.message);
      setTopRegularVideos([]);
    }
  };

  // 獲取流量來源數據
  const fetchTrafficSourcesData = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 🚦 從 Analytics API 獲取流量來源數據...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 1. 獲取流量來源類型
      const trafficSourceResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views` +
        `&dimensions=insightTrafficSourceType` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (trafficSourceResponse.ok) {
        const data = await trafficSourceResponse.json();
        if (data.rows && data.rows.length > 0) {
          const totalViews = data.rows.reduce((sum: number, row: any[]) => sum + (parseInt(row[1]) || 0), 0);
          const sources: TrafficSourceItem[] = data.rows.map((row: any[]) => {
            const views = parseInt(row[1]) || 0;
            return {
              source: row[0],
              views: views,
              percentage: totalViews > 0 ? (views / totalViews) * 100 : 0,
            };
          });
          console.log('[Dashboard] ✅ 流量來源獲取成功:', sources.length, '個來源');
          setTrafficSources(sources);
        }
      }

      // 2. 獲取外部來源
      const externalSourceResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views` +
        `&dimensions=insightTrafficSourceDetail` +
        `&filters=insightTrafficSourceType==EXT_URL` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (externalSourceResponse.ok) {
        const data = await externalSourceResponse.json();
        if (data.rows && data.rows.length > 0) {
          const totalViews = data.rows.reduce((sum: number, row: any[]) => sum + (parseInt(row[1]) || 0), 0);
          const sources: TrafficSourceItem[] = data.rows.map((row: any[]) => {
            const views = parseInt(row[1]) || 0;
            return {
              source: row[0],
              views: views,
              percentage: totalViews > 0 ? (views / totalViews) * 100 : 0,
            };
          });
          console.log('[Dashboard] ✅ 外部來源獲取成功:', sources.length, '個來源');
          setExternalSources(sources);
        }
      }

      // 3. 獲取搜尋字詞
      const searchTermResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views` +
        `&dimensions=insightTrafficSourceDetail` +
        `&filters=insightTrafficSourceType==YT_SEARCH` +
        `&sort=-views` +
        `&maxResults=25`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (searchTermResponse.ok) {
        const data = await searchTermResponse.json();
        if (data.rows && data.rows.length > 0) {
          const terms: SearchTermItem[] = data.rows.map((row: any[]) => ({
            term: row[0],
            views: parseInt(row[1]) || 0,
          }));
          console.log('[Dashboard] ✅ 搜尋字詞獲取成功:', terms.length, '個字詞');
          setSearchTerms(terms);
        }
      }
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取流量來源數據失敗:', err.message);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 獲取對比數據（環比、同比）
  const fetchComparisonData = async (
    currentStart: Date,
    currentEnd: Date,
    currentViews: number,
    currentWatchTime: number,
    currentSubscribers: number,
    token: string
  ) => {
    try {
      console.log('[Dashboard] 📊 獲取對比數據（環比、同比）...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const { previousStart, previousEnd, yearAgoStart, yearAgoEnd, daysDiff } =
        computeComparisonPeriods(currentStart, currentEnd);

      console.log('[Dashboard] 📅 對比期間:', {
        當前期間: `${formatDate(currentStart)} ~ ${formatDate(currentEnd)} (${daysDiff}天)`,
        當前數據: { views: currentViews, watchTime: currentWatchTime, subscribers: currentSubscribers },
        前一期_環比: `${formatDate(previousStart)} ~ ${formatDate(previousEnd)}`,
        去年同期_同比: `${formatDate(yearAgoStart)} ~ ${formatDate(yearAgoEnd)}`,
      });

      // 獲取前一期數據
      const previousData = await fetchChannelAnalytics(previousStart, previousEnd, token);

      // 獲取去年同期數據
      const yearAgoData = await fetchChannelAnalytics(yearAgoStart, yearAgoEnd, token);

      // 處理前一期數據
      let previousViews = 0;
      let previousWatchTime = 0;
      let previousSubscribers = 0;
      if (previousData && previousData.rows && previousData.rows.length > 0) {
        const row = previousData.rows[0];
        previousViews = parseInt(row[0]) || 0;
        previousWatchTime = Math.floor((parseInt(row[1]) || 0) / 60);
        const subGained = parseInt(row[2]) || 0;
        const subLost = parseInt(row[3]) || 0;
        previousSubscribers = subGained - subLost;
      }

      // 處理去年同期數據
      let yearAgoViews = 0;
      let yearAgoWatchTime = 0;
      let yearAgoSubscribers = 0;
      if (yearAgoData && yearAgoData.rows && yearAgoData.rows.length > 0) {
        const row = yearAgoData.rows[0];
        yearAgoViews = parseInt(row[0]) || 0;
        yearAgoWatchTime = Math.floor((parseInt(row[1]) || 0) / 60);
        const subGained = parseInt(row[2]) || 0;
        const subLost = parseInt(row[3]) || 0;
        yearAgoSubscribers = subGained - subLost;
      }

      // 計算觀看次數對比
      const viewsChange = currentViews - previousViews;
      const viewsChangePercent = previousViews > 0 ? (viewsChange / previousViews) * 100 : 0;
      const viewsYearChange = currentViews - yearAgoViews;
      const viewsYearChangePercent = yearAgoViews > 0 ? (viewsYearChange / yearAgoViews) * 100 : 0;

      setViewsComparison({
        current: currentViews,
        previous: previousViews,
        yearAgo: yearAgoViews,
        changeFromPrevious: viewsChange,
        changeFromPreviousPercent: viewsChangePercent,
        changeFromYearAgo: viewsYearChange,
        changeFromYearAgoPercent: viewsYearChangePercent,
      });

      // 計算觀看時間對比
      const watchTimeChange = currentWatchTime - previousWatchTime;
      const watchTimeChangePercent = previousWatchTime > 0 ? (watchTimeChange / previousWatchTime) * 100 : 0;
      const watchTimeYearChange = currentWatchTime - yearAgoWatchTime;
      const watchTimeYearChangePercent = yearAgoWatchTime > 0 ? (watchTimeYearChange / yearAgoWatchTime) * 100 : 0;

      setWatchTimeComparison({
        current: currentWatchTime,
        previous: previousWatchTime,
        yearAgo: yearAgoWatchTime,
        changeFromPrevious: watchTimeChange,
        changeFromPreviousPercent: watchTimeChangePercent,
        changeFromYearAgo: watchTimeYearChange,
        changeFromYearAgoPercent: watchTimeYearChangePercent,
      });

      // 計算訂閱數對比
      const subscribersChange = currentSubscribers - previousSubscribers;
      const subscribersChangePercent = previousSubscribers !== 0 ? (subscribersChange / Math.abs(previousSubscribers)) * 100 : 0;
      const subscribersYearChange = currentSubscribers - yearAgoSubscribers;
      const subscribersYearChangePercent = yearAgoSubscribers !== 0 ? (subscribersYearChange / Math.abs(yearAgoSubscribers)) * 100 : 0;

      setSubscribersComparison({
        current: currentSubscribers,
        previous: previousSubscribers,
        yearAgo: yearAgoSubscribers,
        changeFromPrevious: subscribersChange,
        changeFromPreviousPercent: subscribersChangePercent,
        changeFromYearAgo: subscribersYearChange,
        changeFromYearAgoPercent: subscribersYearChangePercent,
      });

      console.log('[Dashboard] ✅ 對比數據獲取成功:', {
        觀看次數: { 當前: currentViews, 前期: previousViews, 去年: yearAgoViews },
        觀看時間: { 當前: currentWatchTime, 前期: previousWatchTime, 去年: yearAgoWatchTime },
        訂閱數: { 當前: currentSubscribers, 前期: previousSubscribers, 去年: yearAgoSubscribers },
      });
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取對比數據失敗:', err.message);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 獲取人口統計數據（年齡、性別、地理位置）
  const fetchDemographicsData = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 👥 從 Analytics API 獲取人口統計數據...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 1. 獲取年齡和性別分佈
      // 根據 YouTube Analytics API 文檔，demographics 必須使用 viewerPercentage metric
      const ageGenderResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=viewerPercentage` +
        `&dimensions=ageGroup,gender` +
        `&sort=gender,ageGroup`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (ageGenderResponse.ok) {
        const data = await ageGenderResponse.json();
        if (data.rows && data.rows.length > 0) {
          const demographicsData: DemographicsItem[] = data.rows.map((row: any[]) => ({
            ageGroup: row[0],
            gender: row[1],
            viewsPercentage: parseFloat(row[2]) || 0,
          }));
          console.log('[Dashboard] ✅ 年齡性別數據獲取成功:', demographicsData.length, '個組別');
          setDemographics(demographicsData);
        }
      } else {
        const errorData = await ageGenderResponse.json();
        console.error('[Dashboard] ❌ 年齡性別數據 API 錯誤:', errorData);
        console.warn('[Dashboard] ℹ️  年齡性別數據可能需要以下條件：');
        console.warn('  1. 頻道已加入 YouTube 合作夥伴計畫（YPP）');
        console.warn('  2. 有足夠的觀看數據量');
        console.warn('  3. 符合隱私要求（觀眾數量達到最低門檻）');
        console.warn('  4. YouTube Analytics API 已啟用相關權限');
      }

      // 2. 獲取地理位置分佈
      const geographyResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views` +
        `&dimensions=country` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (geographyResponse.ok) {
        const data = await geographyResponse.json();
        if (data.rows && data.rows.length > 0) {
          const totalViews = data.rows.reduce((sum: number, row: any[]) => sum + (parseInt(row[1]) || 0), 0);
          const geographyData: GeographyItem[] = data.rows.map((row: any[]) => {
            const views = parseInt(row[1]) || 0;
            return {
              country: row[0],
              views: views,
              percentage: totalViews > 0 ? (views / totalViews) * 100 : 0,
            };
          });
          console.log('[Dashboard] ✅ 地理位置數據獲取成功:', geographyData.length, '個國家/地區');
          setGeography(geographyData);
        }
      }
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取人口統計數據失敗:', err.message);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 獲取裝置類型數據
  const fetchDeviceData = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 📱 從 Analytics API 獲取裝置類型數據...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views` +
        `&dimensions=deviceType` +
        `&sort=-views`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.rows && data.rows.length > 0) {
          const totalViews = data.rows.reduce((sum: number, row: any[]) => sum + (parseInt(row[1]) || 0), 0);

          const deviceData: DeviceItem[] = data.rows.map((row: any[]) => {
            const views = parseInt(row[1]) || 0;
            return {
              deviceType: row[0],
              views: views,
              percentage: totalViews > 0 ? (views / totalViews) * 100 : 0,
            };
          });
          console.log('[Dashboard] ✅ 裝置類型數據獲取成功:', deviceData.length, '種裝置');
          setDevices(deviceData);
        }
      } else {
        const errorData = await response.json();
        console.error('[Dashboard] ❌ 裝置類型數據 API 錯誤:', errorData);
      }
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取裝置類型數據失敗:', err.message);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 獲取訂閱來源數據（帶來最多訂閱的影片）
  const fetchSubscriberSourcesData = async (startDate: Date, endDate: Date, token: string) => {
    try {
      console.log('[Dashboard] 📊 從 Analytics API 獲取訂閱來源數據...');

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=subscribersGained` +
        `&dimensions=video` +
        `&sort=-subscribersGained` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.rows && data.rows.length > 0) {
          // 需要獲取影片標題
          const videoIds = data.rows.map((row: any[]) => row[0]);
          const videoTitles = await fetchVideoTitles(videoIds);

          const subscriberSourceData: SubscriberSourceItem[] = data.rows.map((row: any[]) => ({
            videoId: row[0],
            videoTitle: videoTitles[row[0]] || '未知影片',
            subscribersGained: parseInt(row[1]) || 0,
          }));

          console.log('[Dashboard] ✅ 訂閱來源數據獲取成功:', subscriberSourceData.length, '個影片');
          setSubscriberSources(subscriberSourceData);
        }
      } else {
        const errorData = await response.json();
        console.error('[Dashboard] ❌ 訂閱來源數據 API 錯誤:', errorData);
      }
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取訂閱來源數據失敗:', err.message);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 輔助函數：從 Gist 快取獲取影片標題（零配額！）
  const fetchVideoTitles = async (videoIds: string[]): Promise<Record<string, string>> => {
    try {
      console.log('[Dashboard] 📦 從 Gist 快取獲取影片標題（零配額）...', videoIds.length, '個影片');

      // 從快取獲取影片（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();

      // 建立 videoId -> title 映射
      const titles: Record<string, string> = {};
      videoIds.forEach((videoId) => {
        const video = cache[videoId];
        if (video) {
          titles[videoId] = video.title || videoId;
        }
      });

      console.log('[Dashboard] ✅ 從快取獲取到', Object.keys(titles).length, '個影片標題');
      return titles;
    } catch (err) {
      console.error('[Dashboard] ⚠️ 從快取獲取影片標題失敗:', err);
      return {};
    }
  };

  // 獲取過去 12 個月的月度數據（使用和日期卡片相同的邏輯）
  const fetchMonthlyData = async (token: string) => {
    try {
      console.log('[Dashboard] 📅 從 Analytics API 獲取過去 12 個月數據...');

      const today = new Date();
      const monthlyDataPoints: MonthlyDataPoint[] = [];

      // 使用本地時區格式化日期
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 循環獲取過去 12 個完整月份的數據（不包括當前月）
      for (let i = 12; i >= 1; i--) {
        // 計算該月的起始和結束日期
        const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

        const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

        try {
          // 使用和 fetchChannelAnalytics 相同的邏輯，不使用 dimensions
          // 同時獲取 subscribersGained 和 subscribersLost
          const url = `https://youtubeanalytics.googleapis.com/v2/reports?` +
            `ids=channel==MINE` +
            `&startDate=${formatDate(monthStart)}` +
            `&endDate=${formatDate(monthEnd)}` +
            `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost`;

          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.rows && data.rows.length > 0) {
              const row = data.rows[0]; // 單月聚合數據只有一行
              const subscribersGained = parseInt(row[2]) || 0;
              const subscribersLost = parseInt(row[3]) || 0;
              const subscribersNet = subscribersGained - subscribersLost;

              monthlyDataPoints.push({
                month: monthKey,
                views: parseInt(row[0]) || 0,
                watchTimeHours: Math.floor((parseInt(row[1]) || 0) / 60),
                subscribersGained: subscribersGained,
                subscribersLost: subscribersLost,
                subscribersNet: subscribersNet, // 淨增長
              });
            }
          }
        } catch (err) {
          console.warn(`[Dashboard] ⚠️ 跳過月份 ${monthKey}:`, err);
        }
      }

      // 追加本月至今資料
      try {
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthKey = `${currentMonthStart.getFullYear()}-${String(currentMonthStart.getMonth() + 1).padStart(2, '0')}`;
        const url = `https://youtubeanalytics.googleapis.com/v2/reports?` +
          `ids=channel==MINE` +
          `&startDate=${formatDate(currentMonthStart)}` +
          `&endDate=${formatDate(today)}` +
          `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            const subscribersGained = parseInt(row[2]) || 0;
            const subscribersLost = parseInt(row[3]) || 0;
            const subscribersNet = subscribersGained - subscribersLost;

            monthlyDataPoints.push({
              month: monthKey,
              views: parseInt(row[0]) || 0,
              watchTimeHours: Math.floor((parseInt(row[1]) || 0) / 60),
              subscribersGained,
              subscribersLost,
              subscribersNet,
              isCurrentMonth: true,
            });
          }
        }
      } catch (err) {
        console.warn('[Dashboard] ⚠️ 無法獲取本月至今數據:', err);
      }

      console.log('[Dashboard] ✅ 月度數據獲取成功:', monthlyDataPoints.length, '個月');
      console.log('[Dashboard] 📊 月度數據詳情:', monthlyDataPoints);
      setMonthlyData(monthlyDataPoints);
    } catch (err: any) {
      console.error('[Dashboard] ❌ 獲取月度數據失敗:', err);
      // 不拋出錯誤，允許儀錶板繼續顯示其他數據
    }
  };

  // 策略 2 備援: 從 Gist 快取過濾影片（如果沒有 Analytics API）
  const fetchVideosInRange = async (startDate: Date, endDate: Date) => {
    try {
      console.log('[Dashboard] 🎬 從 Gist 快取獲取影片資料（備援方案）...');
      console.log(`[Dashboard] 📅 時間範圍: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);

      // 從快取獲取所有影片（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      console.log(`[Dashboard] ✅ 從快取載入 ${allVideos.length} 支影片`);

      // 過濾時間範圍內發布的影片
      const videosInRange = allVideos.filter((v: any) => {
        if (!v.publishedAt) return false;
        const privacyStatus = (v.privacyStatus || v.status?.privacyStatus || '').toLowerCase();
        if (privacyStatus && privacyStatus !== 'public') {
          return false;
        }
        const utcDate = new Date(v.publishedAt);
        const publishDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
        return publishDate >= startDate && publishDate <= endDate;
      });

      console.log(`[Dashboard] 📊 時間範圍內發布的影片: ${videosInRange.length} 支`);

      // 計算時間範圍內的統計數據
      let totalViews = 0;
      let totalWatchTimeSeconds = 0;

      videosInRange.forEach((v: any) => {
        totalViews += parseInt(v.viewCount || '0');

        // 計算觀看時長：平均觀看時長 = 總觀看數 * 影片時長的估算
        // 注意：這是估算值，真實數據需要 Analytics API
        // 假設平均觀看百分比 40%，影片平均長度 10 分鐘
        const avgVideoDurationMinutes = 10;
        const avgWatchPercentage = 0.4;
        const watchTimePerView = avgVideoDurationMinutes * 60 * avgWatchPercentage;
        totalWatchTimeSeconds += parseInt(v.viewCount || '0') * watchTimePerView;
      });

      const watchTimeHours = Math.floor(totalWatchTimeSeconds / 3600);

      console.log('[Dashboard] 📈 時間範圍內統計:', {
        videosInRange: videosInRange.length,
        totalViews,
        watchTimeHours,
      });

      // 更新統計數據
      setChannelStats((prev) => ({
        totalSubscribers: prev?.totalSubscribers || 0,
        totalViews: prev?.totalViews || 0,
        totalVideos: prev?.totalVideos || 0,
        viewsInRange: totalViews,
        watchTimeHours: watchTimeHours,
        subscribersGained: 0, // 需要 Analytics API
        videosInRange: videosInRange.length,
      }));

      // 按觀看次數排序並取前 50 名（從時間範圍內的影片）
      const topVideosInRange = videosInRange
        .filter((v: any) => v.viewCount && parseInt(v.viewCount) > 0)
        .sort((a: any, b: any) => parseInt(b.viewCount) - parseInt(a.viewCount))
        .slice(0, 50)
        .map((v: any) => ({
          id: v.videoId || v.id,
          title: v.title,
          viewCount: parseInt(v.viewCount || '0'),
          likeCount: parseInt(v.likeCount || '0'),
          commentCount: parseInt(v.commentCount || '0'),
          avgViewPercentage: parseFloat(v.avgViewPercentage || v.averageViewPercentage || '0') || 0,
          shareCount: parseInt(v.shareCount || '0') || 0,
          publishedAt: v.publishedAt,
          thumbnailUrl: v.thumbnail || v.thumbnailUrl,
        }));

      console.log(`[Dashboard] 🏆 時間範圍內熱門影片: ${topVideosInRange.length} 支`);
      setTopVideos(topVideosInRange);
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取影片資料失敗:', err);
      if (err.message.includes('Gist')) {
        setError(err.message);
      }
    }
  };

  const ensureVideoCache = async () => {
    if (videoCacheRef.current) return videoCacheRef.current;
    try {
      console.log('[Dashboard] 💾 載入影片快取供趨勢使用...');
      const response = await fetch(
        `${API_BASE_URL}/video-cache/search?query=&maxResults=10000`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error('無法獲取影片快取');
      }
      const data = await response.json();
      const map: Record<string, any> = {};
      (data.videos || []).forEach((video: any) => {
        const id = video.videoId || video.id;
        if (id) {
          map[id] = video;
        }
      });
      videoCacheRef.current = map;
      console.log('[Dashboard] ✅ 影片快取載入完成:', Object.keys(map).length, '支影片');
    } catch (err: any) {
      console.warn('[Dashboard] ⚠️ 無法載入影片快取:', err.message);
      videoCacheRef.current = {};
    }
    return videoCacheRef.current;
  };

  // 批量獲取影片的詳細資訊（包括 description）
  const fetchVideoDescriptions = async (videoIds: string[], token: string): Promise<Record<string, string>> => {
    try {
      console.log(`[Dashboard] 📝 fetchVideoDescriptions 被調用，videoIds 數量: ${videoIds.length}, token: ${token ? '有' : '無'}`);

      if (videoIds.length === 0) {
        console.log(`[Dashboard] ⚠️ videoIds 為空，直接返回空物件`);
        return {};
      }

      console.log(`[Dashboard] 📝 開始獲取 ${videoIds.length} 支影片的描述...`);

      // YouTube API 一次最多支援 50 個影片 ID
      const chunks: string[][] = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
      }

      const descriptionsMap: Record<string, string> = {};

      for (const chunk of chunks) {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${chunk.join(',')}`;
        console.log(`[Dashboard] 🌐 API 請求:`, apiUrl.substring(0, 100) + '...');

        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log(`[Dashboard] 📡 API 回應狀態:`, response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[Dashboard] ⚠️ 獲取影片描述失敗:', response.status, errorText);
          continue;
        }

        const data = await response.json();
        console.log(`[Dashboard] 📦 API 回傳資料:`, {
          itemsCount: data.items?.length || 0,
          hasItems: !!data.items
        });

        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const description = item.snippet?.description || '';
            descriptionsMap[item.id] = description;
            console.log(`[Dashboard] 📄 影片 ${item.id.substring(0, 8)}... 說明長度: ${description.length} 字元`);
          });
        }
      }

      console.log(`[Dashboard] ✅ 獲取了 ${Object.keys(descriptionsMap).length} 支影片的描述`);
      console.log(`[Dashboard] 📋 描述統計:`, Object.entries(descriptionsMap).map(([id, desc]) =>
        `${id.substring(0, 8)}: ${desc.length}字`
      ).join(', '));
      return descriptionsMap;
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 獲取影片描述失敗:', err.message);
      return {};
    }
  };

  // 獲取趨勢數據
  const fetchTrendData = async (start: Date, end: Date, token: string) => {
    try {
      console.log('[Dashboard] 📈 從 Analytics API 獲取日趨勢數據...');
      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDateString(start)}` +
        `&endDate=${formatDateString(end)}` +
        `&dimensions=day` +
        `&metrics=views,subscribersGained,subscribersLost` +
        `&sort=day`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('[Dashboard] ⚠️ 無法獲取日趨勢數據:', errorData);
        setTrendData([]);
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data.rows)) {
        console.log('[Dashboard] ℹ️ 日趨勢沒有資料');
        setTrendData([]);
        return;
      }

      const trendMap = new Map<string, TrendDataPoint>();
      data.rows.forEach((row: any[]) => {
        const date = row[0];
        trendMap.set(date, {
          date,
          views: parseInt(row[1]) || 0,
          subscribers: (parseInt(row[2]) || 0) - (parseInt(row[3]) || 0),
          topVideo: null,
        });
      });

      // 取得每天觀看最高影片（以逐日 API 查詢）
      try {
        const cache = await ensureVideoCache();
        for (const date of trendMap.keys()) {
          try {
            let topVideoResponse: Response | null = null;
            let retryCount = 0;
            const MAX_RETRIES = 3;

            while (retryCount < MAX_RETRIES) {
              try {
                // 增加短暫延遲，避免瞬間發送大量請求。如果是重試，則延長等待時間
                const delayMs = retryCount === 0 ? 200 : 1000 * Math.pow(2, retryCount - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));

                topVideoResponse = await fetch(
                  `https://youtubeanalytics.googleapis.com/v2/reports?` +
                  `ids=channel==MINE` +
                  `&startDate=${date}` +
                  `&endDate=${date}` +
                  `&dimensions=video` +
                  `&metrics=views` +
                  `&sort=-views` +
                  `&maxResults=1`,
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                // 成功 (2xx)，跳出重試迴圈
                if (topVideoResponse.ok) {
                  break;
                }
                
                // 若為 400 (參數錯誤), 401 (未授權), 403 (配額不足)，重試通常也沒用，直接中斷
                if ([400, 401, 403].includes(topVideoResponse.status)) {
                  break;
                }
                
                console.warn(`[Dashboard] ⚠️ 單日熱門影片 API 失敗 (${date}, 狀態: ${topVideoResponse.status})，準備重試 (${retryCount + 1}/${MAX_RETRIES})...`);
              } catch (fetchErr) {
                console.warn(`[Dashboard] ⚠️ 單日熱門影片 API 網路錯誤 (${date})，準備重試 (${retryCount + 1}/${MAX_RETRIES})...`);
              }
              retryCount++;
            }

            if (!topVideoResponse || !topVideoResponse.ok) {
              console.warn('[Dashboard] ❌ 單日熱門影片 API 最終失敗 (已放棄):', date);
              continue;
            }

            const videoData = await topVideoResponse.json();
            const row = videoData.rows?.[0];
            if (!row) continue;

            const videoId = row[0];
            const views = parseInt(row[1]) || 0;
            const target = trendMap.get(date);
            if (!target) continue;

            const metadata = cache?.[videoId];
            target.topVideo = {
              id: videoId,
              views,
              title: metadata?.title || `影片 ${videoId}`,
              thumbnailUrl: metadata?.thumbnail || metadata?.thumbnailUrl || '',
            };
          } catch (perDayErr: any) {
            console.warn('[Dashboard] ⚠️ 無法取得', date, '的熱門影片:', perDayErr.message);
          }
        }
      } catch (nestedErr: any) {
        console.warn('[Dashboard] ⚠️ 每日熱門影片處理失敗:', nestedErr.message);
      }

      const parsed: TrendDataPoint[] = Array.from(trendMap.values());
      console.log('[Dashboard] ✅ 日趨勢資料筆數:', parsed.length);
      setTrendData(parsed);
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 取得日趨勢失敗:', err.message);
      setTrendData([]);
    }
  };

  const generateViewingHoursFromCache = async (start: Date, end: Date) => {
    try {
      console.log('[Dashboard] 🗂️ 從影片快取估算最佳時段...');

      // 從快取獲取影片（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const videos = Object.values(cache);
      const startTime = start.getTime();
      const endTime = end.getTime();
      const aggregates = new Map<string, number>();

      videos.forEach((video: any) => {
        if (!video.publishedAt) return;
        const published = new Date(video.publishedAt);
        const publishedTime = published.getTime();
        if (Number.isNaN(publishedTime)) return;
        if (publishedTime < startTime || publishedTime > endTime) return;

        const dayOfWeek = published.getDay();
        const hour = published.getHours();
        const views = parseInt(video.viewCount || '0') || 0;
        if (views <= 0) return;

        const key = `${dayOfWeek}-${hour}`;
        aggregates.set(key, (aggregates.get(key) || 0) + views);
      });

      const generated: ViewingHourData[] = Array.from(aggregates.entries()).map(([key, views]) => {
        const [dayStr, hourStr] = key.split('-');
        return {
          dayOfWeek: parseInt(dayStr),
          hour: parseInt(hourStr),
          views,
        };
      });

      console.log('[Dashboard] 🔁 使用影片快取估算完成:', generated.length, '筆');
      setViewingHours(generated);
      setViewingHoursSource(generated.length > 0 ? 'cache' : 'none');
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 無法從快取估算觀看時段:', err.message);
      setViewingHours([]);
      setViewingHoursSource('none');
    }
  };

  const fetchViewingHoursData = async (start: Date, end: Date, token: string) => {
    try {
      console.log('[Dashboard] ⏰ 從 Analytics API 獲取觀看時段熱力數據...');
      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDateString(start)}` +
        `&endDate=${formatDateString(end)}` +
        `&dimensions=day` +
        `&metrics=views` +
        `&sort=day`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('[Dashboard] ⚠️ 無法取得觀看時段資料:', errorData);
        await generateViewingHoursFromCache(start, end);
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data.rows)) {
        console.log('[Dashboard] ℹ️ 沒有觀看時段資料');
        await generateViewingHoursFromCache(start, end);
        return;
      }

      // 以日資料為基礎，推估觀眾最常在線的星期
      const parsed: ViewingHourData[] = data.rows
        .map((row: any[]) => {
          const dateString = row[0];
          const views = parseInt(row[1]) || 0;
          const date = new Date(dateString);
          const dayOfWeek = Number.isNaN(date.getDay()) ? 0 : date.getDay();
          return {
            dayOfWeek,
            hour: 12, // 使用中午作為代表時段
            views,
          };
        })
        .filter((item) => !Number.isNaN(item.dayOfWeek));

      console.log('[Dashboard] ✅ 觀看時段資料筆數 (日粒度):', parsed.length);
      setViewingHours(parsed);
      setViewingHoursSource(parsed.length > 0 ? 'analytics' : 'none');
    } catch (err: any) {
      console.error('[Dashboard] ⚠️ 取得觀看時段失敗:', err.message);
      await generateViewingHoursFromCache(start, end);
    }
  };

  // 格式化數字
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // 格式化完整數字
  const formatFullNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  // 取得國家中文名稱
  const getCountryName = (countryCode: string): string => {
    const countryNames: { [key: string]: string } = {
      'TW': '台灣',
      'US': '美國',
      'JP': '日本',
      'KR': '韓國',
      'CN': '中國',
      'HK': '香港',
      'MO': '澳門',
      'SG': '新加坡',
      'MY': '馬來西亞',
      'TH': '泰國',
      'VN': '越南',
      'PH': '菲律賓',
      'ID': '印尼',
      'IN': '印度',
      'GB': '英國',
      'DE': '德國',
      'FR': '法國',
      'CA': '加拿大',
      'AU': '澳洲',
      'NZ': '紐西蘭',
      'BR': '巴西',
      'MX': '墨西哥',
      'ES': '西班牙',
      'IT': '義大利',
      'NL': '荷蘭',
      'SE': '瑞典',
      'NO': '挪威',
      'DK': '丹麥',
      'FI': '芬蘭',
      'PL': '波蘭',
      'RU': '俄羅斯',
      'TR': '土耳其',
      'SA': '沙烏地阿拉伯',
      'AE': '阿聯酋',
      'IL': '以色列',
      'EG': '埃及',
      'ZA': '南非',
      'AR': '阿根廷',
      'CL': '智利',
      'CO': '哥倫比亞',
    };

    const chineseName = countryNames[countryCode.toUpperCase()];
    if (chineseName) {
      return `${chineseName}（${countryCode.toUpperCase()}）`;
    }
    return countryCode.toUpperCase();
  };

  // 翻譯流量來源代碼
  const translateTrafficSource = (source: string): string => {
    const translations: { [key: string]: string } = {
      'YT_SEARCH': 'YouTube 搜尋',
      'SUBSCRIBER': '訂閱者',
      'BROWSE': '瀏覽功能',
      'SUGGESTED': '建議影片',
      'YT_CHANNEL': 'YouTube 頻道頁',
      'YT_OTHER_PAGE': 'YouTube 其他頁面',
      'EXTERNAL_APP': '外部應用程式',
      'EXT_URL': '外部連結',
      'NO_LINK_OTHER': '其他',
      'NOTIFICATION': '通知',
      'PLAYLIST': '播放清單',
      'RELATED_VIDEO': '相關影片',
      'YT_PLAYLIST_PAGE': 'YouTube 播放清單頁',
      'CAMPAIGN_CARD': '宣傳卡',
      'END_SCREEN': '結束畫面',
      'SHORTS': 'Shorts',
      'HASHTAGS': '主題標籤',
    };

    const translated = translations[source] || source;
    // 如果有翻譯且與原文不同，返回「中文（原文）」格式，使用全形括號
    if (translated !== source) {
      return `${translated}（${source}）`;
    }
    return source;
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const topVideoMetricConfig = {
    views: {
      label: '觀看次數',
      unit: '次',
      icon: Eye,
      value: (video: VideoItem) => video.viewCount || 0,
      formatter: (val: number) => formatFullNumber(val),
    },
    avgViewPercent: {
      label: '平均觀看百分比',
      unit: '%',
      icon: TrendingUp,
      value: (video: VideoItem) => video.avgViewPercentage || 0,
      formatter: (val: number) => `${val.toFixed(1)}%`,
    },
    shares: {
      label: '分享次數',
      unit: '次',
      icon: Share2,
      value: (video: VideoItem) => video.shareCount || 0,
      formatter: (val: number) => formatFullNumber(val),
    },
    comments: {
      label: '留言次數',
      unit: '則',
      icon: MessageSquare,
      value: (video: VideoItem) => video.commentCount || 0,
      formatter: (val: number) => formatFullNumber(val),
    },
  } as const;

  const sortedTopVideos = useMemo(() => {
    const config = topVideoMetricConfig[topVideoMetric];
    return [...topVideos].sort((a, b) => config.value(b) - config.value(a));
  }, [topVideos, topVideoMetric]);

  const comparisonDateRanges = useMemo(() => {
    if (!startDate || !endDate) return null;
    const currentStart = parseDateAtTaipei(startDate, false);
    const currentEnd = parseDateAtTaipei(endDate, false);
    if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) {
      return null;
    }

    const periods = computeComparisonPeriods(currentStart, currentEnd);

    return {
      previous: `${formatDateString(periods.previousStart)} ~ ${formatDateString(periods.previousEnd)}`,
      yearAgo: `${formatDateString(periods.yearAgoStart)} ~ ${formatDateString(periods.yearAgoEnd)}`,
    };
  }, [startDate, endDate]);

  const monthlyMeta = useMemo(() => {
    const hasCurrent = monthlyData.some((item) => item.isCurrentMonth);
    return {
      hasCurrent,
      fullMonthsCount: hasCurrent ? monthlyData.length - 1 : monthlyData.length,
    };
  }, [monthlyData]);

  const todayLabel = useMemo(() => formatDateString(new Date()), []);
  const viewingHoursSubtitle = useMemo(() => {
    switch (viewingHoursSource) {
      case 'analytics':
        return '依據 YouTube Analytics（日粒度）';
      case 'cache':
        return '依據歷來影片表現（估算）';
      default:
        return '依據觀眾實際上線時間';
    }
  }, [viewingHoursSource]);

  const trendChartGeometry = useMemo(() => {
    if (trendData.length === 0) {
      return { points: '', coordinates: [] as TrendChartCoordinate[] };
    }
    const chartWidth = 600;
    const chartHeight = 160;
    const maxViews = Math.max(...trendData.map((item) => item.views));
    const minViews = Math.min(...trendData.map((item) => item.views));
    const range = Math.max(maxViews - minViews, 1);

    const coordinates = trendData.map((point, index) => {
      const x =
        trendData.length === 1 ? chartWidth / 2 : (index / (trendData.length - 1)) * chartWidth;
      const y = chartHeight - ((point.views - minViews) / range) * chartHeight;
      return {
        date: point.date,
        views: point.views,
        x,
        y: Number.isFinite(y) ? y : chartHeight,
        xPercent: (x / chartWidth) * 100,
        yPercent: ((Number.isFinite(y) ? y : chartHeight) / chartHeight) * 100,
        topVideo: point.topVideo,
      } as TrendChartCoordinate;
    });

    return {
      points: coordinates.map((coord) => `${coord.x},${coord.y}`).join(' '),
      coordinates,
    };
  }, [trendData]);
  const trendChartPoints = trendChartGeometry.points;
  const trendChartCoordinates = trendChartGeometry.coordinates;

  const trendSummary = useMemo(() => {
    if (trendData.length === 0) return null;
    const totalViews = trendData.reduce((sum, item) => sum + item.views, 0);
    const averageViews = Math.round(totalViews / trendData.length);
    const sortedByViews = [...trendData].sort((a, b) => b.views - a.views);
    const bestDay = sortedByViews[0];
    const firstDay = trendData[0];
    const latestDay = trendData[trendData.length - 1];
    const momentum = latestDay.views - firstDay.views;

    return {
      totalViews,
      averageViews,
      bestDay,
      momentum,
    };
  }, [trendData]);

  const trendLeaders = useMemo(() => {
    if (trendData.length === 0) return [];
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        thumbnailUrl: string;
        dates: string[];
        totalViews: number;
      }
    >();

    trendData.forEach((point) => {
      if (!point.topVideo) return;
      const key = point.topVideo.id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: point.topVideo.title,
          thumbnailUrl: point.topVideo.thumbnailUrl,
          dates: [],
          totalViews: 0,
        });
      }
      const target = map.get(key)!;
      target.dates.push(point.date);
      target.totalViews += point.topVideo.views;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        count: item.dates.length,
        lastDate: item.dates[item.dates.length - 1],
      }))
      .sort((a, b) => b.count - a.count || b.totalViews - a.totalViews)
      .slice(0, 5);
  }, [trendData]);

  const bestPublishingSlots = useMemo(() => {
    if (viewingHours.length === 0) return [];
    return [...viewingHours]
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map((slot, index) => ({
        ...slot,
        rank: index + 1,
        label:
          viewingHoursSource === 'analytics'
            ? `${DAY_OF_WEEK_LABELS[slot.dayOfWeek] || '週?'} 全天`
            : `${DAY_OF_WEEK_LABELS[slot.dayOfWeek] || '週?'} ${String(slot.hour).padStart(2, '0')}:00`,
      }));
  }, [viewingHours, viewingHoursSource]);

  const viewingHourHeatmap = useMemo(() => {
    if (viewingHours.length === 0) return null;
    if (viewingHoursSource !== 'cache') return null;

    const rows = VIEWING_HOUR_BUCKETS.map((bucket) => {
      const values = DAY_OF_WEEK_LABELS.map((_, dayIndex) => {
        const total = viewingHours
          .filter(
            (item) =>
              item.dayOfWeek === dayIndex && item.hour >= bucket.start && item.hour <= bucket.end
          )
          .reduce((sum, item) => sum + item.views, 0);
        return { dayIndex, views: total };
      });
      return { bucketLabel: bucket.label, values };
    });

    let maxValue = 0;
    rows.forEach((row) => {
      row.values.forEach((value) => {
        if (value.views > maxValue) {
          maxValue = value.views;
        }
      });
    });

    return {
      rows: rows.map((row) => ({
        bucketLabel: row.bucketLabel,
        values: row.values.map((value) => ({
          ...value,
          intensity: maxValue > 0 ? value.views / maxValue : 0,
        })),
      })),
      maxValue,
    };
  }, [viewingHours]);

  // 不自動監聽日期變化，只有點擊「刷新數據」按鈕才會調用 API
  // useEffect(() => {
  //   if (channelStats) {
  //     fetchDashboardData();
  //   }
  // }, [startDate, endDate]);

  return (
    <div className="space-y-6 font-['Roboto',sans-serif] bg-[#FAFAFA] min-h-screen">
      {/* 標題區域 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF1D1D] via-[#E30000] to-[#B20000] text-white shadow-[0_20px_60px_rgba(255,0,0,0.25)] p-8">
        <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-12 bottom-0 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/30 text-white flex items-center justify-center shadow-lg shadow-black/20">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70 mb-1">
                  YouTube Analytics
                </p>
                <h2 className="text-[32px] font-extrabold leading-tight">頻道數據儀表板</h2>
              </div>
            </div>
            <p className="text-white/80 text-[15px] leading-relaxed max-w-2xl">
              深入了解頻道表現、觀眾互動與成長趨勢，掌握每一次流量波動。
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full lg:w-auto bg-white/10 border border-white/20 rounded-3xl p-5 shadow-lg shadow-black/15 backdrop-blur-[2px]">
            {/* 快速篩選器 */}
            <div className="flex flex-wrap gap-1.5 justify-start">
              {QUICK_DATE_PRESETS.map((item) => {
                const range = getQuickDateRange(item.value);
                const isActive = startDate === range.start && endDate === range.end;
                const disabled = isQuickPresetDisabled(item.value);
                const showActive = isActive && !disabled;

                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setStartDate(range.start);
                      setEndDate(range.end);
                    }}
                    className={`px-4 py-2 text-[13px] font-semibold rounded-full border transition-all duration-200 ${
                      disabled
                        ? 'bg-white/10 text-white/40 border-white/10 cursor-not-allowed'
                        : showActive
                          ? 'bg-white text-[#C30000] border-transparent shadow-[0_2px_10px_rgba(255,255,255,0.35)]'
                          : 'bg-transparent text-white border-white/40 hover:bg-white/10 hover:border-white/60'
                    }`}
                    aria-disabled={disabled}
                    title={
                      disabled
                        ? '尚未完整結算該月份的數據，暫時無法使用'
                        : undefined
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 flex-1">
                {/* 日期範圍選擇器 */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white text-[#0F0F0F] shadow-[0_6px_30px_rgba(0,0,0,0.08)]">
                  <Calendar className="w-5 h-5 text-[#E30000]" />
                  <input
                    type="date"
                    value={startDate}
                    max={maxSelectableDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-[13px] font-semibold"
                  />
                  <span className="text-[#7A7A7A] font-medium">至</span>
                  <input
                    type="date"
                    value={endDate}
                    max={maxSelectableDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-[13px] font-semibold"
                  />
                </div>
                <p className="text-[11px] text-white/80 text-left sm:text-right leading-tight">
                  API 最晚僅提供到 {maxSelectableDate}（比 YouTube Studio 晚 1 天）
                </p>
              </div>

              {/* 刷新按鈕 */}
              <button
                onClick={fetchDashboardData}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white/95 text-[#B20000] px-8 py-3 text-[13px] font-bold shadow-[0_10px_35px_rgba(0,0,0,0.15)] transition-all duration-200 hover:bg-white hover:shadow-[0_15px_40px_rgba(0,0,0,0.25)] hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/60 disabled:shadow-none disabled:scale-100"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    載入中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    刷新數據
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 數據來源說明（可摺疊）*/}
      <div className="rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
        <button
          onClick={() => setShowDataSourceInfo(!showDataSourceInfo)}
          className="w-full p-5 flex items-center justify-between hover:bg-[#FFF5F5] transition-colors duration-150"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-[#FF3B30]" />
            <strong className="text-[13px] text-[#0F0F0F] font-semibold">數據來源說明</strong>
          </div>
          <svg
            className={`w-5 h-5 text-[#606060] transition-transform duration-200 ${showDataSourceInfo ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDataSourceInfo && (
          <div className="px-4 pb-4 bg-white border-t border-[#E5E5E5]">
            <ul className="space-y-2 text-sm text-[#030303] pt-4">
              <li className="flex gap-2">
                <span className="text-[#606060]">•</span>
                <span><strong className="font-medium">時區</strong>：所有數據使用<strong className="font-medium">台灣時間（UTC+8）</strong>，與 YouTube Studio 後台一致</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#606060]">•</span>
                <span><strong className="font-medium">觀看次數 & 觀看時間</strong>：所選時間範圍內<strong className="font-medium">實際產生</strong>的觀看數據（YouTube Analytics API，配額：1-2 單位）</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#606060]">•</span>
                <span><strong className="font-medium">新增訂閱數</strong>：時間範圍內淨增長（新增訂閱 - 取消訂閱）</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#606060]">•</span>
                <span><strong className="font-medium">熱門影片</strong>：基於時間範圍內的觀看次數排序（Analytics API + Gist 快取）</span>
              </li>
              <li className="text-[#0F9D58] font-medium mt-2 flex gap-2">
                <span>✓</span>
                <span>這是真實的時間段內數據，非累計數據</span>
              </li>
              <li className="text-xs text-[#606060] mt-2 flex gap-2">
                <span className="text-[#909090]">•</span>
                <span>如果 Analytics API 不可用，會自動回退到 Gist 快取方案（顯示發布影片的累計數據）</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-[#FEF7F7] border border-[#FCE8E8] rounded-xl p-4 text-[#C5221F] shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          <div className="flex items-start gap-2">
            <span className="font-medium">⚠</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 多模型 AI 分析面板 */}
      {channelStats && topVideos.length > 0 && (
        <div className="mt-6">
          <ChannelAnalysisPanel
            channelId={null}
            dateRange={{ startDate, endDate }}
            videos={topVideos.map(video => ({
              videoId: video.id,
              title: video.title,
              publishedAt: video.publishedAt,
              viewCount: video.viewCount,
              likeCount: video.likeCount,
              commentCount: video.commentCount,
              thumbnailUrl: video.thumbnailUrl,
              avgViewPercentage: video.avgViewPercentage,
              shareCount: video.shareCount,
            }))}
            channelStats={{
              totalViews: channelStats.totalViews,
              totalSubscribers: channelStats.totalSubscribers,
              totalVideos: channelStats.totalVideos,
              viewsInRange: channelStats.viewsInRange,
              watchTimeHours: channelStats.watchTimeHours,
              subscribersGained: channelStats.subscribersGained,
              videosInRange: channelStats.videosInRange,
            }}
            analytics={{
              subscribersGained: channelStats.subscribersGained,
              trafficSources: trafficSources,
              searchTerms: searchTerms,
              demographics: demographics,
              geography: geography,
              devices: devices,
              trendData: trendData,
              monthlyData: monthlyData,
            }}
          />
        </div>
      )}

      {/* KPI 指標卡片（可點擊切換圖表）- 緊湊型設計 */}
      {channelStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 觀看次數（時間範圍內）*/}
          <button
            onClick={() => setSelectedMetric('views')}
            className={`group relative overflow-hidden rounded-lg border bg-gradient-to-br from-white to-gray-50/30 shadow-sm transition-all duration-300 p-4 text-left hover:shadow-lg ${
              selectedMetric === 'views'
                ? 'border-red-500 shadow-red-100 ring-1 ring-red-500/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace' }}
          >
            {/* 背景裝飾 */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${
              selectedMetric === 'views' ? 'opacity-10 bg-red-500' : 'opacity-0'
            }`} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className={`w-5 h-5 transition-colors ${selectedMetric === 'views' ? 'text-red-500' : 'text-gray-500'}`} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">觀看次數</span>
                </div>
                {selectedMetric === 'views' && (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>

              {/* 主數字 */}
              <div className="mb-2">
                <div className="text-4xl font-bold text-gray-900 leading-none tracking-tight">
                  {formatNumber(channelStats.viewsInRange)}
                </div>
                <div className="text-[11px] text-gray-600 mt-1.5 font-medium">
                  {formatFullNumber(channelStats.viewsInRange)} 次觀看
                </div>
              </div>

              {/* 比較數據 - 橫向緊湊佈局 */}
              {viewsComparison && (
                <div className="flex gap-2.5 text-[10px] mt-3 pt-3 border-t border-gray-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.previous}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      viewsComparison.changeFromPrevious >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{viewsComparison.changeFromPrevious >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(viewsComparison.changeFromPreviousPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.yearAgo}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      viewsComparison.changeFromYearAgo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{viewsComparison.changeFromYearAgo >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(viewsComparison.changeFromYearAgoPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* 觀看時間（小時）*/}
          <button
            onClick={() => setSelectedMetric('watchTime')}
            className={`group relative overflow-hidden rounded-lg border bg-gradient-to-br from-white to-gray-50/30 shadow-sm transition-all duration-300 p-4 text-left hover:shadow-lg ${
              selectedMetric === 'watchTime'
                ? 'border-red-500 shadow-red-100 ring-1 ring-red-500/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace' }}
          >
            {/* 背景裝飾 */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${
              selectedMetric === 'watchTime' ? 'opacity-10 bg-red-500' : 'opacity-0'
            }`} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 transition-colors ${selectedMetric === 'watchTime' ? 'text-red-500' : 'text-gray-500'}`} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">觀看時間</span>
                </div>
                {selectedMetric === 'watchTime' && (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>

              {/* 主數字 */}
              <div className="mb-2">
                <div className="text-4xl font-bold text-gray-900 leading-none tracking-tight">
                  {formatNumber(channelStats.watchTimeHours)}
                </div>
                <div className="text-[11px] text-gray-600 mt-1.5 font-medium">
                  {formatFullNumber(channelStats.watchTimeHours)} 小時
                </div>
              </div>

              {/* 比較數據 */}
              {watchTimeComparison && (
                <div className="flex gap-2.5 text-[10px] mt-3 pt-3 border-t border-gray-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.previous}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      watchTimeComparison.changeFromPrevious >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{watchTimeComparison.changeFromPrevious >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(watchTimeComparison.changeFromPreviousPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.yearAgo}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      watchTimeComparison.changeFromYearAgo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{watchTimeComparison.changeFromYearAgo >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(watchTimeComparison.changeFromYearAgoPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* 新增訂閱數 */}
          <button
            onClick={() => setSelectedMetric('subscribers')}
            className={`group relative overflow-hidden rounded-lg border bg-gradient-to-br from-white to-gray-50/30 shadow-sm transition-all duration-300 p-4 text-left hover:shadow-lg ${
              selectedMetric === 'subscribers'
                ? 'border-red-500 shadow-red-100 ring-1 ring-red-500/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace' }}
          >
            {/* 背景裝飾 */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${
              selectedMetric === 'subscribers' ? 'opacity-10 bg-red-500' : 'opacity-0'
            }`} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className={`w-5 h-5 transition-colors ${selectedMetric === 'subscribers' ? 'text-red-500' : 'text-gray-500'}`} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">新增訂閱數</span>
                </div>
                {selectedMetric === 'subscribers' && (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>

              {/* 主數字 */}
              <div className="mb-2">
                <div className="text-4xl font-bold text-gray-900 leading-none tracking-tight">
                  {channelStats.subscribersGained >= 0 ? '+' : ''}{formatNumber(channelStats.subscribersGained)}
                </div>
                <div className="text-[11px] text-gray-600 mt-1.5 font-medium">
                  {formatFullNumber(channelStats.subscribersGained)} 位訂閱者
                </div>
              </div>

              {/* 總訂閱數 */}
              <div className="mb-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 font-medium">總訂閱數</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatNumber(channelStats.totalSubscribers)}
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {formatFullNumber(channelStats.totalSubscribers)} 位訂閱者
                </div>
              </div>

              {/* 比較數據 */}
              {subscribersComparison && (
                <div className="flex gap-2.5 text-[10px] mt-3 pt-3 border-t border-gray-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.previous}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      subscribersComparison.changeFromPrevious >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{subscribersComparison.changeFromPrevious >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(subscribersComparison.changeFromPreviousPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 font-semibold mb-0.5">較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[9px] text-gray-500 mb-1.5 leading-tight">{comparisonDateRanges.yearAgo}</div>
                    )}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${
                      subscribersComparison.changeFromYearAgo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <span>{subscribersComparison.changeFromYearAgo >= 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(subscribersComparison.changeFromYearAgoPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* 觀看指標（平均時長 + 完成度）- 雙指標緊湊佈局 */}
          <div
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50/30 shadow-sm transition-all duration-300 p-4 hover:shadow-lg hover:border-gray-300"
            style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace' }}
          >
            <div className="relative">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">觀看指標</span>
              </div>

              {/* 雙列佈局 - 更緊湊 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 平均觀看時長 */}
                <div className="border-r border-gray-200 pr-3">
                  <div className="text-[10px] text-gray-500 font-semibold mb-1.5">平均觀看時長</div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">
                    {Math.floor(avgViewDuration / 60)}:{String(avgViewDuration % 60).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-gray-600 font-medium">
                    {avgViewDuration} 秒
                  </div>
                </div>

                {/* 平均觀看百分比 */}
                <div className="pl-0">
                  <div className="text-[10px] text-gray-500 font-semibold mb-1.5">平均完成度</div>
                  <div className="text-3xl font-bold text-gray-900 leading-none mb-1.5">
                    {avgViewPercentage.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-gray-600 font-medium">
                    觀眾平均看完比例
                  </div>
                </div>
              </div>

              {/* 進度條視覺化 */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gray-500 to-gray-700 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(avgViewPercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                {error?.includes('Analytics API')
                  ? '無法獲取（需要 Analytics API）'
                  : '觀眾參與度指標'}
              </div>
            </div>
          </div>
          {/* 期間上傳（公開） */}
          <div
            className="group relative overflow-hidden rounded-lg border bg-gradient-to-br from-white to-gray-50/30 shadow-sm transition-all duration-300 p-4"
            style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 bg-red-500 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    期間上傳（公開）
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-4xl font-bold text-gray-900 leading-none tracking-tight">
                  {formatNumber(channelStats.videosInRange || 0)}
                </div>
                <div className="text-[11px] text-gray-600 mt-1.5 font-medium">
                  支公開影片
                </div>
              </div>
              <div className="text-[11px] text-gray-500 border-t border-gray-200 pt-3 mt-3 leading-relaxed">
                僅統計 {startDate} ~ {endDate} 期間內發布且維持公開的影片（以 GMT+8 為準）。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 過去 12 個月趨勢圖表 */}
      <div className={`${cardBaseClass} p-6`}>
        <h3 className="text-lg font-semibold mb-4">
          過去 12 個月趨勢
          {monthlyData.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({monthlyMeta.fullMonthsCount} 個完整月份{monthlyMeta.hasCurrent ? ' + 本月至今' : ''})
            </span>
          )}
        </h3>

        {monthlyData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>暫無月度數據</p>
            <p className="text-sm mt-2">請點擊「刷新數據」載入過去 12 個月的統計數據</p>
          </div>
        ) : (
          <>
            {/* Chart.js 柱狀圖 */}
            <div className="mt-6 h-80">
              <Bar
                data={{
                  labels: monthlyData.map(d => d.isCurrentMonth ? `${d.month} (至今)` : d.month),
                  datasets: [
                    {
                      label: selectedMetric === 'views' ? '觀看次數' : selectedMetric === 'watchTime' ? '觀看時長（小時）' : '訂閱淨增長',
                      data: monthlyData.map(d => {
                        switch (selectedMetric) {
                          case 'views': return d.views;
                          case 'watchTime': return d.watchTimeHours;
                          case 'subscribers': return d.subscribersNet;
                          default: return 0;
                        }
                      }),
                      backgroundColor: monthlyData.map((d, index) => {
                        const isCurrentMonth = d.isCurrentMonth;
                        switch (selectedMetric) {
                          case 'views':
                            return isCurrentMonth ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.8)';
                          case 'watchTime':
                            return isCurrentMonth ? 'rgba(251, 113, 133, 0.4)' : 'rgba(251, 113, 133, 0.8)';
                          case 'subscribers':
                            const value = monthlyData[index].subscribersNet;
                            if (isCurrentMonth) {
                              return value >= 0 ? 'rgba(220, 38, 38, 0.4)' : 'rgba(209, 213, 219, 0.4)';
                            }
                            return value >= 0 ? 'rgba(220, 38, 38, 0.8)' : 'rgba(209, 213, 219, 0.8)';
                          default:
                            return 'rgba(239, 68, 68, 0.8)';
                        }
                      }),
                      borderColor: monthlyData.map((d, index) => {
                        const isCurrentMonth = d.isCurrentMonth;
                        switch (selectedMetric) {
                          case 'views':
                            return isCurrentMonth ? '#ef4444' : '#ef4444';
                          case 'watchTime':
                            return isCurrentMonth ? '#fb7185' : '#fb7185';
                          case 'subscribers':
                            const value = monthlyData[index].subscribersNet;
                            return value >= 0 ? '#dc2626' : '#d1d5db';
                          default:
                            return '#ef4444';
                        }
                      }),
                      borderWidth: monthlyData.map(d => d.isCurrentMonth ? 2 : 0),
                      borderDash: monthlyData.map(d => d.isCurrentMonth ? [5, 5] : []),
                      borderRadius: 8,
                      borderSkipped: false,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      titleColor: '#374151',
                      bodyColor: '#6b7280',
                      borderColor: '#fca5a5',
                      borderWidth: 1,
                      padding: 12,
                      displayColors: true,
                      titleFont: {
                        size: 13,
                        weight: '600',
                      },
                      bodyFont: {
                        size: 12,
                      },
                      callbacks: {
                        label: (context) => {
                          const value = context.parsed.y;
                          const index = context.dataIndex;
                          const dataPoint = monthlyData[index];
                          let label = '';
                          switch (selectedMetric) {
                            case 'views':
                              label = `觀看次數：${formatFullNumber(value)}`;
                              break;
                            case 'watchTime':
                              label = `觀看時長：${formatFullNumber(value)} 小時`;
                              break;
                            case 'subscribers':
                              label = `訂閱淨增長：${value >= 0 ? '+' : ''}${formatFullNumber(value)}`;
                              break;
                          }
                          if (dataPoint.isCurrentMonth) {
                            label += ' (本月至今)';
                          }
                          return label;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 11,
                        },
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: '#fee2e2',
                        drawBorder: false,
                      },
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 11,
                        },
                        callback: (value) => formatNumber(value as number),
                      },
                    },
                  },
                }}
              />
            </div>
            {monthlyMeta.hasCurrent && (
              <p className="text-xs text-gray-500 mt-3 text-right">
                本月至今資料更新至 {todayLabel}，數值尚未滿整月。
              </p>
            )}
          </>
        )}
      </div>


      {(trendData.length > 0 || (ENABLE_PUBLISHING_SLOTS && viewingHours.length > 0) || error?.includes('Analytics API')) && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 border-l-4 border-red-500 pl-3 mt-2">
            {ENABLE_PUBLISHING_SLOTS ? '趨勢走勢與建議發布時段' : '觀看趨勢'}
          </h2>
          <div className={`grid grid-cols-1 ${ENABLE_PUBLISHING_SLOTS ? 'xl:grid-cols-2' : ''} gap-6`}>
            <div className={`${cardBaseClass} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900">觀看趨勢走勢</h3>
                </div>
                <span className="text-xs text-gray-500">
                  {startDate} ~ {endDate}
                </span>
              </div>
              {trendData.length === 0 ? (
                <div className="text-sm text-gray-500 bg-red-50 border border-red-100 rounded-xl p-4">
                  目前無法從 Analytics API 取得趨勢資料，請確認專案已開啟
                  YouTube Analytics API 權限後再刷新。
                </div>
              ) : (
                <>
                  <div className="relative w-full h-72">
                    <Line
                      data={{
                        labels: trendData.map(d => formatDate(d.date)),
                        datasets: [
                          {
                            label: '每日觀看次數',
                            data: trendData.map(d => d.views),
                            borderColor: '#ef4444',
                            backgroundColor: (context) => {
                              const ctx = context.chart.ctx;
                              const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                              gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
                              gradient.addColorStop(0.5, 'rgba(252, 165, 165, 0.25)');
                              gradient.addColorStop(1, 'rgba(254, 226, 226, 0.05)');
                              return gradient;
                            },
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#ef4444',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointHoverBackgroundColor: '#dc2626',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: 'index',
                          intersect: false,
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#fca5a5',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            titleFont: {
                              size: 13,
                              weight: '600',
                            },
                            bodyFont: {
                              size: 12,
                            },
                            callbacks: {
                              label: (context) => {
                                const views = context.parsed.y;
                                const index = context.dataIndex;
                                const topVideo = trendData[index]?.topVideo;
                                let lines = [`觀看次數：${formatFullNumber(views)}`];
                                if (topVideo) {
                                  lines.push('');
                                  lines.push(`當日熱門：${topVideo.title.substring(0, 40)}...`);
                                  lines.push(`單日觀看：${formatFullNumber(topVideo.views)} 次`);
                                }
                                return lines;
                              },
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: {
                              display: false,
                            },
                            ticks: {
                              color: '#6b7280',
                              font: {
                                size: 11,
                              },
                              maxRotation: 45,
                              minRotation: 45,
                            },
                          },
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: '#fee2e2',
                              drawBorder: false,
                            },
                            ticks: {
                              color: '#6b7280',
                              font: {
                                size: 11,
                              },
                              callback: (value) => formatNumber(value as number),
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  {trendSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-gray-500">平均每日觀看</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatFullNumber(trendSummary.averageViews)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">最高峰</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatDate(trendSummary.bestDay.date)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFullNumber(trendSummary.bestDay.views)} 次觀看
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">觀看動能</div>
                        <div
                          className={`text-2xl font-bold ${
                            trendSummary.momentum >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {trendSummary.momentum >= 0 ? '+' : ''}
                          {formatFullNumber(trendSummary.momentum)}
                        </div>
                        <div className="text-xs text-gray-500">最後一天 vs. 第一天</div>
                      </div>
                    </div>
                  )}
                  {trendLeaders.length > 0 && (
                    <div className="mt-4 rounded-xl border border-red-100 bg-red-50/40">
                      <div className="px-4 py-2 border-b border-red-100 text-sm font-semibold text-red-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        每日觀看冠軍最多次的影片
                      </div>
                      <div className="divide-y divide-red-100 text-sm">
                        {trendLeaders.map((leader, index) => (
                          <div
                            key={leader.id}
                            className="px-4 py-3 flex items-center gap-3"
                          >
                            <span className="text-xs font-bold text-red-600 w-5">
                              #{index + 1}
                            </span>
                            <a
                              href={`${YT_VIDEO_BASE_URL}${leader.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-14 h-9 rounded-lg overflow-hidden border border-red-100 shadow-sm shrink-0"
                            >
                              {leader.thumbnailUrl ? (
                                <img
                                  src={leader.thumbnailUrl}
                                  alt={leader.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-red-100/50 flex items-center justify-center text-[10px] text-red-600">
                                  無縮圖
                                </div>
                              )}
                            </a>
                            <div className="flex-1 min-w-0">
                              <a
                                href={`${YT_VIDEO_BASE_URL}${leader.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-900 font-semibold line-clamp-2 hover:underline"
                              >
                                {leader.title}
                              </a>
                              <div className="text-xs text-gray-500 mt-1">
                                {leader.count} 天拿下每日第一 · 最近 {formatDate(leader.lastDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                                冠軍 {leader.count} 次
                              </div>
                              <div className="text-sm font-semibold text-gray-900">
                                {formatFullNumber(leader.totalViews)}
                              </div>
                              <div className="text-[11px] text-gray-500">累積觀看</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {ENABLE_PUBLISHING_SLOTS && (
              <div className={`${cardBaseClass} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900">建議發布時段</h3>
                </div>
                <span className="text-xs text-gray-500">{viewingHoursSubtitle}</span>
              </div>

              {viewingHours.length === 0 ? (
                <div className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  尚未取得觀看時段資料。請確保已授權 YouTube Analytics API 並重新刷新，或擴大日期範圍。
                </div>
              ) : (
                <>
                  {bestPublishingSlots.length > 0 && (
                    <div className="space-y-3">
                      {bestPublishingSlots.map((slot) => (
                        <div
                          key={`${slot.dayOfWeek}-${slot.hour}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50/60"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-white text-red-600 text-sm font-bold flex items-center justify-center shadow">
                              {slot.rank}
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{slot.label}</div>
                              <div className="text-xs text-gray-500">
                                平均觀看 {formatFullNumber(slot.views)} 次
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] text-red-600 bg-white border border-red-100 rounded-full px-3 py-1 shadow-sm">
                            安排上片
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewingHoursSource === 'analytics' && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
                      目前 YouTube Analytics API 僅提供每日資料，建議時段依「哪一天觀看最高」估算。
                    </p>
                  )}

                  {viewingHourHeatmap && (
                    <div className="mt-5">
                      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                        <span>一週行事曆（越深代表觀眾越多）</span>
                        <span className="text-[10px] text-gray-400">台灣時間</span>
                      </div>
                      <div className="grid grid-cols-8 gap-2 text-xs">
                        <div />
                        {DAY_OF_WEEK_LABELS.map((label) => (
                          <div
                            key={`header-${label}`}
                            className="text-center text-[11px] font-semibold text-gray-500"
                          >
                            {label}
                          </div>
                        ))}
                        {viewingHourHeatmap.rows.map((row) => (
                          <React.Fragment key={row.bucketLabel}>
                            <div className="text-right pr-2 text-[11px] text-gray-500 font-semibold">
                              {row.bucketLabel}
                            </div>
                            {row.values.map((cell) => {
                              const bgOpacity = 0.15 + cell.intensity * 0.65;
                              return (
                                <div
                                  key={`${row.bucketLabel}-${cell.dayIndex}`}
                                  className="h-12 rounded-lg border border-red-50 flex flex-col items-center justify-center"
                                  style={{
                                    backgroundColor: `rgba(239, 68, 68, ${bgOpacity.toFixed(3)})`,
                                  }}
                                >
                                  <span className="text-xs font-semibold text-red-900">
                                    {cell.views > 0 ? formatNumber(cell.views) : '—'}
                                  </span>
                                  <span className="text-[10px] text-red-900/70">次</span>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingHoursSource === 'cache' && !viewingHourHeatmap && (
                    <p className="text-xs text-gray-500 mt-4">
                      目前資料量不足以繪製行事曆，但已根據歷來影片表現排序最佳發布順位。
                    </p>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        </>
      )}

      {/* 內容類型分析區塊標題 */}
      {(contentTypeMetrics || topShorts.length > 0 || topRegularVideos.length > 0 || sortedTopVideos.length > 0) && (
        <h2 className="text-lg font-semibold text-gray-900 border-l-4 border-red-500 pl-3 mt-2">
          內容表現分析
        </h2>
      )}

      {/* Shorts vs 一般影片對比 */}
      {contentTypeMetrics && (
        <div className={cardBaseClass}>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Video className="w-5 h-5 text-red-500" />
              內容類型分析
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Shorts 與一般影片的表現對比
              {(contentTypeMetrics.shorts.views === 0 && contentTypeMetrics.regularVideos.views === 0) && (
                <span className="block mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-xs">
                  選定的時間範圍內沒有觀看數據。請嘗試：<br/>
                  1. 選擇更長的時間範圍（例如「過去 90 天」）<br/>
                  2. 確認頻道在此期間有發布影片
                </span>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Shorts 卡片 */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100">
                <div className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Shorts 短影片
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">觀看次數</span>
                    <span className="font-bold text-red-700">{formatNumber(contentTypeMetrics.shorts.views)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">按讚數</span>
                    <span className="font-semibold text-red-700">{formatNumber(contentTypeMetrics.shorts.likes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">分享數</span>
                    <span className="font-semibold text-red-600">{formatNumber(contentTypeMetrics.shorts.shares)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">留言數</span>
                    <span className="font-semibold text-red-600">{formatNumber(contentTypeMetrics.shorts.comments)}</span>
                  </div>
                </div>
              </div>

              {/* 一般影片卡片 */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-amber-100">
                <div className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  一般影片
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">觀看次數</span>
                    <span className="font-bold text-amber-700">{formatNumber(contentTypeMetrics.regularVideos.views)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">觀看時間</span>
                    <span className="font-semibold text-amber-700">{formatNumber(contentTypeMetrics.regularVideos.watchTime)} 小時</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">按讚數</span>
                    <span className="font-semibold text-amber-600">{formatNumber(contentTypeMetrics.regularVideos.likes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">留言數</span>
                    <span className="font-semibold text-amber-600">{formatNumber(contentTypeMetrics.regularVideos.comments)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 觀看次數佔比圖表 */}
            {(() => {
              const totalViews = contentTypeMetrics.shorts.views + contentTypeMetrics.regularVideos.views;
              const shortsPercentage = totalViews > 0 ? ((contentTypeMetrics.shorts.views / totalViews) * 100).toFixed(1) : '0';
              const regularPercentage = totalViews > 0 ? ((contentTypeMetrics.regularVideos.views / totalViews) * 100).toFixed(1) : '0';

              return (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <div className="text-sm font-medium text-gray-700 mb-2">觀看次數佔比</div>
                  <div className="flex h-10 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center text-white text-sm font-semibold transition-all"
                      style={{ width: `${shortsPercentage}%` }}
                    >
                      {parseFloat(shortsPercentage) > 12 && `Shorts ${shortsPercentage}%`}
                    </div>
                    <div
                      className="bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm font-semibold transition-all"
                      style={{ width: `${regularPercentage}%` }}
                    >
                      {parseFloat(regularPercentage) > 12 && `一般影片 ${regularPercentage}%`}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-600">
                    <span>Shorts: {formatFullNumber(contentTypeMetrics.shorts.views)} 次</span>
                    <span>一般影片: {formatFullNumber(contentTypeMetrics.regularVideos.views)} 次</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 熱門影片列表 */}
      {sortedTopVideos.length > 0 && (
        <div className={cardBaseClass}>
          <div className="p-6">
            <div
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => setIsTopVideosExpanded(!isTopVideosExpanded)}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  熱門影片 (Top 10)
                </h3>
                <p className="text-sm text-gray-500">
                  時間範圍內表現最佳的影片（按總觀看數排序）
                </p>
              </div>
              <button className="ml-4 p-2 hover:bg-red-50 rounded-lg transition-colors">
                {isTopVideosExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>

            {isTopVideosExpanded && (
              <>
                <div className="flex flex-wrap gap-2 mb-6">
              {TOP_VIDEO_METRICS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTopVideoMetric(option.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                    topVideoMetric === option.value
                      ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-200'
                      : 'bg-white text-gray-600 border-red-100 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* 響應式網格卡片 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {sortedTopVideos.map((video, index) => {
                const metricConfig = topVideoMetricConfig[topVideoMetric];
                const metricValue = metricConfig.value(video);
                const metricDisplay = metricConfig.formatter(metricValue);
                const MetricIcon = metricConfig.icon;

                const isExpanded = expandedVideos.has(video.id);
                const isDescExpanded = expandedDescriptions.has(video.id);

                // Debug logging
                if (index === 0 && sortedTopVideos.length > 0) {
                  console.log('[Dashboard] 📊 Top Videos Sample:', {
                    videoId: video.id,
                    title: video.title,
                    hasDescription: !!video.description,
                    descriptionLength: video.description?.length || 0,
                    isExpanded
                  });
                }

                return (
                  <div
                    key={video.id}
                    className="rounded-lg border border-red-100 hover:border-red-200 transition-colors flex flex-col h-full overflow-hidden"
                  >
                    {/* 可點擊的卡片頭部 */}
                    <div
                      onClick={() => toggleVideoExpanded(video.id)}
                      className="p-3 cursor-pointer hover:bg-red-50/70 flex flex-col items-center text-center gap-3"
                    >
                      {/* 排名標籤 */}
                      <div className="self-start text-xs font-semibold text-red-500 flex items-center gap-1">
                        <span className="text-sm">#{index + 1}</span>
                        <span className="text-[11px] text-gray-400">Top</span>
                      </div>

                      {/* 縮圖與主要指標 */}
                      <div className="flex flex-col items-center w-full">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full aspect-video object-cover rounded-lg shadow-sm"
                        />
                        <div className="mt-2 inline-flex items-center justify-center gap-1 text-sm text-red-600 w-full truncate">
                          <MetricIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className="font-semibold truncate">{metricDisplay}</span>
                        </div>
                        <div className="text-xs text-gray-500">{metricConfig.label}</div>
                      </div>

                      {/* 影片標題 */}
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 w-full leading-relaxed">
                        {video.title}
                      </h4>

                      {/* 互動數據 */}
                      <div className="w-full flex items-center justify-center gap-3 text-xs font-semibold flex-wrap">
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <ThumbsUp className="w-4 h-4 shrink-0" />
                          {formatNumber(video.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <MessageSquare className="w-4 h-4 shrink-0" />
                          {formatNumber(video.commentCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Calendar className="w-4 h-4 shrink-0" />
                          {formatDate(video.publishedAt)}
                        </span>
                      </div>

                      {/* 展開指示器 */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-full">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? '收起' : '點擊展開'}</span>
                      </div>
                    </div>

                    {/* 展開內容 */}
                    {isExpanded && (
                      <div className="border-t border-red-100 p-3 space-y-3 bg-red-50/30">
                        {/* YouTube 影片播放器 */}
                        <div className="w-full">
                          <iframe
                            className="w-full aspect-video rounded-lg"
                            src={`https://www.youtube.com/embed/${video.id}`}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>

                        {/* 影片說明 */}
                        {video.description ? (
                          <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                            <div className="bg-gray-100 rounded-lg p-3">
                              <div
                                className={`text-xs text-gray-800 whitespace-pre-wrap leading-relaxed ${
                                  isDescExpanded ? '' : 'line-clamp-3'
                                }`}
                              >
                                {video.description}
                              </div>
                            </div>
                            {video.description.split('\n').length > 3 || video.description.length > 150 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDescriptionExpanded(video.id);
                                }}
                                className="inline-block px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                              >
                                {isDescExpanded ? '收起影片說明' : '展開影片說明'}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                            <div className="bg-gray-100 rounded-lg p-3">
                              <p className="text-xs text-gray-500 italic">此影片暫無說明</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 並排顯示：Shorts 和一般影片排行榜 */}
      {(topShorts.length > 0 || topRegularVideos.length > 0) && (
        <div
          className={`grid grid-cols-1 ${
            showVideoRankingsDoubleColumn ? 'xl:grid-cols-2' : 'xl:grid-cols-1'
          } gap-4`}
        >
          {/* 熱門 Shorts 排行榜 */}
          {topShorts.length > 0 && (
            <div className={`${cardBaseClass} h-full flex flex-col`}>
              <div className="p-6 flex-1 flex flex-col">
                <div
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => setIsTopShortsExpanded(!isTopShortsExpanded)}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-500" />
                      熱門 Shorts 排行榜
                    </h3>
                    <p className="text-sm text-gray-500">
                      時間範圍內表現最佳的 Shorts 短影片（按觀看次數排序）
                    </p>
                  </div>
                  <button className="ml-4 p-2 hover:bg-red-50 rounded-lg transition-colors">
                    {isTopShortsExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>

                {isTopShortsExpanded && (
                  <div className="space-y-2.5 flex-1">
                    {topShorts.map((video, index) => {
                      const isTopThree = index < 3;
                      const rankColors = [
                        'from-amber-500 to-amber-600',
                        'from-slate-400 to-slate-500',
                        'from-orange-600 to-orange-700',
                      ];
                      const rankBg = isTopThree ? rankColors[index] : 'from-red-500 to-rose-600';

                      const isExpanded = expandedVideos.has(video.id);
                      const isDescExpanded = expandedDescriptions.has(video.id);

                      // Debug logging
                      if (index === 0 && topShorts.length > 0) {
                        console.log('[Dashboard] 🎬 Shorts Sample:', {
                          videoId: video.id,
                          title: video.title,
                          hasDescription: !!video.description,
                          descriptionLength: video.description?.length || 0,
                          isExpanded
                        });
                      }

                      return (
                        <div
                          key={video.id}
                          className="group relative overflow-hidden rounded-xl border border-red-100/50 bg-gradient-to-br from-white to-red-50/30 hover:border-red-200 hover:shadow-lg hover:shadow-red-100/50 transition-all duration-300"
                        >
                          <div
                            className="flex items-start gap-3 p-3 cursor-pointer"
                            onClick={() => toggleVideoExpanded(video.id)}
                          >
                            {/* 排名徽章 */}
                            <div className="flex-shrink-0 relative">
                              <div
                                className={`absolute -top-1 -left-1 w-8 h-8 bg-gradient-to-br ${rankBg} rounded-full flex items-center justify-center shadow-lg z-10 ring-2 ring-white`}
                              >
                                <span className="text-white text-xs font-black tracking-tight">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="relative overflow-hidden rounded-lg ring-2 ring-white shadow-md group-hover:scale-105 transition-transform duration-300">
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.title}
                                  className="w-[72px] aspect-[9/16] object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                            </div>

                            {/* 內容區 */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              {/* 標題 */}
                              <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2 group-hover:text-red-700 transition-colors">
                                {video.title}
                              </h4>

                              {/* 數據網格 */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {/* 觀看數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-red-50 to-rose-50 border border-red-100/50">
                                  <Eye className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-red-700 truncate text-[11px] leading-tight">
                                      {formatFullNumber(video.viewCount)}
                                    </span>
                                  </div>
                                </div>

                                {/* 按讚數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100/50">
                                  <ThumbsUp className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                                  <span className="font-bold text-pink-700 truncate text-[11px] leading-tight">
                                    {formatFullNumber(video.likeCount)}
                                  </span>
                                </div>

                                {/* 留言數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50">
                                  <MessageSquare className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                  <span className="font-bold text-purple-700 truncate text-[11px] leading-tight">
                                    {formatFullNumber(video.commentCount)}
                                  </span>
                                </div>

                                {/* 觀看完成率 */}
                                {video.avgViewPercentage > 0 && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100/50">
                                    <BarChart3 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                    <span className="font-bold text-amber-700 text-[11px] leading-tight">
                                      {video.avgViewPercentage.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 展開指示器 */}
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-full mt-2">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                <span>{isExpanded ? '收起' : '點擊展開'}</span>
                              </div>
                            </div>
                          </div>

                          {/* 展開內容 */}
                          {isExpanded && (
                            <div className="border-t border-red-200/50 p-3 space-y-3 bg-red-50/50">
                              {/* YouTube Shorts 播放器 */}
                              <div className="w-full flex justify-center">
                                <div className="w-full max-w-xs">
                                  <iframe
                                    className="w-full aspect-[9/16] rounded-lg"
                                    src={`https://www.youtube.com/embed/${video.id}`}
                                    title={video.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              </div>

                              {/* 影片說明 */}
                              {video.description ? (
                                <div className="space-y-2">
                                  <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                                  <div className="bg-gray-100 rounded-lg p-3">
                                    <div
                                      className={`text-xs text-gray-800 whitespace-pre-wrap leading-relaxed ${
                                        isDescExpanded ? '' : 'line-clamp-3'
                                      }`}
                                    >
                                      {video.description}
                                    </div>
                                  </div>
                                  {video.description.split('\n').length > 3 || video.description.length > 150 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDescriptionExpanded(video.id);
                                      }}
                                      className="inline-block px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                    >
                                      {isDescExpanded ? '收起影片說明' : '展開影片說明'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                                  <div className="bg-gray-100 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 italic">此影片暫無說明</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 底部裝飾條 - 僅前三名 */}
                          {isTopThree && !isExpanded && (
                            <div className={`h-1 w-full bg-gradient-to-r ${rankBg} opacity-60`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 熱門一般影片排行榜 */}
          {topRegularVideos.length > 0 && (
            <div className={`${cardBaseClass} h-full flex flex-col`}>
              <div className="p-6 flex-1 flex flex-col">
                <div
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => setIsTopRegularVideosExpanded(!isTopRegularVideosExpanded)}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                      熱門一般影片排行榜
                    </h3>
                    <p className="text-sm text-gray-500">
                      時間範圍內表現最佳的一般影片（按觀看次數排序）
                    </p>
                  </div>
                  <button className="ml-4 p-2 hover:bg-amber-50 rounded-lg transition-colors">
                    {isTopRegularVideosExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>

                {isTopRegularVideosExpanded && (
                  <div className="space-y-2.5 flex-1">
                    {topRegularVideos.map((video, index) => {
                      const isTopThree = index < 3;
                      const rankColors = [
                        'from-amber-500 to-amber-600',
                        'from-slate-400 to-slate-500',
                        'from-orange-600 to-orange-700',
                      ];
                      const rankBg = isTopThree ? rankColors[index] : 'from-amber-500 to-orange-600';

                      const isExpanded = expandedVideos.has(video.id);
                      const isDescExpanded = expandedDescriptions.has(video.id);

                      // Debug logging
                      if (index === 0 && topRegularVideos.length > 0) {
                        console.log('[Dashboard] 🎥 Regular Videos Sample:', {
                          videoId: video.id,
                          title: video.title,
                          hasDescription: !!video.description,
                          descriptionLength: video.description?.length || 0,
                          isExpanded
                        });
                      }

                      return (
                        <div
                          key={video.id}
                          className="group relative overflow-hidden rounded-xl border border-amber-100/50 bg-gradient-to-br from-white to-amber-50/30 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300"
                        >
                          <div
                            className="flex items-start gap-3 p-3 cursor-pointer"
                            onClick={() => toggleVideoExpanded(video.id)}
                          >
                            {/* 排名徽章 */}
                            <div className="flex-shrink-0 relative">
                              <div
                                className={`absolute -top-1 -left-1 w-8 h-8 bg-gradient-to-br ${rankBg} rounded-full flex items-center justify-center shadow-lg z-10 ring-2 ring-white`}
                              >
                                <span className="text-white text-xs font-black tracking-tight">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="relative overflow-hidden rounded-lg ring-2 ring-white shadow-md group-hover:scale-105 transition-transform duration-300">
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.title}
                                  className="w-[120px] aspect-video object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                            </div>

                            {/* 內容區 */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              {/* 標題 */}
                              <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2 group-hover:text-amber-700 transition-colors">
                                {video.title}
                              </h4>

                              {/* 數據網格 */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {/* 觀看數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/50">
                                  <Eye className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-amber-700 truncate text-[11px] leading-tight">
                                      {formatFullNumber(video.viewCount)}
                                    </span>
                                  </div>
                                </div>

                                {/* 按讚數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-100/50">
                                  <ThumbsUp className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                                  <span className="font-bold text-yellow-700 truncate text-[11px] leading-tight">
                                    {formatFullNumber(video.likeCount)}
                                  </span>
                                </div>

                                {/* 留言數 */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100/50">
                                  <MessageSquare className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                                  <span className="font-bold text-orange-700 truncate text-[11px] leading-tight">
                                    {formatFullNumber(video.commentCount)}
                                  </span>
                                </div>

                                {/* 觀看完成率 */}
                                {video.avgViewPercentage > 0 && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50">
                                    <BarChart3 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    <span className="font-bold text-emerald-700 text-[11px] leading-tight">
                                      {video.avgViewPercentage.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 展開指示器 */}
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-full mt-2">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                <span>{isExpanded ? '收起' : '點擊展開'}</span>
                              </div>
                            </div>
                          </div>

                          {/* 展開內容 */}
                          {isExpanded && (
                            <div className="border-t border-amber-200/50 p-3 space-y-3 bg-amber-50/50">
                              {/* YouTube 影片播放器 */}
                              <div className="w-full">
                                <iframe
                                  className="w-full aspect-video rounded-lg"
                                  src={`https://www.youtube.com/embed/${video.id}`}
                                  title={video.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>

                              {/* 影片說明 */}
                              {video.description ? (
                                <div className="space-y-2">
                                  <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                                  <div className="bg-gray-100 rounded-lg p-3">
                                    <div
                                      className={`text-xs text-gray-800 whitespace-pre-wrap leading-relaxed ${
                                        isDescExpanded ? '' : 'line-clamp-3'
                                      }`}
                                    >
                                      {video.description}
                                    </div>
                                  </div>
                                  {video.description.split('\n').length > 3 || video.description.length > 150 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDescriptionExpanded(video.id);
                                      }}
                                      className="inline-block px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                    >
                                      {isDescExpanded ? '收起影片說明' : '展開影片說明'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <h5 className="text-xs font-semibold text-gray-700">影片說明</h5>
                                  <div className="bg-gray-100 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 italic">此影片暫無說明</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 底部裝飾條 - 僅前三名 */}
                          {isTopThree && !isExpanded && (
                            <div className={`h-1 w-full bg-gradient-to-r ${rankBg} opacity-60`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 流量來源區塊標題 */}
      {(trafficSources.length > 0 || externalSources.length > 0 || searchTerms.length > 0) && (
        <h2 className="text-lg font-semibold text-gray-900 border-l-4 border-red-500 pl-3 mt-2">
          流量來源分析
        </h2>
      )}

      {/* 流量來源分析區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 熱門流量來源 - 甜甜圈圖 */}
        {trafficSources.length > 0 && (
          <div className={compactCardClass}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              熱門流量來源
            </h3>
            <div className="flex flex-col items-center">
              {/* Chart.js 甜甜圈圖 */}
              <div className="relative w-72 h-72 mb-6">
                <Doughnut
                  data={{
                    labels: trafficSources.map(s => translateTrafficSource(s.source)),
                    datasets: [
                      {
                        data: trafficSources.map(s => s.views),
                        backgroundColor: [
                          '#dc2626', // red-600
                          '#ef4444', // red-500
                          '#f87171', // red-400
                          '#fb923c', // orange-400
                          '#fbbf24', // amber-400
                          '#a855f7', // purple-500
                          '#06b6d4', // cyan-500
                          '#10b981', // emerald-500
                        ],
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverBorderWidth: 4,
                        hoverBorderColor: '#ffffff',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '65%',
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#374151',
                        bodyColor: '#6b7280',
                        borderColor: '#fca5a5',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        titleFont: {
                          size: 13,
                          weight: '600',
                        },
                        bodyFont: {
                          size: 12,
                        },
                        callbacks: {
                          label: (context) => {
                            const index = context.dataIndex;
                            const source = trafficSources[index];
                            return [
                              `觀看次數：${formatFullNumber(source.views)}`,
                              `佔比：${source.percentage.toFixed(1)}%`
                            ];
                          },
                        },
                      },
                    },
                  }}
                  plugins={[{
                    id: 'centerText',
                    beforeDraw: (chart) => {
                      const { ctx, chartArea: { width, height } } = chart;
                      ctx.save();
                      const totalViews = trafficSources.reduce((sum, s) => sum + s.views, 0);
                      ctx.font = 'bold 24px sans-serif';
                      ctx.fillStyle = '#111827';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(formatNumber(totalViews), width / 2, height / 2 - 10);
                      ctx.font = '12px sans-serif';
                      ctx.fillStyle = '#6b7280';
                      ctx.fillText('總觀看', width / 2, height / 2 + 15);
                      ctx.restore();
                    },
                  }]}
                />
              </div>

              {/* 圖例 */}
              <div className="w-full space-y-2">
                {trafficSources.map((source, index) => {
                  const colors = [
                    { hex: '#dc2626', bg: 'bg-red-600' },
                    { hex: '#ef4444', bg: 'bg-red-500' },
                    { hex: '#f87171', bg: 'bg-red-400' },
                    { hex: '#fb923c', bg: 'bg-orange-400' },
                    { hex: '#fbbf24', bg: 'bg-amber-400' },
                    { hex: '#a855f7', bg: 'bg-purple-500' },
                    { hex: '#06b6d4', bg: 'bg-cyan-500' },
                    { hex: '#10b981', bg: 'bg-emerald-500' },
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <div key={index} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                        <span className="text-sm text-gray-700 truncate">{translateTrafficSource(source.source)}</span>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-xs text-gray-500">
                          {formatFullNumber(source.views)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {source.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 外部來源排行 - 橫向柱狀圖 */}
        {externalSources.length > 0 && (
          <div className={compactCardClass}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              外部來源排行
            </h3>

            {/* 橫向柱狀圖 */}
            <div className="space-y-4">
              {externalSources.slice(0, 8).map((source, index) => {
                const colors = [
                  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
                  '#d946ef', '#ec4899', '#f43f5e', '#ef4444'
                ];
                const color = colors[index % colors.length];
                const maxViews = Math.max(...externalSources.slice(0, 8).map(s => s.views));
                const barWidth = (source.views / maxViews) * 100;

                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate pr-4">
                        {source.source}
                      </span>
                      <span className="text-gray-900 font-semibold whitespace-nowrap">
                        {formatFullNumber(source.views)}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: color,
                          }}
                        >
                          <span className="text-xs font-semibold text-white">
                            {source.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 搜尋字詞排行榜（跨2欄） */}
      {searchTerms.length > 0 && (
        <div className={compactCardClass}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-500" />
            熱門搜尋字詞排行
          </h3>

          {/* 排行榜 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchTerms.slice(0, 10).map((term, index) => {
              // 前三名的特殊顏色
              const rankColors = [
                { bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100', border: 'border-yellow-400', text: 'text-yellow-600', rankBg: 'bg-yellow-500' },
                { bg: 'bg-gradient-to-r from-gray-50 to-gray-100', border: 'border-gray-400', text: 'text-gray-600', rankBg: 'bg-gray-400' },
                { bg: 'bg-gradient-to-r from-orange-50 to-orange-100', border: 'border-orange-400', text: 'text-orange-600', rankBg: 'bg-orange-500' },
              ];

              const isTopThree = index < 3;
              const colorScheme = isTopThree
                ? rankColors[index]
                : { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-600', rankBg: 'bg-gray-300' };

              return (
                <div
                  key={index}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border-2 ${colorScheme.border} ${colorScheme.bg} hover:shadow-md transition-all duration-200`}
                >
                  {/* 排名徽章 */}
                  <div className={`flex-shrink-0 w-10 h-10 ${colorScheme.rankBg} rounded-full flex items-center justify-center shadow-sm`}>
                    <span className="text-xl font-bold text-white">
                      {index + 1}
                    </span>
                  </div>

                  {/* 搜尋字詞 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900 truncate">
                      {term.term}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">搜尋次數</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                        <div
                          className={`${isTopThree ? colorScheme.rankBg : 'bg-red-400'} h-1.5 rounded-full transition-all duration-500`}
                          style={{
                            width: `${(term.views / searchTerms[0].views) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 觀看次數 */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-bold ${colorScheme.text}`}>
                      {formatFullNumber(term.views)}
                    </div>
                    <div className="text-xs text-gray-500">觀看</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 觀眾洞察區塊標題 */}
      {(demographics.length > 0 || geography.length > 0 || devices.length > 0 || subscriberSources.length > 0) && (
        <h2 className="text-lg font-semibold text-gray-900 border-l-4 border-red-500 pl-3 mt-2">
          觀眾洞察分析
        </h2>
      )}

      {/* 人口統計區塊 */}
      {(demographics.length > 0 || geography.length > 0 || devices.length > 0) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* 年齡與性別分佈 - 人口金字塔 */}
            {demographics.length > 0 && (
              <div className={compactCardClass}>
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-500" />
                  年齡與性別分佈
                </h3>

                {/* 圖例 */}
                <div className="flex justify-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FF4B4B] rounded"></div>
                    <span className="text-sm text-gray-600">男性</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FF9EB5] rounded"></div>
                    <span className="text-sm text-gray-600">女性</span>
                  </div>
                </div>

                {/* 人口金字塔 */}
                <div className="space-y-2">
                  {(() => {
                    // 按年齡分組
                    const ageGroups = Array.from(new Set(demographics.map(d => d.ageGroup)));
                    const maxPercentage = Math.max(...demographics.map(d => d.viewsPercentage));

                    return ageGroups.map((ageGroup, index) => {
                      const maleData = demographics.find(d => d.ageGroup === ageGroup && d.gender === 'male');
                      const femaleData = demographics.find(d => d.ageGroup === ageGroup && d.gender === 'female');

                      const malePercentage = maleData?.viewsPercentage || 0;
                      const femalePercentage = femaleData?.viewsPercentage || 0;

                      const maleWidth = (malePercentage / maxPercentage) * 100;
                      const femaleWidth = (femalePercentage / maxPercentage) * 100;

                      const ageText = ageGroup.replace('age', '').replace('-', '-');

                      return (
                        <div key={index} className="flex items-center gap-2">
                          {/* 男性柱狀圖（左側） */}
                          <div className="flex-1 flex justify-end">
                            <div className="flex items-center justify-end w-full">
                              <span className="text-xs text-gray-600 mr-2 w-10 text-right">
                                {malePercentage > 0 ? `${malePercentage.toFixed(1)}%` : ''}
                              </span>
                              <div className="w-full bg-gray-50 rounded-l-md h-8 flex items-center justify-end overflow-hidden">
                                <div
                                  className="h-full transition-all duration-500 bg-[#FF4B4B]"
                                  style={{ width: `${maleWidth}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* 中間年齡標籤 */}
                          <div className="w-16 text-center">
                            <span className="text-xs font-semibold text-gray-700">
                              {ageText}
                            </span>
                          </div>

                          {/* 女性柱狀圖（右側） */}
                          <div className="flex-1">
                            <div className="flex items-center w-full">
                              <div className="w-full bg-gray-50 rounded-r-md h-8 flex items-center overflow-hidden">
                                <div
                                  className="h-full transition-all duration-500 bg-[#FF9EB5]"
                                  style={{ width: `${femaleWidth}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-600 ml-2 w-10">
                                {femalePercentage > 0 ? `${femalePercentage.toFixed(1)}%` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* 地理位置分佈 */}
            {geography.length > 0 && (
              <div className={compactCardClass}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  觀眾地理分佈（前 10 名）
                </h3>
                <div className="space-y-3">
                  {geography.map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400 w-5 text-center">
                            {index + 1}
                          </span>
                          <span className="text-gray-700">{getCountryName(item.country)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-xs">
                            {formatFullNumber(item.views)} 次
                          </span>
                          <span className="font-semibold text-gray-900 w-12 text-right">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 裝置類型分佈 - 橫向柱狀圖 */}
            {devices.length > 0 && (
              <div className={compactCardClass}>
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-500" />
                  觀看裝置分佈
                </h3>

                {/* Chart.js 橫向柱狀圖 */}
                <div className="h-72 mb-4">
                  <Bar
                    data={{
                      labels: devices.map(d => {
                        const deviceNames: { [key: string]: string } = {
                          DESKTOP: '桌面電腦',
                          MOBILE: '手機',
                          TABLET: '平板',
                          TV: '電視',
                          GAME_CONSOLE: '遊戲主機',
                        };
                        return deviceNames[d.deviceType] || d.deviceType;
                      }),
                      datasets: [
                        {
                          label: '觀看次數',
                          data: devices.map(d => d.views),
                          backgroundColor: [
                            'rgba(220, 38, 38, 0.8)',   // red-600
                            'rgba(245, 158, 11, 0.8)',  // amber-500
                            'rgba(139, 92, 246, 0.8)',  // violet-500
                            'rgba(6, 182, 212, 0.8)',   // cyan-500
                            'rgba(236, 72, 153, 0.8)',  // pink-500
                          ],
                          borderColor: [
                            '#dc2626',
                            '#f59e0b',
                            '#8b5cf6',
                            '#06b6d4',
                            '#ec4899',
                          ],
                          borderWidth: 2,
                          borderRadius: 6,
                        },
                      ],
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          titleColor: '#374151',
                          bodyColor: '#6b7280',
                          borderColor: '#fca5a5',
                          borderWidth: 1,
                          padding: 12,
                          displayColors: true,
                          titleFont: {
                            size: 13,
                            weight: '600',
                          },
                          bodyFont: {
                            size: 12,
                          },
                          callbacks: {
                            label: (context) => {
                              const index = context.dataIndex;
                              const device = devices[index];
                              return [
                                `觀看次數：${formatFullNumber(device.views)}`,
                                `佔比：${device.percentage.toFixed(1)}%`
                              ];
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          grid: {
                            color: '#fee2e2',
                            drawBorder: false,
                          },
                          ticks: {
                            color: '#6b7280',
                            font: {
                              size: 11,
                            },
                            callback: (value) => formatNumber(value as number),
                          },
                        },
                        y: {
                          grid: {
                            display: false,
                          },
                          ticks: {
                            color: '#374151',
                            font: {
                              size: 12,
                              weight: '600',
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>

                {/* 總計 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      總觀看次數
                    </span>
                    <span className="text-xl font-bold text-red-600">
                      {formatFullNumber(devices.reduce((sum, d) => sum + d.views, 0))} 次
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 訂閱來源分析 - 頒獎台式（獨立區塊） */}
      {subscriberSources.length > 0 && (
        <div className={compactCardClass}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-500" />
            訂閱來源分析
            <span className="text-sm font-normal text-gray-500">
              （帶來最多新訂閱的影片）
            </span>
          </h3>

          {/* 頒獎台 - 前三名 */}
          {subscriberSources.length >= 3 && (
            <div className="mb-8">
                    {/* 桌面版：頒獎台排列（2-1-3） */}
                    <div className="hidden md:flex items-end justify-center gap-4 mb-6">
                      {/* 第二名 */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="w-full bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl p-4 border-2 border-gray-300 shadow-lg overflow-hidden flex flex-col">
                          <div className="text-center mb-3">
                            <div className="text-2xl font-bold text-gray-600">第 2 名</div>
                          </div>
                          {/* 影片縮圖 - 16:9 比例 */}
                          <div className="mb-3 w-full aspect-video flex-shrink-0">
                            <img
                              src={`https://i.ytimg.com/vi/${subscriberSources[1].videoId}/mqdefault.jpg`}
                              alt={subscriberSources[1].videoTitle}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${subscriberSources[1].videoId}/default.jpg`;
                              }}
                            />
                          </div>
                          {/* 標題 - 固定高度 */}
                          <div className="text-sm font-semibold text-gray-900 mb-3 line-clamp-2 h-10 flex-shrink-0">
                            {subscriberSources[1].videoTitle}
                          </div>
                          {/* 訂閱數 - 推到底部 */}
                          <div className="text-center mt-auto">
                            <div className="text-2xl font-bold text-gray-700">
                              +{formatNumber(subscriberSources[1].subscribersGained)}
                            </div>
                            <div className="text-xs text-gray-600">新訂閱</div>
                          </div>
                        </div>
                      </div>

                      {/* 第一名（中間最高） */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="w-full bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-2xl p-5 border-2 border-yellow-400 shadow-2xl overflow-hidden flex flex-col">
                          <div className="text-center mb-3">
                            <div className="text-3xl font-bold text-yellow-700">第 1 名</div>
                            <div className="text-xs text-yellow-600 flex items-center justify-center gap-1">
                              <Crown className="w-3 h-3" />
                              冠軍
                            </div>
                          </div>
                          {/* 影片縮圖 - 16:9 比例 */}
                          <div className="mb-3 w-full aspect-video flex-shrink-0">
                            <img
                              src={`https://i.ytimg.com/vi/${subscriberSources[0].videoId}/mqdefault.jpg`}
                              alt={subscriberSources[0].videoTitle}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${subscriberSources[0].videoId}/default.jpg`;
                              }}
                            />
                          </div>
                          {/* 標題 - 固定高度 */}
                          <div className="text-sm font-bold text-gray-900 mb-3 line-clamp-2 h-10 flex-shrink-0">
                            {subscriberSources[0].videoTitle}
                          </div>
                          {/* 訂閱數 - 推到底部 */}
                          <div className="text-center mt-auto">
                            <div className="text-3xl font-bold text-red-600">
                              +{formatNumber(subscriberSources[0].subscribersGained)}
                            </div>
                            <div className="text-xs text-gray-600">新訂閱</div>
                          </div>
                        </div>
                      </div>

                      {/* 第三名 */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="w-full bg-gradient-to-b from-orange-50 to-orange-100 rounded-2xl p-4 border-2 border-orange-300 shadow-lg overflow-hidden flex flex-col">
                          <div className="text-center mb-3">
                            <div className="text-2xl font-bold text-orange-600">第 3 名</div>
                          </div>
                          {/* 影片縮圖 - 16:9 比例 */}
                          <div className="mb-3 w-full aspect-video flex-shrink-0">
                            <img
                              src={`https://i.ytimg.com/vi/${subscriberSources[2].videoId}/mqdefault.jpg`}
                              alt={subscriberSources[2].videoTitle}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${subscriberSources[2].videoId}/default.jpg`;
                              }}
                            />
                          </div>
                          {/* 標題 - 固定高度 */}
                          <div className="text-sm font-semibold text-gray-900 mb-3 line-clamp-2 h-10 flex-shrink-0">
                            {subscriberSources[2].videoTitle}
                          </div>
                          {/* 訂閱數 - 推到底部 */}
                          <div className="text-center mt-auto">
                            <div className="text-2xl font-bold text-orange-700">
                              +{formatNumber(subscriberSources[2].subscribersGained)}
                            </div>
                            <div className="text-xs text-gray-600">新訂閱</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 手機版：垂直堆疊 */}
                    <div className="md:hidden space-y-4 mb-6">
                      {subscriberSources.slice(0, 3).map((source, index) => {
                        const styles = [
                          { bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', label: '冠軍' },
                          { bg: 'from-gray-50 to-gray-100', border: 'border-gray-400', text: 'text-gray-700', label: '亞軍' },
                          { bg: 'from-orange-50 to-orange-100', border: 'border-orange-400', text: 'text-orange-700', label: '季軍' },
                        ];
                        const style = styles[index];

                        return (
                          <div key={source.videoId} className={`bg-gradient-to-r ${style.bg} rounded-2xl p-4 border-2 ${style.border} shadow-lg`}>
                            <div className="flex gap-3 mb-3">
                              {/* 影片縮圖 */}
                              <div className="flex-shrink-0 w-32">
                                <img
                                  src={`https://i.ytimg.com/vi/${source.videoId}/mqdefault.jpg`}
                                  alt={source.videoTitle}
                                  className="w-full aspect-video object-cover rounded-lg"
                                  onError={(e) => {
                                    e.currentTarget.src = `https://i.ytimg.com/vi/${source.videoId}/default.jpg`;
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <div className={`text-xl font-bold ${style.text}`}>第 {index + 1} 名</div>
                                <div className="text-xs text-gray-600 mb-2">{style.label}</div>
                                <div className="text-xl font-bold text-red-600">
                                  +{formatNumber(source.subscribersGained)}
                                </div>
                                <div className="text-xs text-gray-600">新訂閱</div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                              {source.videoTitle}
                            </div>
                            <a
                              href={`https://www.youtube.com/watch?v=${source.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#FF3B30] hover:text-[#C92A21] hover:underline inline-flex items-center gap-1"
                            >
                              <span>觀看影片</span>
                              <span>↗</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 其他影片 - 網格顯示 */}
                {subscriberSources.length > 3 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span>其他影片</span>
                      <span className="text-sm text-gray-500">（第 4-{subscriberSources.length} 名）</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {subscriberSources.slice(3).map((source, index) => (
                        <div
                          key={source.videoId}
                          className="flex gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition-all"
                        >
                          {/* 影片縮圖 */}
                          <div className="flex-shrink-0 w-24">
                            <img
                              src={`https://i.ytimg.com/vi/${source.videoId}/mqdefault.jpg`}
                              alt={source.videoTitle}
                              className="w-full aspect-video object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${source.videoId}/default.jpg`;
                              }}
                            />
                          </div>
                          {/* 排名 */}
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center self-start">
                            <span className="text-sm font-bold text-gray-600">{index + 4}</span>
                          </div>
                          {/* 內容 */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                              {source.videoTitle}
                            </div>
                            <a
                              href={`https://www.youtube.com/watch?v=${source.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#FF3B30] hover:text-[#C92A21] hover:underline inline-flex items-center gap-1"
                            >
                              <span>觀看</span>
                              <span>↗</span>
                            </a>
                          </div>
                          {/* 訂閱數 */}
                          <div className="flex-shrink-0 text-right">
                            <div className="text-base font-bold text-gray-700">
                              +{formatNumber(source.subscribersGained)}
                            </div>
                            <div className="text-xs text-gray-500">新訂閱</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 總計卡片 */}
                <div className="mt-6 p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border-2 border-red-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        前 {subscriberSources.length} 支影片總計
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600">
                        +{formatNumber(subscriberSources.reduce((sum, s) => sum + s.subscribersGained, 0))}
                      </div>
                      <div className="text-xs text-gray-600">新訂閱</div>
                    </div>
                  </div>
                </div>
        </div>
      )}

      {/* 提示訊息 */}
      {!channelStats && !isLoading && !error && (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          <div className="w-16 h-16 rounded-full bg-[#F9F9F9] mx-auto mb-4 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-[#606060]" />
          </div>
          <h3 className="text-xl font-medium text-[#030303] mb-2">
            歡迎使用頻道數據儀表板
          </h3>
          <p className="text-[#606060] mb-6 max-w-md mx-auto">
            點擊「刷新數據」按鈕開始查看您的頻道統計資訊
          </p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-3 bg-[#FF0000] text-white rounded-full hover:bg-[#CC0000] inline-flex items-center gap-2 shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            開始載入
          </button>
        </div>
      )}
    </div>
  );
}
