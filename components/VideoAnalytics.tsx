import { useState, useEffect, useCallback, useRef } from 'react';
import { AppIcon } from './AppIcon';
import { AnalysisMarkdown } from './AnalysisMarkdown';
import * as youtubeService from '../services/youtubeService';
import { loadVideoDetailsBatch } from '../services/videoCacheClient';
import { Loader } from './Loader';
import { AIModelSelector, type AIModel } from './AIModelSelector';
import { Sparkles, Settings, ChevronDown, ChevronUp } from 'lucide-react';

interface VideoAnalyticsData {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

type StageStatus = 'pending' | 'active' | 'completed' | 'error';

interface AnalysisStageDefinition {
  id: string;
  label: string;
  description: string;
}

interface AnalysisStage extends AnalysisStageDefinition {
  status: StageStatus;
}

const ANALYSIS_STAGE_TEMPLATE: AnalysisStageDefinition[] = [
  {
    id: 'prepare',
    label: '整理頻道資料',
    description: '彙整頻道指標與影片樣本',
  },
  {
    id: 'request',
    label: 'AI 生成中',
    description: '正在等待模型完成分析',
  },
  {
    id: 'render',
    label: '整理分析報告',
    description: '套用 Markdown、圖表與影片卡片',
  },
];

type ModelSelectionMode = 'auto' | 'manual';

export function VideoAnalytics() {
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<VideoAnalyticsData[]>([]);
  const [channelStats, setChannelStats] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const activeStreamController = useRef<AbortController | null>(null);
  const [analysisStages, setAnalysisStages] = useState<AnalysisStage[]>(
    () =>
      ANALYSIS_STAGE_TEMPLATE.map((stage) => ({
        ...stage,
        status: 'pending',
      }))
  );

  // Model Selection State
  const [modelSelectionMode, setModelSelectionMode] = useState<ModelSelectionMode>('auto');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const startAnalysisStages = useCallback(() => {
    setAnalysisStages(
      ANALYSIS_STAGE_TEMPLATE.map((stage, index) => ({
        ...stage,
        status: index === 0 ? 'active' : 'pending',
      }))
    );
  }, []);

  const setStageStatus = useCallback((stageId: string, status: StageStatus) => {
    setAnalysisStages((prev) =>
      prev.map((stage) =>
        stage.id === stageId
          ? {
            ...stage,
            status,
          }
          : stage
      )
    );
  }, []);

  useEffect(() => {
    return () => {
      activeStreamController.current?.abort();
    };
  }, []);

  // 初始化：載入模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch('/api/ai-models/available');
        const data = await res.json();

        if (data.success && Array.isArray(data.models)) {
          setAvailableModels(data.models);

          // 設定預設推薦模型 (Gemini 2.0 Flash Thinking)
          const models = data.models;
          const defaultModel = models.find((m: AIModel) => m.id.includes('gemini-2.0-flash-thinking'))?.id ||
            models.find((m: AIModel) => m.id.includes('gemini'))?.id ||
            models[0]?.id;

          if (defaultModel) {
            setRecommendedModel(defaultModel);
            setSelectedModel(defaultModel);
          }
        }
      } catch (error) {
        console.error('Failed to load AI models:', error);
      }
    };
    loadModels();
  }, []);

  const [videoRange, setVideoRange] = useState<'recent' | 'year-old' | 'two-years-old'>('recent');

  // 初始化：載入影片數據
  const fetchVideos = useCallback(async (range: 'recent' | 'year-old' | 'two-years-old') => {
    setIsLoading(true);
    setVideos([]); // 清空現有影片
    try {
      // 1. 獲取頻道 ID
      const channelId = await youtubeService.getChannelId();
      if (!channelId) throw new Error('無法獲取頻道 ID');

      // 2. 獲取頻道統計
      const stats = await youtubeService.getChannelStats(channelId);
      setChannelStats(stats);

      // 3. 根據篩選範圍獲取影片
      let targetVideos: any[] = [];

      if (range === 'recent') {
        // 獲取最近影片 (確保取足 50 支)
        let allVideos: any[] = [];
        let nextPageToken: string | undefined = undefined;
        let fetchCount = 0;

        while (allVideos.length < 50 && fetchCount < 3) {
          const videoResponse: any = await youtubeService.listVideos(
            50,
            nextPageToken,
            false,
            undefined,
            false,
            { source: 'VideoAnalytics' }
          );

          if (videoResponse.videos) {
            allVideos = [...allVideos, ...videoResponse.videos];
          }

          nextPageToken = videoResponse.nextPageToken;
          fetchCount++;

          if (!nextPageToken) break;
        }
        targetVideos = allVideos.slice(0, 50);
      } else {
        // 獲取老舊影片 (使用快取 API)
        console.log('[VideoAnalytics] Fetching from cache for old videos...');
        const response = await fetch('/api/video-cache/search?maxResults=10000');
        if (!response.ok) {
          throw new Error('無法從快取載入影片資料，請確認伺服器設定');
        }
        const data = await response.json();
        const allCachedVideos = data.videos || [];

        const date = new Date();
        if (range === 'year-old') {
          date.setFullYear(date.getFullYear() - 1);
        } else if (range === 'two-years-old') {
          date.setFullYear(date.getFullYear() - 2);
        }

        // 篩選符合日期的影片
        const filteredVideos = allCachedVideos.filter((v: any) => {
          if (!v.publishedAt) return false;
          return new Date(v.publishedAt) < date;
        });

        // 取前 75 支 (多取一些以備過濾非公開影片)
        const selectedCachedVideos = filteredVideos.slice(0, 75);
        const videoIds = selectedCachedVideos.map((v: any) => v.videoId);

        if (videoIds.length > 0) {
          // 獲取完整詳細資訊 (包含 description)
          const details = await loadVideoDetailsBatch(videoIds);
          // 過濾非公開影片
          targetVideos = details.filter((v: any) => v.privacyStatus === 'public').slice(0, 50);
        }
      }

      const formattedVideos = targetVideos
        .filter((v: any) => v.privacyStatus === 'public') // 再次確保只包含公開影片
        .map((v: any) => ({
          videoId: v.id,
          title: v.title,
          description: v.description,
          tags: v.tags || [],
          publishedAt: v.publishedAt,
          thumbnail: v.thumbnailUrl,
          viewCount: parseInt(v.viewCount || '0'),
          likeCount: parseInt(v.likeCount || '0'),
          commentCount: parseInt(v.commentCount || '0'),
        }));

      setVideos(formattedVideos);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setAnalysisError(err.message || '載入數據失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(videoRange);
  }, [fetchVideos, videoRange]);

  const handleAnalyze = async () => {
    if (videos.length === 0) {
      setAnalysisError('沒有可分析的影片數據');
      return;
    }

    const modelToUse = modelSelectionMode === 'auto' ? recommendedModel : selectedModel;
    if (!modelToUse) {
      setAnalysisError('請選擇 AI 模型');
      return;
    }

    startAnalysisStages();
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setStreamingText('');
    setIsStreaming(false);

    try {
      const controller = new AbortController();
      if (activeStreamController.current) {
        activeStreamController.current.abort();
      }
      activeStreamController.current = controller;

      const channelId = await youtubeService.getChannelId();

      const response = await fetch('/api/analyze-channel/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 預設一年
          endDate: new Date().toISOString().split('T')[0],
          channelId,
          videos,
          channelStats: {
            totalViews: parseInt(channelStats?.viewCount || '0'),
            subscriberCount: parseInt(channelStats?.subscriberCount || '0'),
            totalVideos: parseInt(channelStats?.videoCount || '0'),
          },
          analysisType: 'content-optimization', // 指定新的分析類型
          modelType: modelToUse, // 使用選擇的模型
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          const blockLines = block.split('\n');
          let eventType = '';
          let data = null;

          for (const line of blockLines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              try {
                data = JSON.parse(line.substring(6));
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }

          if (eventType && data) {
            console.log(`[VideoAnalytics] Received event: ${eventType}`, data);
            switch (eventType) {
              case 'stage':
                setStageStatus(data.id, data.status);
                break;
              case 'chunk':
                setStreamingText((prev) => prev + data.text);
                break;
              case 'complete':
                setAnalysisResult(data);
                setIsStreaming(false);
                break;
              case 'error':
                throw new Error(data.message);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Analysis aborted');
      } else {
        console.error('Analysis failed:', err);
        let errorMessage = err.message || '分析過程中發生錯誤';

        // 處理 503 Service Unavailable (模型過載)
        if (errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('overloaded')) {
          errorMessage = 'AI 模型目前負載過高 (503)，請稍後再試，或嘗試切換其他模型。';
        }

        setAnalysisError(errorMessage);
        setAnalysisStages((prev) =>
          prev.map((stage) =>
            stage.status === 'active' ? { ...stage, status: 'error' } : stage
          )
        );
      }
      setIsAnalyzing(false);
      setIsStreaming(false);
    } finally {
      activeStreamController.current = null;
    }
  };

  // 獲取推薦模型的詳細信息
  const getRecommendedModelInfo = () => {
    if (!recommendedModel) return null;
    return availableModels.find((m) => m.id === recommendedModel);
  };

  const recommendedModelInfo = getRecommendedModelInfo();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 標題與說明 */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-neutral-900 flex items-center justify-center gap-2">
          <AppIcon name="analytics" size={28} className="text-red-600" />
          內容優化報告
        </h2>
        <p className="text-lg text-neutral-600">
          AI 智能診斷：找出建議隱藏的過期影片與標題優化機會
        </p>
      </div>

      {/* 初始載入狀態 */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}

      {/* 分析按鈕與模型選擇 (尚未開始分析且資料已載入) */}
      {!isLoading && !isAnalyzing && !analysisResult && !analysisError && videos.length > 0 && (
        <div className="space-y-6">
          {/* 影片範圍篩選 */}
          <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <AppIcon name="filter" className="w-5 h-5 text-red-600" />
              選擇分析影片範圍
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => setVideoRange('recent')}
                className={`px-4 py-2 rounded-lg border transition-colors ${videoRange === 'recent'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
              >
                最近 50 支影片
              </button>
              <button
                onClick={() => setVideoRange('year-old')}
                className={`px-4 py-2 rounded-lg border transition-colors ${videoRange === 'year-old'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
              >
                一年以上的影片
              </button>
              <button
                onClick={() => setVideoRange('two-years-old')}
                className={`px-4 py-2 rounded-lg border transition-colors ${videoRange === 'two-years-old'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
              >
                兩年以上的影片
              </button>
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              {videoRange === 'recent' && '分析頻道最新的影片表現，適合日常優化。'}
              {videoRange === 'year-old' && '找出發布超過 1 年的影片，評估是否過期或需更新。'}
              {videoRange === 'two-years-old' && '找出發布超過 2 年的影片，進行深度內容清理。'}
            </p>
          </div>

          {/* AI 模型選擇 */}
          <div className="bg-white rounded-xl border border-red-100 p-6 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <label className="text-sm font-bold text-gray-800">
                  AI 模型選擇
                </label>
              </div>

              {/* 模式切換按鈕 */}
              <div className="flex gap-1.5 p-1 bg-gray-100/80 backdrop-blur-sm rounded-xl">
                <button
                  onClick={() => setModelSelectionMode('auto')}
                  className={`
                    relative px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-all duration-300 font-medium
                    ${modelSelectionMode === 'auto'
                      ? 'bg-white text-red-700 shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  <Sparkles className={`w-4 h-4 ${modelSelectionMode === 'auto' ? 'animate-pulse' : ''}`} />
                  智慧推薦
                  {modelSelectionMode === 'auto' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </button>

                <button
                  onClick={() => setModelSelectionMode('manual')}
                  className={`
                    relative px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-all duration-300 font-medium
                    ${modelSelectionMode === 'manual'
                      ? 'bg-white text-red-700 shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  <Settings className="w-4 h-4" />
                  手動選擇
                  {modelSelectionMode === 'manual' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              </div>
            </div>

            {/* 智能推薦模式 */}
            {modelSelectionMode === 'auto' && recommendedModelInfo && (
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-50 via-red-50/70 to-pink-50/50 border-2 border-red-200/50 p-4 shadow-sm">
                <div className="relative flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-bold text-gray-900">系統推薦模型</h4>
                    </div>
                    <p className="text-sm text-red-700 mb-3 leading-relaxed">
                      系統推薦使用：<span className="font-semibold">{recommendedModelInfo?.name}</span>
                    </p>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      {recommendedModelInfo?.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 手動選擇模式 */}
            {modelSelectionMode === 'manual' && (
              <div>
                <AIModelSelector
                  models={availableModels}
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  disabled={false}
                  showComparison={false}
                />
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="mt-4 px-4 py-2 text-sm flex items-center gap-2 transition-all duration-300 rounded-lg hover:bg-red-50 text-red-700 font-medium group"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAdvanced ? '隱藏' : '顯示'}模型對比表格
                </button>
                {showAdvanced && (
                  <div className="mt-4 animate-fadeIn">
                    <AIModelSelector
                      models={availableModels}
                      selectedModel={selectedModel}
                      onModelSelect={setSelectedModel}
                      disabled={false}
                      showComparison={true}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center py-4">
            <button
              onClick={handleAnalyze}
              className="px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg bg-gradient-to-r from-red-600 to-red-500 text-white flex items-center gap-3"
            >
              <AppIcon name="sparkles" size={24} className="text-yellow-300" />
              開始 AI 內容診斷
            </button>
          </div>
        </div>
      )}

      {/* 分析過程與結果顯示 */}
      {(isAnalyzing || analysisResult || analysisError) && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* 進度條 */}
          {isAnalyzing && !analysisResult && (
            <div className="p-6 border-b border-neutral-100 bg-neutral-50">
              <div className="flex justify-between items-center mb-4">
                {analysisStages.map((stage, index) => (
                  <div key={stage.id} className="flex flex-col items-center flex-1 relative">
                    {/* 連接線 */}
                    {index < analysisStages.length - 1 && (
                      <div className={`absolute top-4 left-1/2 w-full h-0.5 -z-0 ${analysisStages[index + 1]?.status !== 'pending' ? 'bg-red-500' : 'bg-neutral-200'
                        }`} />
                    )}

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 mb-2 transition-colors duration-300 ${stage.status === 'completed' ? 'bg-red-600 text-white' :
                      stage.status === 'active' ? 'bg-red-100 text-red-600 border-2 border-red-600' :
                        stage.status === 'error' ? 'bg-red-100 text-red-600' :
                          'bg-neutral-200 text-neutral-400'
                      }`}>
                      {stage.status === 'completed' ? (
                        <AppIcon name="check" size={16} />
                      ) : stage.status === 'active' ? (
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${stage.status === 'active' ? 'text-red-600' : 'text-neutral-600'
                      }`}>
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {analysisError && (
            <div className="p-6 bg-red-50 border-b border-red-100 text-center">
              <p className="text-red-600 font-medium mb-4">{analysisError}</p>
              <button
                onClick={handleAnalyze}
                className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                重試
              </button>
            </div>
          )}

          {/* Markdown 內容 */}
          <div className="p-6 min-h-[400px]">
            <AnalysisMarkdown
              isStreaming={isStreaming}
              videos={videos.map(v => ({
                id: v.videoId,
                title: v.title,
                description: v.description,
                thumbnailUrl: v.thumbnail,
                tags: v.tags,
                categoryId: '', // Default or missing
                publishedAt: v.publishedAt,
                viewCount: v.viewCount.toString(),
                likeCount: v.likeCount.toString(),
                commentCount: v.commentCount.toString(),
              }))}
            >
              {analysisResult ? analysisResult.text : streamingText}
            </AnalysisMarkdown>
          </div>

          {/* 底部操作列 */}
          {analysisResult && (
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                onClick={handleAnalyze}
                className="px-4 py-2 text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-2"
              >
                <AppIcon name="refresh" size={16} />
                重新分析
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
