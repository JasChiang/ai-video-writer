/**
 * AnalysisMarkdown - 增强的 Markdown 渲染组件
 * 支持 Mermaid 图表、Chart.js 本地图表、表格美化、章节图标
 */

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  TrendingUp,
  Target,
  Lightbulb,
  Search,
  BarChart3,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  Activity,
  Zap,
  List,
} from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import type { Components } from 'react-markdown';
import type { YouTubeVideo } from '../types';
import { VideoPreviewCard } from './VideoPreviewCard';

// 註冊 Chart.js 組件
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AnalysisMarkdownProps {
  children: string;
  videos?: YouTubeVideo[]; // 影片数据，用于根据 ID 查找影片信息
}

// 章节图标映射
const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  // 频道分析相关
  頻道總體診斷: Activity,
  增長飛輪: TrendingUp,
  健康狀況: Activity,
  內容支柱: BarChart3,
  資源配置: Target,
  內容磁鐵: Zap,
  低效內容: TrendingDown,
  卡點診斷: AlertTriangle,
  行動項目: CheckCircle,
  最終建議: Lightbulb,
  頻道定位: Target,

  // 关键字分析相关
  單元總結: List,
  流量獲取: TrendingUp,
  觀眾留存: Users,
  訂閱轉換: Target,
  時間序列: TrendingUp,
  'YouTube SEO': Search,
  'SEO 優化': Search,
  系列化內容: List,

  // 状态相关
  訂閱磁鐵: Zap,
  潛力單元: Lightbulb,
  流量單元: TrendingUp,
  低效單元: TrendingDown,
  內容黑洞: XCircle,

  // 通用
  診斷: Search,
  分析: BarChart3,
  建議: Lightbulb,
  策略: Target,
  優化: TrendingUp,
  警訊: AlertTriangle,
};

// 根据标题文本选择图标
const getIconForHeading = (text: string): React.ComponentType<{ className?: string }> | null => {
  for (const [keyword, Icon] of Object.entries(sectionIcons)) {
    if (text.includes(keyword)) {
      return Icon;
    }
  }
  return null;
};

// 状态标记样式映射
const statusStyles: Record<string, { bg: string; text: string; icon: React.ComponentType }> = {
  加速期: { bg: 'bg-green-100', text: 'text-green-700', icon: TrendingUp },
  平台期: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
  衰退期: { bg: 'bg-red-100', text: 'text-red-700', icon: TrendingDown },
  停滯期: { bg: 'bg-gray-100', text: 'text-gray-700', icon: XCircle },
  訂閱磁鐵: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Zap },
  潛力支柱: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Lightbulb },
  內容黑洞: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  低效單元: { bg: 'bg-orange-100', text: 'text-orange-700', icon: TrendingDown },
};

// Mermaid 渲染组件
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const renderDiagram = async () => {
        try {
          // 动态导入 mermaid
          const mermaid = (await import('mermaid')).default;

          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
              primaryColor: '#0077B6',
              primaryTextColor: '#03045E',
              primaryBorderColor: '#0096C7',
              lineColor: '#48CAE4',
              secondaryColor: '#90E0EF',
              tertiaryColor: '#CAF0F8',
            },
          });

          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);

          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          if (ref.current) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ref.current.innerHTML = `
              <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6 my-4">
                <div class="flex items-start gap-3 mb-3">
                  <div class="text-red-600 text-2xl">⚠️</div>
                  <div class="flex-1">
                    <h4 class="font-semibold text-red-800 mb-2">Mermaid 圖表語法錯誤</h4>
                    <p class="text-red-700 text-sm mb-3">${errorMessage}</p>
                    <details class="text-sm">
                      <summary class="cursor-pointer text-red-600 hover:text-red-800 font-medium mb-2">
                        查看原始語法
                      </summary>
                      <pre class="bg-white border border-red-200 rounded p-3 overflow-x-auto text-xs text-gray-800 mt-2">${chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </details>
                    <p class="text-xs text-gray-600 mt-3">
                      💡 提示：AI 生成的圖表語法有誤，請嘗試重新分析或聯繫開發者。
                    </p>
                  </div>
                </div>
              </div>
            `;
          }
        }
      };

      renderDiagram();
    }
  }, [chart]);

  return <div ref={ref} className="my-6 flex justify-center" />;
};

// Chart.js 圖表組件
interface ChartData {
  type: 'pie' | 'bar';
  title?: string;
  labels: string[];
  values: number[];
  colors?: string[];
}

