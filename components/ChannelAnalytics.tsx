import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Upload, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/channel-analytics/aggregate`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '獲取數據失敗');
      }

      const result = await response.json();

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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/channel-analytics/clear-cache`, {
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
    <div className="space-y-6">
      {/* 標題區域 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            頻道數據分析
          </h2>
          <p className="text-gray-600 mt-1">
            根據關鍵字搜尋影片、比較不同時間段的影片表現
          </p>
          <div className="mt-2 space-y-2">
            <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              💡 系統會獲取頻道<strong>所有影片</strong>（公開、未列出、私人），再根據<strong>關鍵字</strong>過濾，並統計您選擇的<strong>時間段內</strong>的數據
            </div>

          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearCache}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            清除快取
          </button>
        </div>
      </div>

      {/* 模板管理區域 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">模板管理</h3>
          <button
            onClick={() => setShowTemplateDialog(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
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
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedTemplate === template.name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => loadTemplate(template.name)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
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
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {templates.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            尚無保存的模板
          </p>
        )}
      </div>

      {/* 關鍵字組合設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">關鍵字組合（表格行）</h3>
          <button
            onClick={addKeywordGroup}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            添加組合
          </button>
        </div>

        {keywordGroups.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeKeywordGroup(group.id)}
                className="text-red-600 hover:text-red-700 p-2"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 日期範圍設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            時間範圍（表格列）
          </h3>
          <button
            onClick={addDateColumn}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeDateColumn(column.id)}
                className="text-red-600 hover:text-red-700 p-2"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 數據指標選擇 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="mb-4">
          <h3 className="font-semibold">選擇要顯示的數據指標</h3>
          <p className="text-sm text-gray-600 mt-1">
            至少選擇一個指標（點擊切換選擇）
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {AVAILABLE_METRICS.map(metric => (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                selectedMetrics.includes(metric.key)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
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
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-semibold"
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">名稱</th>
                <th className="px-4 py-3 text-left font-semibold">影片數</th>
                {dateColumns.map(column => (
                  <th key={column.id} className="px-4 py-3 text-center font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name}</div>
                    {row.keyword && (
                      <div className="text-sm text-gray-500">關鍵字: {row.keyword}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{row.videoCount}</td>
                  {dateColumns.map(column => {
                    const data = row.dateRanges[column.label];
                    if (!data) {
                      return (
                        <td key={column.id} className="px-4 py-3 text-center text-gray-400">
                          -
                        </td>
                      );
                    }

                    if (data.error) {
                      return (
                        <td key={column.id} className="px-4 py-3 text-center">
                          <div className="text-red-600 text-sm">錯誤</div>
                        </td>
                      );
                    }

                    return (
                      <td key={column.id} className="px-4 py-3">
                        <div className="text-sm space-y-1">
                          {selectedMetrics.map(metricKey => {
                            const metric = AVAILABLE_METRICS.find(m => m.key === metricKey);
                            if (!metric) return null;

                            const value = data[metricKey] as number;
                            const formattedValue = formatValue(value, metric.format);

                            return (
                              <div key={metricKey} className="flex justify-between">
                                <span className="text-gray-600">{metric.label}:</span>
                                <span className="font-medium">{formattedValue}</span>
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

      {/* 保存模板對話框 */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">保存為模板</h3>
            <input
              type="text"
              placeholder="模板名稱"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTemplateDialog(false);
                  setNewTemplateName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
