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

import React, { useState, useEffect } from 'react';
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
  publishedAt: string;
  thumbnailUrl: string;
}

interface TrendDataPoint {
  date: string;
  views: number;
  subscribers: number;
}

interface MonthlyDataPoint {
  month: string;           // 格式: YYYY-MM
  views: number;
  watchTimeHours: number;
  subscribersGained: number;  // 新增訂閱
  subscribersLost: number;    // 取消訂閱
  subscribersNet: number;     // 淨增長 = subscribersGained - subscribersLost
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

type ChartMetric = 'views' | 'watchTime' | 'subscribers';
type QuickDateRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

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
  const [subscriberSources, setSubscriberSources] = useState<SubscriberSourceItem[]>([]);
  const [avgViewDuration, setAvgViewDuration] = useState<number>(0);
  const [avgViewPercentage, setAvgViewPercentage] = useState<number>(0);
  const [viewsComparison, setViewsComparison] = useState<ComparisonData | null>(null);
  const [watchTimeComparison, setWatchTimeComparison] = useState<ComparisonData | null>(null);
  const [subscribersComparison, setSubscribersComparison] = useState<ComparisonData | null>(null);

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
      } else {
        // Analytics API 不可用，回退到 Gist 快取方案
        console.log('[Dashboard] ℹ️  回退到 Gist 快取方案');
        setError(
          '⚠️ YouTube Analytics API 不可用。' +
          '顯示的是時間範圍內發布影片的累計數據，而非該時間段內產生的觀看數。' +
          '如需真實時間段數據，請在 Google Cloud Console 啟用 YouTube Analytics API。'
        );
        await fetchVideosInRange(startDate, endDate);
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

      // 從 Gist 快取獲取影片詳情
      const cacheResponse = await fetch(
        `${API_BASE_URL}/video-cache/search?query=&maxResults=10000`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!cacheResponse.ok) {
        throw new Error('無法獲取影片快取');
      }

      const cacheData = await cacheResponse.json();
      const allVideos = cacheData.videos || [];

      // 匹配影片詳情
      const topVideosWithDetails = analyticsRows.slice(0, 10).map((row: any[]) => {
        const videoId = row[0];
        const views = parseInt(row[1]) || 0;
        const video = allVideos.find((v: any) => v.videoId === videoId || v.id === videoId);

        return {
          id: videoId,
          title: video?.title || `影片 ${videoId}`,
          viewCount: views, // Analytics API 的觀看數（時間範圍內）
          likeCount: video?.likeCount || 0,
          commentCount: video?.commentCount || 0,
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
        `&metrics=views,estimatedMinutesWatched` +
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

      // 從 Gist 快取獲取所有影片
      const response = await fetch(
        `${API_BASE_URL}/video-cache/search?query=&maxResults=10000`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const allVideos = data.videos || [];

        // 建立 videoId -> title 映射
        const titles: Record<string, string> = {};
        allVideos.forEach((video: any) => {
          const videoId = video.videoId || video.id;
          if (videoIds.includes(videoId)) {
            titles[videoId] = video.title || videoId;
          }
        });

        console.log('[Dashboard] ✅ 從快取獲取到', Object.keys(titles).length, '個影片標題');
        return titles;
      }

      console.warn('[Dashboard] ⚠️ Gist 快取不可用，影片將顯示 ID');
      return {};
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

      // 從 Gist 快取獲取所有影片
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
        const errorText = await response.text();
        console.error('[Dashboard] ❌ 獲取影片列表失敗:', errorText);

        if (errorText.includes('GITHUB_GIST_ID')) {
          throw new Error('未設定 Gist 快取，請先運行 npm run update-cache 生成快取');
        }

        throw new Error('無法從快取獲取影片列表');
      }

      const data = await response.json();
      const allVideos = data.videos || [];

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
        // 假設平均觀看完成率 40%，影片平均長度 10 分鐘
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

  // 獲取趨勢數據
  const fetchTrendData = async (token: string) => {
    try {
      // 使用選定的日期範圍
      const start = new Date(startDate);
      const end = new Date(endDate);

      // 格式化日期為 YYYY-MM-DD
      const formatDateStr = (date: Date) => date.toISOString().split('T')[0];

      // 調用 YouTube Analytics API (如果有權限)
      // 這裡暫時使用模擬數據,實際實作需要 Analytics API
      const mockTrendData: TrendDataPoint[] = [];
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        mockTrendData.push({
          date: formatDateStr(date),
          views: Math.floor(Math.random() * 10000) + 5000,
          subscribers: Math.floor(Math.random() * 100) + 50,
        });
      }

      setTrendData(mockTrendData);
    } catch (err) {
      console.error('獲取趨勢數據失敗:', err);
      // 不拋出錯誤,允許儀錶板繼續顯示其他數據
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

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 不自動監聽日期變化，只有點擊「刷新數據」按鈕才會調用 API
  // useEffect(() => {
  //   if (channelStats) {
  //     fetchDashboardData();
  //   }
  // }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* 標題區域 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            頻道數據儀錶板
          </h2>
          <p className="text-gray-600 mt-1">查看頻道整體表現和熱門影片</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {/* 快速篩選器 */}
          <div className="flex gap-2">
            {[
              { label: '過去 7 天', value: '7d' as QuickDateRange },
              { label: '過去 30 天', value: '30d' as QuickDateRange },
              { label: '過去 90 天', value: '90d' as QuickDateRange },
              { label: '本月', value: 'this_month' as QuickDateRange },
              { label: '上月', value: 'last_month' as QuickDateRange },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  const range = getQuickDateRange(item.value);
                  setStartDate(range.start);
                  setEndDate(range.end);
                }}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            {/* 日期範圍選擇器 */}
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="focus:outline-none text-sm"
              />
              <span className="text-gray-500">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="focus:outline-none text-sm"
              />
            </div>

            {/* 刷新按鈕 */}
            <button
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* 數據來源說明（可摺疊）*/}
      <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowDataSourceInfo(!showDataSourceInfo)}
          className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <strong className="text-sm text-blue-900">數據來源說明</strong>
          </div>
          <svg
            className={`w-5 h-5 text-blue-600 transition-transform ${showDataSourceInfo ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDataSourceInfo && (
          <div className="px-4 pb-4">
            <ul className="space-y-1 text-sm text-blue-800">
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
              <li className="text-green-700 font-medium">
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* KPI 指標卡片（可點擊切換圖表）*/}
      {channelStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 觀看次數（時間範圍內）*/}
          <button
            onClick={() => setSelectedMetric('views')}
            className={`bg-white rounded-lg border-2 p-6 text-left transition-all hover:shadow-md ${
              selectedMetric === 'views'
                ? 'border-blue-600 shadow-md'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600 text-sm">觀看次數</div>
              <Eye className={`w-5 h-5 ${selectedMetric === 'views' ? 'text-blue-600' : 'text-blue-400'}`} />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatNumber(channelStats.viewsInRange)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatFullNumber(channelStats.viewsInRange)} 次觀看
            </div>
            {viewsComparison && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較前期</span>
                  <span className={`font-medium ${viewsComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {viewsComparison.changeFromPrevious >= 0 ? '+' : ''}{viewsComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較去年同期</span>
                  <span className={`font-medium ${viewsComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            className={`bg-white rounded-lg border-2 p-6 text-left transition-all hover:shadow-md ${
              selectedMetric === 'watchTime'
                ? 'border-purple-600 shadow-md'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600 text-sm">觀看時間</div>
              <Clock className={`w-5 h-5 ${selectedMetric === 'watchTime' ? 'text-purple-600' : 'text-purple-400'}`} />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatNumber(channelStats.watchTimeHours)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatFullNumber(channelStats.watchTimeHours)} 小時
            </div>
            {watchTimeComparison && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較前期</span>
                  <span className={`font-medium ${watchTimeComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {watchTimeComparison.changeFromPrevious >= 0 ? '+' : ''}{watchTimeComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較去年同期</span>
                  <span className={`font-medium ${watchTimeComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            className={`bg-white rounded-lg border-2 p-6 text-left transition-all hover:shadow-md ${
              selectedMetric === 'subscribers'
                ? 'border-green-600 shadow-md'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600 text-sm">新增訂閱數</div>
              <Users className={`w-5 h-5 ${selectedMetric === 'subscribers' ? 'text-green-600' : 'text-green-400'}`} />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatNumber(channelStats.subscribersGained)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {channelStats.subscribersGained >= 0 ? '+' : ''}{formatFullNumber(channelStats.subscribersGained)} 位訂閱者
            </div>
            {subscribersComparison && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較前期</span>
                  <span className={`font-medium ${subscribersComparison.changeFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {subscribersComparison.changeFromPrevious >= 0 ? '+' : ''}{subscribersComparison.changeFromPreviousPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">較去年同期</span>
                  <span className={`font-medium ${subscribersComparison.changeFromYearAgo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

          {/* 平均觀看時長 */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600 text-sm">平均觀看時長</div>
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {Math.floor(avgViewDuration / 60)}:{String(avgViewDuration % 60).padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {avgViewDuration} 秒
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {error?.includes('Analytics API')
                ? '無法獲取（需要 Analytics API）'
                : '每次觀看的平均時長'}
            </div>
          </div>

          {/* 平均觀看完成率 */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600 text-sm">平均觀看完成率</div>
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {avgViewPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">
              觀眾平均看完 {avgViewPercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {error?.includes('Analytics API')
                ? '無法獲取（需要 Analytics API）'
                : '觀眾觀看影片的平均完成度'}
            </div>
          </div>
        </div>
      )}

      {/* 過去 12 個月趨勢圖表 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">
          過去 12 個月趨勢
          {monthlyData.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({monthlyData.length} 個月)
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
              <div className="flex items-end justify-between gap-1 h-64 border-b border-l border-gray-200 pb-2 pl-2">
                {monthlyData.map((dataPoint, index) => {
                  // 根據選擇的指標獲取值
                  let value = 0;
                  let color = '';
                  switch (selectedMetric) {
                    case 'views':
                      value = dataPoint.views;
                      color = 'bg-blue-500 hover:bg-blue-600';
                      break;
                    case 'watchTime':
                      value = dataPoint.watchTimeHours;
                      color = 'bg-purple-500 hover:bg-purple-600';
                      break;
                    case 'subscribers':
                      value = dataPoint.subscribersNet; // 使用淨增長（新增 - 取消）
                      color = value >= 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600';
                      break;
                  }

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
                        <div
                          className={`w-full ${color} rounded-t transition-all cursor-pointer hover:opacity-80`}
                          style={{
                            height: `${heightPercent}%`
                          }}
                          title={`${dataPoint.month}: ${formatFullNumber(value)}`}
                        />
                      </div>

                      {/* 月份標籤（水平顯示）*/}
                      <div className="text-xs text-gray-600 mt-2 whitespace-nowrap">
                        {dataPoint.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 熱門影片列表 */}
      {topVideos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            熱門影片 (Top 10)
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            顯示時間範圍內發布的影片，按總觀看數排序
          </p>
          <div className="space-y-3">
            {topVideos.map((video, index) => (
              <div
                key={video.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* 排名 */}
                <div className="text-2xl font-bold text-gray-400 w-8 text-center">
                  {index + 1}
                </div>

                {/* 縮圖 */}
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-32 h-18 object-cover rounded"
                />

                {/* 影片資訊 */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate mb-1">
                    {video.title}
                  </h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {formatFullNumber(video.viewCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      {formatFullNumber(video.likeCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(video.publishedAt)}
                    </div>
                  </div>
                </div>

                {/* 觀看次數 */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatFullNumber(video.viewCount)}
                  </div>
                  <div className="text-xs text-gray-500">觀看次數</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 流量來源分析區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 熱門流量來源 */}
        {trafficSources.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              熱門流量來源
            </h3>
            <div className="space-y-3">
              {trafficSources.map((source, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {source.source}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {source.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatFullNumber(source.views)}
                    </div>
                    <div className="text-xs text-gray-500">觀看次數</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 外部來源排行 */}
        {externalSources.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              外部來源排行
            </h3>
            <div className="space-y-3">
              {externalSources.map((source, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {source.source}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {source.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatFullNumber(source.views)}
                    </div>
                    <div className="text-xs text-gray-500">觀看次數</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜尋字詞 */}
        {searchTerms.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              搜尋字詞
            </h3>
            <div className="space-y-2">
              {searchTerms.map((term, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-400 w-6 text-center">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-900 truncate">
                      {term.term}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 ml-4">
                    {formatFullNumber(term.views)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 人口統計區塊 */}
      {(demographics.length > 0 || geography.length > 0) && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            觀眾人口統計
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 年齡與性別分佈 */}
            {demographics.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  年齡與性別分佈
                </h3>
                <div className="space-y-3">
                  {demographics.map((item, index) => {
                    const genderText = item.gender === 'male' ? '男性' : item.gender === 'female' ? '女性' : '其他';
                    const ageText = item.ageGroup.replace('age', '').replace('-', '-') + ' 歲';

                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            {ageText} · {genderText}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {item.viewsPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              item.gender === 'male' ? 'bg-blue-500' :
                              item.gender === 'female' ? 'bg-pink-500' : 'bg-gray-500'
                            }`}
                            style={{ width: `${item.viewsPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 地理位置分佈 */}
            {geography.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
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
                          <span className="text-gray-700">{item.country}</span>
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
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 裝置類型分佈圓餅圖 */}
            {devices.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-600" />
                  觀看裝置分佈
                </h3>
                <div className="flex flex-col items-center">
                  {/* 簡易圓餅圖（使用 CSS 實現） */}
                  <div className="relative w-48 h-48 mb-6">
                    {/* 使用 conic-gradient 創建圓餅圖 */}
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        background: `conic-gradient(${devices
                          .map((device, index) => {
                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                            const color = colors[index % colors.length];
                            const start = devices
                              .slice(0, index)
                              .reduce((sum, d) => sum + d.percentage, 0);
                            const end = start + device.percentage;
                            return `${color} ${start}% ${end}%`;
                          })
                          .join(', ')})`,
                      }}
                    />
                    {/* 中心白色圓圈 */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
                        <div className="text-xs text-gray-500">裝置類型</div>
                      </div>
                    </div>
                  </div>

                  {/* 圖例 */}
                  <div className="w-full space-y-3">
                    {devices.map((device, index) => {
                      const colors = [
                        { bg: 'bg-blue-500', text: 'text-blue-500' },
                        { bg: 'bg-green-500', text: 'text-green-500' },
                        { bg: 'bg-yellow-500', text: 'text-yellow-500' },
                        { bg: 'bg-red-500', text: 'text-red-500' },
                        { bg: 'bg-purple-500', text: 'text-purple-500' },
                      ];
                      const color = colors[index % colors.length];

                      // 翻譯裝置類型
                      const deviceNames: { [key: string]: string } = {
                        DESKTOP: '桌面電腦',
                        MOBILE: '手機',
                        TABLET: '平板',
                        TV: '電視',
                        GAME_CONSOLE: '遊戲主機',
                      };
                      const deviceName = deviceNames[device.deviceType] || device.deviceType;

                      return (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                            <span className="text-sm text-gray-700">{deviceName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {formatFullNumber(device.views)} 次
                            </span>
                            <span className={`text-sm font-semibold ${color.text} w-14 text-right`}>
                              {device.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 訂閱來源分析 */}
            {subscriberSources.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-600" />
                  訂閱來源分析
                  <span className="text-sm font-normal text-gray-500">
                    （帶來最多新訂閱的影片）
                  </span>
                </h3>
                <div className="space-y-3">
                  {subscriberSources.map((source, index) => (
                    <div
                      key={source.videoId}
                      className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-transparent rounded-lg hover:from-pink-100 transition-colors"
                    >
                      {/* 排名 */}
                      <div className="flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0
                              ? 'bg-yellow-400 text-yellow-900'
                              : index === 1
                              ? 'bg-gray-300 text-gray-700'
                              : index === 2
                              ? 'bg-orange-400 text-orange-900'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </div>
                      </div>

                      {/* 影片資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {source.videoTitle}
                        </div>
                        <a
                          href={`https://www.youtube.com/watch?v=${source.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {source.videoId}
                        </a>
                      </div>

                      {/* 訂閱數 */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold text-pink-600">
                          +{formatNumber(source.subscribersGained)}
                        </div>
                        <div className="text-xs text-gray-500">新訂閱</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 總計 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      前 {subscriberSources.length} 支影片總計
                    </span>
                    <span className="text-xl font-bold text-pink-600">
                      +
                      {formatNumber(
                        subscriberSources.reduce((sum, s) => sum + s.subscribersGained, 0)
                      )}{' '}
                      訂閱
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 提示訊息 */}
      {!channelStats && !isLoading && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            歡迎使用頻道數據儀錶板
          </h3>
          <p className="text-gray-600 mb-4">
            點擊「刷新數據」按鈕開始查看您的頻道統計資訊
          </p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            開始載入
          </button>
        </div>
      )}
    </div>
  );
}
