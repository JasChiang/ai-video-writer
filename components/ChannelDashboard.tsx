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
} from 'lucide-react';
import * as youtubeService from '../services/youtubeService';

interface ChannelStats {
  // 頻道總體統計（不受時間範圍影響）
  totalSubscribers: number;
  totalViews: number;

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
  const endDate = new Date(today);
  let startDate = new Date(today);

  switch (range) {
    case '7d':
      startDate.setDate(today.getDate() - 6); // 包含今天共7天
      break;
    case '30d':
      startDate.setDate(today.getDate() - 29); // 包含今天共30天
      break;
    case '90d':
      startDate.setDate(today.getDate() - 89); // 包含今天共90天
      break;
    case 'this_month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1); // 本月第一天
      break;
    case 'last_month':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); // 上月第一天
      endDate.setDate(0); // 上月最後一天
      break;
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
  const cardBaseClass = 'rounded-2xl border border-red-50 bg-white shadow-sm';
  const compactCardClass = `${cardBaseClass} p-5 self-start`;
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

  // 簡報模式狀態
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [currentPresentationPage, setCurrentPresentationPage] = useState(0);
  const [presentationPages, setPresentationPages] = useState<HTMLElement[][]>([]);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const hasHydratedRef = useRef(false);
  const videoCacheRef = useRef<Record<string, any> | null>(null);
  const presentationContainerRef = useRef<HTMLDivElement>(null);
  const contentSectionsRef = useRef<HTMLDivElement>(null);

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

  // URL 參數處理和自動進入簡報模式
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const presentationMode = urlParams.get('mode') === 'presentation';
    const urlStart = urlParams.get('start');
    const urlEnd = urlParams.get('end');

    if (urlStart && urlEnd) {
      setStartDate(urlStart);
      setEndDate(urlEnd);
    }

