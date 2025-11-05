import type { GeneratedContentType } from "../types";
import * as videoApiService from './videoApiService';
import * as youtubeService from './youtubeService';

export interface GenerateMetadataResult {
  content: GeneratedContentType;
  geminiFileName?: string;
  geminiFileUri?: string;
}

// 進度回調函數類型
export type ProgressCallback = (step: string) => void;

/**
 * Calls the Gemini API to generate video metadata (異步版本，適合手機端).
 * Uses YouTube URL for public videos, or thumbnail for unlisted/private videos.
 * @param videoId The YouTube video ID.
 * @param userPrompt Optional user-provided context.
 * @param videoTitle The original title of the video.
 * @param privacyStatus The privacy status of the video ('public', 'unlisted', 'private').
 * @param thumbnailUrl The thumbnail URL (fallback for non-public videos).
 * @param geminiFileName Optional: existing Gemini file name for re-generation.
 * @param onProgress Optional: progress callback function.
 * @returns A promise that resolves with the generated content (title, description, tags).
 */
export async function generateVideoMetadataAsync(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  privacyStatus: string = 'public',
  thumbnailUrl?: string,
  geminiFileName?: string,
  onProgress?: ProgressCallback,
): Promise<GenerateMetadataResult> {
  // 私人影片不支援分析
  if (privacyStatus === 'private') {
    throw new Error('私人影片不支援分析功能。請將影片設為「未列出」或「公開」後再試。');
  }

  // 未列出影片：使用後端下載+上傳的方式（目前仍使用同步版本）
  if (privacyStatus === 'unlisted') {
    console.log(`[Gemini Async] Using video download mode for unlisted video`);
    // 取得 YouTube OAuth access token（用於下載未公開影片）
    const accessToken = youtubeService.getAccessToken();
    console.log(`[Gemini Async] Access Token: ${accessToken ? '✅ 已取得' : '❌ 未登入'}`);

    // 注意：未列出影片的異步版本較複雜，暫時使用同步版本
    // TODO: 未來可以為 analyzeUnlistedVideo 也添加異步版本
    const result = await videoApiService.analyzeUnlistedVideo(
      videoId,
      userPrompt,
      videoTitle,
      geminiFileName,
      accessToken,
      onProgress
    );

    if (result.reusedExistingFile) {
      console.log(`[Gemini Async] ✅ Reused existing file - no download required`);
    }

    return {
      content: result.metadata,
      geminiFileName: result.geminiFileName,
      geminiFileUri: result.geminiFileUri,
    };
  }

  // 公開影片：使用 YouTube URL 直接分析（異步版本）
  console.log(`[Gemini Async] Analyzing public video via YouTube URL (async mode)`);
  onProgress?.('使用 YouTube URL 分析公開影片（異步模式）...');

  const result = await videoApiService.analyzePublicVideoAsync(
    videoId,
    userPrompt,
    videoTitle,
    onProgress
  );

  return {
    content: result.metadata,
    usedYouTubeUrl: true,
  };
}

/**
 * Calls the Gemini API to generate video metadata.
 * Uses YouTube URL for public videos, or thumbnail for unlisted/private videos.
 * @param videoId The YouTube video ID.
 * @param userPrompt Optional user-provided context.
 * @param videoTitle The original title of the video.
 * @param privacyStatus The privacy status of the video ('public', 'unlisted', 'private').
 * @param thumbnailUrl The thumbnail URL (fallback for non-public videos).
 * @param geminiFileName Optional: existing Gemini file name for re-generation.
 * @param onProgress Optional: progress callback function.
 * @returns A promise that resolves with the generated content (title, description, tags).
 */
export async function generateVideoMetadata(
  videoId: string,
  userPrompt: string,
  videoTitle: string,
  privacyStatus: string = 'public',
  thumbnailUrl?: string,
  geminiFileName?: string,
  onProgress?: ProgressCallback,
): Promise<GenerateMetadataResult> {
  // 私人影片不支援分析
  if (privacyStatus === 'private') {
    throw new Error('私人影片不支援分析功能。請將影片設為「未列出」或「公開」後再試。');
  }

  // 未列出影片：使用後端下載+上傳的方式
  if (privacyStatus === 'unlisted') {
    console.log(`[Gemini] Using video download mode for unlisted video`);
    // 取得 YouTube OAuth access token（用於下載未公開影片）
    const accessToken = youtubeService.getAccessToken();
    console.log(`[Gemini] Access Token: ${accessToken ? '✅ 已取得' : '❌ 未登入'}`);

    const result = await videoApiService.analyzeUnlistedVideo(
      videoId,
      userPrompt,
      videoTitle,
      geminiFileName,
      accessToken,
      onProgress
    );

    if (result.reusedExistingFile) {
      console.log(`[Gemini] ✅ Reused existing file - no download required`);
    }

    return {
      content: result.metadata,
      geminiFileName: result.geminiFileName,
      geminiFileUri: result.geminiFileUri,
    };
  }

  // 公開影片：使用 YouTube URL 直接分析（不需下載）
  console.log(`[Gemini] Analyzing public video via YouTube URL`);
  onProgress?.('使用 YouTube URL 分析公開影片...');

  const result = await videoApiService.analyzePublicVideo(
    videoId,
    userPrompt,
    videoTitle,
    onProgress
  );

  return {
    content: result.metadata,
    usedYouTubeUrl: true,
  };
}
