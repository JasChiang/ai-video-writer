# 前端組件整合指南

本指南說明如何將 AI 分析組件整合到現有的 Dashboard 中。

---

## 📦 安裝依賴

首先安裝必要的依賴：

```bash
npm install react-markdown
```

---

## 🎨 已創建的組件

### 1. **AnalysisTypeSelector**
分析類型選擇器，支援 5 種專業分析類型。

**路徑：** `components/AnalysisTypeSelector.tsx`

**使用範例：**
```tsx
import { AnalysisTypeSelector, type AnalysisType } from './AnalysisTypeSelector';

const [analysisType, setAnalysisType] = useState<AnalysisType>('comprehensive');

<AnalysisTypeSelector
  selectedType={analysisType}
  onTypeSelect={setAnalysisType}
  disabled={false}
/>
```

### 2. **AIModelSelector**
AI 模型選擇器，支援卡片視圖和表格對比視圖。

**路徑：** `components/AIModelSelector.tsx`

**使用範例：**
```tsx
import { AIModelSelector, type AIModel } from './AIModelSelector';

const [models, setModels] = useState<AIModel[]>([]);
const [selectedModel, setSelectedModel] = useState<string | null>(null);

// 載入模型列表
useEffect(() => {
  fetch('/api/ai-models/available')
    .then(res => res.json())
    .then(data => setModels(data.models));
}, []);

// 卡片視圖
<AIModelSelector
  models={models}
  selectedModel={selectedModel}
  onModelSelect={setSelectedModel}
  disabled={false}
  showComparison={false}
/>

// 表格對比視圖
<AIModelSelector
  models={models}
  selectedModel={selectedModel}
  onModelSelect={setSelectedModel}
  disabled={false}
  showComparison={true}
/>
```

### 3. **ChannelAnalysisPanel**
完整的頻道分析面板，整合了上述兩個組件。

**路徑：** `components/ChannelAnalysisPanel.tsx`

**使用範例：**
```tsx
import { ChannelAnalysisPanel } from './ChannelAnalysisPanel';

<ChannelAnalysisPanel
  channelId={channelId}
  dateRange={{ startDate: '2025-01-01', endDate: '2025-01-15' }}
  videos={videos}
  channelStats={{
    totalViews: 1000000,
    subscriberCount: 50000,
    totalVideos: 150,
  }}
  analytics={{
    subscribersGained: 1000,
    subscribersLost: 50,
    avgViewDuration: 180,
    avgViewPercentage: 45.5,
    trafficSources: [...],
    demographics: [...],
  }}
/>
```

---

## 🔧 整合到現有 Dashboard

### 選項 1：整合到 ChannelDashboard（推薦）

如果你使用的是 `feature/dashboard` 分支的 `ChannelDashboard.tsx`：

**步驟：**

1. **在 ChannelDashboard.tsx 中導入組件**

```tsx
import { ChannelAnalysisPanel } from './ChannelAnalysisPanel';
```

2. **添加一個新的 Tab 或 Section**

```tsx
// 在現有的 Dashboard UI 中添加一個新的分析區域
<div className="mt-8">
  <h2 className="text-2xl font-bold mb-4" style={{ color: '#03045E' }}>
    🤖 AI 深度分析
  </h2>

  <ChannelAnalysisPanel
    channelId={channelId}
    dateRange={dateRange}
    videos={topVideos}
    channelStats={{
      totalViews: channelStats.totalViews,
      subscriberCount: channelStats.totalSubscribers,
      totalVideos: channelStats.totalVideos,
    }}
    analytics={{
      subscribersGained: channelStats.subscribersGained,
      subscribersLost: channelStats.subscribersLost,
      avgViewDuration: channelStats.avgViewDuration,
      avgViewPercentage: channelStats.avgViewPercentage,
      trafficSources: trafficSources,
      demographics: demographics,
      geography: geography,
      devices: devices,
    }}
  />
</div>
```

### 選項 2：創建獨立的分析頁面