    if (presentationMode) {
      setTimeout(() => {
        enterPresentationMode();
        if (!channelStats) {
          fetchDashboardData();
        }
      }, 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 監聽全螢幕變化（用戶按 ESC）
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        exitPresentationMode();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPresentationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 鍵盤導航（左右鍵翻頁）
  useEffect(() => {
    if (!isPresentationMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPresentationPage(prev => Math.min(prev + 1, presentationPages.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPresentationPage(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentPresentationPage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentPresentationPage(presentationPages.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPresentationMode, presentationPages.length]);

  // 監聽視窗大小變化，重新計算分頁
  useEffect(() => {
    if (!isPresentationMode) return;

    const handleResize = () => {
      calculatePresentationPages();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPresentationMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const getDateRange = (): { startDate: Date; endDate: Date } => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log('[Dashboard] 📅 日期範圍解析:', {
      原始字串: { startDate, endDate },
      解析後: {
        start: start.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        end: end.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      }
    });

    return { startDate: start, endDate: end };
  };

  // 智能分頁：根據螢幕高度自動分配區塊到不同頁面
  const calculatePresentationPages = () => {
    if (!contentSectionsRef.current) return;

    const sections = Array.from(contentSectionsRef.current.querySelectorAll('.dashboard-section')) as HTMLElement[];
    if (sections.length === 0) return;

    const pageHeight = window.innerHeight - 200; // 預留導航欄和邊距
    const pages: HTMLElement[][] = [];
    let currentPage: HTMLElement[] = [];
    let currentPageHeight = 0;

    sections.forEach((section) => {
      const sectionHeight = section.offsetHeight + 24; // 加上 gap

      // 如果當前頁面加上這個區塊會超過高度，且當前頁已有內容，則開新頁
      if (currentPageHeight + sectionHeight > pageHeight && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [section];
        currentPageHeight = sectionHeight;
      } else {
        currentPage.push(section);
        currentPageHeight += sectionHeight;
      }
    });

    // 加入最後一頁
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    setPresentationPages(pages);
    console.log(`[Presentation] 已計算分頁：共 ${pages.length} 頁`);
  };

  // 進入全螢幕簡報模式
  const enterPresentationMode = async () => {
    try {
      if (presentationContainerRef.current) {
        await presentationContainerRef.current.requestFullscreen();
        setIsPresentationMode(true);
        setCurrentPresentationPage(0);

        // 等待 DOM 更新後計算分頁
        setTimeout(() => {
          calculatePresentationPages();
        }, 100);

        // 更新 URL
        const url = new URL(window.location.href);
        url.searchParams.set('mode', 'presentation');
        url.searchParams.set('start', startDate);
        url.searchParams.set('end', endDate);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err) {
      console.error('無法進入全螢幕模式:', err);
      // 降級方案：不全螢幕但啟用簡報模式
      setIsPresentationMode(true);
      setCurrentPresentationPage(0);
      setTimeout(() => {
        calculatePresentationPages();
      }, 100);
    }
  };

  // 退出簡報模式
  const exitPresentationMode = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('退出全螢幕失敗:', err);
    }

    setIsPresentationMode(false);
    setCurrentPresentationPage(0);
    setPresentationPages([]);

    // 移除 URL 參數
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    url.searchParams.delete('start');
    url.searchParams.delete('end');
    window.history.replaceState({}, '', url.toString());
  };

  // 獲取儀錶板數據
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = youtubeService.getAccessToken();
      if (!token) {
        throw new Error('未登入 YouTube');
      }

      const { startDate, endDate } = getDateRange();

      // 策略 1: 頻道總體資料 - 使用 YouTube Data API
      await fetchChannelStats(token);

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
          viewsInRange: views,
          watchTimeHours: watchTimeHours,
          subscribersGained: subscribersNet, // 使用淨增長（新增 - 取消）
          videosInRange: 0, // 頻道級別數據不包含影片數
        }));

        // 處理影片級別數據（熱門影片）
        if (videoAnalytics && videoAnalytics.rows && videoAnalytics.rows.length > 0) {
          await fetchTopVideosFromAnalytics(videoAnalytics.rows);
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

  // 處理 Analytics API 數據
  const processAnalyticsData = async (analyticsData: any, startDate: Date, endDate: Date) => {
    try {
      // Analytics API 返回格式：
      // rows: [[videoId, views, estimatedMinutesWatched, subscribersGained], ...]
      const totalViews = analyticsData.rows.reduce(
        (sum: number, row: any[]) => sum + (parseInt(row[1]) || 0),
        0
      );

      const totalWatchTimeMinutes = analyticsData.rows.reduce(
        (sum: number, row: any[]) => sum + (parseInt(row[2]) || 0),
        0
      );

      const totalSubscribersGained = analyticsData.rows.reduce(
        (sum: number, row: any[]) => sum + (parseInt(row[3]) || 0),
        0
      );

      const watchTimeHours = Math.floor(totalWatchTimeMinutes / 60);

      console.log('[Dashboard] 📊 Analytics 統計:', {
        totalViews,
        watchTimeHours,
        subscribersGained: totalSubscribersGained,
        videosCount: analyticsData.rows.length,
      });

      // 更新統計數據
      setChannelStats((prev) => ({
        totalSubscribers: prev?.totalSubscribers || 0,
        totalViews: prev?.totalViews || 0,
        viewsInRange: totalViews,
        watchTimeHours: watchTimeHours,
        subscribersGained: totalSubscribersGained,
        videosInRange: analyticsData.rows.length,
      }));

      // 獲取熱門影片詳情（需要從 Gist 快取獲取標題和縮圖）
      await fetchTopVideosFromAnalytics(analyticsData.rows);
    } catch (err) {
      console.error('[Dashboard] ❌ 處理 Analytics 數據失敗:', err);
      throw err;
    }
  };

  // 從 Analytics 結果獲取熱門影片
  const fetchTopVideosFromAnalytics = async (analyticsRows: any[]) => {
    try {
      // Analytics rows: [videoId, views, watchTime, subs]
      const topVideoIds = analyticsRows.slice(0, 10).map((row: any[]) => row[0]);

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      const topVideosWithDetails = analyticsRows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const shares = parseInt(row[3]) || 0;
        const comments = parseInt(row[4]) || 0;
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `影片 ${videoId}`,
          viewCount: views, // Analytics API 的觀看數（時間範圍內）
          likeCount: video?.likeCount || 0,
          commentCount: comments || video?.commentCount || 0,
          avgViewPercentage: avgViewPercent,
          shareCount: shares || 0,
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
        };
      });

      console.log(`[Dashboard] 🏆 Analytics 熱門影片: ${topVideosWithDetails.length} 支`);
      setTopVideos(topVideosWithDetails);
    } catch (err) {
      console.error('[Dashboard] ⚠️  獲取熱門影片詳情失敗:', err);
    }
  };

  // 策略 1: 獲取頻道等級統計（使用 OAuth + YouTube Data API）
  // 配額成本: 1 單位（channels.list with part=statistics）
  // 注意：這些是頻道總體統計，不受時間範圍影響
  const fetchChannelStats = async (token: string) => {
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

      console.log('[Dashboard] ✅ 頻道統計獲取成功:', {
        totalSubscribers: stats.subscriberCount,
        totalViews: stats.viewCount,
      });

      // 只設置頻道總體統計，時間範圍內的統計由 fetchVideosInRange 設置
      setChannelStats((prev) => ({
        totalSubscribers: parseInt(stats.subscriberCount || '0'),
        totalViews: parseInt(stats.viewCount || '0'),
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
      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formattedStartDate}` +
        `&endDate=${formattedEndDate}` +
        `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Dashboard] ❌ Analytics API 錯誤:', errorData);
        throw new Error('Analytics API 無權限或錯誤');
      }

      const data = await response.json();
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
      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&metrics=views,averageViewPercentage,shares,comments` +
        `&dimensions=video` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('無法獲取影片數據');
      }

      const data = await response.json();
      console.log('[Dashboard] ✅ 影片級別數據獲取成功');
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

      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&dimensions=video` +
        `&filters=creatorContentType==shorts` +
        `&metrics=views,averageViewPercentage,shares,comments` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('無法獲取 Shorts 數據');
      }

      const data = await response.json();

      if (!data.rows || data.rows.length === 0) {
        console.log('[Dashboard] ℹ️ 時間範圍內沒有 Shorts 數據');
        setTopShorts([]);
        return;
      }

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      const topShortsWithDetails = data.rows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const shares = parseInt(row[3]) || 0;
        const comments = parseInt(row[4]) || 0;
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `Shorts ${videoId}`,
          viewCount: views,
          likeCount: video?.likeCount || 0,
          commentCount: comments || video?.commentCount || 0,
          avgViewPercentage: avgViewPercent,
          shareCount: shares || 0,
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
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

      const response = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE` +
        `&startDate=${formatDate(startDate)}` +
        `&endDate=${formatDate(endDate)}` +
        `&dimensions=video` +
        `&filters=creatorContentType==VideoOnDemand` +
        `&metrics=views,averageViewPercentage,shares,comments` +
        `&sort=-views` +
        `&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('無法獲取一般影片數據');
      }

      const data = await response.json();

      if (!data.rows || data.rows.length === 0) {
        console.log('[Dashboard] ℹ️ 時間範圍內沒有一般影片數據');
        setTopRegularVideos([]);
        return;
      }

      // 從快取獲取影片詳情（使用統一的快取機制，只讀取一次）
      const cache = await ensureVideoCache();
      const allVideos = Object.values(cache);

      // 匹配影片詳情
      const topRegularVideosWithDetails = data.rows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const avgViewPercent = parseFloat(row[2]) || 0;
        const shares = parseInt(row[3]) || 0;
        const comments = parseInt(row[4]) || 0;
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `影片 ${videoId}`,
          viewCount: views,
          likeCount: video?.likeCount || 0,
          commentCount: comments || video?.commentCount || 0,
          avgViewPercentage: avgViewPercent,
          shareCount: shares || 0,
          publishedAt: video?.publishedAt || '',
          thumbnailUrl: video?.thumbnail || video?.thumbnailUrl || '',
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

      // 計算當前期間的天數
      const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // 計算前一期（環比）的日期範圍
      const previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - daysDiff + 1);

      // 計算去年同期（同比）的日期範圍
      const yearAgoStart = new Date(currentStart);
      yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
      const yearAgoEnd = new Date(currentEnd);
      yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);

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
        const publishDate = new Date(v.publishedAt);
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
        viewsInRange: totalViews,
        watchTimeHours: watchTimeHours,
        subscribersGained: 0, // 需要 Analytics API
        videosInRange: videosInRange.length,
      }));

      // 按觀看次數排序並取前 10 名（從時間範圍內的影片）
      const topVideosInRange = videosInRange
        .filter((v: any) => v.viewCount && parseInt(v.viewCount) > 0)
        .sort((a: any, b: any) => parseInt(b.viewCount) - parseInt(a.viewCount))
        .slice(0, 10)
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
            const topVideoResponse = await fetch(
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

            if (!topVideoResponse.ok) {
              console.warn('[Dashboard] ⚠️ 單日熱門影片 API 失敗:', date);
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
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) {
      return null;
    }

    const daysDiff =
      Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - daysDiff + 1);

    const yearAgoStart = new Date(currentStart);
    yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
    const yearAgoEnd = new Date(currentEnd);
    yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);

    return {
      previous: `${formatDateString(previousStart)} ~ ${formatDateString(previousEnd)}`,
      yearAgo: `${formatDateString(yearAgoStart)} ~ ${formatDateString(yearAgoEnd)}`,
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
    <div
      ref={presentationContainerRef}
      className={isPresentationMode ? 'fixed inset-0 bg-white flex flex-col overflow-hidden' : ''}
    >
      {/* 簡報模式導航欄 */}
      {isPresentationMode && presentationPages.length > 0 && (
        <div className="flex items-center justify-between px-8 py-4 border-b border-red-100 bg-red-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500 text-white flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">頻道數據儀表板</h2>
              <p className="text-xs text-gray-600">{startDate} 至 {endDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 頁面指示器 */}
            <div className="flex items-center gap-2">
              {presentationPages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPresentationPage(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentPresentationPage
                      ? 'w-8 bg-red-600'
                      : 'w-2 bg-red-200 hover:bg-red-300'
                  }`}
                />
              ))}
            </div>

            <span className="text-sm font-semibold text-gray-600">
              {currentPresentationPage + 1} / {presentationPages.length}
            </span>

            {/* 導航按鈕 */}
            <button
              onClick={() => setCurrentPresentationPage(prev => Math.max(prev - 1, 0))}
              disabled={currentPresentationPage === 0}
              className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentPresentationPage(prev => Math.min(prev + 1, presentationPages.length - 1))}
              disabled={currentPresentationPage === presentationPages.length - 1}
              className="p-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={exitPresentationMode}
              className="px-4 py-2 rounded-lg bg-gray-600 text-white text-sm font-semibold hover:bg-gray-700"
            >
              退出簡報
            </button>
          </div>
        </div>
      )}

      {/* 內容區域 */}
      <div
        ref={contentSectionsRef}
        className={isPresentationMode ? 'flex-1 overflow-y-auto px-8 py-6' : 'space-y-6'}
        style={isPresentationMode && presentationPages.length > 0 ? {
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        } : undefined}
      >
      {/* 標題區域 */}
      <div className={`rounded-2xl border border-red-100 bg-white shadow-md p-5 lg:p-6 ${isPresentationMode ? 'dashboard-section' : ''}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">
                  YouTube Insights
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  頻道數據儀表板
                </h2>
              </div>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              紅白質感介面，快速檢視整體表現、成長趨勢與熱門影片，一眼掌握 YouTube 成效。
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full lg:w-auto">
            {/* 快速篩選器 */}
            <div className="flex flex-wrap gap-1.5 justify-start lg:justify-end">
              {QUICK_DATE_PRESETS.map((item) => {
                const range = getQuickDateRange(item.value);
                const isActive = startDate === range.start && endDate === range.end;

                return (
                  <button
                    key={item.value}
                    onClick={() => {
                      setStartDate(range.start);
                      setEndDate(range.end);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all shadow-sm ${
                      isActive
                        ? 'bg-red-600 text-white border-red-600 shadow-red-200'
                        : 'bg-white text-gray-600 border-red-100 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {/* 日期範圍選擇器 */}
              <div className="flex items-center gap-2 px-3 py-2 border border-red-100 rounded-xl bg-white shadow-inner">
                <Calendar className="w-4 h-4 text-red-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="focus:outline-none text-sm text-gray-700"
                />
                <span className="text-gray-400">至</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="focus:outline-none text-sm text-gray-700"
                />
              </div>

              {/* 刷新按鈕 */}
              <button
                onClick={fetchDashboardData}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200 disabled:text-white/80 disabled:shadow-none"
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

              {/* 簡報模式按鈕 */}
              <button
                onClick={isPresentationMode ? exitPresentationMode : enterPresentationMode}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold shadow-lg transition-colors ${
                  isPresentationMode
                    ? 'bg-gray-600 text-white shadow-gray-200 hover:bg-gray-700'
                    : 'bg-white text-red-600 border border-red-200 shadow-red-100 hover:bg-red-50'
                }`}
              >
                <Monitor className="w-4 h-4" />
                {isPresentationMode ? '退出簡報' : '簡報模式'}
              </button>

              {/* 分享連結按鈕（簡報模式下顯示） */}
              {isPresentationMode && (
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('mode', 'presentation');
                    url.searchParams.set('start', startDate);
                    url.searchParams.set('end', endDate);
                    navigator.clipboard.writeText(url.toString());
                    setShowCopiedToast(true);
                    setTimeout(() => setShowCopiedToast(false), 2000);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-green-200 transition-colors hover:bg-green-700"
                >
                  <Share2 className="w-4 h-4" />
                  分享連結
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 數據來源說明（可摺疊）*/}
      <div className="rounded-2xl border border-red-100 bg-red-50/80 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowDataSourceInfo(!showDataSourceInfo)}
          className="w-full p-4 flex items-center justify-between hover:bg-red-100/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-500" />
            <strong className="text-sm text-red-900">數據來源說明</strong>
          </div>
          <svg
            className={`w-5 h-5 text-red-500 transition-transform ${showDataSourceInfo ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDataSourceInfo && (
          <div className="px-4 pb-4">
            <ul className="space-y-1 text-sm text-red-900">
              <li>
                • <strong>時區</strong>：所有數據使用<strong>台灣時間（UTC+8）</strong>，與 YouTube Studio 後台一致
              </li>
              <li>
                • <strong>觀看次數 & 觀看時間</strong>：所選時間範圍內<strong>實際產生</strong>的觀看數據
                （YouTube Analytics API，配額：1-2 單位）
              </li>
              <li>
                • <strong>新增訂閱數</strong>：時間範圍內淨增長（新增訂閱 - 取消訂閱）
              </li>
              <li>
                • <strong>熱門影片</strong>：基於時間範圍內的觀看次數排序（Analytics API + Gist 快取）
              </li>
              <li className="text-red-600 font-medium">
                ✅ 這是真實的時間段內數據，非累計數據
              </li>
              <li className="text-xs text-gray-600 mt-2">
                如果 Analytics API 不可用，會自動回退到 Gist 快取方案（顯示發布影片的累計數據）
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 shadow-inner">
          {error}
        </div>
      )}

      {/* KPI 指標卡片（可點擊切換圖表）*/}
      {channelStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 觀看次數（時間範圍內）*/}
          <button
            onClick={() => setSelectedMetric('views')}
            className={`${cardBaseClass} p-5 text-left transition-all ${
              selectedMetric === 'views'
                ? 'border-red-500 bg-gradient-to-b from-red-50 to-white shadow-lg shadow-red-100'
                : 'hover:border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-gray-500 text-sm font-semibold tracking-wide">觀看次數</div>
              <Eye className={`w-5 h-5 ${selectedMetric === 'views' ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div className="text-[32px] font-bold text-gray-900 leading-tight">
              {formatNumber(channelStats.viewsInRange)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatFullNumber(channelStats.viewsInRange)} 次觀看
            </div>
            {viewsComparison && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.previous}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${viewsComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {viewsComparison.changeFromPrevious >= 0 ? '+' : ''}{viewsComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.yearAgo}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${viewsComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {viewsComparison.changeFromYearAgo >= 0 ? '+' : ''}{viewsComparison.changeFromYearAgoPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {error?.includes('Analytics API')
                ? '時間範圍內發布影片的累計數（備援模式）'
                : '時間範圍內實際產生的觀看數'}
            </div>
          </button>

          {/* 觀看時間（小時）*/}
          <button
            onClick={() => setSelectedMetric('watchTime')}
            className={`${cardBaseClass} p-5 text-left transition-all ${
              selectedMetric === 'watchTime'
                ? 'border-red-500 bg-gradient-to-b from-red-50 to-white shadow-lg shadow-red-100'
                : 'hover:border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-gray-500 text-sm font-semibold tracking-wide">觀看時間</div>
              <Clock className={`w-5 h-5 ${selectedMetric === 'watchTime' ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div className="text-[32px] font-bold text-gray-900 leading-tight">
              {formatNumber(channelStats.watchTimeHours)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatFullNumber(channelStats.watchTimeHours)} 小時
            </div>
            {watchTimeComparison && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.previous}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${watchTimeComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {watchTimeComparison.changeFromPrevious >= 0 ? '+' : ''}{watchTimeComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.yearAgo}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${watchTimeComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {watchTimeComparison.changeFromYearAgo >= 0 ? '+' : ''}{watchTimeComparison.changeFromYearAgoPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {error?.includes('Analytics API')
                ? '估算值（基於平均觀看時長）'
                : '時間範圍內實際觀看時長'}
            </div>
          </button>

          {/* 新增訂閱數 */}
          <button
            onClick={() => setSelectedMetric('subscribers')}
            className={`${cardBaseClass} p-5 text-left transition-all ${
              selectedMetric === 'subscribers'
                ? 'border-red-500 bg-gradient-to-b from-red-50 to-white shadow-lg shadow-red-100'
                : 'hover:border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-gray-500 text-sm font-semibold tracking-wide">新增訂閱數</div>
              <Users className={`w-5 h-5 ${selectedMetric === 'subscribers' ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div className="text-[32px] font-bold text-gray-900 leading-tight">
              {formatNumber(channelStats.subscribersGained)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {channelStats.subscribersGained >= 0 ? '+' : ''}{formatFullNumber(channelStats.subscribersGained)} 位訂閱者
            </div>
            {subscribersComparison && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較前期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.previous}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${subscribersComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {subscribersComparison.changeFromPrevious >= 0 ? '+' : ''}{subscribersComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-gray-500 leading-tight">
                    <div>較去年同期</div>
                    {comparisonDateRanges && (
                      <div className="text-[10px] text-gray-400">{comparisonDateRanges.yearAgo}</div>
                    )}
                  </div>
                  <span className={`ml-2 font-semibold ${subscribersComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {subscribersComparison.changeFromYearAgo >= 0 ? '+' : ''}{subscribersComparison.changeFromYearAgoPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {error?.includes('Analytics API')
                ? '無法獲取（需要 Analytics API）'
                : '時間範圍內新增訂閱數'}
            </div>
          </button>

          {/* 觀看指標（平均時長 + 完成度）*/}
          <div className={`${cardBaseClass} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-500 text-sm font-semibold tracking-wide">觀看指標</div>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>

            {/* 平均觀看時長 */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-1">平均觀看時長</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.floor(avgViewDuration / 60)}:{String(avgViewDuration % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {avgViewDuration} 秒
              </div>
            </div>

            {/* 平均觀看百分比 */}
            <div>
              <div className="text-xs text-gray-500 mb-1">平均完成度</div>
              <div className="text-2xl font-bold text-gray-900">
                {avgViewPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                觀眾平均看完比例
              </div>
            </div>

            <div className="text-xs text-gray-400 mt-2">
              {error?.includes('Analytics API')
                ? '無法獲取（需要 Analytics API）'
                : '觀眾參與度指標'}
            </div>
          </div>
        </div>
      )}

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
                  <div className="relative w-full h-48">
                    <svg
                      viewBox="0 0 600 160"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full"
                    >
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#fee2e2" stopOpacity="0.2" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={trendChartPoints}
                      />
                      <polygon
                        fill="url(#trendGradient)"
                        opacity="0.6"
                        points={`${trendChartPoints} 600,160 0,160`}
                      />
                    </svg>
                    <div className="absolute inset-0 pointer-events-none">
                      {trendChartCoordinates.map((coord, idx) => (
                        <div
                          key={`${coord.date}-${idx}`}
                          className="absolute"
                          style={{
                            left: `${coord.xPercent}%`,
                            top: `${coord.yPercent}%`,
                          }}
                        >
                          <div className="relative -translate-x-1/2 -translate-y-1/2 pointer-events-auto group">
                            <span className="block w-3 h-3 rounded-full border-2 border-white bg-red-500 shadow"></span>
                            <div className="pointer-events-none absolute left-1/2 top-0 mt-3 -translate-x-1/2 transform opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-full z-20">
                              <div className="pointer-events-auto w-56 rounded-xl border border-red-100 bg-white p-3 shadow-xl">
                                <div className="text-xs text-gray-500">
                                  {formatDate(coord.date)} · {formatFullNumber(coord.views)} 次觀看
                                </div>
                                {coord.topVideo ? (
                                  <div className="mt-2 flex items-start gap-3">
                                    <a
                                      href={`${YT_VIDEO_BASE_URL}${coord.topVideo.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block w-20 h-12 overflow-hidden rounded-lg border border-gray-100 shadow-sm shrink-0"
                                    >
                                      {coord.topVideo.thumbnailUrl ? (
                                        <img
                                          src={coord.topVideo.thumbnailUrl}
                                          alt={coord.topVideo.title}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                          無縮圖
                                        </div>
                                      )}
                                    </a>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                                        {coord.topVideo.title}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        單日觀看 {formatFullNumber(coord.topVideo.views)} 次
                                      </p>
                                      <a
                                        href={`${YT_VIDEO_BASE_URL}${coord.topVideo.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-xs text-red-600 font-semibold mt-1 hover:underline"
                                      >
                                        觀看影片 →
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 mt-2">
                                    找不到當日熱門影片，請稍後重試。
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
            {/* 柱狀圖 */}
            <div className="mt-6">
              <div className="flex items-end justify-between gap-1 h-64 border-b border-l border-red-100 pb-2 pl-2">
                {monthlyData.map((dataPoint, index) => {
                  // 根據選擇的指標獲取值
                  let value = 0;
                  let color = '';
                  let currentColor = '';
                  switch (selectedMetric) {
                    case 'views':
                      value = dataPoint.views;
                      color = 'bg-red-500 hover:bg-red-600';
                      currentColor = 'bg-red-200 hover:bg-red-300 border border-dashed border-red-500';
                      break;
                    case 'watchTime':
                      value = dataPoint.watchTimeHours;
                      color = 'bg-rose-400 hover:bg-rose-500';
                      currentColor = 'bg-rose-200 hover:bg-rose-300 border border-dashed border-rose-500';
                      break;
                    case 'subscribers':
                      value = dataPoint.subscribersNet; // 使用淨增長（新增 - 取消）
                      color = value >= 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 hover:bg-gray-400';
                      currentColor =
                        value >= 0
                          ? 'bg-red-200 hover:bg-red-400 border border-dashed border-red-500'
                          : 'bg-gray-200 hover:bg-gray-300 border border-dashed border-gray-400';
                      break;
                  }
                  const barClass = dataPoint.isCurrentMonth ? currentColor : color;

                  // 計算最大值用於比例
                  const maxValue = Math.max(
                    ...monthlyData.map(d => {
                      switch (selectedMetric) {
                        case 'views': return d.views;
                        case 'watchTime': return d.watchTimeHours;
                        case 'subscribers': return Math.abs(d.subscribersNet); // 使用淨增長
                        default: return 0;
                      }
                    })
                  );

                  // 計算高度百分比（最小 5%，最大 100%）
                  const heightPercent = maxValue > 0 ? Math.max(5, (Math.abs(value) / maxValue) * 100) : 5;

                  // 調試日誌（只在第一個月份打印）
                  if (index === 0) {
                    console.log('[Dashboard] 📊 柱狀圖渲染:', {
                      selectedMetric,
                      monthlyDataCount: monthlyData.length,
                      firstDataPoint: dataPoint,
                      value,
                      maxValue,
                      heightPercent,
                      color
                    });
                  }

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group" style={{ height: '100%' }}>
                      {/* 柱子區域 */}
                      <div className="relative w-full flex-1 flex items-end justify-center">
                        {/* 數值標籤（始終顯示）*/}
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700 whitespace-nowrap">
                          {formatFullNumber(value)}
                        </div>

                        {/* 柱狀條 */}
                        <div className="flex items-end justify-center w-full" style={{ height: '100%' }}>
                          <div
                            className={`w-5 sm:w-6 ${barClass} rounded-t-full transition-all duration-300 cursor-pointer hover:opacity-80`}
                            style={{
                              height: `${heightPercent}%`
                            }}
                            title={`${dataPoint.month}${dataPoint.isCurrentMonth ? ' (至今)' : ''}: ${formatFullNumber(value)}`}
                          />
                        </div>
                      </div>

                      {/* 月份標籤（水平顯示）*/}
                      <div className="text-xs text-gray-600 mt-2 whitespace-nowrap">
                        {dataPoint.isCurrentMonth ? `${dataPoint.month} (至今)` : dataPoint.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {monthlyMeta.hasCurrent && (
              <p className="text-xs text-gray-500 mt-3 text-right">
                本月至今資料更新至 {todayLabel}，數值尚未滿整月。
              </p>
            )}
          </>
        )}
      </div>

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
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              熱門影片 (Top 10)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              時間範圍內表現最佳的影片（按總觀看數排序）
            </p>
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
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {sortedTopVideos.map((video, index) => {
                const metricConfig = topVideoMetricConfig[topVideoMetric];
                const metricValue = metricConfig.value(video);
                const metricDisplay = metricConfig.formatter(metricValue);
                const MetricIcon = metricConfig.icon;

                return (
                  <div
                    key={video.id}
                    className="p-2 rounded-lg border border-red-100 hover:border-red-200 hover:bg-red-50/70 transition-colors flex flex-col items-center text-center gap-2 h-full"
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
                        className="w-full max-w-[150px] aspect-video object-cover rounded-lg shadow-sm"
                      />
                      <div className="mt-1 inline-flex items-center justify-center gap-1 text-sm text-red-600 w-full max-w-[150px] truncate">
                        <MetricIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="font-semibold truncate">{metricDisplay}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">{metricConfig.label}</div>
                    </div>

                    {/* 影片標題 */}
                    <h4 className="text-[13px] font-medium text-gray-900 line-clamp-2 w-full">
                      {video.title}
                    </h4>

                    {/* 互動數據 */}
                    <div className="w-full flex items-center justify-center gap-2 text-xs font-semibold whitespace-nowrap">
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 並排顯示：Shorts 和一般影片排行榜 */}
      {(topShorts.length > 0 || topRegularVideos.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 熱門 Shorts 排行榜 */}
          {topShorts.length > 0 && (
            <div className={`${cardBaseClass} h-full flex flex-col`}>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  熱門 Shorts 排行榜
                </h3>
                <p className="text-sm text-gray-500 mb-4">時間範圍內表現最佳的 Shorts 短影片（按觀看次數排序）</p>

                <div className="grid grid-cols-3 gap-3 flex-1 content-start">
                  {topShorts.map((video, index) => (
                    <div
                      key={video.id}
                      className="p-3 rounded-lg border border-red-100 hover:border-red-200 hover:bg-red-50/70 transition-colors flex flex-col items-center text-center gap-3 h-full"
                    >
                      {/* 排名 */}
                      <div className="self-start text-xs font-semibold text-red-500 flex items-center gap-1">
                        <span className="text-sm">#{index + 1}</span>
                        <span className="text-[11px] text-gray-400">Shorts</span>
                      </div>

                      {/* 縮圖與觀看次數 */}
                      <div className="flex flex-col items-center w-full">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full aspect-[9/16] object-cover rounded-lg shadow-sm"
                        />
                        <div className="mt-2 inline-flex items-center justify-center gap-1 text-sm text-red-600 w-full truncate">
                          <Eye className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="font-semibold truncate">
                            {formatFullNumber(video.viewCount)}
                          </span>
                        </div>
                      </div>

                      {/* 影片標題 */}
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 w-full leading-relaxed">
                        {video.title}
                      </h4>

                      {/* 互動數據 */}
                      <div className="w-full flex items-center justify-center gap-3 text-xs font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <ThumbsUp className="w-4 h-4 shrink-0" />
                          {formatFullNumber(video.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <MessageSquare className="w-4 h-4 shrink-0" />
                          {formatFullNumber(video.commentCount)}
                        </span>
                        {video.avgViewPercentage > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <BarChart3 className="w-4 h-4 shrink-0" />
                            {video.avgViewPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 熱門一般影片排行榜 */}
          {topRegularVideos.length > 0 && (
            <div className={`${cardBaseClass} h-full flex flex-col`}>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  熱門一般影片排行榜
                </h3>
                <p className="text-sm text-gray-500 mb-4">時間範圍內表現最佳的一般影片（按觀看次數排序）</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 flex-1 content-start">
                  {topRegularVideos.map((video, index) => (
                    <div
                      key={video.id}
                      className="p-3 rounded-lg border border-amber-100 hover:border-amber-200 hover:bg-amber-50/70 transition-colors flex flex-col items-center text-center gap-3 h-full"
                    >
                      {/* 排名 */}
                      <div className="self-start text-xs font-semibold text-amber-500 flex items-center gap-1">
                        <span className="text-sm">#{index + 1}</span>
                        <span className="text-[11px] text-gray-400">影片</span>
                      </div>

                      {/* 縮圖與觀看次數 */}
                      <div className="flex flex-col items-center w-full">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full aspect-video object-cover rounded-lg shadow-sm"
                        />
                        <div className="mt-2 inline-flex items-center justify-center gap-1 text-sm text-amber-600 w-full truncate">
                          <Eye className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="font-semibold truncate">
                            {formatFullNumber(video.viewCount)}
                          </span>
                        </div>
                      </div>

                      {/* 影片標題 */}
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 w-full leading-relaxed">
                        {video.title}
                      </h4>

                      {/* 互動數據 */}
                      <div className="w-full flex items-center justify-center gap-3 text-xs font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <ThumbsUp className="w-4 h-4 shrink-0" />
                          {formatFullNumber(video.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <MessageSquare className="w-4 h-4 shrink-0" />
                          {formatFullNumber(video.commentCount)}
                        </span>
                        {video.avgViewPercentage > 0 && (
                          <span className="inline-flex items-center gap-1 text-orange-600">
                            <BarChart3 className="w-4 h-4 shrink-0" />
                            {video.avgViewPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
              {/* 甜甜圈圖 */}
              <div className="relative w-48 h-48 mb-6">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: `conic-gradient(${trafficSources
                      .map((source, index) => {
                        const colors = ['#dc2626', '#ef4444', '#f87171', '#fb923c', '#fbbf24'];
                        const color = colors[index % colors.length];
                        const start = trafficSources
                          .slice(0, index)
                          .reduce((sum, s) => sum + s.percentage, 0);
                        const end = start + source.percentage;
                        return `${color} ${start}% ${end}%`;
                      })
                      .join(', ')})`,
                  }}
                />
                {/* 中心白色圓圈 */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {trafficSources.reduce((sum, s) => sum + s.views, 0) > 0
                        ? formatNumber(trafficSources.reduce((sum, s) => sum + s.views, 0))
                        : '0'}
                    </div>
                    <div className="text-xs text-gray-500">總觀看</div>
                  </div>
                </div>
              </div>

              {/* 圖例 */}
              <div className="w-full space-y-2">
                {trafficSources.map((source, index) => {
                  const colors = [
                    { bg: 'bg-red-600', dot: 'bg-red-600' },
                    { bg: 'bg-red-500', dot: 'bg-red-500' },
                    { bg: 'bg-red-400', dot: 'bg-red-400' },
                    { bg: 'bg-orange-400', dot: 'bg-orange-400' },
                    { bg: 'bg-amber-400', dot: 'bg-amber-400' },
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <div key={index} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-3 h-3 rounded-full ${color.dot}`} />
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
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm text-gray-600">男性</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-pink-500 rounded"></div>
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
                                  className="bg-blue-500 h-full transition-all duration-500"
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
                                  className="bg-pink-500 h-full transition-all duration-500"
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

                {/* 橫向柱狀圖 */}
                <div className="space-y-4">
                  {devices.map((device, index) => {
                    // 翻譯裝置類型
                    const deviceNames: { [key: string]: string } = {
                      DESKTOP: '桌面電腦',
                      MOBILE: '手機',
                      TABLET: '平板',
                      TV: '電視',
                      GAME_CONSOLE: '遊戲主機',
                    };
                    const deviceName = deviceNames[device.deviceType] || device.deviceType;

                    // 裝置圖示
                    const DeviceIcon = (() => {
                      switch (device.deviceType) {
                        case 'DESKTOP': return Monitor;
                        case 'MOBILE': return Smartphone;
                        case 'TABLET': return Tablet;
                        case 'TV': return Tv;
                        case 'GAME_CONSOLE': return Gamepad2;
                        default: return Smartphone;
                      }
                    })();

                    // 顏色
                    const colors = [
                      '#dc2626', // red-600
                      '#f59e0b', // amber-500
                      '#8b5cf6', // violet-500
                      '#06b6d4', // cyan-500
                      '#ec4899', // pink-500
                    ];
                    const color = colors[index % colors.length];

                    const maxViews = Math.max(...devices.map(d => d.views));
                    const barWidth = (device.views / maxViews) * 100;

                    return (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <DeviceIcon className="w-5 h-5" style={{ color }} />
                            <span className="font-medium text-gray-700">
                              {deviceName}
                            </span>
                          </div>
                          <span className="text-gray-900 font-semibold whitespace-nowrap">
                            {formatFullNumber(device.views)} 次
                          </span>
                        </div>
                        <div className="relative">
                          <div className="w-full bg-gray-100 rounded-full h-7 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: color,
                              }}
                            >
                              <span className="text-sm font-semibold text-white">
                                {device.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 總計 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
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
                              className="text-xs text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
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
                              className="text-xs text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
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
        <div className="rounded-2xl border border-red-100 bg-red-50/80 p-8 text-center shadow-sm">
          <BarChart3 className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            歡迎使用頻道數據儀表板
          </h3>
          <p className="text-gray-600 mb-4">
            點擊「刷新數據」按鈕開始查看您的頻道統計資訊
          </p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 inline-flex items-center gap-2 shadow-md shadow-red-200"
          >
            <RefreshCw className="w-4 h-4" />
            開始載入
          </button>
        </div>
      )}

      {/* 複製成功提示 Toast */}
      {showCopiedToast && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50">
          <Share2 className="w-5 h-5" />
          <span className="font-semibold">已複製分享連結！</span>
        </div>
      )}
      </div>
    </div>
  );
}
