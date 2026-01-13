# API 端點總覽

本文件列出後端 `server.js` 主要 API 端點，方便開發與整合。

## 系統與任務

- `GET /api/quota/server`：取得配額快照
- `POST /api/quota/server/reset`：重置配額快照
- `GET /api/task/:taskId`：查詢任務
- `DELETE /api/task/:taskId`：取消任務

## 模板管理

- `POST /api/templates/enable`
- `POST /api/templates/disable`
- `POST /api/templates/refresh`
- `GET /api/templates/status`
- `GET /api/templates`

## Notion

- `GET /api/notion/oauth/url`
- `GET /api/notion/callback`
- `POST /api/notion/oauth/callback`
- `POST /api/notion/publish`
- `POST /api/notion/databases`
- `POST /api/notion/database-info`

## 影片處理與分析

- `POST /api/download-video`
- `POST /api/analyze-video-url`
- `POST /api/analyze-video-url-async`
- `POST /api/analyze-video`
- `POST /api/reanalyze-with-existing-file`
- `POST /api/capture-screenshots`
- `POST /api/regenerate-screenshots`

## Gemini 檔案

- `POST /api/gemini/upload-file`
- `DELETE /api/gemini/file/:name`

## 文章生成

- `POST /api/generate-article-url`
- `POST /api/generate-article-url-async`
- `POST /api/generate-article-from-url-async`
- `POST /api/generate-article`
- `POST /api/regenerate-article`

## AI 模型與分析

- `GET /api/ai-models/available`
- `GET /api/ai-models/:modelId/status`
- `GET /api/ai-models/recommend`
- `POST /api/analyze-channel`
- `POST /api/analyze-channel/stream`
- `POST /api/analyze-channel/multi-model`
- `POST /api/analyze-keywords`
- `POST /api/analyze-keywords/stream`

## 頻道分析與報表

- `POST /api/channel-analytics/aggregate`
- `POST /api/channel-analytics/clear-cache`
- `POST /api/channel-analytics/duration-analysis`
- `POST /api/analytics/channel`
- `POST /api/analytics/keyword-analysis`
- `POST /api/analytics/search-terms`
- `POST /api/analytics/external-traffic`

## 影片快取

- `POST /api/video-cache/generate`
- `GET /api/video-cache/search`
