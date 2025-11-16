# 📦 建立私有 Repository 指南

## 方案一：手動在 GitHub 建立（推薦）

### 步驟 1: 在 GitHub 建立新的私有 Repository

1. 前往 GitHub: https://github.com/new
2. 填寫以下資訊：
   - **Repository name**: `ai-video-writer-private` (或您想要的名稱)
   - **Description**: AI Video Writer - 多模型分析版本
   - **Visibility**: 選擇 **Private** ✅
   - **不要勾選**: Initialize with README, .gitignore, license
3. 點擊 **Create repository**

### 步驟 2: 記下新 Repo 的 URL

創建後會看到類似這樣的 URL：
```
https://github.com/JasChiang/ai-video-writer-private.git
```

### 步驟 3: 推送當前分支到新的私有 Repo

在終端執行以下命令：

```bash
# 添加新的 remote（命名為 private）
git remote add private https://github.com/JasChiang/ai-video-writer-private.git

# 推送當前分支到新 repo 的 main 分支
git push private claude/ai-analytics-multi-model-012AQzaW8ttmKGPeZjKHg5G1:main

# 或者推送所有內容（包括其他分支）
git push private --all
```

### 步驟 4: 設定新 Repo 為預設追蹤（選用）

如果您想要將新的私有 repo 設為主要工作位置：

```bash
# 重新命名 remote
git remote rename origin old-origin
git remote rename private origin

# 設定當前分支追蹤新的 origin
git branch --set-upstream-to=origin/main
```

---

## 方案二：複製整個 Repository 到新私有 Repo

如果您想要保留完整的 commit 歷史和所有分支：

### 步驟 1: 在 GitHub 建立新私有 Repo（同上）

### 步驟 2: Mirror Push 整個 Repository

```bash
# 進入專案目錄
cd /home/user/ai-video-writer

# 推送所有分支和標籤到新 repo
git push --mirror https://github.com/JasChiang/ai-video-writer-private.git
```

### 步驟 3: 重新設定 Remote

```bash
# 更新 remote URL
git remote set-url origin https://github.com/JasChiang/ai-video-writer-private.git

# 驗證
git remote -v
```

---

## 方案三：Fork 並設為私有（最簡單）

如果原 repo 是您自己的：

1. 在 GitHub 上點擊原 repo 的 **Settings**
2. 滾動到 **Danger Zone**
3. 點擊 **Change repository visibility**
4. 選擇 **Make private**

**注意**: 這會影響整個 `ai-video-writer` repository，而不只是這個分支。

---

## 當前分支資訊

- **分支名稱**: `claude/ai-analytics-multi-model-012AQzaW8ttmKGPeZjKHg5G1`
- **最新 commit**: `b773aa7 docs: Add server restart guide for new API endpoints`
- **包含功能**:
  - ✅ AI 多模型支持（Gemini、Claude、GPT、DeepSeek）
  - ✅ 頻道分析儀表板
  - ✅ 關鍵字分析面板
  - ✅ 影片快取系統
  - ✅ maxOutputTokens: 8192 設定
  - ✅ 3000 字提示詞限制
  - ✅ 完整文檔（25+ 份）

---

## 推薦方案

**建議使用方案一**，優點：
- ✅ 保持原 repo 不變
- ✅ 新 repo 只包含當前工作的分支
- ✅ 可以同時維護兩個 repo
- ✅ 隨時可以從原 repo 拉取更新

---

## 需要協助？

請告訴我您選擇哪個方案，我可以協助您：
1. 生成完整的命令腳本
2. 驗證推送結果
3. 設定 remote 追蹤
4. 配置 CI/CD workflow
