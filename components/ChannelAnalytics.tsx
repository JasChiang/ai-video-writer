import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Upload, RefreshCw, Calendar, TrendingUp, ChevronDown, ChevronUp, BarChart3, Eye, ThumbsUp, MessageCircle, Share2, Users } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import {
  getRelativeDateRange,
  parseAbsoluteDateRange,
  getDateRangeLabel,
  type RelativeDateType,
  type DateRange
} from '../utils/dateRangeUtils';

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

export function ChannelAnalytics() {
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

  // UI 控制
  const [showConfigPanel, setShowConfigPanel] = useState(true);

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

  // 計算摘要統計
  const calculateSummary = () => {
    if (tableData.length === 0 || dateColumns.length === 0) {
      return null;
    }

    const summary = {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalVideos: 0,
      totalSubscribersGained: 0,
    };

    // 使用第一個日期範圍的數據計算總和
    const firstDateLabel = dateColumns[0]?.label;
    if (!firstDateLabel) return null;

    tableData.forEach(row => {
      const data = row.dateRanges[firstDateLabel];
      if (data && !data.error) {
        summary.totalViews += data.views || 0;
        summary.totalLikes += data.likes || 0;
        summary.totalComments += data.comments || 0;
        summary.totalShares += data.shares || 0;
        summary.totalVideos += data.videoCount || 0;
        summary.totalSubscribersGained += data.subscribersGained || 0;
      }
    });

    return summary;
  };

  const summary = calculateSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 頂部標題欄 */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">YouTube 頻道儀表板</h1>
                <p className="text-gray-600 mt-1">
                  根據關鍵字分析影片表現，比較不同時間段的數據趨勢
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-all"
              >
                {showConfigPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showConfigPanel ? '隱藏配置' : '顯示配置'}
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                清除快取
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">{/* 摘要卡片區域 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">總觀看次數</p>
                  <p className="text-3xl font-bold mt-2">{summary.totalViews.toLocaleString()}</p>
                </div>
                <Eye className="w-12 h-12 text-blue-200 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">總讚數</p>
                  <p className="text-3xl font-bold mt-2">{summary.totalLikes.toLocaleString()}</p>
                </div>
                <ThumbsUp className="w-12 h-12 text-green-200 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">總評論數</p>
                  <p className="text-3xl font-bold mt-2">{summary.totalComments.toLocaleString()}</p>
                </div>
                <MessageCircle className="w-12 h-12 text-purple-200 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">新增訂閱者</p>
                  <p className="text-3xl font-bold mt-2">{summary.totalSubscribersGained.toLocaleString()}</p>
                </div>
                <Users className="w-12 h-12 text-orange-200 opacity-80" />
              </div>
            </div>
          </div>
        )}

        {/* 配置面板 */}
        {showConfigPanel && (
          <div className="space-y-4 animate-fadeIn">
            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                💡 系統會獲取頻道<strong>所有影片</strong>（公開、未列出、私人），再根據<strong>關鍵字</strong>過濾，並統計您選擇的<strong>時間段內</strong>的數據
              </p>
            </div>

            {/* 模板管理區域 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">模板管理</h3>
                </div>
                <button
                  onClick={() => setShowTemplateDialog(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 text-sm font-medium shadow-sm transition-all"
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
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate === template.name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => loadTemplate(template.name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{template.name}</div>
                          <div className="text-sm text-gray-600 mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              {template.keywordGroups.length} 個關鍵字組合
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              {template.dateColumns.length} 個時間範圍
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.name);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {templates.length === 0 && (
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">尚無保存的模板</p>
                </div>
              )}
            </div>

            {/* 關鍵字組合設定 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">關鍵字組合</h3>
                  <span className="text-sm text-gray-500">(分析對象)</span>
                </div>
                <button
                  onClick={addKeywordGroup}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 flex items-center gap-2 text-sm font-medium shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  添加組合
                </button>
              </div>

              {keywordGroups.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">點擊「添加組合」開始設定關鍵字</p>
                </div>
              )}

              <div className="space-y-3">
                {keywordGroups.map(group => (
                  <div key={group.id} className="flex gap-3 items-center group">
                    <input
                      type="text"
                      placeholder="組合名稱（同時作為搜尋關鍵字）"
                      value={group.name}
                      onChange={(e) => updateKeywordGroupName(group.id, e.target.value)}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      onClick={() => removeKeywordGroup(group.id)}
                      className="text-red-600 hover:text-white hover:bg-red-600 p-3 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 日期範圍設定 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">時間範圍</h3>
                  <span className="text-sm text-gray-500">(比較對象)</span>
                </div>
                <button
                  onClick={addDateColumn}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 flex items-center gap-2 text-sm font-medium shadow-sm transition-all"
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
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
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
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      onClick={() => removeDateColumn(column.id)}
                      className="text-red-600 hover:text-white hover:bg-red-600 p-3 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 數據指標選擇 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">選擇數據指標</h3>
                </div>
                <p className="text-sm text-gray-600">
                  至少選擇一個指標（點擊切換選擇）
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {AVAILABLE_METRICS.map(metric => (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium shadow-sm hover:shadow-md ${
                      selectedMetrics.includes(metric.key)
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300 text-gray-700 bg-white'
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 獲取數據按鈕 */}
            <div className="flex justify-center pt-2">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center gap-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    載入數據中...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-6 h-6" />
                    獲取數據
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 錯誤訊息 */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-5 text-red-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xl font-bold">!</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">發生錯誤</h4>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 數據表格 */}
        {tableData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                詳細數據分析
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">關鍵字組合</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-900">影片數</th>
                    {dateColumns.map(column => (
                      <th key={column.id} className="px-6 py-4 text-center font-semibold text-gray-900 bg-blue-50">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{row.name}</div>
                        {row.keyword && (
                          <div className="text-sm text-gray-500 mt-1">關鍵字: {row.keyword}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium text-sm">
                          {row.videoCount}
                        </span>
                      </td>
                      {dateColumns.map(column => {
                        const data = row.dateRanges[column.label];
                        if (!data) {
                          return (
                            <td key={column.id} className="px-6 py-4 text-center text-gray-400">
                              <span className="text-2xl">-</span>
                            </td>
                          );
                        }

                        if (data.error) {
                          return (
                            <td key={column.id} className="px-6 py-4 text-center">
                              <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                                錯誤
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={column.id} className="px-6 py-4 bg-blue-50/50">
                            <div className="text-sm space-y-2">
                              {selectedMetrics.map(metricKey => {
                                const metric = AVAILABLE_METRICS.find(m => m.key === metricKey);
                                if (!metric) return null;

                                const value = data[metricKey] as number;
                                const formattedValue = formatValue(value, metric.format);

                                return (
                                  <div key={metricKey} className="flex justify-between items-center bg-white rounded px-3 py-2 shadow-sm">
                                    <span className="text-gray-600 font-medium">{metric.label}:</span>
                                    <span className="font-bold text-gray-900">{formattedValue}</span>
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
          </div>
        )}
      </div>

      {/* 保存模板對話框 */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Save className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">保存為模板</h3>
            </div>
            <input
              type="text"
              placeholder="輸入模板名稱..."
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6 transition-all"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTemplateDialog(false);
                  setNewTemplateName('');
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={saveTemplate}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-medium shadow-lg transition-all"
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
