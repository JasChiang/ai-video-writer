# 如何取得 YouTube Refresh Token（永久有效）

Refresh Token 可以讓系統自動刷新 Access Token，不需要每次手動更新，是自動化更新快取的最佳方案。

---

## 🎯 方法 1：從應用程式本地儲存取得（最簡單）

這是最簡單的方法，直接從你已經登入的應用程式中取得。

### 步驟：

1. **啟動應用程式並登入**
   ```bash
   npm run dev:all
   ```

   這會同時啟動：
   - 前端 Vite 伺服器（端口 3000）
   - 後端 Express 伺服器（端口 3001）

2. **在瀏覽器開啟應用程式**
   ```
   http://localhost:3000
   ```

   **注意**：
   - 前端 UI：http://localhost:3000（在 vite.config.ts 中配置）
   - 後端 API：http://localhost:3001

3. **登入 YouTube 帳號**
   - 點擊「登入 YouTube」按鈕
   - 完成 OAuth 認證

4. **開啟瀏覽器開發者工具**
   - 按 `F12` 或右鍵 →「檢查」
   - 切換到「Console」分頁

5. **執行以下指令取得 Refresh Token**
   ```javascript
   // 取得完整的 token 資訊
   const tokenData = JSON.parse(localStorage.getItem('youtubeContentAssistant.oauthToken'));
   console.log('===== YouTube OAuth Token Info =====');
   console.log('Refresh Token:', tokenData.token.refresh_token);
   console.log('Access Token:', tokenData.token.access_token);
   console.log('Expires At:', new Date(tokenData.expiresAt).toLocaleString());
   console.log('===================================');

   // 複製 Refresh Token
   copy(tokenData.token.refresh_token);
   console.log('✅ Refresh Token 已複製到剪貼簿！');
   ```

6. **Refresh Token 已複製**
   - 格式：`1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 貼到記事本保存

7. **取得 Client Secret**

   你的應用程式已經有 `YOUTUBE_CLIENT_ID`，現在需要取得對應的 `Client Secret`：

   a. 前往 [Google Cloud Console](https://console.cloud.google.com/)

   b. 選擇你的專案

   c. 左側選單：「APIs & Services」→「Credentials」

   d. 找到你的 OAuth 2.0 Client ID（就是你的 `YOUTUBE_CLIENT_ID`）

   e. 點擊進入查看詳情

   f. 複製 `Client Secret`
      - 格式：`GOCSPX-xxxxxxxxxxxxxxxxxxxxx`

8. **設定環境變數**

   在 `.env.local` 新增：
   ```bash
   YOUTUBE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
   ```

9. **測試**
   ```bash
   npm run update-cache
   ```

   應該會看到：
   ```
   🔄 使用 refresh token 取得 access token...
   ✅ Access token 取得成功（有效期限: 3599 秒）
   ```

---

## 🎯 方法 2：使用 OAuth 2.0 Playground（進階）

如果方法 1 不適用，可以使用 Google 提供的 OAuth Playground。

### 步驟：

1. **前往 OAuth 2.0 Playground**

   https://developers.google.com/oauthplayground

2. **設定自己的 OAuth Client**

   點擊右上角齒輪圖示 ⚙️

   勾選：「Use your own OAuth credentials」

   輸入：
   - OAuth Client ID: `你的 YOUTUBE_CLIENT_ID`
   - OAuth Client Secret: `你的 Client Secret`

3. **選擇 YouTube Data API v3**

   在左側 API 列表中找到：
   ```
   YouTube Data API v3
   └─ https://www.googleapis.com/auth/youtube
   ```

   勾選這個 scope

4. **授權 API**

   點擊「Authorize APIs」按鈕

   登入你的 Google 帳號並授權

5. **交換授權碼**

   授權完成後會自動跳轉回來

   點擊「Exchange authorization code for tokens」

6. **複製 Refresh Token**

   在右側會顯示：
   ```json
   {
     "access_token": "ya29.a0...",
     "refresh_token": "1//...",
     "expires_in": 3599,
     "token_type": "Bearer"
   }
   ```

   複製 `refresh_token` 的值

7. **設定環境變數**（同方法 1 的步驟 8）

---

## 🎯 方法 3：從 config.js 取得（如果已經有）

如果你之前已經取得過，可能存在配置文件中。

### 檢查位置：

```javascript
// 檢查前端 localStorage
localStorage.getItem('youtubeContentAssistant.oauthToken')

