import type { AppIconName, GeneratedContentType, ProgressCallback } from '../types';
import * as youtubeService from './youtubeService';
import { executeAsyncTask, pollTaskUntilComplete } from './taskPollingService';

// 從環境變數獲取 API 基址
// 開發模式使用 localhost:3001，生產模式使用相對路徑（與前端同域）
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const PROGRESS_PREFIX_PATTERN = /^[^a-zA-Z0-9\u4e00-\u9fff]+/u;

const sanitizeProgressText = (text: string) => text.replace(PROGRESS_PREFIX_PATTERN, '').trimStart();

const notifyProgress = (callback: ProgressCallback | undefined, icon: AppIconName, text: string) => {
  if (!callback) {
    return;
  }

  callback({
    icon,
    text: sanitizeProgressText(text),
  });
};

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
 * 使用 YouTube URL 直接分析公開影片（異步版本，適合手機端）
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param onProgress Optional: progress callback function
 * @returns 分析結果
 */
export async function analyzePublicVideoAsync(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  try {
    console.log(`[API Async] Analyzing public video via YouTube URL (async mode): ${videoId}`);

    // 使用異步任務執行
    return await executeAsyncTask(
      async () => {
        // 創建任務
        notifyProgress(onProgress, 'video', '正在建立影片分析任務...');;

        const analyzeResponse = await fetch(`${API_BASE_URL}/analyze-video-url-async`, {
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
          throw new Error(error.error || 'Failed to create analysis task');
        }

        const data = await analyzeResponse.json();
        console.log(`[API Async] Task created: ${data.taskId}`);
        return { taskId: data.taskId };
      },
      {
        interval: 2000, // 每 2 秒輪詢一次
        timeout: 10 * 60 * 1000, // 10 分鐘超時
        onProgress: (progress, message) => {
          console.log(`[API Async] Progress: ${progress}% - ${message}`);
          notifyProgress(onProgress, 'info', message);
        }
      }
    );

  } catch (error: any) {
    console.error('[API Async] Error:', error);
    throw new Error(`影片分析失敗: ${error.message}`);
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
    notifyProgress(onProgress, 'video', '正在透過 YouTube URL 分析公開影片（無需下載）...');;

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
    notifyProgress(onProgress, 'check', 'Gemini AI 分析完成！已生成標題、說明和標籤');;

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
    notifyProgress(onProgress, 'search', '步驟 1/8：檢查 Gemini 雲端是否已有此影片檔案...');;
    console.log(`[API] Checking Files API for existing file: ${videoId}`);

    const checkResponse = await fetch(`${API_BASE_URL}/check-file/${videoId}`);
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.exists && !checkData.processing) {
        // 檔案存在且為 ACTIVE 狀態，直接使用
        console.log(`[API] ✅ File exists in Files API, skipping download`);
        notifyProgress(onProgress, 'sparkles', '步驟 2/8：找到已上傳的影片，跳過下載與上傳（節省時間）...');;
        notifyProgress(onProgress, 'bot', '步驟 3/8：準備呼叫 Gemini AI 進行影片分析...');;

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

        notifyProgress(onProgress, 'analytics', '步驟 4/8：Gemini AI 正在分析影片內容...');;
        const analyzeData = await analyzeResponse.json();
        console.log(`[API] Analysis complete (reused existing file)`);
        notifyProgress(onProgress, 'check', '步驟 5/8：分析完成！已生成標題、說明和標籤');;
        return analyzeData;
      }
    }

    // 檔案不存在或檢查失敗，需要下載
    console.log(`[API] File not found in Files API, will download`);
    notifyProgress(onProgress, 'download', '步驟 2/8：Gemini 雲端無此影片，準備從 YouTube 下載...');;
    notifyProgress(onProgress, 'download', '步驟 3/8：正在從 YouTube 下載未列出的影片（首次需要下載，可能需要數分鐘）...');;
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
    notifyProgress(onProgress, 'check', '步驟 4/8：影片下載完成！');;
    notifyProgress(onProgress, 'cloudUpload', '步驟 5/8：正在上傳影片到 Gemini 雲端（首次上傳，之後可重複使用）...');;

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

    notifyProgress(onProgress, 'hourglass', '步驟 6/8：上傳完成，等待 Gemini 處理影片...');;
    notifyProgress(onProgress, 'bot', '步驟 7/8：Gemini AI 正在分析影片內容並生成 SEO 強化內容...');;
    const analyzeData = await analyzeResponse.json();
    console.log(`[API] Analysis complete`);
    notifyProgress(onProgress, 'check', '步驟 8/8：分析完成！已生成三種標題風格、章節時間軸及 SEO 標籤');;

    return analyzeData;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`影片分析失敗: ${error.message}`);
  }
}

