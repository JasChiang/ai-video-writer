import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RefreshCw, Calendar, TrendingUp, BarChart3, Users, CheckCircle2 } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import {
  getRelativeDateRange,
  parseAbsoluteDateRange,
  getDateRangeLabel,
  type RelativeDateType,
  type DateRange
} from '../utils/dateRangeUtils';
import {
  validateAndParseChannelId,
  fetchChannelInfo,
  formatSubscriberCount,
} from '../utils/channelIdUtils';
import { ChannelDashboard } from './ChannelDashboard';
import { KeywordAnalysisPanel } from './KeywordAnalysisPanel';

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

type TabType = 'dashboard' | 'report';
type AnalysisMode = 'myChannel' | 'competitor';

interface ChannelInfo {
  channelId: string;
  title: string;
  customUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
}

export function ChannelAnalytics() {
  // 分頁狀態
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // 分析模式：我的頻道 or 競爭對手
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('myChannel');

  // 競爭對手頻道相關
  const [competitorInput, setCompetitorInput] = useState<string>('');
  const [competitorChannelInfo, setCompetitorChannelInfo] = useState<ChannelInfo | null>(null);
  const [isValidatingChannel, setIsValidatingChannel] = useState(false);
  const [channelValidationError, setChannelValidationError] = useState<string | null>(null);

  // 狀態管理
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [dateColumns, setDateColumns] = useState<DateColumn[]>([]);
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [selectedMetrics, setSelectedMetrics] = useState<Array<keyof AnalyticsData>>(['views', 'likes']);
  const [channelCountry, setChannelCountry] = useState<string>('');

  // 模板管理
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // 加載模板列表
  useEffect(() => {
    loadTemplates();
    // 加載預設配置（過去 7 天）
    initializeDefaultConfig();
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
    // 如果是競爭對手模式，使用競爭對手的頻道 ID
    if (analysisMode === 'competitor') {
      if (!competitorChannelInfo) {
        throw new Error('請先驗證競爭對手頻道');
      }
      return competitorChannelInfo.channelId;
    }

    // 我的頻道模式
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

  // 驗證競爭對手頻道
  const validateCompetitorChannel = async () => {
    if (!competitorInput.trim()) {
      setChannelValidationError('請輸入頻道 ID 或 URL');
      return;
    }

    setIsValidatingChannel(true);
    setChannelValidationError(null);
    setCompetitorChannelInfo(null);

    try {
      const token = youtubeService.getAccessToken();
      if (!token) {
        throw new Error('未登入 YouTube');
      }

      // 驗證並解析頻道 ID
      const validation = validateAndParseChannelId(competitorInput);
      if (!validation.isValid) {
        setChannelValidationError(validation.error || '無效的頻道 ID');
        return;
      }

      // 獲取頻道資訊
      const channelInfo = await fetchChannelInfo(validation.channelId!, token);
      if (!channelInfo.success) {
        setChannelValidationError(channelInfo.error || '獲取頻道資訊失敗');
        return;
      }

      // 設置頻道資訊
      setCompetitorChannelInfo({
        channelId: channelInfo.channelId!,
        title: channelInfo.title!,
        customUrl: channelInfo.customUrl,
        subscriberCount: channelInfo.subscriberCount,
        videoCount: channelInfo.videoCount,
      });
    } catch (err: any) {
      console.error('驗證頻道失敗:', err);
      setChannelValidationError(err.message || '驗證頻道失敗');
    } finally {
      setIsValidatingChannel(false);
    }
  };

  // 切換分析模式時重置狀態
  useEffect(() => {
    setTableData([]);
    setError(null);
    setCompetitorChannelInfo(null);
    setChannelValidationError(null);
    setCompetitorInput('');
  }, [analysisMode]);

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
          forMine: analysisMode === 'myChannel', // 根據分析模式設置
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

      {/* 報表分析視圖 */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* 標題區域 */}
          <div className="relative overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-sm p-6">
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#FF0000]/10 rounded-full blur-3xl" />
            <div className="absolute -left-20 bottom-0 w-40 h-40 bg-[#FF5858]/10 rounded-full blur-2xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold flex items-center gap-2 text-[#111111]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-lg">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  頻道數據分析
                </h2>
                <p className="text-[#5F5F5F] mt-1">
                  根據關鍵字搜尋影片、比較不同時間段的影片表現
                </p>
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-[#B40000] bg-[#FFF0F0] border border-[#FFD4D4] px-3 py-2 rounded-xl shadow-inner">
                    💡 系統會獲取頻道<strong>所有影片</strong>（{analysisMode === 'myChannel' ? '公開、未列出、私人' : '僅公開影片'}），再根據<strong>關鍵字</strong>過濾，並統計您選擇的<strong>時間段內</strong>的數據
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:flex-col items-stretch sm:items-end">
                <button
                  onClick={clearCache}
                  className="px-4 py-2 rounded-xl border border-[#FFB7B7] text-[#B40000] bg-white/80 hover:bg-[#FFF0F0] transition-colors shadow-sm flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <RefreshCw className="w-4 h-4" />
                  清除快取
                </button>
              </div>
            </div>
          </div>

          {/* 分析模式選擇 */}
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-lg text-[#111111] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF0000]" />
                分析模式
              </h3>
              <p className="text-sm text-[#707070] mt-1">選擇要分析的頻道類型</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setAnalysisMode('myChannel')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  analysisMode === 'myChannel'
                    ? 'border-[#FF5F5F] bg-[#FFF0F0] shadow-inner'
                    : 'border-[#E5E5E5] hover:border-[#FF7C7C] hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${
                    analysisMode === 'myChannel' ? 'bg-[#FF0000] text-white' : 'bg-[#F5F5F5] text-[#606060]'
                  }`}>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[#111111]">我的頻道</div>
                    <div className="text-sm text-[#6B6B6B] mt-1">
                      分析您自己的 YouTube 頻道數據
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAnalysisMode('competitor')}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  analysisMode === 'competitor'
                    ? 'border-[#FF5F5F] bg-[#FFF0F0] shadow-inner'
                    : 'border-[#E5E5E5] hover:border-[#FF7C7C] hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${
                    analysisMode === 'competitor' ? 'bg-[#FF0000] text-white' : 'bg-[#F5F5F5] text-[#606060]'
                  }`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[#111111]">競爭對手頻道</div>
                    <div className="text-sm text-[#6B6B6B] mt-1">
                      分析其他公開 YouTube 頻道的數據
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* 競爭對手頻道輸入 */}
            {analysisMode === 'competitor' && (
              <div className="mt-4 p-4 bg-[#FAFAFA] rounded-2xl border border-[#E5E5E5]">
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-[#111111] mb-2">
                    輸入競爭對手頻道
                  </label>
                  <p className="text-xs text-[#6B6B6B] mb-3">
                    支援格式：頻道 ID (UC...)、@handle、或完整 YouTube 頻道 URL
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="例如: UCxxxxxx 或 @channelname 或 https://youtube.com/@channelname"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        validateCompetitorChannel();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A7A] text-sm"
                  />
                  <button
                    onClick={validateCompetitorChannel}
                    disabled={isValidatingChannel}
                    className="px-4 py-2 bg-[#FF0000] text-white rounded-xl hover:bg-[#D40000] disabled:bg-[#C4C4C4] flex items-center gap-2 text-sm font-semibold shadow-md transition-all"
                  >
                    {isValidatingChannel ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        驗證中
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        驗證
                      </>
                    )}
                  </button>
                </div>

                {/* 驗證錯誤 */}
                {channelValidationError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {channelValidationError}
                  </div>
                )}

                {/* 頻道資訊 */}
                {competitorChannelInfo && (
                  <div className="mt-3 p-4 bg-white border-2 border-[#4CAF50] rounded-2xl shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[#4CAF50] text-white rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#111111]">{competitorChannelInfo.title}</div>
                        {competitorChannelInfo.customUrl && (
                          <div className="text-sm text-[#6B6B6B] mt-1">{competitorChannelInfo.customUrl}</div>
                        )}
                        <div className="flex gap-4 mt-2 text-sm">
                          {competitorChannelInfo.subscriberCount && (
                            <div className="text-[#606060]">
                              訂閱: <span className="font-semibold text-[#FF0000]">
                                {formatSubscriberCount(competitorChannelInfo.subscriberCount)}
                              </span>
                            </div>
                          )}
                          {competitorChannelInfo.videoCount && (
                            <div className="text-[#606060]">
                              影片: <span className="font-semibold text-[#111111]">
                                {parseInt(competitorChannelInfo.videoCount).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

      {/* 模板管理區域 */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg text-[#111111]">模板管理</h3>
            <p className="text-sm text-[#707070]">儲存常用配置並一鍵載入</p>
          </div>
          <button
            onClick={() => setShowTemplateDialog(true)}
            className="px-4 py-2 bg-[#FF0000] text-white rounded-xl hover:bg-[#D40000] flex items-center justify-center gap-2 text-sm font-semibold shadow-[0_4px_14px_rgba(255,0,0,0.25)]"
          >
            <Save className="w-4 h-4" />
            保存為模板
          </button>
        </div>

        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(template => (
              <div
                key={template.name}
                className={`border rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
                  selectedTemplate === template.name
                    ? 'border-[#FF5F5F] bg-[#FFF5F5] shadow-inner'
                    : 'border-[#E5E5E5] hover:border-[#FF8A8A] hover:shadow-[0_4px_20px_rgba(255,0,0,0.08)]'
                }`}
                onClick={() => loadTemplate(template.name)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-[#1D1D1D]">{template.name}</div>
                    <div className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                      {template.keywordGroups.length} 個關鍵字組合
                      <br />
                      {template.dateColumns.length} 個時間範圍
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(template.name);
                    }}
                    className="text-[#FF3B30] hover:text-[#C92A21] p-1 rounded-full hover:bg-[#FFECEC]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {templates.length === 0 && (
          <p className="text-[#8A8A8A] text-sm text-center py-4">
            尚無保存的模板
          </p>
        )}
      </div>

      {/* 關鍵字組合設定 */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-[#111111]">關鍵字組合（表格行）</h3>
          <button
            onClick={addKeywordGroup}
            className="px-4 py-2 bg-[#FF3838] text-white rounded-xl hover:bg-[#D40000] flex items-center gap-2 text-sm font-semibold shadow-[0_4px_12px_rgba(255,0,0,0.25)]"
          >
            <Plus className="w-4 h-4" />
            添加組合
          </button>
        </div>

        {keywordGroups.length === 0 && (
          <p className="text-[#8A8A8A] text-sm text-center py-8">
            點擊「添加組合」開始設定關鍵字
          </p>
        )}

        <div className="space-y-3">
          {keywordGroups.map(group => (
            <div key={group.id} className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="組合名稱（同時作為搜尋關鍵字）"
                value={group.name}
                onChange={(e) => updateKeywordGroupName(group.id, e.target.value)}
                className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A7A]"
              />
              <button
                onClick={() => removeKeywordGroup(group.id)}
                className="text-[#FF3B30] hover:text-[#C92A21] p-2 rounded-full hover:bg-[#FFECEC]"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 日期範圍設定 */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-lg text-[#111111]">
            <Calendar className="w-5 h-5 text-[#FF0000]" />
            時間範圍（表格列）
          </h3>
          <button
            onClick={addDateColumn}
            className="px-4 py-2 bg-[#FF3838] text-white rounded-xl hover:bg-[#D40000] flex items-center gap-2 text-sm font-semibold shadow-[0_4px_12px_rgba(255,0,0,0.25)]"
          >
            <Plus className="w-4 h-4" />
            添加時間
          </button>
        </div>

        <div className="space-y-3">
          {dateColumns.map(column => (
            <div key={column.id} className="flex gap-3 items-center">
              <select
                value={column.config}
                onChange={(e) => updateDateColumn(column.id, e.target.value)}
                className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A7A]"
              >
                <optgroup label="相對日期">
                  {RELATIVE_DATE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <input
                type="text"
                placeholder="或輸入絕對日期（如：2024、202410）"
                value={!RELATIVE_DATE_OPTIONS.some(opt => opt.value === column.config) ? column.config : ''}
                onChange={(e) => updateDateColumn(column.id, e.target.value)}
                className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A7A]"
              />
              <button
                onClick={() => removeDateColumn(column.id)}
                className="text-[#FF3B30] hover:text-[#C92A21] p-2 rounded-full hover:bg-[#FFECEC]"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 數據指標選擇 */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-[#111111]">選擇要顯示的數據指標</h3>
          <p className="text-sm text-[#6B6B6B] mt-1">
            至少選擇一個指標（點擊切換選擇）
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {AVAILABLE_METRICS.map(metric => (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                selectedMetrics.includes(metric.key)
                  ? 'border-[#FF5F5F] bg-[#FFF0F0] text-[#B40000] shadow-inner'
                  : 'border-[#E5E5E5] hover:border-[#FF7C7C] text-[#5E5E5E]'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* 獲取數據按鈕 */}
      <div className="flex justify-center">
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="px-8 py-3 bg-gradient-to-r from-[#FF4B4B] to-[#D40000] text-white rounded-full hover:shadow-[0_6px_20px_rgba(255,0,0,0.35)] disabled:bg-[#C4C4C4] disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 text-lg font-semibold tracking-wide transition-all"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              載入中...
            </>
          ) : (
            <>
              <TrendingUp className="w-5 h-5" />
              獲取數據
            </>
          )}
        </button>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 數據表格 */}
      {tableData.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#E5E5E5] shadow-sm overflow-x-auto">
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
                    if (!data) {
                      return (
                        <td key={column.id} className="px-5 py-4 text-center text-[#C4C4C4]">
                          -
                        </td>
                      );
                    }

                    if (data.error) {
                      return (
                        <td key={column.id} className="px-5 py-4 text-center">
                          <div className="text-[#FF3B30] text-sm font-semibold">錯誤</div>
                        </td>
                      );
                    }

                    return (
                      <td key={column.id} className="px-5 py-4 align-top">
                        <div className="text-sm space-y-1.5">
                          {selectedMetrics.map(metricKey => {
                            const metric = AVAILABLE_METRICS.find(m => m.key === metricKey);
                            if (!metric) return null;

                            const value = data[metricKey] as number;
                            const formattedValue = formatValue(value, metric.format);

                            return (
                              <div key={metricKey} className="flex justify-between gap-2">
                                <span className="text-[#6B6B6B]">{metric.label}:</span>
                                <span className="font-semibold text-[#111111]">{formattedValue}</span>
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
      )}

      {/* AI 關鍵字分析面板 */}
      {tableData.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-[#FFC5C5] p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2 text-[#A40000]">
              <BarChart3 className="w-6 h-6 text-[#FF3B30]" />
              AI 關鍵字分析
            </h3>
            <p className="text-sm mt-1 text-[#6B6B6B]">
              使用 AI 分析關鍵字效能，獲取優化建議與內容策略
            </p>
          </div>

          <KeywordAnalysisPanel
            keywordGroups={keywordGroups}
            dateColumns={dateColumns}
            analyticsData={(() => {
              // 將 tableData 轉換為 analyticsData 格式
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