// 檢查 config 文件
// config.js 或 config/youtube.js
```

---

## 📋 完整設定檢查清單

設定完成後，確認以下環境變數：

```bash
# .env.local 文件

# YouTube 前端（已有）
YOUTUBE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# YouTube 後端（新增）
YOUTUBE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx

# GitHub Gist
GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxxxx
GITHUB_GIST_ID=abc123...（首次執行後取得）
```

---

## 🧪 測試 Refresh Token

### 本地測試：

```bash
npm run server
npm run update-cache
```

成功的輸出：
```
========================================
🚀 開始更新影片快取到 Gist
========================================

✅ 環境變數檢查通過
   - Channel ID: UCxxxxxxxxxxxxxxxxxx
   - Gist ID: abc123...
   - Token 類型: Refresh Token (自動刷新)
   - Force Update: false

🔄 使用 refresh token 取得 access token...
✅ Access token 取得成功（有效期限: 3599 秒）

📡 正在連接到 API...
...
✅ 快取更新成功！
```

---

## 🔒 GitHub Secrets 設定

在 GitHub 設定以下 Secrets（取代舊的 `YOUTUBE_ACCESS_TOKEN`）：

| Secret 名稱 | 值 | 說明 |
|------------|-----|------|
| `YOUTUBE_REFRESH_TOKEN` | `1//xxxxxx...` | Refresh Token（永久有效） |
| `YOUTUBE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | OAuth Client ID |
| `YOUTUBE_CLIENT_SECRET` | `GOCSPX-xxxxx` | OAuth Client Secret |
| `YOUTUBE_CHANNEL_ID` | `UCxxxxxxxxxxxxxxxxxx` | 你的頻道 ID |
| `GITHUB_GIST_TOKEN` | `ghp_xxxxxx` | GitHub Token |
| `GITHUB_GIST_ID` | `abc123...` | Gist ID |

---

## ⚠️ 重要提醒

### Refresh Token 的特性：

1. **永久有效**：除非被手動撤銷
2. **不會過期**：可以一直用來取得新的 Access Token
3. **需妥善保管**：具有完整的帳號權限，不要洩漏

### 安全建議：

- ✅ 使用 GitHub Secrets 儲存
- ✅ 不要 commit 到 Git
- ✅ 定期檢查 Google 授權列表
- ❌ 不要分享給他人
- ❌ 不要寫在程式碼中

### Refresh Token 會失效的情況：

- 用戶手動撤銷授權
- 用戶修改密碼
- 用戶刪除 Google 帳號
- Google 安全性政策變更

如果失效，重新執行方法 1 或方法 2 即可。

---

## 🎉 完成！

現在你的系統可以：
- ✅ 每天自動更新快取
- ✅ Token 自動刷新，永久有效
- ✅ 不需要手動更新 token
- ✅ GitHub Actions 全自動運行

**配額使用**：
- 每日自動更新：80-160 配額
- 前端搜尋：0 配額
- 完全自動化，無需人工介入！

---

## 🛠 故障排除

### 問題 1: Refresh Token 無效

**症狀**：
```
❌ Token 處理失敗: invalid_grant
```

**解決方式**：
1. 重新從應用程式登入取得新的 Refresh Token
2. 確認 Client ID 和 Client Secret 正確
3. 檢查 Google 授權列表是否有撤銷

### 問題 2: Client Secret 不正確

**症狀**：
```
❌ Token 處理失敗: unauthorized_client
```

**解決方式**：
1. 前往 Google Cloud Console 確認 Client Secret
2. 確認使用的是同一個 OAuth Client

### 問題 3: GitHub Actions 執行失敗

**解決方式**：
1. 檢查 GitHub Secrets 是否都設定正確
2. 確認 Secret 名稱沒有打錯
3. 查看 Actions 日誌中的詳細錯誤訊息

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查錯誤訊息
2. 確認所有環境變數都正確設定
3. 嘗試本地測試 `npm run update-cache`
4. 查看詳細日誌找出問題