創建一個新的頁面專門用於 AI 分析：

**創建 `components/ChannelAnalyticsAI.tsx`：**

```tsx
import React, { useState, useEffect } from 'react';
import { ChannelAnalysisPanel } from './ChannelAnalysisPanel';

export function ChannelAnalyticsAI() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: '2025-01-01',
    endDate: '2025-01-15',
  });
  const [videos, setVideos] = useState([]);
  const [channelStats, setChannelStats] = useState(null);

  // 載入數據的邏輯...

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#03045E' }}>
          AI 頻道分析
        </h1>
        <p style={{ color: '#0077B6' }}>
          使用 AI 深入分析您的頻道表現，獲取專業的成長建議
        </p>
      </div>

      {channelStats && (
        <ChannelAnalysisPanel
          channelId={channelId}
          dateRange={dateRange}
          videos={videos}
          channelStats={channelStats}
        />
      )}
    </div>
  );
}
```

### 選項 3：作為 Modal 彈出視窗

如果想要作為彈出視窗使用：

```tsx
import React, { useState } from 'react';
import { ChannelAnalysisPanel } from './ChannelAnalysisPanel';

export function AIAnalysisModal({ isOpen, onClose, ...props }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold" style={{ color: '#03045E' }}>
            AI 頻道分析
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <ChannelAnalysisPanel {...props} />
      </div>
    </div>
  );
}
```

---

## 🎨 UI/UX 建議

### 1. 響應式設計

組件已使用 Tailwind CSS 的響應式類：

```tsx
// 在手機上單列，平板上雙列
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  ...
</div>
```

### 2. 配色方案

組件使用了一致的配色：

```tsx
const colors = {
  primary: '#03045E',    // 深藍色（標題）
  secondary: '#0077B6',  // 藍色（副標題、描述）
  accent: '#00B4D8',     // 亮藍色（按鈕、強調）
  text: '#6B7280',       // 灰色（次要文字）
};
```

如需修改配色，可以在組件中搜尋這些顏色值進行替換。

### 3. 載入狀態

組件已內建載入狀態：

```tsx
{isAnalyzing ? (
  <>
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
    分析中...
  </>
) : (
  <>
    <Zap className="w-5 h-5" />
    開始 AI 分析
  </>
)}
```

### 4. 錯誤處理

組件已內建錯誤顯示：

```tsx
{analysisError && (
  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
    <p className="text-sm text-red-700">❌ {analysisError}</p>
  </div>
)}
```

---

## 🔌 API 調用示例

### 1. 獲取可用模型

```typescript
const response = await fetch('/api/ai-models/available');
const data = await response.json();

if (data.success) {
  console.log('Available models:', data.models);
  // data.models: AIModel[]
}
```

### 2. 獲取推薦模型

```typescript
const response = await fetch(
  `/api/ai-models/recommend?analysisType=subscriber-growth`
);
const data = await response.json();

if (data.success) {
  console.log('Recommended model:', data.recommendedModel);
  // data.recommendedModel: string (model ID)
}
```

### 3. 執行分析

```typescript
const response = await fetch('/api/analyze-channel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    channelId: 'UC...',
    videos: [...],
    channelStats: {...},
    analytics: {...},
    modelType: 'gemini-2.5-flash',
    analysisType: 'comprehensive'
  })
});

const data = await response.json();

if (data.success) {
  console.log('Analysis:', data.analysis);      // Markdown text
  console.log('Metadata:', data.metadata);      // { model, provider, usage, cost, ... }
}
```

---

## 📊 數據格式說明

### Videos 數組格式

```typescript
const videos = [
  {
    videoId: 'xxx',
    title: '影片標題',
    publishedAt: '2025-01-15T10:00:00Z',
    viewCount: 10000,
    likeCount: 500,
    commentCount: 50,
    tags: ['tag1', 'tag2'],
  },
  // ...
];
```

### Analytics 對象格式（可選）

