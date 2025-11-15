# 參考資料整合問題分析與改善方案

## 問題描述

使用者反饋：「為什麼有時候感覺像是只用了一部分的內容？」

當同時提供多個參考資料（參考影片 + 參考網址）給 Gemini 時，有時會感覺 AI 只使用了部分參考資料，而非全面整合所有來源的內容。

## 當前實作方式

### 參考影片的處理
在 `server.js` 第 1692-1699 行：
```javascript
// 加入參考影片
if (referenceVideos && referenceVideos.length > 0) {
  console.log(`[Article URL-Only] 📎 參考影片: ${referenceVideos.length} 個`);
  for (const videoUrl of referenceVideos) {
    console.log(`[Article URL-Only] 加入參考影片: ${videoUrl}`);
    parts.push({ fileData: { fileUri: videoUrl } });
  }
}
```

- 使用 `fileData` 格式傳遞 YouTube 網址
- 利用 Gemini 的 **Video Understanding** 功能（最多 10 部影片）
- **問題**：參考影片只是加到 `parts` 陣列，但 prompt 中完全沒有提到要如何使用這些影片

### 參考網址的處理
在 `server.js` 第 1701-1709 行：
```javascript
// 將所有 URL 加入到 prompt（主要 URL + 參考 URLs）
let finalPrompt = fullPrompt;
console.log(`[Article URL-Only] 📎 參考網址總數: ${referenceUrls.length} 個`);
referenceUrls.forEach((url, index) => {
  console.log(`[Article URL-Only]   ${index + 1}. ${url}`);
});

const urlList = referenceUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
finalPrompt = `${fullPrompt}\n\n請參考以下網址的內容：\n${urlList}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;
```

- 將網址列表加到 prompt 中
- 啟用 **URL Context Tool**（最多 20 個網址）
- **問題**：指示過於簡單，只說「請參考」，沒有強調要「深入分析」和「全面整合」

## 問題根源分析

### 1. Prompt 指示不夠明確
- 沒有明確告訴 Gemini 要「全面整合所有參考資料」
- 沒有說明參考影片和參考網址的重要性
- 缺少「如何使用」這些參考資料的指示

### 2. 參考影片的指示完全缺失
參考影片雖然透過 `fileData` 傳遞，但在 prompt 中沒有任何說明：
- Gemini 可能不知道這些影片的用途
- 可能被當作「可選」的附加資料
- 沒有強調要與主要來源整合

### 3. 缺少多來源整合的指示
當同時有多種參考資料時，沒有告訴 Gemini：
- 這些資料之間的關係
- 如何綜合使用主要來源 + 參考影片 + 參考網址
- 整合的優先級和重要性

## 可能導致只用部分內容的原因

1. **AI 自行判斷相關性**
   - 沒有明確指示時，AI 會自己決定哪些內容相關
   - 可能選擇性地使用某些來源而忽略其他

2. **優先級問題**
   - 可能優先使用主要來源（第一個影片或網址）
   - 參考資料被當作「補充」而非「必要」內容

3. **Token 限制**
   - 如果參考資料內容太多，可能會被截斷
   - Gemini 可能只讀取部分內容就開始生成

4. **URL Context Tool 的行為**
   - Tool 可能只提取網頁摘要而非完整內容
   - 需要明確指示要「深入閱讀」

## 改善方案

### 方案 A：明確的參考資料指示（推薦）

在加入參考資料時，提供清楚的使用指示：

```javascript
let referenceInstructions = '';

// 如果有參考影片
if (referenceVideos && referenceVideos.length > 0) {
  referenceInstructions += `\n\n## 參考影片（${referenceVideos.length} 部）\n`;
  referenceInstructions += `系統已提供 ${referenceVideos.length} 部參考影片。請深入分析這些影片的內容，將其中的資訊、觀點、技術細節整合到你的文章中。這些參考影片與主題密切相關，請確保充分利用。\n`;
}

// 如果有參考網址
if (referenceUrls && referenceUrls.length > 0) {
  referenceInstructions += `\n\n## 參考網址（${referenceUrls.length} 個）\n`;
  referenceInstructions += `請深入閱讀並分析以下網址的內容：\n${urlList}\n\n`;
  referenceInstructions += `這些網址提供了額外的脈絡、數據或觀點。請確保將這些參考資料的重要資訊整合到文章中，讓內容更加全面和深入。\n`;
}

// 如果有任何參考資料，加上整合指示
if (referenceVideos.length > 0 || referenceUrls.length > 0) {
  referenceInstructions += `\n**重要**：請綜合分析主要來源與所有參考資料，將它們的內容有機地整合到文章中，而不是只使用其中一部分。\n`;
}

finalPrompt = `${fullPrompt}${referenceInstructions}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;
```

### 方案 B：在模板中加入參考資料整合指示

修改 `services/prompts/templates/default.js`，在寫作要求中加入：

```javascript
# 寫作要求

1. **顧問視角**：以科技生活顧問身份，解釋技術如何解決問題
2. **價值優先**：用詞精準直接，提供實用價值
3. **深度分析**：提煉關鍵亮點或核心步驟，闡述原理與應用
4. **多來源整合**：如果提供了參考資料（影片或網址），請深入分析並整合所有來源的內容
5. **台灣用語**：使用台灣繁體中文、全形標點符號
6. **中英數空格**：在中文、英文、數字之間插入半形空格（例：iPhone 15 Pro）
7. **敘述性文字**：使用流暢段落，不使用條列、bullet points、數字列表、表格
```

### 方案 C：兩者結合（最佳方案）

同時使用方案 A 和 B：
- 在模板中建立「多來源整合」的基本原則
- 在執行時根據實際提供的參考資料，動態加入具體指示

## 實作位置

需要修改的檔案：
1. `server.js` - 第 1701-1711 行（參考資料處理邏輯）
2. `services/prompts/templates/default.js` - 第 14-21 行（寫作要求）
3. 其他模板檔案（如果需要統一行為）

## 預期效果

改善後應該能：
1. ✅ Gemini 更全面地使用所有參考資料
2. ✅ 減少「只用部分內容」的情況
3. ✅ 提升文章的深度和完整性
4. ✅ 更好地整合多個來源的觀點和資訊

## 驗證方法

實作後可以透過以下方式驗證：
1. 同時提供多個參考影片和網址
2. 檢查生成的文章是否包含各個來源的特定資訊
3. 比較改善前後的文章品質和完整度
4. 查看 backend log 確認所有參考資料都有傳送

## 相關文件

- [URL Context 功能說明](./URL_CONTEXT.md)
- [Video Understanding 功能說明](./VIDEO_UNDERSTANDING.md)
- [Gemini Prompt 最佳實踐](./GEMINI_PROMPT_BEST_PRACTICES.md)
