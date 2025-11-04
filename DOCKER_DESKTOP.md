# Docker Desktop 使用指南

這份指南示範如何在 macOS 或 Windows 的 Docker Desktop 上啟動 AI Video Writer。

## 1. 準備環境

1. 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 並啟動。
2. 在專案根目錄建立 `.env.local`，至少填入：

```bash
GEMINI_API_KEY=你的_gemini_api_key
YOUTUBE_CLIENT_ID=你的_client_id.apps.googleusercontent.com
```

> App 只需要 OAuth 用的 `YOUTUBE_CLIENT_ID`，不需要在前端暴露 API Key。

## 2. 使用指令啟動（推薦）

```bash
# 1. 確認 .env.local 準備完成
./docker-start.sh
```

腳本會幫你：

- 檢查必要的環境變數
- 建立 `temp_videos/` 與 `public/images/` 持久化資料夾
- 執行 `docker compose up -d`

常用操作：

```bash
docker compose logs -f    # 查看容器日誌
docker compose restart    # 重新啟動
docker compose down       # 停止並移除容器
```

## 3. 介面操作（如果你偏好 GUI）

1. 打開 Docker Desktop → Containers → `Create`.
2. build image：選擇專案資料夾，Dockerfile 路徑填 `docker/Dockerfile`。
3. 建立容器：
   - Port: `3001:3001`
   - Env: 填入 `GEMINI_API_KEY`、`YOUTUBE_CLIENT_ID`
   - Volumes: `./temp_videos:/app/temp_videos`, `./public/images:/app/public/images`
4. Start 容器後瀏覽 `http://localhost:3001`。

## 4. 清理暫存資源

```bash
docker compose down --volumes   # 停止並移除資料卷
docker rmi ai-video-writer      # 移除映像檔（如需）
```

## 5. 疑難排解

- `YouTube Client ID is not configured.`：確認 `.env.local` 被 `docker-start.sh` 讀到，或手動把環境變數傳入 `docker compose`.
- `ffmpeg` 找不到：Dockerfile 會安裝官方套件，如果你修改 Dockerfile 請保留該段指令。
- 映像檔過期：重新執行 `docker compose build --no-cache`。

> 建議在建立 PR 前執行 `docker compose build` 與 `docker compose up`，確保容器化流程一起運作。
