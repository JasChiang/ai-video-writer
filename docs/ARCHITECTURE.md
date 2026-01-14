# 架構與模組

## 架構概覽

- 前端：React + Vite
- 後端：Node.js + Express
- 影片處理：yt-dlp、FFmpeg
- AI 模型：Gemini / OpenRouter
- 資料來源：YouTube Data API、YouTube Analytics API
- 內容發佈：Notion API

## 專案結構

```
components/        # 前端 UI 組件
services/client/   # 前端服務（API/SDK 包裝）
services/server/   # 後端服務與 AI 模型整合
scripts/           # 影片快取/維運腳本
server.js          # 主要 API 伺服器
```

## 主要資料流程

### 1. 文章生成

1. 取得 YouTube 影片資訊（含音訊/字幕/Metadata）。
2. 呼叫 AI 模型生成文章與結構化內容。
3. 使用 FFmpeg 進行截圖。
4. 可選擇發佈至 Notion。

### 2. 頻道分析

1. 讀取頻道影片清單（優先使用 Gist 快取）。
2. 呼叫 YouTube Analytics API 取得數據。
3. AI 模型生成分析報告（可串流）。

### 3. 影片表現分析

1. 取得影片樣本與數據。
2. 透過 AI 模型產出優化與策略建議。

### 4. 影片快取

1. `scripts/update-video-cache.js` 取得影片清單。
2. 更新到 GitHub Gist。
3. 前端與後端分析優先使用快取。

## 重要服務模組

- `services/server/aiProviders/*`：多模型 AI 供應者管理。
- `services/server/analysisPrompts/*`：分析提示詞模板。
- `services/server/channelAnalyticsService.js`：頻道數據聚合。
- `services/server/durationAnalysisService.js`：影片長度分析。
- `services/server/videoCacheService.js`：影片快取存取。
- `services/server/taskQueue.js`：非同步任務與輪詢。
- `services/server/notionService.js`：Notion 發佈。
