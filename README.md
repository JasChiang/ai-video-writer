# AI Video Writer

> 基於 Google Gemini AI 的智慧 YouTube 影片內容轉換工具

將 YouTube 影片自動轉換為 SEO 強化的文章和中繼資料，利用 Gemini 2.5 Flash 的「傳送 YouTube 網址」能力，為內容創作者節省大量時間。

本專案主要由 Claude Code 協助生成，UI 調整由 Codex 協助

**Created by [Jas Chiang](https://www.facebook.com/jaschiang/) | [LinkedIn](https://www.linkedin.com/in/jascty) | [X](https://x.com/jaschiang)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-61dafb.svg)](https://reactjs.org/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-@jaschiang-0077B5.svg)](https://www.linkedin.com/in/jascty/)

---

## 🔀 Feature 分支

`feature/video-performance-analytics` 分支目前包含：
- 影片表現分析儀表板與相關 API
- Docker 化流程（`docker-compose.yml`、`docker-start.sh` 等工具）
- 前端執行期設定載入機制，確保 Docker/打包環境能正確初始化 YouTube OAuth

---

## 📖 目錄

- [專案特色](#-專案特色)
- [核心功能](#-核心功能)
- [快速開始](#-快速開始)
  - [Windows 安裝指南](#windows-安裝指南)
  - [macOS 安裝指南](#macos-安裝指南)
- [詳細使用教學](#-詳細使用教學)
- [技術架構](#-技術架構)
- [專案結構](#-專案結構)
- [自訂調整指南](#-自訂調整指南)
- [疑難排解](#-疑難排解)
- [安全性說明](#-安全性說明)
- [授權與免責聲明](#-授權與免責聲明)

---

## ✨ 專案特色

### 🎯 兩大核心功能

1. **SEO 中繼資料自動生成**
   - 三種風格的標題選項（關鍵字導向、懸念導向、效益導向）
   - 完整的影片說明（含黃金前三行、章節導覽、CTA）
   - 5-10 個精選後台標籤
   - 一鍵更新到 YouTube

2. **圖文並茂文章生成**
   - AI 分析影片內容生成專業文章
   - 自動識別關鍵畫面並截圖
   - SEO 強化的 meta description
   - 支援 Markdown 和 HTML 格式輸出

### 🚀 技術亮點

- **前後端分離架構**：確保 API Keys 安全隔離
- **檔案重複使用**：避免重複下載和上傳影片，提升效率
- **文章生成與自動截圖**：生成文字內容，並透過 FFmpeg 截圖
- **全影片類型支援**：公開、未公開皆可處理
- **智慧輸入驗證**：防止 Command Injection 等安全風險
- **自動清理機制**：啟動時自動清理過期檔案，節省磁碟空間

### 🧹 自動清理機制

應用程式會在**每次啟動時**自動檢查並清理過期的暫存檔案：

- ✅ 自動刪除超過保留天數的影片和截圖
- ✅ 預設保留 7 天，可透過 `FILE_RETENTION_DAYS` 環境變數調整
- ✅ 在保留期限內可重新使用影片進行截圖
- ✅ 顯示詳細清理統計（檔案數量、釋放空間）

**設定保留天數：**

在 `.env.local` 中加入：
```bash
FILE_RETENTION_DAYS=14  # 保留 14 天
```

**啟動時的清理日誌：**
```
========== 🧹 啟動清理檢查 ==========
[Cleanup] 檔案保留天數: 7 天
[Cleanup] 檢查 temp_videos 目錄...
  🗑️  已刪除: abc123.mp4 (45.23 MB, 8 天前)
[Cleanup] 檢查 public/images 目錄...
  🗑️  已刪除: screenshot.jpg (0.85 MB, 8 天前)
[Cleanup] ✅ 清理完成: 刪除 2 個檔案，釋放 46.08 MB 空間
========== 清理檢查完成 ==========
```

---

## 🎬 核心功能

### 功能 1：SEO 中繼資料生成

**適用場景**：為 YouTube 影片改善標題、說明和標籤

**生成內容**：
- **三種風格標題**
  - 選項 A：關鍵字導向 - SEO 強化，提升搜尋排名
  - 選項 B：懸念/好奇心導向 - 提高點擊率 (CTR)
  - 選項 C：結果/效益導向 - 明確價值主張

- **完整結構化說明**
  ```
  【黃金前三行】精華總結 + 核心關鍵字
  ---
  【章節導覽】00:00 開場 | 02:30 重點一 | 05:00 重點二
  ---
  【詳細內容】完整說明文字
  ---
  【行動呼籲】訂閱、按讚、分享
  ---
  【主題標籤】#關鍵字 #主題
  ```

- **後台標籤**：5-10 個精選標籤（核心關鍵字 + 長尾關鍵字）

### 功能 2：文章與截圖生成

**適用場景**：將 YouTube 影片轉換為部落格文章或社群媒體內容

**兩階段流程**：

**階段 1 - 生成文章文字**
1. AI 分析影片內容
2. 生成三種風格標題
3. 撰寫前言、內文、結語
4. 產生 SEO meta description

**階段 2 - 生成截圖（可選）**
1. AI 識別關鍵畫面時間點
2. 使用 FFmpeg 自動截圖
3. 每個時間點附上說明與理由
4. 整合為圖文並茂的文章

---

## 🚀 快速開始

### 系統需求

- **Node.js**：v18.0.0 或以上
- **yt-dlp**：用於下載未列出/私人影片
- **FFmpeg**：用於影片截圖功能
- **Google Cloud 專案**：需啟用 YouTube Data API 和 Gemini API

---

## Windows 安裝指南

### 步驟 1：安裝 Node.js

1. 前往 [Node.js 官網](https://nodejs.org/)
2. 下載 LTS 版本（建議 v18 或 v20）
3. 執行安裝程式，勾選「Add to PATH」
4. 驗證安裝：
   ```powershell
   node --version
   npm --version
   ```

### 步驟 2：安裝 yt-dlp

**方法 1：使用 winget（推薦，Windows 10/11）**
```powershell
winget install yt-dlp
```

**方法 2：使用 Chocolatey**
```powershell
# 先安裝 Chocolatey（如果還沒有）
# 以管理員身份開啟 PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安裝 yt-dlp
choco install yt-dlp
```

**方法 3：手動下載**
1. 前往 [yt-dlp Releases](https://github.com/yt-dlp/yt-dlp/releases)
2. 下載 `yt-dlp.exe`
3. 將檔案放到 `C:\Windows\System32\` 或加入 PATH

**驗證安裝**：
```powershell
yt-dlp --version
```

### 步驟 3：安裝 FFmpeg

**方法 1：使用 winget（推薦）**
```powershell
winget install FFmpeg
```

**方法 2：使用 Chocolatey**
```powershell
choco install ffmpeg
```

**方法 3：手動安裝**
1. 前往 [FFmpeg 官網](https://ffmpeg.org/download.html)
2. 下載 Windows build（推薦 gyan.dev 版本）
3. 解壓縮到 `C:\ffmpeg`
4. 將 `C:\ffmpeg\bin` 加入系統 PATH
   - 搜尋「環境變數」→「編輯系統環境變數」
   - 「環境變數」→「Path」→「新增」→ `C:\ffmpeg\bin`

**驗證安裝**：
```powershell
ffmpeg -version
```

### 步驟 4：複製專案並安裝依賴
也可以先將本專案 fork 到自己 GitHub，再 git clone，jaschiang 記得換成自己的使用者名稱
```powershell
# 複製專案
git clone https://github.com/jaschiang/ai-video-writer.git
cd ai-video-writer

# 安裝依賴
npm install
```

### 步驟 5：設定 Google Cloud API

請跳到 [Google API 設定](#google-api-設定) 章節

### 步驟 6：啟動應用程式

```powershell
# 同時啟動前端和後端
npm run dev:all
```

開啟瀏覽器前往 `http://localhost:3000`

---

## macOS 安裝指南

### 步驟 1：安裝 Homebrew（如果還沒有）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 步驟 2：安裝 Node.js

```bash
# 使用 Homebrew 安裝
brew install node@20

# 驗證安裝
node --version
npm --version
```

### 步驟 3：安裝 yt-dlp

```bash
brew install yt-dlp

# 驗證安裝
yt-dlp --version
```

### 步驟 4：安裝 FFmpeg

```bash
brew install ffmpeg

# 驗證安裝
ffmpeg -version
```

### 步驟 5：複製專案並安裝依賴
也可以先將本專案 fork 到自己 GitHub，再 git clone，jaschiang 記得換成自己的使用者名稱
```bash
# 複製專案
git clone https://github.com/jaschiang/ai-video-writer.git
cd ai-video-writer


# 安裝依賴
npm install
```

### 步驟 6：設定 Google Cloud API

請跳到 [Google API 設定](#google-api-設定) 章節

### 步驟 7：啟動應用程式

```bash
# 同時啟動前端和後端
npm run dev:all
```

開啟瀏覽器前往 `http://localhost:3000`

---

## Google API 設定

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點選「建立專案」
3. 輸入專案名稱（例如：AI Video Writer）
4. 點選「建立」

### 2. 啟用必要的 API

**啟用 YouTube Data API v3**
1. 在左側選單選擇「API 和服務」→「程式庫」
2. 搜尋「YouTube Data API v3」
3. 點選並啟用

**啟用 Generative Language API（Gemini）**
1. 搜尋「Generative Language API」
2. 點選並啟用

### 3. 建立 OAuth 2.0 憑證

**配置 OAuth 同意畫面**
1. 前往「API 和服務」→「OAuth 同意畫面」
2. 選擇「外部」用戶類型，點選「建立」
3. 填寫以下資訊：
   - 應用程式名稱：`AI Video Writer`
   - 使用者支援電子郵件：你的 Gmail
   - 開發人員聯絡資訊：你的 Gmail
4. 點選「儲存並繼續」
5. **範圍設定**：點選「新增或移除範圍」
   - 搜尋並勾選 `https://www.googleapis.com/auth/youtube`
   - 點選「更新」
6. **測試使用者**：點選「新增使用者」
   - 輸入你的 Gmail 帳號
7. 點選「儲存並繼續」

**建立 OAuth 2.0 用戶端 ID**
1. 前往「憑證」→「建立憑證」→「OAuth 2.0 用戶端 ID」
2. 應用程式類型：選擇「網頁應用程式」
3. 名稱：`AI Video Writer Web Client`
4. **授權的 JavaScript 來源**：
   - 新增：`http://localhost:3000`
5. **授權的重新導向 URI**：
   - 新增：`http://localhost:3000`
6. 點選「建立」
7. **複製「用戶端 ID」**（格式類似：`123456789-abc.apps.googleusercontent.com`）

### 4. 取得 Gemini API Key

1. 前往「API 和服務」
2. 點選「憑證」
3. 點選「建立憑證」中的「API 金鑰」
4. 輸入金鑰名稱
5. 限制金鑰只能使用「Generative Language API」後按建立
6. **複製 API 金鑰**（格式類似：`AIzaSy...`）

### 5. 建立環境變數檔案

參考 `.env.example` 在專案根目錄建立 `.env.local` 檔案：

**Windows（PowerShell）**
```powershell
New-Item -Path .env.local -ItemType File
notepad .env.local
```

**macOS/Linux**
```bash
touch .env.local
nano .env.local
```

**填入以下內容**：
```env
# Gemini AI API 金鑰（用於後端，必需）
GEMINI_API_KEY=你的_Gemini_API_金鑰

# YouTube OAuth 2.0 用戶端 ID（用於前端，必需）
YOUTUBE_CLIENT_ID=你的_用戶端_ID.apps.googleusercontent.com

# YouTube Data API 金鑰（可選，目前未使用）
# 註：本專案使用 OAuth 2.0 認證存取 YouTube Data API v3
# 因為需要存取使用者的私人影片並更新影片資訊，不需要 API Key
# YOUTUBE_API_KEY=你的_YouTube_API_金鑰
```

**重要提醒**：
- 請將上面的「你的_XXX」替換為實際的金鑰
- 只需填寫 `GEMINI_API_KEY` 和 `YOUTUBE_CLIENT_ID`，不需要填寫 `YOUTUBE_API_KEY`
- `.env.local` 已被 `.gitignore` 忽略，不會提交到版本控制
- **切勿**將此檔案公開分享或上傳到 GitHub

---

## 📚 詳細使用教學

### 初次使用

1. **啟動應用程式**
   ```bash
   npm run dev:all
   ```

2. **登入 YouTube**
   - 開啟 `http://localhost:3000`
   - 點選「Sign in with Google」
   - 授權應用程式存取你的 YouTube 頻道
   - 登入成功後會看到你的影片列表

3. **選擇影片**
   - 預設顯示公開影片
   - 可勾選「顯示未公開影片」或「顯示私人影片」
   - 使用搜尋框快速查找影片

### 使用功能 1：生成 SEO 中繼資料（Metadata）

1. 在影片卡片上點選「生成中繼資料（Metadata）」
2. （可選）輸入額外提示，例如：
   - 「目標受眾是初學者」
   - 「使用輕鬆口語化的風格」
   - 「必須包含關鍵字：AI 工具」
3. 點選「使用 Gemini 生成內容」
4. 等待 AI 分析（通常 10-30 秒）
5. 查看生成結果：
   - 三個標題選項（可點選切換）
   - 完整影片說明
   - 5-10 個標籤
6. 編輯內容（可自由修改）
7. 點選「Update」直接更新到 YouTube

**小技巧**：
- 首次生成會下載影片（未列出/私人影片），之後會重複使用已上傳的檔案
- 可多次生成不同風格的內容，不需重新下載影片

### 使用功能 2：生成文章與截圖

**階段 1：生成文章文字**
1. 在影片卡片上點選「生成文章」
2. （可選）輸入額外提示，例如：
   - 「適合技術部落格」
   - 「包含實作步驟」
   - 「使用專業術語」
3. 點選「開始生成文章」
4. 等待生成（通常 20-60 秒）
5. 查看文章內容：
   - 三個標題選項
   - SEO 描述
   - 完整文章內容（Markdown 格式）

**階段 2：生成截圖（可選）**
1. 在文章結果頁面點選「生成截圖」
2. AI 會自動識別關鍵畫面並截圖
3. 等待截圖完成（時間取決於影片長度）
4. 查看圖文並茂的完整文章

**輸出選項**：
- 點選「複製文章」：複製純文字 Markdown
- 點選「複製 HTML」：複製帶圖片的 HTML 格式
- 直接貼到你的部落格或內容管理系統

---

## 🏗️ 技術架構

### 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                    使用者瀏覽器                              │
│                  (http://localhost:3000)                     │
│                                                               │
│  - React 前端應用                                            │
│  - YouTube OAuth 認證                                        │
│  - 影片列表管理                                              │
│  - 內容編輯器                                                │
└────────────────┬──────────────────────────────────┬─────────┘
                 │                                  │
                 ↓                                  ↓
    ┌────────────────────────┐        ┌────────────────────────┐
    │  YouTube Data API v3   │        │  後端 Express Server   │
    │                        │        │  (Port 3001)           │
    │  - OAuth 認證          │←──────→│                        │
    │  - 影片列表            │        │  - yt-dlp 下載         │
    │  - 中繼資料（Metadata）更新          │        │  - Gemini File API     │
    │                        │        │  - FFmpeg 截圖         │
    └────────────────────────┘        │  - 內容快取            │
                                      └────────┬───────────────┘
                                               │
                                               ↓
                                      ┌────────────────┐
                                      │  Gemini API    │
                                      │                │
                                      │  - 影片分析    │
                                      │  - 內容生成    │
                                      │  - 智慧快取    │
                                      └────────────────┘
```

### 技術棧

**前端**
- React 19.2.0 - UI 框架
- TypeScript 5.8.2 - 類型安全開發
- Vite 6.2.0 - 快速建置工具
- Tailwind CSS - Utility-first CSS（內聯樣式）

**後端**
- Node.js (ES Modules) - JavaScript 執行環境
- Express 4.18.2 - RESTful API 框架
- @google/genai 1.26.0 - Gemini AI SDK
- dotenv 16.4.5 - 環境變數管理
- cors 2.8.5 - 跨域資源共享

**外部工具**
- yt-dlp - YouTube 影片下載
- FFmpeg - 影片截圖處理

**Google APIs**
- YouTube Data API v3 - 影片管理
- Gemini 2.5 Flash - AI 內容生成
- Gemini File API - 影片檔案管理

---

## 📁 專案結構

```
ai-video-writer/
├── 前端相關
│   ├── index.html                     # HTML 模板
│   ├── index.tsx                      # React 進入點
│   ├── App.tsx                        # 主應用程式控制器
│   ├── config.ts                      # 前端配置
│   ├── types.ts                       # TypeScript 型別定義
│   │
│   ├── components/                    # React 元件
│   │   ├── YouTubeLogin.tsx           # Google OAuth 登入
│   │   ├── VideoSelector.tsx          # 影片網格與分頁
│   │   ├── VideoCard.tsx              # 影片卡片
│   │   ├── VideoDetailPanel.tsx       # 影片詳情面板
│   │   ├── MetadataGenerator.tsx      # SEO 中繼資料（Metadata）生成器
│   │   ├── ArticleGenerator.tsx       # 文章生成器
│   │   ├── Header.tsx                 # 頁面標題
│   │   └── [其他 UI 元件]
│   │
│   ├── hooks/                         # React Hooks
│   │   └── useOrientation.ts          # 螢幕方向偵測
│   │
│   ├── utils/                         # 工具函數
│   │   └── formatters.ts              # 格式化工具
│   │
│   └── services/                      # 前端服務層
│       ├── youtubeService.ts          # YouTube Data API（OAuth 認證）
│       ├── videoApiService.ts         # 後端 API 客戶端
│       └── geminiService.ts           # 影片分析業務邏輯層（策略封裝）
│
├── 後端相關
│   ├── server.js                      # Express 主伺服器
│   │
│   └── services/                      # 後端服務
│       ├── promptService.js           # 中繼資料（Metadata）提示詞（包含完整 prompt）
│       └── articlePromptService.js    # 文章提示詞（包含完整 prompt）
│
├── 設定檔
│   ├── vite.config.ts                 # Vite 建置設定
│   ├── tsconfig.json                  # TypeScript 設定
│   ├── package.json                   # 專案依賴與腳本
│   ├── .env.local                     # 環境變數（不納入版控）
│   └── .gitignore                     # Git 忽略清單
│
├── 執行時目錄（自動建立）
│   ├── temp_videos/                   # 暫存影片
│   └── public/images/                 # 截圖存放
│
└── 文件
    └── README.md                      # 專案說明（本檔案）
```

### 關鍵檔案說明

| 檔案 | 行數 | 功能 |
|------|------|------|
| **server.js** | ~1270 行 | Express 主伺服器，處理所有後端邏輯 |
| **App.tsx** | ~270 行 | React 主控制器，管理登入與影片列表 |
| **MetadataGenerator.tsx** | ~325 行 | SEO 中繼資料（Metadata）生成器 |
| **ArticleGenerator.tsx** | ~345 行 | 文章生成器（兩階段流程） |
| **promptService.js** | ~95 行 | SEO 中繼資料（Metadata）提示詞 |
| **articlePromptService.js** | ~60 行 | 文章生成提示詞服務 |

---

## 🛠️ 自訂調整指南

### 調整 AI 生成內容的風格

**位置**：`/services/promptService.js`（SEO 中繼資料（Metadata））

**可調整內容**：
```javascript
// 第 15-50 行：角色定位與指導原則
你是頂尖的 YouTube SEO 策略師 → 改為：你是專業的內容行銷專家
使用台灣慣用詞彙 → 改為：使用香港慣用詞彙
```

**範例**：改變標題風格偏好
```javascript
// 原本
titleA: 關鍵字導向
titleB: 懸念導向
titleC: 效益導向

// 改為
titleA: 專業教學型
titleB: 幽默娛樂型
titleC: 問題解決型
```

---

**位置**：`/services/articlePromptService.js`（文章生成）

在 `generateArticlePrompt` 函數（第 12-58 行）中修改提示詞內容。

**可調整內容**：
```javascript
// 第 13 行：角色與風格
你是一位專業的科技內容顧問 → 改為：你是專業的科技評測作家
擅長將複雜的科技知識轉化為讀者能輕易理解 → 改為：擅長撰寫輕鬆有趣的開箱文
```

**範例**：改變文章長度（第 39-41 行）
```javascript
// 原本
- 前言：100-150 字，點出需求痛點
- 主體：3-5 個段落，每段包含 ## 小標題與敘述性內文
- 總結：約 100 字

// 改為
- 前言：50-80 字（簡短有力）
- 主體：6-8 個段落（更詳細）
- 總結：約 150 字（更完整）
```

### 調整截圖數量

**位置**：`/services/articlePromptService.js`（第 45-47 行）

修改提示詞中的截圖數量要求：

```javascript
// 原本（第 45 行）
**截圖時間點**：3-5 個關鍵畫面

// 改為（較多截圖）
**截圖時間點**：5-8 個關鍵畫面

// 改為（更多截圖）
**截圖時間點**：8-12 個關鍵畫面
```

**或在後端程式碼中限制**：檢查 `server.js` 中處理截圖的部分，可以加入數量限制：
```javascript
// 限制最多 10 張截圖
const screenshots = parsedScreenshots.screenshots.slice(0, 10);
```

### 調整影片下載品質

**位置**：`server.js` 第 105 行或第 558 行（兩個下載函數）

```javascript
// 原本：最高 720p
'-f', '"best[height<=720][ext=mp4]/best[height<=720]/best"'

// 改為：最高 1080p（檔案較大）
'-f', '"best[height<=1080][ext=mp4]/best[height<=1080]/best"'

// 改為：最高 480p（檔案較小）
'-f', '"best[height<=480][ext=mp4]/best[height<=480]/best"'
```

### 調整截圖品質

**位置**：`server.js` 第 615、860、1116 行（多個截圖函數）

```javascript
// 原本：預設品質（第 860 行範例）
await execAsync(`ffmpeg -i "${filePath}" -ss ${targetTime} -vframes 1 "${outputPath}" -y`);

// 改為：高品質（檔案較大）
await execAsync(`ffmpeg -i "${filePath}" -ss ${targetTime} -vframes 1 -q:v 1 "${outputPath}" -y`);

// 改為：壓縮品質（檔案較小，第 1116 行已使用）
await execAsync(`ffmpeg -i "${filePath}" -ss ${targetTime} -vframes 1 -q:v 2 "${outputPath}" -y`);
```

**說明**：`-q:v` 參數範圍 1-31，數字越小品質越高（目前第 1116 行已使用 `-q:v 2`）

### 調整前端 Port

**位置**：`vite.config.ts`

```typescript
export default defineConfig({
  server: {
    port: 3000,  // 改為其他 port，例如 5173
    host: '0.0.0.0',
  },
  // ...
});
```

### 調整後端 Port

**位置**：`server.js:17`

```javascript
const PORT = 3001;  // 改為其他 port，例如 4000
```

**同時需要修改**：`services/videoApiService.ts:8`
```typescript
const API_BASE_URL = 'http://localhost:3001/api';  // 改為對應的 port
```

### 自訂 YouTube 範圍（Scopes）

**位置**：`config.ts`

```typescript
// 原本：完整 YouTube 管理權限
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube';

// 改為：唯讀權限（無法更新影片）
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

// 改為：僅上傳權限
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.upload';
```

### 新增自訂提示詞欄位

**前端**：`MetadataGenerator.tsx` 或 `ArticleGenerator.tsx`

找到這段程式碼：
```typescript
<textarea
  value={additionalPrompt}
  onChange={(e) => setAdditionalPrompt(e.target.value)}
  placeholder="輸入額外提示..."
/>
```

**後端**：提示詞會透過 `userPrompt` 參數傳遞到 `promptService.js` 或 `articlePromptService.js`

**範例**：在提示詞中使用使用者輸入
```javascript
export function generateFullPrompt(videoTitle, userPrompt) {
  const additionalInstructions = userPrompt
    ? `\n\n額外要求：${userPrompt}`
    : '';

  return `你是頂尖的 YouTube SEO 策略師...${additionalInstructions}`;
}
```

---

## 🐛 疑難排解

### Windows 常見問題

#### Q1: yt-dlp 指令找不到

**錯誤訊息**：
```
'yt-dlp' is not recognized as an internal or external command
```

**解決方法**：
1. 確認已安裝 yt-dlp：`winget install yt-dlp`
2. 重新開啟 PowerShell/命令提示字元
3. 檢查 PATH：`echo $env:PATH`（PowerShell）或 `echo %PATH%`（CMD）
4. 手動加入 PATH（如果使用手動安裝）

#### Q2: FFmpeg 指令找不到

**解決方法**：同 Q1，確保 FFmpeg 的 `bin` 目錄已加入 PATH

#### Q3: 權限不足無法執行腳本

**錯誤訊息**：
```
cannot be loaded because running scripts is disabled on this system
```

**解決方法**（以管理員身份執行 PowerShell）：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Q4: Port 被佔用

**錯誤訊息**：
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決方法**：
```powershell
# 查找佔用 port 的程式
netstat -ano | findstr :3000

# 終止程式（PID 為上一步的最後一欄）
taskkill /PID <PID> /F
```

---

### macOS/Linux 常見問題

#### Q1: yt-dlp 或 FFmpeg 指令找不到

**解決方法**：
```bash
# 確認已安裝
brew list | grep yt-dlp
brew list | grep ffmpeg

# 如果沒有，安裝
brew install yt-dlp ffmpeg

# 重新載入 shell 配置
source ~/.zshrc  # 或 source ~/.bashrc
```

#### Q2: Port 被佔用

**解決方法**：
```bash
# 查找佔用 port 的程式
lsof -i :3000

# 終止程式
kill -9 <PID>
```

#### Q3: 權限錯誤無法寫入檔案

**錯誤訊息**：
```
EACCES: permission denied
```

**解決方法**：
```bash
# 檢查目錄權限
ls -la

# 修正權限
chmod -R 755 temp_videos public/images

# 或使用 sudo（不建議）
sudo npm run dev:all
```

---

### 通用問題

#### Q1: Gemini API 錯誤 (403 Forbidden)

**可能原因**：
- API 未啟用
- API 金鑰錯誤
- 配額已用盡

**解決步驟**：
1. 確認 [Generative Language API](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com) 已啟用
2. 檢查 `.env.local` 中的 `GEMINI_API_KEY` 是否正確
3. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey) 確認金鑰
4. 檢查 [API 配額](https://console.cloud.google.com/apis/dashboard)
5. 重新啟動後端伺服器：`npm run server`

#### Q2: YouTube OAuth 登入失敗

**錯誤訊息**：
```
redirect_uri_mismatch
```

**解決步驟**：
1. 前往 [Google Cloud Console - 憑證](https://console.cloud.google.com/apis/credentials)
2. 編輯 OAuth 2.0 用戶端 ID
3. 確認「授權的 JavaScript 來源」包含：
   - `http://localhost:3000`
4. 確認「授權的重新導向 URI」包含：
   - `http://localhost:3000`
5. 儲存後等待 1-2 分鐘
6. 清除瀏覽器快取（Ctrl+Shift+Delete / Cmd+Shift+Delete）
7. 重新登入

#### Q3: 影片下載失敗（未列出影片）

**錯誤訊息**：
```
ERROR: Video unavailable
```

**可能原因**：
- YouTube 反爬蟲機制
- yt-dlp 版本過舊
- 影片有地區限制

**解決方法**：
```bash
# 更新 yt-dlp 到最新版
# Windows
winget upgrade yt-dlp

# macOS
brew upgrade yt-dlp

# 跨平台（如果使用 pip）
pip install -U yt-dlp

# 重新啟動伺服器
npm run dev:all
```

#### Q4: 截圖生成失敗

**錯誤訊息**：
```
FFmpeg is not installed
```

**解決方法**：
1. 確認 FFmpeg 已安裝：`ffmpeg -version`
2. 如果沒有，請按照上方安裝指南安裝
3. 重新啟動後端伺服器

#### Q5: 環境變數未生效

**檢查清單**：
- [ ] 檔案名稱是 `.env.local`（不是 `.env` 或 `env.local`）
- [ ] 格式正確（`KEY=value`，等號兩邊無空格）
- [ ] 已重新啟動開發伺服器
- [ ] 檔案位於專案根目錄（與 `package.json` 同層）

**驗證方法**：
```bash
# Windows
type .env.local

# macOS/Linux
cat .env.local
```

#### Q6: 前端無法連接後端

**檢查項目**：
1. 後端是否正在運行：
   ```bash
   # 應該看到 "Server running on http://localhost:3001"
   npm run server
   ```
2. 檢查後端 Port 設定：`server.js:17`
3. 檢查前端 API URL：`services/videoApiService.ts:8`
4. 開啟瀏覽器開發者工具 → Network，查看請求是否成功
5. 檢查 CORS 設定：`server.js:28`（應為 `app.use(cors())`）

#### Q7: Token 配額不足

**錯誤訊息**：
```
Quota exceeded
```

**解決方法**：
1. 檢查 [Gemini API 配額](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
2. 等待配額重置（通常每日或每分鐘）
3. 升級到付費方案（如需更高配額）
4. 減少影片分析頻率，避免短時間內大量請求

---

## 🔒 安全性說明

### API Key 保護機制

本專案已實施完整的 API Key 安全保護，確保敏感資訊不會暴露。

#### ✅ 已實施的安全措施

1. **前後端分離架構**
   ```
   瀏覽器（前端）
       ↓ 只包含 YOUTUBE_CLIENT_ID（OAuth，可公開）
       ↓ 呼叫後端 API
   後端伺服器（Node.js）
       ↓ 使用 GEMINI_API_KEY 呼叫 Gemini API
   Google AI Services
   ```

2. **環境變數隔離**
   - 敏感資訊儲存在 `.env.local`
   - `.env.local` 已加入 `.gitignore`，不會提交到版本控制
   - 後端透過 `dotenv` 載入環境變數

3. **前端編譯檢查**
   - `GEMINI_API_KEY` 僅在後端使用，不注入前端
   - 前端編譯後的 JavaScript 不含 API Keys
   - 可使用 `grep` 指令驗證：
     ```bash
     grep -r "GEMINI_API_KEY" dist/  # 應找不到任何結果
     ```

4. **OAuth 2.0 標準流程**
   - `YOUTUBE_CLIENT_ID` 可以安全地暴露在前端（這是 OAuth 2.0 的標準做法）
   - 使用者授權後取得臨時 access token
   - Token 僅存於瀏覽器記憶體，不儲存於後端

5. **檔案管理安全**
   - 影片下載至 `temp_videos/`，分析後自動刪除
   - `*.mp4` 和 `*.webm` 已加入 `.gitignore`
   - 截圖存放在 `public/images/`，僅供本地存取

6. **輸入驗證機制**（防止 Command Injection）
   - 所有 API 端點都會驗證 `videoId` 格式
   - 嚴格限制為 11 個字元，僅允許 `[a-zA-Z0-9_-]`
   - 阻擋特殊字元（`;`, `|`, `&`, `$`, `` ` ``, `(`, `)` 等）
   - **詳細測試方法請參考**：[SECURITY_TESTING.md](./SECURITY_TESTING.md)

### 安全性檢查清單

開源前請確認：

- [x] `.env.local` 已加入 `.gitignore`
- [x] 沒有將 API Keys 寫死（hard-coding）在程式碼中
- [x] `dist/` 資料夾不包含 API Keys
- [x] `temp_videos/` 和 `public/images/` 已加入 `.gitignore`
- [x] README 中沒有包含真實的 API Keys（僅有範例）
- [x] Git 歷史記錄中沒有敏感資訊
- [x] 所有 API 端點都有輸入驗證（防止 Command Injection）
- [x] 已執行安全性測試（參考 `SECURITY_TESTING.md`）

### 檢查 Git 歷史記錄

**重要**：在開源前，請確保 Git 歷史記錄中沒有敏感資訊

```bash
# 檢查 Git 歷史中是否有 .env.local
git log --all --full-history -- .env.local

# 如果發現有提交過，需要清理歷史記錄
# 警告：這會改寫 Git 歷史，請謹慎操作
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all
```

### 最佳實踐建議

1. **定期更換 API 金鑰**（每 3-6 個月）
2. **在 Google Cloud Console 設定 API 使用限制**：
   - 前往 [API 憑證](https://console.cloud.google.com/apis/credentials)
   - 編輯 API 金鑰
   - 設定「應用程式限制」：
     - HTTP referrer：`http://localhost:3000/*`（開發環境）
     - IP 位址：你的伺服器 IP（生產環境）
   - 設定「API 限制」：
     - 僅限特定 API：`Generative Language API`、`YouTube Data API v3`

3. **啟用 API 配額監控**：
   - 前往 [配額頁面](https://console.cloud.google.com/apis/dashboard)
   - 設定配額警示

4. **生產環境部署建議**：
   - 使用 HTTPS（必須）
   - 設定環境變數（不使用 `.env` 檔案）
   - 使用專屬的 Google Cloud 專案
   - 限制 CORS 來源
   - 實施 rate limiting

5. **不要在公開場合展示**：
   - `.env.local` 檔案內容
   - Google Cloud Console 截圖（含 API Keys）
   - API 請求的完整 URL（可能含 token）

---

## 可用指令

| 指令 | 說明 |
|------|------|
| `npm install` | 安裝所有依賴套件 |
| `npm run dev` | 僅啟動前端（Port 3000） |
| `npm run server` | 僅啟動後端（Port 3001） |
| `npm run dev:all` | **同時啟動前後端（推薦）** |
| `npm run build` | 建置生產版本（輸出到 `dist/`） |
| `npm run preview` | 預覽建置結果 |

---

## 📄 授權與免責聲明

### 使用條款

- ✅ **允許**：個人使用、學習、修改、商業使用
- ✅ **允許**：用於個人或商業頻道的內容改善
- ❌ **禁止**：大規模批量下載他人影片
- ❌ **禁止**：違反 YouTube 服務條款的行為
- ❌ **禁止**：用於製作誤導性或惡意內容

### 第三方服務條款

使用本工具即表示你同意遵守：
- [YouTube 服務條款](https://www.youtube.com/t/terms)
- [Google API 服務使用條款](https://developers.google.com/terms)
- [Gemini API 服務條款](https://ai.google.dev/terms)

### 免責聲明

- 本工具不保證生成內容的絕對準確性
- 使用者需自行承擔內容發布的責任
- 開發者不對因使用本工具造成的任何損失負責
- 生成的內容可能需要人工審核和編輯
- 請遵守所在地區的法律法規和平台規範

### 隱私權

- 本工具不收集或儲存使用者資料
- YouTube OAuth token 僅存於瀏覽器記憶體
- 影片檔案僅臨時儲存於本地，處理完畢後自動刪除
- Gemini API 的資料處理請參考 [Google 隱私權政策](https://policies.google.com/privacy)

---

## 🌟 相關資源

### 官方文件
- [Google Cloud Console](https://console.cloud.google.com/)
- [Gemini API 文件](https://ai.google.dev/docs)
- [YouTube Data API 文件](https://developers.google.com/youtube/v3)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg 官網](https://ffmpeg.org/)

### 學習資源
- [YouTube Creator Academy](https://creatoracademy.youtube.com/)
- [Google AI Studio](https://makersuite.google.com/)
- [React 官方文件](https://react.dev/)
- [Vite 官方文件](https://vitejs.dev/)

### 問題回報

如遇到問題或有功能建議，請：
1. 查閱本 README 的 [疑難排解](#-疑難排解) 章節
2. 查看程式碼註解和檔案說明了解技術細節
3. 在 GitHub Issues 提出問題（請附上錯誤訊息和環境資訊）

---

## 🙏 致謝

本專案使用了以下優秀的開源專案與服務：

- **[React](https://react.dev/)** - UI 框架
- **[Vite](https://vitejs.dev/)** - 建置工具
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - 影片下載工具
- **[FFmpeg](https://ffmpeg.org/)** - 多媒體處理工具
- **[Google Gemini AI](https://ai.google.dev/)** - AI 模型
- **[YouTube Data API](https://developers.google.com/youtube)** - YouTube API
- **[Express](https://expressjs.com/)** - Node.js 框架
- **[TypeScript](https://www.typescriptlang.org/)** - 類型安全的 JavaScript

---

<div align="center">

**Powered by Google Gemini AI**

如果這個專案對你有幫助，請給個 ⭐ Star！

Made with ❤️ for content creators

---

Created by [@jaschiang](https://www.linkedin.com/in/jascty/)

</div>
