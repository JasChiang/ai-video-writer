# Changelog

所有重要的版本變更都會記錄在此文件。

---

## 2026-04-15 — 後端存取控制與安全強化

### 新增
- **JWT session 驗證**：所有 `/api/*` 路由統一需要 session JWT，未帶 JWT 的請求一律回傳 401；即使知道 Render 網址也無法呼叫任何 API
- **YouTube Channel ID 白名單**：登入時後端向 YouTube API 確認頻道 ID，只有 `ALLOWED_CHANNEL_IDS` 中的頻道才能取得 JWT；避免 YouTube 品牌帳號特殊 email 造成的相容性問題
- **前端全域 fetch interceptor**：所有 `/api/*` 請求自動帶入 `Authorization: Bearer <jwt>` header
- **CORS 收窄**：只接受 `ALLOWED_ORIGINS` 環境變數指定的來源

### 修正（安全）
- **filePath 路徑穿越漏洞**：上傳相關端點加入 `validateFilePath()` 驗證，防止讀取伺服器任意檔案
- **task 回傳洩漏 accessToken**：`GET /api/task/:taskId` 回傳前移除敏感參數
- **Notion OAuth state 驗證**：POST callback 補上 CSRF 防護
- **Notion OAuth postMessage origin 驗證**：限制只能傳回已知來源

---

## 2026-04-15 — AI 數據分析（自然語言對話）

### 新增
- **AI 分析分頁**：頻道分析下新增「AI 分析」分頁，支援自然語言輸入需求
- **LLM Tool Calling**：AI 透過 function calling 自動決定查哪些數據，不需手動設定
- **模型選單**：前端右上角可切換模型（Gemini 2.5 Flash/Pro 或 OpenRouter 上的 Claude、GPT-4o 等）
- **新增工具 `get_channel_analytics`**：查詢整個頻道在指定時間範圍的總體數據（觀看數、訂閱增減、流量來源、地區分布），不需要 video ID
- **新增工具 `search_videos_by_keyword`**：從 Gist 快取搜尋影片（零配額消耗）
- **新增工具 `get_video_analytics`**：取得最多 50 支影片的詳細數據
- **新增工具 `get_retention_curve`**：取得單支影片的觀眾留存率曲線
- **SSE 串流**：AI 分析過程狀態即時回傳（「執行工具：get_channel_analytics...」）
- **圖表渲染**：AI 輸出結構化 JSON，前端用 react-chartjs-2 渲染長條圖與留存率曲線
- 關鍵字報表 UI 重構：設定合併成單張卡片、日期改為下拉選單（自訂才顯示文字輸入）、指標改為 toggle pills
- 移除「數據洞察」頂層分頁，頻道分析整合為「儀表板 / AI 分析 / 關鍵字報表」三分頁

### 修正
- Gemini 幻覺問題：將 system prompt 從 `user` 訊息移到 `systemInstruction` 參數，避免 AI 自行捏造工具呼叫與假數據
- `analyticsTools.js` import 名稱錯誤（`recordQuotaServer` → `recordQuota`）
- 後端根據 model ID 前綴（`gemini-*`）決定走 Gemini 或 OpenRouter，而非依 API key 存在判斷
- Gist 快取頻道 ID 驗證：載入快取時比對當前登入頻道，不符則略過快取改抓最新數據

---

## 2025 — 多模型支援與頻道分析

### 新增
- 多模型 AI 分析：支援 Gemini 2.5 Flash/Pro（直接 API）及 Claude、GPT（透過 OpenRouter）
- 關鍵字分析報表 AI 智慧分析功能，SSE 串流輸出
- 訂閱來源分析：影片展開功能（桌面版前三名）
- 訂閱數卡片顯示期間結束日總訂閱數
- 影片卡片展開功能（頻道儀表板）
- Notion 資料庫 API 端點、OAuth GET callback 處理器

### 修正
- Gemini API 處理長影片時的超時錯誤
- MoM / YoY 計算方式
- 日期比較邏輯與整年選擇
- 部分數據不屬於所選期間的問題
- 分析報告圖表顯示
- Notion 發佈、截圖上傳、OAuth 問題
- 文章生成參考資料功能
- 自訂模板狀態管理與顯示

---

## 頻道分析功能（移植自獨立分支）

### 新增
- 影片表現分析儀表板：整合 YouTube Analytics API，支援多時間範圍比較
- AI 數據洞察：透過 AI 分析頻道指標並給出策略建議
- 關鍵字分析：搜尋詞表現報表，對齊 YouTube Studio 百分比計算
- 懶載入搜尋詞與外部流量來源明細
- 切換頻道後可重新分析頻道數據

---

## 影片快取與 API 配額優化

### 新增
- GitHub Gist 影片快取：將頻道影片資料存入 Gist，搜尋免消耗 YouTube API 配額
- GitHub Actions 自動排程：每天自動更新快取到 Gist
- API 配額用量顯示介面
- 快取綁定至當前使用頻道

### 改進
- 中繼資料修改方式節省 API 配額

---

## Notion 整合

### 新增
- 文章一鍵發佈至 Notion 資料庫
- 截圖自動上傳至 Notion
- 支援 Internal Integration Token 與 OAuth 兩種授權方式

---

## 非同步任務系統

### 新增
- 非同步任務佇列：解決手機瀏覽器背景執行時長時間操作中斷問題
- 任務狀態追蹤與 SSE 串流進度回報

---

## 文章生成

### 新增
- 檔案上傳支援（圖片、PDF、Markdown）作為文章生成的參考資料
- 截圖品質選擇功能（前端控制）
- 截圖生成與文章生成流程分離（不再同步進行）

### 修正
- 未公開 YouTube 影片下載機制（yt-dlp android client 限制）
- yt-dlp 下載解析度問題

---

## 基礎建設

### 新增
- Docker 支援（`docker-compose.yml`、`docker-start.sh`）
- 啟動時自動清理過期暫存檔案（`temp_videos`、`public/images`）
- 前端執行期設定載入機制（`window.__APP_CONFIG__`），確保 Docker/打包環境能正確初始化 YouTube OAuth
- RWD 響應式版面調整

### 改進
- 程式碼品質與安全性強化（防止 Command Injection、XSS）
- 應用程式更名為 AI Video Writer

---

## 初始版本

### 新增
- YouTube 影片列表（公開、未公開、私人）
- Gemini AI 驅動的 SEO 中繼資料生成（標題三選一、說明、關鍵字標籤）
- 一鍵更新中繼資料至 YouTube
- 圖文文章生成（含 FFmpeg 自動截圖）
- 支援 Markdown 與 HTML 輸出格式
- Google OAuth 2.0 登入
