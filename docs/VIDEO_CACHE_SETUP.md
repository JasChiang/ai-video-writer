# 🎥 影片快取系統：全面設定與優化指南

本文件將深入介紹 AI Video Writer 的影片快取系統，解釋其運作原理、帶來的效益，以及如何進行完整的設定與維護，以實現高效且經濟的 YouTube 影片管理。

## 💡 為何需要影片快取？

YouTube Data API 設有每日配額限制（通常為 10,000 點），每次呼叫 API 搜尋影片列表都會消耗配額。隨著頻道影片數量增長，頻繁的搜尋操作會迅速耗盡配額，導致應用程式功能受限。

影片快取系統旨在解決此問題，提供以下核心優勢：

-   **大幅節省 API 配額**：將影片基本資訊快取後，前端搜尋幾乎不消耗 YouTube API 配額。
-   **無限次搜尋**：在不耗盡配額的情況下，您可以無限次地搜尋、篩選和管理您的影片。
-   **提升搜尋速度**：從本地快取或 Gist 載入影片列表通常比直接呼叫 YouTube API 更快，提供更流暢的用戶體驗。
-   **支援離線搜尋**：部分快取機制支援在無網路連線時進行基本搜尋。

## ⚙️ 系統架構與運作原理

影片快取系統的核心是將您的 YouTube 影片基本資訊（如 `videoId`, `title`, `tags`, `thumbnail` 等）儲存到 GitHub Gist。前端應用程式會從 Gist 載入這些快取資料，並在本地進行搜尋和過濾。

### 運作流程

1.  **快取生成/更新**：
    -   後端服務會定期（或手動觸發）呼叫 YouTube Data API 的 `playlistItems.list` 端點，掃描您的所有影片。
    -   提取每支影片的關鍵資訊（`videoId` 和 `title` 等）。
    -   將這些資訊打包成 JSON 格式，並上傳或更新到指定的 GitHub Gist。
    -   此步驟會消耗 YouTube API 配額，但頻率遠低於每次搜尋。

2.  **前端搜尋**：
    -   前端應用程式啟動時，會嘗試從 GitHub Gist 載入最新的影片快取。
    -   用戶在前端進行搜尋時，應用程式會在本地快取資料中進行過濾，找出匹配的 `videoId`。
    -   只有當用戶需要查看特定影片的詳細資訊（例如描述）時，才會分批（每批 50 個影片）呼叫 YouTube Data API 的 `videos.list` 端點來獲取。

### 配額使用對比 (範例：2000 支影片，搜尋 10 次)

| 操作 | 傳統方式 (每次搜尋呼叫 API) | 使用 Gist 快取 |
| :--- | :-------------------------- | :------------- |
| **初次生成/每日更新快取** | - | 80-160 配額 (依影片數量而定) |
| **每次搜尋 (前端過濾)** | 560 配額 (2000 影片約 40 頁 x 14 配額/頁) | 0 配額 (從 Gist 載入) |
| **載入詳細資訊 (每批 50 影片)** | 8 配額 | 8 配額 |
| **總計 (搜尋 10 次)** | 5600 配額 ❌ | 80 (更新) + 80 (載入詳情) = 160 配額 ✅ |
| **配額節省** | - | **約 97%** |

## 📝 設定步驟

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

### 3. 初次生成影片快取

首次執行時，系統會建立一個新的 Gist 來儲存您的影片快取。

1.  **確保後端伺服器正在運行**：
    ```bash
    npm run server
    ```
2.  **在另一個終端執行快取更新腳本**：
    ```bash
    npm run update-cache
    ```
    執行成功後，您會看到類似以下的輸出，其中包含新生成的 `Gist ID`：
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
2.  **檢查瀏覽器 Console**：您應該會看到類似 `[App] 使用 Gist 快取搜尋` 的訊息。
3.  **確認配額**：檢查您的 YouTube Data API 配額使用情況，應該不會因搜尋影片而增加。

## 🔄 快取更新機制

### 手動更新

您可以隨時執行以下指令來手動更新影片快取：

```bash
npm run update-cache
```

**建議更新頻率**：
-   **頻繁上傳影片**：建議每天更新。
-   **偶爾上傳**：每週更新一次即可。

### 自動化更新 (推薦)

為了確保快取始終保持最新，強烈建議設定 GitHub Actions 每日自動更新。

-   **詳細設定指南**：請參考 [GitHub Actions 自動更新影片快取設定指南](./GITHUB_ACTIONS_SETUP.md)。

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

## 🛠 故障排除

請參考 [問題排除指南](./TROUBLESHOOTING.md) 中的「影片搜尋結果不正確或配額消耗過快」和「Gist 快取載入失敗」等相關章節。

## 📚 相關文件

-   [影片快取功能：快速設定指南](./QUICK_START_CACHE.md)
-   [GitHub Actions 自動更新影片快取設定指南](./GITHUB_ACTIONS_SETUP.md)
-   [取得 YouTube Refresh Token 快速指南](./GET_REFRESH_TOKEN.md)
-   [問題排除指南](./TROUBLESHOOTING.md)

---

**恭喜！** 🎉 您已全面了解並設定好影片快取系統，現在可以高效地管理您的 YouTube 影片了！