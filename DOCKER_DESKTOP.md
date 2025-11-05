# Docker Desktop 使用指南

> 本指南示範如何在 macOS 或 Windows 的 Docker Desktop 上啟動 AI Video Writer。

---

## 📋 目錄

- [準備環境](#1-準備環境)
- [使用指令啟動（推薦）](#2-使用指令啟動推薦)
- [介面操作（GUI）](#3-介面操作如果你偏好-gui)
- [清理資源](#4-清理暫存資源)
- [疑難排解](#5-疑難排解)
- [安全性注意事項](#6-安全性注意事項)

---

## 1. 準備環境

### 1.1 安裝 Docker Desktop

1. 前往 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 下載
2. 安裝並啟動 Docker Desktop
3. 確認 Docker 正在運行（系統托盤有 Docker 圖示）

### 1.2 設定環境變數

在專案根目錄建立 `.env.local`：

```bash
# 方法 1：複製範例檔案（推薦）
cp .env.example .env.local

# 方法 2：手動建立
# Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

**必填變數**：

```bash
# Gemini AI API 金鑰（必需）
GEMINI_API_KEY=你的_gemini_api_key

# YouTube OAuth 2.0 Client ID（必需）
YOUTUBE_CLIENT_ID=你的_client_id.apps.googleusercontent.com

# 前端網址（可選，預設 http://localhost:3000）
FRONTEND_URL=http://localhost:3000

# 檔案保留天數（可選，預設 7 天）
FILE_RETENTION_DAYS=7
```

**取得 API Keys**：
- **GEMINI_API_KEY**：[Google AI Studio](https://makersuite.google.com/app/apikey)
- **YOUTUBE_CLIENT_ID**：[Google Cloud Console](https://console.cloud.google.com/apis/credentials)

詳細說明請參考 `.env.example`。

---

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

### 常見問題

| 問題 | 原因 | 解決方法 |
|-----|------|---------|
| `YouTube Client ID is not configured` | 環境變數未載入 | 確認 `.env.local` 存在且內容正確 |
| `GEMINI_API_KEY is not set` | API Key 未設定 | 在 `.env.local` 中設定有效的 API Key |
| `ffmpeg: command not found` | ffmpeg 未安裝 | 重新建置 image：`docker compose build --no-cache` |
| `Container unhealthy` | 服務未正常啟動 | 查看日誌：`docker compose logs -f` |
| `Port 3001 already in use` | 埠號被佔用 | 修改 `docker-compose.yml` 中的 port 或關閉佔用的程式 |
| `Cannot connect to Docker daemon` | Docker Desktop 未啟動 | 啟動 Docker Desktop |

### 除錯步驟

```bash
# 1. 查看容器狀態
docker compose ps

# 2. 查看詳細日誌
docker compose logs -f ai-video-writer

# 3. 進入容器檢查
docker compose exec ai-video-writer /bin/bash

# 4. 檢查環境變數（在容器內）
echo $GEMINI_API_KEY
echo $YOUTUBE_CLIENT_ID

# 5. 測試 ffmpeg 和 yt-dlp（在容器內）
ffmpeg -version
yt-dlp --version

# 6. 重新建置（如果問題持續）
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 6. 安全性注意事項

### ⚠️ 重要提醒

1. **不要將 `.env.local` 提交到 Git**
   - 已加入 `.gitignore`
   - 包含敏感的 API Keys

2. **定期更換 API Keys**
   - 建議每 3-6 個月更換一次
   - 如果懷疑洩漏，立即更換

3. **限制 API Key 使用**
   - 在 Google Cloud Console 設定使用限制
   - 限制 IP 位址或 HTTP referrer
   - 僅允許特定 API

4. **監控 API 使用量**
   - 定期檢查 [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)
   - 設定配額警示

5. **生產環境部署**
   - 不要使用 `.env.local`
   - 使用平台環境變數
   - 啟用 HTTPS
   - 設定 CORS 為實際網址

### 📚 相關文件

- **[SECURITY.md](SECURITY.md)** - 完整的安全政策
- **[docker/README.md](docker/README.md)** - 命令列部署指南
- **[.env.example](.env.example)** - 環境變數範例
- **[README.md](README.md)** - 專案完整說明

---

## 🎯 建議開發流程

```bash
# 1. 開發階段
./docker-start.sh  # 啟動容器
# 修改程式碼...
docker compose restart  # 重新啟動

# 2. 測試階段
docker compose build  # 重新建置
docker compose up -d  # 啟動測試

# 3. 提交前檢查
docker compose logs -f  # 確認無錯誤
# 執行測試...
docker compose down  # 清理

# 4. 建立 PR
# 確保容器化流程正常運作
```

---

<div align="center">

**🐳 Happy Dockerizing!**

需要協助？請參考 [疑難排解](#5-疑難排解) 或查看 [README.md](README.md)

</div>
