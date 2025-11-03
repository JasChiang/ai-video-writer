import type { GeneratedContentType } from '../types';

// 從環境變數獲取 API 基址，如果沒有設定則使用預設值
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 進度回調函數類型
export type ProgressCallback = (step: string) => void;

export interface AnalysisResult {
  metadata: GeneratedContentType;
  geminiFileName?: string;
  geminiFileUri?: string;
  reusedExistingFile?: boolean;
}

/**
 * 嘗試使用已存在的 Gemini 檔案重新分析
 * @param geminiFileName Gemini 檔案名稱
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @returns 分析結果，如果檔案不存在則返回 null
 */
export async function reanalyzeWithExistingFile(
  geminiFileName: string,
  userPrompt: string,
  videoTitle: string
): Promise<AnalysisResult | null> {
  try {
    console.log(`[API] Attempting to reuse existing file: ${geminiFileName}`);
    const response = await fetch(`${API_BASE_URL}/reanalyze-with-existing-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geminiFileName,
        prompt: userPrompt,
        videoTitle,
      }),
    });

    if (response.status === 404) {
      console.log(`[API] File not found, needs re-download`);
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reanalyze with existing file');
    }

    const data = await response.json();
    console.log(`[API] Successfully reused existing file`);
    return data;

  } catch (error: any) {
    console.error('[API] Reanalysis error:', error);
    return null;
  }
}

/**
 * 使用 YouTube URL 直接分析公開影片（不需下載）
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param onProgress Optional: progress callback function
 * @returns 分析結果
 */
export async function analyzePublicVideo(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  try {
    console.log(`[API] Analyzing public video via YouTube URL: ${videoId}`);
    onProgress?.('📹 正在透過 YouTube URL 分析公開影片（無需下載）...');

    const analyzeResponse = await fetch(`${API_BASE_URL}/analyze-video-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        prompt: userPrompt,
        videoTitle,
      }),
    });

    if (!analyzeResponse.ok) {
      const error = await analyzeResponse.json();
      throw new Error(error.error || 'Failed to analyze video via YouTube URL');
    }

    const analyzeData = await analyzeResponse.json();
    console.log(`[API] Analysis complete (used YouTube URL)`);
    onProgress?.('✅ Gemini AI 分析完成！已生成標題、說明和標籤');

    return analyzeData;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`影片分析失敗: ${error.message}`);
  }
}

/**
 * 下載並分析未公開的 YouTube 影片
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param geminiFileName 可選：已存在的 Gemini 檔案名稱（用於重新生成）
 * @param accessToken YouTube access token (optional, for authentication)
 * @param onProgress Optional: progress callback function
 * @returns 分析結果
 */
