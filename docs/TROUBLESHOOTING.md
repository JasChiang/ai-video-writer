# 問題排除

## 影片快取更新失敗（404）

- 檢查 workflow 使用的分支是否包含 `/api/video-cache/generate`。
- 確保 API server 有啟動且路由存在。

## YouTube API 401/403

- Refresh Token 過期或無效。
- OAuth Client 設定錯誤。
- Analytics API 未啟用。

## 找不到 Gist 或快取載入失敗

- 確認 `GITHUB_GIST_ID` 與 `GITHUB_GIST_TOKEN`。
- 檢查 Gist 是否為私有且 token 是否有 `gist` 權限。

## FFmpeg / yt-dlp 找不到

- 本機未安裝：請安裝 ffmpeg 與 yt-dlp。
- Docker：重新 build image。

## 分析結果空白

- 檢查是否有足夠影片與 Analytics 資料。
- 檢查 API 配額與權限。

