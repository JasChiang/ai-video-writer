# GitHub Actions 自動更新影片快取設定指南

本指南將協助你設定 GitHub Actions，讓系統每天自動更新影片快取到 Gist。

## 📋 功能說明

- ⏰ **自動執行**：每天台灣時間凌晨 2 點自動更新快取
- 🔄 **手動觸發**：可隨時手動執行更新
- 📊 **狀態追蹤**：自動記錄更新結果和影片數量
- ⚠️ **錯誤通知**：更新失敗時會顯示詳細錯誤訊息

---

## 🔧 設定步驟

### 步驟 1：建立 GitHub Personal Access Token

1. 前往 https://github.com/settings/tokens
2. 點擊「Generate new token」→「Generate new token (classic)」
3. 設定：
   - **Note**: `YouTube Video Cache`
   - **Expiration**: `No expiration`（或選擇較長的期限）
   - **Select scopes**: 勾選 `gist`
4. 點擊「Generate token」
5. **複製 token**（格式：`ghp_xxxxxxxxxxxxxx`）
6. ⚠️ **重要**：Token 只會顯示一次，請務必保存

---

### 步驟 2：取得 YouTube Access Token

YouTube OAuth token 會過期（通常 1 小時），因此我們需要**長期有效的 token**。

#### 選項 A：使用 Refresh Token（推薦）

1. 在本地執行應用程式並登入 YouTube
2. 在瀏覽器開發者工具中執行：
   ```javascript
   localStorage.getItem('youtubeContentAssistant.oauthToken')
   ```
3. 複製整個 token 物件，包含 `access_token` 和 `refresh_token`

> ⚠️ **注意**：目前的實作尚未支援自動刷新 token，建議每 1-3 個月手動更新一次。

#### 選項 B：使用服務帳號（進階）

如果需要完全自動化，可以：
1. 建立 Google Cloud 服務帳號
2. 授權服務帳號訪問 YouTube Data API
3. 使用服務帳號的 credentials

> 詳細設定請參考：https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps

---

### 步驟 3：取得 YouTube Channel ID

1. 前往 https://www.youtube.com
2. 點擊右上角頭像 → 「你的頻道」
3. 從 URL 複製 Channel ID：
   ```
   https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx
                                  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                                  這就是你的 Channel ID
   ```

---

### 步驟 4：首次生成 Gist

在設定 GitHub Actions 之前，需要先手動生成一次 Gist。

#### 方式 A：使用本地腳本（推薦）

1. 在 `.env.local` 設定：
   ```bash
   YOUTUBE_ACCESS_TOKEN=your_token_here
   YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx
   GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxxxx
   ```

2. 啟動伺服器：
   ```bash
   npm run server
   ```

3. 在另一個終端執行：
   ```bash
   npm run update-cache
   ```

4. 複製輸出的 **Gist ID**（格式：`abc123...`）

#### 方式 B：使用 API

```bash
curl -X POST http://localhost:3001/api/video-cache/generate \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your_youtube_token",
    "channelId": "UCxxxxxxxxxxxxxxxxxx",
    "gistToken": "ghp_xxxxxxxxxxxxxx",
    "gistId": null
  }'
```

回應會包含 `gistId`，複製保存。

---

### 步驟 5：設定 GitHub Secrets

1. 前往你的 GitHub repository
2. 點擊「Settings」→「Secrets and variables」→「Actions」
3. 點擊「New repository secret」
4. 依序新增以下 secrets（GitHub 禁止 `GITHUB_` 前綴，因此 workflow 會把 `VIDEO_CACHE_*` 映射為程式碼需要的 `GITHUB_GIST_*` 環境變數）：

| Secret 名稱 | 值 | 說明 |
|------------|-----|------|
| `YOUTUBE_ACCESS_TOKEN` | `ya29.a0...` 或完整 token 物件 | YouTube OAuth token |
| `YOUTUBE_CHANNEL_ID` | `UCxxxxxxxxxxxxxxxxxx` | 你的頻道 ID |
| `VIDEO_CACHE_GIST_TOKEN` | `ghp_xxxxxxxxxxxxxx` | GitHub Personal Access Token（gist scope） |
| `VIDEO_CACHE_GIST_ID` | `abc123...` | 步驟 4 取得的 Gist ID |
| `VIDEO_CACHE_GIST_FILENAME`（選填） | `youtube-videos-cache.json` | 自訂快取檔名 |

---

### 步驟 6：啟用 GitHub Actions

1. 將程式碼推送到 GitHub：
   ```bash
   git add .
   git commit -m "Add GitHub Actions for video cache"
   git push
   ```

2. 前往 GitHub repository 的「Actions」頁面
3. 確認 workflow 已啟用
4. 點擊「Update Video Cache to Gist」
5. 點擊「Run workflow」→「Run workflow」手動執行測試

---

## 🔍 驗證設定

