import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

/**
 * 取得 Gemini AI 客戶端（使用 lazy initialization 確保環境變數已載入）
 */
function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
}

/**
 * 上傳檔案到 Gemini Files API
 * @param {string} filePath - 本地檔案路徑
 * @param {string} mimeType - MIME 類型
 * @param {string} displayName - 顯示名稱
 * @returns {Promise<Object>} 上傳的檔案資訊
 */
export async function uploadToGeminiFilesAPI(filePath, mimeType, displayName) {
  try {
    console.log(`[Gemini Files API] 開始上傳檔案: ${displayName}`);
    console.log(`  路徑: ${filePath}`);
    console.log(`  類型: ${mimeType}`);

    const ai = getGeminiClient();
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: {
        mimeType: mimeType,
        displayName: displayName
      }
    });

    console.log(`✅ 檔案已上傳至 Gemini Files API`);
    console.log(`   Name: ${uploadedFile.name}`);
    console.log(`   URI: ${uploadedFile.uri}`);

    return {
      name: uploadedFile.name,
      uri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType,
      displayName: uploadedFile.displayName,
      sizeBytes: uploadedFile.sizeBytes,
      state: uploadedFile.state
    };
  } catch (error) {
    console.error('❌ Gemini Files API 上傳失敗:', error);
    throw new Error(`檔案上傳失敗: ${error.message}`);
  }
}

/**
 * 刪除 Gemini Files API 中的檔案
 * @param {string} fileName - 檔案名稱（格式：files/xxx）
 */
export async function deleteGeminiFile(fileName) {
  try {
    console.log(`[Gemini Files API] 刪除檔案: ${fileName}`);
    const ai = getGeminiClient();
    await ai.files.delete({ name: fileName });
    console.log(`✅ 檔案已刪除`);
  } catch (error) {
    console.error('❌ 檔案刪除失敗:', error);
    throw new Error(`檔案刪除失敗: ${error.message}`);
  }
}

/**
 * 列出所有已上傳的檔案
 * @param {number} pageSize - 每頁數量
 * @returns {Promise<Array>} 檔案列表
 */
export async function listGeminiFiles(pageSize = 100) {
  try {
    const files = [];
    const ai = getGeminiClient();
    const listResponse = ai.files.list({ config: { pageSize } });

    for await (const file of listResponse) {
      files.push({
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType,
        displayName: file.displayName,
        sizeBytes: file.sizeBytes,
        state: file.state,
        createTime: file.createTime,
        expirationTime: file.expirationTime
      });
    }

    console.log(`[Gemini Files API] 找到 ${files.length} 個檔案`);
    return files;
  } catch (error) {
    console.error('❌ 列出檔案失敗:', error);
    throw new Error(`列出檔案失敗: ${error.message}`);
  }
}

/**
 * 取得檔案資訊
 * @param {string} fileName - 檔案名稱
 * @returns {Promise<Object>} 檔案資訊
 */
export async function getGeminiFile(fileName) {
  try {
    const ai = getGeminiClient();
    const file = await ai.files.get({ name: fileName });
    return {
      name: file.name,
      uri: file.uri,
      mimeType: file.mimeType,
      displayName: file.displayName,
      sizeBytes: file.sizeBytes,
      state: file.state,
      createTime: file.createTime,
      expirationTime: file.expirationTime
    };
  } catch (error) {
    console.error('❌ 取得檔案資訊失敗:', error);
    throw new Error(`取得檔案資訊失敗: ${error.message}`);
  }
}

/**
 * 將 base64 字串轉換為檔案並上傳
 * @param {string} base64Data - Base64 編碼的資料
 * @param {string} mimeType - MIME 類型
 * @param {string} displayName - 顯示名稱
 * @returns {Promise<Object>} 上傳的檔案資訊
 */
export async function uploadBase64ToGemini(base64Data, mimeType, displayName) {
  const tempPath = `temp_files/${Date.now()}-${displayName}`;

  try {
    // 建立暫存目錄
    if (!fs.existsSync('temp_files')) {
      fs.mkdirSync('temp_files', { recursive: true });
    }

    // 將 base64 寫入暫存檔案
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tempPath, buffer);

    // 上傳到 Gemini
    const result = await uploadToGeminiFilesAPI(tempPath, mimeType, displayName);

    // 刪除暫存檔案
    fs.unlinkSync(tempPath);

    return result;
  } catch (error) {
    // 清理暫存檔案
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
