# Docker 部署指南

> 本專案可透過 Docker 輕鬆部署，包含所有必要的依賴（Node.js、yt-dlp、FFmpeg）。

## 📖 使用指南選擇

- **🖱️ 使用 Docker Desktop GUI？** → 請參考專案根目錄的 `DOCKER_DESKTOP.md`
- **⌨️ 使用命令列？** → 繼續閱讀本文件
- **🔒 資安考量？** → 請先閱讀 `SECURITY.md`

---

## 🚀 快速開始

### 方法 1: 使用啟動腳本（最簡單）

```bash
# 1. 建立 .env.local
cp .env.example .env.local

# 2. 編輯 .env.local，填入你的 API keys
# (至少需要 GEMINI_API_KEY 和 YOUTUBE_CLIENT_ID)

# 3. 執行啟動腳本
./docker-start.sh
```

腳本會自動：
- ✅ 檢查環境變數
- ✅ 建立必要的目錄
- ✅ 啟動 Docker Compose
- ✅ 顯示常用指令

### 方法 2: 使用 Docker Compose（推薦）

1. **設定環境變數**

   **選項 A：使用 .env.local 檔案（推薦）**
   ```bash
   cp .env.example .env.local
   # 編輯 .env.local 填入你的 API keys
   ```

   **選項 B：直接在終端機設定**
   ```bash
   export GEMINI_API_KEY="你的_API_金鑰"
   export YOUTUBE_CLIENT_ID="你的_Client_ID"
   export FRONTEND_URL="http://localhost:3000"  # 可選
   ```

2. **啟動服務**
   ```bash
   docker compose up -d
   ```

3. **查看狀態**
   ```bash
   docker compose ps
   ```

4. **查看日誌**
   ```bash
   docker compose logs -f
   ```

5. **停止服務**
   ```bash
   docker compose down
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

---

## 📋 環境變數說明

### 必填變數

| 變數 | 說明 | 取得方式 |
|-----|------|---------|
| `GEMINI_API_KEY` | Gemini AI API 金鑰 | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth 2.0 Client ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |

### 可選變數

| 變數 | 預設值 | 說明 |
|-----|--------|------|
| `PORT` | `3001` | 後端伺服器埠號 |
| `FRONTEND_URL` | `http://localhost:3000` | 前端網址（用於 CORS） |
| `FILE_RETENTION_DAYS` | `7` | 檔案保留天數 |
| `NODE_ENV` | `production` | Node.js 環境 |

### Notion 整合（可選）

| 變數 | 說明 |
|-----|------|
| `NOTION_API_TOKEN` | Notion Internal Integration Token |
| `NOTION_DATABASE_ID` | 預設資料庫 ID |
| `NOTION_CLIENT_ID` | Notion Public Integration Client ID |
| `NOTION_CLIENT_SECRET` | Notion Public Integration Secret |

詳細說明請參考 `.env.example`。

---

## 💾 Volume 說明

為了資料持久化，建議掛載以下目錄：

| 目錄 | 用途 | 說明 |
|-----|------|------|
| `./temp_videos` | 暫存影片 | 下載的 YouTube 影片（未列出/私人影片） |
| `./public/images` | 截圖 | AI 生成的影片截圖 |
| `./temp_files` | 上傳檔案 | 使用者上傳的參考檔案（圖片、PDF 等） |

**⚠️ 注意**：這些目錄會在容器啟動時自動建立。

---

## 🩺 健康檢查

容器包含健康檢查機制，會定期檢查伺服器是否正常運作：

```bash
# 查看容器健康狀態
docker compose ps

# 輸出範例：
# NAME              STATUS          PORTS
# ai-video-writer   Up (healthy)    0.0.0.0:3001->3001/tcp
```

健康檢查設定：
- **檢查間隔**：30 秒
- **超時時間**：10 秒
- **重試次數**：3 次
- **啟動寬限期**：40 秒

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

---

## 🔒 安全性與生產環境

### 安全最佳實踐

1. **環境變數安全**
   - ✅ 不要將 `.env.local` 提交到 Git（已加入 `.gitignore`）
   - ✅ 使用非 root 使用者執行（Dockerfile 已實施）
   - ✅ 在生產環境使用平台環境變數（不要使用 .env 檔案）
   - ✅ 定期更換 API Keys（建議 3-6 個月）

2. **Docker 安全設定**
   ```yaml
   # 在 docker-compose.yml 中取消註解以啟用
   security_opt:
     - no-new-privileges:true
   cap_drop:
     - ALL
   ```

3. **資源限制**（防止資源耗盡）
   ```yaml
   # 在 docker-compose.yml 中設定
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

### 生產環境部署

1. **反向代理**
   建議使用 Nginx 或 Traefik：
   ```nginx
   # Nginx 範例
   server {
       listen 443 ssl;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **HTTPS 強制**
   - 使用 Let's Encrypt 或其他 SSL 憑證
   - 強制 HTTPS 重定向

3. **監控與日誌**
   ```bash
   # 使用日誌驅動
   docker compose --log-level info logs -f

   # 或整合到監控系統
   # - Prometheus + Grafana
   # - ELK Stack
   # - Datadog
   ```

4. **備份策略**
   ```bash
   # 定期備份 volumes
   docker run --rm \
     -v ai-video-writer_temp_videos:/data \
     -v $(pwd)/backups:/backup \
     alpine tar czf /backup/temp_videos-$(date +%Y%m%d).tar.gz /data
   ```

5. **更新策略**
   ```bash
   # Zero-downtime 更新
   docker compose pull
   docker compose up -d --no-deps --build ai-video-writer
   ```

### 安全檢查清單

部署前請確認：

- [ ] 環境變數正確設定（不使用預設值）
- [ ] API Keys 有設定使用限制
- [ ] CORS 設定為實際的前端網址
- [ ] 啟用 HTTPS
- [ ] 設定資源限制
- [ ] 啟用監控和日誌
- [ ] 定期備份
- [ ] 閱讀並遵守 `SECURITY.md`

詳細安全指南請參考 **[SECURITY.md](../SECURITY.md)**。

---

## 📚 相關文件

- **[SECURITY.md](../SECURITY.md)** - 完整的安全政策
- **[DOCKER_DESKTOP.md](../DOCKER_DESKTOP.md)** - Docker Desktop 使用指南
- **[.env.example](../.env.example)** - 環境變數範例
- **[README.md](../README.md)** - 專案說明
