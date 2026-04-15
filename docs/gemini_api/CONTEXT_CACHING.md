# 🧠 Gemini 上下文快取功能

本文件介紹 Google Gemini API 的上下文快取 (Context Caching) 功能，並探討其在 AI Video Writer 專案中提升效率和降低成本的潛在應用。

## 💡 什麼是上下文快取？

在與 AI 模型互動時，我們經常需要重複傳遞相同的輸入內容（例如，冗長的系統指令、大型參考文件或影片）。上下文快取允許您將這些重複的輸入 Token 儲存起來，並在後續請求中引用，而無需每次都重新傳遞完整的內容。

Gemini API 提供兩種快取機制：

1.  **隱式快取 (Implicit Caching)**：
    -   Gemini 2.5 模型預設啟用。
    -   如果您的請求命中快取，Google 會自動提供成本節省。
    -   無需額外開發工作即可受益。
    -   為了增加命中率，建議將大型且常見的內容放在提示詞的開頭。

2.  **顯式快取 (Explicit Caching)**：
    -   需要手動啟用，但能保證成本節省。
    -   您可以將內容傳遞給模型一次，快取輸入 Token，然後在後續請求中引用這些快取 Token。
    -   可以設定快取的存活時間 (TTL)，過期後自動刪除。

## 🚀 上下文快取的優勢

-   **降低成本**：對於重複使用的內容，快取 Token 的成本通常低於每次都傳遞完整的 Token。
-   **減少延遲**：模型處理快取內容的速度可能比處理完整內容更快。
-   **提高一致性**：確保重複使用的上下文始終保持一致。

## AI Video Writer 中的潛在應用

AI Video Writer 專案涉及對影片和文件的分析，這些操作通常會包含大量重複的上下文（例如，影片的轉錄稿、用戶上傳的參考文件、固定的系統指令）。上下文快取功能可以應用於以下場景：

-   **重複分析大型影片或文件**：如果用戶多次請求分析同一部影片或文件，可以快取其內容，減少每次請求的 Token 成本和處理時間。
-   **複雜的系統指令**：對於文章生成或中繼資料生成中使用的冗長且固定的系統指令，可以將其快取，提高效率。
-   **長期對話或多輪互動**：如果未來專案擴展到支援多輪對話，快取歷史對話上下文將非常有用。

## 顯式快取的使用方式 (概念性範例)

雖然 AI Video Writer 目前的實作可能尚未直接使用顯式快取，但其概念如下：

1.  **創建快取**：將需要重複使用的內容（例如一個影片檔案或一段系統指令）上傳並創建一個快取物件，並設定其存活時間 (TTL)。
    ```typescript
    // 概念性程式碼
    const cache = await ai.caches.create({
      model: "gemini-2.5-flash",
      config: {
        displayName: "my-video-analysis-context",
        systemInstruction: "你是一位專業的影片分析師...",
        contents: [videoFile], // 引用已上傳的影片檔案
        ttl: "3600s", // 快取存活 1 小時
      },
    });
    ```
2.  **使用快取生成內容**：在後續的 `generateContent` 請求中，直接引用快取物件的名稱。
    ```typescript
    // 概念性程式碼
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "請總結這部影片的重點。",
      config: {
        cachedContent: cache.name, // 引用快取
      },
    });
    ```

## 限制與考量

-   **Token 門檻**：隱式快取和顯式快取都有最低 Token 數量的要求（例如 Gemini 2.5 Flash 為 1,024 Token）。
-   **成本模型**：快取 Token 數和儲存時間 (TTL) 都會產生費用，但通常會比重複傳遞完整內容更經濟。
-   **管理**：需要管理快取的生命週期（創建、更新、刪除）。

---

## 📚 相關文件

-   [Google Gemini 官方上下文快取文件](https://ai.google.dev/gemini-api/docs/context-caching)
-   [Gemini Files API 說明](./FILES_API.md)
