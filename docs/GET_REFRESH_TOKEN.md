# 🔑 取得 YouTube Refresh Token (永久有效)

本指南將詳細說明如何取得 YouTube Refresh Token，這是實現 YouTube API 自動化（例如 GitHub Actions 自動更新影片快取）的關鍵。Refresh Token 允許系統自動刷新 Access Token，無需手動介入，確保您的自動化流程永久有效。

---

## 💡 為什麼需要 Refresh Token？

-   **Access Token 會過期**：YouTube Access Token 通常在 1 小時後失效。
-   **Refresh Token 永久有效**：除非被手動撤銷，Refresh Token 可以用來持續取得新的 Access Token。
-   **實現自動化**：是 GitHub Actions 等自動化工具能夠長期運行的基礎。

---

## 🎯 方法 1：從已登入的應用程式取得 (推薦且最簡單)

這是最直接的方法，直接從您已登入的 AI Video Writer 應用程式中提取 Refresh Token。

### 步驟 1：啟動應用程式並登入 YouTube

1.  **啟動應用程式**：
    ```bash
    npm run dev:all
    ```
    這會同時啟動前端 (port 3000) 和後端 (port 3001)。
2.  **開啟瀏覽器**：造訪 `http://localhost:3000`。
3.  **登入 YouTube**：點擊「Sign in with Google」按鈕，完成 OAuth 認證流程。

### 步驟 2：從瀏覽器開發者工具取得 Refresh Token

1.  **開啟開發者工具**：在瀏覽器中按 `F12` 或右鍵點擊頁面選擇「檢查」，然後切換到「Console」分頁。
2.  **執行指令**：在 Console 中輸入並執行以下 JavaScript 程式碼：
    ```javascript
    const tokenData = JSON.parse(localStorage.getItem('youtubeContentAssistant.oauthToken'));
    if (tokenData && tokenData.token && tokenData.token.refresh_token) {
        copy(tokenData.token.refresh_token);
        console.log('✅ Refresh Token 已複製到剪貼簿！');
        console.log('Refresh Token 範例:', tokenData.token.refresh_token.substring(0, 20) + '...');
    } else {
        console.error('❌ 未找到 Refresh Token。請確認已成功登入 YouTube。');
    }
    ```
