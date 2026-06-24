# 參考資料整合機制說明

本文件說明當使用者同時提供多種參考資料（上傳檔案、參考影片、參考網址）時，系統如何將它們整合進文章生成的提示詞（prompt），確保 Gemini 全面吸收所有來源的內容，而非只使用其中一部分。

## 背景（歷史）

早期實作中，參考影片只是被加進 `parts` 陣列（透過 `fileData` 傳給 Gemini 的 Video Understanding），參考網址也只用「請參考以下網址」這類過於簡單的字句帶過。由於 prompt 中缺乏明確的「如何使用」與「全面整合」指示，使用者反映「有時候感覺像是只用了一部分的內容」——Gemini 會自行判斷相關性、把參考資料當成可選的補充，導致部分來源被忽略。

現行版本已將參考資料的整合指示集中到一個共用函數中產生，下文描述的即為目前實際運作的方式。

## 整合的核心：`generateArticlePromptWithReferences`

所有參考資料的整合邏輯都集中在 `services/articlePromptService.js` 的 `generateArticlePromptWithReferences()` 函數。它接收一個 `references` 物件：

```javascript
const references = {
  uploadedFiles: uploadedFiles || [],   // 使用者上傳的參考檔案（圖片 / PDF / md / txt）
  referenceVideos: referenceVideos || [], // 參考影片（YouTube 網址）
  referenceUrls: referenceUrls || []      // 參考網址
};

const fullPrompt = await generateArticlePromptWithReferences(
  videoTitle,   // 主資料：影片標題或主要網址
  prompt,       // 使用者額外提示
  references,
  templateId,
  contentType   // 'video' 或 'url'，標示主資料的類型
);
```

函數會先用模板（`templateId`）產生基礎提示詞，再依序在後面附加各類參考資料的說明區塊與整合指示。

### 1. 上傳檔案（uploadedFiles）

加上 `## 參考檔案` 區塊，逐一列出檔名與檔案類型（圖片 / PDF / Markdown / 文字檔），並附上指示：

> 請深入分析這些參考檔案，將檔案中的資訊與主要內容結合，產出更豐富、更專業的文章。

### 2. 參考影片（referenceVideos）

加上 `## 參考影片` 區塊，說明系統已提供幾部參考影片，並明確要求：

> 請深入分析這些參考影片的內容，將其中的資訊、觀點、技術細節與主要內容整合……這些參考影片與主題密切相關，請確保充分利用其中的內容。

（影片本身透過 `parts` 陣列以 `fileData: { fileUri: videoUrl }` 傳遞，利用 Gemini 的 Video Understanding 功能，最多 10 部。）

### 3. 參考網址（referenceUrls）

加上 `## 參考網址` 區塊，逐一列出網址，並要求 Gemini 深入閱讀分析：

> 這些網址提供了額外的脈絡、數據或觀點。請確保將這些參考資料的重要資訊整合到文章中，讓內容更加全面和深入。

（搭配在 `server.js` 啟用的 URL Context Tool，`tools: [{ urlContext: {} }]`，最多 20 個網址。）

### 4. 總體整合原則

只要存在任何一種參考資料，函數最後都會附上一段強調全面整合的指示，直接針對「只用部分內容」的問題：

> **重要整合原則**：請綜合分析主要來源與上述所有參考資料，將它們的內容有機地整合到文章中。不要只使用部分參考資料，而應該全面吸收各個來源的精華，產出一篇完整、專業、具有深度的文章。

### 5. 動態截圖規劃

函數還會依「主資料類型（`contentType`）」與「是否有參考影片」動態決定截圖時間點的規劃指示，分為四種情境：

1. 主資料是影片 + 有參考影片：主影片規劃 3-5 個截圖，每部參考影片規劃 2-3 個，並在 `reason_for_screenshot` 標示來源。
2. 主資料不是影片（URL）+ 有參考影片：只為參考影片規劃截圖。
3. 主資料是影片 + 無參考影片：沿用模板預設行為（為主影片截圖），不額外加說明。
4. 主資料不是影片 + 無參考影片：要求把 `screenshots` 設為空陣列 `[]`。

## 在 server.js 的呼叫位置

`generateArticlePromptWithReferences` 由各個文章生成 handler 呼叫（搜尋 `generateArticlePromptWithReferences` 即可定位），主要包含：

- 影片為主資料的非同步 handler（`/api/generate-article-url-async`），以 `contentType = 'video'` 呼叫。
- 純網址（URL-Only）為主資料的非同步 handler（`/api/generate-article-from-url-async`），以 `contentType = 'url'` 呼叫，並啟用 URL Context 工具。
- 影片為主資料的同步 handler，同樣以 `contentType = 'video'` 呼叫。

各 handler 在組裝最終 prompt 時，`fullPrompt` 已經包含上述所有參考資料的整合指示（程式碼註解標示為「已包含所有參考資料的整合指示」）；handler 只需再串接最後的 JSON 格式要求，並把上傳檔案、參考影片放進 `parts` 陣列。

## 設計取捨

整合指示是放在執行時動態組裝（`articlePromptService.js`），而不是寫死在模板（`services/prompts/templates/default.js`）裡，原因是：

- 只有「實際提供了參考資料」時才需要這些指示，動態產生可避免污染無參考資料的一般情境。
- 指示需要依參考資料的種類與數量（檔案 / 影片 / 網址）客製化內容與截圖規劃，模板的靜態文字難以涵蓋。
- 模板（如 AEO 優化的 `default.js`）專注於文章結構、排版與寫作風格規範（顧問視角等寫作要求在模板的「寫作風格」段落），與參考資料整合邏輯各司其職。

## 驗證方法

1. 同時提供多個參考影片與網址，檢查生成的文章是否包含各個來源的特定資訊。
2. 查看 backend log（`[Article URL]` / `[Article URL-Only]` 前綴）確認所有參考檔案、影片、網址都有被加入 `parts` 與 prompt。
3. 觀察 URL Context Metadata 日誌，確認各參考網址的抓取狀態（`urlRetrievalStatus`）。

## 相關文件

- [URL Context 功能說明](./URL_CONTEXT.md)
- [Video Understanding 功能說明](./VIDEO_UNDERSTANDING.md)
- [Gemini Prompt 最佳實踐](./GEMINI_PROMPT_BEST_PRACTICES.md)