const ChartJSComponent: React.FC<{ data: ChartData }> = ({ data }) => {
  const safeLabels = Array.isArray(data.labels) ? data.labels : [];
  const safeValues = Array.isArray(data.values) ? data.values : [];
  const safeColors = Array.isArray(data.colors) ? data.colors : undefined;

  const hasValidData =
    safeLabels.length > 0 && safeLabels.length === safeValues.length;

  if (!hasValidData) {
    return (
      <div className="my-6 p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <p className="text-red-700 font-semibold mb-2">圖表資料無效</p>
        <p className="text-sm text-red-600">
          無法渲染 Chart.js 圖表，請檢查 labels / values 是否為等長陣列。
        </p>
      </div>
    );
  }

  const defaultColors = [
    '#0077B6', // 主色
    '#0096C7', // 副色
    '#00B4D8', // 輔助色 1
    '#48CAE4', // 輔助色 2
    '#90E0EF', // 輔助色 3
    '#ADE8F4', // 輔助色 4
    '#CAF0F8', // 輔助色 5
    '#FF6B6B', // 對比色 1
    '#FFA500', // 對比色 2
    '#32CD32', // 對比色 3
  ];

  const chartData = {
    labels: safeLabels,
    datasets: [
      {
        label: data.title || '數據',
        data: safeValues,
        backgroundColor: safeColors || defaultColors.slice(0, safeValues.length),
        borderColor: '#FFFFFF',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
          color: '#03045E',
        },
      },
      title: {
        display: !!data.title,
        text: data.title,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        color: '#03045E',
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.parsed || context.raw;
            const total = Array.isArray(context.dataset?.data)
              ? context.dataset.data.reduce((a: number, b: number) => a + b, 0)
              : 0;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="my-6 p-6 bg-white border-2 rounded-lg" style={{ borderColor: '#E5E7EB' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {data.type === 'pie' ? (
          <Pie data={chartData} options={options} />
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  );
};

// 自定义 Markdown 组件
const components: Components = {
  // 标题组件 - 添加图标
  h2: ({ children }) => {
    const text = String(children);
    const Icon = getIconForHeading(text);

    return (
      <h2 className="flex items-center gap-2 text-xl font-bold mt-8 mb-4 pb-2 border-b-2" style={{ color: '#03045E', borderColor: '#0077B6' }}>
        {Icon && <Icon className="w-6 h-6" style={{ color: '#0077B6' }} />}
        {children}
      </h2>
    );
  },

  h3: ({ children }) => {
    const text = String(children);
    const Icon = getIconForHeading(text);

    return (
      <h3 className="flex items-center gap-2 text-lg font-semibold mt-6 mb-3" style={{ color: '#0077B6' }}>
        {Icon && <Icon className="w-5 h-5" />}
        {children}
      </h3>
    );
  },

  // 表格组件 - 美化样式
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border-collapse border border-gray-300">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-blue-50">
      {children}
    </thead>
  ),

  th: ({ children }) => (
    <th className="border border-gray-300 px-4 py-3 text-left font-semibold" style={{ color: '#03045E' }}>
      {children}
    </th>
  ),

  td: ({ children }) => {
    const text = String(children);

    // 检查是否是状态标记
    for (const [status, style] of Object.entries(statusStyles)) {
      if (text.includes(status)) {
        const StatusIcon = style.icon;
        return (
          <td className="border border-gray-300 px-4 py-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
              <StatusIcon className="w-4 h-4" />
              {children}
            </span>
          </td>
        );
      }
    }

    return (
      <td className="border border-gray-300 px-4 py-3" style={{ color: '#03045E' }}>
        {children}
      </td>
    );
  },

  tr: ({ children }) => (
    <tr className="hover:bg-gray-50 transition-colors">
      {children}
    </tr>
  ),

  // 代码块组件 - Mermaid 支持
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    if (!inline && language === 'mermaid') {
      return <MermaidDiagram chart={codeString} />;
    }

    if (!inline) {
      return (
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto my-4">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    }

    return (
      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" style={{ color: '#0077B6' }} {...props}>
        {children}
      </code>
    );
  },

  // 列表组件 - 美化样式
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-2 my-4 ml-4" style={{ color: '#03045E' }}>
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-2 my-4 ml-4" style={{ color: '#03045E' }}>
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="ml-4">
      {children}
    </li>
  ),

  // 段落组件
  p: ({ children }) => (
    <p className="my-3 leading-relaxed" style={{ color: '#03045E' }}>
      {children}
    </p>
  ),

  // 强调组件
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: '#0077B6' }}>
      {children}
    </strong>
  ),

  // 链接组件
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline hover:no-underline transition-all"
      style={{ color: '#0077B6' }}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // 引用块组件
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 pl-4 py-2 my-4 bg-blue-50" style={{ borderColor: '#0077B6' }}>
      {children}
    </blockquote>
  ),
};

