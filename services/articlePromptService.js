/**
 * 文章生成專用的提示詞服務
 * 針對科技產品分享與實用教學調整
 */

import {
  generatePromptFromTemplate,
  getTemplatesMetadata,
  getCustomTemplatesStatus,
  isUsingCustomTemplates,
  refreshCustomTemplates,
  disableCustomTemplates,
  enableCustomTemplates,
} from './prompts/index.js';

/**
 * 生成文章與截圖的完整提示詞
 * @param {string} videoTitle 影片標題
 * @param {string} [userPrompt] 使用者額外提示（選填）
 * @param {string} [templateId] 模板 ID（預設為 'default'）
 * @returns {Promise<string>} 完整的提示詞
 */
export async function generateArticlePrompt(videoTitle, userPrompt = '', templateId = 'default') {
  // 使用新的模板系統（支援遠端模板）
  return await generatePromptFromTemplate(templateId, videoTitle, userPrompt);
}

/**
 * 舊版相容函數（同步版本，使用預設模板）
 * @deprecated 請使用 generateArticlePrompt (async version)
 */
export function generateArticlePromptSync(videoTitle, userPrompt) {
  return `你是一位專業的科技內容顧問，擅長將複雜的科技知識轉化為讀者能輕易理解並應用的實用內容。

# 任務

請分析這部影片並撰寫一篇專業的產品分享或教學文章。

影片標題：${videoTitle}
${userPrompt ? `額外要求：${userPrompt}\n` : ""}

# 寫作要求

1. **顧問視角**：以科技生活顧問身份，解釋技術如何解決問題
2. **價值優先**：用詞精準直接，提供實用價值
3. **深度分析**：提煉關鍵亮點或核心步驟，闡述原理與應用
4. **台灣用語**：使用台灣繁體中文、全形標點符號
5. **中英數空格**：在中文、英文、數字之間插入半形空格（例：iPhone 15 Pro）
6. **敘述性文字**：使用流暢段落，不使用條列、bullet points、數字列表、表格

# 文章結構

**標題**：生成 3 個風格的標題（15-25 字）
- titleA：結果/價值導向
- titleB：情境/痛點導向
- titleC：技巧/趨勢導向

**內文**（Markdown 格式）：
- 前言：100-150 字，點出需求痛點
- 主體：3-5 個段落，每段包含 ## 小標題與敘述性內文
- 總結：約 100 字

**SEO 描述**：150 字以內，包含主要關鍵字

**截圖時間點**：3-5 個關鍵畫面
- 時間點格式為 mm:ss
- 說明選擇原因

# 輸出格式

請輸出 JSON，包含以下欄位：
- titleA: 字串
- titleB: 字串
- titleC: 字串
- article_text: 字串（Markdown 格式）
- seo_description: 字串
- screenshots: 陣列，每個元素包含 timestamp_seconds（字串，格式為 mm:ss）和 reason_for_screenshot（字串）`;
}

/**
 * 生成文章與截圖的完整提示詞（支援參考檔案）
 * @param {string} videoTitle 影片標題
 * @param {string} [userPrompt] 使用者額外提示（選填）
 * @param {Array} [uploadedFiles] 使用者上傳的參考檔案（選填）
 * @param {string} [templateId] 模板 ID（預設為 'default'）
 * @returns {Promise<string>} 完整的提示詞
 */
export async function generateArticlePromptWithFiles(videoTitle, userPrompt, uploadedFiles, templateId = 'default') {
  // 使用模板生成基本提示詞
  let prompt = await generatePromptFromTemplate(templateId, videoTitle, userPrompt);

  // 如果有上傳檔案，加入參考資料說明
  if (uploadedFiles && uploadedFiles.length > 0) {
    let filesContext = '\n\n## 參考檔案\n\n使用者已上傳 ' + uploadedFiles.length + ' 個參考檔案：\n\n';

    uploadedFiles.forEach((file, index) => {
      const fileType =
        file.mimeType.startsWith('image/') ? '圖片檔案' :
        file.mimeType === 'application/pdf' ? 'PDF 文件' :
        file.displayName.endsWith('.md') ? 'Markdown 文件' :
        file.mimeType === 'text/plain' ? '文字檔案' : '檔案';

      filesContext += `${index + 1}. ${file.displayName}（${fileType}）\n`;
    });

    filesContext += '\n請深入分析這些參考檔案，將檔案中的資訊與影片內容結合，產出更豐富、更專業的文章。\n';

    prompt += filesContext;
  }

  return prompt;
}

