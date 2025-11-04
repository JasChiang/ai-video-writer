import React, { useState, useEffect, useCallback } from 'react';
import { Loader } from './Loader';
import * as youtubeService from '../services/youtubeService';
import { VideoAnalyticsExpandedView } from './VideoAnalyticsExpandedView';

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
}

export function VideoAnalytics() {
  const [isLoading, setIsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<VideoAnalyticsData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [keywordAnalysisCache, setKeywordAnalysisCache] = useState<Record<string, KeywordAnalysis>>({});
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);
  const [selectedYears, setSelectedYears] = useState(1); // 預設 1 年
  const [currentYearRange, setCurrentYearRange] = useState(1); // 當前已載入的年份範圍
  const [showMetadataGenerator, setShowMetadataGenerator] = useState<Record<string, boolean>>({});

  const persistAnalyticsData = useCallback((data: VideoAnalyticsData[]) => {
    try {
      localStorage.setItem('videoAnalyticsData', JSON.stringify(data));
      localStorage.setItem('videoAnalyticsTimestamp', Date.now().toString());
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

        persistAnalyticsData(updated);
        return updated;
      });
    },
    [persistAnalyticsData]
  );

  // 從 localStorage 載入快取的分析數據
  useEffect(() => {
    const cached = localStorage.getItem('videoAnalyticsData');
    const cachedTimestamp = localStorage.getItem('videoAnalyticsTimestamp');
    if (cached && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp);
      const now = Date.now();
      // 快取 24 小時內有效
      if (now - timestamp < 24 * 60 * 60 * 1000) {
        setAnalyticsData(JSON.parse(cached));
      } else {
        // 過期，清除快取
        localStorage.removeItem('videoAnalyticsData');
        localStorage.removeItem('videoAnalyticsTimestamp');
      }
    }
  }, []);

  const fetchAnalytics = async (yearsToFetch: number = selectedYears, append: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      // 獲取當前用戶的 access token 和 channel ID
      const accessToken = youtubeService.getAccessToken();
      const channelId = await youtubeService.getChannelId();

      if (!accessToken || !channelId) {
        throw new Error('請先登入 YouTube 帳號');
      }

      console.log(`[Analytics] 開始獲取分析數據（${yearsToFetch} 年）...`);

      // 調用後端 API
      const response = await fetch('http://localhost:3001/api/analytics/channel', {
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

      setAnalyticsData(newData);
      setCurrentYearRange(yearsToFetch);

      // 儲存到 localStorage
      persistAnalyticsData(newData);
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

      // 準備影片資料（需要從 YouTube API 取得標題、說明、標籤）
      const accessToken = youtubeService.getAccessToken();
      if (!accessToken) {
        throw new Error('請先登入 YouTube 帳號');
      }

      // 調用後端 API
      const response = await fetch('http://localhost:3001/api/analytics/keyword-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: {
            title: video.title,
            description: '', // 如果需要，可以從 YouTube API 取得
            tags: [], // 如果需要，可以從 YouTube API 取得
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

      // 儲存到快取
      setKeywordAnalysisCache(prev => ({
        ...prev,
        [videoId]: data.analysis
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
    localStorage.removeItem('videoAnalyticsData');
    localStorage.removeItem('videoAnalyticsTimestamp');
    setAnalyticsData([]);
    setKeywordAnalysisCache({});
    setExpandedVideoId(null);
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold" style={{ color: '#1F1F1F' }}>
          📊 影片表現分析
        </h2>
        <p className="text-lg" style={{ color: '#DC2626' }}>
          分析你的影片表現，找出需要優化的影片
        </p>
      </div>

      {/* 開始分析按鈕與年度選擇 */}
      {analyticsData.length === 0 && !isLoading && (
        <div className="flex flex-col items-center gap-4">
          {/* 年度選擇器 */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm font-semibold" style={{ color: '#DC2626' }}>
              選擇分析時間範圍
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((years) => (
                <button
                  key={years}
                  onClick={() => setSelectedYears(years)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedYears === years ? 'shadow-lg transform scale-105' : ''
                  }`}
                  style={{
                    backgroundColor: selectedYears === years ? '#DC2626' : '#FEE2E2',
                    color: selectedYears === years ? 'white' : '#DC2626',
                    border: selectedYears === years ? 'none' : '1px solid #FECACA',
                  }}
                >
                  {years} 年
                </button>
              ))}
            </div>
            <p className="text-xs text-center" style={{ color: '#DC2626', maxWidth: '400px' }}>
              💡 建議先選擇 1 年，避免超過 API 配額限制。分析完成後可載入更多年份。
            </p>
          </div>

          {/* 開始分析按鈕 */}
          <button
            onClick={() => fetchAnalytics()}
            className="px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg"
            style={{
              backgroundColor: '#DC2626',
              color: 'white',
            }}
          >
            🚀 開始分析（近 {selectedYears} 年影片）
          </button>
        </div>
      )}

      {/* 載入中 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader />
          <p className="text-lg" style={{ color: '#DC2626' }}>
            正在分析影片數據，請稍候...
          </p>
          <p className="text-sm" style={{ color: '#DC2626' }}>
            這可能需要 1-2 分鐘，取決於影片數量
          </p>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div
          className="p-4 rounded-lg text-center"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid #DC2626',
            color: '#DC2626',
          }}
        >
          <p className="font-bold">分析失敗</p>
          <p>{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-6 py-2 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: '#DC2626',
              color: 'white',
            }}
          >
            重試
          </button>
        </div>
      )}

      {/* 分析結果 */}
      {analyticsData.length > 0 && !isLoading && (
        <div className="space-y-4">
          {/* 統計摘要 */}
          <div
            className="p-6 rounded-lg shadow-md"
            style={{
              backgroundColor: 'rgba(254, 202, 202, 0.5)',
              border: '1px solid #FECACA',
            }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: '#1F1F1F' }}>
              📈 分析摘要
            </h3>
            <p style={{ color: '#DC2626' }}>
              找到 <span className="font-bold">{analyticsData.length}</span> 支建議更新的影片
              <span className="text-sm ml-2">（近 {currentYearRange} 年內發布）</span>
            </p>
            <p className="text-sm mt-2" style={{ color: '#DC2626' }}>
              以下影片根據優先級排序（分數越高越建議更新）
            </p>
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-between items-center">
            <button
              onClick={clearCache}
              className="px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg text-sm"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: '#DC2626',
                border: '1px solid #DC2626',
              }}
            >
              🗑️ 清除快取
            </button>
            <div className="flex gap-2">
              <button
                onClick={loadMoreYears}
                className="px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg"
                style={{
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                }}
              >
                ⏳ 載入更多（往前 1 年）
              </button>
              <button
                onClick={() => fetchAnalytics()}
                className="px-6 py-2 rounded-lg font-semibold transition-all hover:shadow-lg"
                style={{
                  backgroundColor: '#DC2626',
                  color: 'white',
                }}
              >
                🔄 重新分析
              </button>
            </div>
          </div>

          {/* 影片列表 */}
          <div className="grid gap-4">
            {analyticsData.map((video, index) => (
              <div key={video.videoId}>
                {/* 影片卡片 */}
                <div
                  className="p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'white',
                    border: `2px solid ${expandedVideoId === video.videoId ? '#DC2626' : '#FECACA'}`,
                  }}
                  onClick={() => toggleVideoExpansion(video.videoId)}
                >
                <div className="flex gap-4">
                  {/* 排名徽章 */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{
                      backgroundColor: index < 10 ? '#DC2626' : '#DC2626',
                      color: 'white',
                    }}
                  >
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
                    <h4 className="font-bold text-lg line-clamp-2" style={{ color: '#1F1F1F' }}>
                      {video.title}
                    </h4>
                    <p className="text-sm" style={{ color: '#DC2626' }}>
                      發布日期: {formatDate(video.publishedAt)}
                    </p>

                    {/* 關鍵指標 */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span style={{ color: '#DC2626' }}>觀看次數: </span>
                        <span className="font-semibold" style={{ color: '#1F1F1F' }}>
                          {formatNumber(video.metrics.views)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#DC2626' }}>觀看時長: </span>
                        <span className="font-semibold" style={{ color: '#1F1F1F' }}>
                          {video.metrics.averageViewPercentage}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#DC2626' }}>搜尋流量: </span>
                        <span className="font-semibold" style={{ color: '#1F1F1F' }}>
                          {video.trafficSources.searchPercentage}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#DC2626' }}>優先分數: </span>
                        <span className="font-bold text-lg" style={{ color: '#DC2626' }}>
                          {video.priorityScore}
                        </span>
                      </div>
                    </div>

                    {/* 更新建議 */}
                    <div className="space-y-1">
                      {video.updateReasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="text-sm px-3 py-1 rounded inline-block mr-2"
                          style={{
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            color: '#DC2626',
                          }}
                        >
                          💡 {reason}
                        </div>
                      ))}
                    </div>

                    {/* 展開/收合指示器 */}
                    <div className="flex items-center justify-center mt-2">
                      <span className="text-sm" style={{ color: '#DC2626' }}>
                        {expandedVideoId === video.videoId ? '▲ 點擊收合' : '▼ 點擊查看詳情'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

                {/* 展開的詳細資訊 */}
                {expandedVideoId === video.videoId && (
                  <div
                    className="mt-4 p-6 rounded-lg shadow-inner animate-fade-in"
                    style={{
                      backgroundColor: 'rgba(254, 202, 202, 0.2)',
                      border: '2px solid #DC2626',
                    }}
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
