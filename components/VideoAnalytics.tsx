import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader } from './Loader';
import * as youtubeService from '../services/youtubeService';
import { VideoAnalyticsExpandedView } from './VideoAnalyticsExpandedView';
import { AppIcon } from './AppIcon';

interface AnalyticsMetrics {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage: string;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  likeRatio: string;
}

interface TrafficSources {
  youtubeSearch: number;
  googleSearch: number;
  suggested: number;
  external: number;
  other: number;
  searchPercentage: string;
  topExternalSources: { name: string; views: number }[];
  externalDetailsLoaded?: boolean;
}

interface Impressions {
  impressions: number;
  clicks: number;
  ctr: number;
}

interface VideoAnalyticsData {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  thumbnail: string;
  metrics: AnalyticsMetrics;
  trafficSources: TrafficSources;
  impressions: Impressions;
  priorityScore: number;
  updateReasons: string[];
}

interface AnalyticsResponse {
  success: boolean;
  totalVideos: number;
  recommendations: VideoAnalyticsData[];
}

interface KeywordAnalysis {
  currentKeywords: {
    score: number;
    strengths: string[];
    weaknesses: string[];
  };
  recommendedKeywords: {
    primary: string[];
    secondary: string[];
    longtail: string[];
  };
  titleSuggestions: string[];
  descriptionTips: string[];
  actionPlan: {
    priority: string;
    estimatedImpact: string;
    steps: string[];
  };
  metadataHints: {
    titleHooks: string[];
    descriptionAngles: string[];
    callToActions: string[];
  };
}

const ANALYTICS_CACHE_KEY = 'videoAnalytics.cache';
const ACTIVE_CHANNEL_STORAGE_KEY = 'videoAnalytics.activeChannelId';
const LEGACY_DATA_KEY = 'videoAnalyticsData';
const LEGACY_TIMESTAMP_KEY = 'videoAnalyticsTimestamp';
const LEGACY_CHANNEL_KEY = 'channelId';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface AnalyticsCachePayload {
  channelId: string;
  timestamp: number;
  yearRange: number;
  data: VideoAnalyticsData[];
}

