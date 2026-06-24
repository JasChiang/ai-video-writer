/**
 * AI 分析面板
 * 自然語言輸入 → tool calling → 圖表 + 分析報告
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { AnalysisMarkdown } from './AnalysisMarkdown';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title, Tooltip, Legend
);

// ─── Types ───────────────────────────────────────

interface ChartBar { dataKey: string; label: string; color?: string }
interface ChartLine { dataKey: string; label: string; color?: string }

interface ChartConfig {
  type: 'bar' | 'line';
  title: string;
  xKey: string;
  bars?: ChartBar[];
  lines?: ChartLine[];
  data: Record<string, unknown>[];
}

interface Recommendation {
  priority: string;
  action: string;
  metric?: string;
}

interface AnalysisResult {
  text: string;
  charts: ChartConfig[];
  recommendations: Recommendation[];
  summary: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  result?: AnalysisResult;
}

interface ModelOption {
  id: string;
  label: string;
  provider: 'gemini' | 'openrouter';
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini-flash-latest', label: 'Gemini Flash', provider: 'gemini', description: '快速・經濟' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro', provider: 'gemini', description: '深度分析' },
  // ⚙️ OpenRouter 模型暫時停用（後端 AIModelManager 的 ENABLE_OPENROUTER 也需一併開啟）。
  // 要恢復多供應商選單，取消下面三行的註解即可：
  // { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'openrouter', description: 'OpenRouter・策略規劃' },
  // { id: 'openai/gpt-5.1', label: 'GPT-5.1', provider: 'openrouter', description: 'OpenRouter・全方位' },
  // { id: 'x-ai/grok-4', label: 'Grok 4', provider: 'openrouter', description: 'OpenRouter・即時' },
];

interface Props {
  accessToken: string;
  channelId: string;
}

// ─── Color palette ────────────────────────────────

const COLORS = ['#FF0000', '#4285F4', '#34A853', '#FBBC05', '#EA4335', '#9B59B6'];

// ─── Chart 渲染 ───────────────────────────────────

// 圖表畫不出來時的退路：直接把資料列成表格，而不是顯示空白
function ChartFallbackTable({ chart }: { chart: ChartConfig }) {
  const rows = Array.isArray(chart.data) ? chart.data : [];
  const keys = rows.length ? Object.keys(rows[0]) : [];
  if (!rows.length || !keys.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm text-sm text-[#909090]">
        {chart.title || '圖表'}：資料不足，無法顯示。
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm overflow-x-auto">
      <div className="text-sm font-semibold mb-2 text-[#0F0F0F]">{chart.title}</div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[#909090]">
            {keys.map(k => (
              <th key={k} className="px-2 py-1 text-left">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="border-t border-[#F5F5F5]">
              {keys.map(k => (
                <td key={k} className="px-2 py-1">{String(r[k] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartRenderer({ chart }: { chart: ChartConfig }) {
  const data = Array.isArray(chart.data) ? chart.data : [];
  if (data.length === 0) return <ChartFallbackTable chart={chart} />;
  const firstRow = data[0] as Record<string, unknown>;

  const labels = data.map(d => String(d[chart.xKey] ?? '').slice(0, 20));
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: chart.title, font: { size: 14, weight: 'bold' as const } },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  if (chart.type === 'bar' && chart.bars?.length) {
    const validBars = chart.bars.filter(b => b.dataKey in firstRow);
    if (!validBars.length) return <ChartFallbackTable chart={chart} />;
    const datasets = validBars.map((bar, i) => ({
      label: bar.label,
      data: data.map(d => Number(d[bar.dataKey] ?? 0)),
      backgroundColor: (bar.color || COLORS[i % COLORS.length]) + 'CC',
      borderColor: bar.color || COLORS[i % COLORS.length],
      borderWidth: 1,
    }));
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm">
        <Bar data={{ labels, datasets }} options={chartOptions} />
      </div>
    );
  }

  if (chart.type === 'line' && chart.lines?.length) {
    const validLines = chart.lines.filter(l => l.dataKey in firstRow);
    if (!validLines.length) return <ChartFallbackTable chart={chart} />;
    // x 軸：若值已是百分比（>1.5）就不再 ×100
    const xVals = data.map(d => Number(d[chart.xKey] ?? 0));
    const xIsPercent = Math.max(...xVals, 0) > 1.5;
    const lineLabels = xVals.map(v => `${(xIsPercent ? v : v * 100).toFixed(0)}%`);
    const datasets = validLines.map((line, i) => {
      const yVals = data.map(d => Number(d[line.dataKey] ?? 0));
      const yIsPercent = Math.max(...yVals, 0) > 1.5;
      return {
        label: line.label,
        data: yVals.map(v => parseFloat((yIsPercent ? v : v * 100).toFixed(1))),
        borderColor: line.color || COLORS[i % COLORS.length],
        backgroundColor: (line.color || COLORS[i % COLORS.length]) + '22',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      };
    });
    const lineOptions = {
      ...chartOptions,
      scales: {
        x: { title: { display: true, text: '影片進度' } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: '留存率 (%)' } },
      },
    };
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-sm">
        <Line data={{ labels: lineLabels, datasets }} options={lineOptions} />
      </div>
    );
  }

  return <ChartFallbackTable chart={chart} />;
}

// ─── 建議清單 ─────────────────────────────────────

function RecommendationList({ items }: { items: Recommendation[] }) {
  const priorityColor: Record<string, string> = {
    高: 'bg-red-100 text-red-700 border-red-200',
    中: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    低: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[#111] flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#FF0000]" />
        具體建議
      </h3>
      {items.map((rec, i) => (
        <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm">
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityColor[rec.priority] || priorityColor['中']}`}>
            {rec.priority}
          </span>
          <div>
            <p className="text-sm text-[#111]">{rec.action}</p>
            {rec.metric && <p className="text-xs text-[#606060] mt-0.5">預期改善：{rec.metric}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────

const API_BASE =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_URL ||
  ((import.meta as any).env?.DEV ? 'http://localhost:3001/api' : '/api');

const EXAMPLES = [
  '分析最近半年「開箱」單元的觀看成效',
  '比較去年和今年同期的頻道整體表現',
  '找出哪些影片完播率最低，可能的原因是什麼？',
  '哪些影片的搜尋流量佔比最高？',
];

export function AIAnalysisPanel({ accessToken, channelId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-flash-latest');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStatusText('');

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      result: { text: '', charts: [], recommendations: [], summary: '' },
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_BASE}/analytics/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          model: selectedModel,
          accessToken,
          channelId,
          // 帶入先前的 user 與 assistant 對話，讓追問能延續上下文
          messages: messages
            .map(m => ({
              role: m.role,
              content: m.role === 'assistant' ? m.result?.text || '' : m.content || '',
            }))
            .filter(m => m.content && m.content.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error(`伺服器錯誤: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'status') {
              setStatusText(event.message);
            } else if (event.type === 'chunk') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant' && last.result) {
                  last.result.text += event.text;
                }
                return updated;
              });
            } else if (event.type === 'charts') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant' && last.result) {
                  last.result.charts = event.charts || [];
                  last.result.recommendations = event.recommendations || [];
                  last.result.summary = event.summary || '';
                }
                return updated;
              });
            } else if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant' && last.result) {
                  last.result.text = `分析失敗：${event.message}`;
                }
                return updated;
              });
            } else if (event.type === 'done') {
              setStatusText('');
            }
          } catch {
            // 忽略解析錯誤
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && last.result) {
          last.result.text = `錯誤：${err.message}`;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 標題 */}
      <div className="relative overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-sm p-6">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#FF0000]/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-40 h-40 bg-[#FF5858]/10 rounded-full blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold flex items-center gap-2 text-[#111111]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-lg">
                <Sparkles className="w-5 h-5" />
              </span>
              AI 數據分析
            </h2>
            <p className="text-[#5F5F5F] mt-1">
              用自然語言描述你想分析的內容，AI 會自動查詢數據並生成報告
            </p>
          </div>
          <div className="shrink-0">
            <label className="block text-xs text-[#909090] mb-1">模型</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={isLoading}
              className="rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#333] focus:outline-none focus:border-[#FF0000] focus:ring-1 focus:ring-[#FF0000]/20 disabled:opacity-50"
            >
              {MODEL_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}（{opt.description}）
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 對話區 */}
      {messages.length === 0 ? (
        /* 空狀態：顯示範例問題 */
        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6">
          <p className="text-sm font-semibold text-[#606060] mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            你可以這樣問：
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLES.map((example, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(example)}
                className="text-left p-3 rounded-xl border border-[#E5E5E5] hover:border-[#FF8A8A] hover:bg-[#FFF5F5] transition-all text-sm text-[#333]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-[#FF0000] text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                  <p className="text-sm">{msg.content}</p>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {/* 圖表 */}
                  {msg.result?.charts && msg.result.charts.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {msg.result.charts.map((chart, ci) => (
                        <ChartRenderer key={ci} chart={chart} />
                      ))}
                    </div>
                  )}

                  {/* 摘要 */}
                  {msg.result?.summary && (
                    <div className="bg-[#FFF5F5] border border-[#FFD4D4] rounded-2xl px-4 py-3">
                      <p className="text-sm font-semibold text-[#B40000]">{msg.result.summary}</p>
                    </div>
                  )}

                  {/* 分析文字 */}
                  {msg.result?.text && (
                    <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5">
                      <AnalysisMarkdown>{msg.result.text}</AnalysisMarkdown>
                    </div>
                  )}

                  {/* 建議 */}
                  {msg.result?.recommendations && msg.result.recommendations.length > 0 && (
                    <RecommendationList items={msg.result.recommendations} />
                  )}

                  {/* 載入中 */}
                  {isLoading && i === messages.length - 1 && !msg.result?.text && (
                    <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5 flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 text-[#FF0000] animate-spin" />
                      <span className="text-sm text-[#606060]">{statusText || '分析中...'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 分析中狀態提示 */}
          {isLoading && statusText && (
            <div className="flex items-center gap-2 text-sm text-[#606060] px-1">
              <RefreshCw className="w-3 h-3 text-[#FF0000] animate-spin" />
              {statusText}
            </div>
          )}
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* 輸入框 */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-3 flex gap-3 items-end sticky bottom-4">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想分析的內容，例如：分析最近 3 個月開箱單元的成效..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm focus:outline-none focus:border-[#FF0000] focus:ring-1 focus:ring-[#FF0000]/20 placeholder:text-[#B0B0B0]"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSubmit(input)}
          disabled={isLoading || !input.trim()}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#FF0000] text-white shadow-[0_4px_14px_rgba(255,0,0,0.3)] hover:bg-[#D40000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-[#909090] text-center -mt-4">
        Enter 送出 · Shift+Enter 換行 · 搜尋影片從 Gist 快取讀取（不耗 API 配額）
      </p>
    </div>
  );
}
