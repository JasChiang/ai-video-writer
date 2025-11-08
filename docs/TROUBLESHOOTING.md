# 🔧 問題排除指南

## 📋 快速診斷

### 1. 測試 Gist 快取是否正常

執行測試腳本：
```bash
npm run test-gist
```

這個腳本會檢查：
- ✅ 環境變數是否正確設定
- ✅ Gist 是否能正常載入
- ✅ 快取資料結構是否正確
- ✅ 搜尋功能是否正常
- ✅ API 端點是否可用

**預期輸出**：
```
========================================
🧪 測試 Gist 快取功能
========================================

📋 環境變數檢查：
   - GITHUB_GIST_ID: ✅ 已設定
   - GITHUB_GIST_TOKEN: ✅ 已設定

🧪 測試 1: 載入 Gist 快取
─────────────────────────────────────

[VideoCache] ========================================
[VideoCache] 📥 從 Gist 載入快取
[VideoCache] ========================================
[VideoCache] 🆔 Gist ID: abc123...
[VideoCache] 📊 總影片數: 100
[VideoCache] ✅ 載入成功！

✅ 測試 1 通過：成功載入快取
...
```

---

## ❌ 常見問題

### 問題 1：「連續多頁未找到匹配影片」

**症狀**：
- 搜尋時出現「連續多頁未找到匹配影片」的日誌
- 明明有該關鍵字的影片，卻搜尋不到

**原因**：
1. **未使用 Gist 快取** - 仍在使用 YouTube API 搜尋
2. **GITHUB_GIST_ID 未設定** - 前端無法使用快取搜尋

**解決方法**：

#### 步驟 1：確認環境變數

檢查 `.env.local` 是否有設定：
```env
GITHUB_GIST_ID=你的gist_id
GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxx
```

#### 步驟 2：重新啟動開發伺服器

```bash
# 停止目前的伺服器（Ctrl+C）
# 重新啟動
npm run dev
```

#### 步驟 3：檢查瀏覽器 Console

搜尋影片時，應該看到：
```
[App] 使用 Gist 快取搜尋，關鍵字: xxx
[App] 快取搜尋結果: 5 支影片
```

如果看到：
```
[App] 未設定 GIST_ID，使用 YouTube API 搜尋（配額成本較高）
```

代表前端沒有讀取到 `GITHUB_GIST_ID`。

#### 步驟 4：清除快取並重建

```bash
# 清除 Vite 快取
rm -rf node_modules/.vite

# 重新啟動
npm run dev
```

---

### 問題 2：Gist 載入失敗 404

**症狀**：
```
[VideoCache] Gist 載入錯誤: Gist 載入失敗: 404
```

**原因**：
1. `GITHUB_GIST_ID` 錯誤或不存在
2. Gist 已被刪除
3. `GITHUB_GIST_TOKEN` 權限不足

**解決方法**：

#### 檢查 Gist 是否存在

前往：`https://gist.github.com/你的用戶名`

確認 Gist 存在且可以訪問。

#### 重新建立快取

```bash
# 移除舊的 GIST_ID
# 編輯 .env.local，將 GITHUB_GIST_ID 設為空

# 重新建立
npm run update-cache

# 將新的 GIST_ID 加回 .env.local
```

---

### 問題 3：快取搜尋不到影片

**症狀**：
- 使用 Gist 快取搜尋
- 返回 0 筆結果
- 但確定有該關鍵字的影片

**原因**：
1. 快取資料過舊，沒有包含最新影片
2. 搜尋關鍵字大小寫問題（已修正為不區分大小寫）
3. 影片狀態過濾問題

**解決方法**：

#### 步驟 1：更新快取

```bash
npm run update-cache
```

#### 步驟 2：檢查影片狀態過濾

確認你的搜尋設定：
- 是否顯示私人影片
- 是否顯示未列出影片

#### 步驟 3：測試搜尋

```bash
npm run test-gist
```

檢查測試輸出，確認關鍵字搜尋是否正常。

---

### 問題 4：配額消耗過快

**症狀**：
- YouTube API 配額快速消耗
- 每次搜尋消耗 100+ 配額

**原因**：
- 沒有使用 Gist 快取
- GIST_ID 未正確設定

**解決方法**：

#### 檢查搜尋是否使用快取

開啟瀏覽器 Console，搜尋影片時應該看到：
```
[App] 使用 Gist 快取搜尋
```

而不是：
```
[YouTubeService] searchInPlaylist:start
```

如果看到後者，代表仍在使用 YouTube API。

#### 確認前端環境變數

1. 檢查 `.env.local` 有設定 `GITHUB_GIST_ID`
2. 重新啟動開發伺服器
3. 清除瀏覽器快取

---

### 問題 5：GitHub Actions 執行失敗

**症狀**：
- GitHub Actions workflow 失敗
- 錯誤訊息：401 Unauthorized

**原因**：
- YouTube Refresh Token 過期
- GitHub Secrets 設定錯誤

**解決方法**：

#### 檢查 GitHub Secrets

前往 GitHub → Settings → Secrets and variables → Actions

確認以下 Secrets 都已設定：
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_CHANNEL_ID`
- `VIDEO_CACHE_GIST_TOKEN`（workflow 會注入為 `GITHUB_GIST_TOKEN`）
- `VIDEO_CACHE_GIST_ID`（workflow 會注入為 `GITHUB_GIST_ID`）

#### 重新取得 Refresh Token

如果 token 過期，參考 [REFRESH_TOKEN_QUICK_START.md](./REFRESH_TOKEN_QUICK_START.md) 重新取得。

---

## 🔍 檢查清單

當遇到問題時，依序檢查：

### 本地開發

- [ ] `.env.local` 已設定所有必要的環境變數
- [ ] `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 正確
- [ ] 執行 `npm run test-gist` 測試通過
- [ ] 瀏覽器 Console 顯示「使用 Gist 快取搜尋」
- [ ] 開發伺服器已重新啟動

### GitHub Actions

- [ ] GitHub Secrets 都已設定
- [ ] Refresh Token 仍然有效
- [ ] Workflow 手動執行成功
- [ ] Gist 已建立且可訪問

### 快取資料

- [ ] 快取資料包含最新影片
- [ ] 快取版本號正確
- [ ] 檔案名稱符合環境變數設定

---

## 📞 需要更多幫助？

### 查看日誌

**前端日誌**：
- 開啟瀏覽器 DevTools → Console
- 搜尋 `[App]` 或 `[ArticleWorkspace]`

**後端日誌**：
- 查看執行 `npm run dev` 的終端
- 搜尋 `[API]` 或 `[VideoCache]`

**GitHub Actions 日誌**：
- GitHub → Actions → 選擇執行的 workflow
- 查看詳細日誌

### 重置所有設定

如果所有方法都失敗，嘗試完全重置：

```bash
# 1. 刪除舊快取
rm -f cache-update-info.json

# 2. 清除環境變數中的 GIST_ID
# 編輯 .env.local，移除 GITHUB_GIST_ID

# 3. 重新建立快取
npm run update-cache

# 4. 將新的 GIST_ID 加回 .env.local

# 5. 重新啟動
npm run dev
```

---

## 📚 相關文件

- [快速設定指南](./QUICK_START_CACHE.md)
- [GitHub Actions 設定](./GITHUB_ACTIONS_SETUP.md)
- [完整快取系統說明](./video-cache-setup.md)
