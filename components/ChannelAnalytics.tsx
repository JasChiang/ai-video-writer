import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, RefreshCw, Calendar, TrendingUp, BarChart3, Sparkles, ListVideo } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import {
  getRelativeDateRange,
  parseAbsoluteDateRange,
  getDateRangeLabel,
  type RelativeDateType,
  type DateRange
} from '../utils/dateRangeUtils';
import { ChannelDashboard } from './ChannelDashboard';
import { KeywordAnalysisPanel } from './KeywordAnalysisPanel';
import { AIAnalysisPanel } from './AIAnalysisPanel';
import { AllVideosTable } from './AllVideosTable';

interface KeywordGroup {
  id: string;
  name: string;
}

interface DateColumn {
  id: string;
  config: string; // 相對日期類型或絕對日期字符串
  label: string;
}

interface AnalyticsData {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  videoCount: number;
  error?: string;
}

interface MetricConfig {
  key: keyof AnalyticsData;
  label: string;
  format: 'number' | 'duration' | 'percentage';
}

const AVAILABLE_METRICS: MetricConfig[] = [
  { key: 'views', label: '觀看次數', format: 'number' },
  { key: 'estimatedMinutesWatched', label: '觀看時長 (分)', format: 'number' },
  { key: 'averageViewDuration', label: '平均觀看時長 (秒)', format: 'number' },
  { key: 'averageViewPercentage', label: '平均觀看百分比 (%)', format: 'percentage' },
  { key: 'likes', label: '讚數', format: 'number' },
  { key: 'comments', label: '評論數', format: 'number' },
  { key: 'shares', label: '分享數', format: 'number' },
  { key: 'subscribersGained', label: '新增訂閱者', format: 'number' },
];

interface TableData {
  name: string;
  keyword: string;
  videoCount: number;
  dateRanges: Record<string, AnalyticsData>;
}

const TEMPLATE_STORAGE_KEY = 'channelAnalytics.templates';
const DEFAULT_TEMPLATE_NAME = '預設模板';

// 預設的相對日期選項
const RELATIVE_DATE_OPTIONS: Array<{ value: RelativeDateType; label: string }> = [
  { value: 'last7days', label: '過去 7 天' },
  { value: 'last30days', label: '過去 30 天' },
  { value: 'thisMonth', label: '本月' },
  { value: 'lastMonth', label: '上個月' },
  { value: 'twoMonthsAgo', label: '上上個月' },
  { value: 'thisYear', label: '今年' },
  { value: 'lastYear', label: '去年' },
  { value: 'lastMonthLastYear', label: '去年上個月' },
];

