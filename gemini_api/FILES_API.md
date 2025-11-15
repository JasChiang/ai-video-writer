# 📂 Gemini Files API 說明

本文件介紹 Google Gemini Files API 的功能，以及 AI Video Writer 專案如何利用此 API 來處理用戶上傳的各種參考檔案（如圖像、PDF、音訊等），以提供更豐富的上下文給 Gemini 模型。

## 💡 什麼是 Gemini Files API？

Gemini Files API 是一個專為處理大型多模態輸入而設計的服務。它允許您將檔案（如圖像、音訊、影片、文件）上傳到 Google 的基礎設施，並在後續的 `generateContent` 請求中透過檔案的 URI 進行引用。

### 為何使用 Files API？

-   **處理大檔案**：當您的檔案大小超過內聯數據的 20MB 限制時，Files API 是理想的選擇。它支援單一檔案最大 2GB，每個專案總計 20GB 的儲存空間。
-   **檔案重用**：上傳的檔案會獲得一個 `file_uri`，您可以在多個 `generateContent` 請求中重複引用該檔案，而無需每次都重新上傳數據。這對於重複分析相同參考資料的場景非常有效。
-   **簡化提示詞**：透過引用檔案 URI，可以使您的提示詞更簡潔，並將檔案處理的複雜性交由 API 管理。

## 核心功能

### 1. 上傳檔案 (Upload a file)

您可以將各種支援的媒體檔案上傳到 Files API。上傳後，API 會返回一個包含 `file_uri` 和其他元數據的檔案物件。

**範例 (JavaScript/TypeScript)**：
```typescript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadFile(filePath: string, mimeType: string, displayName?: string) {
  const file = await ai.files.upload({
    file: fs.readFileSync(filePath), // 讀取本地檔案
    config: {
      mimeType: mimeType,
      displayName: displayName || filePath.split('/').pop(), // 可選的顯示名稱
    },
  });
  console.log(`檔案 '${file.displayName}' 已上傳，URI: ${file.uri}`);
  return file;
}

// 範例使用
// const uploadedImage = await uploadFile("path/to/sample.jpg", "image/jpeg", "我的參考圖片");
// const uploadedPdf = await uploadFile("path/to/document.pdf", "application/pdf", "我的參考文件");
```

### 2. 取得檔案元數據 (Get metadata for a file)

您可以透過檔案的名稱 (name) 來檢索已上傳檔案的元數據，例如 `file_uri`、`mimeType`、`displayName` 和處理狀態。

**範例 (JavaScript/TypeScript)**：
```typescript
// 假設您已經有一個檔案的 name (例如從 upload 操作返回)
// const fileName = "files/your-file-id";
// const fileMetadata = await ai.files.get({ name: fileName });
// console.log(fileMetadata);
```

### 3. 列出已上傳檔案 (List uploaded files)

您可以列出所有已上傳到您專案的檔案。

**範例 (JavaScript/TypeScript)**：
```typescript
// for await (const file of ai.files.list()) {
//   console.log(`檔案名稱: ${file.name}, 顯示名稱: ${file.displayName}, URI: ${file.uri}`);
// }
```

### 4. 刪除已上傳檔案 (Delete uploaded files)

檔案會自動在 48 小時後被刪除。您也可以手動刪除不再需要的檔案。

**範例 (JavaScript/TypeScript)**：
```typescript
// 假設您有一個檔案的 name
// const fileNameToDelete = "files/your-file-id";
// await ai.files.delete({ name: fileNameToDelete });
// console.log(`檔案 ${fileNameToDelete} 已刪除。`);
```

## 使用資訊與限制

-   **儲存容量**：每個專案最多可儲存 20 GB 的檔案，單一檔案最大 2 GB。
-   **儲存期限**：檔案會儲存 48 小時。在此期間，您可以使用 API 存取其元數據，但無法下載檔案本身。
-   **費用**：Files API 在所有支援 Gemini API 的區域均免費提供。
-   **支援檔案類型**：支援多種媒體類型，包括圖像 (PNG, JPEG, WEBP, HEIC, HEIF)、PDF (application/pdf)、音訊 (MPEG, WAV, FLAC 等) 和影片 (MPEG, MP4, WEBM 等)。

## AI Video Writer 中的應用

AI Video Writer 專案利用 Gemini Files API 來處理用戶上傳的參考檔案。當您在生成文章時拖放圖像、PDF 或其他文件，這些檔案會透過 Files API 上傳，並作為多模態輸入提供給 Gemini 模型，以豐富文章生成的上下文。

---

## 📚 相關文件

-   [Gemini 圖像理解功能](./IMAGE_UNDERSTANDINGS.md)
-   [Gemini 文件理解功能](./DOCUMENT_UNDERSTANDING.md)
-   [Gemini 影片理解功能](./VIDEO_UNDERSTANDINGS.md)
-   [Google Gemini 官方 Files API 文件](https://ai.google.dev/gemini-api/docs/files)