// 辅助函数：根据 video ID 查找影片
const findVideoById = (videoId: string, videos?: YouTubeVideo[]): YouTubeVideo | null => {
  if (!videos || videos.length === 0) return null;
  return videos.find((v) => v.id === videoId) || null;
};

// YouTube video ID 正则表达式 (11 个字符，字母数字_-)
const VIDEO_ID_REGEX = /\b([a-zA-Z0-9_-]{11})\b/g;

export function AnalysisMarkdown({ children, videos }: AnalysisMarkdownProps) {
  // 存儲解析出的圖表數據
  const [charts, setCharts] = React.useState<Map<string, ChartData>>(new Map());

  // 預處理內容：識別圖表並替換為特殊標記
  const processCharts = (text: string): string => {
    const chartRegex = /<!--\s*CHART:(PIE|BAR)\s*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?-->/g;
    const newCharts = new Map<string, ChartData>();
    let chartIndex = 0;

    const processed = text.replace(chartRegex, (match, type, jsonData) => {
      try {
        const data = JSON.parse(jsonData.trim());
        const chartId = `chart-${chartIndex++}`;
        newCharts.set(chartId, {
          type: type.toLowerCase() as 'pie' | 'bar',
          title: data.title,
          labels: data.labels,
          values: data.values,
          colors: data.colors,
        });
        return `§CHART:${chartId}§`;
      } catch (error) {
        console.error('Failed to parse chart data:', error);
        return match; // 保留原始內容
      }
    });

    setCharts(newCharts);
    return processed;
  };

  // 预处理内容：识别 video ID 并替换为特殊标记
  const processVideoIds = (text: string): string => {
    if (!videos || videos.length === 0) return text;

    return text.replace(VIDEO_ID_REGEX, (match, videoId) => {
      const video = findVideoById(videoId, videos);
      if (video) {
        // 使用特殊标记，稍后在渲染时替换
        return `§VIDEO_CARD:${videoId}§`;
      }
      return match;
    });
  };

  // 创建自定义的 components，包含 video 和 chart 数据
  const componentsWithVideos: Components = {
    ...components,
    // 段落组件 - 识别并渲染 video 卡片和圖表
    p: ({ children }) => {
      const text = String(children);

      // 检查是否包含圖表标记
      if (text.includes('§CHART:')) {
        const chartMatch = text.match(/§CHART:(chart-\d+)§/);
        if (chartMatch) {
          const chartId = chartMatch[1];
          const chartData = charts.get(chartId);
          if (chartData) {
            return <ChartJSComponent data={chartData} />;
          }
        }
      }

      // 检查是否包含 video 标记
      if (text.includes('§VIDEO_CARD:')) {
        const parts = text.split(/(§VIDEO_CARD:[a-zA-Z0-9_-]{11}§)/g);

        return (
          <div className="my-4 space-y-3">
            {parts.map((part, index) => {
              const match = part.match(/§VIDEO_CARD:([a-zA-Z0-9_-]{11})§/);
              if (match) {
                const videoId = match[1];
                const video = findVideoById(videoId, videos);
                if (video) {
                  return (
                    <div key={index} className="my-4">
                      <VideoPreviewCard video={video} compact={true} />
                    </div>
                  );
                }
              }
              // 普通文本
              if (part && !part.startsWith('§VIDEO_CARD:')) {
                return (
                  <span key={index} className="leading-relaxed" style={{ color: '#03045E' }}>
                    {part}
                  </span>
                );
              }
              return null;
            })}
          </div>
        );
      }

      // 正常段落
      return (
        <p className="my-3 leading-relaxed" style={{ color: '#03045E' }}>
          {children}
        </p>
      );
    },
  };

  // 依序處理：圖表 -> 影片 ID
  const processedContent = React.useMemo(() => {
    let content = children;
    content = processCharts(content);
    content = processVideoIds(content);
    return content;
  }, [children]);

  return (
    <div className="analysis-markdown">
      <ReactMarkdown
        components={componentsWithVideos}
        remarkPlugins={[remarkGfm]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