interface TemplateData {
  name: string;
  keywordGroups: KeywordGroup[];
  dateColumns: DateColumn[];
  createdAt: number;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

type TabType = 'dashboard' | 'videos' | 'ai' | 'report';

export function ChannelAnalytics({ onWriteArticle }: { onWriteArticle?: () => void } = {}) {
  // 分頁狀態
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // 狀態管理
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [dateColumns, setDateColumns] = useState<DateColumn[]>([]);
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [channelIdLoading, setChannelIdLoading] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<Array<keyof AnalyticsData>>(['views', 'likes']);
  const aiAnalysisRef = useRef<HTMLDivElement>(null);
  const hasScrolledToAI = useRef(false);
  const [channelCountry, setChannelCountry] = useState<string>('');

  // 模板管理
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // 加載模板列表 + 初始化頻道 ID
  useEffect(() => {
    loadTemplates();
    initializeDefaultConfig();
    // 提前取得 channelId，讓 AI 分析 tab 可以直接用
    (async () => {
      try {
        const id = await youtubeService.getChannelId({ trigger: 'initial-load', source: 'ChannelAnalytics' });
        if (id) setChannelId(id);
      } catch { /* 未登入時忽略 */ } finally {
        setChannelIdLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = () => {
    try {
      const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TemplateData[];
        setTemplates(parsed);
      }
    } catch (err) {
      console.error('載入模板失敗:', err);
    }
  };

  const initializeDefaultConfig = () => {
    // 預設顯示過去 7 天
    const defaultDateColumn: DateColumn = {
      id: generateId(),
      config: 'last7days',
      label: '過去 7 天',
    };

    setDateColumns([defaultDateColumn]);
  };

  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // 關鍵字組合管理
  const addKeywordGroup = () => {
    const newGroup: KeywordGroup = {
      id: generateId(),
      name: '',
    };
    setKeywordGroups([...keywordGroups, newGroup]);
  };

  const updateKeywordGroupName = (id: string, value: string) => {
    setKeywordGroups(keywordGroups.map(group =>
      group.id === id ? { ...group, name: value } : group
    ));
  };

  const removeKeywordGroup = (id: string) => {
    setKeywordGroups(keywordGroups.filter(group => group.id !== id));
  };

  // 日期列管理
  const addDateColumn = () => {
    const newColumn: DateColumn = {
      id: generateId(),
      config: 'thisMonth',
      label: '本月',
    };
    setDateColumns([...dateColumns, newColumn]);
  };

  const updateDateColumn = (id: string, config: string) => {
    setDateColumns(dateColumns.map(column => {
      if (column.id === id) {
        const label = getDateRangeLabel(config);
        return { ...column, config, label };
      }
      return column;
    }));
  };

  const removeDateColumn = (id: string) => {
    setDateColumns(dateColumns.filter(column => column.id !== id));
  };

  // 獲取頻道 ID
  const fetchChannelId = async (): Promise<string> => {
    if (channelId) {
      return channelId;
    }

    // 從 YouTube API 獲取頻道 ID
    const token = youtubeService.getAccessToken();
    if (!token) {
      throw new Error('未登入 YouTube');
    }

    // 調用 YouTube API 獲取頻道資訊
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('無法獲取頻道資訊');
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('找不到頻道');
    }

    const id = data.items[0].id;
    setChannelId(id);
    return id;
  };

  // 獲取數據
  const fetchData = async () => {
    if (keywordGroups.length === 0) {
      setError('請至少添加一個關鍵字組合');
      return;
    }

    if (dateColumns.length === 0) {
      setError('請至少添加一個日期範圍');
      return;
    }

    // 驗證關鍵字組合
    for (const group of keywordGroups) {
      if (!group.name.trim()) {
        setError('請為所有關鍵字組合設定名稱');
        return;
      }
    }

    // 檢查重複關鍵字
    const names = keywordGroups.map(g => g.name.trim().toLowerCase());
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      setError(`關鍵字重複：「${[...new Set(duplicates)].join('、')}」，請移除其中一個`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = youtubeService.getAccessToken();
      if (!token) {
        throw new Error('未登入 YouTube');
      }

      const id = await fetchChannelId();

      // 解析日期範圍
      const dateRanges: Array<{ label: string; startDate: string; endDate: string }> = [];

      for (const column of dateColumns) {
        const range = parseDateConfig(column.config);
        if (!range) {
          throw new Error(`無法解析日期配置: ${column.config}`);
        }
        dateRanges.push({
          label: column.label,
          startDate: range.startDate,
          endDate: range.endDate,
        });
      }

      // 調用後端 API
      const response = await fetch(`${API_BASE_URL}/channel-analytics/aggregate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: token,
          channelId: id,
          keywordGroups: keywordGroups.map(g => {
            const trimmedName = g.name.trim();
            return {
              name: trimmedName,
              keyword: trimmedName,
            };
          }),
          dateRanges,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      let parsedResponse: any = null;

      if (contentType.includes('application/json') && responseText) {
        try {
          parsedResponse = JSON.parse(responseText);
        } catch (parseErr) {
          console.warn('無法解析 JSON 回應:', parseErr);
        }
      }

      if (!response.ok) {
        const message =
          parsedResponse?.error ||
          parsedResponse?.message ||
          responseText ||
          '獲取數據失敗';
        throw new Error(message);
      }

      if (!parsedResponse) {
        throw new Error('後端回傳格式錯誤（非 JSON）');
      }

      const result = parsedResponse;

      // 設定表格數據
      setTableData(result.rows);

      // 設定頻道國家
      if (result.summary && result.summary.channelCountry) {
        setChannelCountry(result.summary.channelCountry);
      }

      // 只有第一次取得數據才自動捲到 AI 分析區
      if (!hasScrolledToAI.current) {
        hasScrolledToAI.current = true;
        setTimeout(() => {
          aiAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (err: any) {
      console.error('獲取數據失敗:', err);
      setError(err.message || '獲取數據失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 解析日期配置
  const parseDateConfig = (config: string): DateRange | null => {
    // 檢查是否是相對日期
    const relativeDateTypes: RelativeDateType[] = [
      'last7days', 'last30days', 'thisYear', 'lastYear',
      'thisMonth', 'lastMonth', 'twoMonthsAgo', 'lastMonthLastYear'
    ];

    if (relativeDateTypes.includes(config as RelativeDateType)) {
      return getRelativeDateRange(config as RelativeDateType);
    }

    // 嘗試解析為絕對日期
    return parseAbsoluteDateRange(config);
  };

  // 模板管理
  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      alert('請輸入模板名稱');
      return;
    }

    if (keywordGroups.length === 0 || dateColumns.length === 0) {
      alert('請至少添加一個關鍵字組合和一個日期範圍');
      return;
    }

    const template: TemplateData = {
      name: newTemplateName.trim(),
      keywordGroups: keywordGroups.map(group => ({
        id: group.id,
        name: group.name.trim(),
      })),
      dateColumns: [...dateColumns],
      createdAt: Date.now(),
    };

    const updatedTemplates = [...templates, template];
    setTemplates(updatedTemplates);

    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
      setNewTemplateName('');
      setShowTemplateDialog(false);
      alert('模板已保存');
    } catch (err) {
      console.error('保存模板失敗:', err);
      alert('保存模板失敗');
    }
  };

  const loadTemplate = (templateName: string) => {
    const template = templates.find(t => t.name === templateName);
    if (!template) {
      alert('找不到模板');
      return;
    }

    const normalizedGroups = template.keywordGroups.map(group => ({
      id: group.id || generateId(),
      name: group.name?.trim() || (group as any).keyword?.trim() || '',
    }));
    setKeywordGroups(normalizedGroups);
    setDateColumns([...template.dateColumns]);
    setSelectedTemplate(templateName);
    alert(`已載入模板: ${templateName}`);
  };

  const deleteTemplate = (templateName: string) => {
    if (!confirm(`確定要刪除模板「${templateName}」嗎？`)) {
      return;
    }

    const updatedTemplates = templates.filter(t => t.name !== templateName);
    setTemplates(updatedTemplates);

    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
      if (selectedTemplate === templateName) {
        setSelectedTemplate(null);
      }
      alert('模板已刪除');
    } catch (err) {
      console.error('刪除模板失敗:', err);
      alert('刪除模板失敗');
    }
  };

  // 清除快取
  const clearCache = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/channel-analytics/clear-cache`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('清除快取失敗');
      }

      const result = await response.json();
      alert(result.message);
    } catch (err: any) {
      console.error('清除快取失敗:', err);
      alert('清除快取失敗');
    }
  };

  // 格式化數據值
  const formatValue = (value: number, format: 'number' | 'duration' | 'percentage'): string => {
    if (format === 'percentage') {
      return value.toFixed(2);
    }
    if (format === 'duration') {
      return value.toFixed(0);
    }
    // 完整數字，加上千分位
    return value.toLocaleString('en-US');
  };

  // 切換指標選擇
  const toggleMetric = (metricKey: keyof AnalyticsData) => {
    if (selectedMetrics.includes(metricKey)) {
      // 至少保留一個指標
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter(m => m !== metricKey));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, metricKey]);
    }
  };

  return (
    <div className="space-y-8 font-['Roboto',sans-serif] text-[#0F0F0F]">
      {/* 分頁選擇器 */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'bg-[#FF0000] text-white shadow-[0_4px_16px_rgba(255,0,0,0.25)]'
              : 'text-[#606060] hover:text-[#0F0F0F] hover:bg-[#FFF5F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <BarChart3 className="w-5 h-5" />
            頻道儀表板
          </div>
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'videos'
              ? 'bg-[#FF0000] text-white shadow-[0_4px_16px_rgba(255,0,0,0.25)]'
              : 'text-[#606060] hover:text-[#0F0F0F] hover:bg-[#FFF5F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <ListVideo className="w-5 h-5" />
            全部影片
          </div>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'ai'
              ? 'bg-[#FF0000] text-white shadow-[0_4px_16px_rgba(255,0,0,0.25)]'
              : 'text-[#606060] hover:text-[#0F0F0F] hover:bg-[#FFF5F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <Sparkles className="w-5 h-5" />
            AI 分析
          </div>
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === 'report'
              ? 'bg-[#FF0000] text-white shadow-[0_4px_16px_rgba(255,0,0,0.25)]'
              : 'text-[#606060] hover:text-[#0F0F0F] hover:bg-[#FFF5F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
            <TrendingUp className="w-5 h-5" />
            關鍵字報表
          </div>
        </button>
      </div>

      {/* 儀錶板視圖 */}
      {activeTab === 'dashboard' && <ChannelDashboard />}

      {/* 全部影片視圖 */}
      {activeTab === 'videos' && (() => {
        const token = youtubeService.getAccessToken();
        return token ? (
          <AllVideosTable accessToken={token} channelId={channelId} />
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-10 text-center text-[#909090]">
            <ListVideo className="w-8 h-8 mx-auto mb-3 text-[#CCCCCC]" />
            請先登入 YouTube 帳號以檢視全部影片。
          </div>
        );
      })()}

      {/* AI 分析視圖 - 保持 mounted 避免切換分頁時對話紀錄消失 */}
      <div style={{ display: activeTab === 'ai' ? 'block' : 'none' }}>
        {(() => {
          const token = youtubeService.getAccessToken();
          if (channelIdLoading) {
            return (
              <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-8 text-center text-[#606060]">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#CCCCCC] animate-pulse" />
                <p>取得頻道資料中…</p>
              </div>
            );
          }
          return token && channelId ? (
            <AIAnalysisPanel accessToken={token} channelId={channelId} />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-8 text-center text-[#606060]">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#CCCCCC]" />
              <p>請先登入 YouTube 帳號</p>
            </div>
          );
        })()}
      </div>

      {/* 報表分析視圖 */}
      {activeTab === 'report' && (
        <div className="space-y-5">

          {/* ── 設定區（合併關鍵字、時間、指標）── */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-5 space-y-5">

            {/* 關鍵字行 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[#111]">關鍵字（表格行）</h3>
                  <p className="text-xs text-[#909090] mt-0.5">每個關鍵字會過濾出標題含該字的影片</p>
                </div>
                <button
                  onClick={addKeywordGroup}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF0000] text-white rounded-xl text-sm font-semibold hover:bg-[#D40000]"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </div>
              {keywordGroups.length === 0 ? (
                <p className="text-sm text-[#B0B0B0] text-center py-4 border border-dashed border-[#E5E5E5] rounded-xl">
                  點擊「新增」加入關鍵字，例如：開箱、評測、旅遊
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {keywordGroups.map(group => (
                    <div key={group.id} className="flex items-center gap-1 bg-[#FFF5F5] border border-[#FFD4D4] rounded-xl px-1 pr-1 py-1">
                      <input
                        type="text"
                        placeholder="關鍵字"
                        value={group.name}
                        onChange={(e) => updateKeywordGroupName(group.id, e.target.value)}
                        className="w-24 bg-transparent px-2 text-sm text-[#111] focus:outline-none"
                      />
                      <button
                        onClick={() => removeKeywordGroup(group.id)}
                        className="text-[#FF3B30] hover:bg-[#FFECEC] rounded-lg p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-[#F0F0F0]" />

            {/* 時間列 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[#111] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#FF0000]" />
                    時間範圍（表格列）
                  </h3>
                  <p className="text-xs text-[#909090] mt-0.5">可同時比較多個時間段</p>
                </div>
                <button
                  onClick={addDateColumn}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF0000] text-white rounded-xl text-sm font-semibold hover:bg-[#D40000]"
                >
                  <Plus className="w-4 h-4" />
                  新增
                </button>
              </div>
              <div className="space-y-2">
                {dateColumns.map(column => {
                  const isCustom = !RELATIVE_DATE_OPTIONS.some(opt => opt.value === column.config);
                  return (
                    <div key={column.id} className="flex gap-2 items-center">
                      <select
                        value={isCustom ? '__custom__' : column.config}
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') {
                            updateDateColumn(column.id, e.target.value);
                          } else {
                            updateDateColumn(column.id, '');
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A7A]"
                      >
                        {RELATIVE_DATE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                        <option value="__custom__">自訂日期...</option>
                      </select>
                      {isCustom && (
                        <input
                          type="text"
                          placeholder="如：2024、202410"
                          value={column.config}
                          onChange={(e) => updateDateColumn(column.id, e.target.value)}
                          className="flex-1 px-3 py-2 border border-[#FF7A7A] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A7A]"
                          autoFocus
                        />
                      )}
                      <button
                        onClick={() => removeDateColumn(column.id)}
                        className="text-[#FF3B30] hover:bg-[#FFECEC] rounded-xl p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <hr className="border-[#F0F0F0]" />

            {/* 數據指標 */}
            <div>
              <h3 className="font-semibold text-[#111] mb-3">顯示指標</h3>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_METRICS.map(metric => (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                      selectedMetrics.includes(metric.key)
                        ? 'border-[#FF5F5F] bg-[#FFF0F0] text-[#B40000]'
                        : 'border-[#E5E5E5] text-[#606060] hover:border-[#FF7C7C]'
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 獲取數據按鈕 */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="flex-1 py-3 bg-gradient-to-r from-[#FF4B4B] to-[#D40000] text-white rounded-xl hover:shadow-[0_6px_20px_rgba(255,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all"
              >
                {isLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />載入中...</>
                ) : (
                  <><TrendingUp className="w-4 h-4" />獲取數據</>
                )}
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-3 border border-[#E5E5E5] text-[#606060] rounded-xl hover:bg-[#F9F9F9] text-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                清快取
              </button>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* ── Loading overlay ── */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-8 text-[#707070]">
              <svg className="animate-spin w-5 h-5 text-[#FF0000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">取得數據中...</span>
            </div>
          )}

          {/* ── 結果區 ── */}
          {!isLoading && tableData.length > 0 && (
            <>
              {/* AI 關鍵字分析（放在表格上方，數據載入完自動捲到這） */}
              <div ref={aiAnalysisRef} className="bg-white rounded-2xl border-2 border-[#FFC5C5] p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-[#A40000]">
                      <BarChart3 className="w-5 h-5 text-[#FF3B30]" />
                      AI 關鍵字分析
                    </h3>
                    <p className="text-sm mt-0.5 text-[#6B6B6B]">
                      分析各關鍵字成效，給出內容策略建議
                    </p>
                  </div>
                </div>
                <KeywordAnalysisPanel
                  keywordGroups={keywordGroups}
                  dateColumns={dateColumns}
                  analyticsData={(() => {
                    const result: Record<string, Record<string, any>> = {};
                    tableData.forEach((row, index) => {
                      const groupId = keywordGroups[index]?.id;
                      if (!groupId) return;
                      result[groupId] = {};
                      dateColumns.forEach((column) => {
                        const data = row.dateRanges[column.label];
                        result[groupId][column.id] = data || { error: '無數據' };
                      });
                    });
                    return result;
                  })()}
                  selectedMetrics={selectedMetrics}
                />
              </div>

              {/* 數據表格 */}
              <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FFFAFA] border-b border-[#FFE0E0] text-[#B40000]">
                    <tr className="uppercase tracking-wider text-xs">
                      <th className="px-5 py-4 text-left font-semibold">名稱</th>
                      <th className="px-5 py-4 text-left font-semibold">影片數</th>
                      {dateColumns.map(column => (
                        <th key={column.id} className="px-5 py-4 text-center font-semibold">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F3F3]">
                    {tableData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-[#FFF5F5] transition-colors">
                        <td className="px-5 py-4 align-top">
                          <div className="font-semibold text-[#181818]">{row.name}</div>
                          {row.keyword && (
                            <div className="text-xs text-[#8A8A8A] mt-1">關鍵字: {row.keyword}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-center font-bold text-[#111111]">{row.videoCount}</td>
                        {dateColumns.map(column => {
                          const data = row.dateRanges[column.label];
                          if (!data) return <td key={column.id} className="px-5 py-4 text-center text-[#C4C4C4]">-</td>;
                          if (data.error) return (
                            <td key={column.id} className="px-5 py-4 text-center">
                              <span className="text-[#FF3B30] text-sm font-semibold">錯誤</span>
                            </td>
                          );
                          return (
                            <td key={column.id} className="px-5 py-4 align-top">
                              <div className="text-sm space-y-1.5">
                                {selectedMetrics.map(metricKey => {
                                  const metric = AVAILABLE_METRICS.find(m => m.key === metricKey);
                                  if (!metric) return null;
                                  return (
                                    <div key={metricKey} className="flex justify-between gap-2">
                                      <span className="text-[#6B6B6B]">{metric.label}:</span>
                                      <span className="font-semibold text-[#111111]">
                                        {formatValue(data[metricKey] as number, metric.format)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 模板管理（放在最下方） */}
              <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[#111]">儲存為模板</h3>
                    <p className="text-sm text-[#707070] mt-0.5">把目前的關鍵字和時間設定存起來，下次一鍵載入</p>
                  </div>
                  <button
                    onClick={() => setShowTemplateDialog(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[#E5E5E5] text-[#444] rounded-xl text-sm hover:bg-[#F9F9F9]"
                  >
                    <Save className="w-4 h-4" />
                    儲存
                  </button>
                </div>
                {templates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {templates.map(template => (
                      <div
                        key={template.name}
                        className={`border rounded-xl p-3 cursor-pointer transition-all ${
                          selectedTemplate === template.name
                            ? 'border-[#FF5F5F] bg-[#FFF5F5]'
                            : 'border-[#E5E5E5] hover:border-[#FF8A8A]'
                        }`}
                        onClick={() => loadTemplate(template.name)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-[#1D1D1D]">{template.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTemplate(template.name); }}
                            className="text-[#FF3B30] hover:bg-[#FFECEC] rounded-lg p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-[#8A8A8A] mt-1">
                          {template.keywordGroups.length} 個關鍵字 · {template.dateColumns.length} 個時間段
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 保存模板對話框 */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-[#EAEAEA]">
            <h3 className="text-lg font-semibold mb-4 text-[#111111]">保存為模板</h3>
            <input
              type="text"
              placeholder="模板名稱"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A7A] mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTemplateDialog(false);
                  setNewTemplateName('');
                }}
                className="px-4 py-2 border border-[#E5E5E5] rounded-xl hover:bg-[#F9F9F9]"
              >
                取消
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 bg-[#FF0000] text-white rounded-xl hover:bg-[#D40000] shadow-[0_4px_12px_rgba(255,0,0,0.25)]"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
