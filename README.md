# AI Video Writer

AI Video Writer 是一個以 YouTube 影片為核心的內容再利用平台，結合 Google Gemini / OpenRouter 等 AI 模型，將影片轉換為 SEO 文章、影片中繼資料，並提供頻道與影片的數據洞察與優化建議。

## 核心功能

- 影片文章生成：從 YouTube 影片內容生成長文，並擷取關鍵畫面作為配圖。
- 影片中繼資料生成：批次產出標題、描述、關鍵字與發布建議。
- 影片/頻道分析：整合 YouTube Analytics，提供儀表板與 AI 分析報告。
- 關鍵字與內容策略分析：提供內容策略、觀眾洞察與成長建議。
- 多模型 AI 分析：支援 Gemini 與 OpenRouter，包含串流分析流程。
- 影片快取與配額優化：透過 GitHub Gist 快取影片清單，降低 API 配額消耗。
- Notion 發佈：將生成文章與素材直接發佈到 Notion。

## 技術概覽

- 前端：React + Vite
- 後端：Node.js + Express
- 影片處理：yt-dlp、FFmpeg
- AI 模型：Google Gemini、OpenRouter
- 數據來源：YouTube Data API、YouTube Analytics API

## 快速開始

請先完成環境設定與 API 權限。完整步驟與變數列表請見 `docs/SETUP.md`。

### Docker（建議）

```bash
git clone https://github.com/JasChiang/ai-video-writer.git
cd ai-video-writer
cp .env.example .env.local
./docker-start.sh
```

### 本機開發

```bash
npm install
cp .env.example .env.local
npm run dev
npm run server
```

## 文件導覽

- `docs/OVERVIEW.md`：功能與使用情境
- `docs/SETUP.md`：環境變數、API 設定、OAuth
- `docs/ARCHITECTURE.md`：系統與模組架構
- `docs/API.md`：後端 API 端點總覽
- `docs/OPERATIONS.md`：快取、配額、排程、維運
- `docs/TESTING.md`：測試與腳本
- `docs/TROUBLESHOOTING.md`：常見問題
- `docs/SECURITY.md`：安全性與權限

## 開發指令

```bash
npm run dev            # 前端開發伺服器
npm run server         # 後端 API
npm run update-cache   # 更新影片快取
```

## 授權

MIT License
