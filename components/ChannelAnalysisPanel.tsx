import React, { useState, useEffect } from 'react';
import { Sparkles, Settings, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisTypeSelector, type AnalysisType } from './AnalysisTypeSelector';
import { AIModelSelector, type AIModel } from './AIModelSelector';
import ReactMarkdown from 'react-markdown';

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
  const [analysisType, setAnalysisType] = useState<AnalysisType>('comprehensive');
  const [modelSelectionMode, setModelSelectionMode] = useState<ModelSelectionMode>('auto');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [multiModelMode, setMultiModelMode] = useState(false);

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

  // 當分析類型改變時，獲取推薦模型
  useEffect(() => {
    if (modelSelectionMode === 'auto' && analysisType) {
      fetch(`/api/ai-models/recommend?analysisType=${analysisType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setRecommendedModel(data.recommendedModel);
          }
        })
        .catch((err) => console.error('Failed to get recommended model:', err));
    }
  }, [analysisType, modelSelectionMode]);

  // 處理分析
  const handleAnalyze = async () => {
    if (videos.length === 0) {
      setAnalysisError('沒有可分析的影片數據');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

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

      const response = await fetch('/api/analyze-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          channelId,
          videos: topVideosData,
          channelStats: {
            totalViews: channelStats.totalViews,
            subscriberCount: channelStats.subscriberCount,
            totalVideos: channelStats.totalVideos,
          },
          analytics,
          modelType: modelToUse,
          analysisType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisResult({
          text: data.analysis,
          metadata: data.metadata,
        });
      } else {
        throw new Error(data.error || '分析失敗');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setAnalysisError(err.message || '分析過程中發生錯誤');
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

  return (
    <div className="space-y-6">
      {/* 分析類型選擇 */}
      <div>
        <AnalysisTypeSelector
          selectedType={analysisType}
          onTypeSelect={setAnalysisType}
          disabled={isAnalyzing}
        />
      </div>

      {/* 模型選擇模式切換 */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium" style={{ color: '#03045E' }}>
            AI 模型選擇
          </label>

          {/* 模式切換按鈕 */}
          <div className="flex gap-2">
            <button
              onClick={() => setModelSelectionMode('auto')}
              disabled={isAnalyzing}
              className={`
                px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-all
                ${
                  modelSelectionMode === 'auto'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Sparkles className="w-4 h-4" />
              智能推薦
            </button>

            <button
              onClick={() => setModelSelectionMode('manual')}
              disabled={isAnalyzing}
              className={`
                px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-all
                ${
                  modelSelectionMode === 'manual'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Settings className="w-4 h-4" />
              手動選擇
            </button>
          </div>
        </div>

        {/* 智能推薦模式 */}
        {modelSelectionMode === 'auto' && recommendedModelInfo && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1" style={{ color: '#03045E' }}>
                  系統推薦模型
                </h4>
                <p className="text-sm mb-2" style={{ color: '#0077B6' }}>
                  根據「
                  {
                    analysisType === 'subscriber-growth' ? '訂閱成長分析' :
                    analysisType === 'view-optimization' ? '觀看優化分析' :
                    analysisType === 'content-strategy' ? '內容策略分析' :
                    analysisType === 'audience-insights' ? '觀眾洞察分析' :
                    '綜合分析'
                  }
                  」分析類型，系統推薦使用：
                </p>

                {/* 推薦的模型卡片 */}
                <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold" style={{ color: '#03045E' }}>
                        {recommendedModelInfo.name}
                      </div>
                      <div className="text-xs" style={{ color: '#6B7280' }}>
                        {recommendedModelInfo.provider}
                        {recommendedModelInfo.useOpenRouter && (
                          <span className="ml-1 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            via OpenRouter
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        recommendedModelInfo.cost === 'low'
                          ? 'bg-green-100 text-green-700'
                          : recommendedModelInfo.cost === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {recommendedModelInfo.cost === 'low'
                        ? '經濟'
                        : recommendedModelInfo.cost === 'medium'
                        ? '中等'
                        : '高級'}
                    </span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#0077B6' }}>
                    {recommendedModelInfo.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {recommendedModelInfo.bestFor.map((use) => (
                      <span
                        key={use}
                        className="text-xs px-2 py-0.5 bg-blue-50 rounded"
                        style={{ color: '#0077B6' }}
                      >
                        {use}
                      </span>
                    ))}
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
              className="mt-3 text-sm flex items-center gap-1 transition-colors"
              style={{ color: '#0077B6' }}
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showAdvanced ? '隱藏' : '顯示'}模型對比表格
            </button>

            {showAdvanced && (
              <div className="mt-3">
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

      {/* 多模型對比選項 */}
      {availableModels.length >= 2 && (
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={multiModelMode}
              onChange={(e) => setMultiModelMode(e.target.checked)}
              disabled={isAnalyzing}
              className="rounded border-gray-300"
            />
            <span className="text-sm" style={{ color: '#03045E' }}>
              使用所有可用模型進行對比分析
              <span className="text-xs ml-1" style={{ color: '#6B7280' }}>
                (會同時使用多個 AI 模型，並對比分析結果，成本會增加)
              </span>
            </span>
          </label>
        </div>
      )}

      {/* 分析按鈕 */}
      <button
        onClick={handleAnalyze}
        disabled={
          isAnalyzing ||
          videos.length === 0 ||
          (modelSelectionMode === 'manual' && !selectedModel) ||
          (modelSelectionMode === 'auto' && !recommendedModel)
        }
        className="
          w-full px-6 py-3 rounded-lg
          flex items-center justify-center gap-2 font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{
          backgroundColor: isAnalyzing ? '#6B7280' : '#0077B6',
          color: '#FFFFFF',
        }}
      >
        {isAnalyzing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            分析中...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            開始 AI 分析
          </>
        )}
      </button>

      {/* 預估時間提示 */}
      {!isAnalyzing &&
        ((modelSelectionMode === 'auto' && recommendedModel) ||
          (modelSelectionMode === 'manual' && selectedModel)) && (
          <div className="text-sm text-center" style={{ color: '#6B7280' }}>
            預估分析時間：
            {analysisType === 'comprehensive' ? '60-90 秒' : '30-60 秒'}
            {modelSelectionMode === 'manual' && selectedModel && (() => {
              const model = availableModels.find((m) => m.id === selectedModel);
              return model?.cost === 'high' ? ' • 使用高級模型' : '';
            })()}
          </div>
        )}

      {/* 錯誤提示 */}
      {analysisError && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <p className="text-sm text-red-700">❌ {analysisError}</p>
        </div>
      )}

      {/* 分析結果 */}
      {analysisResult && (
        <div className="border-t pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#03045E' }}>
              分析結果
            </h3>
            {analysisResult.metadata && (
              <div className="flex flex-wrap gap-2 text-xs" style={{ color: '#6B7280' }}>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  模型：{analysisResult.metadata.model}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  提供者：{analysisResult.metadata.provider}
                </span>
                {analysisResult.metadata.usage && (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    Token：{analysisResult.metadata.usage.totalTokens.toLocaleString()}
                  </span>
                )}
                {analysisResult.metadata.cost && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    成本：${analysisResult.metadata.cost.toFixed(6)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className="prose prose-sm max-w-none p-6 bg-white border-2 rounded-lg"
            style={{ borderColor: '#E5E7EB' }}
          >
            <ReactMarkdown>{analysisResult.text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