export async function analyzeUnlistedVideo(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  geminiFileName?: string,
  accessToken?: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  try {
    // 步驟 1: 先檢查 Files API 中是否已有此檔案
    onProgress?.('🔍 步驟 1/8：檢查 Gemini 雲端是否已有此影片檔案...');
    console.log(`[API] Checking Files API for existing file: ${videoId}`);

    const checkResponse = await fetch(`${API_BASE_URL}/check-file/${videoId}`);
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.exists && !checkData.processing) {
        // 檔案存在且為 ACTIVE 狀態，直接使用
        console.log(`[API] ✅ File exists in Files API, skipping download`);
        onProgress?.('✨ 步驟 2/8：找到已上傳的影片，跳過下載與上傳（節省時間）...');
        onProgress?.('🤖 步驟 3/8：準備呼叫 Gemini AI 進行影片分析...');

        // 直接調用分析 API（不需要 filePath）
        const analyzeResponse = await fetch(`${API_BASE_URL}/analyze-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            prompt: userPrompt,
            videoTitle,
          }),
        });

        if (!analyzeResponse.ok) {
          const error = await analyzeResponse.json();
          throw new Error(error.error || 'Failed to analyze video');
        }

        onProgress?.('📊 步驟 4/8：Gemini AI 正在分析影片內容...');
        const analyzeData = await analyzeResponse.json();
        console.log(`[API] Analysis complete (reused existing file)`);
        onProgress?.('✅ 步驟 5/8：分析完成！已生成標題、說明和標籤');
        return analyzeData;
      }
    }

    // 檔案不存在或檢查失敗，需要下載
    console.log(`[API] File not found in Files API, will download`);
    onProgress?.('📥 步驟 2/8：Gemini 雲端無此影片，準備從 YouTube 下載...');
    onProgress?.('⬇️ 步驟 3/8：正在從 YouTube 下載未列出的影片（首次需要下載，可能需要數分鐘）...');
    console.log(`[API] Downloading video: ${videoId}`);
    const downloadResponse = await fetch(`${API_BASE_URL}/download-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, accessToken }),
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.error || 'Failed to download video');
    }

    const downloadData = await downloadResponse.json();
    const { filePath } = downloadData;

    console.log(`[API] Video downloaded: ${filePath}`);
    onProgress?.('✅ 步驟 4/8：影片下載完成！');
    onProgress?.('☁️ 步驟 5/8：正在上傳影片到 Gemini 雲端（首次上傳，之後可重複使用）...');

    // 上傳並分析影片
    console.log(`[API] Analyzing video with Gemini`);
    const analyzeResponse = await fetch(`${API_BASE_URL}/analyze-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        filePath,
        prompt: userPrompt,
        videoTitle,
      }),
    });

    if (!analyzeResponse.ok) {
      const error = await analyzeResponse.json();
      throw new Error(error.error || 'Failed to analyze video');
    }

    onProgress?.('⏳ 步驟 6/8：上傳完成，等待 Gemini 處理影片...');
    onProgress?.('🤖 步驟 7/8：Gemini AI 正在分析影片內容並生成 SEO 強化內容...');
    const analyzeData = await analyzeResponse.json();
    console.log(`[API] Analysis complete`);
    onProgress?.('✅ 步驟 8/8：分析完成！已生成三種標題風格、章節時間軸及 SEO 標籤');

    return analyzeData;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`影片分析失敗: ${error.message}`);
  }
}

/**
 * 使用 YouTube URL 生成文章（僅限公開影片）
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param screenshotQuality 截圖品質 (2=高畫質, 20=壓縮)
 * @param onProgress Optional: progress callback function
 * @returns 文章生成結果
 */
export async function generateArticleWithYouTubeUrl(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  screenshotQuality: number = 2,
  onProgress?: ProgressCallback
): Promise<any> {
  try {
    console.log(`[API] Generating article via YouTube URL: ${videoId}`);
    onProgress?.('📝 步驟 1/3：透過 YouTube URL 讓 Gemini AI 分析影片內容...');

    const response = await fetch(`${API_BASE_URL}/generate-article-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        prompt: userPrompt,
        videoTitle,
        quality: screenshotQuality,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate article via YouTube URL');
    }

    const data = await response.json();
    console.log(`[API] Article generated successfully (used YouTube URL)`);
    onProgress?.('✅ 文章生成完成！已產生標題、SEO 描述、文章內容及關鍵畫面截圖');

    return data;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`文章生成失敗: ${error.message}`);
  }
}

/**
 * 下載影片後生成文章（用於非公開影片）
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param screenshotQuality 截圖品質 (2=高畫質, 20=壓縮)
 * @param onProgress Optional: progress callback function
 * @returns 文章生成結果
 */
export async function generateArticleWithDownload(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  screenshotQuality: number = 2,
  onProgress?: ProgressCallback
): Promise<any> {
  try {
    console.log(`[API] Generating article with video download: ${videoId}`);

    // 步驟 1: 下載影片（生成文章需要本地檔案來截圖）
    onProgress?.('📥 步驟 1/12：準備從 YouTube 下載影片（文章生成需要本地檔案進行截圖）...');
    onProgress?.('⬇️ 步驟 2/12：正在從 YouTube 下載影片（可能需要數分鐘，視影片大小而定）...');
    console.log(`[API] Downloading video for screenshots: ${videoId}`);
    const downloadResponse = await fetch(`${API_BASE_URL}/download-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, quality: screenshotQuality }),
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.error || 'Failed to download video');
    }

    const downloadData = await downloadResponse.json();
    const { filePath } = downloadData;

    console.log(`[API] Video downloaded: ${filePath}`);
    onProgress?.('✅ 步驟 3/12：影片下載完成！');
    onProgress?.('🔍 步驟 4/12：檢查 Gemini 雲端是否已有此影片...');
    onProgress?.('🤖 步驟 5/12：準備讓 Gemini AI 分析影片內容...');
    onProgress?.('📊 步驟 6/12：Gemini AI 正在深度分析影片（理解內容、識別重點）...');
    onProgress?.('✍️ 步驟 7/12：Gemini AI 正在生成文章標題與 SEO 描述...');
    onProgress?.('📝 步驟 8/12：Gemini AI 正在撰寫文章內容...');
    onProgress?.('🎯 步驟 9/12：Gemini AI 正在規劃關鍵畫面截圖時間點...');

    // 步驟 2-5: 生成文章（後端會檢查 Files API 是否需要重新上傳）
    const response = await fetch(`${API_BASE_URL}/generate-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        filePath,
        prompt: userPrompt,
        videoTitle,
        quality: screenshotQuality,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate article');
    }

    onProgress?.('📸 步驟 10/12：正在使用 FFmpeg 擷取關鍵畫面（每個時間點截取 3 張圖片）...');
    onProgress?.('🖼️ 步驟 11/12：截圖處理中...');
    const data = await response.json();
    console.log(`[API] Article generated successfully`);
    onProgress?.('✅ 步驟 12/12：文章生成完成！已產生標題、SEO 描述、文章內容及關鍵畫面截圖');

    return data;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`文章生成失敗: ${error.message}`);
  }
}

