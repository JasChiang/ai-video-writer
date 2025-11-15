# 🔧 問題排除指南

本指南旨在協助您診斷並解決使用 AI Video Writer 時可能遇到的常見問題。在尋求進一步協助之前，請先嘗試以下步驟。

## 📋 開始之前：基本檢查

在深入特定問題之前，請先確認以下基本事項：

-   **環境變數**：檢查專案根目錄下的 `.env.local` 檔案，確保所有必要的環境變數（如 `GEMINI_API_KEY`, `YOUTUBE_CLIENT_ID`, `GITHUB_GIST_TOKEN`, `GITHUB_GIST_ID` 等）都已正確設定且沒有拼寫錯誤。
-   **重新啟動**：嘗試完全停止並重新啟動前端和後端伺服器 (`npm run dev:all`)。
-   **瀏覽器快取**：清除瀏覽器快取和網站資料，有時舊的快取會導致前端問題。
-   **日誌檢查**：
    -   **前端日誌**：開啟瀏覽器開發者工具 (F12) 的 Console 頁籤，查看是否有錯誤訊息。
    -   **後端日誌**：查看執行 `npm run server` 或 `npm run dev:all` 的終端機輸出，尋找任何錯誤或警告。
    -   **GitHub Actions 日誌**：如果問題與自動化相關，請前往 GitHub Actions 頁面查看相關 workflow 的詳細日誌。

## ❌ 常見問題與解決方案

### 問題 1：影片搜尋結果不正確或配額消耗過快

**症狀**：
-   搜尋影片時出現「連續多頁未找到匹配影片」的日誌。
-   明明有該關鍵字的影片，卻搜尋不到。
-   YouTube API 配額快速消耗，每次搜尋消耗 100+ 配額。

**原因**：
1.  未正確使用 Gist 快取，系統仍在直接呼叫 YouTube API 進行搜尋。
2.  `GITHUB_GIST_ID` 或 `GITHUB_GIST_TOKEN` 環境變數未正確設定。

**解決方法**：

1.  **確認 Gist 快取設定**：
    -   檢查 `.env.local` 檔案，確保 `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 已填入正確的值。
    -   如果您是首次設定，請參考 [影片快取功能：快速設定指南](./QUICK_START_CACHE.md) 完成 Gist 的建立和 ID 的設定。
2.  **重新啟動開發伺服器**：
    ```bash
    # 停止目前的伺服器 (Ctrl+C)
    # 重新啟動
    npm run dev:all
    ```
3.  **檢查瀏覽器 Console**：
    -   在應用程式中搜尋影片時，瀏覽器 Console 應該顯示 `[App] 使用 Gist 快取搜尋，關鍵字: xxx`。
    -   如果看到 `[App] 未設定 GIST_ID，使用 YouTube API 搜尋（配額成本較高）`，則表示前端未能正確讀取 `GITHUB_GIST_ID`。
4.  **清除 Vite 快取並重建**：
    ```bash
    # 清除 Vite 相關快取
    rm -rf node_modules/.vite

    # 重新啟動開發伺服器
    npm run dev:all
    ```

### 問題 2：Gist 快取載入失敗 (404 錯誤)

**症狀**：
-   後端日誌顯示 `[VideoCache] Gist 載入錯誤: Gist 載入失敗: 404`。
-   前端無法載入影片列表或顯示錯誤。

**原因**：
1.  `.env.local` 中的 `GITHUB_GIST_ID` 錯誤或 Gist 已被刪除。
2.  `GITHUB_GIST_TOKEN` 權限不足或已過期。

**解決方法**：

1.  **檢查 Gist 是否存在**：
    -   前往 `https://gist.github.com/您的GitHub用戶名`，確認您的 Gist 存在且可以訪問。
2.  **重新建立快取**：
    -   如果 Gist ID 錯誤或 Gist 已被刪除，請先從 `.env.local` 中移除 `GITHUB_GIST_ID` 的值。
    -   然後執行 `npm run update-cache` 重新建立 Gist，並將新的 Gist ID 更新到 `.env.local`。
