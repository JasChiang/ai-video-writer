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
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
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
  isStreaming?: boolean;
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
type ChartValue = number | string | boolean | null;

type ChartRecord = Record<string, ChartValue>;

interface ChartListItem {
  label?: string;
  value?: ChartValue;
}

interface ChartData {
  type: 'bar' | 'pie' | 'doughnut';
  title?: string;
  labels?: unknown;
  values?: unknown;
  data?: ChartListItem[] | ChartRecord;
  items?: ChartListItem[] | ChartRecord;
  datasets?: any[]; // 兼容標準 Chart.js 結構
  colors?: string[];
  raw?: string;
}

const getUnitMultiplier = (value: string): number => {
  const unitMatch = value.match(/[\d.]+\s*(萬|万|億|亿|千|k|K|m|M|b|B)/);
  if (!unitMatch) return 1;

  switch (unitMatch?.[1]?.toLowerCase()) {
    case '萬':
    case '万':
      return 10000;
    case '億':
    case '亿':
      return 100000000;
    case '千':
    case 'k':
      return 1000;
    case 'm':
      return 1000000;
    case 'b':
      return 1000000000;
    default:
      return 1;
  }
};

const normalizeChartNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const multiplier = getUnitMultiplier(trimmed);
    const numericText = trimmed.replace(/[,，]/g, '').replace(/[^0-9.+-]/g, '');
    if (!numericText) return null;

    const parsed = Number(numericText);
    if (!Number.isFinite(parsed)) return null;

    return parsed * multiplier;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return null;
};

const isRecord = (value: unknown): value is ChartRecord =>
  !!value && !Array.isArray(value) && typeof value === 'object';

const toDisplayValue = (value: ChartValue): string => {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const buildFallbackEntries = (data: ChartData): Array<{ label: string; value: string }> => {
  const entries: Array<{ label: string; value: string }> = [];

  const addEntry = (label: string, value: ChartValue | undefined) => {
    if (value === undefined) return;
    entries.push({ label, value: toDisplayValue(value) });
  };

  const tryAppendFromArrays = (labels: unknown, values: unknown) => {
    if (!Array.isArray(values)) {
      return;
    }
    const safeLabels = Array.isArray(labels) ? labels : values.map((_, index) => `項目 ${index + 1}`);
    const length = Math.min(safeLabels.length, values.length);
    for (let i = 0; i < length; i++) {
      addEntry(String(safeLabels[i] ?? `項目 ${i + 1}`), values[i] as ChartValue);
    }
  };

  const tryAppendFromList = (list?: ChartListItem[]) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      if (item) {
        const label = item.label ?? `項目 ${index + 1}`;
        addEntry(label, item.value);
      }
    });
  };

  tryAppendFromArrays(data.labels, data.values);

  if (entries.length === 0 && isRecord(data.values)) {
    Object.entries(data.values).forEach(([label, value]) => addEntry(label, value));
  }

  if (entries.length === 0) {
    if (isRecord(data.data)) {
      Object.entries(data.data).forEach(([label, value]) => addEntry(label, value));
    } else {
      tryAppendFromList(data.data);
    }
  }

  if (entries.length === 0) {
    if (isRecord(data.items)) {
      Object.entries(data.items).forEach(([label, value]) => addEntry(label, value));
    } else {
      tryAppendFromList(data.items);
    }
  }

  return entries;
};

const buildStrictDataset = (data: ChartData): { labels: string[]; values: number[] } | null => {
  // 嘗試從標準 Chart.js 結構中提取 values
  let sourceValues = data.values;
  if (!Array.isArray(sourceValues) && Array.isArray(data.datasets) && data.datasets.length > 0) {
    sourceValues = data.datasets[0].data;
  }

  if (!Array.isArray(data.labels) || !Array.isArray(sourceValues)) {
    return null;
  }

  const labels = data.labels.map((label) => String(label));
  if (labels.length === 0 || labels.length !== sourceValues.length) {
    return null;
  }

  const values: number[] = [];
  for (let i = 0; i < sourceValues.length; i++) {
    const numeric = normalizeChartNumber((sourceValues as unknown[])[i]);
    if (numeric === null) {
      return null;
    }
    values.push(numeric);
  }

  return { labels, values };
};

