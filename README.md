# CreatorCockpit

YouTube 頻道後製工具：影片轉文章、SEO 中繼資料補全、頻道數據分析。

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) · [LinkedIn](https://www.linkedin.com/in/jascty) · [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5-8e75ff.svg)](https://ai.google.dev/)

本專案主要由 Claude Code 協助生成，UI 調整由 Codex 協助。

---

## 功能概覽

登入自己的 YouTube 帳號後，共有三個主要分頁：

| 分頁 | 主要用途 |
|---|---|
| **影片內容** | 瀏覽所有影片、生成或更新 SEO 中繼資料 |
| **文章生成** | 從影片或網址生成圖文文章，可發佈到 Notion |
| **頻道分析** | 儀表板、全部影片數據、AI 對話分析、關鍵字報表 |

---

## 各分頁功能

### 影片內容

從 Gist 快取載入頻道全部影片（不耗 YouTube API 配額）。點選任一影片開啟側欄：

- 查看影片基本資訊（觀看數、按讚、留言）
- **SEO 中繼資料生成**：Gemini 分析影片語意，產出三種風格標題（關鍵字導向 / 懸念導向 / 效益導向）、結構化說明（黃金前三行、章節、行動呼籲）、5–10 個後台標籤
- **一鍵回寫 YouTube**：點選標題或說明即可直接更新到 YouTube，不用手動複製貼上

---

### 文章生成

把一支影片（或網址）轉成可發佈的圖文文章。

- 輸入 YouTube 影片網址，Gemini 讀取影片語意（畫面 + 語音）後撰文
- 可上傳參考檔（圖片、PDF、Markdown）或附加參考網址（`urlContext` 工具直接讀取網頁內容）
- 選擇文章模板，調整語氣與結構；目前預設模板為 **HTML 文章**（AEO/GEO/SEO 三合一，可直接貼入 CMS）
- **顏色主題**：4 組預設色票（深灰 / 品牌藍 / 森林綠 / 深紫），生成前選取，顏色直接 bake 進 HTML inline style，換色重新生成即可
- HTML 文章結果提供 **預覽 / 原始碼** 兩個 tab，「複製 HTML 內容」一鍵複製 body 區塊
- **草稿自動儲存**：生成成功後即存入 localStorage，最多保留 20 筆；若已登入 Google，以帳號的 `sub` 隔離不同使用者的草稿
- **一鍵發佈到 Notion 資料庫**（需設定 `NOTION_CLIENT_ID`）

> **關於截圖**：Gemini 透過 `fileData.fileUri` 直接讀 YouTube URL，不需下載影片。自動截取關鍵畫面功能需要本機安裝 yt-dlp + FFmpeg；Render 等 managed 環境不支援此功能。

---

### 頻道分析

四個子分頁：

#### 頻道儀表板

時間範圍可選（7 天 / 30 天 / 90 天 / 本月 / 上月 / 自訂），數據來源：

- **KPI 指標**（觀看次數、觀看時長、訂閱淨增）：YouTube Analytics API，取該時段內實際產生的數據
- **熱門影片排行**：Analytics API 影片維度查詢，可按觀看數 / 完播率 / 分享 / 留言切換排序
- **流量來源、環比對照、地區分布、裝置類型、人口統計**：各自獨立的 Analytics 查詢

Analytics 數據約有 1–3 天延遲（以 `ANALYTICS_DATA_DELAY_DAYS = 3` 計算可用最晚日期）。

#### 全部影片

YouTube Studio 影片匯出上限 500 筆；本分頁突破這個限制，列出頻道**全部**影片：

- 影片清單來自 Gist 快取，含縮圖、標題、發布日期、影片長度
- **期間數據模式**：選擇日期範圍後，以 `filters=video==<ids>` 分批查詢 Analytics（每批 200 筆），取得各影片的觀看次數、平均觀看時間、平均完播率、讚、留言
- **發佈至今累計模式**：直接用快取數字，不呼叫 Analytics API
- 欄位可點擊排序（預設觀看次數）、標題即時搜尋（先載入才可搜）、每頁 50 / 100 / 200 筆、保留合計列
- 欄位可自行勾選顯示（11 個指標，儲存於 localStorage）

#### AI 分析

用自然語言問頻道數據，不用自己下 API 查詢：

> 「比較去年和今年同期的整體表現」  
> 「最近半年完播率最低的 10 支影片是哪些？」  
> 「開箱單元和評測單元哪個帶來更多訂閱？」

**運作方式（Gemini Function Calling）**

使用者提問後，後端呼叫 Gemini 並附上 5 個工具定義。Gemini 自行決定要呼叫哪些工具、帶什麼日期範圍，後端在同一個 Node.js process 內執行工具、把結果回傳給 Gemini，最多循環 5 輪。取得數據後，再跑一次 code execution（Gemini 在沙盒裡執行 Python）做精確計算，最後輸出 Markdown 報告 + JSON 圖表。

**可用工具**

| 工具 | 作用 |
|---|---|
| `get_channel_analytics` | 整頻道觀看數、觀看時長、訂閱增減、流量來源分布 |
| `get_top_videos` | 依指標（觀看數 / 觀看時長 / 完播率 / 按讚 / 留言）排名，直接取前 N / 後 N 支，結果含影片標題 |
| `search_videos_by_keyword` | 從 Gist 快取用關鍵字過濾影片（**不耗 YouTube 配額**） |
| `get_video_analytics` | 指定影片的觀看數、完播率、按讚、留言、流量來源，結果含影片標題 |
| `get_retention_curve` | 單支影片的留存率曲線，標出最大流失點 |

這不是 MCP（Model Context Protocol）；工具定義走 Gemini 原生 Function Calling，執行在後端 Express process 內。單次查詢的 API 費用約 $0.001–0.002 USD（Gemini Flash，~5,000–8,000 tokens/次）。

支援多輪對話；可切換 Gemini Flash（預設）或 Gemini Pro。

#### 關鍵字報表

橫向比較不同關鍵字群組在各時段的表現：

- 設定關鍵字（如「開箱」、「評測」）及多個時間區間
- 系統從 Gist 快取過濾符合標題的影片，查詢各時段的 Analytics 數據
- 產出比較表格（觀看數、完播率等）
- AI 以 SSE 串流輸出關鍵字策略報告
- 可儲存常用設定為模板

---

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 19 · Vite 6 · TypeScript · Chart.js · react-markdown |
| 後端 | Node.js · Express 4 · JWT 驗證 · Multer（上傳） |
| AI | Google Gemini（`@google/genai`，`gemini-flash-latest` / `gemini-pro-latest`）· OpenRouter 多供應商抽象（內建，預設停用） |
| YouTube | `googleapis`（Data API + Analytics API）· OAuth 2.0 |
| 影片處理 | yt-dlp（下載）· FFmpeg（截圖）—— 本機功能，Render 不支援 |
| 資料快取 | GitHub Gist |
| 整合 | Notion API |
| 部署 | Render · GitHub Actions |

---

## 系統架構

```
┌─────────────────┐      ┌──────────────────────────────┐
│  React 前端      │      │  Express 後端 (server.js)     │
│  (Vite, :3000)  │◀────▶│  (:3001, JWT 保護所有 /api)   │
└─────────────────┘ HTTP └──────────────┬───────────────┘
   │ Google OAuth                        │
   ▼                                     ├─▶ Google Gemini        (AI 生成・分析)
 YouTube 登入                            ├─▶ YouTube Data/Analytics (影片・數據)
 (token 留在瀏覽器)                       ├─▶ yt-dlp + FFmpeg        (下載・截圖，本機限定)
                                         ├─▶ GitHub Gist           (影片快取)
                                         └─▶ Notion API            (發佈文章)
```

**重點設計**
- 敏感金鑰（`GEMINI_API_KEY` 等）只在後端使用，不會進前端 bundle
- 所有 `/api` 路由經 JWT 中介層（`middleware/auth.js`）保護
- JWT 只發給 `ALLOWED_CHANNEL_IDS` 白名單內的頻道擁有者
- YouTube token 僅存於瀏覽器記憶體，不落地

---

## 快速開始

### 1. 前置需求

- Node.js ≥ 18
- Google Cloud 專案（YouTube Data/Analytics API + OAuth 憑證）
- [Gemini API 金鑰](https://aistudio.google.com/app/apikey)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) 與 [FFmpeg](https://ffmpeg.org/)（選用；本機截圖功能才需要）

### 2. 安裝與設定

```bash
git clone https://github.com/JasChiang/CreatorCockpit.git
cd CreatorCockpit
npm install
cp .env.local.example .env.local   # 填入你的金鑰
```

### 3. 啟動

```bash
npm run dev:all   # 同時啟動前後端（推薦）
```

開瀏覽器前往 `http://localhost:3000`，點「Sign in with Google」登入你的 YouTube 帳號。

> **完整設定步驟**（申請 API 金鑰、OAuth 設定、快取、部署）請見 **[docs/SETUP.md](docs/SETUP.md)**

---

## 環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `GEMINI_API_KEY` | 是 | Gemini API 金鑰 |
| `JWT_SECRET` | 是 | 後端簽發 session JWT 用的密鑰 |
| `ALLOWED_CHANNEL_IDS` | 是 | 允許登入的 YouTube 頻道 ID（逗號分隔） |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | 是 | OAuth 2.0 憑證 |
| `GITHUB_GIST_ID` / `GITHUB_GIST_TOKEN` | 選用 | 影片快取（強烈建議，省配額） |
| `OPENROUTER_API_KEY` | 停用中 | 多供應商（Claude / GPT / Grok）預設關閉 |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | 選用 | 發佈到 Notion 時 |

完整清單見 [.env.local.example](.env.local.example)。

---

## 多供應商（OpenRouter）（選用，停用中）

預設只啟用原生 Google Gemini。透過 [OpenRouter](https://openrouter.ai/) 接 Claude / GPT / Grok 的多供應商分析支援**程式碼仍保留，但預設停用**。要恢復：

1. `services/aiProviders/AIModelManager.js` 把 `ENABLE_OPENROUTER` 改成 `true`
2. `components/AIAnalysisPanel.tsx` 取消 `MODEL_OPTIONS` 裡 OpenRouter 三行的註解
3. 設定環境變數 `OPENROUTER_API_KEY`

> 影片分析、文章與 SEO 中繼資料生成一律只走原生 Gemini，不受此設定影響；OpenRouter 僅作用於「頻道分析 / 關鍵字報表 / AI 分析對話」。

---

## 可用指令

| 指令 | 說明 |
|---|---|
| `npm run dev:all` | 同時啟動前後端（推薦） |
| `npm run dev` | 僅啟動前端（:3000） |
| `npm run server` | 僅啟動後端（:3001） |
| `npm run build` | 建置生產版本 |
| `npm run update-cache` | 手動更新影片快取到 Gist |
| `npm run lint` / `npm run format` | 程式碼檢查 / 格式化 |

---

## 部署

- **Render**：[docs/DEPLOY_TO_RENDER.md](docs/DEPLOY_TO_RENDER.md)
- **自動更新快取**：[docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)

> **注意**：yt-dlp 與 FFmpeg 在 Render managed 環境不可用（無法安裝任意系統工具）。頻道分析、AI 分析、文章生成、Gist 快取等核心功能不受影響。

---

## 專案結構

```
CreatorCockpit/
├── App.tsx, index.tsx       # 前端進入點
├── components/              # React UI 元件（儀表板、分析、文章生成…）
├── hooks/                   # 自訂 React hooks
├── services/                # 前後端服務層
│   ├── aiProviders/         #   AI 供應商抽象（Gemini 啟用 · OpenRouter 保留停用）
│   ├── prompts/             #   提示詞模板
│   │   ├── colorThemes.js   #     4 組顏色主題定義（前後端共用）
│   │   └── templates/       #     各模板提示詞（aeo-html-v5、default…）
│   ├── analyticsTools.js    #   Gemini Function Calling 工具定義與執行
│   ├── draftService.ts      #   草稿讀寫（localStorage + Google sub namespace）
│   ├── geminiService.ts     #   Gemini 呼叫
│   ├── youtubeService.ts    #   YouTube API
│   ├── videoCacheService.*  #   Gist 快取
│   └── notionService.js     #   Notion 發佈
├── middleware/auth.js       # JWT 驗證中介層
├── scripts/                 # 快取更新等 CLI 腳本
├── server.js                # Express 後端（單檔）
└── docs/                    # 完整文件
```

---

## 安全性

- 敏感金鑰只在後端使用，不出現在前端 JavaScript
- 所有 `/api` 端點需 session JWT，沒有 JWT 一律 401
- JWT 只發給 `ALLOWED_CHANNEL_IDS` 內的頻道擁有者
- `videoId` 等輸入嚴格驗證，防止 Command Injection
- YouTube token 僅存瀏覽器記憶體，不落地

詳見 [docs/SECURITY.md](docs/SECURITY.md) 與 [docs/SECURITY_REPORT.md](docs/SECURITY_REPORT.md)。

---

## 文件索引

| 文件 | 說明 |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | 完整設定指南（從零開始） |
| [docs/DEPLOY_TO_RENDER.md](docs/DEPLOY_TO_RENDER.md) | 部署到 Render |
| [docs/VIDEO_CACHE_SETUP.md](docs/VIDEO_CACHE_SETUP.md) | 影片快取系統 |
| [docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md) | 自動更新快取 |
| [docs/GET_REFRESH_TOKEN.md](docs/GET_REFRESH_TOKEN.md) | 取得 YouTube Refresh Token |
| [docs/ENABLE_ANALYTICS_API.md](docs/ENABLE_ANALYTICS_API.md) | 啟用 YouTube Analytics API |
| [docs/CUSTOM_TEMPLATES.md](docs/CUSTOM_TEMPLATES.md) | 自訂文章模板 |
| [docs/GEMINI_PROMPT_BEST_PRACTICES.md](docs/GEMINI_PROMPT_BEST_PRACTICES.md) | Gemini 提示詞最佳實踐 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 疑難排解 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全性說明 |
| [CHANGELOG.md](CHANGELOG.md) | 版本變更記錄 |

---

## 授權

[MIT License](LICENSE) — 可自由個人使用、修改、商業使用。

請遵守 [YouTube 服務條款](https://www.youtube.com/t/terms) 與 [Google API 服務使用條款](https://developers.google.com/terms)。

---

<div align="center">

Created by [@jaschiang](https://www.linkedin.com/in/jascty/)

</div>