```typescript
const analytics = {
  subscribersGained: 1000,
  subscribersLost: 50,
  avgViewDuration: 180,        // 秒
  avgViewPercentage: 45.5,     // 百分比
  trafficSources: [
    { sourceType: 'YT_SEARCH', views: 5000, percentage: 50 },
    { sourceType: 'RELATED_VIDEO', views: 3000, percentage: 30 },
    // ...
  ],
  demographics: [...],
  geography: [...],
  devices: [...],
};
```

---

## 🧪 測試建議

### 1. 單元測試組件

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalysisTypeSelector } from './AnalysisTypeSelector';

test('should select analysis type', () => {
  const handleSelect = jest.fn();

  render(
    <AnalysisTypeSelector
      selectedType="comprehensive"
      onTypeSelect={handleSelect}
    />
  );

  fireEvent.click(screen.getByText('訂閱成長分析'));
  expect(handleSelect).toHaveBeenCalledWith('subscriber-growth');
});
```

### 2. 手動測試清單

- [ ] 智能推薦模式正常工作
- [ ] 手動選擇模式正常工作
- [ ] 分析按鈕在適當時機禁用
- [ ] 分析結果正確顯示
- [ ] 錯誤訊息正確顯示
- [ ] 載入狀態正確顯示
- [ ] 響應式設計在不同屏幕尺寸下正常
- [ ] 模型對比表格正常工作

---

## 🐛 常見問題

### Q: 組件顯示「沒有可用的 AI 模型」

**解決：**
1. 確認後端伺服器已啟動
2. 檢查 `.env.local` 中的 API Keys
3. 檢查瀏覽器控制台的錯誤訊息

### Q: 點擊「開始分析」沒有反應

**檢查：**
1. `channelId` 是否為 null
2. `videos` 數組是否為空
3. 是否選擇了模型（手動模式）
4. 瀏覽器控制台是否有錯誤

### Q: 分析結果顯示為純文字，沒有格式化

**解決：**
確認已安裝 `react-markdown`：
```bash
npm install react-markdown
```

### Q: 組件樣式與其他部分不一致

**調整：**
修改組件中的內聯樣式和 Tailwind 類：
```tsx
// 修改主要顏色
style={{ color: '#03045E' }}  // 改為你的顏色

// 修改背景色
className="bg-blue-50"  // 改為你的背景色類
```

---

## 📝 自定義建議

### 1. 添加新的分析類型

在 `AnalysisTypeSelector.tsx` 中添加：

```typescript
const analysisTypes: AnalysisTypeOption[] = [
  // ... 現有類型 ...
  {
    id: 'my-custom-analysis',
    name: '自定義分析',
    description: '描述...',
    icon: MyIcon,
    estimatedTime: '30-60 秒',
    color: '#6366F1',
  },
];
```

然後在後端 `PromptTemplates.ts` 中添加對應的 Prompt 模板。

### 2. 修改推薦策略

在後端 `AIModelManager.ts` 的 `getRecommendedModel()` 中修改：

```typescript
const recommendations: Record<AnalysisType, AIModelType> = {
  'subscriber-growth': 'my-preferred-model',
  // ...
};
```

### 3. 添加自定義元數據顯示

在 `ChannelAnalysisPanel.tsx` 的結果顯示部分添加：

```tsx
{analysisResult.metadata.myCustomField && (
  <span className="px-2 py-1 bg-gray-100 rounded">
    自定義：{analysisResult.metadata.myCustomField}
  </span>
)}
```

---

## 🎯 下一步

1. ✅ 安裝依賴 (`npm install react-markdown`)
2. ✅ 選擇整合方式（Dashboard、獨立頁面或 Modal）
3. ✅ 整合組件到你的應用
4. ✅ 測試功能
5. ✅ 根據需要自定義樣式和行為

---

**祝您整合順利！** 🚀

如有問題，請查看：
- `docs/AI_MODEL_MANAGEMENT_GUIDE.md` - 模型管理指南
- `docs/AI_ANALYTICS_IMPLEMENTATION_SUMMARY.md` - 實施總結
