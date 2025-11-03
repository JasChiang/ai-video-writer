/**
 * 統一錯誤處理中間件
 *
 * 攔截所有錯誤並以統一的格式返回給客戶端
 */

/**
 * 自訂錯誤類別，用於更精確的錯誤處理
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // 標記為預期內的錯誤
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 全局錯誤處理中間件
 * @param {Error} err - 錯誤物件
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next 函數
 */
export function errorHandler(err, req, res, next) {
  // 預設錯誤狀態碼
  let statusCode = err.statusCode || 500;
  let message = err.message || '伺服器發生錯誤';
  let details = err.details || null;

  // 記錄錯誤（開發環境顯示完整 stack，生產環境僅顯示訊息）
  if (process.env.NODE_ENV === 'production') {
    console.error(`[Error ${statusCode}] ${message}`);
  } else {
    console.error('Error Details:', {
      statusCode,
      message,
      details,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // 返回錯誤回應
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    // 開發環境下包含 stack trace
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 Not Found 處理
 */
export function notFoundHandler(req, res, next) {
  const error = new AppError(`找不到路徑: ${req.originalUrl}`, 404);
  next(error);
}

/**
 * 非同步函數錯誤包裝器
 * 自動捕捉 async 函數中的錯誤並傳遞給錯誤處理中間件
 *
 * @param {Function} fn - 非同步函數
 * @returns {Function} - 包裝後的函數
 *
 * @example
 * app.get('/api/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 * }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
