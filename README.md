# CreatorCockpit (AI Video Writer)

YouTube 創作者的專屬後製與分析工具：結合 AI 影片轉文章、SEO 中繼資料自動補全，以及全方位的頻道數據分析。

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) · [LinkedIn](https://www.linkedin.com/in/jascty) · [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5-8e75ff.svg)](https://ai.google.dev/)

---

## 🚀 功能概覽

本專案提供三大核心功能分頁，協助 YouTube 創作者最大化內容價值：

### 1. 影片內容管理 (Video Management)
- **零配額讀取**：從 GitHub Gist 快取載入頻道所有影片，不消耗 YouTube API 配額。
- **SEO 中繼資料生成**：利用 Gemini AI 深入分析影片語意，自動產生三種風格的標題（關鍵字/懸念/效益導向）、結構化說明（含章節時間軸）以及熱門標籤。
- **一鍵同步 YouTube**：點擊即可將生成的標題或說明直接更新至 YouTube 後台，省去手動複製貼上。

### 2. 文章生成 (Article Generation)
- **影片轉圖文文章**：輸入 YouTube 網址或上傳未公開影片，Gemini 將自動擷取畫面與語音，轉化為高質感的圖文文章。
- **自訂模板與佈景主題**：內建多種文章模板（支援 HTML AEO/GEO/SEO 格式），並提供 4 組預設配色，亦支援透過遠端 Gist 載入自訂模板。
- **Notion 深度整合**：一鍵將生成的文章與影片截圖發佈至您的 Notion 資料庫。
- **參考資料輔助**：支援上傳圖片、PDF、Markdown 檔案，或附加多達 20 個參考網址，讓 AI 寫作內容更精準。

### 3. 頻道分析 (Channel Analytics)
- **全方位儀表板**：結合 YouTube Analytics API，提供自訂時間範圍的觀看數、時長、訂閱轉換率、流量來源及觀眾輪廓。
- **全影片數據透視**：突破官方 500 筆匯出限制，透過分批查詢獲取頻道所有影片的各項指標，支援自訂欄位與多維度排序。
- **自然語言 AI 分析**：內建 AI 數據助理（Gemini Function Calling），支援多輪對話。你可以直接問：「比較今年和去年同期的表現」，AI 會自動調用對應的數據工具並生成圖表與策略報告。
- **關鍵字策略報表**：橫向比對不同關鍵字群組的成效，助你找出最具流量潛力的創作方向。

---

## 🛠 技術棧 (Tech Stack)

- **前端**：React 19, Vite 6, TypeScript, Tailwind CSS, Chart.js, react-markdown
- **後端**：Node.js, Express 4, JWT 驗證, Multer
- **AI 引擎**：Google Gemini 2.5 (Flash/Pro) 
- **整合 API**：YouTube Data/Analytics API, Notion API, GitHub Gist API
- **多媒體處理**：yt-dlp, FFmpeg（用於本機端下載與截圖）

---

## ⚙️ 系統架構

為了確保安全性與效能，本專案採用前後端分離架構，所有敏感金鑰與 API 呼叫皆在後端進行，並透過 JWT 與 YouTube 頻道 ID 白名單雙重驗證。影片列表使用 GitHub Gist 進行快取，大幅降低 YouTube API 額度消耗。

---

## 📦 快速開始 (Quick Start)

### 前置需求
- Node.js ≥ 18
- Google Cloud 專案（需啟用 YouTube Data/Analytics API，並取得 OAuth 憑證）
- [Gemini API 金鑰](https://aistudio.google.com/app/apikey)
- yt-dlp 與 FFmpeg（選用，用於本機端擷取截圖）

### 安裝與啟動
```bash
git clone https://github.com/JasChiang/CreatorCockpit.git
cd CreatorCockpit
npm install
cp .env.local.example .env.local   # 填入您的環境變數與金鑰
npm run dev:all                    # 同時啟動前後端伺服器 (前端 :3000, 後端 :3001)
```
開啟瀏覽器前往 `http://localhost:3000`，點擊「Sign in with Google」即可開始使用。

> 完整設定步驟請參考 `docs/SETUP.md`。

---

## 🔒 安全性 (Security)
- 敏感金鑰僅限後端存取。
- 所有 `/api` 請求皆需攜帶合法 JWT。
- 只有列於 `ALLOWED_CHANNEL_IDS` 白名單中的 YouTube 頻道才能成功登入。
- YouTube OAuth Token 僅存於瀏覽器記憶體中。

---

## 📖 文件導覽
- `docs/SETUP.md`: 完整設定指南
- `docs/DEPLOY_TO_RENDER.md`: 部署至 Render 教學
- `docs/VIDEO_CACHE_SETUP.md`: 影片快取機制設定
- `docs/SECURITY.md`: 安全性詳細說明
- `CHANGELOG.md`: 版本更新紀錄

---

*(English Version)*

---

# CreatorCockpit (AI Video Writer)

An exclusive post-production and analytics toolkit for YouTube creators. Seamlessly convert videos into articles, auto-complete SEO metadata, and dive deep into your channel's performance metrics with AI.

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) · [LinkedIn](https://www.linkedin.com/in/jascty) · [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.5-8e75ff.svg)](https://ai.google.dev/)

---

## 🚀 Features Overview

This project provides three core functional tabs to help creators maximize the value of their content:

### 1. Video Management
- **Zero-Quota Loading**: Loads all channel videos from a GitHub Gist cache, saving your YouTube API quota.
- **AI SEO Metadata Generation**: Leverages Gemini AI to deeply analyze video semantics and automatically generate three styles of titles (keyword/suspense/benefit), structured descriptions (with chapters), and trending tags.
- **One-Click YouTube Sync**: Instantly push the generated titles or descriptions directly to YouTube without manual copy-pasting.

### 2. Article Generation
- **Video to Blog Post**: Input a YouTube URL or upload a private video. Gemini will extract visuals and audio to craft a high-quality, rich-media article.
- **Custom Templates & Themes**: Built-in article templates (supporting HTML AEO/GEO/SEO formats) with 4 preset color themes. Supports fetching custom templates via remote Gists.
- **Deep Notion Integration**: Publish generated articles and video screenshots directly to your Notion database with a single click.
- **Reference Material Support**: Enhance AI accuracy by uploading reference images, PDFs, Markdown files, or attaching up to 20 reference URLs.

### 3. Channel Analytics
- **Comprehensive Dashboard**: Combines YouTube Analytics API data to provide custom date range metrics for views, watch time, subscriber conversions, traffic sources, and audience demographics.
- **All Videos Data**: Breaks the official 500-video export limit by batch-querying all videos on the channel. Supports custom columns and multi-dimensional sorting.
- **Natural Language AI Chat**: Built-in AI data assistant using Gemini Function Calling. Ask questions like "Compare performance between this year and last year," and the AI will autonomously fetch the right data, generate charts, and provide strategic reports.
- **Keyword Strategy Report**: Horizontally compare the performance of different keyword groups to uncover your most lucrative content directions.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript, Tailwind CSS, Chart.js, react-markdown
- **Backend**: Node.js, Express 4, JWT Authentication, Multer
- **AI Engine**: Google Gemini 2.5 (Flash/Pro)
- **APIs**: YouTube Data/Analytics API, Notion API, GitHub Gist API
- **Media Processing**: yt-dlp, FFmpeg (for local video downloading and screenshots)

---

## ⚙️ System Architecture

To ensure security and performance, this project uses a decoupled frontend-backend architecture. All sensitive keys and API calls are handled strictly on the backend, secured by JWT and a YouTube Channel ID whitelist. Video lists are cached via GitHub Gist to drastically reduce YouTube API quota consumption.

---

## 📦 Quick Start

### Prerequisites
- Node.js ≥ 18
- Google Cloud Project (with YouTube Data/Analytics APIs enabled and OAuth credentials)
- [Gemini API Key](https://aistudio.google.com/app/apikey)
- yt-dlp and FFmpeg (optional, required for local screenshot capture)

### Installation & Startup
```bash
git clone https://github.com/JasChiang/CreatorCockpit.git
cd CreatorCockpit
npm install
cp .env.local.example .env.local   # Fill in your environment variables and API keys
npm run dev:all                    # Start both frontend (:3000) and backend (:3001) concurrently
```
Open your browser and navigate to `http://localhost:3000`. Click "Sign in with Google" to begin.

> For complete setup instructions, please refer to `docs/SETUP.md`.

---

## 🔒 Security
- Sensitive keys are accessed backend-only.
- All `/api` requests require a valid session JWT.
- Only YouTube channels listed in the `ALLOWED_CHANNEL_IDS` whitelist can successfully log in.
- YouTube OAuth Tokens are kept strictly in browser memory.

---

## 📖 Documentation Index
- `docs/SETUP.md`: Complete Setup Guide
- `docs/DEPLOY_TO_RENDER.md`: Render Deployment Guide
- `docs/VIDEO_CACHE_SETUP.md`: Video Cache Mechanism Setup
- `docs/SECURITY.md`: Detailed Security Practices
- `CHANGELOG.md`: Version History & Changelog

---

## 📄 License
[MIT License](LICENSE) — Free for personal, modification, and commercial use.
Please adhere to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and [Google API Services User Data Policy](https://developers.google.com/terms).

<div align="center">
Created by [@jaschiang](https://www.linkedin.com/in/jascty/)
</div>
