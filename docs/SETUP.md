# 環境設定與啟動

本文件以 `.env.example` 為基準，說明必要的 API 申請與本機/容器啟動流程。

## 必要條件

- Node.js 18+（本機開發）
- yt-dlp、FFmpeg（本機開發）
- Docker / Docker Compose（容器部署）
- Google Cloud 專案（YouTube Data API / Analytics API）

## 取得與設定 API

### 1. YouTube Data API / Analytics API

- 開啟 `YouTube Data API v3` 與 `YouTube Analytics API`。
- 建立 OAuth Client（Web App）。
- 取得 `YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`。
- 使用 Refresh Token（推薦）取得長期授權：
  - 填入 `YOUTUBE_REFRESH_TOKEN`。

### 2. Gemini / OpenRouter

- `GEMINI_API_KEY`：Google Gemini API Key。
- `OPENROUTER_API_KEY`（選用）：若要使用 OpenRouter 模型。

### 3. GitHub Gist（影片快取）

- 建立具有 `gist` 權限的 GitHub PAT。
- 設定：
  - `GITHUB_GIST_TOKEN`
  - `GITHUB_GIST_ID`（首次更新快取後產生）
  - `GITHUB_GIST_FILENAME`

### 4. Notion（選用）

- Integration Token：
  - `NOTION_API_TOKEN`
  - `NOTION_DATABASE_ID`
  - `NOTION_TITLE_PROPERTY`
- OAuth（多使用者）：
  - `NOTION_CLIENT_ID`
  - `NOTION_CLIENT_SECRET`
  - `NOTION_REDIRECT_URI`

## 本機啟動

```bash
npm install
cp .env.example .env.local
npm run dev     # 前端
npm run server  # 後端
```

## Docker 啟動

```bash
cp .env.example .env.local
./docker-start.sh
```

## 影片快取初始化

```bash
npm run update-cache
```

成功後會取得 `GITHUB_GIST_ID`，請回填到 `.env.local`。

## 暫存檔案清理策略

- 啟動後端時會自動清理 `temp_videos`、`temp_uploads`、`temp_files`、`public/images` 中超過 7 天的檔案（可用 `FILE_RETENTION_DAYS` 覆寫）。
- 若需要立刻清空暫存資料，可手動執行：`npm run dev:clean`。

## 重要環境變數摘要

- YouTube：`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID`
- Gemini：`GEMINI_API_KEY`
- OpenRouter（選用）：`OPENROUTER_API_KEY`
- Gist：`GITHUB_GIST_TOKEN`, `GITHUB_GIST_ID`, `GITHUB_GIST_FILENAME`
- Notion（選用）：`NOTION_API_TOKEN`, `NOTION_DATABASE_ID`, `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`
- 自訂模板（選用）：`CUSTOM_TEMPLATE_URL`, `CUSTOM_TEMPLATE_TOKEN`
- 前端/伺服器：`FRONTEND_URL`, `VITE_API_URL`, `VITE_SERVER_BASE_URL`
