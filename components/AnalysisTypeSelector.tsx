import React from 'react';
import { TrendingUp, Eye, Lightbulb, Users, BarChart3 } from 'lucide-react';

export type AnalysisType =
  | 'subscriber-growth'
  | 'view-optimization'
  | 'content-strategy'
  | 'audience-insights'
  | 'comprehensive';

export interface AnalysisTypeOption {
  id: AnalysisType;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  estimatedTime: string;
  color: string;
}

const analysisTypes: AnalysisTypeOption[] = [
  {
    id: 'subscriber-growth',
    name: '訂閱成長分析',
    description: '深入分析訂閱者來源、轉化率、流失原因，提供訂閱成長策略',
    icon: TrendingUp,
    estimatedTime: '30-60 秒',
    color: '#10B981', // green
  },
  {
    id: 'view-optimization',
    name: '觀看優化分析',
    description: '分析點擊率、觀看時長、推薦演算法適配，提升觀看次數',
    icon: Eye,
    estimatedTime: '30-60 秒',
    color: '#3B82F6', // blue
  },
  {
    id: 'content-strategy',
    name: '內容策略分析',
    description: '分析內容主題分佈、識別內容缺口、提供長期內容策略',
    icon: Lightbulb,
    estimatedTime: '30-60 秒',
    color: '#F59E0B', // amber
  },
  {
    id: 'audience-insights',
    name: '觀眾洞察分析',
    description: '深入了解觀眾特徵、行為模式、提供精準內容定位',
    icon: Users,
    estimatedTime: '30-60 秒',
    color: '#8B5CF6', // purple
  },
  {
    id: 'comprehensive',
    name: '綜合分析',
    description: '全面分析頻道健康度、內容主題、資源配置建議',
    icon: BarChart3,
    estimatedTime: '60-90 秒',
    color: '#EF4444', // red
  },
];

interface AnalysisTypeSelectorProps {
  selectedType: AnalysisType;
  onTypeSelect: (typeId: AnalysisType) => void;
  disabled?: boolean;
}

export function AnalysisTypeSelector({
  selectedType,
  onTypeSelect,
  disabled = false,
}: AnalysisTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" style={{ color: '#03045E' }}>
        選擇分析類型
      </label>

      <div className="grid grid-cols-1 gap-2">
        {analysisTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <button
              key={type.id}
              type="button"
              disabled={disabled}
              onClick={() => onTypeSelect(type.id)}
              className={`
                relative p-3 rounded-lg border-2 text-left transition-all
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`p-2 rounded-lg ${isSelected ? 'opacity-100' : 'opacity-80'}`}
                  style={{
                    backgroundColor: isSelected ? `${type.color}20` : '#F3F4F6',
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isSelected ? type.color : '#6B7280' }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4
                      className="font-semibold"
                      style={{ color: isSelected ? type.color : '#03045E' }}
                    >
                      {type.name}
                    </h4>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {type.estimatedTime}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#0077B6' }}>
                    {type.description}
                  </p>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: type.color }}
                    >
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { analysisTypes };
