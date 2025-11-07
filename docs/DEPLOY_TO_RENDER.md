# 部署到 Render 指南

本指南將協助你將 AI Video Writer 部署到 Render 平台，供團隊或個人使用。

## 📋 目錄

- [為什麼選擇 Render？](#為什麼選擇-render)
- [部署前準備](#部署前準備)
- [步驟一：建立 Render 帳號](#步驟一建立-render-帳號)
- [步驟二：連接 GitHub Repository](#步驟二連接-github-repository)
- [步驟三：建立 Web Service](#步驟三建立-web-service)
- [步驟四：設定環境變數](#步驟四設定環境變數)
- [步驟五：部署應用程式](#步驟五部署應用程式)
- [步驟六：設定自訂模板（選填）](#步驟六設定自訂模板選填)
- [驗證部署](#驗證部署)
- [常見問題](#常見問題)
- [成本估算](#成本估算)

---

## 為什麼選擇 Render？

- **簡單易用**：自動化部署，無需複雜設定
- **免費方案**：提供免費額度供個人或小團隊使用
- **支援 Node.js + Vite**：原生支援本專案技術棧
- **環境變數管理**：安全管理 API 金鑰與機密資料
- **自動重新部署**：Git push 後自動部署新版本

---

## 部署前準備

### 必備項目

1. **Render 帳號**（免費註冊）
2. **GitHub 帳號**（連接 Repository）
3. **Google Gemini API Key**（文章生成）
4. **YouTube OAuth Client ID**（影片權限驗證）

### 選填項目

5. **Notion API Token**（若需要 Notion 整合）
6. **GitHub Secret Gist**（若需要自訂模板）
7. **GitHub Personal Access Token**（存取 Secret Gist）

---

## 步驟一：建立 Render 帳號

1. 前往 https://render.com/
2. 點選 **「Get Started for Free」**
3. 選擇使用 **GitHub 帳號登入**（推薦）
4. 授權 Render 存取你的 GitHub Repositories

---

## 步驟二：連接 GitHub Repository

### 選項 A：使用原始專案（Fork）

1. 前往本專案 GitHub 頁面
2. 點選右上角 **「Fork」** 按鈕
3. Fork 到你的 GitHub 帳號
4. 在 Render 控制台連接你的 Fork

### 選項 B：建立私有 Repository

1. 下載或 clone 本專案
2. 建立新的 Private Repository
3. Push 程式碼到你的 Repository
4. 在 Render 控制台連接你的 Repository

---

## 步驟三：建立 Web Service

### 1. 建立新 Service

1. 登入 Render Dashboard
2. 點選 **「New +」** → **「Web Service」**
3. 選擇你的 GitHub Repository
4. 點選 **「Connect」**

### 2. 設定 Service

填入以下設定：

| 欄位 | 值 |
|-----|---|
| **Name** | `ai-video-writer`（或你喜歡的名稱） |
| **Region** | `Singapore`（建議選擇亞洲節點） |
| **Branch** | `main`（或你的主要分支） |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node server.js` |

### 3. 選擇方案

- **Free**：適合個人測試與小型團隊（有限制）
- **Starter ($7/月)**：適合正式使用，無閒置限制

> **提示**：Free 方案的 Service 在 15 分鐘無請求後會進入休眠，下次請求需要冷啟動（約 30 秒）。

---

## 步驟四：設定環境變數

在 Render Service 頁面，前往 **「Environment」** 分頁。

### 必填環境變數

點選 **「Add Environment Variable」**，逐一新增以下變數：

#### 1. Gemini API Key

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `AIzaSy...`（你的 Gemini API Key） |

- 取得方式：https://makersuite.google.com/app/apikey

#### 2. YouTube OAuth Client ID

| Key | Value |
|-----|-------|
| `YOUTUBE_CLIENT_ID` | `12345-xxx.apps.googleusercontent.com` |

- 取得方式：https://console.cloud.google.com/apis/credentials

#### 3. 前端與後端 URL

Render 部署後會給你一個網址，格式如：`https://ai-video-writer-xxxx.onrender.com`

假設你的網址是 `https://ai-video-writer-abc.onrender.com`：

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | `https://ai-video-writer-abc.onrender.com` |
| `VITE_SERVER_BASE_URL` | `https://ai-video-writer-abc.onrender.com` |
| `VITE_API_URL` | `https://ai-video-writer-abc.onrender.com/api` |

> **重要**：這些 URL 必須與 Render 給你的網址一致，否則會有 CORS 錯誤。

#### 4. Port（選填）

Render 會自動設定 `PORT` 變數，通常不需要手動設定。

---

### 選填環境變數

#### Notion 整合（若需要）

| Key | Value | 說明 |
|-----|-------|------|
| `NOTION_API_TOKEN` | `secret_...` | Notion Internal Integration Token |
| `NOTION_DATABASE_ID` | `32字元ID` | 預設資料庫 ID |
| `NOTION_REDIRECT_URI` | `https://你的網址.onrender.com/api/notion/callback` | OAuth 回調網址 |

#### 檔案管理

| Key | Value |
|-----|-------|
| `FILE_RETENTION_DAYS` | `7` |

---

## 步驟五：部署應用程式

### 1. 儲存設定

設定完環境變數後，點選 **「Save Changes」**。

### 2. 開始部署

Render 會自動開始部署：

1. **Install Dependencies**：安裝 npm 套件（約 1-2 分鐘）
2. **Build**：執行 `npm run build`（約 1-2 分鐘）
3. **Start**：執行 `node server.js`

### 3. 監控部署進度

在 **「Logs」** 分頁查看即時日誌。

**成功部署的訊息**：
```
Server running at http://0.0.0.0:10000
Server is ready to accept requests
```

**部署完成後**，你的應用程式會在：
```
https://ai-video-writer-abc.onrender.com
```

---

## 步驟六：設定自訂模板（選填）

若需要使用組織專屬的文章模板，請參考 [自訂模板使用指南](./CUSTOM_TEMPLATES.md)。

### 簡要步驟

1. 建立 `custom-templates.json` 檔案
2. 上傳到 GitHub Secret Gist
3. 在 Render 環境變數新增：

| Key | Value |
|-----|-------|
| `CUSTOM_TEMPLATE_URL` | `https://gist.githubusercontent.com/.../custom-templates.json` |
| `CUSTOM_TEMPLATE_TOKEN` | `ghp_...`（GitHub Personal Access Token） |

4. 儲存並重新部署

---

## 驗證部署

### 1. 開啟應用程式

前往你的 Render 網址：`https://ai-video-writer-abc.onrender.com`

### 2. 測試功能

- 點選 **「登入 YouTube」**，確認 OAuth 流程正常
- 選擇一部影片，點選 **「生成文章」**
- 檢查文章是否正確生成

### 3. 檢查日誌

在 Render **「Logs」** 分頁確認：

- 沒有錯誤訊息
- API 請求正常回應
- 若有設定自訂模板，確認載入成功：
  ```
  [Prompts] ✅ 載入專屬模板成功
  ```

---

## 常見問題

### Q1: 部署失敗，顯示 "Build failed"？

**A:** 檢查 **「Logs」** 分頁的錯誤訊息。常見原因：
- `npm install` 失敗：檢查 `package.json` 是否正確
- `npm run build` 失敗：檢查 Vite 設定與相依套件

### Q2: 應用程式啟動後顯示 CORS 錯誤？

**A:** 確認環境變數設定：
- `FRONTEND_URL` 必須與 Render 網址完全一致
- 不要有多餘的斜線（`/`）
- 協議必須是 `https://`（Render 預設使用 HTTPS）

### Q3: YouTube OAuth 登入失敗？

**A:** 檢查 Google Cloud Console 設定：
1. 前往 https://console.cloud.google.com/apis/credentials
2. 編輯你的 OAuth Client ID
3. 在 **「已授權的 JavaScript 來源」** 新增：
   ```
   https://ai-video-writer-abc.onrender.com
   ```
4. 在 **「已授權的重新導向 URI」** 新增：
   ```
   https://ai-video-writer-abc.onrender.com
   ```

### Q4: Gemini API 請求失敗？

**A:** 檢查：
- `GEMINI_API_KEY` 是否正確
- API Key 是否已啟用 Gemini API
- 是否超過 API 配額限制

### Q5: 應用程式休眠（Free 方案）？

**A:** Free 方案的限制：
- 15 分鐘無請求後進入休眠
- 下次請求需要冷啟動（約 30 秒）
- 解決方式：
  - 升級到 Starter 方案（$7/月）
  - 或使用 Uptime Monitor 定期 ping（不推薦）

### Q6: 如何更新應用程式？

**A:** Render 支援自動部署：
1. Push 新版本到 GitHub
2. Render 會自動偵測並重新部署
3. 或在 Render 控制台手動點選 **「Manual Deploy」**

### Q7: 如何查看應用程式狀態？

**A:** 在 Render Dashboard：
- **「Logs」**：即時日誌
- **「Metrics」**：CPU、記憶體使用率
- **「Events」**：部署歷史與事件

---

## 成本估算

### Free 方案

- **費用**：$0/月
- **限制**：
  - 750 小時/月的執行時間
  - 15 分鐘無請求後休眠
  - 100 GB 頻寬/月
- **適合**：個人測試、小型專案

### Starter 方案

- **費用**：$7/月
- **優勢**：
  - 無休眠限制
  - 更高的 CPU 與記憶體
  - 更多頻寬
- **適合**：正式使用、團隊協作

### 其他成本

- **Google Gemini API**：視使用量計費（前 60 次請求/分鐘免費）
- **GitHub**：Free/Pro 方案即可
- **網域**（選填）：約 $10-15/年

---

## 進階設定

### 自訂網域

1. 在 Render Service 頁面，前往 **「Settings」**
2. 找到 **「Custom Domain」** 區塊
3. 點選 **「Add Custom Domain」**
4. 輸入你的網域（如 `ai-video-writer.yourdomain.com`）
5. 在你的 DNS 服務商新增 CNAME 記錄：
   ```
   ai-video-writer → ai-video-writer-abc.onrender.com
   ```

### 設定健康檢查

Render 預設會 ping `http://your-app/` 檢查狀態。

若需自訂：
1. 前往 **「Settings」** → **「Health Check Path」**
2. 設定為 `/api/health`（需先建立對應 API）

---

## 相關文件

- [自訂模板使用指南](./CUSTOM_TEMPLATES.md)
- [環境變數設定](./.env.example)
- [Render 官方文件](https://render.com/docs)

---

如有任何問題，歡迎開 Issue 討論！
