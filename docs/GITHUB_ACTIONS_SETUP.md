# GitHub Actions 自動更新快取設定指南

## 📋 概述

這個 GitHub Actions workflow 會每天自動更新影片快取到 GitHub Gist，讓你的搜尋功能永遠使用最新的影片資料，而且不消耗 YouTube API 配額。

## ⏰ 執行時機

- **自動執行**：每天台灣時間凌晨 2 點（UTC 18:00）
- **手動觸發**：隨時可以在 GitHub Actions 頁面手動執行

## 🔧 設定步驟

### 步驟 1：設定 GitHub Secrets

前往你的 GitHub repository：
1. 點擊 `Settings`
2. 點擊 `Secrets and variables` → `Actions`
3. 點擊 `New repository secret`

> ⚠️ 注意：GitHub 禁止 secrets 名稱以 `GITHUB_` 開頭。以下 secrets 使用 `VIDEO_CACHE_*` 命名，workflow 會在執行時自動映射為程式碼中使用的 `GITHUB_GIST_*` 環境變數。

需要設定以下 Secrets：

#### 必要的 Secrets

| Secret 名稱 | 說明 | 如何取得 |
|------------|------|---------|
| `YOUTUBE_REFRESH_TOKEN` | YouTube OAuth Refresh Token | 參考 [REFRESH_TOKEN_QUICK_START.md](./REFRESH_TOKEN_QUICK_START.md) |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth Client ID | 從 Google Cloud Console 取得 |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth Client Secret | 從 Google Cloud Console 取得 |
| `YOUTUBE_CHANNEL_ID` | 你的 YouTube 頻道 ID | 格式：`UCxxxxxxxxxxxxxxxxxx` |
| `VIDEO_CACHE_GIST_TOKEN` | GitHub Personal Access Token（gist 權限） | 參考下方說明 |
| `VIDEO_CACHE_GIST_ID` | Gist ID（首次執行後取得） | 參考下方說明 |

#### 選填的 Secrets

| Secret 名稱 | 說明 | 預設值 |
|------------|------|--------|
| `VIDEO_CACHE_GIST_FILENAME` | Gist 檔案名稱 | `youtube-videos-cache.json` |

### 步驟 2：取得 GitHub Personal Access Token