/**
 * 使用 YouTube URL 生成文章（異步版本，適合手機端使用）
 * @param videoId YouTube 影片 ID
 * @param userPrompt 使用者額外提示
 * @param videoTitle 影片標題
 * @param screenshotQuality 截圖品質 (2=高畫質, 20=壓縮)
 * @param onProgress Optional: progress callback function
 * @param uploadedFiles Optional: uploaded reference files
 * @returns 文章生成結果
 */
export async function generateArticleWithYouTubeUrlAsync(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  screenshotQuality: number = 2,
  onProgress?: ProgressCallback,
  uploadedFiles: any[] = [],
  templateId: string = 'default',
  referenceUrls: string[] = [],
  referenceVideos: string[] = []
): Promise<any> {
  try {
    console.log(`[API Async] Generating article via YouTube URL (async mode): ${videoId}`);
    if (uploadedFiles.length > 0) {
      console.log(`[API Async] With ${uploadedFiles.length} uploaded reference files`);
    }
    if (referenceUrls.length > 0) {
      console.log(`[API Async] With ${referenceUrls.length} reference URLs`);
    }
    if (referenceVideos.length > 0) {
      console.log(`[API Async] With ${referenceVideos.length} reference videos`);
    }

    // 取得 access token
    const accessToken = youtubeService.getAccessToken();

    // 使用異步任務執行
    return await executeAsyncTask(
      async () => {
        // 創建任務
        notifyProgress(onProgress, 'notepad', '正在建立文章生成任務...');;

        const response = await fetch(`${API_BASE_URL}/generate-article-url-async`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            prompt: userPrompt,
            videoTitle,
            quality: screenshotQuality,
            uploadedFiles,
            accessToken,
            templateId,
            referenceUrls,
            referenceVideos,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create article generation task');
        }

        const data = await response.json();
        console.log(`[API Async] Task created: ${data.taskId}`);
        return { taskId: data.taskId };
      },
      {
        interval: 2000, // 每 2 秒輪詢一次
        timeout: 10 * 60 * 1000, // 10 分鐘超時
        onProgress: (progress, message) => {
          console.log(`[API Async] Progress: ${progress}% - ${message}`);
          notifyProgress(onProgress, 'spinner', message);
        }
      }
    );

  } catch (error: any) {
    console.error('[API Async] Error:', error);
    throw new Error(`文章生成失敗: ${error.message}`);
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
  onProgress?: ProgressCallback,
  uploadedFiles: any[] = [],
  templateId: string = 'default'
): Promise<any> {
  try {
    console.log(`[API] Generating article via YouTube URL: ${videoId}`);
    if (uploadedFiles.length > 0) {
      console.log(`[API] With ${uploadedFiles.length} uploaded reference files`);
    }
    notifyProgress(onProgress, 'notepad', '步驟 1/3：透過 YouTube URL 讓 Gemini AI 分析影片內容...');;

    // 取得 access token 用於下載（即使是公開影片也需要下載來截圖）
    const accessToken = youtubeService.getAccessToken();

    const response = await fetch(`${API_BASE_URL}/generate-article-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        prompt: userPrompt,
        videoTitle,
        quality: screenshotQuality,
        uploadedFiles,
        accessToken,
        templateId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate article via YouTube URL');
    }

    const data = await response.json();
    console.log(`[API] Article generated successfully (used YouTube URL)`);
    notifyProgress(onProgress, 'check', '文章生成完成！已產生標題、SEO 描述、文章內容及關鍵畫面截圖');;

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
  onProgress?: ProgressCallback,
  uploadedFiles: any[] = [],
  templateId: string = 'default',
  referenceUrls: string[] = [],
  referenceVideos: string[] = []
): Promise<any> {
  try {
    console.log(`[API] Generating article with video download: ${videoId}`);
    if (uploadedFiles.length > 0) {
      console.log(`[API] With ${uploadedFiles.length} uploaded reference files`);
    }
    if (referenceUrls.length > 0) {
      console.log(`[API] With ${referenceUrls.length} reference URLs`);
    }
    if (referenceVideos.length > 0) {
      console.log(`[API] With ${referenceVideos.length} reference videos`);
    }

    // 步驟 1: 先檢查 Files API 中是否已有此檔案
    notifyProgress(onProgress, 'search', '步驟 1/12：檢查 Gemini 雲端是否已有此影片檔案...');;
    console.log(`[API] Checking Files API for existing file: ${videoId}`);

    const checkResponse = await fetch(`${API_BASE_URL}/check-file/${videoId}`);
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.exists && !checkData.processing) {
        // 檔案存在且為 ACTIVE 狀態，直接使用
        console.log(`[API] ✅ File exists in Files API, skipping download`);
        notifyProgress(onProgress, 'sparkles', '步驟 2/12：找到已上傳的影片，跳過下載與上傳（節省時間）...');;
        notifyProgress(onProgress, 'bot', '步驟 3/12：準備讓 Gemini AI 分析影片內容...');;
        notifyProgress(onProgress, 'analytics', '步驟 4/12：Gemini AI 正在深度分析影片（理解內容、識別重點）...');;
        notifyProgress(onProgress, 'pen', '步驟 5/12：Gemini AI 正在生成文章標題與 SEO 描述...');;
        notifyProgress(onProgress, 'notepad', '步驟 6/12：Gemini AI 正在撰寫文章內容...');;
        notifyProgress(onProgress, 'target', '步驟 7/12：Gemini AI 正在規劃關鍵畫面截圖時間點...');;

        // 直接調用生成文章 API（不需要 filePath）
        const response = await fetch(`${API_BASE_URL}/generate-article`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            prompt: userPrompt,
            videoTitle,
            quality: screenshotQuality,
            uploadedFiles,
            templateId,
            referenceUrls,
            referenceVideos,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate article');
        }

        notifyProgress(onProgress, 'camera', '步驟 8/12：正在使用 FFmpeg 擷取關鍵畫面（每個時間點截取 3 張圖片）...');;
        notifyProgress(onProgress, 'image', '步驟 9/12：截圖處理中...');;
        const data = await response.json();
        console.log(`[API] Article generated successfully (reused existing file)`);
        notifyProgress(onProgress, 'check', '步驟 10/12：文章生成完成！已產生標題、SEO 描述、文章內容及關鍵畫面截圖');;
        return data;
      }
    }

    // 檔案不存在或檢查失敗，需要下載
    console.log(`[API] File not found in Files API, will download`);
    notifyProgress(onProgress, 'download', '步驟 2/12：Gemini 雲端無此影片，準備從 YouTube 下載...');;
    notifyProgress(onProgress, 'download', '步驟 3/12：正在從 YouTube 下載影片（首次需要下載，可能需要數分鐘）...');;
    console.log(`[API] Downloading video for screenshots: ${videoId}`);

    // 取得 access token 用於下載未公開影片
    const accessToken = youtubeService.getAccessToken();

    const downloadResponse = await fetch(`${API_BASE_URL}/download-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, quality: screenshotQuality, accessToken }),
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.error || 'Failed to download video');
    }

    const downloadData = await downloadResponse.json();
    const { filePath } = downloadData;

    console.log(`[API] Video downloaded: ${filePath}`);
    notifyProgress(onProgress, 'check', '步驟 4/12：影片下載完成！');;
    notifyProgress(onProgress, 'cloudUpload', '步驟 5/12：正在上傳影片到 Gemini 雲端（首次上傳，之後可重複使用）...');;
    notifyProgress(onProgress, 'bot', '步驟 6/12：準備讓 Gemini AI 分析影片內容...');;
    notifyProgress(onProgress, 'analytics', '步驟 7/12：Gemini AI 正在深度分析影片（理解內容、識別重點）...');;
    notifyProgress(onProgress, 'pen', '步驟 8/12：Gemini AI 正在生成文章標題與 SEO 描述...');;
    notifyProgress(onProgress, 'notepad', '步驟 9/12：Gemini AI 正在撰寫文章內容...');;
    notifyProgress(onProgress, 'target', '步驟 10/12：Gemini AI 正在規劃關鍵畫面截圖時間點...');;

    // 生成文章（後端會檢查 Files API 是否需要重新上傳）
    const response = await fetch(`${API_BASE_URL}/generate-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        filePath,
        prompt: userPrompt,
        videoTitle,
        quality: screenshotQuality,
        uploadedFiles,
        templateId,
        referenceUrls,
        referenceVideos,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate article');
    }

    notifyProgress(onProgress, 'camera', '步驟 11/12：正在使用 FFmpeg 擷取關鍵畫面（每個時間點截取 3 張圖片）...');;
    notifyProgress(onProgress, 'image', '步驟 12/12：截圖處理中...');;
    const data = await response.json();
    console.log(`[API] Article generated successfully`);
    notifyProgress(onProgress, 'check', '步驟 12/12：文章生成完成！已產生標題、SEO 描述、文章內容及關鍵畫面截圖');;

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
  onProgress?: ProgressCallback,
  templateId: string = 'default'
): Promise<any> {
  try {
    console.log(`[API] Regenerating screenshots for video: ${videoId}`);

    // 步驟 1-3: 下載影片（重新截圖需要本地檔案）
    notifyProgress(onProgress, 'search', '步驟 1/10：檢查本地是否有影片檔案...');;
    console.log(`[API] Downloading video for screenshots: ${videoId}`);

    notifyProgress(onProgress, 'download', '步驟 2/10：準備下載影片到本地（截圖需要本地檔案）...');;

    // 取得 access token 用於下載未公開影片
    const accessToken = youtubeService.getAccessToken();

    const downloadResponse = await fetch(`${API_BASE_URL}/download-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, quality: screenshotQuality, accessToken }),
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.json();
      throw new Error(error.error || 'Failed to download video');
    }

    const downloadData = await downloadResponse.json();
    const { filePath } = downloadData;

    console.log(`[API] Video downloaded: ${filePath}`);
    notifyProgress(onProgress, 'check', '步驟 3/10：影片已準備就緒！');;

    // 步驟 4-7: Gemini 重新分析並生成新的截圖建議
    notifyProgress(onProgress, 'cloudUpload', '步驟 4/10：檢查 Gemini 雲端是否有此影片檔案...');;
    notifyProgress(onProgress, 'bot', '步驟 5/10：準備讓 Gemini AI 重新分析影片...');;
    notifyProgress(onProgress, 'video', '步驟 6/10：Gemini AI 正在重新觀看影片並分析內容...');;
    notifyProgress(onProgress, 'target', '步驟 7/10：Gemini AI 正在規劃新的關鍵畫面截圖時間點...');;

    const response = await fetch(`${API_BASE_URL}/regenerate-screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        videoTitle,
        filePath,
        prompt: userPrompt,
        quality: screenshotQuality,
        templateId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to regenerate screenshots');
    }

    // 步驟 8-9: FFmpeg 擷取截圖
    notifyProgress(onProgress, 'camera', '步驟 8/10：使用 FFmpeg 在新的時間點擷取關鍵畫面（每個時間點截取 3 張）...');;
    notifyProgress(onProgress, 'image', '步驟 9/10：處理並儲存截圖檔案...');;

    const data = await response.json();
    console.log(`[API] Screenshots regenerated successfully`);

    // 步驟 10: 完成
    notifyProgress(onProgress, 'check', '步驟 10/10：重新截圖完成！Gemini AI 已重新分析並產生新的關鍵畫面');;

    return data;

  } catch (error: any) {
    console.error('[API] Error:', error);
    throw new Error(`截圖重新生成失敗: ${error.message}`);
  }
}

/**
 * 使用純網址生成文章（不需要 YouTube 影片）
 * @param url 網址
 * @param userPrompt 使用者額外提示
 * @param onProgress Optional: progress callback function
 * @param uploadedFiles Optional: uploaded reference files
 * @param templateId Optional: template ID
 * @param referenceUrls Optional: reference URLs
 * @param referenceVideos Optional: reference videos
 * @returns 文章生成結果
 */
export async function generateArticleFromUrlOnly(
  url: string,
  userPrompt: string,
  onProgress?: ProgressCallback,
  uploadedFiles: any[] = [],
  templateId: string = 'default',
  referenceUrls: string[] = [],
  referenceVideos: string[] = []
): Promise<any> {
  try {
    console.log(`[API URL-Only] Generating article from URL: ${url}`);
    if (uploadedFiles.length > 0) {
      console.log(`[API URL-Only] With ${uploadedFiles.length} uploaded reference files`);
    }
    if (referenceUrls.length > 0) {
      console.log(`[API URL-Only] With ${referenceUrls.length} reference URLs`);
    }
    if (referenceVideos.length > 0) {
      console.log(`[API URL-Only] With ${referenceVideos.length} reference videos`);
    }

    // 使用異步任務執行
    return await executeAsyncTask(
      async () => {
        // 創建任務
        notifyProgress(onProgress, 'notepad', '正在建立文章生成任務...');;

        const response = await fetch(`${API_BASE_URL}/generate-article-from-url-async`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            prompt: userPrompt,
            uploadedFiles,
            templateId,
            referenceUrls,
            referenceVideos,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create article generation task');
        }

        const data = await response.json();
        console.log(`[API URL-Only Async] Task created: ${data.taskId}`);
        return { taskId: data.taskId };
      },
      {
        interval: 2000, // 每 2 秒輪詢一次
        timeout: 10 * 60 * 1000, // 10 分鐘超時
        onProgress: (progress, message) => {
          console.log(`[API URL-Only Async] Progress: ${progress}% - ${message}`);
          notifyProgress(onProgress, 'spinner', message);
        }
      }
    );

  } catch (error: any) {
    console.error('[API URL-Only] Error:', error);
    throw new Error(`文章生成失敗: ${error.message}`);
  }
}
