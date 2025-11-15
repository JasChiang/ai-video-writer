import React from 'react';
import { Brain, Zap, Target, Sparkles } from 'lucide-react';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  cost: 'low' | 'medium' | 'high';
  speedRating: number; // 1-5
  qualityRating: number; // 1-5
  bestFor: string[];
  useOpenRouter: boolean;
}

const modelIcons: Record<string, React.ComponentType<any>> = {
  'gemini-2.5-flash': Zap,
  'gemini-2.5-pro': Brain,
  'anthropic/claude-sonnet-4.5': Target,
  'openai/gpt-5.1': Sparkles,
  'x-ai/grok-4': Zap,
};

const costColors = {
  low: 'text-green-700 bg-green-50 border-green-200',
  medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  high: 'text-red-700 bg-red-50 border-red-200',
};

const costLabels = {
  low: '經濟',
  medium: '中等',
  high: '高級',
};

const costEmojis = {
  low: '💰',
  medium: '💰💰',
  high: '💰💰💰',
};

interface AIModelSelectorProps {
  models: AIModel[];
  selectedModel: string | null;
  onModelSelect: (modelId: string) => void;
  disabled?: boolean;
  showComparison?: boolean;
}

export function AIModelSelector({
  models,
  selectedModel,
  onModelSelect,
  disabled = false,
  showComparison = false,
}: AIModelSelectorProps) {
  if (models.length === 0) {
    return (
      <div className="p-4 border-2 border-yellow-200 bg-yellow-50 rounded-lg">
        <p className="text-sm text-yellow-800">
          ⚠️ 沒有可用的 AI 模型。請檢查 API Key 配置。
        </p>
      </div>
    );
  }

  // 卡片視圖
  if (!showComparison) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium" style={{ color: '#03045E' }}>
          選擇 AI 模型
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {models.map((model) => {
            const Icon = modelIcons[model.id] || Brain;
            const isSelected = selectedModel === model.id;

            return (
              <button
                key={model.id}
                type="button"
                disabled={disabled}
                onClick={() => onModelSelect(model.id)}
                className={`
                  relative p-4 rounded-lg border-2 text-left transition-all
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isSelected ? '#0077B6' : '#6B7280' }}
                    />
                    <div>
                      <h4 className="font-semibold" style={{ color: '#03045E' }}>
                        {model.name}
                      </h4>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {model.provider}
                        {model.useOpenRouter && (
                          <span className="ml-1 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            via OpenRouter
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium border ${costColors[model.cost]}`}
                  >
                    {costLabels[model.cost]}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm mb-3" style={{ color: '#0077B6' }}>
                  {model.description}
                </p>

                {/* Ratings */}
                <div className="flex gap-4 mb-3">
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#6B7280' }}>
                      速度
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i <= model.speedRating ? 'bg-blue-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs mb-1" style={{ color: '#6B7280' }}>
                      品質
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i <= model.qualityRating ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Best For */}
                <div>
                  <div className="text-xs mb-1" style={{ color: '#6B7280' }}>
                    適合用於：
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {model.bestFor.slice(0, 3).map((use) => (
                      <span
                        key={use}
                        className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                        style={{ color: '#374151' }}
                      >
                        {use}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#0077B6' }}
                    >
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 表格對比視圖
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" style={{ color: '#03045E' }}>
        模型對比
      </label>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg">
          <thead style={{ backgroundColor: '#F3F4F6' }}>
            <tr>
              <th className="px-4 py-2 text-left font-medium" style={{ color: '#03045E' }}>
                模型
              </th>
              <th className="px-4 py-2 text-center font-medium" style={{ color: '#03045E' }}>
                速度
              </th>
              <th className="px-4 py-2 text-center font-medium" style={{ color: '#03045E' }}>
                品質
              </th>
              <th className="px-4 py-2 text-center font-medium" style={{ color: '#03045E' }}>
                成本
              </th>
              <th className="px-4 py-2 text-left font-medium" style={{ color: '#03045E' }}>
                最適合
              </th>
              <th className="px-4 py-2 text-center font-medium" style={{ color: '#03045E' }}>
                選擇
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models.map((model) => {
              const isSelected = selectedModel === model.id;

              return (
                <tr
                  key={model.id}
                  className={`${
                    isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                  } transition-colors`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: '#03045E' }}>
                      {model.name}
                    </div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>
                      {model.provider}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RatingBar rating={model.speedRating} color="blue" />
                  </td>
                  <td className="px-4 py-3">
                    <RatingBar rating={model.qualityRating} color="green" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg">{costEmojis[model.cost]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {model.bestFor.slice(0, 2).map((use) => (
                        <span
                          key={use}
                          className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                          style={{ color: '#374151' }}
                        >
                          {use}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onModelSelect(model.id)}
                      className={`
                        px-3 py-1 rounded-lg text-sm font-medium transition-colors
                        ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {isSelected ? '已選擇' : '選擇'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatingBar({ rating, color }: { rating: number; color: 'blue' | 'green' }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${
            i <= rating
              ? color === 'blue'
                ? 'bg-blue-500'
                : 'bg-green-500'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
