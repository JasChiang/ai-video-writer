# 完整設定指南

本文件說明如何從零開始將這個專案部署到自己的環境，適合沒有開發經驗的使用者閱讀。

---

## 部署前必讀：這個工具為什麼需要「存取控制」設定？

這個工具部署到網路上之後，網址是公開的（例如 `https://your-app.onrender.com`）。如果沒有任何保護，任何知道這個網址的人都可以使用你的 Gemini API 額度、YouTube API 配額，甚至觸發費用。

**這個工具內建了一道鎖**，設定方式很簡單：

> 只有你指定的 YouTube 頻道擁有者，才能登入並使用這個工具。
> 其他人就算知道網址，也只會看到 401 錯誤，什麼都做不了。

**怎麼設定這道鎖？** 在 Render 的環境變數填入三個值（[第 11 節有詳細步驟](#11-部署到-render讓別人也能使用)）：

| 你要填什麼 | 在哪裡找 | 範例 |
|-----------|---------|------|
| `JWT_SECRET`：一串隨機密碼（程式自動產生） | 執行一行指令產生 | `a3f9c2d1b5e74f89...` |
| `ALLOWED_CHANNEL_IDS`：你的 YouTube 頻道 ID | YouTube Studio → 設定 → 頻道 → 進階設定 | `UCxxxxxxxxxxxxxxxxxx` |
| `ALLOWED_ORIGINS`：你的 Render 網址 | Render 部署後的網址 | `https://your-app.onrender.com` |

填完之後，**只有登入你指定頻道的 Google 帳號，才能使用這個工具**。即使網址被陌生人知道也沒關係。

---

## 目錄

1. [這個工具需要什麼？](#1-這個工具需要什麼)
2. [安裝必要工具](#2-安裝必要工具)
3. [取得程式碼](#3-取得程式碼)
4. [申請 YouTube API 金鑰](#4-申請-youtube-api-金鑰)
5. [取得 YouTube Refresh Token](#5-取得-youtube-refresh-token)
6. [申請 Gemini API 金鑰](#6-申請-gemini-api-金鑰)
7. [設定影片快取（GitHub Gist）](#7-設定影片快取github-gist)
8. [Notion 設定（選填）](#8-notion-設定選填)
9. [填入所有設定值](#9-填入所有設定值)
10. [啟動應用程式](#10-啟動應用程式)
11. [部署到 Render（讓別人也能使用）](#11-部署到-render讓別人也能使用)
12. [設定自動快取更新](#12-設定自動快取更新)
13. [設定值總覽](#13-設定值總覽)

---

## 1. 這個工具需要什麼？

在開始之前，先了解這個工具會用到哪些外部服務，以及為什麼需要它們：

| 服務 | 用途 | 費用 |
|------|------|------|
| **YouTube API** | 讀取你的頻道影片、更新標題說明 | 免費（有每日配額） |
| **Google Gemini** | AI 生成文章和中繼資料 | 免費額度（超出才收費） |
| **GitHub** | 存放程式碼、儲存影片快取資料 | 免費 |
| **Render**（選填） | 把應用程式部署到網路上 | 免費方案可用 |
| **Notion**（選填） | 把生成的文章發佈到 Notion | 免費 |

> **什麼是 API 金鑰？**
> API 金鑰是一組密碼，讓這個工具有權限代替你使用 YouTube、Gemini 等服務。每個服務的金鑰都要分別申請，並且**不能公開給別人**。

---

## 2. 安裝必要工具

### 什麼是終端機？

「終端機」（Terminal）是一個讓你用文字指令操作電腦的視窗。

- **Mac**：按 `Command + 空白鍵`，搜尋「Terminal」
- **Windows**：按 `Win + R`，輸入 `cmd`，按 Enter；或搜尋「命令提示字元」

後續步驟中，所有 `這樣格式` 的文字都是要在終端機輸入的指令。

---

### 2-1. 安裝 Node.js

Node.js 是執行這個工具後端所需的環境。

1. 前往 [nodejs.org](https://nodejs.org/)
2. 下載「LTS」版本（長期支援版）
3. 按照安裝程式步驟完成安裝

安裝完後在終端機輸入以下指令確認：
```bash
node --version
```
如果顯示版本號（例如 `v20.0.0`），表示安裝成功。

---

### 2-2. 安裝 yt-dlp（用於下載未公開影片）

- **Mac**：
  ```bash
  brew install yt-dlp
  ```
  （若沒有 Homebrew，先到 [brew.sh](https://brew.sh/) 安裝）

- **Windows**：前往 [yt-dlp 下載頁面](https://github.com/yt-dlp/yt-dlp/releases)，下載 `yt-dlp.exe`，並加入 PATH

---

### 2-3. 安裝 FFmpeg（用於影片截圖）

- **Mac**：
  ```bash
  brew install ffmpeg
  ```

- **Windows**：前往 [ffmpeg.org](https://ffmpeg.org/download.html) 下載，解壓縮後將 `bin` 資料夾加入系統 PATH

> **提示：** 若只打算部署到 Render，本機不需要安裝 yt-dlp 和 FFmpeg，Render 平台已內建。

---

## 3. 取得程式碼

### 3-1. 建立 GitHub 帳號

若還沒有 GitHub 帳號，前往 [github.com](https://github.com/) 免費註冊。

### 3-2. Fork 這個專案

「Fork」是把別人的專案複製一份到你自己的 GitHub 帳號下。

1. 在本專案頁面右上角點「**Fork**」
2. 點「**Create fork**」

### 3-3. Clone 到本機

把你 fork 的專案下載到電腦上：

```bash
git clone https://github.com/your-username/ai-video-writer.git
cd ai-video-writer
npm install
```

> 將 `your-username` 替換成你的 GitHub 使用者名稱。`npm install` 會自動下載所有需要的套件，需要等待幾分鐘。

---

## 4. 申請 YouTube API 金鑰

這個工具需要 YouTube API 才能讀取你的頻道影片。

### 4-1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)，用你的 Google 帳號登入
2. 點上方的「**選取專案**」→「**新增專案**」
3. 填入名稱（例如「AI Video Writer」），點「**建立**」

### 4-2. 啟用 API

1. 在左側選單選「**API 和服務**」→「**程式庫**」
2. 搜尋「**YouTube Data API v3**」→ 點進去 → 點「**啟用**」
3. 回到程式庫，再搜尋「**YouTube Analytics API**」→ 點「**啟用**」

### 4-3. 設定 OAuth 同意畫面

1. 在左側選單選「**API 和服務**」→「**OAuth 同意畫面**」
2. 使用者類型選「**外部**」→「**建立**」
3. 填入「應用程式名稱」（隨意），「使用者支援電子郵件」選你的 Gmail
4. 在「**測試使用者**」區塊加入你的 Gmail 帳號
5. 儲存並繼續

### 4-4. 建立 OAuth 用戶端

1. 在左側選單選「**API 和服務**」→「**憑證**」
2. 點「**建立憑證**」→「**OAuth 用戶端 ID**」
3. 應用程式類型選「**網頁應用程式**」
4. 「已授權的重新導向 URI」點「**新增 URI**」，加入：
   - `http://localhost:3000`
5. 點「**建立**」
6. 畫面會顯示「**用戶端 ID**」和「**用戶端密鑰**」，分別複製並記下來：
   - 用戶端 ID → 這是 `YOUTUBE_CLIENT_ID`
   - 用戶端密鑰 → 這是 `YOUTUBE_CLIENT_SECRET`

### 4-5. 取得你的頻道 ID

1. 前往 [YouTube Studio](https://studio.youtube.com/)
2. 左下角「**設定**」→「**頻道**」→「**進階設定**」
3. 複製「頻道 ID」（格式為 `UCxxxxxxxxxxxxxxxxxx`）→ 這是 `YOUTUBE_CHANNEL_ID`

---

## 5. 取得 YouTube Refresh Token

> **什麼是 Refresh Token？**
> YouTube 的登入授權只有 1 小時有效期。Refresh Token 是一個長期憑證，讓這個工具可以自動更新授權，不需要每小時重新登入。

取得方式請參考 [取得 YouTube Refresh Token 詳細指南](GET_REFRESH_TOKEN.md)，裡面有兩種方法：

- **方法 1（推薦）**：先啟動應用程式登入後，從瀏覽器取得
- **方法 2**：使用 Google OAuth Playground

取得後記下這個值：`YOUTUBE_REFRESH_TOKEN`

---

## 6. 申請 Gemini API 金鑰

Gemini 是 Google 的 AI 模型，負責生成文章和標題。

1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)，用你的 Google 帳號登入
2. 點「**Create API Key**」→「**Create API key in new project**」
3. 複製產生的金鑰 → 這是 `GEMINI_API_KEY`

---

## 7. 設定影片快取（GitHub Gist）

> **為什麼需要影片快取？**
> YouTube API 每天只有 10,000 點的免費配額，每次搜尋影片就會消耗配額。影片快取會把你的頻道影片清單存在 GitHub Gist（一個免費的線上記事本），之後搜尋從快取讀取，幾乎不消耗配額，可節省約 97%。
>
> 詳細說明請參考 [影片快取系統指南](VIDEO_CACHE_SETUP.md)。

**Gist 不需要手動建立**，後續執行 `npm run update-cache` 時程式會自動建立。

### 7-1. 建立 GitHub Personal Access Token

Personal Access Token（PAT）是讓程式有權限寫入你的 Gist 的密碼。

1. 登入 GitHub，點右上角頭像 →「**Settings**」
2. 左側滾到最下方，點「**Developer settings**」
3. 點「**Personal access tokens**」→「**Tokens (classic)**」
4. 點「**Generate new token**」→「**Generate new token (classic)**」
5. 「Note」填入 `YouTube Video Cache`
6. 「Expiration」建議選「**No expiration**」
7. 勾選「**gist**」權限
8. 點「**Generate token**」
9. **複製顯示的 token**（離開頁面後就看不到了）→ 這是 `GITHUB_GIST_TOKEN`

---

## 8. Notion 設定（選填）

**如果不需要把文章發佈到 Notion，跳過這節。**

### 方式 1：Internal Integration Token（個人使用，較簡單）

1. 前往 [Notion Integrations](https://www.notion.so/my-integrations)
2. 點「**+ New integration**」，填入名稱（例如「AI Video Writer」），點「**Submit**」
3. 複製「**Internal Integration Token**」→ 這是 `NOTION_API_TOKEN`
4. 在 Notion 中，開啟你要存放文章的資料庫頁面
5. 點右上角「**...**」→「**Add connections**」→ 選剛建立的 integration
6. 從頁面 URL 複製資料庫 ID：
   ```
   https://www.notion.so/你的資料庫名稱-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                                       ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                                       這 32 個字元就是資料庫 ID
   ```
   → 這是 `NOTION_DATABASE_ID`

### 方式 2：OAuth（多用戶，較複雜）

適合開放給多人使用的情境，請參考 [Notion OAuth 文件](https://developers.notion.com/docs/authorization)。

---

## 9. 填入所有設定值

> **什麼是環境變數？**
> 環境變數是用來存放密碼和設定值的地方，讓程式在執行時可以讀取，但不會被放到程式碼裡公開。

### 9-1. 建立設定檔

在終端機輸入（確認已在專案資料夾內）：

```bash
cp .env.example .env.local
```

這會建立一個 `.env.local` 檔案。

### 9-2. 編輯設定檔

用文字編輯器（記事本、VS Code、TextEdit 等）開啟專案資料夾中的 `.env.local`，把前面取得的值填進去：

```env
# YouTube
YOUTUBE_CLIENT_ID=填入你的用戶端 ID
YOUTUBE_CLIENT_SECRET=填入你的用戶端密鑰
YOUTUBE_REFRESH_TOKEN=填入你的 Refresh Token
YOUTUBE_CHANNEL_ID=填入你的頻道 ID（UCxxxxxxxx...）

# Gemini AI
GEMINI_API_KEY=填入你的 Gemini API Key

# GitHub Gist（影片快取）
GITHUB_GIST_TOKEN=填入你的 GitHub PAT
GITHUB_GIST_ID=                          ← 先留空，啟動後再填入
GITHUB_GIST_FILENAME=youtube-videos-cache.json

# 本機網址（不需要更改）
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001/api
VITE_SERVER_BASE_URL=http://localhost:3001
```

> **注意：** `.env.local` 包含你的密碼，不要傳給別人，也不要上傳到 GitHub（`.gitignore` 已自動排除）。

---

## 10. 啟動應用程式

### 10-1. 第一次啟動

開啟**兩個**終端機視窗，分別執行：

**終端機 1（後端）：**
```bash
npm run server
```
等到看到 `Server running on port 3001` 之類的訊息，表示後端已啟動。

**終端機 2（前端）：**
```bash
npm run dev
```

或在同一個終端機同時啟動：
```bash
npm run dev:all
```

### 10-2. 開啟應用程式

開啟瀏覽器，前往 `http://localhost:3000`，點「Sign in with Google」登入你的 YouTube 帳號。

### 10-3. 初始化影片快取

登入後，在終端機開啟第三個視窗，執行：

```bash
npm run update-cache
```

> **注意：** 執行前後端必須正在運行（步驟 10-1 的兩個終端機視窗要保持開著）。

成功後會看到類似這樣的輸出：

```
✅ 快取更新成功！
📊 總影片數：100
🆔 Gist ID：abc123def456...   ← 複製這個值
```

**複製 Gist ID**，填回 `.env.local` 的 `GITHUB_GIST_ID=` 後面：

```env
GITHUB_GIST_ID=abc123def456...
```

### 10-4. 重新啟動

填入 Gist ID 後，停止並重新啟動前端（Ctrl+C 後再執行 `npm run dev`），讓設定值生效。

---

## 11. 部署到 Render（讓別人也能使用）

Render 可以把這個工具部署到網路上，讓你不在電腦旁邊也能使用。詳細步驟請參考 [部署到 Render 指南](DEPLOY_TO_RENDER.md)。

**基本設定：**

| 設定 | 值 |
|------|-----|
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `node server.js` |

部署後需要在 Render 的「Environment」頁面填入所有環境變數，並把 `.env.local` 中的網址改成你的 Render 網址：

```
APP_URL=https://your-app.onrender.com
FRONTEND_URL=https://your-app.onrender.com
VITE_API_URL=https://your-app.onrender.com/api
VITE_SERVER_BASE_URL=https://your-app.onrender.com
```

> `PORT` 不需要設定，Render 會自動注入。

**存取控制（必填）**：

| 環境變數 | 說明 | 範例 |
|----------|------|------|
| `JWT_SECRET` | JWT 簽名密鑰，請產生一個隨機字串 | 見下方指令 |
| `ALLOWED_CHANNEL_IDS` | 允許登入的 YouTube Channel ID，逗號分隔 | `UCXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| `ALLOWED_ORIGINS` | 允許的前端 origin | `https://your-app.onrender.com` |

產生 `JWT_SECRET`（在終端機執行）：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**查詢你的 Channel ID**：YouTube Studio → 左下「設定」→「頻道」→「進階設定」→「頻道 ID」（`UC` 開頭的字串）

> **重要**：`JWT_SECRET` 請在 Render 上設定一個與本機 `.env.local` 不同的值，且絕對不要公開。`ALLOWED_CHANNEL_IDS` 只填你自己的頻道 ID，這樣即使 Render 網址被人知道，也無法登入或使用任何 API 端點。使用 Channel ID 而非 email，可避免 YouTube 品牌帳號的特殊 email 造成的問題。

**注意事項：**

- **多個頻道用逗號分隔**：`ALLOWED_CHANNEL_IDS=UCxxx,UCyyy`
- **如果登入後功能異常**：清除瀏覽器 localStorage 再重新登入（DevTools → Application → Local Storage → 全選刪除）
- **JWT 有效期 8 小時**：過期後需重新登入，這是正常行為
- **換了 `JWT_SECRET` 所有人需重新登入**：Render 上修改此變數後，所有現有 session 立即失效

同時記得回到 Google Cloud Console，在 OAuth 用戶端設定中加入你的 Render 網域：
```
https://your-app.onrender.com
```

---

## 12. 設定自動快取更新

影片快取需要定期更新，才能反映新上傳的影片。專案內建 GitHub Actions，每天台灣時間 22:40 自動更新。

詳細設定步驟請參考 [GitHub Actions 設定指南](GITHUB_ACTIONS_SETUP.md)。

**簡要步驟：**

1. 在你的 GitHub repo →「**Settings**」→「**Secrets and variables**」→「**Actions**」
2. 新增以下 Secrets：

| Secret 名稱 | 填入的值 |
|------------|---------|
| `YOUTUBE_CLIENT_ID` | YouTube 用戶端 ID |
| `YOUTUBE_CLIENT_SECRET` | YouTube 用戶端密鑰 |
| `YOUTUBE_REFRESH_TOKEN` | YouTube Refresh Token |
| `YOUTUBE_CHANNEL_ID` | 你的頻道 ID |
| `GEMINI_API_KEY` | Gemini API Key |
| `VIDEO_CACHE_GIST_TOKEN` | GitHub PAT |
| `VIDEO_CACHE_GIST_ID` | Gist ID（步驟 10-3 取得的） |
| `VIDEO_CACHE_GIST_FILENAME` | `youtube-videos-cache.json` |

3. 確認 `.github/workflows/update-video-cache.yml` 中的分支名稱對應你實際使用的分支：

```yaml
- uses: actions/checkout@v4
  with:
    ref: 'main'   # 改成你的分支名稱
```

4. 前往「**Actions**」→「**Update Video Cache to Gist**」→「**Run workflow**」手動測試一次，確認成功。

---

## 13. 設定值總覽

| 變數名稱 | 必填 | 從哪裡取得 |
|---------|------|-----------|
| `YOUTUBE_CLIENT_ID` | 必填 | Google Cloud Console → 憑證 → OAuth 用戶端 ID |
| `YOUTUBE_CLIENT_SECRET` | 必填 | Google Cloud Console → 憑證 → OAuth 用戶端密鑰 |
| `YOUTUBE_REFRESH_TOKEN` | 必填 | 參考 [GET_REFRESH_TOKEN.md](GET_REFRESH_TOKEN.md) |
| `YOUTUBE_CHANNEL_ID` | 必填 | YouTube Studio → 設定 → 頻道 → 進階設定 |
| `GEMINI_API_KEY` | 必填 | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GITHUB_GIST_TOKEN` | 建議 | GitHub → Settings → Developer settings → PAT |
| `GITHUB_GIST_ID` | 建議 | 執行 `npm run update-cache` 後取得 |
| `GITHUB_GIST_FILENAME` | 建議 | 固定填 `youtube-videos-cache.json` |
| `OPENROUTER_API_KEY` | 停用中 | 多供應商（Claude / GPT / Grok）AI 分析預設關閉，目前用不到（恢復方式見 README「多供應商（OpenRouter）」） |
| `NOTION_API_TOKEN` | 選填 | Notion → Settings → Integrations |
| `NOTION_DATABASE_ID` | 選填 | Notion 資料庫頁面的 URL |
| `NOTION_TITLE_PROPERTY` | 選填 | 固定填 `Name`（Notion 預設標題欄位名稱） |
| `FRONTEND_URL` | 必填 | 本機：`http://localhost:3000` |
| `VITE_API_URL` | 必填 | 本機：`http://localhost:3001/api` |
| `VITE_SERVER_BASE_URL` | 必填 | 本機：`http://localhost:3001` |
| `FILE_RETENTION_DAYS` | 選填 | 數字，暫存影片保留天數，預設 `7` |
