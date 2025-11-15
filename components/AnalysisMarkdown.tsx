/**
 * AnalysisMarkdown - 增强的 Markdown 渲染组件
 * 支持 Mermaid 图表、表格美化、章节图标
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
import type { Components } from 'react-markdown';

interface AnalysisMarkdownProps {
  children: string;
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
            ref.current.innerHTML = `<pre class="bg-red-50 p-4 rounded text-red-700 text-sm">${error}</pre>`;
          }
        }
      };

      renderDiagram();
    }
  }, [chart]);

  return <div ref={ref} className="my-6 flex justify-center" />;
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

export function AnalysisMarkdown({ children }: AnalysisMarkdownProps) {
  return (
    <div className="analysis-markdown">
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
