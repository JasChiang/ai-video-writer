# 🚀 部署 AI Video Writer 到 Render

本指南將提供將 AI Video Writer 應用程式部署到 [Render](https://render.com/) 平台的詳細步驟。Render 是一個雲端平台，提供自動化部署、擴展和管理應用程式的服務。

## 💡 為何選擇 Render？

-   **自動化部署**：與 GitHub 整合，每次 Push 程式碼後自動部署新版本。
-   **簡單易用**：無需複雜的伺服器設定，專注於開發。
-   **支援 Node.js & Vite**：原生支援本專案的技術棧。
-   **環境變數管理**：安全地管理 API 金鑰和敏感資料。
-   **免費方案**：提供免費額度，適合個人測試和小型專案。

## 📋 部署前準備

在開始部署之前，請確保您已準備好以下項目：

### 必備項目

1.  **Render 帳號**：前往 [Render 官網](https://render.com/) 免費註冊。
2.  **GitHub 帳號**：您的專案程式碼應託管在 GitHub 上。
3.  **Google Gemini API Key**：用於 AI 內容生成。
4.  **YouTube OAuth Client ID**：用於 YouTube 權限驗證。
5.  **YouTube OAuth Client Secret**：與 Client ID 配對，用於後端刷新 Access Token。
6.  **YouTube Refresh Token**：用於後端自動刷新 Access Token，確保自動化任務長期運行。

### 選填項目

-   **Notion API Token / Database ID**：若需要整合 Notion 發佈功能。
-   **GitHub Personal Access Token (PAT)**：若需要自訂模板或 GitHub Actions 自動化。

## 🛠️ 部署步驟

### 步驟 1：連接 GitHub Repository

1.  登入 [Render Dashboard](https://dashboard.render.com/)。
2.  點擊 **「New +」** → **「Web Service」**。
3.  選擇您的 GitHub Repository。如果您的專案是私有的，請確保 Render 已獲得存取權限。
4.  點擊 **「Connect」**。

### 步驟 2：設定 Web Service

填寫以下服務配置：

| 欄位 | 值 | 說明 |
| :--- | :--- | :--- |
| **Name** | `ai-video-writer` (或您喜歡的名稱) | 您的服務名稱，將用於 Render URL。 |
| **Region** | 選擇離您用戶最近的區域 | 建議選擇 `Singapore` (新加坡) 以獲得較低的延遲。 |
| **Branch** | `main` (或您的主要分支) | Render 將監聽此分支的 Push 事件。 |
| **Runtime** | `Node` | 專案的運行環境。 |
| **Build Command** | `npm install && npm run build` | 應用程式的建置命令。 |
| **Start Command** | `node server.js` | 應用程式的啟動命令。 |
| **Instance Type** | `Free` (或 `Starter`) | 建議先從 `Free` 方案開始測試。 |

> **提示**：`Free` 方案的服務在 15 分鐘無請求後會進入休眠，下次請求需要冷啟動（約 30 秒）。

### 步驟 3：設定環境變數

在 Render Service 頁面，前往 **「Environment」** 分頁，逐一新增以下變數。

#### 核心環境變數

| Key | Value | 說明 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `AIzaSy...` | 您的 Google Gemini API Key。 |
| `YOUTUBE_CLIENT_ID` | `12345-xxx.apps.googleusercontent.com` | 您的 YouTube OAuth Client ID。 |
| `YOUTUBE_CLIENT_SECRET` | `GOCSPX-xxx` | 您的 YouTube OAuth Client Secret。 |
| `YOUTUBE_REFRESH_TOKEN` | `1//0xxx` | 您的 YouTube Refresh Token。 |
| `YOUTUBE_CHANNEL_ID` | `UCxxx` | 您的 YouTube 頻道 ID。 |
| `FRONTEND_URL` | `https://YOUR_RENDER_URL.onrender.com` | Render 部署後會自動生成一個 URL，請替換為您的實際 URL。 |
| `VITE_SERVER_BASE_URL` | `https://YOUR_RENDER_URL.onrender.com` | 前端呼叫後端的基礎 URL。 |
| `VITE_API_URL` | `https://YOUR_RENDER_URL.onrender.com/api` | 前端呼叫後端 API 的 URL。 |
| `PORT` | `10000` (Render 預設) | Render 會自動設定 `PORT` 變數，通常無需手動設定。 |
| `FILE_RETENTION_DAYS` | `7` | 暫存檔案的保留天數，預設 7 天。 |

> **重要**：`FRONTEND_URL`, `VITE_SERVER_BASE_URL`, `VITE_API_URL` 必須與 Render 給您的服務 URL 完全一致，否則會導致 CORS 錯誤。

#### 選填環境變數 (Notion 整合)

**方式 1：使用 Internal Integration Token (適合個人使用)**

| Key | Value | 說明 |
| :--- | :--- | :--- |
| `NOTION_API_TOKEN` | `secret_...` | 您的 Notion Internal Integration Token。 |
| `NOTION_DATABASE_ID` | `32字元ID` | 預設的 Notion 資料庫 ID。 |
| `NOTION_TITLE_PROPERTY` | `Name` (預設值) | Notion 資料庫中的標題欄位名稱。 |

**方式 2：使用 OAuth (適合多用戶，需同時設定以下三個變數)**

| Key | Value | 說明 |
| :--- | :--- | :--- |
| `NOTION_CLIENT_ID` | `你的 OAuth Client ID` | Notion OAuth 應用程式的 Client ID。 |
| `NOTION_CLIENT_SECRET` | `你的 OAuth Client Secret` | Notion OAuth 應用程式的 Client Secret。 |
| `NOTION_REDIRECT_URI` | `https://YOUR_RENDER_URL.onrender.com/api/notion/callback` | Notion OAuth 回調網址（注意路徑是 `/api/notion/callback`）。 |

> **注意**：兩種方式擇一使用即可。OAuth 方式不需要設定 `NOTION_API_TOKEN`，token 會在使用者授權後動態取得。

### 步驟 4：部署應用程式

1.  設定完所有環境變數後，點選 **「Save Changes」**。
2.  Render 將自動開始部署流程：
    -   **Install Dependencies**：安裝 npm 套件。
    -   **Build**：執行 `npm run build` 建置前端應用。
    -   **Start**：執行 `node server.js` 啟動後端服務。
3.  您可以在 **「Logs」** 分頁查看即時部署日誌。成功啟動後，您會看到類似 `Server running at http://0.0.0.0:10000` 的訊息。

### 步驟 5：設定自訂模板 (選填)

若您需要使用組織專屬的文章模板，請參考 [自訂模板使用指南](./CUSTOM_TEMPLATES.md)。

簡要步驟：
1.  建立 `custom-templates.json` 檔案。
2.  上傳到 GitHub Secret Gist。
3.  在 Render 環境變數中新增 `CUSTOM_TEMPLATE_URL` 和 `CUSTOM_TEMPLATE_TOKEN`。
4.  儲存並重新部署服務。

## ✅ 驗證部署

1.  **開啟應用程式**：前往您的 Render 服務 URL (`https://YOUR_RENDER_URL.onrender.com`)。
2.  **測試 YouTube 登入**：點選「Sign in with Google」，確認 OAuth 流程正常。
3.  **測試內容生成**：選擇一部影片，點選「生成文章」或「生成中繼資料」，檢查功能是否正常。
4.  **檢查日誌**：在 Render Dashboard 的「Logs」分頁確認沒有錯誤訊息，API 請求正常回應。

## 🛠️ 常見問題與故障排除

### Q1: 部署失敗，顯示 "Build failed"？

**A:** 檢查 Render 的「Logs」分頁中的錯誤訊息。常見原因包括 `npm install` 失敗（`package.json` 配置錯誤）或 `npm run build` 失敗（Vite 設定或相依套件問題）。

### Q2: 應用程式啟動後顯示 CORS 錯誤？

**A:** 確保以下環境變數與您的 Render 服務 URL 完全一致：
-   `FRONTEND_URL`
-   `VITE_SERVER_BASE_URL`
-   `VITE_API_URL`
-   請注意協議必須是 `https://`，且 URL 末尾不應有多餘的斜線。

### Q3: YouTube OAuth 登入失敗？

**A:** 在 Google Cloud Console 中，編輯您的 OAuth Client ID 憑證：
1.  在 **「已授權的 JavaScript 來源」** 中新增您的 Render 服務 URL (`https://YOUR_RENDER_URL.onrender.com`)。
2.  在 **「已授權的重新導向 URI」** 中新增您的 Render 服務 URL (`https://YOUR_RENDER_URL.onrender.com`)。

### Q4: Gemini API 請求失敗？

**A:** 檢查：
-   `GEMINI_API_KEY` 環境變數是否正確。
-   您的 Google Cloud 專案是否已啟用 `Generative Language API`。
-   是否超過 Gemini API 的配額限制。

### Q5: 應用程式休眠 (Free 方案)？

**A:** Render 的 Free 方案服務在 15 分鐘無請求後會進入休眠狀態，下次請求需要約 30 秒的冷啟動時間。若要避免休眠，請考慮升級到 Render 的 Starter 方案。

## 💰 成本估算

### Free 方案

-   **費用**：$0/月。
-   **限制**：每月 750 小時運行時間，15 分鐘無請求後休眠，100 GB 頻寬。
-   **適用**：個人測試、小型專案。

### Starter 方案

-   **費用**：$7/月。
-   **優勢**：無休眠限制，更高的 CPU 與記憶體，更多頻寬。
-   **適用**：正式使用、團隊協作。

### 其他潛在成本

-   **Google Gemini API**：視使用量計費（前 60 次請求/分鐘免費）。
-   **GitHub**：免費或 Pro 方案即可。
-   **自訂網域** (選填)：約 $10-15/年。

## 📚 相關文件

-   [自訂模板使用指南](./CUSTOM_TEMPLATES.md)
-   [環境變數設定範例](../.env.example)
-   [Render 官方文件](https://render.com/docs)

---

如有任何問題，歡迎開 Issue 討論！