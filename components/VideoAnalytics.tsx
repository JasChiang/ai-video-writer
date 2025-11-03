import React, { useState, useEffect } from 'react';
import { Loader } from './Loader';
import * as youtubeService from '../services/youtubeService';

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
  const [selectedVideo, setSelectedVideo] = useState<VideoAnalyticsData | null>(null);
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 獲取當前用戶的 access token 和 channel ID
      const accessToken = youtubeService.getAccessToken();
      const channelId = await youtubeService.getChannelId();

      if (!accessToken || !channelId) {
        throw new Error('請先登入 YouTube 帳號');
      }

      console.log('[Analytics] 開始獲取分析數據...');

      // 調用後端 API
      const response = await fetch('http://localhost:3001/api/analytics/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          channelId,
          daysThreshold: 730, // 2 年
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '分析失敗');
      }

      const data: AnalyticsResponse = await response.json();
      console.log('[Analytics] 分析完成:', data);

      setAnalyticsData(data.recommendations);
    } catch (err: any) {
      console.error('[Analytics] 錯誤:', err);
      setError(err.message || '分析失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
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

  const analyzeKeywords = async (video: VideoAnalyticsData) => {
    setIsAnalyzingKeywords(true);
    setKeywordAnalysis(null);

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

      setKeywordAnalysis(data.analysis);
    } catch (err: any) {
      console.error('[Keyword Analysis] 錯誤:', err);
      alert(`關鍵字分析失敗: ${err.message}`);
    } finally {
      setIsAnalyzingKeywords(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold" style={{ color: '#03045E' }}>
          📊 影片表現分析
        </h2>
        <p className="text-lg" style={{ color: '#0077B6' }}>
          分析你的影片表現，找出需要優化的影片（近 2 年內發布）
        </p>
      </div>

      {/* 開始分析按鈕 */}
      {analyticsData.length === 0 && !isLoading && (
        <div className="flex justify-center">
          <button
            onClick={fetchAnalytics}
            className="px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg"
            style={{
              backgroundColor: '#0077B6',
              color: 'white',
            }}
          >
            🚀 開始分析
          </button>
        </div>
      )}

      {/* 載入中 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader />
          <p className="text-lg" style={{ color: '#0077B6' }}>
            正在分析影片數據，請稍候...
          </p>
          <p className="text-sm" style={{ color: '#0077B6' }}>
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
              backgroundColor: '#0077B6',
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
              backgroundColor: 'rgba(202, 240, 248, 0.5)',
              border: '1px solid #90E0EF',
            }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: '#03045E' }}>
              📈 分析摘要
            </h3>
            <p style={{ color: '#0077B6' }}>
              找到 <span className="font-bold">{analyticsData.length}</span> 支建議更新的影片
            </p>
            <p className="text-sm mt-2" style={{ color: '#0077B6' }}>
              以下影片根據優先級排序（分數越高越建議更新）
            </p>
          </div>

          {/* 重新分析按鈕 */}
          <div className="flex justify-end">
            <button
              onClick={fetchAnalytics}
              className="px-6 py-2 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: '#0077B6',
                color: 'white',
              }}
            >
              🔄 重新分析
            </button>
          </div>

          {/* 影片列表 */}
          <div className="grid gap-4">
            {analyticsData.map((video, index) => (
              <div
                key={video.videoId}
                className="p-6 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer"
                style={{
                  backgroundColor: 'white',
                  border: '2px solid #90E0EF',
                }}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="flex gap-4">
                  {/* 排名徽章 */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{
                      backgroundColor: index < 10 ? '#DC2626' : '#0077B6',
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
                    <h4 className="font-bold text-lg line-clamp-2" style={{ color: '#03045E' }}>
                      {video.title}
                    </h4>
                    <p className="text-sm" style={{ color: '#0077B6' }}>
                      發布日期: {formatDate(video.publishedAt)}
                    </p>

                    {/* 關鍵指標 */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span style={{ color: '#0077B6' }}>觀看次數: </span>
                        <span className="font-semibold" style={{ color: '#03045E' }}>
                          {formatNumber(video.metrics.views)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#0077B6' }}>觀看時長: </span>
                        <span className="font-semibold" style={{ color: '#03045E' }}>
                          {video.metrics.averageViewPercentage}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#0077B6' }}>搜尋流量: </span>
                        <span className="font-semibold" style={{ color: '#03045E' }}>
                          {video.trafficSources.searchPercentage}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#0077B6' }}>優先分數: </span>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 詳細資訊彈窗 */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold" style={{ color: '#03045E' }}>
                影片詳細分析
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-2xl hover:opacity-70"
                style={{ color: '#0077B6' }}
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* 影片資訊 */}
              <div>
                <img
                  src={selectedVideo.thumbnail}
                  alt={selectedVideo.title}
                  className="w-full rounded-lg mb-4"
                />
                <h4 className="text-xl font-bold mb-2" style={{ color: '#03045E' }}>
                  {selectedVideo.title}
                </h4>
                <p style={{ color: '#0077B6' }}>
                  發布日期: {formatDate(selectedVideo.publishedAt)}
                </p>
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline hover:opacity-70"
                  style={{ color: '#0077B6' }}
                >
                  在 YouTube 上查看
                </a>
              </div>

              {/* 核心指標 */}
              <div>
                <h5 className="font-bold mb-3 text-lg" style={{ color: '#03045E' }}>
                  📊 核心指標
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>觀看次數</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.metrics.views)}
                    </p>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>平均觀看時長</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {selectedVideo.metrics.averageViewPercentage}%
                    </p>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>讚數比例</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {selectedVideo.metrics.likeRatio}%
                    </p>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>留言數</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.metrics.comments)}
                    </p>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>分享次數</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.metrics.shares)}
                    </p>
                  </div>
                  <div className="p-3 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <p className="text-sm" style={{ color: '#0077B6' }}>新訂閱</p>
                    <p className="text-2xl font-bold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.metrics.subscribersGained)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 流量來源 */}
              <div>
                <h5 className="font-bold mb-3 text-lg" style={{ color: '#03045E' }}>
                  🚦 流量來源
                </h5>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <span style={{ color: '#0077B6' }}>YouTube 搜尋</span>
                    <span className="font-semibold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.trafficSources.youtubeSearch)} 次
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <span style={{ color: '#0077B6' }}>Google 搜尋</span>
                    <span className="font-semibold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.trafficSources.googleSearch)} 次
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <span style={{ color: '#0077B6' }}>建議影片</span>
                    <span className="font-semibold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.trafficSources.suggested)} 次
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(202, 240, 248, 0.3)' }}>
                    <span style={{ color: '#0077B6' }}>外部連結</span>
                    <span className="font-semibold" style={{ color: '#03045E' }}>
                      {formatNumber(selectedVideo.trafficSources.external)} 次
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded font-bold" style={{ backgroundColor: 'rgba(0, 119, 182, 0.1)' }}>
                    <span style={{ color: '#0077B6' }}>總搜尋流量佔比</span>
                    <span style={{ color: '#03045E' }}>
                      {selectedVideo.trafficSources.searchPercentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 更新建議 */}
              <div>
                <h5 className="font-bold mb-3 text-lg" style={{ color: '#03045E' }}>
                  💡 更新建議
                </h5>
                <div className="space-y-2">
                  {selectedVideo.updateReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded"
                      style={{
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid #DC2626',
                        color: '#DC2626',
                      }}
                    >
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI 關鍵字分析 */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h5 className="font-bold text-lg" style={{ color: '#03045E' }}>
                    🤖 AI 關鍵字分析
                  </h5>
                  <button
                    onClick={() => analyzeKeywords(selectedVideo)}
                    disabled={isAnalyzingKeywords}
                    className="px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: '#0077B6',
                      color: 'white',
                    }}
                  >
                    {isAnalyzingKeywords ? '分析中...' : '開始 AI 分析'}
                  </button>
                </div>

                {isAnalyzingKeywords && (
                  <div className="flex justify-center items-center py-8">
                    <Loader />
                  </div>
                )}

                {keywordAnalysis && !isAnalyzingKeywords && (
                  <div className="space-y-4">
                    {/* 關鍵字評分 */}
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: 'rgba(202, 240, 248, 0.3)',
                        border: '1px solid #90E0EF',
                      }}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold" style={{ color: '#03045E' }}>
                          目前關鍵字評分
                        </span>
                        <span
                          className="text-3xl font-bold"
                          style={{
                            color:
                              keywordAnalysis.currentKeywords.score >= 70
                                ? '#10B981'
                                : keywordAnalysis.currentKeywords.score >= 40
                                ? '#F59E0B'
                                : '#DC2626',
                          }}
                        >
                          {keywordAnalysis.currentKeywords.score}/100
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="font-semibold mb-2" style={{ color: '#10B981' }}>
                            ✅ 優勢
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {keywordAnalysis.currentKeywords.strengths.map((s, idx) => (
                              <li key={idx} style={{ color: '#0077B6' }}>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-2" style={{ color: '#DC2626' }}>
                            ⚠️ 需改善
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {keywordAnalysis.currentKeywords.weaknesses.map((w, idx) => (
                              <li key={idx} style={{ color: '#0077B6' }}>
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* 建議關鍵字 */}
                    <div>
                      <p className="font-bold mb-2" style={{ color: '#03045E' }}>
                        🎯 建議關鍵字
                      </p>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-semibold" style={{ color: '#0077B6' }}>
                            核心關鍵字：
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {keywordAnalysis.recommendedKeywords.primary.map((kw, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 rounded-full text-sm font-semibold"
                                style={{
                                  backgroundColor: '#0077B6',
                                  color: 'white',
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-semibold" style={{ color: '#0077B6' }}>
                            次要關鍵字：
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {keywordAnalysis.recommendedKeywords.secondary.map((kw, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 rounded-full text-sm"
                                style={{
                                  backgroundColor: 'rgba(0, 119, 182, 0.2)',
                                  color: '#0077B6',
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-semibold" style={{ color: '#0077B6' }}>
                            長尾關鍵字：
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {keywordAnalysis.recommendedKeywords.longtail.map((kw, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 rounded text-sm"
                                style={{
                                  backgroundColor: 'rgba(202, 240, 248, 0.5)',
                                  color: '#0077B6',
                                  border: '1px solid #90E0EF',
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 標題建議 */}
                    <div>
                      <p className="font-bold mb-2" style={{ color: '#03045E' }}>
                        📝 標題優化建議
                      </p>
                      <div className="space-y-2">
                        {keywordAnalysis.titleSuggestions.map((title, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded"
                            style={{
                              backgroundColor: 'rgba(202, 240, 248, 0.3)',
                              border: '1px solid #90E0EF',
                              color: '#03045E',
                            }}
                          >
                            {idx + 1}. {title}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 說明優化提示 */}
                    <div>
                      <p className="font-bold mb-2" style={{ color: '#03045E' }}>
                        📄 說明優化提示
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {keywordAnalysis.descriptionTips.map((tip, idx) => (
                          <li key={idx} style={{ color: '#0077B6' }}>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 行動計畫 */}
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor:
                          keywordAnalysis.actionPlan.priority === 'high'
                            ? 'rgba(220, 38, 38, 0.1)'
                            : keywordAnalysis.actionPlan.priority === 'medium'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${
                          keywordAnalysis.actionPlan.priority === 'high'
                            ? '#DC2626'
                            : keywordAnalysis.actionPlan.priority === 'medium'
                            ? '#F59E0B'
                            : '#10B981'
                        }`,
                      }}
                    >
                      <p className="font-bold mb-2" style={{ color: '#03045E' }}>
                        🎬 行動計畫
                      </p>
                      <p className="text-sm mb-2" style={{ color: '#0077B6' }}>
                        優先級：
                        <span className="font-semibold">
                          {keywordAnalysis.actionPlan.priority === 'high'
                            ? '高'
                            : keywordAnalysis.actionPlan.priority === 'medium'
                            ? '中'
                            : '低'}
                        </span>{' '}
                        | 預估影響：
                        <span className="font-semibold">
                          {keywordAnalysis.actionPlan.estimatedImpact}
                        </span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1">
                        {keywordAnalysis.actionPlan.steps.map((step, idx) => (
                          <li key={idx} style={{ color: '#0077B6' }}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
