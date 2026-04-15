/**
 * 輸入驗證中介軟體
 *
 * 提供各種驗證函數，防止安全漏洞（如 Command Injection）
 */

import { AppError } from './errorHandler.js';

/**
 * 驗證 YouTube Video ID 格式
 * YouTube Video ID 格式：11 個字元，僅允許 a-z, A-Z, 0-9, -, _
 *
 * @param {string} videoId - 要驗證的 Video ID
 * @returns {boolean} - 是否為有效格式
 */
export function isValidVideoId(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }
  // YouTube Video ID 固定為 11 個字元
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * 驗證 Video ID 的中介軟體
 * 使用方式：app.post('/api/endpoint', validateVideoId, handler)
 */
export function validateVideoId(req, res, next) {
  const videoId = req.body.videoId || req.params.videoId || req.query.videoId;

  if (!videoId) {
    return next(new AppError('缺少 videoId 參數', 400));
  }

  if (!isValidVideoId(videoId)) {
    return next(
      new AppError('無效的 Video ID 格式', 400, {
        reason: 'Video ID 必須為 11 個字元，僅包含 a-z, A-Z, 0-9, -, _',
        received: videoId,
      })
    );
  }

  next();
}

/**
 * 驗證檔案路徑安全性（防止路徑遍歷攻擊）
 *
 * @param {string} filePath - 檔案路徑
 * @returns {boolean} - 是否為安全路徑
 */
export function isValidFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // 檢查是否包含路徑遍歷字元
  const dangerousPatterns = ['..', '~/', '/etc/', '/root/', '/usr/', '/bin/', '/var/'];

  return !dangerousPatterns.some((pattern) => filePath.includes(pattern));
}

/**
 * 驗證 Gemini 檔案名稱格式
 *
 * @param {string} fileName - 檔案名稱
 * @returns {boolean} - 是否為有效格式
 */
export function isValidGeminiFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Gemini 檔案名稱格式：video_11字元ID.mp4
  return /^video_[a-zA-Z0-9_-]{11}\.mp4$/.test(fileName);
}

/**
 * 驗證截圖品質參數
 * FFmpeg -q:v 參數範圍：1-31（數字越小品質越高）
 *
 * @param {number} quality - 品質值
 * @returns {boolean} - 是否為有效值
 */
export function isValidScreenshotQuality(quality) {
  const num = Number(quality);
  return !isNaN(num) && num >= 1 && num <= 31;
}

/**
 * 驗證截圖品質的中介軟體
 */
export function validateScreenshotQuality(req, res, next) {
  const quality = req.body.quality || req.query.quality;

  // 如果沒有提供 quality，使用預設值
  if (!quality) {
    req.body.quality = 2; // 預設高品質
    return next();
  }

  if (!isValidScreenshotQuality(quality)) {
    return next(
      new AppError('無效的截圖品質參數', 400, {
        reason: '品質值必須在 1-31 之間（數字越小品質越高）',
        received: quality,
      })
    );
  }

  next();
}

/**
 * 驗證請求 body 必需欄位
 *
 * @param {Array<string>} requiredFields - 必需欄位列表
 * @returns {Function} - Express 中介軟體函數
 *
 * @example
 * app.post('/api/endpoint',
 *   validateRequiredFields(['videoId', 'title']),
 *   handler
 * );
 */
export function validateRequiredFields(requiredFields) {
  return (req, res, next) => {
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return next(
        new AppError('缺少必需參數', 400, {
          missingFields,
        })
      );
    }

    next();
  };
}