1. 前往 GitHub → Settings → Developer settings → [Personal access tokens](https://github.com/settings/tokens)
2. 點擊 `Generate new token (classic)`
3. 設定：
   - **Note**: `YouTube Video Cache`
   - **Expiration**: `No expiration` 或選擇較長的期限
   - **Scopes**: 勾選 `gist`（Create gists）
4. 點擊 `Generate token`
5. **⚠️ 重要**：立即複製 token，離開頁面後就看不到了

### 步驟 3：首次執行取得 Gist ID

#### 方式 A：手動觸發 GitHub Actions

1. 前往你的 repository → `Actions` 分頁
2. 點擊左側的 `Update Video Cache to Gist`
3. 點擊右側的 `Run workflow`
4. 點擊 `Run workflow` 按鈕
5. 等待執行完成（約 1-2 分鐘）
6. 點擊執行的 workflow，下載 `cache-update-info` artifact
7. 解壓縮後打開 `cache-update-info.json`，找到 `gistId`
8. 將 `gistId` 加入到 GitHub Secrets（名稱：`VIDEO_CACHE_GIST_ID`）

#### 方式 B：本地執行腳本

```bash
# 確保 .env.local 已設定好所有環境變數
npm run update-cache
```

執行後會輸出 Gist ID，將它加入到 GitHub Secrets（名稱：`VIDEO_CACHE_GIST_ID`）。

### 步驟 4：驗證設定

再次手動觸發 workflow，確認：
- ✅ 執行成功（綠色勾勾）
- ✅ 有產生 `cache-update-info` artifact
- ✅ Gist 有更新（前往你的 Gist 頁面確認）

## 📊 執行日誌範例

```
[API] ========================================
[API] 📦 收到生成影片快取請求
[API] ========================================
[API] 📺 頻道 ID: UCxxxxxxxxxxxxxxxxxx
[API] 🆔 Gist ID: abc123...
[API] 🚀 開始生成影片快取...

[VideoCache] ========================================
[VideoCache] 🚀 開始抓取影片快取
[VideoCache] ========================================
[VideoCache] 📋 步驟 1: 獲取上傳播放清單 ID...
[VideoCache] ✅ 上傳播放清單 ID: UUxxxxxxxxxxxxxxxxxx
[VideoCache] 📹 步驟 2: 開始抓取所有影片...
[VideoCache] 📄 正在獲取第 1 頁...
[VideoCache] 📊 目前已獲取: 50 支影片
[VideoCache] 📄 正在獲取第 2 頁...
[VideoCache] 📊 目前已獲取: 100 支影片
[VideoCache] ========================================
[VideoCache] ✅ 抓取完成！總共 100 支影片
[VideoCache] ========================================

[VideoCache] ========================================
[VideoCache] 📤 更新 Gist 快取
[VideoCache] ========================================
[VideoCache] 🆔 Gist ID: abc123...
[VideoCache] 🌐 正在更新 Gist...
[VideoCache] ========================================
[VideoCache] ✅ Gist 更新成功！
[VideoCache] ========================================
[VideoCache] 🆔 Gist ID: abc123...
[VideoCache] 🔗 Gist URL: https://gist.github.com/...
[VideoCache] 📄 檔案名稱: youtube-videos-cache.json

✅ 快取更新成功！
========================================
📊 總影片數：100
🆔 Gist ID：abc123...
🔗 Gist URL：https://gist.github.com/...
📅 更新時間：2024-01-01T02:00:00.000Z
========================================
```

## 🔍 手動觸發

隨時可以手動更新快取：

### 在 GitHub 網站上

1. 前往 `Actions` 分頁
2. 點擊 `Update Video Cache to Gist`
3. 點擊 `Run workflow`
4. 選擇是否強制更新
5. 點擊 `Run workflow` 按鈕

### 使用 GitHub CLI

```bash
# 一般更新
gh workflow run "Update Video Cache to Gist"

# 強制更新
gh workflow run "Update Video Cache to Gist" -f force_update=true
```

## 🐛 常見問題

### ❌ 執行失敗：401 Unauthorized

**原因**：YouTube token 已過期或無效

**解決方法**：
1. 重新取得 refresh token（參考 [REFRESH_TOKEN_QUICK_START.md](./REFRESH_TOKEN_QUICK_START.md)）
2. 更新 GitHub Secrets 中的 `YOUTUBE_REFRESH_TOKEN`

### ❌ 執行失敗：404 Not Found (Gist)

**原因**：Gist ID 不存在或無法訪問

**解決方法**：
1. 檢查 `VIDEO_CACHE_GIST_ID`（workflow 會注入為 `GITHUB_GIST_ID`）是否正確
2. 確認 Gist 沒有被刪除
3. 檢查 `VIDEO_CACHE_GIST_TOKEN`（提供 `GITHUB_GIST_TOKEN` 環境變數）是否有 gist 權限

### ❌ 執行失敗：Server not ready

**原因**：伺服器啟動超時

**解決方法**：
1. 檢查 workflow 日誌
2. 可能是依賴安裝問題，重新執行一次

### ⚠️ Gist 檔案名稱不對

**原因**：舊的 Gist 使用不同的檔案名稱

**解決方法**：
1. 設定 `VIDEO_CACHE_GIST_FILENAME` secret（例如：`youtube-videos-cache.json`）
2. 或者建立新的 Gist（移除 `GITHUB_GIST_ID`，讓它自動建立新的）

## 📈 配額使用情況

使用 GitHub Actions 自動更新快取的配額消耗：

- **YouTube API 配額**：每天更新一次，約消耗 50-100 配額（依影片數量而定）
- **GitHub Actions 分鐘數**：每次執行約 2-3 分鐘
- **總節省**：如果每天有 10 次搜尋，可節省 1,000 配額

## 🔐 安全性

- ✅ 所有敏感資訊都儲存在 GitHub Secrets（加密）
- ✅ Token 不會出現在日誌中
- ✅ Gist 設為私人（只有你可以看到）
- ✅ 前端不暴露任何 Token（只使用 Gist ID）

## 📚 相關文件

- [影片快取系統說明](./video-cache-setup.md)
- [取得 Refresh Token](./REFRESH_TOKEN_QUICK_START.md)
- [GitHub Actions 文件](https://docs.github.com/en/actions)

## 💡 進階設定

### 修改執行時間

編輯 `.github/workflows/update-video-cache.yml`：

```yaml
on:
  schedule:
    # 每 6 小時執行一次
    - cron: '0 */6 * * *'

    # 或每週一凌晨 2 點
    - cron: '0 18 * * 1'
```

### 新增通知

可以加入 Slack、Discord、Email 通知：

```yaml
- name: Send notification
  if: success()
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -H "Content-Type: application/json" \
      -d '{"text":"影片快取已更新！"}'
```

## ✅ 檢查清單

設定完成後，確認：

- [ ] 所有必要的 GitHub Secrets 都已設定
- [ ] 第一次手動執行成功
- [ ] 取得並設定了 `VIDEO_CACHE_GIST_ID`
- [ ] Gist 可以正常訪問
- [ ] 前端 `.env.local` 也有設定 `GITHUB_GIST_ID`
- [ ] 前端搜尋功能正常使用快取

完成後，你的影片快取就會每天自動更新了！🎉
