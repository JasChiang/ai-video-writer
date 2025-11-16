#!/bin/bash
# 將當前分支獨立成新 Repository 的腳本

echo "=========================================="
echo "  將分支獨立成新 Repository"
echo "=========================================="
echo ""

# 顯示當前狀態
echo "📍 當前分支："
git branch --show-current
echo ""

echo "📊 最新 commits："
git log --oneline -5
echo ""

# 提示用戶
echo "⚠️  請先完成以下步驟："
echo ""
echo "1. 前往 GitHub 創建新的私有 Repository："
echo "   👉 https://github.com/new"
echo ""
echo "2. 填寫資訊："
echo "   - Repository name: ai-video-writer-private (或您想要的名稱)"
echo "   - Visibility: Private ✅"
echo "   - ❌ 不要勾選任何初始化選項"
echo ""
echo "3. 創建後，複製 Repository URL，例如："
echo "   https://github.com/JasChiang/ai-video-writer-private.git"
echo ""

# 詢問用戶
read -p "您已經創建好新 repo 了嗎？(y/n): " created

if [ "$created" != "y" ] && [ "$created" != "Y" ]; then
    echo ""
    echo "請先創建 repo 後再運行此腳本。"
    exit 0
fi

echo ""
read -p "請輸入新 repo 的 URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ URL 不能為空"
    exit 1
fi

echo ""
echo "=========================================="
echo "  開始推送到新 Repository"
echo "=========================================="
echo ""

# 添加新 remote
echo "1️⃣ 添加新 remote..."
git remote add private "$REPO_URL"

if [ $? -eq 0 ]; then
    echo "✅ Remote 'private' 添加成功"
else
    echo "⚠️  Remote 'private' 可能已存在，嘗試更新 URL..."
    git remote set-url private "$REPO_URL"
fi

echo ""
echo "2️⃣ 驗證 remote 配置..."
git remote -v | grep private
echo ""

# 推送當前分支到新 repo 的 main 分支
CURRENT_BRANCH=$(git branch --show-current)
echo "3️⃣ 推送分支到新 repo..."
echo "   從: $CURRENT_BRANCH"
echo "   到: main"
echo ""

git push private "$CURRENT_BRANCH:main"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✅ 推送成功！"
    echo "=========================================="
    echo ""
    echo "📦 新 Repository 已包含所有功能："
    echo "   - AI 多模型支持（Gemini、Claude、GPT、Grok）"
    echo "   - 頻道分析儀表板"
    echo "   - 關鍵字分析面板"
    echo "   - 影片快取系統"
    echo "   - maxOutputTokens: 8192 設定"
    echo "   - 3000 字提示詞限制"
    echo "   - 完整文檔（25+ 份）"
    echo ""
    echo "🔗 請前往查看："
    echo "   ${REPO_URL%.git}"
    echo ""
    echo "💡 後續操作："
    echo "   - 在 GitHub Desktop 中可以看到新 repo"
    echo "   - 可以選擇是否保留兩個 remote（origin 和 private）"
    echo ""
else
    echo ""
    echo "❌ 推送失敗，請檢查："
    echo "   1. URL 是否正確"
    echo "   2. 是否有權限訪問該 repo"
    echo "   3. GitHub 認證是否有效"
    echo ""
fi

echo ""
echo "=========================================="
echo "  當前 Remote 配置"
echo "=========================================="
git remote -v
