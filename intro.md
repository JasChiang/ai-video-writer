# AI-Video-Writer 專案詳細介紹

## 1. 專案概覽 (Project Overview)

`AI-Video-Writer` 是一個專為 YouTube 創作者設計的一站式 AI 輔助工具。它深度整合了 Google Gemini 的生成式 AI 技術與 YouTube 的數據分析能力，旨在徹底改變內容創作的工作流程，將創作者從繁瑣的重複性工作中解放出來，使其能更專注於核心創意與內容品質。

- **目標使用者**: YouTube 影片創作者，包含個人經營者與團隊。
- **解決的核心問題**:
    1.  **靈感枯竭與數據分析困難**: 創作者難以從複雜的後台數據中找到有效的內容方向。
    2.  **內容製作耗時**: 撰寫腳本、構思標題、撰寫描述等前置作業佔據了大量寶貴時間。
- **核心理念**: 打造一位全天候的「智慧內容創作夥伴」，透過自動化與智慧化，提升創作效率與內容的市場競爭力。

---

## 2. 技術棧 (Technology Stack)

本專案採用了現代化的前後端分離架構，確保了系統的靈活性、安全性與可擴展性。

- **前端 (Frontend)**:
    - **框架**: React (v18+) with TypeScript
    - **建置工具**: Vite
    - **UI 元件庫**: (未指定，但推測為自訂元件)
    - **API 客戶端**: Axios 或 Fetch API

- **後端 (Backend)**:
    - **環境**: Node.js
    - **框架**: Express.js
    - **語言**: JavaScript (ESM) & TypeScript

- **外部服務 (External Services & APIs)**:
    - **AI 模型**: Google Gemini API
    - **影片平台**: YouTube Data API v3, YouTube Analytics API
    - **內容管理**: Notion API
    - **數據託管**: GitHub Gist API

---

## 3. 核心功能詳解 (Detailed Core Features)

以下將詳細拆解專案的每一項核心功能、其實現方式與背後的邏輯。

### 3.1 使用者認證與 YouTube 整合 (User Authentication & YouTube Integration)

- **功能描述**:
  使用者可以透過自己的 Google 帳號安全地登入，並授權應用程式存取其 YouTube 頻道的相關數據。這是使用所有功能的基礎。
- **實現方式**:
    - **前端**: `YouTubeLogin.tsx` 元件提供一個登入按鈕，點擊後將使用者導向後端設定的 Google OAuth 2.0 授權頁面。
    - **後端**: `server.js` 中設定了 `/auth/google` 和 `/auth/google/callback` 路由，使用 `googleapis` 函式庫處理 OAuth 2.0 流程。`services/youtubeTokenService.js` 負責安全地儲存與管理 `refresh_token`，以便在背景執行影片快取更新等任務。

### 3.2 頻道與影片數據分析 (Channel & Video Data Analytics)

- **功能描述**:
  提供視覺化的儀表板，展示頻道的整體表現以及單一影片的詳細數據。此功能的回應速度極快，因其數據來源於一個定期自動更新的 Gist 快取，而非直接請求 YouTube API。
- **實現方式**:
    - **前端**: `ChannelAnalytics.tsx` 和 `VideoAnalytics.tsx` 等元件在載入時，會向後端 API 請求數據。
    - **後端**: `services/youtubeService.ts` 會優先呼叫 `videoCacheService.ts`。此服務並非直接請求 YouTube，而是從一個指定的 Gist URL 獲取預先生成的快取數據。（詳見 3.7 節）
- **邏輯流程**:
    1.  前端分析頁面載入，向後端 API 發送請求。
    2.  後端 `youtubeService` 呼叫 `videoCacheService`。
    3.  `videoCacheService` 向 Gist 的 Raw URL 發送 HTTP 請求，獲取最新的快取數據。
    4.  數據幾乎瞬時返回給前端，前端將其渲染成圖表或列表。

### 3.3 AI 腳本與內容生成 (AI Script & Content Generation)

- **功能描述**:
  專案的殺手級功能。使用者可以選擇影片或輸入主題，利用 AI 自動生成影片腳本、標題、描述等。AI 的行為由一套使用者可完全自訂的私有提示詞模板系統指導。
- **實現方式**:
    - **前端**: `ArticleGenerator.tsx` 和 `MetadataGenerator.tsx` 提供操作介面。
    - **後端**: `server.js` 提供 `/api/gemini/generate-article` 等路由。`services/geminiService.ts` 負責與 Google Gemini API 互動，而 `services/promptService.js` 則負責根據使用者的私有模板組合提示詞。
- **邏輯流程**:
    1.  使用者在前端發起生成請求。
    2.  後端 `promptService.js` 根據使用者身份，載入其設定的私有 Gist 模板。
    3.  結合模板與影片數據（如字幕），建構出最終的提示詞。
    4.  `geminiService.ts` 將提示詞發送給 Google Gemini API。
    5.  此耗時操作由「非同步任務處理機制」在背景執行。

### 3.4 使用者自訂遠端模板 (User-Customizable Remote Templates)

- **功能描述**:
  為提供極致的個人化與隱私保護，本應用允許每一位使用者連接自己的 GitHub Gist 作為私有的提示詞模板來源。使用者可以建立一個私密 (secret) Gist，將其 URL 填入系統，從而讓 AI 完全依照自己設計的風格、語氣和格式產出內容，且這些核心的提示詞資產不會被任何其他使用者或系統管理員看見。