3.  **檢查 GitHub PAT 權限**：
    -   確認用於 `GITHUB_GIST_TOKEN` 的 GitHub Personal Access Token 具有 `gist` 權限。如果權限不足或 token 已過期，請重新生成一個新的 PAT。

### 問題 3：快取搜尋不到最新影片

**症狀**：
-   應用程式使用 Gist 快取搜尋，但返回的影片列表不包含最新上傳的影片。

**原因**：
-   Gist 快取資料過舊，尚未包含最新影片資訊。

**解決方法**：

1.  **手動更新快取**：
    ```bash
    npm run update-cache
    ```
2.  **設定自動更新**：
    -   為了確保快取始終保持最新，建議設定 GitHub Actions 每日自動更新。請參考 [GitHub Actions 自動更新影片快取設定指南](./GITHUB_ACTIONS_SETUP.md)。

### 問題 4：GitHub Actions 執行失敗 (401 Unauthorized)

**症狀**：
-   GitHub Actions workflow 執行失敗，日誌顯示 `401 Unauthorized` 錯誤。

**原因**：
-   `YOUTUBE_REFRESH_TOKEN` 已過期或無效。
-   GitHub Secrets 中的其他 YouTube 相關憑證（`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`）設定錯誤。

**解決方法**：

1.  **檢查 GitHub Secrets**：
    -   前往您的 GitHub repository → `Settings` → `Secrets and variables` → `Actions`。
    -   確認所有必要的 Secrets（`YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_CHANNEL_ID`, `VIDEO_CACHE_GIST_TOKEN`, `VIDEO_CACHE_GIST_ID`）都已正確設定。
2.  **重新取得 Refresh Token**：
    -   如果 `YOUTUBE_REFRESH_TOKEN` 過期或無效，請參考 [取得 YouTube Refresh Token 快速指南](./REFRESH_TOKEN_QUICK_START.md) 重新取得新的 Refresh Token，並更新 GitHub Secrets。

## 🔍 檢查清單

當遇到問題時，請依序檢查以下項目：

### 本地開發環境

-   [ ] `.env.local` 已設定所有必要的環境變數。
-   [ ] `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 正確無誤。
-   [ ] 執行 `npm run test-gist` 測試腳本是否通過。
-   [ ] 瀏覽器 Console 顯示「使用 Gist 快取搜尋」。
-   [ ] 開發伺服器已重新啟動。

### GitHub Actions 環境

-   [ ] GitHub Secrets 中所有必要的變數都已正確設定。
-   [ ] `YOUTUBE_REFRESH_TOKEN` 仍然有效。
-   [ ] Workflow 手動執行是否成功。
-   [ ] Gist 已建立且可訪問。

### 快取資料狀態

-   [ ] 快取資料是否包含最新影片。
-   [ ] Gist 檔案名稱是否符合 `.env.local` 中的 `GITHUB_GIST_FILENAME` 設定。

---

## 📞 需要更多幫助？

如果您嘗試了上述所有方法仍無法解決問題，請提供以下資訊以便我們協助：

-   **詳細的問題描述**：您遇到了什麼問題？何時發生？
-   **重現步驟**：如何觸發這個問題？
-   **錯誤訊息**：提供完整的錯誤日誌（前端 Console、後端終端、GitHub Actions 日誌）。
-   **環境資訊**：您的作業系統、Node.js 版本、Docker 版本（如果使用）。

---

## 📚 相關文件

-   [影片快取功能：快速設定指南](./QUICK_START_CACHE.md)
-   [GitHub Actions 自動更新影片快取設定指南](./GITHUB_ACTIONS_SETUP.md)
-   [取得 YouTube Refresh Token 快速指南](./REFRESH_TOKEN_QUICK_START.md)
-   [完整影片快取系統說明](./video-cache-setup.md)