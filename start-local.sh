#!/bin/bash

# 禁用 Google Application Default Credentials (ADC)
# 強制使用 .env.local 中的 GEMINI_API_KEY
export GOOGLE_APPLICATION_CREDENTIALS=""

# 檢查 .env.local 是否存在
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found! Please create it from .env.example"
    exit 1
fi

echo "=========================================="
echo "🚀 Starting AI Video Writer (Local Mode)"
echo "=========================================="
echo "✅ ADC disabled - using .env.local API Key"
echo "✅ This fixes the Files API 403 error"
echo "=========================================="
echo ""

# 啟動開發伺服器
npm run dev:all
