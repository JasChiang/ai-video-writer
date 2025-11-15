# 🚀 影片快取功能：快速設定指南

本指南將引導您快速設定 AI Video Writer 的影片快取功能，有效節省 YouTube API 配額。

## 💡 為何需要影片快取？

YouTube Data API 設有每日配額限制（通常為 10,000 點）。每次搜尋影片列表都會消耗配額。透過快取，您可以：

-   **大幅節省配額**：每次從快取搜尋影片幾乎不消耗 YouTube API 配額。
-   **無限次搜尋**：在不耗盡配額的情況下，無限次地搜尋和篩選您的影片。
-   **提升速度**：從本地快取載入影片列表通常比呼叫 API 更快。

## 📝 本地快取設定步驟

### 1. 取得 GitHub Personal Access Token (PAT)

影片快取會儲存在 GitHub Gist 上。您需要一個具有 `gist` 權限的 PAT。

1.  前往 [GitHub Personal Access Tokens](https://github.com/settings/tokens)。
2.  點擊 `Generate new token (classic)`。
3.  **Note**: 輸入 `YouTube Video Cache`。
4.  **Expiration**: 建議選擇 `No expiration` 或較長的期限。
5.  **Select scopes**: 勾選 `gist` (Create gists)。
6.  點擊 `Generate token`。
7.  **⚠️ 重要**：立即複製顯示的 token (格式：`ghp_xxxxxxxxxxxxxx`)，因為離開頁面後將無法再次查看。

### 2. 設定環境變數

編輯專案根目錄下的 `.env.local` 檔案，加入以下變數：

```env
# GitHub Gist 相關設定 (用於影片快取)
GITHUB_GIST_TOKEN="YOUR_GITHUB_PAT_HERE"
GITHUB_GIST_ID="" # 首次執行後會自動生成並填寫
GITHUB_GIST_FILENAME="youtube-videos-cache.json" # 可選，預設檔名
```
將 `YOUR_GITHUB_PAT_HERE` 替換為您在步驟 1 中取得的 GitHub PAT。

### 3. 首次建立影片快取

首次執行時，系統會建立一個新的 Gist 來儲存您的影片快取。

1.  **確保後端伺服器正在運行**：
    ```bash
    npm run server
    ```
2.  **在另一個終端執行快取更新腳本**：
    ```bash
    npm run update-cache
    ```

    執行成功後，您會看到類似以下的輸出：
    ```
    ✅ 快取更新成功！
    ========================================
    📊 總影片數：100
    🆔 Gist ID：abc123def456...
    🔗 Gist URL：https://gist.github.com/your_username/abc123def456
    📅 更新時間：2024-01-01T02:00:00.000Z
    ========================================

    ⚠️  重要提示：
    這是首次建立 Gist，請將以下 Gist ID 加入環境變數：

    GITHUB_GIST_ID=abc123def456...
    ```

### 4. 更新 `GITHUB_GIST_ID` 環境變數

複製上一步輸出中的 `Gist ID`，並更新 `.env.local` 檔案：

```env
GITHUB_GIST_ID="abc123def456..." # 替換為您實際的 Gist ID
```

### 5. 重新啟動前端應用

為了讓前端應用程式載入新的 `GITHUB_GIST_ID`，請重新啟動前端開發伺服器：

```bash
# 停止目前的開發伺服器 (Ctrl+C)
# 重新啟動
npm run dev
```

## ✅ 驗證快取設定

1.  **測試搜尋**：在應用程式的影片列表或文章工作區搜尋影片。
2.  **檢查瀏覽器 Console**：您應該會看到類似 `[ArticleWorkspace] 使用 Gist 快取搜尋` 的訊息。
3.  **確認配額**：檢查您的 YouTube Data API 配額使用情況，應該不會因搜尋影片而增加。

## 🔄 手動更新快取

您可以隨時執行以下指令來手動更新影片快取：

```bash
npm run update-cache
```

**建議更新頻率**：
-   **頻繁上傳影片**：建議每天更新。
-   **偶爾上傳**：每週更新一次即可。
-   **自動化**：設定 [GitHub Actions 自動更新](#自動化快取更新) 以實現每日自動更新。

## 🤖 自動化快取更新 (選填)

若要設定 GitHub Actions 每日自動更新影片快取，請參考 [GitHub Actions 設定指南](../GITHUB_ACTIONS_SETUP.md)。

## 📊 快取資料結構

快取中每支影片的資料結構範例如下：

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "影片標題",
  "tags": ["標籤1", "標籤2", "標籤3"],
  "categoryId": "28",
  "viewCount": 12345,
  "likeCount": 678,
  "commentCount": 90,
  "publishedAt": "2024-01-01T00:00:00Z",
  "thumbnail": "https://i.ytimg.com/vi/...",
  "privacyStatus": "public"
}
```
**注意**：為節省 Gist 空間和 API 請求，影片描述 (description) 預設不包含在快取中。需要時會即時從 YouTube API 抓取。

## 🐛 常見問題

### Q: 搜尋不到最新的影片？
**A**: 您需要手動更新快取 (`npm run update-cache`)，或等待 GitHub Actions 自動更新。

### Q: 出現 404 錯誤？
**A**: 請檢查 `.env.local` 中的 `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 是否正確設定。

### Q: 私人影片也會被快取嗎？
**A**: 是的！只要您使用 OAuth 登入，所有您有權限訪問的影片（包括私人、未列出）都會被快取。

### Q: 快取會過期嗎？
**A**: 快取本身不會過期。它會永久儲存在您的 Gist 中，直到您手動更新或刪除。

### Q: 可以分享 Gist 給別人嗎？
**A**: 不建議。為保護您的頻道資訊，請將 Gist 設為私人。

---

**恭喜！** 🎉 您已成功設定影片快取功能，現在可以開始無限次搜尋您的 YouTube 影片了！