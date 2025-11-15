#!/bin/bash
# 快速啟動 AI Video Writer 的 Docker 容器
#
# 功能：
# - 檢查 .env.local 是否存在
# - 驗證必要的環境變數
# - 建立必要的目錄
# - 啟動 Docker Compose
#
# 使用方式：
#   ./docker-start.sh

set -e

echo "🚀 啟動 AI Video Writer Docker 容器..."
echo ""

# ==================== 檢查 .env.local ====================
if [ ! -f .env.local ]; then
    echo "⚠️  警告：找不到 .env.local 檔案"
    echo ""
    echo "請執行以下步驟："
    echo "  1. cp .env.example .env.local"
    echo "  2. 編輯 .env.local 並填入你的 API keys"
    echo "  3. 重新執行 ./docker-start.sh"
    echo ""
    echo "📖 詳細說明請參考："
    echo "  - README.md (環境變數設定章節)"
    echo "  - .env.example (範例檔案)"
    echo "  - SECURITY.md (安全性指南)"
    echo ""
    exit 1
fi

# ==================== 載入環境變數 ====================
# set -a 會讓 source 的變數自動 export，方便 docker compose 使用
set -a
source .env.local
set +a

echo "🔍 檢查必要的環境變數..."

# ==================== 驗證 GEMINI_API_KEY ====================
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo "❌ 錯誤：GEMINI_API_KEY 未設定或使用預設值"
    echo ""
    echo "請在 .env.local 中設定有效的 GEMINI_API_KEY："
    echo "  1. 前往 https://makersuite.google.com/app/apikey"
    echo "  2. 建立 API Key"
    echo "  3. 複製金鑰到 .env.local"
    echo ""
    exit 1
fi

# ==================== 驗證 YOUTUBE_CLIENT_ID ====================
if [ -z "$YOUTUBE_CLIENT_ID" ] || [ "$YOUTUBE_CLIENT_ID" = "your_youtube_client_id.apps.googleusercontent.com" ]; then
    echo "❌ 錯誤：YOUTUBE_CLIENT_ID 未設定或使用預設值"
    echo ""
    echo "請在 .env.local 中設定有效的 YOUTUBE_CLIENT_ID："
    echo "  1. 前往 https://console.cloud.google.com/apis/credentials"
    echo "  2. 建立 OAuth 2.0 Client ID"
    echo "  3. 複製 Client ID 到 .env.local"
    echo ""
    exit 1
fi

echo "✅ 環境變數檢查通過"
echo ""

# ==================== 建立必要的目錄 ====================
echo "📁 建立必要的目錄..."
mkdir -p temp_videos public/images temp_files
echo "  ✓ temp_videos/ (暫存影片)"
echo "  ✓ public/images/ (截圖)"
echo "  ✓ temp_files/ (上傳的參考檔案)"
echo ""

# ==================== 啟動 Docker Compose ====================
echo "📦 啟動 Docker Compose..."
docker compose up -d

echo ""
echo "✅ 容器已啟動！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 應用程式位址： http://localhost:3001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 常用指令："
echo "  📊 查看日誌：     docker compose logs -f"
echo "  🔄 重新啟動：     docker compose restart"
echo "  🛑 停止服務：     docker compose down"
echo "  🏗️  重新建置：     docker compose build --no-cache"
echo "  💻 進入容器：     docker compose exec ai-video-writer /bin/bash"
echo "  🩺 健康檢查：     docker compose ps"
echo ""
echo "🔒 安全提醒："
echo "  - 不要將 .env.local 提交到 Git"
echo "  - 定期更換 API Keys (建議 3-6 個月)"
echo "  - 詳細安全指南請參考 SECURITY.md"
echo ""