### 檢查 workflow 執行狀態

1. 前往「Actions」頁面
2. 查看最近的 workflow 執行記錄
3. 點擊查看詳細日誌

### 成功的標誌

✅ 日誌中顯示：
```
✅ 快取更新成功！
========================================
📊 總影片數：1500
🆔 Gist ID：abc123...
🔗 Gist URL：https://gist.github.com/...
📅 更新時間：2025-11-08T18:00:00.000Z
========================================
```

### 失敗的常見原因

❌ **YouTube Access Token 已過期**
```
解決方式：更新 YOUTUBE_ACCESS_TOKEN secret
```

❌ **Gist ID 不存在**
```
解決方式：檢查 `VIDEO_CACHE_GIST_ID`（workflow 會轉成 `GITHUB_GIST_ID` 環境變數）是否正確
```

❌ **GitHub token 權限不足**
```
解決方式：確認 `VIDEO_CACHE_GIST_TOKEN`（供應 `GITHUB_GIST_TOKEN` 環境變數）有 gist 權限
```

---

## ⏰ 執行時間設定

workflow 預設每天台灣時間凌晨 2 點執行。

### 修改執行時間

編輯 `.github/workflows/update-video-cache.yml`：

```yaml
on:
  schedule:
    # UTC 時間，需要減 8 小時
    # 例如：台灣 10:00 = UTC 02:00
    - cron: '0 2 * * *'
```

### cron 格式說明

```
┌───────────── 分鐘 (0 - 59)
│ ┌───────────── 小時 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6) (星期日=0)
│ │ │ │ │
* * * * *
```

範例：
- `0 2 * * *` - 每天 UTC 02:00（台灣 10:00）
- `0 18 * * *` - 每天 UTC 18:00（台灣 02:00）
- `0 */6 * * *` - 每 6 小時執行一次
- `0 2 * * 1` - 每週一 UTC 02:00

---

## 🔄 手動執行 workflow

有兩種方式手動觸發更新：

### 方式 A：使用 GitHub 網頁介面

1. 前往「Actions」頁面
2. 點擊「Update Video Cache to Gist」
3. 點擊「Run workflow」
4. 選擇分支
5. （選填）勾選「強制更新」
6. 點擊「Run workflow」

### 方式 B：使用 GitHub CLI

```bash
gh workflow run update-video-cache.yml
```

---

## 📊 查看執行歷史

1. 前往「Actions」頁面
2. 查看 workflow 執行列表
3. 每次執行會產生 artifact（`cache-update-info.json`）
4. 可下載查看詳細資訊

---

## 🛠 故障排除

### YouTube Token 過期問題

**症狀**：每次執行都失敗，顯示 401 錯誤

**解決方式**：
1. 在本地重新登入 YouTube
2. 取得新的 access token
3. 更新 `YOUTUBE_ACCESS_TOKEN` secret

**建議**：
- 設定提醒，每 1-3 個月更新一次 token
- 或實作 refresh token 自動刷新機制

### Workflow 沒有自動執行

**可能原因**：
1. Repository 是 private，需要啟用 Actions
2. cron 時間設定錯誤
3. GitHub Actions 分鐘級延遲（最多 15 分鐘）

**解決方式**：
1. 前往「Settings」→「Actions」→「General」
2. 確認「Allow all actions and reusable workflows」已啟用
3. 等待或手動觸發測試

---

## 🔒 安全建議

1. **使用 Secrets**：絕對不要將 token 寫在程式碼中
2. **最小權限**：GitHub token 只給 gist 權限
3. **定期更換**：建議每 3-6 個月更換一次 token
4. **私人 Gist**：使用私人 Gist 保護頻道資訊
5. **監控執行**：定期檢查 workflow 執行狀態

---

## 📝 完整設定檢查清單

- [ ] 建立 GitHub Personal Access Token（有 gist 權限）
- [ ] 取得 YouTube Access Token
- [ ] 取得 YouTube Channel ID
- [ ] 本地首次執行 `npm run update-cache` 成功
- [ ] 取得 Gist ID
- [ ] 在 GitHub Secrets 設定所有必要的變數
- [ ] 推送程式碼到 GitHub
- [ ] 手動執行 workflow 測試成功
- [ ] 確認 cron 時間設定正確
- [ ] 設定 token 更新提醒

---

## 🎉 完成！

現在你的影片快取會每天自動更新到 Gist！

**查看快取**：
- Gist URL: https://gist.github.com/你的用戶名/你的gist_id
- 前端會自動從 Gist 載入最新快取

**配額使用**：
- 每日自動更新：80-160 配額（取決於影片數量）
- 前端搜尋：0 配額（從快取過濾）
- 載入詳細資訊：8 配額/50 個影片

**節省配額**：
- 從每次搜尋 280-560 配額
- 降低到每天僅 80-160 配額
- 節省約 **95-98%** 的配額！
