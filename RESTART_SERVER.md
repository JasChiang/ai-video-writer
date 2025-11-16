# 🔄 Server 重啟指南

## 問題
前端訪問新的 API 端點時出現 404 錯誤：
- `/api/ai-models/available`
- `/api/channel-analytics/aggregate`

## 原因
這些是新增的 API 端點，但本地開發 server (localhost:3001) 還在運行舊版本的程式碼。

## 解決方案

### 步驟 1: 停止舊的 Server
在您的終端中按 `Ctrl+C` 停止正在運行的 server

### 步驟 2: 重新啟動 Server
```bash
npm run server
```

或者如果需要同時啟動前端和後端：
```bash
npm run dev:all
```

### 步驟 3: 確認 Server 啟動成功
您應該看到以下訊息：
```
✅ Gemini API Key loaded successfully
✅ AI Model Manager initialized
Server running on http://localhost:3001
```

### 步驟 4: 重新載入前端頁面
在瀏覽器中重新整理頁面 (F5 或 Cmd+R)

## 新增的功能

本次合併新增了以下主要功能：

### 1. AI 多模型支持
- **AIModelManager**: 統一管理 Gemini 和 OpenRouter 模型
- **模型選擇器**: 前端可選擇不同 AI 模型進行分析
- 支援的模型：
  - Gemini 2.5 Flash / Pro
  - Claude Sonnet 4.5
  - GPT-4.5 Turbo
  - DeepSeek V3

### 2. 頻道分析功能
- **ChannelAnalytics**: 頻道數據視覺化
- **ChannelDashboard**: 完整的頻道儀表板
- 支援多種分析類型：
  - 綜合分析
  - 訂閱者成長分析
  - 內容策略分析
  - 觀眾參與度分析

### 3. 關鍵字分析
- **KeywordAnalysisPanel**: 關鍵字報表分析
- 支援自定義關鍵字組合
- 多時間範圍比較
- AI 智能洞察

### 4. 影片快取系統
- **videoCacheService**: GitHub Gist 快取整合
- 快速搜尋大量影片
- 降低 YouTube API 配額消耗

### 5. 任務佇列
- **taskQueue**: 處理長時間運行的任務
- 支援異步任務輪詢
- 適合手機端使用

## API 端點清單

新增的 API 端點：
- `GET /api/ai-models/available` - 獲取可用 AI 模型
- `GET /api/ai-models/:modelId/status` - 檢查模型狀態
- `GET /api/ai-models/recommend` - 獲取推薦模型
- `POST /api/analyze-channel` - AI 頻道分析
- `POST /api/analyze-channel/multi-model` - 多模型協同分析
- `POST /api/analyze-keywords` - AI 關鍵字分析
- `POST /api/channel-analytics/aggregate` - 頻道數據聚合
- `POST /api/channel-analytics/clear-cache` - 清除快取
- `GET /api/video-cache/search` - 影片快取搜尋

## 配置需求

確保 `.env.local` 包含以下配置：

```env
# 必需
GEMINI_API_KEY=your_gemini_api_key

# 選用（用於 OpenRouter 模型）
OPENROUTER_API_KEY=your_openrouter_api_key

# 選用（用於影片快取）
GITHUB_GIST_ID=your_gist_id
GITHUB_GIST_TOKEN=your_gist_token
```

## 疑難排解

### Server 啟動失敗
```bash
# 檢查語法錯誤
node --check server.js

# 檢查依賴安裝
npm install
```

### API 仍然 404
1. 確認 server 已重啟
2. 檢查 console 是否有錯誤訊息
3. 確認訪問的 URL 是 `http://localhost:3001/api/...`

### 前端無法連接
1. 確認前端 `VITE_API_URL` 配置正確
2. 確認 CORS 沒有問題
3. 檢查瀏覽器 Network 標籤的請求詳情