- **設計理念與優勢**:
    - **高度個人化與品牌一致性**: 每個 YouTube 頻道都有獨特的風格。此功能讓創作者可以將自己的「創意秘方」注入 AI，確保生成內容與其品牌聲量、語氣、慣用詞彙完全一致。
    - **隱私與所有權**: 提示詞是創作者重要的智慧財產。透過使用私密 Gist，使用者可以完全掌控自己的模板，無需擔心商業機密或創意被洩漏。
    - **使用者的敏捷性**: 創作者可以隨時在自己的 Gist 中實驗和優化提示詞，並立即在應用中看到效果，無需等待開發者更新或部署，實現了真正的快速迭代。

- **實現方式**:
    - **前端**: 應用程式的設定頁面中，提供一個輸入框，讓登入後的使用者可以儲存自己私有的 Gist Raw URL。
    - **後端**:
        - 需要有一個儲存機制（例如資料庫中的 user profile），將使用者的 ID 與其 Gist URL 進行綁定。
        - 當收到生成請求時，後端會先驗證使用者身份。
        - `services/promptService.js` 根據使用者 ID 查找其設定的 Gist URL。
        - **使用者模板優先**: 如果找到了使用者自訂的 URL，則優先從該 URL 獲取模板。
        - **系統模板降級**: 如果使用者未設定，或 Gist 請求失敗，系統會自動降級，轉而使用 `services/prompts/templates/` 目錄下預設的公用模板，確保功能可用。

### 3.5 非同步任務處理機制 (Asynchronous Task Handling)

- **功能描述**:
  AI 生成內容是一個耗時操作。為了避免瀏覽器請求超時和提升使用者體驗，系統採用了非同步任務佇列。
- **實現方式**:
    - **後端**: 收到生成請求後，立即將任務加入 `services/taskQueue.js` 管理的佇列，並返回一個 `taskId`。一個背景 Worker 會處理佇列中的任務。
    - **前端**: `services/taskPollingService.ts` 在拿到 `taskId` 後，會定期輪詢任務狀態，並在任務完成後獲取結果，更新 UI。

### 3.6 內容編輯工作區與 Notion 匯出 (Content Workspace & Notion Export)

- **功能描述**:
  提供一個編輯器供使用者修改 AI 生成的內容，並可一鍵將最終文案匯出到指定的 Notion 資料庫。
- **實現方式**:
    - **前端**: `ArticleWorkspace.tsx` 整合了編輯與匯出功能。
    - **後端**: `services/notionService.js` 負責將接收到的內容轉換為 Notion API 的格式，並透過 `services/notionClient.ts` 初始化的客戶端寫入 Notion。

### 3.7 基於 Gist 的自動化影片數據快取

- **功能描述**:
  為了最大限度地減少對 YouTube API 的呼叫、避免觸及每日配額限制，並極大地提升應用程式的回應速度，系統實現了一套基於 Gist 的自動化影片數據快取機制。
- **實現方式**:
    - **核心腳本**: `scripts/update-video-cache.js` 是此機制的核心。它會呼叫 `youtubeService` 獲取頻道上所有影片的最新數據，然後透過 GitHub API 將這些數據更新到一個指定的 Gist 上。
    - **CI/CD 自動化**: `.github/workflows/update-video-cache.yml` 檔案定義了一個 GitHub Actions 工作流程。此工作流程被設定為定時觸發（例如，每天凌晨執行），自動運行 `update-video-cache.js` 腳本，並將更新 Gist 所需的 `GITHUB_TOKEN` 作為秘密環境變數傳入。
    - **快取讀取**: `services/videoCacheService.js` 封裝了對 Gist 快取的讀取邏輯。它直接向 Gist 的 `raw` URL 發送 HTTP GET 請求，獲取 JSON 格式的快取數據。這個過程不需認證，且速度極快。
- **邏輯流程**:
    1.  **快取生成 (自動化)**:
        - GitHub Actions 按預定時間觸發工作流程。
        - 工作流程執行 `update-video-cache.js` 腳本。
        - 腳本從 YouTube API 獲取最新數據，然後使用 GitHub API 將數據覆寫到指定的 Gist。
    2.  **快取使用 (應用程式運行時)**:
        - 使用者在前端請求影片分析數據。
        - 後端 `youtubeService` 呼叫 `videoCacheService`。
        - `videoCacheService` 從 Gist 的 Raw URL 非同步載入最新的快取數據並回傳。
        - 數據被即時提供給前端，實現了高效的數據存取。

---

## 4. 專案架構與核心概念 (Architecture & Core Concepts)

- **前後端分離 (Frontend-Backend Separation)**:
  此架構的最大優勢是**關注點分離**。前端專注於使用者體驗，後端專注於業務邏輯、數據處理與外部服務整合。將所有 API 金鑰和敏感操作保留在後端，極大地增強了專案的**安全性**。

- **服務導向與數據分離 (Service-Oriented & Data-Decoupled)**:
  後端的 `services` 目錄體現了服務導向的設計思想。更進一步，透過將動態數據（快取）和使用者設定（私有模板）託管在 Gist 上，實現了**程式碼與數據/設定的分離**。這使得數據的更新和個人化設定的調整可以獨立於應用程式的部署週期，提供了極高的靈活性和可維護性。

- **以創作者為中心的無縫工作流 (Creator-Centric Workflow)**:
  整個專案的設計緊密圍繞創作者的實際工作流程：
  `數據洞察 → 靈感觸發 → 內容初稿 → 人工精修 → 歸檔管理`
  `AI-Video-Writer` 將這個流程數位化、自動化，讓 AI 成為創作過程中的得力助手，而非取代者，最終實現人機協作的最佳效益。
