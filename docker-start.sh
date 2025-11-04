#!/bin/bash
# 快速啟動 AI Video Writer 的 Docker 容器

set -e

echo "🚀 啟動 AI Video Writer Docker 容器..."

# 檢查 .env.local 是否存在
if [ ! -f .env.local ]; then
    echo "⚠️  警告：找不到 .env.local 檔案"
    echo "請複製 .env.example 並填入你的 API keys："
    echo "  cp .env.example .env.local"
    echo "  然後編輯 .env.local"
    exit 1
fi

# 檢查必要的環境變數
# set -a 會讓 source 的變數自動 export，方便 docker compose 使用
set -a
source .env.local
set +a

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo "❌ 錯誤：GEMINI_API_KEY 未設定或使用預設值"
    echo "請在 .env.local 中設定有效的 GEMINI_API_KEY"
    exit 1
fi

if [ -z "$YOUTUBE_CLIENT_ID" ] || [ "$YOUTUBE_CLIENT_ID" = "your_youtube_client_id.apps.googleusercontent.com" ]; then
    echo "❌ 錯誤：YOUTUBE_CLIENT_ID 未設定或使用預設值"
    echo "請在 .env.local 中設定有效的 YOUTUBE_CLIENT_ID"
    exit 1
fi

echo "✅ 環境變數檢查通過"

# 建立必要的目錄
mkdir -p temp_videos public/images

echo "📦 啟動 Docker Compose..."
docker compose up -d

echo ""
echo "✅ 容器已啟動！"
echo ""
echo "🌐 應用程式位址： http://localhost:3001"
echo ""
echo "📊 查看日誌： docker compose logs -f"
echo "🛑 停止服務： docker compose down"
echo "🔄 重新啟動： docker compose restart"
echo ""