export function VideoAnalytics() {
  const [isLoading, setIsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<VideoAnalyticsData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [keywordAnalysisCache, setKeywordAnalysisCache] = useState<Record<string, KeywordAnalysis>>({});
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);
  const [selectedYears, setSelectedYears] = useState(1); // 預設 1 年
  const [currentYearRange, setCurrentYearRange] = useState(1); // 當前已載入的年份範圍
  const [showMetadataGenerator, setShowMetadataGenerator] = useState<Record<string, boolean>>({});
  const previousChannelIdRef = useRef<string | null>(null);

  const persistAnalyticsData = useCallback((channelId: string, data: VideoAnalyticsData[], yearRange: number) => {
    if (!channelId) return;

    const payload: AnalyticsCachePayload = {
      channelId,
      timestamp: Date.now(),
      yearRange: Math.max(1, Number.isFinite(yearRange) ? yearRange : 1),
      data,
    };

    try {
      localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(payload));
      localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, channelId);
      // 保留舊版鍵值，提供其他元件相容性
      localStorage.setItem(LEGACY_CHANNEL_KEY, channelId);
      localStorage.removeItem(LEGACY_DATA_KEY);
      localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
    } catch (error) {
      console.warn('Failed to persist analytics data', error);
    }
  }, []);

  const handleTrafficSourcesUpdate = useCallback(
    (videoId: string, updates: Partial<TrafficSources>) => {
      setAnalyticsData(prev => {
        const updated = prev.map(video => {
          if (video.videoId !== videoId) return video;

          const updatedTraffic: TrafficSources = {
            ...video.trafficSources,
            ...updates,
            searchPercentage: (updates.searchPercentage ?? video.trafficSources.searchPercentage) as string,
            topExternalSources: updates.topExternalSources ?? video.trafficSources.topExternalSources,
            externalDetailsLoaded: updates.externalDetailsLoaded ?? video.trafficSources.externalDetailsLoaded ?? false,
          };

          return {
            ...video,
            trafficSources: updatedTraffic,
          };
        });

        if (activeChannelId) {
          persistAnalyticsData(activeChannelId, updated, currentYearRange || selectedYears || 1);
        }
        return updated;
      });
    },
    [activeChannelId, currentYearRange, persistAnalyticsData, selectedYears]
  );

  // 復原並確認目前的頻道 ID，以便後續比對快取
  useEffect(() => {
    let isMounted = true;

    const restoreChannelIdFromStorage = () => {
      try {
        const stored = localStorage.getItem(ACTIVE_CHANNEL_STORAGE_KEY) || localStorage.getItem(LEGACY_CHANNEL_KEY);
        if (stored && isMounted) {
          setActiveChannelId(prev => prev ?? stored);
        }
      } catch (error) {
        console.warn('Failed to restore channel ID from storage', error);
      }
    };

    const resolveChannelId = async () => {
      try {
        const channelId = await youtubeService.getChannelId({
          source: 'VideoAnalytics',
          trigger: 'resolve-active-channel',
        });
        if (!isMounted || !channelId) return;

        setActiveChannelId(prev => (prev === channelId ? prev : channelId));
        localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, channelId);
        localStorage.setItem(LEGACY_CHANNEL_KEY, channelId);
      } catch (error) {
        console.warn('Failed to resolve channel ID for analytics cache', error);
      }
    };

    restoreChannelIdFromStorage();
    resolveChannelId();

    return () => {
      isMounted = false;
    };
  }, []);

  // 根據當前頻道載入對應的快取，若不相符則清除舊資料
  useEffect(() => {
    if (!activeChannelId) return;

    const previousChannelId = previousChannelIdRef.current;
    if (previousChannelId !== null && previousChannelId === activeChannelId) {
      return;
    }

    const channelChanged = Boolean(previousChannelId && previousChannelId !== activeChannelId);
    previousChannelIdRef.current = activeChannelId;

    if (channelChanged) {
      setAnalyticsData([]);
      setKeywordAnalysisCache({});
      setExpandedVideoId(null);
      setShowMetadataGenerator({});
      setCurrentYearRange(1);
    }

    const now = Date.now();
    let cacheApplied = false;

    try {
      const raw = localStorage.getItem(ANALYTICS_CACHE_KEY);
      if (raw) {
        const payload = JSON.parse(raw) as AnalyticsCachePayload;
        if (payload.channelId === activeChannelId) {
          if (now - payload.timestamp < CACHE_TTL && Array.isArray(payload.data)) {
            setAnalyticsData(payload.data);
            setCurrentYearRange(Math.max(1, Number.isFinite(payload.yearRange) ? payload.yearRange : 1));
            cacheApplied = true;
          } else {
            localStorage.removeItem(ANALYTICS_CACHE_KEY);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load analytics cache', error);
    }

    if (!cacheApplied) {
      const legacyDataRaw = localStorage.getItem(LEGACY_DATA_KEY);
      const legacyTimestampRaw = localStorage.getItem(LEGACY_TIMESTAMP_KEY);
      const legacyChannelId = localStorage.getItem(LEGACY_CHANNEL_KEY);

      if (legacyDataRaw && legacyTimestampRaw && legacyChannelId === activeChannelId) {
        const legacyTimestamp = parseInt(legacyTimestampRaw, 10);
        if (Number.isFinite(legacyTimestamp) && now - legacyTimestamp < CACHE_TTL) {
          try {
            const legacyData = JSON.parse(legacyDataRaw);
            if (Array.isArray(legacyData)) {
              setAnalyticsData(legacyData);
              setCurrentYearRange(1);
              persistAnalyticsData(activeChannelId, legacyData, 1);
              cacheApplied = true;
            }
          } catch (error) {
            console.warn('Failed to parse legacy analytics cache', error);
          }
        }
      }
    }

    // 若未載入任何快取，保留當前狀態，讓使用者重新觸發分析
  }, [activeChannelId, persistAnalyticsData]);

  const fetchAnalytics = async (yearsToFetch: number = selectedYears, append: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      // 獲取當前用戶的 access token 和 channel ID
      const accessToken = youtubeService.getAccessToken();
      const channelId = await youtubeService.getChannelId({
        source: 'VideoAnalytics',
        trigger: append ? 'load-more-analytics' : 'fetch-analytics',
      });

      if (!accessToken || !channelId) {
        throw new Error('請先登入 YouTube 帳號');
      }

      // 確保更新頻道 ID（避免切換頻道仍使用舊值）
      try {
        localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, channelId);
        localStorage.setItem(LEGACY_CHANNEL_KEY, channelId);
      } catch (storageError) {
        console.warn('Failed to persist channel ID for analytics cache', storageError);
      }
      setActiveChannelId(prev => (prev === channelId ? prev : channelId));

      console.log(`[Analytics] 開始獲取分析數據（${yearsToFetch} 年）...`);

      // 調用後端 API
      // 開發模式使用 localhost:3001，生產模式使用空字符串（相對路徑）
      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      const response = await fetch(`${baseUrl}/api/analytics/channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          channelId,
          daysThreshold: yearsToFetch * 365, // 轉換為天數
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '分析失敗');
      }

      const data: AnalyticsResponse = await response.json();
      console.log('[Analytics] 分析完成:', data);

      let newData: VideoAnalyticsData[];
      if (append) {
        // 合併新舊數據並去重
        const existingIds = new Set(analyticsData.map(v => v.videoId));
        const newVideos = data.recommendations.filter(v => !existingIds.has(v.videoId));
        newData = [...analyticsData, ...newVideos];
      } else {
        newData = data.recommendations;
      }

      // 依影片 ID 去重，避免 React key 重複
      const deduped = Array.from(new Map(newData.map(video => [video.videoId, video])).values());

      setAnalyticsData(deduped);
      setCurrentYearRange(yearsToFetch);

      // 儲存到 localStorage（記錄對應頻道與時間範圍）
      persistAnalyticsData(channelId, deduped, yearsToFetch);
    } catch (err: any) {
      console.error('[Analytics] 錯誤:', err);
      setError(err.message || '分析失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreYears = () => {
    const nextYearRange = currentYearRange + 1;
    fetchAnalytics(nextYearRange, true);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const analyzeKeywords = async (videoId: string, video: VideoAnalyticsData) => {
    // 檢查快取
    if (keywordAnalysisCache[videoId]) {
      console.log('[Keyword Analysis] 使用快取的分析結果');
      return;
    }

    setIsAnalyzingKeywords(true);

    try {
      console.log('[Keyword Analysis] 開始分析關鍵字...');

      const description = video.description || '';
      const tags = video.tags || [];

      // 調用後端 API
      // 開發模式使用 localhost:3001，生產模式使用空字符串（相對路徑）
      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      const response = await fetch(`${baseUrl}/api/analytics/keyword-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: {
            title: video.title,
            description,
            tags,
            analytics: video,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '關鍵字分析失敗');
      }

      const data = await response.json();
      console.log('[Keyword Analysis] 分析完成:', data);

      const analysis = data.analysis as KeywordAnalysis;
      const metadataHints = analysis?.metadataHints || { titleHooks: [], descriptionAngles: [], callToActions: [] };
      analysis.metadataHints = {
        titleHooks: Array.isArray(metadataHints.titleHooks) ? metadataHints.titleHooks : [],
        descriptionAngles: Array.isArray(metadataHints.descriptionAngles) ? metadataHints.descriptionAngles : [],
        callToActions: Array.isArray(metadataHints.callToActions) ? metadataHints.callToActions : [],
      };

      // 儲存到快取
      setKeywordAnalysisCache(prev => ({
        ...prev,
        [videoId]: analysis
      }));
    } catch (err: any) {
      console.error('[Keyword Analysis] 錯誤:', err);
      alert(`關鍵字分析失敗: ${err.message}`);
    } finally {
      setIsAnalyzingKeywords(false);
    }
  };

  const toggleVideoExpansion = (videoId: string) => {
    setExpandedVideoId(expandedVideoId === videoId ? null : videoId);
  };

  const clearCache = () => {
    localStorage.removeItem(ANALYTICS_CACHE_KEY);
    localStorage.removeItem(LEGACY_DATA_KEY);
    localStorage.removeItem(LEGACY_TIMESTAMP_KEY);
    setAnalyticsData([]);
    setKeywordAnalysisCache({});
    setExpandedVideoId(null);
    setShowMetadataGenerator({});
    setCurrentYearRange(1);
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-neutral-900 flex items-center justify-center gap-2">
          <AppIcon name="analytics" size={28} className="text-red-600" />
          影片表現分析
        </h2>
        <p className="text-lg text-red-600">
          分析你的影片表現，找出需要優化的影片
        </p>
      </div>

      {/* 開始分析按鈕與年度選擇 */}
      {analyticsData.length === 0 && !isLoading && (
        <div className="flex flex-col items-center gap-4">
          {/* 年度選擇器 */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm font-semibold text-red-600">
              選擇分析時間範圍
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((years) => (
                <button
                  key={years}
                  onClick={() => setSelectedYears(years)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all border ${
                    selectedYears === years
                      ? 'bg-red-600 text-white shadow-lg scale-105 border-red-600'
                      : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {years} 年
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-red-600 max-w-[400px] flex items-center justify-center gap-1">
              <AppIcon name="idea" size={14} className="text-red-500" />
              建議先選擇 1 年，避免超過 API 配額限制。分析完成後可載入更多年份。
            </p>
          </div>

          {/* 開始分析按鈕 */}
          <button
            onClick={() => fetchAnalytics()}
            className="px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg bg-red-600 text-white"
          >
            <span className="inline-flex items-center gap-2">
              <AppIcon name="rocket" size={18} className="text-white" />
              開始分析（近 {selectedYears} 年影片）
            </span>
          </button>
        </div>
      )}

      {/* 載入中 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader />
          <p className="text-lg text-red-600">
            正在分析影片數據，請稍候...
          </p>
          <p className="text-sm text-red-600">
            這可能需要 1-2 分鐘，取決於影片數量
          </p>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="p-4 rounded-lg text-center bg-red-50 border border-red-200 text-red-700">
          <p className="font-bold">分析失敗</p>
          <p>{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-6 py-2 rounded-lg font-semibold transition-all bg-red-600 text-white hover:bg-red-700"
          >
            重試
          </button>
        </div>
      )}

      {/* 分析結果 */}
      {analyticsData.length > 0 && !isLoading && (
        <div className="space-y-4">
          {/* 統計摘要 */}
          <div className="p-6 rounded-lg shadow-md bg-red-50/70 border border-red-200">
            <h3 className="text-xl font-bold mb-2 text-neutral-900 flex items-center gap-2">
              <AppIcon name="analytics" size={18} className="text-red-600" />
              分析摘要
            </h3>
            <p className="text-red-600">
              找到 <span className="font-bold">{analyticsData.length}</span> 支建議更新的影片
              <span className="text-sm ml-2">（近 {currentYearRange} 年內發布）</span>
            </p>
            <p className="text-sm mt-2 text-red-600">
              以下影片根據優先級排序（分數越高越建議更新）
            </p>
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-between items-center">
            <button
              onClick={clearCache}
              className="px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg text-sm bg-red-50 text-red-600 border border-red-200"
            >
              <span className="inline-flex items-center gap-2">
                <AppIcon name="trash" size={16} className="text-red-600" />
                清除快取
              </span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={loadMoreYears}
                className="px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg bg-red-50 text-red-600 border border-red-200"
              >
                <span className="inline-flex items-center gap-2">
                  <AppIcon name="hourglass" size={16} className="text-red-600" />
                  載入更多（往前 1 年）
                </span>
              </button>
              <button
                onClick={() => fetchAnalytics()}
                className="px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg bg-red-600 text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <AppIcon name="refresh" size={16} className="text-white" />
                  重新分析
                </span>
              </button>
            </div>
          </div>

          {/* 影片列表 */}
          <div className="grid gap-4">
            {analyticsData.map((video, index) => (
              <div key={video.videoId}>
                {/* 影片卡片 */}
                <div
                  className={`p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer bg-white border-2 ${
                    expandedVideoId === video.videoId ? 'border-red-600' : 'border-red-200'
                  }`}
                  onClick={() => toggleVideoExpansion(video.videoId)}
                >
                <div className="flex gap-4">
                  {/* 排名徽章 */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl bg-red-600 text-white">
                    {index + 1}
                  </div>

                  {/* 縮圖 */}
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-40 h-24 object-cover rounded-lg flex-shrink-0"
                  />

                  {/* 影片資訊 */}
                  <div className="flex-grow space-y-2">
                    <h4 className="font-bold text-lg line-clamp-2 text-neutral-900">
                      {video.title}
                    </h4>
                    <p className="text-sm text-red-600">
                      發布日期: {formatDate(video.publishedAt)}
                    </p>

                    {/* 關鍵指標 */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-red-600">觀看次數: </span>
                        <span className="font-semibold text-neutral-900">
                          {formatNumber(video.metrics.views)}
                        </span>
                      </div>
                      <div>
                        <span className="text-red-600">觀看時長: </span>
                        <span className="font-semibold text-neutral-900">
                          {video.metrics.averageViewPercentage}%
                        </span>
                      </div>
                      <div>
                        <span className="text-red-600">搜尋流量: </span>
                        <span className="font-semibold text-neutral-900">
                          {video.trafficSources.searchPercentage}%
                        </span>
                      </div>
                      <div>
                        <span className="text-red-600">優先分數: </span>
                        <span className="font-bold text-lg text-red-600">
                          {video.priorityScore}
                        </span>
                      </div>
                    </div>

                    {/* 更新建議 */}
                    <div className="space-y-1">
                      {video.updateReasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="text-sm px-3 py-1 rounded inline-block mr-2 bg-red-50 text-red-600"
                        >
                          <span className="inline-flex items-center gap-1">
                            <AppIcon name="idea" size={14} className="text-red-500" />
                            {reason}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 展開/收合指示器 */}
                    <div className="flex items-center justify-center mt-2">
                      <span className="text-sm text-red-600">
                        {expandedVideoId === video.videoId ? '▲ 點擊收合' : '▼ 點擊查看詳情'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

                {/* 展開的詳細資訊 */}
                {expandedVideoId === video.videoId && (
                  <div
                    className="mt-4 p-6 rounded-lg shadow-inner animate-fade-in bg-red-50 border-2 border-red-200"
                    onClick={(e) => e.stopPropagation()}
                 >
                    <VideoAnalyticsExpandedView
                      video={video}
                      keywordAnalysis={keywordAnalysisCache[video.videoId] || null}
                      onAnalyzeKeywords={() => analyzeKeywords(video.videoId, video)}
                      isAnalyzing={isAnalyzingKeywords}
                      onTrafficSourcesUpdate={handleTrafficSourcesUpdate}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
