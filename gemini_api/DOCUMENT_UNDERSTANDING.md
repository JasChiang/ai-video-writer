# 📄 Gemini 文件理解功能

本文件概述 Google Gemini 模型處理文件（特別是 PDF 格式）的能力，以及 AI Video Writer 專案如何利用這些功能來處理用戶上傳的參考文件。

## 💡 Gemini 的文件處理能力

Gemini 模型能夠以原生視覺方式理解 PDF 文件，這超越了簡單的文字提取。它能夠：

-   **分析和解釋內容**：理解文件中的文字、圖像、圖表和表格，即使是長達 1000 頁的文件。
-   **提取結構化資訊**：將文件中的資訊提取成結構化輸出格式。
-   **總結和問答**：根據文件的視覺和文字元素進行總結，並回答相關問題。
-   **轉錄內容**：將文件內容轉錄為其他格式（例如 HTML），同時保留佈局和格式。

## 傳遞 PDF 文件給 Gemini 模型

在 AI Video Writer 專案中，當用戶上傳 PDF 文件作為參考檔案時，主要有兩種方式將文件數據傳遞給 Gemini 模型：

### 1. 內聯 PDF 數據 (Inline PDF Data)

-   **適用場景**：適用於較小的 PDF 檔案（通常小於 20MB）。
-   **限制**：總請求大小（包括文字提示和所有內聯數據）限制為 20MB。
-   **運作方式**：PDF 數據會被編碼（通常是 Base64）並直接包含在 API 請求的 `contents` 陣列中。

### 2. 使用 File API 上傳 PDF

-   **適用場景**：**推薦用於較大的 PDF 檔案**，或需要重複使用相同文件的場景。
-   **優勢**：
    -   **處理大檔案**：File API 專為處理大文件而設計，支援高達 50MB 的 PDF 檔案，繞過了內聯數據的 20MB 限制。
    -   **重複使用**：文件上傳後會獲得一個 `file_uri`，可以在多個 `generateContent` 請求中重複引用，無需每次都重新上傳數據。
    -   **處理時間**：文件上傳後會在 Google 基礎設施中進行處理，模型可以直接存取。
-   **運作方式**：PDF 檔案會先透過 Gemini Files API 上傳到 Google 的基礎設施，然後在 `generateContent` 請求中透過 `file_uri` 引用。

> **AI Video Writer 中的應用**：當用戶上傳 PDF 等參考檔案時，專案會利用 Gemini Files API 進行處理，以確保即使是大檔案也能被模型理解，並作為生成文章的上下文。

## 提示詞中的 PDF 使用

在向 Gemini 模型發送提示詞時，您可以將 PDF 文件與文字提示結合，甚至在單一提示中包含多個 PDF 文件。這使得模型能夠理解文件的內容，並根據這些資訊生成更豐富、更精確的回應。

**範例 (JavaScript/TypeScript)**：
```typescript
import { GoogleGenAI, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function summarizePdf(pdfFileUri: string, pdfMimeType: string, promptText: string) {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash", // 或其他支援文件理解的模型
    contents: [
      createPartFromUri(pdfFileUri, pdfMimeType), // 引用已上傳的 PDF
      { text: promptText },
    ],
  });
  return result.response.text();
}

// 範例使用 (假設已透過 File API 上傳 PDF 並取得 fileUri 和 mimeType)
// const pdfFileUri = "your_uploaded_pdf_file_uri";
// const pdfMimeType = "application/pdf";
// const response = await summarizePdf(pdfFileUri, pdfMimeType, "請總結這份文件。");
// console.log(response);
```

## 技術細節與限制

-   **頁面限制**：Gemini 模型支援單次請求最多 1,000 頁的文件。
-   **Token 計算**：每頁文件約等同於 258 個 Token。
-   **文件類型**：雖然技術上可以傳遞 TXT, Markdown, HTML, XML 等其他 MIME 類型，但 Gemini 的文件視覺理解**主要針對 PDF**。其他類型將被提取為純文字，模型無法解釋其渲染後的視覺元素（如圖表、佈局）。
-   **File API 儲存**：透過 File API 上傳的文件會儲存 48 小時。在此期間，您可以使用 API 金鑰存取它們，但無法從 API 下載。

## 最佳實踐

-   **文件方向**：上傳前確保頁面方向正確。
-   **清晰度**：避免模糊的頁面。
-   **提示詞順序**：如果單一文件與文字提示結合，建議將文字提示放在文件部分之後。

---

## 📚 相關文件

-   [Gemini Files API 說明](./FILES_API.md)
-   [Google Gemini 官方文件理解文件](https://ai.google.dev/gemini-api/docs/document-understanding)
