import React, { useState, useEffect } from 'react';
import { Loader } from './Loader';
import { SparklesIcon, CheckIcon } from './Icons';
import * as youtubeService from '../services/youtubeService';
import * as geminiService from '../services/geminiService';
import type { GeneratedContentType, YouTubeVideo } from '../types';

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

interface SearchTerm {
  term: string;
  views: number;
  percentage: number;
}

interface ExpandedViewProps {
  video: VideoAnalyticsData;
  keywordAnalysis: KeywordAnalysis | null;
  onAnalyzeKeywords: () => void;
  isAnalyzing: boolean;
  onTrafficSourcesUpdate?: (videoId: string, updates: Partial<TrafficSources>) => void;
}

type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';
interface UpdateState {
  title: UpdateStatus;
  description: UpdateStatus;
  tags: UpdateStatus;
}

export function VideoAnalyticsExpandedView({
  video,
  keywordAnalysis,
  onAnalyzeKeywords,
  isAnalyzing,
  onTrafficSourcesUpdate,
}: ExpandedViewProps) {
  const [showMetadataGenerator, setShowMetadataGenerator] = useState(false);

  // 搜尋字詞狀態
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [isLoadingSearchTerms, setIsLoadingSearchTerms] = useState(false);
  const [searchTermsError, setSearchTermsError] = useState<string | null>(null);

  // 流量來源細節
  const [trafficDetails, setTrafficDetails] = useState<TrafficSources>(video.trafficSources);
  const [isLoadingTrafficDetails, setIsLoadingTrafficDetails] = useState(false);
  const [trafficDetailsError, setTrafficDetailsError] = useState<string | null>(null);

  // 中繼資料生成狀態
  const [fullVideoData, setFullVideoData] = useState<YouTubeVideo | null>(null);
  const [isLoadingVideoData, setIsLoadingVideoData] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentType | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<'titleA' | 'titleB' | 'titleC'>('titleA');
  const [editableContent, setEditableContent] = useState({
    title: video.title,
    description: '',
    tags: '',
  });
  const [youtubeCurrentValues, setYoutubeCurrentValues] = useState({
    title: video.title,
    description: '',
    tags: [] as string[],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>({ title: 'idle', description: 'idle', tags: 'idle' });
  const [geminiFileName, setGeminiFileName] = useState<string | undefined>(undefined);

  // 當生成內容變化時，更新可編輯內容
  useEffect(() => {
    if (generatedContent) {
      setEditableContent({
        title: generatedContent[selectedTitle],
        description: generatedContent.description,
        tags: generatedContent.tags.join(', '),
      });
    }
  }, [generatedContent, selectedTitle]);

  // 同步最新的 trafficSources
  useEffect(() => {
    setTrafficDetails(video.trafficSources);
  }, [video.trafficSources]);

  // 當組件載入時，自動獲取搜尋字詞與外部細節
  useEffect(() => {
    fetchSearchTerms();
    if (!video.trafficSources.externalDetailsLoaded && !isLoadingTrafficDetails) {
      fetchExternalTrafficDetails();
    }
  }, []);

  // 當展開中繼資料生成器時，獲取完整影片資訊
  useEffect(() => {
    if (showMetadataGenerator && !fullVideoData && !isLoadingVideoData) {
      fetchFullVideoData();
    }
  }, [showMetadataGenerator]);

  const fetchSearchTerms = async () => {
    setIsLoadingSearchTerms(true);
    setSearchTermsError(null);
    try {
      const accessToken = youtubeService.getAccessToken();
      if (!accessToken) {
        throw new Error('請先登入 YouTube 帳號');
      }

      // 取得頻道 ID，先嘗試快取，若無則重新查詢
      let channelId = localStorage.getItem('channelId');
      if (!channelId) {
        try {
          channelId = await youtubeService.getChannelId();
          localStorage.setItem('channelId', channelId);
        } catch (channelError: any) {
          throw new Error(channelError?.message || '找不到頻道 ID');
        }
      }

      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/analytics/search-terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          channelId,
          videoId: video.videoId,
          daysThreshold: 365,
          maxResults: 10,
        }),
      });

      if (!response.ok) {
        throw new Error('獲取搜尋字詞失敗');
      }

      const data = await response.json();
      const videoViews = video.metrics.views || 0;
      const normalizedTerms: SearchTerm[] = (data.searchTerms || []).map((term: any) => {
        const views = typeof term.views === 'number' ? term.views : parseFloat(String(term.views)) || 0;
        const percentage = videoViews > 0 ? (views / videoViews) * 100 : 0;
        return {
          term: term.term,
          views,
          percentage,
        };
      });
      setSearchTerms(normalizedTerms);
    } catch (err: any) {
      console.error('[Search Terms] 獲取失敗:', err);
      setSearchTermsError(err.message);
    } finally {
      setIsLoadingSearchTerms(false);
    }
  };

  const fetchExternalTrafficDetails = async () => {
    setIsLoadingTrafficDetails(true);
    setTrafficDetailsError(null);
    try {
      const accessToken = youtubeService.getAccessToken();
      if (!accessToken) {
        throw new Error('請先登入 YouTube 帳號');
      }

      let channelId = localStorage.getItem('channelId');
      if (!channelId) {
        channelId = await youtubeService.getChannelId();
        localStorage.setItem('channelId', channelId);
      }

      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/analytics/external-traffic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          channelId,
          videoId: video.videoId,
          daysThreshold: 365,
          maxResults: 25,
        }),
      });

      if (!response.ok) {
        throw new Error('獲取外部流量細節失敗');
      }

      const data = await response.json();
      const googleSearchViews: number = data.googleSearch || 0;
      const externalViews: number = data.adjustedExternal ?? trafficDetails.external;
      const topExternalSources: { name: string; views: number }[] = data.topExternalSources || [];

      const totalViews = video.metrics.views;
      const updatedSearchPercentage = totalViews > 0
        ? ((trafficDetails.youtubeSearch + googleSearchViews) / totalViews * 100).toFixed(2)
        : '0.00';

      const updatedDetails: TrafficSources = {
        ...trafficDetails,
        googleSearch: googleSearchViews,
        external: externalViews,
        searchPercentage: updatedSearchPercentage,
        topExternalSources,
        externalDetailsLoaded: true,
      };

      setTrafficDetails(updatedDetails);
      onTrafficSourcesUpdate?.(video.videoId, updatedDetails);
    } catch (err: any) {
      console.error('[External Details] 獲取失敗:', err);
      setTrafficDetailsError(err.message);
    } finally {
      setIsLoadingTrafficDetails(false);
    }
  };

  const ensureMetadataHints = (analysis: KeywordAnalysis | null) => {
    const hints = analysis?.metadataHints;
    return {
      titleHooks: Array.isArray(hints?.titleHooks) ? hints!.titleHooks : [],
      descriptionAngles: Array.isArray(hints?.descriptionAngles) ? hints!.descriptionAngles : [],
      callToActions: Array.isArray(hints?.callToActions) ? hints!.callToActions : [],
    };
  };

  const buildMetadataHintText = (analysis: KeywordAnalysis): string => {
    const metadataHints = ensureMetadataHints(analysis);
    const sections: string[] = [];
    if (metadataHints.titleHooks.length > 0) {
      sections.push(['Title Hooks:', ...metadataHints.titleHooks.map(hook => `- ${hook}`)].join('\n'));
    }
    if (metadataHints.descriptionAngles.length > 0) {
      sections.push(['Description Angles:', ...metadataHints.descriptionAngles.map(angle => `- ${angle}`)].join('\n'));
    }
    if (metadataHints.callToActions.length > 0) {
      sections.push(['Call To Actions:', ...metadataHints.callToActions.map(cta => `- ${cta}`)].join('\n'));
    }
    return sections.join('\n\n');
  };

  const handleCopyMetadataHints = async () => {
    if (!keywordAnalysis) return;
    const text = buildMetadataHintText(keywordAnalysis);
    try {
      await navigator.clipboard.writeText(text);
      alert('已複製中繼資料提示，可在生成器中貼上');
    } catch (error) {
      console.error('[Metadata Hints] 複製失敗', error);
      alert('複製失敗，請手動複製內容');
    }
  };

  const handleApplyMetadataHints = () => {
    if (!keywordAnalysis) return;
    const text = buildMetadataHintText(keywordAnalysis);
    setPrompt(text);
    if (!showMetadataGenerator) {
      setShowMetadataGenerator(true);
    }
  };

  const metadataHints = keywordAnalysis ? ensureMetadataHints(keywordAnalysis) : { titleHooks: [], descriptionAngles: [], callToActions: [] };

  const fetchFullVideoData = async () => {
    setIsLoadingVideoData(true);
    try {
      const accessToken = youtubeService.getAccessToken();
      if (!accessToken) {
        throw new Error('請先登入 YouTube 帳號');
      }

      // 使用 YouTube API 獲取完整影片資訊
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${video.videoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('獲取影片資訊失敗');
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const videoData: YouTubeVideo = {
          id: video.videoId,
          title: item.snippet.title,
          description: item.snippet.description || '',
          tags: item.snippet.tags || [],
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || video.thumbnail,
          categoryId: item.snippet.categoryId,
          privacyStatus: item.status?.privacyStatus || 'public',
        };
        setFullVideoData(videoData);
        setYoutubeCurrentValues({
          title: videoData.title,
          description: videoData.description,
          tags: videoData.tags,
        });
        setEditableContent({
          title: videoData.title,
          description: videoData.description,
          tags: videoData.tags.join(', '),
        });
      }
    } catch (err: any) {
      console.error('[VideoData] 獲取失敗:', err);
      setGenerationError(`獲取影片資訊失敗: ${err.message}`);
    } finally {
      setIsLoadingVideoData(false);
    }
  };

  const handleGenerate = async () => {
    if (!fullVideoData) {
      setGenerationError('影片資訊尚未載入');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedContent(null);

    try {
      const result = await geminiService.generateVideoMetadata(
        fullVideoData.id,
        prompt,
        fullVideoData.title,
        fullVideoData.privacyStatus || 'public',
        fullVideoData.thumbnailUrl,
        geminiFileName,
        (step: string) => {
          setLoadingStep(step);
          console.log(`[Progress] ${step}`);
        }
      );

      if (result.geminiFileName) {
        setGeminiFileName(result.geminiFileName);
      }

      setGeneratedContent(result.content);
    } catch (e: any) {
      console.error(e);
      setGenerationError(`生成失敗：${e.message}`);
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  const handleUpdate = async (field: 'title' | 'description' | 'tags') => {
    if (!fullVideoData) return;

    setUpdateState(prev => ({ ...prev, [field]: 'loading' }));
    try {
      const tagsToUpdate = field === 'tags'
        ? editableContent.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : youtubeCurrentValues.tags;

      const videoDataToUpdate: YouTubeVideo = {
        id: fullVideoData.id,
        categoryId: fullVideoData.categoryId,
        title: field === 'title' ? editableContent.title : youtubeCurrentValues.title,
        description: field === 'description' ? editableContent.description : youtubeCurrentValues.description,
        tags: tagsToUpdate,
        thumbnailUrl: fullVideoData.thumbnailUrl,
      };

      await youtubeService.updateVideo(videoDataToUpdate);

      if (field === 'title') {
        setYoutubeCurrentValues(prev => ({ ...prev, title: editableContent.title }));
      } else if (field === 'description') {
        setYoutubeCurrentValues(prev => ({ ...prev, description: editableContent.description }));
      } else if (field === 'tags') {
        setYoutubeCurrentValues(prev => ({ ...prev, tags: tagsToUpdate }));
      }

      setUpdateState(prev => ({ ...prev, [field]: 'success' }));
    } catch (e: any) {
      console.error('Update failed', e);
      setUpdateState(prev => ({ ...prev, [field]: 'error' }));
    } finally {
      setTimeout(() => setUpdateState(prev => ({ ...prev, [field]: 'idle' })), 2000);
    }
  };

  const getButtonContent = (status: UpdateStatus) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>;
      case 'success':
        return <CheckIcon />;
      case 'error':
        return 'Retry';
      default:
        return 'Update';
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

  return (
    <div className="space-y-6">
      {/* YouTube 連結 */}
      <div>
        <a
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline hover:opacity-70 inline-flex items-center gap-2"
          style={{ color: '#DC2626' }}
        >
          🎬 在 YouTube 上查看
        </a>
      </div>

      {/* 核心指標 */}
      <div>
        <h5 className="font-bold mb-3 text-lg" style={{ color: '#1F1F1F' }}>
          📊 核心指標
        </h5>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>觀看次數</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {formatNumber(video.metrics.views)}
            </p>
          </div>
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>平均觀看時長</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {video.metrics.averageViewPercentage}%
            </p>
          </div>
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>讚數比例</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {video.metrics.likeRatio}%
            </p>
          </div>
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>留言數</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {formatNumber(video.metrics.comments)}
            </p>
          </div>
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>分享次數</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {formatNumber(video.metrics.shares)}
            </p>
          </div>
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>新訂閱</p>
            <p className="text-2xl font-bold" style={{ color: '#1F1F1F' }}>
              {formatNumber(video.metrics.subscribersGained)}
            </p>
          </div>
        </div>
      </div>

      {/* 流量來源 */}
      <div>
        <h5 className="font-bold mb-3 text-lg" style={{ color: '#1F1F1F' }}>
          🚦 流量來源
        </h5>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <span style={{ color: '#DC2626' }}>YouTube 搜尋</span>
            <span className="font-semibold" style={{ color: '#1F1F1F' }}>
              {formatNumber(trafficDetails.youtubeSearch)} 次
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <span style={{ color: '#DC2626' }}>Google 搜尋</span>
            <span className="font-semibold" style={{ color: '#1F1F1F' }}>
              {formatNumber(trafficDetails.googleSearch)} 次
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <span style={{ color: '#DC2626' }}>建議影片</span>
            <span className="font-semibold" style={{ color: '#1F1F1F' }}>
              {formatNumber(trafficDetails.suggested)} 次
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>
            <span style={{ color: '#DC2626' }}>外部連結</span>
            <span className="font-semibold" style={{ color: '#1F1F1F' }}>
              {formatNumber(trafficDetails.external)} 次
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded font-bold" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
            <span style={{ color: '#DC2626' }}>總搜尋流量佔比</span>
            <span style={{ color: '#1F1F1F' }}>
              {trafficDetails.searchPercentage}%
            </span>
          </div>
        </div>
        {isLoadingTrafficDetails && (
          <div className="text-sm mt-2" style={{ color: '#DC2626' }}>
            正在載入外部流量細節...
          </div>
        )}
        {trafficDetailsError && (
          <div className="text-sm mt-2" style={{ color: '#DC2626' }}>
            {trafficDetailsError}
          </div>
        )}
        {!isLoadingTrafficDetails && !trafficDetailsError && trafficDetails.topExternalSources?.length > 0 && (
          <div className="mt-3">
            <p className="text-sm mb-2" style={{ color: '#DC2626' }}>外部來源排行</p>
            <div className="space-y-1">
              {trafficDetails.topExternalSources.slice(0, 5).map((source, idx) => (
                <div key={idx} className="flex justify-between text-sm px-3 py-1 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.2)' }}>
                  <span style={{ color: '#1F1F1F' }}>{source.name || '未知來源'}</span>
                  <span style={{ color: '#DC2626' }}>{formatNumber(source.views)} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 搜尋字詞 */}
      <div>
        <h5 className="font-bold mb-3 text-lg" style={{ color: '#1F1F1F' }}>
          🔍 YouTube 搜尋字詞（近 1 年）
        </h5>

        {isLoadingSearchTerms && (
          <div className="flex items-center justify-center py-4">
            <Loader />
            <span className="ml-3" style={{ color: '#DC2626' }}>載入搜尋字詞中...</span>
          </div>
        )}

        {searchTermsError && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#DC2626' }}>
            {searchTermsError}
          </div>
        )}

        {!isLoadingSearchTerms && !searchTermsError && searchTerms.length === 0 && (
          <div className="p-3 rounded" style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)', color: '#DC2626' }}>
            此影片暫無搜尋字詞資料（可能是搜尋流量不足或影片太新）
          </div>
        )}

        {!isLoadingSearchTerms && !searchTermsError && searchTerms.length > 0 && (
          <div className="space-y-2">
            {searchTerms.map((term, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 rounded"
                style={{ backgroundColor: 'rgba(254, 202, 202, 0.3)' }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span
                    className="font-bold text-lg"
                    style={{
                      color: idx < 3 ? '#DC2626' : '#1F1F1F',
                      minWidth: '30px',
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: '#1F1F1F' }}
                  >
                    {term.term}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="text-sm"
                    style={{ color: '#DC2626' }}
                  >
                    {formatNumber(term.views)} 次觀看
                  </span>
                  <span
                    className="font-bold"
                    style={{
                      color: '#DC2626',
                      minWidth: '60px',
                      textAlign: 'right',
                    }}
                  >
                    {term.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={onAnalyzeKeywords}
          disabled={isAnalyzing}
          className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
          style={{
            backgroundColor: '#DC2626',
            color: 'white',
          }}
        >
          {isAnalyzing ? '分析中...' : (keywordAnalysis ? '✓ 已分析 - 重新分析' : '🤖 AI 關鍵字分析')}
        </button>
        <button
          onClick={() => setShowMetadataGenerator(!showMetadataGenerator)}
          className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#FECACA',
            color: '#1F1F1F',
          }}
        >
          {showMetadataGenerator ? '✕ 關閉中繼資料生成' : '✨ 生成中繼資料'}
        </button>
      </div>

      {/* AI 關鍵字分析結果 */}
      {isAnalyzing && (
        <div className="flex justify-center items-center py-8">
          <Loader />
        </div>
      )}

      {keywordAnalysis && !isAnalyzing && (
        <div className="space-y-4">
          {/* 關鍵字評分 */}
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: 'rgba(254, 202, 202, 0.3)',
              border: '1px solid #FECACA',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold" style={{ color: '#1F1F1F' }}>
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
                    <li key={idx} style={{ color: '#DC2626' }}>
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
                    <li key={idx} style={{ color: '#DC2626' }}>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 建議關鍵字 */}
          <div>
            <p className="font-bold mb-2" style={{ color: '#1F1F1F' }}>
              🎯 建議關鍵字
            </p>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  核心關鍵字：
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {keywordAnalysis.recommendedKeywords.primary.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: '#DC2626',
                        color: 'white',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  次要關鍵字：
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {keywordAnalysis.recommendedKeywords.secondary.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: 'rgba(254, 202, 202, 0.2)',
                        color: '#DC2626',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  長尾關鍵字：
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {keywordAnalysis.recommendedKeywords.longtail.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded text-sm"
                      style={{
                        backgroundColor: 'rgba(254, 202, 202, 0.5)',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 中繼資料提示 */}
          {(metadataHints.titleHooks.length > 0 ||
            metadataHints.descriptionAngles.length > 0 ||
            metadataHints.callToActions.length > 0) && (
            <div
              className="p-4 rounded-lg space-y-3"
              style={{
                backgroundColor: 'rgba(254, 202, 202, 0.3)',
                border: '1px solid #FECACA',
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold" style={{ color: '#1F1F1F' }}>
                  ✨ 中繼資料提示
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyMetadataHints}
                    className="px-3 py-1 text-sm rounded border"
                    style={{ borderColor: '#DC2626', color: '#DC2626' }}
                  >
                    📋 複製
                  </button>
                  <button
                    onClick={handleApplyMetadataHints}
                    className="px-3 py-1 text-sm rounded border"
                    style={{ borderColor: '#DC2626', color: '#DC2626' }}
                  >
                    ➕ 套用到生成器
                  </button>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {metadataHints.titleHooks.length > 0 && (
                  <div>
                    <p className="font-semibold" style={{ color: '#DC2626' }}>
                      標題切入點
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {metadataHints.titleHooks.map((hook, idx) => (
                        <li key={idx} style={{ color: '#1F1F1F' }}>{hook}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {metadataHints.descriptionAngles.length > 0 && (
                  <div>
                    <p className="font-semibold" style={{ color: '#DC2626' }}>
                      說明撰寫方向
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {metadataHints.descriptionAngles.map((angle, idx) => (
                        <li key={idx} style={{ color: '#1F1F1F' }}>{angle}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {metadataHints.callToActions.length > 0 && (
                  <div>
                    <p className="font-semibold" style={{ color: '#DC2626' }}>
                      Call-to-Action 點子
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {metadataHints.callToActions.map((cta, idx) => (
                        <li key={idx} style={{ color: '#1F1F1F' }}>{cta}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 標題建議 */}
          <div>
            <p className="font-bold mb-2" style={{ color: '#1F1F1F' }}>
              📝 標題優化建議
            </p>
            <div className="space-y-2">
              {keywordAnalysis.titleSuggestions.map((title, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded"
                  style={{
                    backgroundColor: 'rgba(254, 202, 202, 0.3)',
                    border: '1px solid #FECACA',
                    color: '#1F1F1F',
                  }}
                >
                  {idx + 1}. {title}
                </div>
              ))}
            </div>
          </div>

          {/* 說明優化提示 */}
          <div>
            <p className="font-bold mb-2" style={{ color: '#1F1F1F' }}>
              📄 說明優化提示
            </p>
            <ul className="list-disc list-inside space-y-1">
              {keywordAnalysis.descriptionTips.map((tip, idx) => (
                <li key={idx} style={{ color: '#DC2626' }}>
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
            <h6 className="font-bold mb-2" style={{ color: '#1F1F1F' }}>
              📋 行動計畫
            </h6>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">優先級：</span>
                <span
                  className="ml-2 px-2 py-1 rounded"
                  style={{
                    backgroundColor:
                      keywordAnalysis.actionPlan.priority === 'high'
                        ? '#DC2626'
                        : keywordAnalysis.actionPlan.priority === 'medium'
                        ? '#F59E0B'
                        : '#10B981',
                    color: 'white',
                  }}
                >
                  {keywordAnalysis.actionPlan.priority === 'high'
                    ? '高'
                    : keywordAnalysis.actionPlan.priority === 'medium'
                    ? '中'
                    : '低'}
                </span>
              </p>
              <p>
                <span className="font-semibold">預估影響：</span>
                {keywordAnalysis.actionPlan.estimatedImpact}
              </p>
              <div>
                <p className="font-semibold mb-1">執行步驟：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  {keywordAnalysis.actionPlan.steps.map((step, idx) => (
                    <li key={idx} style={{ color: '#DC2626' }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 中繼資料生成器 */}
      {showMetadataGenerator && (
        <div
          className="p-6 rounded-lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '2px solid #DC2626',
          }}
        >
          <h5 className="font-bold mb-4 text-lg" style={{ color: '#1F1F1F' }}>
            ✨ Gemini AI 中繼資料生成器
          </h5>

          {/* 載入影片資訊中 */}
          {isLoadingVideoData && (
            <div className="flex items-center justify-center py-8">
              <Loader />
              <span className="ml-3" style={{ color: '#DC2626' }}>正在載入影片資訊...</span>
            </div>
          )}

          {/* 載入失敗或尚未生成 */}
          {!isLoadingVideoData && fullVideoData && (
            <>
              {/* Prompt Input */}
              {!generatedContent && !isGenerating && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: '#1F1F1F' }}>
                    額外提示（選填）
                  </label>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例如：適合初學者的有趣教學"
                    className="w-full rounded-md px-3 py-2 focus:outline-none"
                    style={{
                      backgroundColor: 'rgba(254, 202, 202, 0.5)',
                      border: '1px solid #FECACA',
                      color: '#1F1F1F'
                    }}
                  />
                </div>
              )}

              {/* Generate Button */}
              {!generatedContent && !isGenerating && !generationError && (
                <div className="space-y-3">
                  <button
                    onClick={handleGenerate}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    <SparklesIcon /> 使用 Gemini AI 生成 SEO 強化內容
                  </button>
                  <div className="space-y-2">
                    <p className="text-xs text-center" style={{ color: '#DC2626' }}>
                      Gemini AI 將分析影片內容，自動生成三種風格標題、章節時間軸及 SEO 標籤
                    </p>
                    <p className="text-xs text-center" style={{ color: '#FECACA' }}>
                      💡 處理流程：檢查雲端檔案 → 分析影片內容 → 生成 SEO 強化建議（公開影片約 30 秒，未列出影片首次需下載約 2-5 分鐘）
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isGenerating && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #B91C1C' }}>
                  <div className="flex items-center gap-3">
                    <Loader />
                    <span className="text-sm" style={{ color: '#DC2626' }}>{loadingStep}</span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {generationError && (
                <div className="p-3 rounded-lg text-sm mb-4" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#DC2626' }}>
                  {generationError}
                  <button
                    onClick={handleGenerate}
                    className="mt-2 px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90"
                    style={{ backgroundColor: '#DC2626', color: 'white' }}
                  >
                    重試
                  </button>
                </div>
              )}

              {/* Generated Content Form */}
              {generatedContent && (
                <div className="space-y-4 animate-fade-in">
                  {/* Title Options */}
                  <div>
                    <label className="text-sm font-semibold mb-1 block" style={{ color: '#1F1F1F' }}>建議標題（請選擇一個）</label>
                    <p className="text-xs mb-2" style={{ color: '#FECACA' }}>
                      💡 Gemini AI 提供三種不同風格的標題，點選即可選擇並編輯
                    </p>
                    <div className="space-y-2 mb-3">
                      <div
                        onClick={() => setSelectedTitle('titleA')}
                        className="p-3 rounded-lg cursor-pointer transition-all border-2"
                        style={{
                          backgroundColor: selectedTitle === 'titleA' ? '#DC2626' : 'rgba(254, 202, 202, 0.5)',
                          borderColor: selectedTitle === 'titleA' ? '#B91C1C' : '#FECACA',
                          color: selectedTitle === 'titleA' ? 'white' : '#1F1F1F'
                        }}
                      >
                        <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleA' ? 'rgba(255,255,255,0.8)' : '#DC2626' }}>選項 A（關鍵字導向）</div>
                        <div>{generatedContent.titleA}</div>
                      </div>
                      <div
                        onClick={() => setSelectedTitle('titleB')}
                        className="p-3 rounded-lg cursor-pointer transition-all border-2"
                        style={{
                          backgroundColor: selectedTitle === 'titleB' ? '#DC2626' : 'rgba(254, 202, 202, 0.5)',
                          borderColor: selectedTitle === 'titleB' ? '#B91C1C' : '#FECACA',
                          color: selectedTitle === 'titleB' ? 'white' : '#1F1F1F'
                        }}
                      >
                        <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleB' ? 'rgba(255,255,255,0.8)' : '#DC2626' }}>選項 B（懸念/好奇心導向）</div>
                        <div>{generatedContent.titleB}</div>
                      </div>
                      <div
                        onClick={() => setSelectedTitle('titleC')}
                        className="p-3 rounded-lg cursor-pointer transition-all border-2"
                        style={{
                          backgroundColor: selectedTitle === 'titleC' ? '#DC2626' : 'rgba(254, 202, 202, 0.5)',
                          borderColor: selectedTitle === 'titleC' ? '#B91C1C' : '#FECACA',
                          color: selectedTitle === 'titleC' ? 'white' : '#1F1F1F'
                        }}
                      >
                        <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleC' ? 'rgba(255,255,255,0.8)' : '#DC2626' }}>選項 C（結果/效益導向）</div>
                        <div>{generatedContent.titleC}</div>
                      </div>
                    </div>

                    {/* Editable Title */}
                    <label className="text-xs mb-1 block" style={{ color: '#DC2626' }}>編輯選定的標題</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={editableContent.title}
                        onChange={e => setEditableContent(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-md px-3 py-2 focus:outline-none"
                        style={{
                          backgroundColor: 'rgba(254, 202, 202, 0.5)',
                          border: '1px solid #FECACA',
                          color: '#1F1F1F'
                        }}
                      />
                      <button onClick={() => handleUpdate('title')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#DC2626' }}>
                        {getButtonContent(updateState.title)}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-semibold" style={{ color: '#1F1F1F' }}>影片說明（包含章節與標籤）</label>
                    <div className="text-xs mb-1 space-y-0.5" style={{ color: '#DC2626' }}>
                      <p>此欄位包含完整的影片說明、章節導覽和說明用標籤</p>
                      <p style={{ color: '#FECACA' }}>💡 Gemini AI 會自動生成章節時間軸（格式：00:00），並在說明中加入相關標籤以提升搜尋能見度</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <textarea
                        value={editableContent.description}
                        onChange={e => setEditableContent(prev => ({ ...prev, description: e.target.value }))}
                        rows={8}
                        className="w-full rounded-md px-3 py-2 font-mono text-sm focus:outline-none"
                        style={{
                          backgroundColor: 'rgba(254, 202, 202, 0.5)',
                          border: '1px solid #FECACA',
                          color: '#1F1F1F'
                        }}
                      />
                      <button onClick={() => handleUpdate('description')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#DC2626' }}>
                        {getButtonContent(updateState.description)}
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-sm font-semibold" style={{ color: '#1F1F1F' }}>SEO 標籤（逗號分隔）</label>
                    <p className="text-xs mb-1" style={{ color: '#DC2626' }}>
                      💡 這些標籤將用於 YouTube 的標籤欄位，幫助搜尋演算法理解影片內容
                    </p>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={editableContent.tags}
                        onChange={e => setEditableContent(prev => ({ ...prev, tags: e.target.value }))}
                        className="w-full rounded-md px-3 py-2 focus:outline-none font-mono text-sm"
                        style={{
                          backgroundColor: 'rgba(254, 202, 202, 0.5)',
                          border: '1px solid #FECACA',
                          color: '#1F1F1F'
                        }}
                      />
                      <button onClick={() => handleUpdate('tags')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#DC2626' }}>
                        {getButtonContent(updateState.tags)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
