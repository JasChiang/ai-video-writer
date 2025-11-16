import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Settings, Zap, ChevronDown, ChevronUp, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { AIModelSelector, type AIModel } from './AIModelSelector';
import { AnalysisMarkdown } from './AnalysisMarkdown';

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

interface ChannelAnalysisPanelProps {
  channelId: string | null;
  dateRange: { startDate: string; endDate: string };
  videos: any[];
  channelStats: {
    totalViews: number;
    subscriberCount: number;
    totalVideos: number;
  };
  analytics?: {
    subscribersGained?: number;
    subscribersLost?: number;
    avgViewDuration?: number;
    avgViewPercentage?: number;
    trafficSources?: any[];
    searchTerms?: any[];
    demographics?: any[];
    geography?: any[];
    devices?: any[];
  };
}

type ModelSelectionMode = 'auto' | 'manual';

export function ChannelAnalysisPanel({
  channelId,
  dateRange,
  videos,
  channelStats,
  analytics,
}: ChannelAnalysisPanelProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [modelSelectionMode, setModelSelectionMode] = useState<ModelSelectionMode>('auto');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const markActiveStageAsError = useCallback(() => {
    setAnalysisStages((prev) =>
      prev.map((stage) =>
        stage.status === 'active'
          ? {
              ...stage,
              status: 'error',
            }
          : stage
      )
    );
  }, []);

  // 載入可用模型
  useEffect(() => {
    fetch('/api/ai-models/available')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAvailableModels(data.models);
        }
      })
      .catch((err) => console.error('Failed to load available models:', err));
  }, []);

  useEffect(() => {
    if (modelSelectionMode === 'auto') {
      fetch(`/api/ai-models/recommend?analysisType=comprehensive`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setRecommendedModel(data.recommendedModel);
          }
        })
        .catch((err) => console.error('Failed to get recommended model:', err));
    }
  }, [modelSelectionMode]);

  useEffect(() => {
    return () => {
      activeStreamController.current?.abort();
    };
  }, []);

  // 處理分析（SSE 串流）
  const handleAnalyze = async () => {
    if (videos.length === 0) {
      setAnalysisError('沒有可分析的影片數據');
      return;
    }

    startAnalysisStages();
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setStreamingText('');
    setIsStreaming(false);

    try {
      const modelToUse = modelSelectionMode === 'auto' ? recommendedModel : selectedModel;

      if (!modelToUse) {
        throw new Error('請選擇一個 AI 模型');
      }

      const topVideosData = videos.slice(0, 100).map((v) => ({
        videoId: v.videoId || v.id,
        title: v.title,
        publishedAt: v.publishedAt,
        viewCount: v.viewCount || 0,
        likeCount: v.likeCount || 0,
        commentCount: v.commentCount || 0,
        tags: v.tags || [],
      }));

      const controller = new AbortController();
      if (activeStreamController.current) {
        activeStreamController.current.abort();
      }
      activeStreamController.current = controller;

      const response = await fetch('/api/analyze-channel/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          channelId,
          videos: topVideosData,
          channelStats: {
            totalViews: channelStats.totalViews,
            totalSubscribers: channelStats.totalSubscribers,
            totalVideos: channelStats.totalVideos,
            viewsInRange: channelStats.viewsInRange,
            watchTimeHours: channelStats.watchTimeHours,
            subscribersGained: channelStats.subscribersGained,
            videosInRange: channelStats.videosInRange,
          },
          analytics,
          modelType: modelToUse,
          analysisType: 'comprehensive',
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('無法建立串流連線');
      }

      setIsStreaming(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamActive = true;
      let streamCompleted = false;
      let streamErrored = false;

      const parseSseEvent = (rawEvent: string) => {
        const lines = rawEvent.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        return {
          event: eventName,
          data: dataLines.join('\n'),
        };
      };

      const handleServerEvent = (eventName: string, payload: any) => {
        switch (eventName) {
          case 'stage':
            if (payload?.id && payload?.status) {
              setStageStatus(payload.id, payload.status as StageStatus);
            }
            break;
          case 'chunk':
            if (payload?.text) {
              setStreamingText((prev) => prev + payload.text);
            }
            break;
          case 'complete':
            streamCompleted = true;
            setAnalysisResult({
              text: payload.text,
              metadata: payload.metadata || null,
            });
            setStreamingText('');
            setIsStreaming(false);
            break;
          case 'error':
            setAnalysisError(payload?.message || '串流分析失敗');
            markActiveStageAsError();
            setIsStreaming(false);
            streamActive = false;
            streamErrored = true;
            break;
          case 'end':
            streamActive = false;
            break;
          default:
            break;
        }
      };

      while (streamActive) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r/g, '\n');

        let separatorIndex;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          if (!rawEvent.trim()) continue;
          const { event, data } = parseSseEvent(rawEvent);
          if (!data) continue;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (err) {
            console.error('無法解析 SSE 資料:', err);
            continue;
          }
          handleServerEvent(event, parsed);
        }
      }

      reader.releaseLock();
      activeStreamController.current = null;
      setIsStreaming(false);

      if (!streamCompleted && !streamErrored) {
        setAnalysisError('串流中斷，未收到完整回應');
        markActiveStageAsError();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setIsStreaming(false);
        if (activeStreamController.current === controller) {
          activeStreamController.current = null;
        }
        return;
      }
      console.error('Analysis error:', err);
      setAnalysisError(err.message || '分析過程中發生錯誤');
      markActiveStageAsError();
      setIsStreaming(false);
      if (activeStreamController.current === controller) {
        activeStreamController.current?.abort();
        activeStreamController.current = null;
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 獲取推薦模型的詳細信息
  const getRecommendedModelInfo = () => {
    if (!recommendedModel) return null;
    return availableModels.find((m) => m.id === recommendedModel);
  };

  const recommendedModelInfo = getRecommendedModelInfo();
  const shouldShowStageTracker = analysisStages.some((stage) => stage.status !== 'pending');
  const getStageStyle = (status: StageStatus) => {
    switch (status) {
      case 'active':
        return {
          border: 'border-blue-400',
          text: 'text-blue-700',
          icon: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />,
        };
      case 'completed':
        return {
          border: 'border-green-400',
          text: 'text-green-700',
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
        };
      case 'error':
        return {
          border: 'border-red-400',
          text: 'text-red-700',
          icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
        };
      default:
        return {
          border: 'border-gray-200',
          text: 'text-gray-600',
          icon: <Clock className="w-5 h-5 text-gray-400" />,
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* 折疊/展開標題按鈕 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full group"
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-200 bg-gradient-to-r from-white via-red-50/30 to-white shadow-md hover:shadow-xl transition-all duration-300">
          {/* 裝飾性背景 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-100/30 rounded-full blur-3xl -mr-32 -mt-32"></div>

          <div className="relative p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  AI 智慧分析
                </h3>
                <p className="text-sm text-gray-600">
                  深度分析頻道數據，提供專業洞察建議
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isExpanded && (
                <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                  點擊展開
                </span>
              )}
              <div className={`w-10 h-10 rounded-full bg-red-100 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* 可折疊內容區域 */}
      {isExpanded && (
        <div className="space-y-5 animate-fadeIn">
          {/* 模型選擇模式切換 */}
          <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-white to-red-50/30 shadow-sm">
            {/* 裝飾性背景圖案 */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-100/20 to-pink-100/20 rounded-full blur-3xl -mr-32 -mt-32"></div>

            <div className="relative p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <label className="text-sm font-bold text-gray-800">
                    AI 模型選擇
                  </label>
                </div>

                {/* 模式切換按鈕 - YouTube 風格 */}
                <div className="flex gap-1.5 p-1 bg-gray-100/80 backdrop-blur-sm rounded-xl">
                  <button
                    onClick={() => setModelSelectionMode('auto')}
                    disabled={isAnalyzing}
                    className={`
                      relative px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-all duration-300 font-medium
                      ${
                        modelSelectionMode === 'auto'
                          ? 'bg-white text-red-700 shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }
                      ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/50'}
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
                    disabled={isAnalyzing}
                    className={`
                      relative px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-all duration-300 font-medium
                      ${
                        modelSelectionMode === 'manual'
                          ? 'bg-white text-red-700 shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }
                      ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/50'}
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
                  {/* 裝飾性光暈 */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-400/10 rounded-full blur-3xl"></div>

                  <div className="relative flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="font-bold text-gray-900">
                          系統推薦模型
                        </h4>
                        <div className="flex -space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                      <p className="text-sm text-red-700 mb-3 leading-relaxed">
                        根據「<span className="font-semibold">綜合分析</span>」分析類型，系統推薦使用：
                      </p>

                      {/* 推薦的模型卡片 - YouTube 風格 */}
                      <div className="relative overflow-hidden bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-red-300/50 shadow-md hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-100/40 to-transparent rounded-full -mr-16 -mt-16"></div>

                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 text-lg mb-1">
                            {recommendedModelInfo.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium">{recommendedModelInfo.provider}</span>
                            {recommendedModelInfo.useOpenRouter && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">
                                via OpenRouter
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                            recommendedModelInfo.cost === 'low'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : recommendedModelInfo.cost === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {recommendedModelInfo.cost === 'low'
                            ? '經濟'
                            : recommendedModelInfo.cost === 'medium'
                            ? '中等'
                            : '高級'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                        {recommendedModelInfo.description}
                      </p>
                        <div className="flex flex-wrap gap-1.5">
                          {recommendedModelInfo.bestFor.map((use) => (
                            <span
                              key={use}
                              className="text-xs px-2.5 py-1 bg-red-100/70 text-red-700 rounded-lg font-medium"
                            >
                              {use}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
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
                    disabled={isAnalyzing}
                    showComparison={false}
                  />

                  {/* 進階：顯示對比表格 */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="mt-4 px-4 py-2 text-sm flex items-center gap-2 transition-all duration-300 rounded-lg hover:bg-red-50 text-red-700 font-medium group"
                  >
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    ) : (
                      <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    )}
                    {showAdvanced ? '隱藏' : '顯示'}模型對比表格
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 animate-fadeIn">
                      <AIModelSelector
                        models={availableModels}
                        selectedModel={selectedModel}
                        onModelSelect={setSelectedModel}
                        disabled={isAnalyzing}
                        showComparison={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 分析按鈕 - YouTube 紅白風格 */}
          <div className="relative group">
            {/* 背景光暈效果 */}
            {!isAnalyzing && (
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-500 group-hover:duration-200"></div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={
                isAnalyzing ||
                videos.length === 0 ||
                (modelSelectionMode === 'manual' && !selectedModel) ||
                (modelSelectionMode === 'auto' && !recommendedModel)
              }
              className={`
                relative w-full px-8 py-4 rounded-2xl
                flex items-center justify-center gap-3 font-bold text-lg transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isAnalyzing
                  ? 'bg-gray-500 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <div className="relative">
                    <div className="w-6 h-6 border-3 border-white/30 rounded-full"></div>
                    <div className="absolute inset-0 w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">分析中...</span>
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6 animate-pulse" />
                  <span>開始 AI 分析</span>
                  <div className="absolute right-4 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </>
              )}
            </button>
          </div>

          {/* 預估時間提示 - YouTube 風格 */}
          {!isAnalyzing &&
            ((modelSelectionMode === 'auto' && recommendedModel) ||
              (modelSelectionMode === 'manual' && selectedModel)) && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                <span>
                  預估分析時間：<span className="font-semibold text-gray-800">60-90 秒</span>
                  {modelSelectionMode === 'manual' && selectedModel && (() => {
                    const model = availableModels.find((m) => m.id === selectedModel);
                    return model?.cost === 'high' ? (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                        使用高級模型
                      </span>
                    ) : null;
                  })()}
                </span>
              </div>
            )}

      {shouldShowStageTracker && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-semibold text-gray-700">分析進度</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {analysisStages.map((stage) => {
              const style = getStageStyle(stage.status);
              return (
                <div
                  key={stage.id}
                  className={`rounded-xl border ${style.border} bg-white/80 backdrop-blur px-4 py-3 shadow-sm`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {style.icon}
                    <span className={`text-sm font-semibold ${style.text}`}>{stage.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{stage.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isStreaming && (
        <div className="mt-6 p-5 bg-gray-900 text-gray-100 rounded-2xl border border-gray-700 shadow-inner">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-5 h-5 animate-spin text-red-400" />
            <p className="text-sm font-semibold tracking-wide">AI 正在撰寫報告...</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 max-h-64 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {streamingText || '等待模型輸出...'}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            此區為即時輸出，最終會以完整 Markdown 呈現。
          </p>
        </div>
      )}

      {/* 錯誤提示 - 改進版 */}
      {analysisError && (
        <div className="relative overflow-hidden p-5 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200/50 rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-200/20 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <div className="relative flex items-start gap-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">✕</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-900 mb-1">發生錯誤</p>
              <p className="text-sm text-red-700 leading-relaxed">{analysisError}</p>
            </div>
          </div>
        </div>
      )}

          {/* 分析結果 - YouTube 紅白風格 */}
          {analysisResult && (
            <div className="relative">
              {/* 裝飾性背景 */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-pink-50 to-white rounded-3xl opacity-30 blur-2xl"></div>

              <div className="relative space-y-4">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-red-200/50 p-5 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      分析結果
                    </h3>
                  </div>

                  {analysisResult.metadata && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium border border-gray-200">
                        🤖 {analysisResult.metadata.model}
                      </span>
                      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-medium border border-red-200">
                        🏢 {analysisResult.metadata.provider}
                      </span>
                      {analysisResult.metadata.usage?.totalTokens !== undefined && (
                        <span className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg font-medium border border-pink-200">
                          🎯 {analysisResult.metadata.usage.totalTokens.toLocaleString()} tokens
                        </span>
                      )}
                      {analysisResult.metadata.cost && (
                        <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium border border-green-200">
                          💰 ${analysisResult.metadata.cost.toFixed(6)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative overflow-hidden bg-white rounded-2xl border-2 border-gray-200 shadow-xl">
                  {/* 頂部裝飾條 - YouTube 紅色 */}
                  <div className="h-1.5 bg-red-600"></div>

                  <div className="p-8">
                    <AnalysisMarkdown videos={videos}>{analysisResult.text}</AnalysisMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
