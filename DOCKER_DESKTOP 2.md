# Docker Desktop 使用指南

這個指南教你如何在 Docker Desktop 中執行 AI Video Writer。

## 🚀 快速開始

### 方法 1：使用 Docker Desktop GUI（推薦給新手）

1. **建置映像檔**
   - 開啟 Docker Desktop
   - 在專案資料夾執行：
     ```bash
     docker build -f docker/Dockerfile -t ai-video-writer .
     ```

2. **在 Docker Desktop 中啟動容器**
   - 開啟 Docker Desktop
   - 點擊 "Images" 標籤
   - 找到 `ai-video-writer` 映像檔
   - 點擊右側的 "Run" 按鈕

3. **設定容器選項**

   在彈出的視窗中設定：

   **Container name:**
   ```
   ai-video-writer
   ```

   **Ports (Host port : Container port):**
   ```
   3001 : 3001
   ```

   **Environment variables:**
   點擊 "+" 新增以下變數：

   必需設定：
   - Key: `GEMINI_API_KEY`, Value: `你的_Gemini_API_金鑰`
   - Key: `YOUTUBE_CLIENT_ID`, Value: `你的_YouTube_Client_ID`

   可選設定：
   - Key: `NODE_ENV`, Value: `production`
   - Key: `PORT`, Value: `3001`
   - Key: `FILE_RETENTION_DAYS`, Value: `7` (檔案保留天數，預設 7 天)

   **Volumes (Host path : Container path):**
   點擊 "+" 新增以下掛載：
   - Host: `專案路徑/temp_videos`, Container: `/app/temp_videos`
   - Host: `專案路徑/public/images`, Container: `/app/public/images`

4. **啟動容器**
   - 點擊 "Run" 按鈕
   - 等待容器啟動

5. **開啟應用程式**
   - 開啟瀏覽器訪問：http://localhost:3001

### 方法 2：使用 Docker Compose（推薦給進階使用者）

1. **建立本地環境變數檔案（可選）**
   ```bash
   cp .env.example .env.local
   # 編輯 .env.local，填入你的 API keys
   ```

2. **設定環境變數**

   選項 A：在 `.env.local` 檔案中設定（如果你建立了的話）

   選項 B：在終端機中設定（不需要 .env.local 檔案）
   ```bash
   export GEMINI_API_KEY="你的_API_金鑰"
   export YOUTUBE_CLIENT_ID="你的_Client_ID"
   ```

3. **啟動服務**
   ```bash
   docker-compose up -d
   ```

4. **查看狀態**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

5. **停止服務**
   ```bash
   docker-compose down
   ```

## 📋 環境變數說明

### 必要的環境變數

你必須設定這兩個環境變數，否則應用程式無法正常運作：

| 環境變數 | 說明 | 如何取得 |
|---------|------|---------|
| `GEMINI_API_KEY` | Google Gemini AI API 金鑰 | https://makersuite.google.com/app/apikey |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth 2.0 用戶端 ID | https://console.cloud.google.com/apis/credentials |

### 可選的環境變數

| 環境變數 | 預設值 | 說明 |
|---------|--------|------|
| `FILE_RETENTION_DAYS` | `7` | 檔案保留天數。啟動時會自動刪除超過此天數的 temp_videos 和截圖檔案 |
| `PORT` | `3001` | 伺服器埠號 |
| `NODE_ENV` | `production` | Node.js 執行環境 |

### 🧹 自動清理機制

應用程式會在**每次啟動時**自動檢查並清理過期檔案：

- ✅ 檢查 `temp_videos` 資料夾中的影片檔案
- ✅ 檢查 `public/images` 資料夾中的截圖檔案
- ✅ 刪除超過 `FILE_RETENTION_DAYS` 天數的檔案
- ✅ 顯示清理統計（刪除檔案數量、釋放空間）