const ChartFallbackTable: React.FC<{ title?: string; entries: Array<{ label: string; value: string }>; raw?: string }> = ({
  title,
  entries,
  raw,
}) => {
  return (
    <div className="my-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
      {title && <p className="font-semibold text-blue-900 mb-3">{title}</p>}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-blue-200 bg-white text-blue-900">
            <thead className="bg-blue-100">
              <tr>
                <th className="px-3 py-2 text-left border border-blue-200">項目</th>
                <th className="px-3 py-2 text-left border border-blue-200">數值</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.label}-${index}`} className="odd:bg-blue-50">
                  <td className="px-3 py-2 border border-blue-100">{entry.label}</td>
                  <td className="px-3 py-2 border border-blue-100">{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-blue-100 rounded p-3 text-sm text-blue-900">
          {raw ? <pre className="whitespace-pre-wrap">{raw}</pre> : <p>沒有可用的圖表資料，已改以文字呈現。</p>}
        </div>
      )}
      <p className="text-xs text-blue-600 mt-3">
        圖表資料格式不符標準（需為 \`labels\` 與 \`values\` 的等長數字陣列），因此以表格方式呈現。
      </p>
    </div>
  );
};

const ChartJSComponent: React.FC<{ data: ChartData }> = ({ data }) => {
  const strictDataset = buildStrictDataset(data);
  const fallbackEntries = buildFallbackEntries(data);

  if (!strictDataset) {
    return <ChartFallbackTable title={data.title} entries={fallbackEntries} raw={data.raw} />;
  }

  const safeColors = Array.isArray(data.colors) ? data.colors : undefined;
  const { labels: chartLabels, values: numericValues } = strictDataset;

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
    labels: chartLabels,
    datasets: [
      {
        label: data.title || '數據',
        data: numericValues,
        backgroundColor: safeColors || defaultColors.slice(0, numericValues.length),
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

  if (data.type === 'pie' || data.type === 'doughnut') {
    const pieData = {
      labels: chartLabels,
      datasets: [
        {
          label: data.title || '數據',
          data: numericValues,
          backgroundColor: safeColors || defaultColors,
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
      ],
    };

    const pieOptions = {
      ...options,
      plugins: {
        ...options.plugins,
        legend: {
          position: 'right' as const,
        }
      }
    };

    return (
      <div className="my-6 p-6 bg-white border-2 rounded-lg" style={{ borderColor: '#E5E7EB' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          {data.type === 'pie' ? (
            <Pie data={pieData} options={pieOptions} />
          ) : (
            <Doughnut data={pieData} options={pieOptions} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 p-6 bg-white border-2 rounded-lg" style={{ borderColor: '#E5E7EB' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

// 辅助函数：处理文本中的 <br> 标签
const renderWithBreaks = (content: React.ReactNode): React.ReactNode => {
  if (typeof content === 'string') {
    const parts = content.split(/<br\s*\/?>/gi);
    if (parts.length === 1) return content;

    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && <br />}
      </React.Fragment>
    ));
  }

  if (Array.isArray(content)) {
    return React.Children.map(content, (child) => renderWithBreaks(child));
  }

  return content;
};

// 自定义 Markdown 组件
const components: Components = {
  // 标题组件 - 添加图标
  h2: ({ children }) => {
    const text = String(children);
    const Icon = getIconForHeading(text);

    return (
      <h2 className="flex items-center gap-2 text-xl font-bold mt-8 mb-4 pb-2 border-b-2" style={{ color: '#03045E', borderColor: '#0077B6' }}>
        {Icon && <Icon className="w-6 h-6 text-[#0077B6]" />}
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
        const StatusIcon = style.icon as React.ElementType;
        return (
          <td className="border border-gray-300 px-4 py-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
              <StatusIcon className="w-4 h-4" />
              {renderWithBreaks(children)}
            </span>
          </td>
        );
      }
    }

    return (
      <td className="border border-gray-300 px-4 py-3" style={{ color: '#03045E' }}>
        {renderWithBreaks(children)}
      </td>
    );
  },

  tr: ({ children }) => (
    <tr className="hover:bg-gray-50 transition-colors">
      {children}
    </tr>
  ),

  // 代码块组件 - Mermaid 支持
  code: ({ inline, className, children, ...props }: any) => {
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

  // 段落组件 - 改用 div 避免 hydration error (因為可能包含 block 元素)
  p: ({ children }) => (
    <div className="my-3 leading-relaxed" style={{ color: '#03045E' }}>
      {children}
    </div>
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


export function AnalysisMarkdown({ children, videos }: AnalysisMarkdownProps) {
  // 存儲解析出的圖表數據
  const [charts, setCharts] = React.useState<Map<string, ChartData>>(new Map());

  const sanitizeChartJson = (raw: string): any | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      // fall through
    }

    let normalized = trimmed;

    if (normalized.startsWith('(') && normalized.endsWith(')')) {
      normalized = normalized.slice(1, -1);
    }

    if (!normalized.trim().startsWith('{')) {
      normalized = `{${normalized}}`;
    }

    normalized = normalized
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, (_, prefix: string, key: string) => {
        return `${prefix}"${key}":`;
      })
      .replace(/'([^']*)'/g, (_, value: string) => `"${value.replace(/"/g, '\\"')}"`)
      .replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(normalized);
    } catch (error) {
      console.error('Failed to sanitize chart JSON:', error, normalized);
      return null;
    }
  };

  // 預處理內容：識別圖表並替換為特殊標記
  const processCharts = (text: string): string => {
    // 支援兩種格式：
    // 1. HTML 註解格式: <!-- CHART:PIE ... -->
    // 2. JSON 代碼塊格式: ```json { "type": "pie", ... } ```

    const commentRegex = /<!--\s*CHART:(PIE|BAR|DOUGHNUT)\s*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?-->/g;
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;

    const newCharts = new Map<string, ChartData>();
    let chartIndex = 0;

    // 處理代碼塊格式
    let processed = text.replace(codeBlockRegex, (match, rawBlock) => {
      try {
        const data = sanitizeChartJson(rawBlock.trim());
        if (!data) return match;

        let chartType = (data.type || 'bar').toLowerCase();
        if (chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'bar') chartType = 'bar';
        if (!data.type && !rawBlock.includes('"type"')) {
          return match;
        }

        const chartId = `chart-${chartIndex++}`;
        // 處理嵌套的 data 結構
        const labels = data.labels || data.data?.labels;
        const values = data.values || data.data?.values || data.data?.datasets?.[0]?.data;
        const title = data.title || data.options?.plugins?.title?.text;

        newCharts.set(chartId, {
          type: chartType as any,
          title: title,
          labels: labels,
          values: values,
          datasets: data.datasets || data.data?.datasets,
          data: data.data,
          items: data.items,
          colors: data.colors,
          raw: rawBlock.trim(),
        });
        return `§CHART:${chartId}§`;
      } catch (e) {
        console.error('Failed to parse chart data from JSON code block:', e, rawBlock);
        return match;
      }
    });

    // 處理註解格式 (保留原有邏輯)
    processed = processed.replace(commentRegex, (match, _type, jsonData) => {
      try {
        const data = sanitizeChartJson(jsonData.trim());
        if (!data) {
          throw new Error('Invalid chart data');
        }

        const labels = data.labels || data.data?.labels;
        const values = data.values || data.data?.values || data.data?.datasets?.[0]?.data;
        const title = data.title || data.options?.plugins?.title?.text;
        let chartType = (data.type || _type || 'bar').toLowerCase();
        if (chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'bar') chartType = 'bar';

        const chartId = `chart-${chartIndex++}`;
        newCharts.set(chartId, {
          type: chartType as any,
          title: title,
          labels: labels,
          values: values,
          datasets: data.datasets || data.data?.datasets,
          data: data.data,
          items: data.items,
          colors: data.colors,
          raw: jsonData.trim(),
        });
        return `§CHART:${chartId}§`;
      } catch (error) {
        console.error('Failed to parse chart data:', error);
        return match;
      }
    });

    setCharts(newCharts);
    return processed;
  };

  // 預處理內容：識別 video ID 并替换为特殊标记
  const processVideoIds = (text: string): string => {
    // 額外清理：移除 "(ID: undefined" 相關的文字，避免顯示錯誤資訊
    // 匹配模式： (ID: undefined, ...) 或 (ID: undefined)
    let processedText = text.replace(/\(ID:\s*undefined[^)]*\)/g, '');

    if (!videos || videos.length === 0) return processedText;

    // 使用更複雜的正則表達式：匹配已存在的標記 OR 裸露的 ID
    // Group 1: 已存在的標記 (e.g., §VIDEO_CARD:abc12345678§)
    // Group 2: 裸露的 ID (e.g., abc12345678)
    const combinedRegex = /(§VIDEO_CARD:[a-zA-Z0-9_-]{11}§)|(\b[a-zA-Z0-9_-]{11}\b)/g;

    return processedText.replace(combinedRegex, (match, existingMarker, videoId) => {
      // 如果是已存在的標記，直接返回，不做處理
      if (existingMarker) {
        return existingMarker;
      }

      // 如果是裸露的 ID，且是有效的影片 ID，則進行替換
      if (videoId) {
        const video = findVideoById(videoId, videos);
        if (video) {
          return `§VIDEO_CARD:${videoId}§`;
        }
      }

      return match;
    });

    // 額外清理：移除 "(ID: undefined" 相關的文字，避免顯示錯誤資訊
    // 匹配模式： (ID: undefined, ...) 或 (ID: undefined)
    text = text.replace(/\(ID:\s*undefined[^)]*\)/g, '');

    return text;
  };

  // 渲染帶有卡片和圖表的內容
  const renderWithCards = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      // 遞歸處理 React Element
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<{ children?: React.ReactNode }>;
        if (element.props.children) {
          return React.cloneElement(element, {
            children: renderWithCards(element.props.children)
          } as any);
        }
        return child;
      }

      if (typeof child !== 'string') {
        return child;
      }

      const text = child;

      // 检查是否包含圖表标记
      if (text.includes('§CHART:')) {
        const parts = text.split(/(§CHART:chart-\d+§)/g);
        return parts.map((part, index) => {
          const chartMatch = part.match(/§CHART:(chart-\d+)§/);
          if (chartMatch && chartMatch[1]) {
            const chartId = chartMatch[1];
            const chartData = charts.get(chartId);
            if (chartData) {
              return <ChartJSComponent key={index} data={chartData} />;
            }
          }
          return <span key={index}>{part}</span>;
        });
      }

      // 检查是否包含 video 标记
      if (text.includes('§VIDEO_CARD:')) {
        const parts = text.split(/(§VIDEO_CARD:[a-zA-Z0-9_-]{11}§)/g);
        return (
          <span key="video-wrapper" className="block my-4 space-y-3">
            {parts.map((part, index) => {
              const match = part.match(/§VIDEO_CARD:([a-zA-Z0-9_-]{11})§/);
              if (match && match[1]) {
                const videoId = match[1];
                const video = findVideoById(videoId, videos);
                if (video) {
                  return (
                    <span key={index} className="block my-4">
                      <VideoPreviewCard video={video} compact={true} />
                    </span>
                  );
                }
              }
              // 普通文本
              if (part && !part.startsWith('§VIDEO_CARD:')) {
                return (
                  <span key={index} className="leading-relaxed" style={{ color: '#03045E' }}>
                    {renderWithBreaks(part)}
                  </span>
                );
              }
              return null;
            })}
          </span>
        );
      }

      return renderWithBreaks(text);
    });
  };

  // 创建自定义的 components，包含 video 和 chart 数据
  const componentsWithVideos: Components = {
    ...components,
    // 段落组件
    p: ({ children }) => (
      <div className="my-3 leading-relaxed" style={{ color: '#03045E' }}>
        {renderWithCards(children)}
      </div>
    ),
    // 列表项组件
    li: ({ children }) => (
      <li className="ml-4">
        {renderWithCards(children)}
      </li>
    ),
    // 強調組件 (Bold)
    strong: ({ children }) => (
      <strong className="font-semibold" style={{ color: '#0077B6' }}>
        {renderWithCards(children)}
      </strong>
    ),
    // 斜體組件 (Italic)
    em: ({ children }) => (
      <em className="italic">
        {renderWithCards(children)}
      </em>
    ),
    // 引用塊組件
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 pl-4 py-2 my-4 bg-blue-50" style={{ borderColor: '#0077B6' }}>
        {renderWithCards(children)}
      </blockquote>
    ),
    // 表格單元格
    td: ({ children }) => {
      const text = String(children);
      // 检查是否是状态标记 (保持原有邏輯)
      for (const [status, style] of Object.entries(statusStyles)) {
        if (text.includes(status)) {
          const StatusIcon = style.icon as React.ElementType;
          return (
            <td className="border border-gray-300 px-4 py-3">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
                <StatusIcon className="w-4 h-4" />
                {renderWithBreaks(children)}
              </span>
            </td>
          );
        }
      }
      return (
        <td className="border border-gray-300 px-4 py-3" style={{ color: '#03045E' }}>
          {renderWithCards(children)}
        </td>
      );
    },
  };

  // 預處理內容：識別影片標題並自動添加 video 卡片
  const processVideoTitles = (text: string): string => {
    if (!videos || videos.length === 0) return text;

    let processed = text;
    // 按標題長度降序排序，避免短標題誤匹配長標題的一部分
    const sortedVideos = [...videos].sort((a, b) => b.title.length - a.title.length);

    sortedVideos.forEach((video) => {
      if (!video.title || video.title.length < 4) return; // 忽略太短的標題

      // 轉義正則特殊字符
      const escapedTitle = video.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 匹配標題，且後面沒有緊跟著 video 卡片標記 (避免重複添加)
      const regex = new RegExp(`(${escapedTitle})(?!\\s*§VIDEO_CARD:)`, 'g');

      processed = processed.replace(regex, (match) => {
        return `${match} §VIDEO_CARD:${video.id}§`;
      });
    });

    return processed;
  };

  // 依序處理：圖表 -> 影片標題 -> 影片 ID
  const processedContent = React.useMemo(() => {
    // DEBUG: Trace videos prop
    if (videos && videos.length > 0) {
      // console.log('[AnalysisMarkdown] Processing with videos:', videos.length);
    } else {
      console.warn('[AnalysisMarkdown] No videos provided!');
    }

    let content = children;
    content = processCharts(content);

    const beforeTitles = content;
    content = processVideoTitles(content); // 新增：自動匹配標題

    // DEBUG: Check if titles were matched
    if (content !== beforeTitles) {
      // console.log('[AnalysisMarkdown] Titles matched and replaced');
    }

    content = processVideoIds(content);
    return content;
  }, [children, videos]);

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
