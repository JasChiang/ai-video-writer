# AI Video Writer

> 利用 Google Gemini AI，將你的 YouTube 頻道影片自動轉換為文章、SEO 優化內容和數據洞察

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) | [LinkedIn](https://www.linkedin.com/in/jascty) | [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)

本專案主要由 Claude Code 協助生成，UI 調整由 Codex 協助。

---

## 這是什麼？

AI Video Writer 是一個工具，讓 YouTube 內容創作者可以：

- **把影片變成文章**：AI 自動分析影片內容，生成圖文並茂的文章，並截圖關鍵畫面
- **優化 SEO 中繼資料**：一鍵生成三種風格的標題、結構化說明、關鍵字標籤，直接更新到 YouTube
- **看懂頻道數據**：整合 YouTube Analytics，透過 AI 分析哪些影片表現好、哪裡可以改進
- **找出關鍵字機會**：分析搜尋詞表現，產生內容策略建議
- **發佈到 Notion**：生成的文章一鍵發佈到你的 Notion 資料庫

你只需要登入自己的 YouTube 帳號，工具會自動存取你的頻道影片。

---

## 開始使用

**完整設定步驟請參考 → [docs/SETUP.md](docs/SETUP.md)**

裡面包含：
- 如何申請 YouTube API 金鑰
- 如何取得 Gemini API 金鑰
- 如何設定影片快取（節省 API 配額）
- 如何部署到 Render（讓你隨時都能用，不限於開機時）
- 如何設定 GitHub Actions 自動更新快取

---

## 功能總覽

### 1. SEO 中繼資料生成

針對每支影片生成：

- **三種風格標題**（關鍵字導向、懸念導向、效益導向），可直接選擇套用
- **結構化影片說明**（黃金前三行、章節導覽、行動呼籲）
- **5-10 個後台標籤**（核心關鍵字 + 長尾關鍵字）
- 一鍵更新到 YouTube，不需要手動複製貼上

### 2. 文章與截圖生成

- AI 分析影片語意，撰寫完整文章
- 自動識別關鍵畫面並用 FFmpeg 截圖，整合成圖文並茂格式
- 支援上傳參考檔案（圖片、PDF、Markdown）作為額外上下文
- 輸出 Markdown 或 HTML 格式
- 可一鍵發佈到 Notion

### 3. 影片表現分析

- 整合 YouTube Analytics API，顯示各時間範圍的頻道數據
- AI 分析強勢影片與弱勢影片的差異，給出具體改善建議
- 支援 MoM（月比月）、YoY（年比年）比較
- 多模型 AI 可選：Gemini 2.5 Flash/Pro（Google 直連）或 Claude、GPT、Grok（透過 OpenRouter）

### 4. 關鍵字分析

- 分析頻道的搜尋詞來源，對齊 YouTube Studio 數據
- AI 自動生成關鍵字策略報告，以 SSE 串流方式即時輸出

### 5. 影片快取系統

- 頻道影片資料存入 GitHub Gist，搜尋時不消耗 YouTube API 配額（節省約 97%）
- GitHub Actions 每天自動更新快取
- 詳見 [docs/VIDEO_CACHE_SETUP.md](docs/VIDEO_CACHE_SETUP.md)

---

## 使用方式

### 啟動應用程式

```bash
npm run dev:all
```

開啟瀏覽器前往 `http://localhost:3000`，點「Sign in with Google」登入你的 YouTube 帳號。

### 生成 SEO 中繼資料

1. 從影片列表選擇一支影片
2. 點選影片卡片上的「生成中繼資料」
3. （可選）輸入額外提示，例如：「目標受眾是初學者」、「使用輕鬆口語化風格」
4. 點「使用 Gemini 生成內容」，等待 10-30 秒
5. 選擇喜歡的標題，確認說明和標籤後點「Update」更新到 YouTube

### 生成文章

1. 點選影片卡片上的「生成文章」
2. （可選）上傳參考資料檔案
3. 等待 AI 生成文章（20-60 秒）
4. 點「生成截圖」讓文章變成圖文並茂格式
5. 複製 Markdown 或 HTML，或點「發佈到 Notion」

### 查看頻道分析

1. 切換到「頻道分析」頁面
2. 設定要分析的時間範圍
3. 選擇 AI 模型，點「開始分析」
4. 查看 AI 生成的頻道表現報告和建議

---

## 自訂調整

### 修改 AI 提示詞風格

**SEO 中繼資料提示詞**：`services/promptService.js`

```javascript
// 修改角色定位
你是頂尖的 YouTube SEO 策略師 → 你是專業的內容行銷專家

// 修改標題風格
titleA: 關鍵字導向 → titleA: 專業教學型
titleB: 懸念導向 → titleB: 幽默娛樂型
titleC: 效益導向 → titleC: 問題解決型
```

**文章生成提示詞**：`services/articlePromptService.js`

```javascript
// 修改文章長度（generateArticlePrompt 函數）
- 前言：100-150 字 → 50-80 字（簡短有力）
- 主體：3-5 個段落 → 6-8 個段落（更詳細）

// 修改截圖數量
**截圖時間點**：3-5 個關鍵畫面 → 5-8 個關鍵畫面
```

### 修改影片下載品質

**位置**：`server.js`（下載函數中的 `-f` 參數）

```javascript
// 原本：最高 720p
'best[height<=720][ext=mp4]/best[height<=720]/best'

// 改為 1080p（檔案較大）
'best[height<=1080][ext=mp4]/best[height<=1080]/best'

// 改為 480p（檔案較小）
'best[height<=480][ext=mp4]/best[height<=480]/best'
```

---

## 可用指令

| 指令 | 說明 |
|------|------|
| `npm install` | 安裝所有依賴套件 |
| `npm run dev` | 僅啟動前端（Port 3000） |
| `npm run server` | 僅啟動後端（Port 3001） |
| `npm run dev:all` | **同時啟動前後端（推薦）** |
| `npm run build` | 建置生產版本 |
| `npm run update-cache` | 手動更新影片快取到 Gist |

---

## 疑難排解

更多問題請參考 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

### YouTube OAuth 登入失敗（redirect_uri_mismatch）

前往 [Google Cloud Console 憑證](https://console.cloud.google.com/apis/credentials)，確認「授權的重新導向 URI」和「授權的 JavaScript 來源」都有加入 `http://localhost:3000`，儲存後等 1-2 分鐘再試。

### Gemini API 錯誤（403 Forbidden）

1. 確認 `.env.local` 中的 `GEMINI_API_KEY` 正確
2. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 確認金鑰有效
3. 確認 API 配額未用盡

### 影片搜尋不到或配額消耗過快

Gist 快取可能未設定或已過期：
1. 確認 `.env.local` 中 `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 已填入
2. 執行 `npm run update-cache` 手動更新
3. 重新啟動前端（`npm run dev`）

### 影片下載失敗

```bash
# 更新 yt-dlp 到最新版
# macOS
brew upgrade yt-dlp

# Windows
winget upgrade yt-dlp
```

### 環境變數未生效

- 確認檔案名稱是 `.env.local`（不是 `.env`）
- 格式正確（`KEY=value`，等號兩邊無空格）
- 位於專案根目錄（與 `package.json` 同層）
- 已重新啟動伺服器

### Windows 常見問題

**yt-dlp 或 FFmpeg 找不到指令**：重新開啟命令提示字元/PowerShell，確認已加入 PATH。

**Port 被佔用**：
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**腳本執行被拒絕**（以管理員身份執行 PowerShell）：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### macOS 常見問題

**yt-dlp 或 FFmpeg 找不到**：
```bash
brew install yt-dlp ffmpeg
source ~/.zshrc
```

**Port 被佔用**：
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 安全性說明

- **API 金鑰保護**：`GEMINI_API_KEY` 等敏感金鑰只在後端使用，不會出現在前端 JavaScript 中
- **OAuth 安全**：`YOUTUBE_CLIENT_ID` 是 OAuth 2.0 標準中可以公開的識別碼，不是密碼
- **本地儲存**：影片檔案暫存於本機，處理完自動清理（預設 7 天）；YouTube token 只存在瀏覽器記憶體
- **輸入驗證**：所有 API 端點對 `videoId` 格式有嚴格驗證，防止 Command Injection

詳見 [docs/SECURITY.md](docs/SECURITY.md)。

---

## 授權

MIT License — 可自由個人使用、修改、商業使用。

請遵守 [YouTube 服務條款](https://www.youtube.com/t/terms) 和 [Google API 服務使用條款](https://developers.google.com/terms)。

---

## 文件

| 文件 | 說明 |
|------|------|
| [docs/SETUP.md](docs/SETUP.md) | 完整設定指南（從零開始） |
| [CHANGELOG.md](CHANGELOG.md) | 功能與版本變更記錄 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 疑難排解 |
| [docs/VIDEO_CACHE_SETUP.md](docs/VIDEO_CACHE_SETUP.md) | 影片快取系統說明 |
| [docs/GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md) | GitHub Actions 自動快取更新 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全性說明 |
| [docs/gemini_api/](docs/gemini_api/) | Gemini API 參考文件 |

---

<div align="center">

如果這個專案對你有幫助，請給個 ⭐ Star！

Created by [@jaschiang](https://www.linkedin.com/in/jascty/)

</div>
