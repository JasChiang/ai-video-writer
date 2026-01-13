# 維運與排程

## 影片快取更新

- 手動更新：`npm run update-cache`
- 依賴環境變數：`GITHUB_GIST_*`, `YOUTUBE_*`

## GitHub Actions（自動更新）

流程定義於 `.github/workflows/update-video-cache.yml`：

- 檢出指定分支
- 啟動 API server
- 呼叫 `/api/video-cache/generate`
- 上傳快取更新資訊

需設定 Secrets（對應 `.env.local`）：

- `VIDEO_CACHE_GIST_TOKEN`
- `VIDEO_CACHE_GIST_ID`
- `VIDEO_CACHE_GIST_FILENAME`
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_CHANNEL_ID`

## 配額監控

- `GET /api/quota/server`：查看配額快照
- 影片搜尋優先使用快取（Gist），降低 YouTube API 配額消耗

## 非同步任務

- 任務狀態：`GET /api/task/:taskId`
- 取消任務：`DELETE /api/task/:taskId`