**範例日誌：**
```
========== 🧹 啟動清理檢查 ==========
[Cleanup] 檔案保留天數: 7 天
[Cleanup] 檢查 temp_videos 目錄...
  🗑️  已刪除: abc123.mp4 (45.23 MB, 8 天前)
[Cleanup] 檢查 public/images 目錄...
  🗑️  已刪除: abc123_screenshot_0_current.jpg (0.85 MB, 8 天前)
[Cleanup] ✅ 清理完成: 刪除 2 個檔案，釋放 46.08 MB 空間
========== 清理檢查完成 ==========
```

**調整保留天數：**
```bash
# 設定保留 14 天
export FILE_RETENTION_DAYS=14

# 或在 Docker Desktop 環境變數中設定
FILE_RETENTION_DAYS=14
```

## 🔍 驗證容器是否正常運作

### 在 Docker Desktop 中檢查
1. 開啟 Docker Desktop
2. 點擊 "Containers" 標籤
3. 找到 `ai-video-writer` 容器
4. 檢查狀態是否為 "Running" 且顯示綠色
5. 點擊容器名稱查看詳細日誌

### 使用命令列檢查
```bash
# 檢查容器狀態
docker ps | grep ai-video-writer

# 查看容器日誌
docker logs ai-video-writer

# 進入容器執行命令
docker exec -it ai-video-writer /bin/bash

# 測試 yt-dlp 是否安裝
docker exec ai-video-writer yt-dlp --version

# 測試 FFmpeg 是否安裝
docker exec ai-video-writer ffmpeg -version
```

## 🛠️ 常見問題

### Q1: 容器啟動後無法訪問 http://localhost:3001
**A:** 檢查以下事項：
- 確認 Port mapping 是否正確設定為 `3001:3001`
- 檢查容器日誌是否有錯誤訊息
- 確認沒有其他程式佔用 3001 埠號

### Q2: 容器啟動失敗，提示缺少 API Key
**A:** 檢查環境變數是否正確設定：
```bash
docker exec ai-video-writer printenv | grep GEMINI_API_KEY
docker exec ai-video-writer printenv | grep YOUTUBE_CLIENT_ID
```

### Q3: 影片下載或截圖失敗
**A:** 確認：
- Volume 是否正確掛載
- 容器是否有寫入權限
- 檢查磁碟空間是否足夠

### Q4: 想要更新容器配置
**A:**
1. 停止並刪除舊容器
   ```bash
   docker stop ai-video-writer
   docker rm ai-video-writer
   ```
2. 重新建立容器（使用上述方法 1 或 2）

### Q5: 想要重新建置映像檔（更新程式碼後）
**A:**
```bash
# 刪除舊映像檔
docker rmi ai-video-writer

# 重新建置
docker build -f docker/Dockerfile -t ai-video-writer .

# 或使用 docker-compose
docker-compose build --no-cache
```

## 📦 資料持久化

以下目錄建議掛載到本地，以保留資料：

- `./temp_videos` - 暫存下載的影片檔案
- `./public/images` - 生成的截圖

如果不掛載這些目錄，刪除容器時所有資料都會遺失。

## 🔒 安全性注意事項

1. **不要將 `.env.local` 檔案提交到 Git**
   - 已在 `.gitignore` 中排除

2. **保護你的 API Keys**
   - 不要在公開的地方分享你的環境變數
   - 定期輪換 API Keys

3. **生產環境建議**
   - 使用 Docker secrets 管理敏感資料
   - 設定適當的網路隔離
   - 限制容器資源使用

## 🎯 結論

**使用 Docker Desktop GUI？**
→ 不需要 `.env.local` 檔案，直接在 Docker Desktop 中手動設定環境變數即可

**使用 docker-compose 命令列？**
→ 可以選擇：
  - 建立 `.env.local` 檔案（方便、可重複使用）
  - 或在終端機中 export 環境變數（暫時性）

兩種方式都可以，選擇你覺得方便的即可！