/**
 * 生成文章與截圖的完整提示詞（支援所有類型的參考資料）
 * @param {string} videoTitle 影片標題或網址
 * @param {string} [userPrompt] 使用者額外提示（選填）
 * @param {Object} references 參考資料物件
 * @param {Array} [references.uploadedFiles] 使用者上傳的參考檔案
 * @param {Array} [references.referenceVideos] 參考影片網址
 * @param {Array} [references.referenceUrls] 參考網址
 * @param {string} [templateId] 模板 ID（預設為 'default'）
 * @returns {Promise<string>} 完整的提示詞
 */
export async function generateArticlePromptWithReferences(videoTitle, userPrompt = '', references = {}, templateId = 'default') {
  // 使用模板生成基本提示詞
  let prompt = await generatePromptFromTemplate(templateId, videoTitle, userPrompt);

  // 建立參考資料區塊
  let referencesContext = '';

  // 1. 處理上傳檔案
  if (references.uploadedFiles && references.uploadedFiles.length > 0) {
    referencesContext += '\n\n## 參考檔案\n\n使用者已上傳 ' + references.uploadedFiles.length + ' 個參考檔案：\n\n';

    references.uploadedFiles.forEach((file, index) => {
      const fileType =
        file.mimeType.startsWith('image/') ? '圖片檔案' :
        file.mimeType === 'application/pdf' ? 'PDF 文件' :
        file.displayName.endsWith('.md') ? 'Markdown 文件' :
        file.mimeType === 'text/plain' ? '文字檔案' : '檔案';

      referencesContext += `${index + 1}. ${file.displayName}（${fileType}）\n`;
    });

    referencesContext += '\n請深入分析這些參考檔案，將檔案中的資訊與主要內容結合，產出更豐富、更專業的文章。\n';
  }

  // 2. 處理參考影片
  if (references.referenceVideos && references.referenceVideos.length > 0) {
    referencesContext += '\n\n## 參考影片\n\n系統已提供 ' + references.referenceVideos.length + ' 部參考影片。\n\n';
    referencesContext += '請深入分析這些參考影片的內容，將其中的資訊、觀點、技術細節與主要內容整合，產出更全面、更深入的文章。這些參考影片與主題密切相關，請確保充分利用其中的內容。\n';
  }

  // 3. 處理參考網址
  if (references.referenceUrls && references.referenceUrls.length > 0) {
    referencesContext += '\n\n## 參考網址\n\n請深入閱讀並分析以下網址的內容：\n\n';

    references.referenceUrls.forEach((url, index) => {
      referencesContext += `${index + 1}. ${url}\n`;
    });

    referencesContext += '\n這些網址提供了額外的脈絡、數據或觀點。請確保將這些參考資料的重要資訊整合到文章中，讓內容更加全面和深入。\n';
  }

  // 4. 如果有任何參考資料，加上總體整合指示
  const hasAnyReferences =
    (references.uploadedFiles && references.uploadedFiles.length > 0) ||
    (references.referenceVideos && references.referenceVideos.length > 0) ||
    (references.referenceUrls && references.referenceUrls.length > 0);

  if (hasAnyReferences) {
    referencesContext += '\n**重要整合原則**：請綜合分析主要來源與上述所有參考資料，將它們的內容有機地整合到文章中。不要只使用部分參考資料，而應該全面吸收各個來源的精華，產出一篇完整、專業、具有深度的文章。\n';
  }

  prompt += referencesContext;
  return prompt;
}

export async function listAvailableArticleTemplates() {
  return await getTemplatesMetadata();
}

export { isUsingCustomTemplates };

export function getArticleTemplateStatus() {
  return getCustomTemplatesStatus();
}

export async function refreshArticleTemplates() {
  return await refreshCustomTemplates();
}

export function disableArticleTemplates() {
  disableCustomTemplates();
}

export function enableArticleTemplates() {
  enableCustomTemplates();
}