/**
 * 清理伺服器上的暫存影片檔案
 * @param videoId YouTube 影片 ID
 */
export async function cleanupVideo(videoId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/cleanup/${videoId}`, {
      method: 'DELETE',
    });
    console.log(`[API] Cleaned up: ${videoId}`);
  } catch (error) {
    console.error(`[API] Cleanup failed:`, error);
  }
}

/**
 * 重新生成截圖（讓 Gemini 重新看影片並提供新的截圖建議）
 * @param videoId YouTube 影片 ID
 * @param videoTitle 影片標題
 * @param userPrompt 使用者額外提示
 * @param screenshotQuality 截圖品質 (2=高畫質, 20=壓縮)
 * @param onProgress Optional: progress callback function
 * @returns 新的文章生成結果（含新截圖）
 */
export async function regenerateScreenshots(
  videoId: string,
  videoTitle: string,
  userPrompt: string,
  screenshotQuality: number = 2,
  onProgress?: ProgressCallback
): Promise<any> {
  try {
    console.log(`[API] Regenerating screenshots for video: ${videoId}`);

    // 步驟 1-3: 下載影片（重新截圖需要本地檔案）
    onProgress?.('🔍 步驟 1/10：檢查本地是否有影片檔案...');
    console.log(`[API] Downloading video for screenshots: ${videoId}`);

    onProgress?.('📥 步驟 2/10：準備下載影片到本地（截圖需要本地檔案）...');
    const downloadResponse = await fetch(`${API_BASE_URL}/download-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, quality: screenshotQuality }),
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.error || 'Failed to download video');
    }

    const downloadData = await downloadResponse.json();
    const { filePath } = downloadData;

    console.log(`[API] Video downloaded: ${filePath}`);
    onProgress?.('✅ 步驟 3/10：影片已準備就緒！');

    // 步驟 4-7: Gemini 重新分析並生成新的截圖建議
    onProgress?.('☁️ 步驟 4/10：檢查 Gemini 雲端是否有此影片檔案...');
    onProgress?.('🤖 步驟 5/10：準備讓 Gemini AI 重新分析影片...');
    onProgress?.('🎬 步驟 6/10：Gemini AI 正在重新觀看影片並分析內容...');
    onProgress?.('🎯 步驟 7/10：Gemini AI 正在規劃新的關鍵畫面截圖時間點...');

    const response = await fetch(`${API_BASE_URL}/regenerate-screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        videoTitle,
        filePath,
        prompt: userPrompt,
        quality: screenshotQuality,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to regenerate screenshots');
    }

    // 步驟 8-9: FFmpeg 擷取截圖
    onProgress?.('📸 步驟 8/10：使用 FFmpeg 在新的時間點擷取關鍵畫面（每個時間點截取 3 張）...');
    onProgress?.('🖼️ 步驟 9/10：處理並儲存截圖檔案...');

    const data = await response.json();
    console.log(`[API] Screenshots regenerated successfully`);

    // 步驟 10: 完成
    onProgress?.('✅ 步驟 10/10：重新截圖完成！Gemini AI 已重新分析並產生新的關鍵畫面');

    return data;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`截圖重新生成失敗: ${error.message}`);
  }
}
