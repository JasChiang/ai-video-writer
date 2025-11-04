# Docker 部署指南

這個專案可以透過 Docker 輕鬆部署，包含所有必要的依賴（yt-dlp、FFmpeg）。

## 📖 使用指南選擇

- **使用 Docker Desktop GUI？** → 請參考專案根目錄的 `DOCKER_DESKTOP.md`
- **使用命令列？** → 繼續閱讀本文件

## 快速開始

### 方法 1: 使用 Docker Compose（推薦）

1. **設定環境變數**

   選項 A：建立 `.env.local` 檔案（可選）
   ```bash
   cp .env.example .env.local
   # 編輯 .env.local 填入你的 API keys
   ```

   選項 B：直接在終端機設定（不需要 .env.local）
   ```bash
   export GEMINI_API_KEY="你的_API_金鑰"
   export YOUTUBE_CLIENT_ID="你的_Client_ID"
   ```

2. **啟動服務**
   ```bash
   docker-compose up -d
   ```

3. **查看日誌**
   ```bash
   docker-compose logs -f
   ```

4. **停止服務**
   ```bash
   docker-compose down
   ```

### 方法 2: 手動使用 Docker

1. **建置映像檔**
   ```bash
   docker build -f docker/Dockerfile -t ai-video-writer .
   ```

2. **執行容器**
   ```bash
   docker run -d \
     --name ai-video-writer \
     -p 3001:3001 \
     -e GEMINI_API_KEY="your_api_key" \
     -e YOUTUBE_CLIENT_ID="your_client_id" \
     -v $(pwd)/temp_videos:/app/temp_videos \
     -v $(pwd)/public/images:/app/public/images \
     ai-video-writer
   ```

## 環境變數

必需的環境變數：
- `GEMINI_API_KEY` - Google Gemini AI API 金鑰
- `YOUTUBE_CLIENT_ID` - YouTube OAuth 2.0 用戶端 ID

可選的環境變數：
- `PORT` - 伺服器埠號（預設：3001）
- `NODE_ENV` - Node.js 環境（預設：production）

## Volume 說明

為了資料持久化，建議掛載以下目錄：
- `./temp_videos` - 暫存下載的影片檔案
- `./public/images` - 生成的截圖

## 健康檢查

容器包含健康檢查機制，會定期檢查伺服器是否正常運作：
```bash
docker-compose ps  # 查看容器健康狀態
```

## 故障排除

### 查看容器日誌
```bash
docker-compose logs -f ai-video-writer
```

### 進入容器 shell
```bash
docker-compose exec ai-video-writer /bin/bash
```

### 檢查 yt-dlp 版本
```bash
docker-compose exec ai-video-writer yt-dlp --version
```

### 檢查 FFmpeg 版本
```bash
docker-compose exec ai-video-writer ffmpeg -version
```

### 重新建置映像檔
```bash
docker-compose build --no-cache
docker-compose up -d
```

## 生產環境注意事項

1. **環境變數安全性**
   - 不要將 `.env.local` 提交到 Git
   - 在生產環境使用 Docker secrets 或其他安全方式管理敏感資料

2. **資源限制**
   可以在 `docker-compose.yml` 中設定資源限制：
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

3. **反向代理**
   建議在生產環境使用 Nginx 或 Traefik 作為反向代理

4. **備份**
   定期備份 `temp_videos` 和 `public/images` 目錄
