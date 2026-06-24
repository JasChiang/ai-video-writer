# AI Video Writer

> 把 YouTube 影片變成文章、SEO 中繼資料與頻道洞察 —— 用 AI 自動化創作者最花時間的後製工作。

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) · [LinkedIn](https://www.linkedin.com/in/jascty) · [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5-8e75ff.svg)](https://ai.google.dev/)

本專案主要由 Claude Code 協助生成，UI 調整由 Codex 協助。

---

## 為什麼用它

經營 YouTube 頻道，真正花時間的不是拍片，而是後製：寫標題、想說明、補標籤、整理成部落格文章、回頭看數據檢討。AI Video Writer 把這五件事自動化，**你只要登入自己的 YouTube 帳號，剩下交給 AI**。

| 你想做的事 | 這個工具怎麼幫你 |
|---|---|
| 📝 **把影片變成文章** | AI 分析影片語意撰文，自動截關鍵畫面，輸出圖文並茂的 Markdown／HTML，一鍵發佈到 Notion |
| 🎯 **優化 SEO 中繼資料** | 一鍵生成三種風格標題、結構化說明、後台標籤，直接回寫到 YouTube |
| 📊 **用講話的方式分析數據** | 直接問「分析上半年開箱單元的成效」，AI 自動查 YouTube Analytics 並產出圖表報告 |
| 🔍 **找關鍵字機會** | 比較不同關鍵字群組在各時段的表現，AI 給出內容策略建議 |
| ⚡ **省下 API 配額** | 頻道影片快取進 GitHub Gist，搜尋不耗 YouTube 配額（約省 97%） |

---

## 五大用途詳解

### 📝 1. 文章與截圖生成

把一支影片變成一篇可發佈的圖文文章。

- AI 分析影片語意，撰寫完整結構化文章
- 自動識別關鍵畫面、用 FFmpeg 截圖，整合成圖文格式
- 可上傳參考檔案（圖片、PDF、Markdown）作為額外上下文
- 輸出 Markdown 或 HTML，或**一鍵發佈到 Notion 資料庫**

### 🎯 2. SEO 中繼資料生成

針對每支影片，一次補齊上架所需的所有文字：

- **三種風格標題**（關鍵字導向 / 懸念導向 / 效益導向），點選即套用
- **結構化影片說明**（黃金前三行、章節導覽、行動呼籲）
- **5–10 個後台標籤**（核心關鍵字 + 長尾關鍵字）
- **一鍵更新回 YouTube**，免手動複製貼上

### 📊 3. AI 數據分析（自然語言對話）

「頻道分析 → AI 分析」分頁，用講話的方式問數據：

> 「比較去年和今年同期的頻道整體表現」
> 「分析最近半年開箱單元的觀看成效」
> 「找出完播率最低的影片，可能原因是什麼？」

AI 透過 **tool calling** 自動決定要查哪些數據，呼叫 YouTube Analytics API 取真實數字，再生成含圖表（長條圖、留存率曲線）與具體建議的報告。

**AI 可用的數據工具**

| 工具 | 作用 |
|---|---|
| `get_channel_analytics` | 整頻道的觀看數、觀看時長、訂閱增減、流量來源分布 |
| `search_videos_by_keyword` | 從 Gist 快取用關鍵字找影片（**不耗 YouTube 配額**） |
| `get_video_analytics` | 指定影片的觀看數、完播率、按讚、留言、流量來源 |
| `get_retention_curve` | 單支影片的觀眾留存率曲線 |

**可切換的 AI 模型**（右上角選單）

| 模型 | 供應商 | 說明 |
|---|---|---|
| Gemini 2.5 Flash | Google | 預設，快速・免費配額 |
| Gemini 2.5 Pro | Google | 高品質・付費 |
| Claude Sonnet 4.5 / Opus 4.5 | OpenRouter | 需設 `OPENROUTER_API_KEY` |
| GPT-4o / GPT-4o mini | OpenRouter | 需設 `OPENROUTER_API_KEY` |

### 🔍 4. 關鍵字報表

「頻道分析 → 關鍵字報表」分頁：

- 設定關鍵字群組（如「開箱」、「評測」）與時間範圍，橫向比較各時期數據
- AI 以 SSE 串流即時輸出關鍵字策略報告
- 模板管理：儲存常用的關鍵字組合與日期設定

### ⚡ 5. 影片快取系統

- 頻道影片資料存進 GitHub Gist，搜尋與分析時不消耗 YouTube API 配額（約省 97%）
- 支援每天自動更新（GitHub Actions、Render Cron，或外部排程服務）
- 詳見 [docs/VIDEO_CACHE_SETUP.md](docs/VIDEO_CACHE_SETUP.md)

---

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 19 · Vite 6 · TypeScript · Chart.js · Mermaid · react-markdown |
| 後端 | Node.js · Express 4 · JWT 驗證 · Multer（上傳） |
| AI | Google Gemini 2.5（`@google/genai`）· OpenRouter（Claude / GPT 選用） |
| YouTube | `googleapis`（Data API + Analytics API）· OAuth 2.0 |
| 影片處理 | yt-dlp（下載）· FFmpeg（截圖） |
| 資料快取 | GitHub Gist |
| 整合 | Notion API |
| 部署 | Render · Docker · GitHub Actions |

---

## 系統架構

```
┌─────────────────┐      ┌──────────────────────────────┐
│  React 前端      │      │  Express 後端 (server.js)     │
│  (Vite, :3000)  │◀────▶│  (:3001, JWT 保護所有 /api)   │
└─────────────────┘ HTTP └──────────────┬───────────────┘
   │ Google OAuth                        │
   ▼                                     ├─▶ Gemini / OpenRouter   (AI 生成・分析)
 YouTube 登入                            ├─▶ YouTube Data/Analytics (影片・數據)
 (token 留在瀏覽器)                       ├─▶ yt-dlp + FFmpeg        (下載・截圖)
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
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) 與 [FFmpeg](https://ffmpeg.org/)（影片下載與截圖）
- Google Cloud 專案（YouTube Data/Analytics API + OAuth 憑證）
- [Gemini API 金鑰](https://aistudio.google.com/app/apikey)

### 2. 安裝與設定

```bash
git clone https://github.com/JasChiang/ai-video-writer.git
cd ai-video-writer
npm install
cp .env.local.example .env.local   # 填入你的金鑰
```

### 3. 啟動

```bash
npm run dev:all   # 同時啟動前後端（推薦）
```

開瀏覽器前往 `http://localhost:3000`，點「Sign in with Google」登入你的 YouTube 帳號。

> 📘 **完整設定步驟**（申請 API 金鑰、OAuth 設定、快取、部署）請見 **[docs/SETUP.md](docs/SETUP.md)**

---

## 環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini API 金鑰 |
| `JWT_SECRET` | ✅ | 後端簽發 session JWT 用的密鑰 |
| `ALLOWED_CHANNEL_IDS` | ✅ | 允許登入的 YouTube 頻道 ID（逗號分隔） |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | ✅ | OAuth 2.0 憑證 |
| `GITHUB_GIST_ID` / `GITHUB_GIST_TOKEN` | 選用 | 影片快取（強烈建議，省配額） |
| `OPENROUTER_API_KEY` | 選用 | 使用 Claude / GPT 模型時 |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | 選用 | 發佈到 Notion 時 |

完整清單見 [.env.local.example](.env.local.example)。

---

## 可用指令

| 指令 | 說明 |
|---|---|
| `npm run dev:all` | **同時啟動前後端（推薦）** |
| `npm run dev` | 僅啟動前端（:3000） |
| `npm run server` | 僅啟動後端（:3001） |
| `npm run build` | 建置生產版本 |
| `npm run update-cache` | 手動更新影片快取到 Gist |
| `npm run lint` / `npm run format` | 程式碼檢查 / 格式化 |

---

## 部署

支援 Render 一鍵部署與 Docker。部署後即可隨時使用，不限於本機開機時。

- **Render**：[docs/DEPLOY_TO_RENDER.md](docs/DEPLOY_TO_RENDER.md)
- **Docker**：專案根目錄含 `docker-compose.yml` 與 `docker-start.sh`
- **自動更新快取**：[docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md)

---

## 專案結構

```
ai-video-writer/
├── App.tsx, index.tsx       # 前端進入點
├── components/              # React UI 元件（儀表板、分析、文章生成…）
├── hooks/                   # 自訂 React hooks
├── services/                # 前後端服務層
│   ├── aiProviders/         #   Gemini / OpenRouter 抽象
│   ├── prompts/             #   提示詞模板
│   ├── geminiService.ts     #   Gemini 呼叫
│   ├── youtubeService.ts    #   YouTube API
│   ├── videoCacheService.*  #   Gist 快取
│   └── notionService.js     #   Notion 發佈
├── middleware/auth.js       # JWT 驗證中介層
├── scripts/                 # 快取更新等 CLI 腳本
├── server.js                # Express 後端（單檔）
├── docker/                  # Docker 相關設定
└── docs/                    # 完整文件
```

---

## 安全性

- **金鑰保護**：敏感金鑰只在後端使用，不出現在前端 JavaScript
- **JWT 驗證**：所有 `/api` 端點需 session JWT，沒有 JWT 一律 401
- **頻道白名單**：JWT 只發給 `ALLOWED_CHANNEL_IDS` 內的頻道擁有者
- **OAuth 安全**：`YOUTUBE_CLIENT_ID` 是 OAuth 2.0 可公開的識別碼，非密碼
- **輸入驗證**：`videoId` 等輸入嚴格驗證，防止 Command Injection
- **本地儲存**：影片暫存本機，處理後自動清理（預設 7 天）；YouTube token 僅存瀏覽器記憶體

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

如果這個專案對你有幫助，請給個 ⭐ Star！

Created by [@jaschiang](https://www.linkedin.com/in/jascty/)

</div>
