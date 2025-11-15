# 🎬 Gemini 影片理解功能

本文件概述 Google Gemini 模型處理影片內容的能力，以及 AI Video Writer 專案如何利用這些功能來分析 YouTube 影片並生成相關內容。

## 💡 Gemini 的影片分析能力

Gemini 模型從底層設計上就是多模態的，能夠直接理解影片內容，這為開發者開啟了許多創新的應用場景。Gemini 的影片理解能力包括：

-   **描述、分割和提取資訊**：從影片中識別關鍵事件、物件和場景，並提取相關資訊。
-   **回答影片內容相關問題**：根據影片內容回答用戶提出的問題。
-   **參考影片中的特定時間戳**：能夠理解並回應影片中特定時間點的內容。
-   **轉錄音訊和提供視覺描述**：處理影片的音軌和視覺幀，提供音訊轉錄和視覺內容描述。

## 傳遞影片給 Gemini 模型

AI Video Writer 專案主要透過以下方式將影片內容傳遞給 Gemini 模型：

### 1. 直接傳遞 YouTube 網址 (推薦)

這是 AI Video Writer 專案的核心功能之一。您可以直接將 YouTube 影片的 URL 傳遞給 Gemini API。

-   **優勢**：極大簡化了影片處理流程，無需下載影片，直接利用 YouTube 平台上的內容。
-   **適用場景**：專案主要用於分析公開的 YouTube 影片。
-   **限制**：
    -   目前僅支援**公開影片**（不支援私人或未列出影片）。
    -   免費方案下，每日可上傳的 YouTube 影片總時長有限制（例如 8 小時）。
    -   Gemini 2.5 及更高版本模型支援單次請求最多 10 個影片。

**範例 (JavaScript/TypeScript)**：
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // 使用支援影片理解的模型

async function analyzeYouTubeVideo(youtubeUrl: string, promptText: string) {
  const result = await model.generateContent([
    promptText,
    {
      fileData: {
        fileUri: youtubeUrl,
      },
    },
  ]);
  return result.response.text();
}

// 範例使用
// const youtubeVideoUrl = "https://www.youtube.com/watch?v=YOUR_VIDEO_ID";
// const response = await analyzeYouTubeVideo(youtubeVideoUrl, "請總結這部影片的重點。");
// console.log(response);
```

### 2. 上傳影片檔案 (使用 Files API)

對於非 YouTube 影片或需要更精細控制的場景，可以使用 Files API 上傳影片檔案。

-   **優勢**：適用於大於 20MB 的影片檔案，或需要重複使用相同影片的場景。
-   **運作方式**：影片檔案會先透過 Gemini Files API 上傳，然後在 `generateContent` 請求中透過 `file_uri` 引用。
-   **支援格式**：`video/mp4`, `video/mpeg`, `video/webm` 等多種格式。

### 3. 內聯影片數據

-   **優勢**：適用於較小的影片檔案（總請求大小小於 20MB）。
-   **運作方式**：影片數據會被編碼（通常是 Base64）並直接包含在 API 請求中。

## 影片分析的進階應用

-   **參考時間戳**：您可以在提示詞中指定 `MM:SS` 格式的時間戳，向模型詢問影片中特定時間點的內容。
-   **轉錄與視覺描述**：Gemini 模型可以同時處理影片的音軌和視覺幀，提供音訊轉錄和視覺內容描述。模型會以每秒 1 幀 (1 FPS) 的速率對影片進行採樣。
-   **自訂影片處理**：可以透過 `videoMetadata` 參數設定影片剪輯區間 (`start_offset`, `end_offset`) 或自訂採樣幀率 (`fps`)。

## 技術細節與限制

-   **支援模型**：所有 Gemini 2.0 和 2.5 模型都支援影片數據處理。
-   **上下文窗口**：模型支援的影片時長取決於其上下文窗口大小（例如，1M Token 上下文窗口的模型可處理長達 1 小時的影片）。
-   **Token 計算**：每秒影片的 Token 成本約為 300 Token (預設解析度)，其中包含幀（1 FPS 採樣）、音訊（1Kbps）和元數據。
-   **最佳實踐**：
    -   為獲得最佳結果，建議每個提示請求只使用一個影片。
    -   如果文字提示與單一影片結合，建議將文字提示放在影片部分之後。
    -   對於快速變化的視覺內容，1 FPS 的採樣率可能會遺漏細節。

---

## 📚 相關文件

-   [Gemini Files API 說明](./FILES_API.md)
-   [Gemini 圖像理解功能](./IMAGE_UNDERSTANDINGS.md)
-   [Google Gemini 官方影片理解文件](https://ai.google.dev/gemini-api/docs/video-understanding)