3.  **複製 Refresh Token**：您的 Refresh Token (格式：`1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) 將被複製到剪貼簿。請妥善保存。

### 步驟 3：取得 Client Secret

您的應用程式已經有 `YOUTUBE_CLIENT_ID`，現在需要取得對應的 `Client Secret`。

1.  **前往 Google Cloud Console**：[https://console.cloud.google.com/](https://console.cloud.google.com/)
2.  **選擇您的專案**。
3.  **導航至憑證**：在左側選單中選擇「API 和服務」→「憑證」。
4.  **找到 OAuth 2.0 用戶端 ID**：找到與您的 `YOUTUBE_CLIENT_ID` 相符的 OAuth 2.0 用戶端 ID。
5.  **複製 Client Secret**：點擊該用戶端 ID 進入詳情頁面，複製 `Client Secret` (格式：`GOCSPX-xxxxxxxxxxxxxxxxxxxxx`)。請妥善保存。

---

## 🎯 方法 2：使用 OAuth 2.0 Playground (進階替代方案)

如果方法 1 不適用，您可以使用 Google 提供的 OAuth 2.0 Playground。

### 步驟 1：前往 OAuth 2.0 Playground

-   開啟網頁：[https://developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)

### 步驟 2：設定自己的 OAuth Client 憑證

1.  點擊右上角的齒輪圖示 ⚙️。
2.  勾選「Use your own OAuth credentials」。
3.  輸入您的 `YOUTUBE_CLIENT_ID` 和 `Client Secret`。

### 步驟 3：選擇 YouTube Data API 範圍 (Scopes)

1.  在左側的「Step 1: Select & authorize APIs」中，找到 `YouTube Data API v3`。
2.  展開它並勾選 `https://www.googleapis.com/auth/youtube` 範圍。

### 步驟 4：授權 API

1.  點擊「Authorize APIs」按鈕。
2.  登入您的 Google 帳號並授權。

### 步驟 5：交換授權碼以取得 Token

1.  授權完成後，頁面會自動跳轉回 Playground。
2.  點擊「Exchange authorization code for tokens」按鈕。
3.  在右側的「Request / Response」區域，您會看到包含 `refresh_token` 的 JSON 回應。複製 `refresh_token` 的值。

---

## 📝 設定環境變數

取得 Refresh Token 和 Client Secret 後，您需要將它們設定為環境變數。

### 本地開發環境 (`.env.local`)

在專案根目錄下的 `.env.local` 檔案中，新增或更新以下變數：

```env
# YouTube OAuth 憑證 (用於後端自動刷新 Access Token)
YOUTUBE_REFRESH_TOKEN="YOUR_REFRESH_TOKEN_HERE"
YOUTUBE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com" # 應已存在
YOUTUBE_CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"

# 您的 YouTube 頻道 ID (用於快取更新)
YOUTUBE_CHANNEL_ID="UCxxxxxxxxxxxxxxxxxx" # 替換為您的頻道 ID
```
將 `YOUR_REFRESH_TOKEN_HERE` 和 `YOUR_CLIENT_SECRET_HERE` 替換為您實際取得的值。

### GitHub Actions Secrets

如果您計劃使用 GitHub Actions 自動更新影片快取，則需要將這些憑證設定為 GitHub Secrets。

1.  前往您的 GitHub repository → `Settings` → `Secrets and variables` → `Actions`。
2.  點擊「New repository secret」。
3.  新增以下 Secrets：

| Secret 名稱 | 值 | 說明 |
| :---------- | :--- | :--- |
| `YOUTUBE_REFRESH_TOKEN` | 您的 Refresh Token | 永久有效，用於自動刷新 Access Token |
| `YOUTUBE_CLIENT_ID` | 您的 OAuth Client ID | 從 Google Cloud Console 取得 |
| `YOUTUBE_CLIENT_SECRET` | 您的 OAuth Client Secret | 從 Google Cloud Console 取得 |
| `YOUTUBE_CHANNEL_ID` | 您的 YouTube 頻道 ID | 格式：`UCxxxxxxxxxxxxxxxxxx` |

---

## 🧪 測試 Refresh Token

設定完成後，您可以執行以下指令來測試 Refresh Token 是否能成功取得新的 Access Token：

```bash
npm run update-cache
```
如果成功，您會看到類似以下的日誌：
```
🔄 使用 refresh token 取得 access token...
✅ Access token 取得成功（有效期限: 3599 秒）
```

---

## 🔒 安全注意事項

-   **Refresh Token 具有高權限**：它允許無限期地取得新的 Access Token，因此必須像密碼一樣妥善保管。
-   **切勿公開**：絕對不要將 Refresh Token、Client ID 或 Client Secret 硬編碼在程式碼中，或提交到版本控制系統。
-   **使用 Secrets**：在生產環境或自動化流程中，務必使用環境變數或 Secrets 管理這些憑證。
-   **定期檢查**：定期檢查 Google 帳戶的授權應用程式列表，撤銷不再使用的授權。

### Refresh Token 會失效的情況

Refresh Token 通常永久有效，但在以下情況可能會失效：
-   用戶手動撤銷了對應用程式的授權。
-   用戶更改了 Google 帳戶密碼。
-   Google 安全策略發生變更。
-   Refresh Token 未被使用超過 6 個月。

如果 Refresh Token 失效，您需要重新執行上述步驟來取得新的 Refresh Token。

---

## 🛠 故障排除

### 問題 1：`invalid_grant` 錯誤

**症狀**：
-   嘗試使用 Refresh Token 時，日誌顯示 `invalid_grant` 錯誤。

**原因**：
-   Refresh Token 無效、已過期或已被撤銷。
-   `YOUTUBE_CLIENT_ID` 或 `YOUTUBE_CLIENT_SECRET` 不正確。

**解決方法**：
1.  **重新取得 Refresh Token**：再次執行方法 1 或方法 2 取得新的 Refresh Token。
2.  **確認憑證**：仔細檢查 `YOUTUBE_CLIENT_ID` 和 `YOUTUBE_CLIENT_SECRET` 是否與 Google Cloud Console 中的憑證完全一致。

### 問題 2：`unauthorized_client` 錯誤

**症狀**：
-   日誌顯示 `unauthorized_client` 錯誤。

**原因**：
-   `YOUTUBE_CLIENT_SECRET` 不正確或與 `YOUTUBE_CLIENT_ID` 不匹配。

**解決方法**：
1.  **確認 Client Secret**：前往 Google Cloud Console，確認您使用的 `Client Secret` 與 `YOUTUBE_CLIENT_ID` 是配對的。

---

## 📚 相關文件

-   [GitHub Actions 自動更新影片快取設定指南](./GITHUB_ACTIONS_SETUP.md)
-   [影片快取功能：快速設定指南](./QUICK_START_CACHE.md)