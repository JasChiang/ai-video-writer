// 載入 .env.local 檔案 - 必須在所有 import 之前執行！
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { generateFullPrompt } from './services/promptService.js';
import {
  generateArticlePrompt,
  getArticleTemplateStatus,
  isUsingCustomTemplates,
  listAvailableArticleTemplates,
  refreshArticleTemplates,
  disableArticleTemplates,
  enableArticleTemplates,
} from './services/articlePromptService.js';
import {
  getChannelVideosAnalytics,
  calculateUpdatePriority,
  getVideoSearchTerms,
  getVideoExternalTrafficDetails,
} from './services/analyticsService.js';
import { aggregateChannelData, clearAnalyticsCache } from './services/channelAnalyticsService.js';
import { getQuotaSnapshot as getServerQuotaSnapshot, resetQuotaSnapshot as resetServerQuotaSnapshot } from './services/quotaTracker.js';
import { generateKeywordAnalysisPrompt } from './services/keywordAnalysisPromptService.js';
import {
  uploadToGeminiFilesAPI,
  deleteGeminiFile,
  listGeminiFiles,
  getGeminiFile
} from './services/geminiFilesService.js';
import * as taskQueue from './services/taskQueue.js';
import { publishArticleToNotion, listNotionDatabases, getNotionDatabase } from './services/notionService.js';
import { fetchAllVideoTitles, uploadToGist, loadFromGist, searchVideosFromCache } from './services/videoCacheService.js';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// 檔案保留天數設定（預設 7 天）
const FILE_RETENTION_DAYS = parseInt(process.env.FILE_RETENTION_DAYS || '7', 10);

// Notion OAuth 狀態儲存（簡易 in-memory）
const notionStateStore = new Map();
const NOTION_STATE_TTL_MS = 5 * 60 * 1000; // 5 分鐘有效

function pruneExpiredNotionStates() {
  const now = Date.now();
  for (const [state, meta] of notionStateStore.entries()) {
    if (now - meta.createdAt > NOTION_STATE_TTL_MS) {
      notionStateStore.delete(state);
    }
  }
}

// 下載速率限制（保護用戶帳號安全）
const downloadRateLimiter = new Map(); // key: userId/token, value: { count, resetTime }
const ipRateLimiter = new Map(); // key: IP address, value: { count, resetTime }
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 小時
const MAX_DOWNLOADS_PER_HOUR = 10; // 每小時最多 10 次下載（每個帳號）
const MAX_DOWNLOADS_PER_HOUR_PER_IP = 20; // 每小時最多 20 次下載（每個 IP，防止濫用多帳號）
const CUSTOM_TEMPLATE_REFRESH_INTERVAL_MS = Number(process.env.CUSTOM_TEMPLATE_REFRESH_INTERVAL_MS || 15 * 60 * 1000);

function checkRateLimit(identifier, limiterMap, maxDownloads) {
  const now = Date.now();
  const record = limiterMap.get(identifier);

  if (!record || now > record.resetTime) {
    // 新的時間窗口
    limiterMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: maxDownloads - 1 };
  }

  if (record.count >= maxDownloads) {
    const waitMinutes = Math.ceil((record.resetTime - now) / (60 * 1000));
    return {
      allowed: false,
      remaining: 0,
      waitMinutes
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxDownloads - record.count
  };
}

if (process.env.CUSTOM_TEMPLATE_URL && !Number.isNaN(CUSTOM_TEMPLATE_REFRESH_INTERVAL_MS) && CUSTOM_TEMPLATE_REFRESH_INTERVAL_MS > 0) {
  setInterval(() => {
    refreshArticleTemplates()
      .then(() => {
        console.log('[Templates] ⟳ 已自動重新載入遠端模板');
      })
      .catch((error) => {
        console.error('[Templates] 自動重新載入失敗:', error.message);
      });
  }, CUSTOM_TEMPLATE_REFRESH_INTERVAL_MS);
}

// 驗證 API Key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY is not set in .env.local');
  console.error('Please add GEMINI_API_KEY=your_api_key to .env.local');
  process.exit(1);
}

console.log('✅ Gemini API Key loaded successfully');

// CORS 配置 - 只允許指定的前端網址
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// 確保下載目錄存在
const DOWNLOAD_DIR = path.join(process.cwd(), 'temp_videos');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 確保圖片目錄存在
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// 確保暫存檔案目錄存在
const TEMP_FILES_DIR = path.join(process.cwd(), 'temp_files');
if (!fs.existsSync(TEMP_FILES_DIR)) {
  fs.mkdirSync(TEMP_FILES_DIR, { recursive: true });
}

// 靜態檔案服務 - 提供截圖存取
app.use('/images', express.static(IMAGES_DIR));

// ==================== Multer 檔案上傳配置 ====================

// 配置檔案上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_FILES_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024  // 限制 100MB
  },
  fileFilter: (req, file, cb) => {
    // 驗證檔案類型
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/flac',
      'text/plain', 'text/csv', 'text/markdown',
      'application/octet-stream'  // .md 檔案可能被識別為這個
    ];

    // 檢查副檔名（特別處理 .md 檔案）
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.mp3', '.wav', '.flac', '.txt', '.csv', '.md'];

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支援的檔案類型: ${file.mimetype} (${ext})`));
    }
  }
});

// 前端執行期設定：由後端輸出 config.js，避免在建置期烘入敏感或會變動的設定
app.get('/app-config.js', (_req, res) => {
  const cfg = {
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || null,
    YOUTUBE_SCOPES: 'https://www.googleapis.com/auth/youtube',
  };
  res.type('application/javascript').send(`window.__APP_CONFIG__ = ${JSON.stringify(cfg)};`);
});

app.get('/api/quota/server', (_req, res) => {
  res.json(getServerQuotaSnapshot());
});

app.get('/api/templates', async (_req, res) => {
  try {
    const templates = await listAvailableArticleTemplates();
    const status = getArticleTemplateStatus();
    res.json({
      success: true,
      templates,
      usingCustomTemplates: status.usingCustomTemplates,
      lastLoadedAt: status.lastLoadedAt,
      disabled: status.disabled,
    });
  } catch (error) {
    console.error('[Templates] 無法取得模板清單:', error);
    res.status(500).json({
      error: 'Failed to load templates',
      details: error.message,
    });
  }
});

app.post('/api/quota/server/reset', (_req, res) => {
  resetServerQuotaSnapshot();
  res.json({ success: true });
});

app.post('/api/templates/refresh', async (_req, res) => {
  if (!process.env.CUSTOM_TEMPLATE_URL) {
    return res.status(400).json({ error: '未設定遠端模板，無需重新整理' });
  }

  try {
    await refreshArticleTemplates();
    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] 重新整理失敗:', error);
    res.status(500).json({
      error: 'Failed to refresh templates',
      details: error.message,
    });
  }
});

app.post('/api/templates/disable', (_req, res) => {
  disableArticleTemplates();
  res.json({ success: true });
});

app.post('/api/templates/enable', async (_req, res) => {
  if (!process.env.CUSTOM_TEMPLATE_URL) {
    return res.status(400).json({ error: '未設定遠端模板，無法啟用' });
  }

  try {
    enableArticleTemplates();
    await refreshArticleTemplates();
    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] 啟用自訂模板失敗:', error);
    res.status(500).json({
      error: 'Failed to enable templates',
      details: error.message,
    });
  }
});

/**
 * 取得 Notion OAuth 授權 URL
 * GET /api/notion/oauth/url
 */
app.get('/api/notion/oauth/url', (req, res) => {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(400).json({
        error: 'Notion OAuth 尚未設定，請在環境變數加入 NOTION_CLIENT_ID 及 NOTION_REDIRECT_URI。',
      });
    }

    pruneExpiredNotionStates();

    // 透過 query 明確帶入前端來源，避免瀏覽器省略 Origin header 時無法判別
    let requestOrigin = null;
    if (typeof req.query.origin === 'string' && req.query.origin) {
      requestOrigin = req.query.origin;
    } else if (Array.isArray(req.query.origin) && req.query.origin.length > 0) {
      requestOrigin = req.query.origin[0];
    } else if (req.headers.origin) {
      requestOrigin = req.headers.origin;
    }

    const state = crypto.randomBytes(16).toString('hex');
    notionStateStore.set(state, {
      createdAt: Date.now(),
      origin: requestOrigin,
    });

    const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    notionAuthUrl.searchParams.set('response_type', 'code');
    notionAuthUrl.searchParams.set('owner', 'user');
    notionAuthUrl.searchParams.set('client_id', clientId);
    notionAuthUrl.searchParams.set('redirect_uri', redirectUri);
    notionAuthUrl.searchParams.set('state', state);
    notionAuthUrl.searchParams.set('scope', 'databases.read,databases.write');

    res.json({ url: notionAuthUrl.toString(), state });
  } catch (error) {
    console.error('[Notion] 產生授權 URL 失敗:', error);
    res.status(500).json({ error: '無法產生 Notion 授權網址' });
  }
});

// 舊版回呼路徑相容性：將 /api/notion/callback 重新導向至新的 oauth/callback
app.get('/api/notion/callback', (req, res) => {
  const params = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined) {
          params.append(key, String(item));
        }
      });
    } else if (value !== undefined) {
      params.append(key, String(value));
    }
  });

  const queryString = params.toString();
  const redirectPath = `/api/notion/oauth/callback${queryString ? `?${queryString}` : ''}`;
  res.redirect(302, redirectPath);
});

/**
 * Notion OAuth callback
 * GET /api/notion/oauth/callback
 */
app.get('/api/notion/oauth/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  const sendOAuthResult = (payload, targetOrigin) => {
    const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
    const safeOrigin = targetOrigin || process.env.FRONTEND_URL || 'http://localhost:3000';
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Notion 授權</title>
  </head>
  <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
    <div>
      <p>正在關閉視窗...</p>
    </div>
    <script>
      (function () {
        const payload = ${safePayload};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'notion:oauth:result', payload }, '${safeOrigin}');
          window.close();
        } else {
          const pre = document.createElement('pre');
          pre.textContent = JSON.stringify(payload, null, 2);
          document.body.innerHTML = '';
          document.body.appendChild(pre);
        }
      })();
    </script>
  </body>
</html>`;
    res.type('text/html').send(html);
  };

  pruneExpiredNotionStates();

  if (error) {
    console.error('[Notion] OAuth error:', error, errorDescription);
    return sendOAuthResult(
      {
        success: false,
        error,
        message: errorDescription || 'Notion 授權失敗',
      },
      process.env.FRONTEND_URL
    );
  }

  if (!state || !notionStateStore.has(state)) {
    console.error('[Notion] OAuth state 驗證失敗');
    return sendOAuthResult(
      {
        success: false,
        error: 'invalid_state',
        message: '授權逾時或來源無效，請重新嘗試。',
      },
      process.env.FRONTEND_URL
    );
  }

  const stateMeta = notionStateStore.get(state);
  notionStateStore.delete(state);

  if (!code) {
    return sendOAuthResult(
      {
        success: false,
        error: 'missing_code',
        message: '未收到授權碼，請重新嘗試。',
      },
      stateMeta?.origin || process.env.FRONTEND_URL
    );
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[Notion] OAuth 環境變數未設定完整');
    return sendOAuthResult(
      {
        success: false,
        error: 'missing_environment',
        message: '伺服器未設定 Notion OAuth 所需環境變數。',
      },
      stateMeta?.origin || process.env.FRONTEND_URL
    );
  }

  try {
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[Notion] 交換 token 失敗:', tokenData);
      return sendOAuthResult(
        {
          success: false,
          error: 'token_exchange_failed',
          message: tokenData?.message || 'Notion token 交換失敗，請稍後再試。',
        },
        stateMeta?.origin || process.env.FRONTEND_URL
      );
    }

    sendOAuthResult(
      {
        success: true,
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          workspaceId: tokenData.workspace_id || null,
          workspaceName: tokenData.workspace_name || '',
          workspaceIcon: tokenData.workspace_icon || null,
          botId: tokenData.bot_id || null,
          duplicatedTemplateId: tokenData.duplicated_template_id || null,
        },
      },
      stateMeta?.origin || process.env.FRONTEND_URL
    );
  } catch (err) {
    console.error('[Notion] OAuth callback 發生錯誤:', err);
    sendOAuthResult(
      {
        success: false,
        error: 'unexpected_error',
        message: err.message || 'Notion 授權時發生未知錯誤。',
      },
      stateMeta?.origin || process.env.FRONTEND_URL
    );
  }
});

/**
 * 將文章內容發佈到 Notion 資料庫
 * POST /api/notion/publish
 */
app.post('/api/notion/publish', async (req, res) => {
  try {
    const {
      notionToken,
      databaseId,
      title,
      article,
      seoDescription,
      videoUrl,
      titleProperty,
      screenshotPlan,
      imageUrls,
    } = req.body || {};

    const resolvedToken = notionToken || process.env.NOTION_API_TOKEN;
    const resolvedDatabaseId = databaseId || process.env.NOTION_DATABASE_ID;
    const resolvedTitleProperty =
      titleProperty || process.env.NOTION_TITLE_PROPERTY || 'Name';

    if (!resolvedToken) {
      return res.status(400).json({
        error: '缺少 Notion 金鑰。請在請求中提供 notionToken 或設定 NOTION_API_TOKEN 環境變數。',
      });
    }

    if (!resolvedDatabaseId) {
      return res.status(400).json({
        error: '缺少 Notion 資料庫 ID。請在請求中提供 databaseId 或設定 NOTION_DATABASE_ID 環境變數。',
      });
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: '缺少 Notion 頁面標題。' });
    }

    if (typeof article !== 'string' || article.trim().length === 0) {
      return res.status(400).json({ error: '缺少文章內容。' });
    }

    console.log('[Notion] 正在發佈文章到資料庫:', resolvedDatabaseId);

    const result = await publishArticleToNotion({
      notionToken: resolvedToken,
      databaseId: resolvedDatabaseId,
      title: title.trim(),
      article,
      seoDescription: typeof seoDescription === 'string' ? seoDescription : undefined,
      videoUrl: typeof videoUrl === 'string' ? videoUrl : undefined,
      titleProperty: resolvedTitleProperty,
      screenshotPlan: Array.isArray(screenshotPlan) ? screenshotPlan : undefined,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
    });

    console.log('[Notion] 發佈成功，頁面 ID:', result.pageId);

    res.json({
      success: true,
      pageId: result.pageId,
      url: result.url,
    });
  } catch (error) {
    console.error('[Notion] 發佈失敗:', error);
    res.status(500).json({
      error: error.message || 'Notion 發佈失敗，請稍後再試。',
    });
  }
});

/**
 * 取得使用者可存取的 Notion 資料庫清單
 * POST /api/notion/databases
 */
app.post('/api/notion/databases', async (req, res) => {
  try {
    const { notionToken, pageSize, startCursor } = req.body || {};

    if (!notionToken) {
      return res.status(400).json({
        error: '缺少 Notion Access Token',
      });
    }

    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : undefined;

    const result = await listNotionDatabases(notionToken, {
      pageSize: parsedPageSize,
      startCursor: startCursor || undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('[Notion] 取得資料庫列表失敗:', error);
    const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({
      error: error.message || '取得 Notion 資料庫列表失敗',
    });
  }
});

/**
 * 取得指定 Notion 資料庫的欄位資訊
 * POST /api/notion/database-info
 */
app.post('/api/notion/database-info', async (req, res) => {
  try {
    const { notionToken, databaseId } = req.body || {};

    if (!notionToken || !databaseId) {
      return res.status(400).json({
        error: '缺少 Notion Access Token 或資料庫 ID',
      });
    }

    const databaseInfo = await getNotionDatabase(notionToken, databaseId);

    res.json(databaseInfo);
  } catch (error) {
    console.error('[Notion] 取得資料庫資訊失敗:', error);
    const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({
      error: error.message || '取得 Notion 資料庫資訊失敗',
    });
  }
});

// ==================== 安全性驗證函數 ====================

/**
 * 驗證 YouTube Video ID 格式
 * YouTube Video ID 格式：11 個字元，僅允許 a-z, A-Z, 0-9, -, _
 * @param {string} videoId - 要驗證的 Video ID
 * @returns {boolean} - 是否為有效格式
 */
function isValidVideoId(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }
  // YouTube Video ID 固定為 11 個字元
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

// ==================== 截圖工具函數 ====================

/**
 * 將時間字串（mm:ss）轉換為秒數
 * @param {string} timeStr - 時間字串（格式：mm:ss）
 * @returns {number} - 秒數
 */
function timeToSeconds(timeStr) {
  if (typeof timeStr === 'number' && Number.isFinite(timeStr)) {
    return Math.max(0, timeStr);
  }

  if (!timeStr || typeof timeStr !== 'string') {
    console.warn('[Capture] ⚠️ 無法解析截圖時間點，收到的值：', timeStr);
    return 0;
  }

  const normalized = timeStr.trim();
  if (!normalized) {
    console.warn('[Capture] ⚠️ 截圖時間點為空字串');
    return 0;
  }

  // 純數字（秒）
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  const parts = normalized.split(':').map(part => part.trim());
  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number);
    if ([minutes, seconds].every(value => Number.isFinite(value))) {
      return Math.max(0, minutes * 60 + seconds);
    }
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);
    if ([hours, minutes, seconds].every(value => Number.isFinite(value))) {
      return Math.max(0, hours * 3600 + minutes * 60 + seconds);
    }
  }

  console.warn('[Capture] ⚠️ 無法解析截圖時間點格式，收到的值：', timeStr);
  return 0;
}

/**
 * 將秒數轉換為時間字串（mm:ss）
 * @param {number} seconds - 秒數
 * @returns {string} - 時間字串（格式：mm:ss）
 */
function secondsToTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 使用 FFmpeg 截取影片畫面
 * @param {string} videoPath - 影片檔案路徑
 * @param {number} timeInSeconds - 截圖時間點（秒）
 * @param {string} outputPath - 輸出檔案路徑
 * @param {number} quality - 截圖品質（2-31，數字越小品質越高），預設 2（最高品質）
 * @returns {Promise<void>}
 */
async function captureScreenshot(videoPath, timeInSeconds, outputPath, quality = 2) {
  // 限制品質範圍在 2-31 之間
  const validQuality = Math.max(2, Math.min(31, quality));

  // FFmpeg 截圖命令
  // -ss: 指定時間點
  // -i: 輸入檔案
  // -vframes 1: 只截取一幀
  // -q:v: JPEG 品質（2=最高品質，31=最低品質）
  // -y: 覆蓋已存在的檔案
  const command = `ffmpeg -ss ${timeInSeconds} -i "${videoPath}" -vframes 1 -q:v ${validQuality} "${outputPath}" -y`;
  await execAsync(command);
}

// =============== Files API helpers ===============
/**
 * 使用 Files API 以 displayName 尋找檔案（支援分頁）。
 * 回傳第一個符合 displayName 的檔案（可為任何 state）。
 */
async function findFileByDisplayName(ai, displayName) {
  try {
    const iterable = await ai.files.list({ config: { pageSize: 50 } });
    for await (const file of iterable) {
      if (file?.displayName === displayName) {
        return file;
      }
    }
    return null;
  } catch (err) {
    console.error('[FilesAPI] list error:', err?.message || err);
    throw err;
  }
}

// ==================== API 端點 ====================

// ==================== 任務隊列 API ====================

/**
 * 查詢任務狀態
 * GET /api/task/:taskId
 */
app.get('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = taskQueue.getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    progressMessage: task.progressMessage,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  });
});

/**
 * 取消任務
 * DELETE /api/task/:taskId
 */
app.delete('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = taskQueue.getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.status === taskQueue.TaskStatus.PROCESSING) {
    return res.status(400).json({ error: 'Cannot cancel a task that is currently processing' });
  }

  taskQueue.failTask(taskId, 'Task cancelled by user');
  res.json({ success: true, message: 'Task cancelled' });
});

// ==================== 影片處理 API ====================

/**
 * 下載 YouTube 影片
 * POST /api/download-video
 * Body: { videoId: string, accessToken: string, quality?: number }
 */
app.post('/api/download-video', async (req, res) => {
  const { videoId, accessToken, quality = 2 } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  // 速率限制檢查（雙重保護：帳號 + IP）
  const rateLimitId = accessToken || req.ip;
  const clientIp = req.ip;

  // 1. 檢查帳號/Token 限制
  const tokenRateCheck = checkRateLimit(rateLimitId, downloadRateLimiter, MAX_DOWNLOADS_PER_HOUR);
  if (!tokenRateCheck.allowed) {
    console.warn(`[Download] Token rate limit exceeded for ${rateLimitId}`);
    return res.status(429).json({
      error: '下載次數已達上限',
      message: `為保護您的帳號安全，請在 ${tokenRateCheck.waitMinutes} 分鐘後再試`,
      waitMinutes: tokenRateCheck.waitMinutes,
      limitType: 'account'
    });
  }

  // 2. 檢查 IP 限制（防止多帳號濫用）
  const ipRateCheck = checkRateLimit(clientIp, ipRateLimiter, MAX_DOWNLOADS_PER_HOUR_PER_IP);
  if (!ipRateCheck.allowed) {
    console.warn(`[Download] IP rate limit exceeded for ${clientIp}`);
    return res.status(429).json({
      error: '下載次數已達上限',
      message: `此 IP 位址下載次數過多，請在 ${ipRateCheck.waitMinutes} 分鐘後再試`,
      waitMinutes: ipRateCheck.waitMinutes,
      limitType: 'ip'
    });
  }

  console.log(`[Download] Rate limit - Token: ${tokenRateCheck.remaining} remaining, IP: ${ipRateCheck.remaining} remaining`);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // 不指定副檔名，讓 yt-dlp 根據 --merge-output-format 自動處理
  const outputTemplate = path.join(DOWNLOAD_DIR, videoId);
  const outputPath = `${outputTemplate}.mp4`;

  try {
    console.log(`\n========== 🎬 開始下載影片 ==========`);
    console.log(`[Download] Video ID: ${videoId}`);
    console.log(`[Download] Video URL: ${videoUrl}`);
    console.log(`[Download] OAuth Token: ${accessToken ? '✅ 已提供（使用 OAuth 認證）' : '❌ 未提供（匿名下載）'}`);

    // 檢查 yt-dlp 是否安裝
    console.log(`[Download] Checking yt-dlp installation...`);
    try {
      const { stdout } = await execAsync('yt-dlp --version');
      console.log(`[Download] ✅ yt-dlp version: ${stdout.trim()}`);
    } catch (error) {
      console.error(`[Download] ❌ yt-dlp not found`);
      return res.status(500).json({
        error: 'yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp#installation'
      });
    }

    // 使用 yt-dlp 下載未列出影片
    // 不使用 cookies，依賴 yt-dlp 的內建機制

    // 根據截圖品質決定影片解析度
    // quality=2（高畫質截圖）→ 下載 1080p 影片（至少 720p）
    // quality=20（壓縮截圖）→ 下載 720p 影片（至少 480p）
    let formatSelector;
    if (quality <= 10) {
      // 高品質：優先 1080p，次選 720p，最後接受 >=480p 或最佳
      formatSelector = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"';
      console.log(`[Download] 截圖品質: ${quality}（高畫質）→ 目標影片解析度: 1080p (退回 720p)`);
    } else {
      // 壓縮：優先 720p，次選 480p，最後接受 360p 或最佳
      formatSelector = '"bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"';
      console.log(`[Download] 截圖品質: ${quality}（壓縮）→ 目標影片解析度: 720p (退回 480p)`);
    }

    // 建構命令（簡化版本）
    const commandParts = [
      'yt-dlp',
      // 根據品質選擇格式
      '-f', formatSelector,
      // 如果下載分離的音視頻流，合併為 mp4
      '--merge-output-format', 'mp4',
      // 使用模板而非最終路徑，讓 yt-dlp 正確處理合併
      '-o', `"${outputTemplate}.%(ext)s"`,
      // 添加影片 URL
      `"${videoUrl}"`
    ];

    // 注意：yt-dlp 不支援透過 Authorization header 下載 YouTube 影片
    // 對於非公開影片，應該先上傳到 Gemini Files API 再使用
    if (accessToken) {
      console.log('[Download] ⚠️  Access token provided but not used (yt-dlp does not support Authorization header for YouTube)');
      console.log('[Download] ℹ️  For unlisted videos, please ensure the video is already uploaded to Gemini Files API');
    }

    const command = commandParts.join(' ');

    console.log(`[Download] Executing command:\n${command}`);
    console.log(`[Download] 正在下載影片,請稍候...`);

    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      if (stdout) console.log('[Download] yt-dlp output:', stdout);
      if (stderr) console.log('[Download] yt-dlp warnings:', stderr);
    } catch (execError) {
      // 即使命令失敗，如果檔案存在就繼續處理（可能是警告導致的非零退出碼）
      console.log('[Download] Command returned error, checking if file exists...');
      if (execError.stdout) console.log('[Download] yt-dlp output:', execError.stdout);
      if (execError.stderr) console.log('[Download] yt-dlp warnings:', execError.stderr);

      if (!fs.existsSync(outputPath)) {
        // 檔案不存在，真的失敗了
        throw execError;
      }
      console.log('[Download] File exists despite error, continuing...');
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('Video download failed - file not found');
    }

    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[Download] ✅ 影片下載成功!`);
    console.log(`[Download] 檔案路徑: ${outputPath}`);
    console.log(`[Download] 檔案大小: ${fileSizeMB} MB`);
    console.log(`========== 下載完成 ==========\n`);

    res.json({
      success: true,
      filePath: outputPath,
      videoId
    });

  } catch (error) {
    console.error('Download error:', error);

    // 提供更詳細的錯誤訊息
    let errorDetails = error.message;
    if (error.stderr) {
      errorDetails += `\nstderr: ${error.stderr}`;
    }
    if (error.stdout) {
      errorDetails += `\nstdout: ${error.stdout}`;
    }

    res.status(500).json({
      error: 'Failed to download video',
      details: errorDetails,
      videoId,
      videoUrl
    });
  }
});

/**
 * 使用 YouTube URL 直接分析公開影片（異步版本，手機友好）
 * POST /api/analyze-video-url-async
 * Body: { videoId: string, prompt: string, videoTitle: string }
 * Response: { taskId: string }
 */
app.post('/api/analyze-video-url-async', async (req, res) => {
  const { videoId, prompt, videoTitle } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  try {
    // 創建任務
    const taskId = taskQueue.createTask('analyze-video-url', {
      videoId,
      prompt,
      videoTitle
    });

    // 立即返回任務 ID
    res.json({
      success: true,
      taskId,
      message: '任務已建立，請使用 taskId 查詢進度'
    });

    // 在背景執行任務
    taskQueue.executeTask(taskId, async (taskId) => {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`\n========== 🤖 [Task ${taskId}] 使用 YouTube URL 分析影片 ==========`);
      console.log(`[Analyze URL] Video ID: ${videoId}`);
      console.log(`[Analyze URL] YouTube URL: ${youtubeUrl}`);
      console.log(`[Analyze URL] Video Title: ${videoTitle}`);

      taskQueue.updateTaskProgress(taskId, 20, '初始化 Gemini AI...');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 生成提示詞
      taskQueue.updateTaskProgress(taskId, 40, '正在生成 SEO 強化內容...');
      console.log('[Analyze URL] 正在生成 SEO 強化內容...');
      const fullPrompt = generateFullPrompt(videoTitle, prompt);

      taskQueue.updateTaskProgress(taskId, 60, 'Gemini AI 正在分析影片...');

      // 直接使用 YouTube URL 呼叫 Gemini API
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: youtubeUrl } },
              { text: fullPrompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      taskQueue.updateTaskProgress(taskId, 90, '解析 AI 回應...');

      console.log('[Analyze URL] ✅ Gemini 分析完成!');
      const result = JSON.parse(response.text);
      console.log(`[Analyze URL] Generated: ${result.titleA}`);
      console.log(`========== 分析完成 ==========\n`);

      taskQueue.updateTaskProgress(taskId, 100, '分析完成！');

      return {
        success: true,
        metadata: result,
        usedYouTubeUrl: true
      };
    });

  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
});

/**
 * 使用 YouTube URL 直接分析影片（僅限公開影片）
 * POST /api/analyze-video-url
 * Body: { videoId: string, prompt: string, videoTitle: string }
 */
app.post('/api/analyze-video-url', async (req, res) => {
  const { videoId, prompt, videoTitle } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    console.log(`\n========== 🤖 使用 YouTube URL 分析影片 ==========`);
    console.log(`[Analyze URL] Video ID: ${videoId}`);
    console.log(`[Analyze URL] YouTube URL: ${youtubeUrl}`);
    console.log(`[Analyze URL] Video Title: ${videoTitle}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 生成提示詞
    console.log('[Analyze URL] 正在生成 SEO 強化內容...');
    const fullPrompt = generateFullPrompt(videoTitle, prompt);

    // 直接使用 YouTube URL 呼叫 Gemini API
    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: youtubeUrl } },
            { text: fullPrompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    console.log('[Analyze URL] ✅ Gemini 分析完成!');
    const result = JSON.parse(response.text);
    console.log(`[Analyze URL] Generated: ${result.titleA}`);
    console.log(`========== 分析完成 ==========\n`);

    res.json({
      success: true,
      metadata: result,
      usedYouTubeUrl: true
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze video via YouTube URL',
      details: error.message
    });
  }
});

// （Moved to bottom）

/**
 * 上傳影片到 Gemini 並生成 metadata（用於非公開影片）
 * POST /api/analyze-video
 * Body: { videoId: string, filePath?: string, prompt: string, videoTitle: string }
 */
app.post('/api/analyze-video', async (req, res) => {
  const { videoId, filePath, prompt, videoTitle } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  try {
    console.log(`\n========== 🤖 開始分析影片 ==========`);
    console.log(`[Analyze] Video ID: ${videoId}`);
    console.log(`[Analyze] File Path: ${filePath || '(not provided, will check Files API)'}`);
    console.log(`[Analyze] Video Title: ${videoTitle}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 先檢查檔案是否已存在於 Files API
    console.log('[Analyze] 步驟 1/4: 檢查 Files API 中是否已有此檔案...');
    const existingFile = await findFileByDisplayName(ai, videoId);

    let uploadedFile;
    let reusedFile = false;

    if (existingFile) {
      console.log(`[Analyze] ✅ 找到已存在的檔案，將重複使用！`);
      console.log(`[Analyze] File Name: ${existingFile.name}`);
      console.log(`[Analyze] Display Name: ${existingFile.displayName}`);
      console.log(`[Analyze] File URI: ${existingFile.uri}`);
      console.log(`[Analyze] 跳過上傳步驟，節省時間和流量！`);
      uploadedFile = existingFile;
      reusedFile = true;

      // 刪除本地已下載的暫存檔案（如果有提供的話）
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Analyze] 🗑️  已刪除不需要的暫存檔案: ${filePath}`);
      }
    } else {
      // 檔案不存在於 Files API
      if (!filePath) {
        return res.status(400).json({
          error: 'File not found in Files API and no filePath provided for upload'
        });
      }

      console.log('[Analyze] 檔案不存在，需要上傳...');
      // 上傳影片到 Gemini（使用 videoId 作為 displayName）
      uploadedFile = await ai.files.upload({
        file: filePath,
        config: {
          mimeType: 'video/mp4',
          displayName: videoId  // 使用 videoId 作為檔案名稱，方便後續查找
        },
      });

      console.log(`[Analyze] ✅ 檔案已上傳`);
      console.log(`[Analyze] File Name (系統生成): ${uploadedFile.name}`);
      console.log(`[Analyze] Display Name (我們設定): ${uploadedFile.displayName}`);
      console.log(`[Analyze] File URI: ${uploadedFile.uri}`);
      console.log(`[Analyze] File State: ${uploadedFile.state}`);
    }

    // 等待檔案處理完成（變成 ACTIVE 狀態）
    if (uploadedFile.state === 'PROCESSING') {
        console.log('[Analyze] ⏳ Gemini 正在處理影片,等待處理完成...');

        let attempts = 0;
        const maxAttempts = 60; // 最多等待 60 次（約 5 分鐘）
        let isActive = false;

        while (!isActive && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒

          try {
            // 使用 files.get() 來檢查特定檔案的狀態
            const fetchedFile = await ai.files.get({ name: uploadedFile.name });

            if (fetchedFile) {
              const progress = Math.round(((attempts + 1) / maxAttempts) * 100);
              console.log(`[Analyze] 檢查狀態 ${attempts + 1}/${maxAttempts} (${progress}%) - State: ${fetchedFile.state}`);

              if (fetchedFile.state === 'ACTIVE') {
                isActive = true;
                console.log('[Analyze] ✅ 檔案處理完成,可以開始分析!');
              } else if (fetchedFile.state === 'FAILED') {
                throw new Error('File processing failed');
              }
            }
          } catch (error) {
            console.log(`[Analyze] ⚠️  檢查 ${attempts + 1}/${maxAttempts} 時發生錯誤: ${error.message}`);
            // 繼續嘗試
          }

          attempts++;
        }

        if (!isActive) {
          throw new Error('File processing timeout. Please try again later.');
        }
      } else if (uploadedFile.state === 'ACTIVE') {
        console.log('[Analyze] ✅ 檔案已經是 ACTIVE 狀態');
      } else {
        throw new Error(`Unexpected file state: ${uploadedFile.state}`);
      }

    // 生成提示詞
    console.log('[Analyze] 步驟 4/4: 正在生成 SEO 強化內容...');
    const fullPrompt = generateFullPrompt(videoTitle, prompt);

    // 呼叫 Gemini API
    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: uploadedFile.uri, mimeType: 'video/mp4' } },
            { text: fullPrompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    console.log('[Analyze] ✅ Gemini 分析完成!');
    const result = JSON.parse(response.text);
    console.log(`[Analyze] Generated: ${result.titleA}`);

    // 清理暫存檔案（如果還存在的話）
    if (!reusedFile && filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Analyze] 🗑️  已刪除暫存檔案: ${filePath}`);
    }
    console.log(`========== 分析完成 ==========\n`);

    res.json({
      success: true,
      metadata: result,
      geminiFileName: uploadedFile.name,
      geminiFileUri: uploadedFile.uri
    });

  } catch (error) {
    console.error('Analysis error:', error);

    // 清理暫存檔案
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      error: 'Failed to analyze video',
      details: error.message
    });
  }
});

/**
 * 檢查 Gemini 檔案是否仍然存在並重新分析
 * POST /api/reanalyze-with-existing-file
 * Body: { geminiFileName: string, prompt: string, videoTitle: string }
 */
app.post('/api/reanalyze-with-existing-file', async (req, res) => {
  const { geminiFileName, prompt, videoTitle } = req.body;

  if (!geminiFileName) {
    return res.status(400).json({ error: 'Missing geminiFileName' });
  }

  try {
    console.log(`Checking if Gemini file exists: ${geminiFileName}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 嘗試取得檔案
    let fileInfo;
    try {
      fileInfo = await ai.files.get({ name: geminiFileName });
    } catch (error) {
      console.log(`File not found or error: ${error.message}`);
      return res.status(404).json({ error: 'File not found', needsRedownload: true });
    }

    // 檢查檔案狀態
    if (fileInfo.state === 'FAILED') {
      return res.status(404).json({ error: 'File processing failed', needsRedownload: true });
    }

    if (fileInfo.state !== 'ACTIVE') {
      return res.status(400).json({ error: 'File is not ready', state: fileInfo.state });
    }

    console.log(`✅ File found and active: ${fileInfo.uri}`);

    // 生成提示詞（與 analyze-video 相同）
    const fullPrompt = generateFullPrompt(videoTitle, prompt);

    // 呼叫 Gemini API
    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: fileInfo.uri, mimeType: 'video/mp4' } },
            { text: fullPrompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);

    res.json({
      success: true,
      metadata: result,
      geminiFileName: fileInfo.name,
      geminiFileUri: fileInfo.uri,
      reusedExistingFile: true
    });

  } catch (error) {
    console.error('Reanalysis error:', error);
    res.status(500).json({
      error: 'Failed to reanalyze video',
      details: error.message
    });
  }
});

/**
 * 使用 Gemini AI 分析頻道表現
 * POST /api/analyze-channel
 * Body: ChannelAnalysisRequest (see channelAnalyticsAIService.ts)
 */
app.post('/api/analyze-channel', async (req, res) => {
  const { startDate, endDate, channelId, videos, channelStats } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Missing startDate or endDate' });
  }

  if (!videos || !Array.isArray(videos)) {
    return res.status(400).json({ error: 'Missing or invalid videos array' });
  }

  try {
    console.log(`\n========== 📊 開始分析頻道表現 ==========`);
    console.log(`[Channel Analysis] 日期範圍: ${startDate} ~ ${endDate}`);
    console.log(`[Channel Analysis] 影片數量: ${videos.length}`);
    console.log(`[Channel Analysis] 頻道 ID: ${channelId || '未提供'}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 建立分析提示詞
    const totalViewsInPeriod = videos.reduce((sum, v) => sum + (v.viewCount || 0), 0);
    const totalLikesInPeriod = videos.reduce((sum, v) => sum + (v.likeCount || 0), 0);
    const avgViewsPerVideo = videos.length > 0 ? totalViewsInPeriod / videos.length : 0;

    // 建立完整提示詞
    const prompt = `**分析角色：** 你是 YouTube 頻道的首席內容策略官。

**核心框架：** 你的分析必須基於「增長飛輪」模型，以「總觀看時長」為北極星指標。你的目標是找出並強化頻道的「內容效率」(Content Efficiency)。

**輸入數據：**
1.  **分析目標：** 頻道整體表現
2.  **日期範圍：** ${startDate} 至 ${endDate}
3.  **頻道統計：**
    *   總訂閱者數: ${(channelStats?.subscriberCount || 0).toLocaleString()}
    *   頻道總觀看次數: ${(channelStats?.totalViews || 0).toLocaleString()}
    *   頻道總影片數: ${channelStats?.totalVideos || 0}
4.  **分析期間數據：**
    *   影片數量: ${videos.length}
    *   總觀看次數: ${totalViewsInPeriod.toLocaleString()}
    *   總按讚數: ${totalLikesInPeriod.toLocaleString()}
    *   平均每部影片觀看次數: ${Math.round(avgViewsPerVideo).toLocaleString()}

**影片詳細列表：**
${videos.map(v => `- **${v.title}** (${v.publishedAt ? v.publishedAt.split('T')[0] : '未知日期'})
  - 觀看: ${(v.viewCount || 0).toLocaleString()}, 按讚: ${(v.likeCount || 0).toLocaleString()}, 留言: ${v.commentCount || 0}
  - 標籤: ${v.tags?.join(', ') || '無'}`).join('\n\n')}

---

**分析任務 (Analysis Tasks)：**

**1. 頻道健康度總覽：**
*   **飛輪狀態：** 分析頻道總體的「總觀看次數」和「訂閱者增長」趨勢。飛輪是在加速、維持還是減速？
*   **內容產出節奏：** 評估在此期間的發片頻率是否穩定。

**2. 內容主題分析：**
*   **主題識別：** 根據影片標題和標籤，找出頻道的主要內容主題或系列。
*   **表現對比：** 比較不同主題在觀看次數、互動率（按讚、留言）的平均表現。

**3. 策略診斷：**
*   **識別「內容磁鐵」：** 找出哪些影片或主題是：
    *   **「訂閱磁鐵」：** 擁有最高的按讚數和留言互動（推測能吸引訂閱）。
    *   **「觀看磁鐵」：** 擁有最高的觀看次數。
*   **識別低效內容：** 哪些主題表現出「高產量、低效率」的特徵（即影片數量多，但觀看和互動均偏低）？
*   **策略評估：** 表現最好的內容，是否具有明確的主題定位和系列化特徵？

**輸出報告 (Output Report)：**

請以 Markdown 格式輸出，包含以下章節：

## 📊 頻道總體診斷
（描述當前增長狀況、內容產出節奏）

## 🎯 內容主題分析
（根據影片標題和標籤，分析主要內容主題的表現）

## 💡 資源配置建議
（根據數據洞察，建議如何重新分配製作資源）

## 🚀 關鍵行動項目
（列出 3-5 個具體、可執行的優化建議）

---

**格式要求：**
- 中文、英文、數字之間必須加上半形空格（例如：「YouTube 頻道有 1000 位訂閱者」）
- 使用台灣用語和習慣（例如：使用「影片」而非「視頻」、「訂閱者」而非「粉絲」）

請基於以上數據進行深度分析，提供具體、可執行的策略建議。`;

    console.log('[Channel Analysis] 📤 發送請求到 Gemini API...');

    // 呼叫 Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ]
    });

    const analysisText = response.text;

    console.log('[Channel Analysis] ✅ 分析完成');
    console.log(`[Channel Analysis] 結果長度: ${analysisText.length} 字元`);

    res.json({
      success: true,
      analysis: analysisText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Channel Analysis] ❌ 分析失敗:', error);
    res.status(500).json({
      success: false,
      error: '頻道分析失敗',
      details: error.message
    });
  }
});

/**
 * 使用 YouTube URL 生成文章（異步版本，手機友好）
 * POST /api/generate-article-url-async
 * Body: { videoId: string, prompt: string, videoTitle: string, quality?: number, uploadedFiles?: array, accessToken?: string }
 * Response: { taskId: string }
 */
app.post('/api/generate-article-url-async', async (req, res) => {
  const {
    videoId,
    prompt,
    videoTitle,
    quality = 2,
    uploadedFiles = [],
    accessToken,
    templateId = 'default',
    referenceUrls = [],
    referenceVideos = []
  } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  try {
    // 創建任務
    const taskId = taskQueue.createTask('generate-article-url', {
      videoId,
      prompt,
      videoTitle,
      quality,
      uploadedFiles,
      accessToken,
      templateId,
      referenceUrls,
      referenceVideos
    });

    // 立即返回任務 ID
    res.json({
      success: true,
      taskId,
      message: '任務已建立，請使用 taskId 查詢進度'
    });

    // 在背景執行任務
    taskQueue.executeTask(taskId, async (taskId) => {
      // 速率限制檢查
      const rateLimitId = accessToken || req.ip;
      const clientIp = req.ip;

      const tokenRateCheck = checkRateLimit(rateLimitId, downloadRateLimiter, MAX_DOWNLOADS_PER_HOUR);
      if (!tokenRateCheck.allowed) {
        throw new Error(`下載次數已達上限，請在 ${tokenRateCheck.waitMinutes} 分鐘後再試`);
      }

      const ipRateCheck = checkRateLimit(clientIp, ipRateLimiter, MAX_DOWNLOADS_PER_HOUR_PER_IP);
      if (!ipRateCheck.allowed) {
        throw new Error(`此 IP 位址下載次數過多，請在 ${ipRateCheck.waitMinutes} 分鐘後再試`);
      }

      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`\n========== 📝 [Task ${taskId}] 使用 YouTube URL 生成文章 ==========`);
      console.log(`[Article URL] Video ID: ${videoId}`);
      console.log(`[Article URL] YouTube URL: ${youtubeUrl}`);
      console.log(`[Article URL] Video Title: ${videoTitle}`);
      console.log(`[Article URL] Template: ${templateId}`);

      if (uploadedFiles.length > 0) {
        console.log(`[Article URL] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
      }

      taskQueue.updateTaskProgress(taskId, 10, '檢查 FFmpeg 安裝狀態...');

      // 檢查 FFmpeg 是否安裝
      try {
        const { stdout } = await execAsync('ffmpeg -version');
        const version = stdout.split('\n')[0];
        console.log(`[Article URL] ✅ FFmpeg found: ${version}`);
      } catch (error) {
        throw new Error('FFmpeg is not installed. Please install it first.');
      }

      taskQueue.updateTaskProgress(taskId, 20, '初始化 Gemini AI...');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 步驟 1: 使用 YouTube URL 生成文章與截圖時間點
      taskQueue.updateTaskProgress(taskId, 30, '使用 YouTube URL 分析影片並生成文章...');
      console.log('[Article URL] 步驟 1/3: 使用 YouTube URL 分析影片並生成文章...');

      // 使用新的 prompt 生成函數，整合所有參考資料
      const { generateArticlePromptWithReferences } = await import('./services/articlePromptService.js');

      // 準備參考資料物件
      const references = {
        uploadedFiles: uploadedFiles || [],
        referenceVideos: referenceVideos || [],
        referenceUrls: referenceUrls || []
      };

      // 生成包含所有參考資料指示的完整 prompt
      const fullPrompt = await generateArticlePromptWithReferences(videoTitle, prompt, references, templateId);

      // 建立 parts 陣列
      const parts = [
        { fileData: { fileUri: youtubeUrl } }
      ];

      // 加入使用者上傳的參考檔案
      if (uploadedFiles.length > 0) {
        console.log(`[Article URL] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
        for (const file of uploadedFiles) {
          console.log(`[Article URL] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
          parts.push({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri
            }
          });
        }
      }

      // 加入參考影片
      if (referenceVideos && referenceVideos.length > 0) {
        console.log(`[Article URL] 📎 參考影片: ${referenceVideos.length} 個`);
        for (const videoUrl of referenceVideos) {
          console.log(`[Article URL] 加入參考影片: ${videoUrl}`);
          parts.push({ fileData: { fileUri: videoUrl } });
        }
      }

      // 記錄參考網址數量
      if (referenceUrls && referenceUrls.length > 0) {
        console.log(`[Article URL] 📎 參考網址: ${referenceUrls.length} 個`);
      }

      // 加入完整的 prompt（已包含所有參考資料的整合指示）
      const finalPrompt = `${fullPrompt}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;
      parts.push({ text: finalPrompt });

      // 日誌：顯示最終的 parts 結構
      console.log(`[Article URL] 📊 Parts 結構總覽:`);
      console.log(`[Article URL]   - 總共 ${parts.length} 個 parts`);
      parts.forEach((part, index) => {
        if (part.fileData) {
          console.log(`[Article URL]   - Part ${index + 1}: 檔案/影片 (${part.fileData.fileUri?.substring(0, 50)}...)`);
        } else if (part.text) {
          console.log(`[Article URL]   - Part ${index + 1}: 文字 (長度: ${part.text.length} 字元)`);
        }
      });

      taskQueue.updateTaskProgress(taskId, 50, 'Gemini AI 正在分析影片內容...');

      // 添加重試機制處理 503 錯誤
      let response;
      let attempts = 0;
      const maxAttempts = 3;

      // 準備 config
      const geminiConfig = {};

      // 如果有參考網址，啟用 URL Context 工具
      if (referenceUrls && referenceUrls.length > 0) {
        geminiConfig.tools = [{ urlContext: {} }];
        console.log(`[Article URL] 🔧 已啟用 URL Context 工具（無法使用 responseMimeType）`);
      } else {
        // 只有在沒有使用工具時才能指定 responseMimeType
        geminiConfig.responseMimeType = "application/json";
      }

      while (attempts < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: parts
              }
            ],
            config: geminiConfig,
          });
          break;
        } catch (error) {
          attempts++;
          if (error.status === 503 && attempts < maxAttempts) {
            const waitTime = attempts * 5;
            console.log(`[Article URL] ⚠️  Gemini API 過載，${waitTime} 秒後重試（第 ${attempts}/${maxAttempts} 次）...`);
            taskQueue.updateTaskProgress(taskId, 50 + attempts * 5, `Gemini API 過載，${waitTime} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          } else {
            throw error;
          }
        }
      }

      taskQueue.updateTaskProgress(taskId, 80, '解析 Gemini AI 回應...');

      // 檢查 URL Context metadata
      if (response.candidates && response.candidates[0]?.urlContextMetadata) {
        const metadata = response.candidates[0].urlContextMetadata;
        console.log(`[Article URL] 🔍 URL Context Metadata:`);
        if (metadata.urlMetadata && metadata.urlMetadata.length > 0) {
          console.log(`[Article URL]   ✅ 成功抓取 ${metadata.urlMetadata.length} 個網址的內容：`);
          metadata.urlMetadata.forEach((urlMeta, index) => {
            console.log(`[Article URL]   - URL ${index + 1}: ${urlMeta.retrievedUrl}`);
            console.log(`[Article URL]     狀態: ${urlMeta.urlRetrievalStatus}`);
          });
        } else {
          console.log(`[Article URL]   ⚠️  沒有 URL metadata 資料（可能是 Gemini 沒有使用 URL Context 工具）`);
        }
      } else {
        console.log(`[Article URL]   ⚠️  回應中沒有 URL Context Metadata`);
      }

      let result;
      try {
        let responseText = response.text;
        console.log(`[Article URL] ✅ Gemini 回應長度: ${responseText.length} 字元`);

        // 當使用工具時，可能需要提取 JSON
        if (referenceUrls && referenceUrls.length > 0) {
          console.log(`[Article URL] 🔍 使用工具模式，嘗試提取 JSON...`);
          // 嘗試找到 JSON 對象
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            responseText = jsonMatch[0];
            console.log(`[Article URL] ✅ 成功提取 JSON (長度: ${responseText.length} 字元)`);
          } else {
            console.log(`[Article URL] ⚠️ 無法找到 JSON 對象，使用原始回應`);
          }
        }

        result = JSON.parse(responseText);

        if (!result.titleA || !result.titleB || !result.titleC || !result.article_text || !result.screenshots) {
          throw new Error('Missing required fields in response');
        }

        console.log(`[Article URL] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
        console.log(`[Article URL] 標題 A: ${result.titleA}`);
      } catch (parseError) {
        console.error('[Article URL] ❌ JSON parsing error:', parseError.message);
        console.error('[Article URL] 回應內容:', response.text.substring(0, 500));
        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

      taskQueue.updateTaskProgress(taskId, 100, '文章生成完成！');
      console.log('[Article URL] ✅ 文章生成完成！截圖時間點已規劃');
      console.log(`========== 文章生成完成 ==========\n`);

      return {
        success: true,
        titleA: result.titleA,
        titleB: result.titleB,
        titleC: result.titleC,
        article: result.article_text,
        seo_description: result.seo_description,
        image_urls: [],
        screenshots: result.screenshots,
        usedYouTubeUrl: true,
        needsScreenshots: true,
        videoId: videoId
      };
    });

  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
});

/**
 * 使用純網址生成文章（不需要 YouTube 影片）
 * POST /api/generate-article-from-url-async
 * Body: { url: string, prompt: string, uploadedFiles?: array, templateId?: string, referenceUrls?: array, referenceVideos?: array }
 * Response: { taskId: string }
 */
app.post('/api/generate-article-from-url-async', async (req, res) => {
  const {
    url,
    prompt,
    uploadedFiles = [],
    templateId = 'default',
    referenceUrls = [],
    referenceVideos = []
  } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  // 驗證 URL 格式
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // 創建任務
    const taskId = taskQueue.createTask('generate-article-from-url', {
      url,
      prompt,
      uploadedFiles,
      templateId,
      referenceUrls,
      referenceVideos
    });

    // 立即返回任務 ID
    res.json({
      success: true,
      taskId,
      message: '任務已建立，請使用 taskId 查詢進度'
    });

    // 在背景執行任務
    taskQueue.executeTask(taskId, async (taskId) => {
      console.log(`\n========== 📝 [Task ${taskId}] 使用純網址生成文章 ==========`);
      console.log(`[Article URL-Only] URL: ${url}`);
      console.log(`[Article URL-Only] Template: ${templateId}`);

      if (uploadedFiles.length > 0) {
        console.log(`[Article URL-Only] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
      }

      taskQueue.updateTaskProgress(taskId, 20, '初始化 Gemini AI...');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 生成文章
      taskQueue.updateTaskProgress(taskId, 30, '使用 URL Context 工具分析網址並生成文章...');
      console.log('[Article URL-Only] 使用 URL Context 工具分析網址並生成文章...');

      // 使用新的 prompt 生成函數，整合所有參考資料
      const { generateArticlePromptWithReferences } = await import('./services/articlePromptService.js');

      // 準備參考資料物件
      const references = {
        uploadedFiles: uploadedFiles || [],
        referenceVideos: referenceVideos || [],
        referenceUrls: referenceUrls || []
      };

      // 生成包含所有參考資料指示的完整 prompt
      const fullPrompt = await generateArticlePromptWithReferences(url, prompt, references, templateId);

      // 建立 parts 陣列
      const parts = [];

      // 加入使用者上傳的參考檔案
      if (uploadedFiles.length > 0) {
        console.log(`[Article URL-Only] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
        for (const file of uploadedFiles) {
          console.log(`[Article URL-Only] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
          parts.push({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri
            }
          });
        }
      }

      // 加入參考影片
      if (referenceVideos && referenceVideos.length > 0) {
        console.log(`[Article URL-Only] 📎 參考影片: ${referenceVideos.length} 個`);
        for (const videoUrl of referenceVideos) {
          console.log(`[Article URL-Only] 加入參考影片: ${videoUrl}`);
          parts.push({ fileData: { fileUri: videoUrl } });
        }
      }

      // 記錄參考網址總數
      console.log(`[Article URL-Only] 📎 參考網址總數: ${referenceUrls.length} 個`);
      referenceUrls.forEach((url, index) => {
        console.log(`[Article URL-Only]   ${index + 1}. ${url}`);
      });

      // 加入完整的 prompt（已包含所有參考資料的整合指示）
      const finalPrompt = `${fullPrompt}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;
      parts.push({ text: finalPrompt });

      // 日誌：顯示最終的 parts 結構
      console.log(`[Article URL-Only] 📊 Parts 結構總覽:`);
      console.log(`[Article URL-Only]   - 總共 ${parts.length} 個 parts`);
      parts.forEach((part, index) => {
        if (part.fileData) {
          console.log(`[Article URL-Only]   - Part ${index + 1}: 檔案/影片 (${part.fileData.fileUri?.substring(0, 50)}...)`);
        } else if (part.text) {
          console.log(`[Article URL-Only]   - Part ${index + 1}: 文字 (長度: ${part.text.length} 字元)`);
        }
      });

      taskQueue.updateTaskProgress(taskId, 50, 'Gemini AI 正在使用 URL Context 工具分析網址內容...');

      // 添加重試機制處理 503 錯誤
      let response;
      let attempts = 0;
      const maxAttempts = 3;

      // 準備 config - 啟用 URL Context 工具
      const geminiConfig = {
        tools: [{ urlContext: {} }]
      };
      console.log(`[Article URL-Only] 🔧 已啟用 URL Context 工具`);

      while (attempts < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: parts
              }
            ],
            config: geminiConfig,
          });
          break;
        } catch (error) {
          attempts++;
          if (error.status === 503 && attempts < maxAttempts) {
            const waitTime = attempts * 5;
            console.log(`[Article URL-Only] ⚠️  Gemini API 過載，${waitTime} 秒後重試（第 ${attempts}/${maxAttempts} 次）...`);
            taskQueue.updateTaskProgress(taskId, 50 + attempts * 5, `Gemini API 過載，${waitTime} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          } else {
            throw error;
          }
        }
      }

      taskQueue.updateTaskProgress(taskId, 80, '解析 Gemini AI 回應...');

      // 檢查 URL Context metadata
      if (response.candidates && response.candidates[0]?.urlContextMetadata) {
        const metadata = response.candidates[0].urlContextMetadata;
        console.log(`[Article URL-Only] 🔍 URL Context Metadata:`);
        if (metadata.urlMetadata && metadata.urlMetadata.length > 0) {
          console.log(`[Article URL-Only]   ✅ 成功抓取 ${metadata.urlMetadata.length} 個網址的內容：`);
          metadata.urlMetadata.forEach((urlMeta, index) => {
            console.log(`[Article URL-Only]   - URL ${index + 1}: ${urlMeta.retrievedUrl}`);
            console.log(`[Article URL-Only]     狀態: ${urlMeta.urlRetrievalStatus}`);
          });
        } else {
          console.log(`[Article URL-Only]   ⚠️  沒有 URL metadata 資料（可能是 Gemini 沒有使用 URL Context 工具）`);
        }
      } else {
        console.log(`[Article URL-Only]   ⚠️  回應中沒有 URL Context Metadata`);
      }

      let result;
      try {
        let responseText = response.text;
        console.log(`[Article URL-Only] ✅ Gemini 回應長度: ${responseText.length} 字元`);

        // 使用工具模式時，需要提取 JSON
        console.log(`[Article URL-Only] 🔍 使用工具模式，嘗試提取 JSON...`);

        // 智能提取 JSON：從末尾往前找最後一個完整的 JSON 對象
        let jsonText = null;

        // 從末尾找最後一個 '}'
        const lastBraceIndex = responseText.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          // 往前找對應的 '{'
          let braceCount = 1;
          let startIndex = -1;

          for (let i = lastBraceIndex - 1; i >= 0; i--) {
            if (responseText[i] === '}') {
              braceCount++;
            } else if (responseText[i] === '{') {
              braceCount--;
              if (braceCount === 0) {
                startIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1) {
            jsonText = responseText.substring(startIndex, lastBraceIndex + 1);
            console.log(`[Article URL-Only] ✅ 提取最後一個完整 JSON 對象 (長度: ${jsonText.length} 字元)`);

            // 驗證是否包含必要欄位
            if (!jsonText.includes('"titleA"')) {
              console.log(`[Article URL-Only] ⚠️ 提取的 JSON 不包含 titleA，嘗試其他方法...`);
              jsonText = null;
            }
          }
        }

        // 備用方法：使用貪婪匹配
        if (!jsonText) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
            console.log(`[Article URL-Only] ✅ 使用貪婪匹配提取 JSON (長度: ${jsonText.length} 字元)`);
          } else {
            console.log(`[Article URL-Only] ⚠️ 無法找到 JSON 對象，使用原始回應`);
            jsonText = responseText;
          }
        }

        result = JSON.parse(jsonText);

        if (!result.titleA || !result.titleB || !result.titleC || !result.article_text) {
          throw new Error('Missing required fields in response');
        }

        console.log(`[Article URL-Only] ✅ 文章生成成功!`);
        console.log(`[Article URL-Only] 標題 A: ${result.titleA}`);
      } catch (parseError) {
        console.error('[Article URL-Only] ❌ JSON parsing error:', parseError.message);
        console.error('[Article URL-Only] 回應內容:', response.text.substring(0, 500));
        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

      taskQueue.updateTaskProgress(taskId, 100, '文章生成完成！');
      console.log('[Article URL-Only] ✅ 文章生成完成！');
      console.log(`========== 文章生成完成 ==========\n`);

      return {
        success: true,
        titleA: result.titleA,
        titleB: result.titleB,
        titleC: result.titleC,
        article: result.article_text,
        seo_description: result.seo_description,
        image_urls: [],
        screenshots: result.screenshots || [],
        needsScreenshots: false,
        videoId: null
      };
    });

  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
});

/**
 * 使用 YouTube URL 生成文章（僅限公開影片）
 * POST /api/generate-article-url
 * Body: { videoId: string, prompt: string, videoTitle: string, quality?: number }
 */
app.post('/api/generate-article-url', async (req, res) => {
  const {
    videoId,
    prompt,
    videoTitle,
    quality = 2,
    uploadedFiles = [],
    accessToken,
    templateId = 'default'
  } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  // 速率限制檢查（雙重保護：帳號 + IP）
  const rateLimitId = accessToken || req.ip;
  const clientIp = req.ip;

  const tokenRateCheck = checkRateLimit(rateLimitId, downloadRateLimiter, MAX_DOWNLOADS_PER_HOUR);
  if (!tokenRateCheck.allowed) {
    console.warn(`[Article URL] Token rate limit exceeded for ${rateLimitId}`);
    return res.status(429).json({
      error: '下載次數已達上限',
      message: `為保護您的帳號安全，請在 ${tokenRateCheck.waitMinutes} 分鐘後再試`,
      waitMinutes: tokenRateCheck.waitMinutes,
      limitType: 'account'
    });
  }

  const ipRateCheck = checkRateLimit(clientIp, ipRateLimiter, MAX_DOWNLOADS_PER_HOUR_PER_IP);
  if (!ipRateCheck.allowed) {
    console.warn(`[Article URL] IP rate limit exceeded for ${clientIp}`);
    return res.status(429).json({
      error: '下載次數已達上限',
      message: `此 IP 位址下載次數過多，請在 ${ipRateCheck.waitMinutes} 分鐘後再試`,
      waitMinutes: ipRateCheck.waitMinutes,
      limitType: 'ip'
    });
  }

  console.log(`[Article URL] Rate limit - Token: ${tokenRateCheck.remaining} remaining, IP: ${ipRateCheck.remaining} remaining`);

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);

  try {
    console.log(`\n========== 📝 使用 YouTube URL 生成文章 ==========`);
    console.log(`[Article URL] Video ID: ${videoId}`);
    console.log(`[Article URL] YouTube URL: ${youtubeUrl}`);
    console.log(`[Article URL] Video Title: ${videoTitle}`);
    console.log(`[Article URL] Template: ${templateId}`);
    console.log(`[Article URL] OAuth Token: ${accessToken ? '✅ 已提供（使用 OAuth 認證）' : '❌ 未提供（匿名下載）'}`);
    if (uploadedFiles.length > 0) {
      console.log(`[Article URL] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
    }

    // 檢查 FFmpeg 是否安裝
    console.log('[Article URL] Checking FFmpeg installation...');
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const version = stdout.split('\n')[0];
      console.log(`[Article URL] ✅ FFmpeg found: ${version}`);
    } catch (error) {
      console.error('[Article URL] ❌ FFmpeg not found');
      return res.status(500).json({
        error: 'FFmpeg is not installed. Please install it first.',
        details: 'Install FFmpeg: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Ubuntu)'
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 步驟 1: 使用 YouTube URL 生成文章與截圖時間點
    console.log('[Article URL] 步驟 1/3: 使用 YouTube URL 分析影片並生成文章...');

    // 根據是否有上傳檔案，使用不同的 prompt 生成函數
    const { generateArticlePromptWithFiles } = await import('./services/articlePromptService.js');
    const fullPrompt = uploadedFiles.length > 0
      ? await generateArticlePromptWithFiles(videoTitle, prompt, uploadedFiles, templateId)
      : await generateArticlePrompt(videoTitle, prompt, templateId);

    // 建立 parts 陣列，包含影片和 prompt
    const parts = [
      { fileData: { fileUri: youtubeUrl } }
    ];

    // 加入使用者上傳的參考檔案
    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        console.log(`[Article URL] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
        parts.push({
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri
          }
        });
      }
    }

    // 最後加入 prompt
    parts.push({ text: fullPrompt });

    // 根據最佳實踐：影片應該放在 prompt 之前
    // 添加重試機制處理 503 錯誤
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: parts
            }
          ],
          config: {
            responseMimeType: "application/json",
          },
        });
        break; // 成功則跳出循環
      } catch (error) {
        attempts++;
        if (error.status === 503 && attempts < maxAttempts) {
          const waitTime = attempts * 5; // 5秒、10秒、15秒
          console.log(`[Article URL] ⚠️  Gemini API 過載，${waitTime} 秒後重試（第 ${attempts}/${maxAttempts} 次）...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        } else {
          throw error; // 其他錯誤或達到最大重試次數
        }
      }
    }

    let result;
    try {
      const responseText = response.text;
      console.log(`[Article URL] ✅ Gemini 回應長度: ${responseText.length} 字元`);
      result = JSON.parse(responseText);

      if (!result.titleA || !result.titleB || !result.titleC || !result.article_text || !result.screenshots) {
        throw new Error('Missing required fields in response');
      }

      console.log(`[Article URL] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
      console.log(`[Article URL] 標題 A: ${result.titleA}`);
    } catch (parseError) {
      console.error('[Article URL] ❌ JSON parsing error:', parseError.message);
      throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
    }

    // 🎉 步驟 2: 完成（不下載影片，不截圖）
    console.log('[Article URL] ✅ 文章生成完成！截圖時間點已規劃');
    console.log('[Article URL] ℹ️  如需截圖，請使用「截圖」按鈕（需要本地環境或支援 yt-dlp 的環境）');
    console.log(`========== 文章生成完成 ==========\n`);

    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      image_urls: [], // 尚未截圖
      screenshots: result.screenshots, // 包含時間碼和說明
      usedYouTubeUrl: true,
      needsScreenshots: true, // 標記需要截圖
      videoId: videoId
    });

  } catch (error) {
    console.error('Article generation error:', error);

    res.status(500).json({
      error: 'Failed to generate article via YouTube URL',
      details: error.message
    });
  }
});

/**
 * 截圖 API（用於已生成文章的影片）
 * POST /api/capture-screenshots
 * Body: { videoId: string, screenshots: array, quality?: number }
 */
app.post('/api/capture-screenshots', async (req, res) => {
  const { videoId, screenshots, quality = 2, accessToken } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid screenshots array' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // 不指定副檔名，讓 yt-dlp 根據 --merge-output-format 自動處理
  const outputTemplate = path.join(DOWNLOAD_DIR, videoId);
  const outputPath = `${outputTemplate}.mp4`;

  try {
    console.log(`\n========== 📸 開始截圖 ==========`);
    console.log(`[Capture] Video ID: ${videoId}`);
    console.log(`[Capture] Screenshot count: ${screenshots.length}`);
    console.log(`[Capture] Quality: ${quality}`);

    // 檢查 FFmpeg 是否安裝
    console.log('[Capture] Checking FFmpeg installation...');
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const version = stdout.split('\n')[0];
      console.log(`[Capture] ✅ FFmpeg found: ${version}`);
    } catch (error) {
      console.error('[Capture] ❌ FFmpeg not found');
      return res.status(500).json({
        error: 'FFmpeg is not installed. Please install it first.',
        details: 'This feature is only available in local environment with FFmpeg installed.'
      });
    }

    // 步驟 1: 檢查本地是否已有影片
    let needsDownload = !fs.existsSync(outputPath);

    if (needsDownload) {
      console.log('[Capture] 步驟 1/3: 本地無影片，開始下載...');

      // 檢查 yt-dlp 是否安裝
      try {
        const { stdout } = await execAsync('yt-dlp --version');
        console.log(`[Capture] ✅ yt-dlp version: ${stdout.trim()}`);
      } catch (error) {
        console.error(`[Capture] ❌ yt-dlp not found`);
        return res.status(500).json({
          error: 'yt-dlp is not installed. This feature is only available in local environment.',
          details: 'Please install yt-dlp: https://github.com/yt-dlp/yt-dlp#installation'
        });
      }

      // 根據截圖品質決定影片解析度
      let formatSelector;
      if (quality <= 10) {
        formatSelector = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"';
        console.log(`[Capture] 截圖品質: ${quality}（高畫質）→ 目標影片解析度: 1080p`);
      } else {
        formatSelector = '"bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"';
        console.log(`[Capture] 截圖品質: ${quality}（壓縮）→ 目標影片解析度: 720p`);
      }

      // 建構命令（簡化版本）
      const commandParts = [
        'yt-dlp',
        '-f', formatSelector,
        '--merge-output-format', 'mp4',
        // 使用模板而非最終路徑，讓 yt-dlp 正確處理合併
        '-o', `"${outputTemplate}.%(ext)s"`,
      ];

      if (accessToken) {
        console.log('[Capture] Using access token for authentication.');
        // 整個 header 需要用引號包起來，避免被拆成多個參數
        commandParts.push('--add-header', `"Authorization: Bearer ${accessToken}"`);
      }

      commandParts.push(`"${youtubeUrl}"`);

      const command = commandParts.join(' ');
      console.log(`[Capture] Executing: ${command}`);

      try {
        await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      } catch (execError) {
        // 即使命令失敗，如果檔案存在就繼續處理
        console.log('[Capture] Command returned error, checking if file exists...');
        if (execError.stdout) console.log('[Capture] yt-dlp output:', execError.stdout);
        if (execError.stderr) console.log('[Capture] yt-dlp warnings:', execError.stderr);

        if (!fs.existsSync(outputPath)) {
          throw execError;
        }
        console.log('[Capture] File exists despite error, continuing...');
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error('Video download failed - file not found');
      }

      console.log(`[Capture] ✅ 影片下載完成: ${outputPath}`);
    } else {
      console.log('[Capture] ✅ 本地已有影片，跳過下載');
    }

    // 步驟 2: 使用 FFmpeg 截取畫面
    console.log('[Capture] 步驟 2/3: 正在截取關鍵畫面...');
    console.log(`[Capture] 截圖品質設定: ${quality} (2=最高, 31=最低)`);

    const imageUrls = [];
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      // 增加彈性，接受 time 或 timestamp_seconds
      const timestamp = screenshot.timestamp_seconds || screenshot.time;
      // 增加彈性，接受 caption 或 reason_for_screenshot
      const reason = screenshot.reason_for_screenshot || screenshot.caption;
      const currentSeconds = timeToSeconds(timestamp);

      const screenshotGroup = [];
      const offsets = [
        { offset: -2, label: 'before' },
        { offset: 0, label: 'current' },
        { offset: 2, label: 'after' }
      ];

      console.log(`[Capture] 截圖組 ${i + 1}/${screenshots.length} - 時間點: ${timestamp} - 原因: ${reason}`);

      for (const { offset, label } of offsets) {
        const targetSeconds = Math.max(0, currentSeconds + offset);
        const targetTime = secondsToTime(targetSeconds);
        const outputFilename = `${videoId}_screenshot_${i}_${label}_${targetTime.replace(':', '-')}.jpg`;
        const screenshotPath = path.join(IMAGES_DIR, outputFilename);

        try {
          await captureScreenshot(outputPath, targetSeconds, screenshotPath, quality);
          screenshotGroup.push(`/images/${outputFilename}`);
          console.log(`[Capture] ✅ 截圖已儲存: ${outputFilename} (${label}: ${targetSeconds}s)`);
        } catch (error) {
          console.error(`[Capture] ❌ 截圖失敗 (時間點 ${targetSeconds}s, ${label}):`, error.message);
        }
      }

      if (screenshotGroup.length > 0) {
        imageUrls.push(screenshotGroup);
      }
    }

    // 步驟 3: 完成
    console.log(`[Capture] ✅ 已完成截圖，暫存檔案保留供後續使用: ${outputPath}`);
    console.log(`========== 截圖完成 ==========\n`);

    res.json({
      success: true,
      image_urls: imageUrls,
      screenshots: screenshots,
      videoPath: outputPath
    });

  } catch (error) {
    console.error('Screenshot capture error:', error);

    res.status(500).json({
      error: 'Failed to capture screenshots',
      details: error.message,
      isLocalOnly: true,
      hint: 'This feature requires yt-dlp and FFmpeg to be installed locally.'
    });
  }
});

/**
 * 生成文章（用於非公開影片，不包含截圖）
 * POST /api/generate-article
 * Body: { videoId: string, filePath?: string, prompt: string, videoTitle: string }
 * 注意：filePath 是可選的，如果 Files API 中已有檔案則不需要
 * 截圖功能已分離到 /api/capture-screenshots 端點
 */
app.post('/api/generate-article', async (req, res) => {
  const { videoId, filePath, prompt, videoTitle, templateId = 'default', referenceUrls = [], uploadedFiles = [], referenceVideos = [] } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  try {
    console.log(`\n========== 📝 開始生成文章（未公開影片）==========`);
    console.log(`[Article] Video ID: ${videoId}`);
    console.log(`[Article] File Path: ${filePath || '(not provided, will check Files API)'}`);
    console.log(`[Article] Video Title: ${videoTitle}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 先檢查檔案是否已存在於 Files API
    console.log('[Article] 步驟 1/5: 檢查 Files API 中是否已有此檔案...');
    const existingFile = await findFileByDisplayName(ai, videoId);

    let uploadedFile;
    let reusedFile = false;

    if (existingFile) {
      console.log(`[Article] ✅ 找到已存在的檔案，將重複使用！`);
      console.log(`[Article] File Name: ${existingFile.name}`);
      console.log(`[Article] Display Name: ${existingFile.displayName}`);
      console.log(`[Article] File URI: ${existingFile.uri}`);
      console.log(`[Article] 跳過上傳步驟，節省時間和流量！`);
      uploadedFile = existingFile;
      reusedFile = true;

      // 刪除本地已下載的暫存檔案（如果有提供的話）
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Article] 🗑️  已刪除不需要的暫存檔案: ${filePath}`);
      }
    } else {
      // 檔案不存在於 Files API
      if (!filePath) {
        return res.status(400).json({
          error: 'File not found in Files API and no filePath provided for upload'
        });
      }

      console.log('[Article] 檔案不存在於 Files API，需要上傳...');
      console.log('[Article] 步驟 2/5: 正在上傳影片到 Gemini...');

      // 上傳影片到 Gemini（使用 videoId 作為 displayName）
      uploadedFile = await ai.files.upload({
        file: filePath,
        config: {
          mimeType: 'video/mp4',
          displayName: videoId  // 使用 videoId 作為檔案名稱，方便後續查找
        },
      });

      console.log(`[Article] ✅ 檔案已上傳`);
      console.log(`[Article] File Name (系統生成): ${uploadedFile.name}`);
      console.log(`[Article] Display Name (我們設定): ${uploadedFile.displayName}`);
      console.log(`[Article] File URI: ${uploadedFile.uri}`);
      console.log(`[Article] File State: ${uploadedFile.state}`);
    }

    // 等待檔案處理完成（新上傳或重用中的 PROCESSING 檔案）
    if (uploadedFile.state === 'PROCESSING') {
        console.log('[Article] ⏳ Gemini 正在處理影片,等待處理完成...');
        let attempts = 0;
        const maxAttempts = 60;
        let isActive = false;

        while (!isActive && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          try {
            const fetchedFile = await ai.files.get({ name: uploadedFile.name });
            if (fetchedFile) {
              const progress = Math.round(((attempts + 1) / maxAttempts) * 100);
              console.log(`[Article] 檢查狀態 ${attempts + 1}/${maxAttempts} (${progress}%) - State: ${fetchedFile.state}`);
              if (fetchedFile.state === 'ACTIVE') {
                isActive = true;
                console.log('[Article] ✅ 檔案處理完成,可以開始生成文章!');
              } else if (fetchedFile.state === 'FAILED') {
                throw new Error('File processing failed');
              }
            }
          } catch (error) {
            console.log(`[Article] ⚠️  檢查 ${attempts + 1}/${maxAttempts} 時發生錯誤: ${error.message}`);
          }
          attempts++;
        }

        if (!isActive) {
          throw new Error('File processing timeout. Please try again later.');
        }
      } else if (uploadedFile.state === 'ACTIVE') {
        console.log('[Article] ✅ 檔案已經是 ACTIVE 狀態');
      } else {
        throw new Error(`Unexpected file state: ${uploadedFile.state}`);
      }

    // 生成文章提示詞
    console.log(reusedFile ? '[Article] 步驟 3/4: 正在生成文章內容與截圖時間點...' : '[Article] 步驟 4/5: 正在生成文章內容與截圖時間點...');

    // 使用新的 prompt 生成函數，整合所有參考資料
    const { generateArticlePromptWithReferences } = await import('./services/articlePromptService.js');

    // 準備參考資料物件
    const references = {
      uploadedFiles: uploadedFiles || [],
      referenceVideos: referenceVideos || [],
      referenceUrls: referenceUrls || []
    };

    // 生成包含所有參考資料指示的完整 prompt
    const fullPrompt = await generateArticlePromptWithReferences(videoTitle, prompt, references, templateId);

    // 準備 config
    const geminiConfig = {};

    // 如果有參考網址，啟用 URL Context 工具
    if (referenceUrls && referenceUrls.length > 0) {
      geminiConfig.tools = [{ urlContext: {} }];
      console.log(`[Article] 🔧 已啟用 URL Context 工具（無法使用 responseMimeType）`);
    } else {
      // 只有在沒有使用工具時才能指定 responseMimeType
      geminiConfig.responseMimeType = "application/json";
    }

    // 建立 parts 陣列
    const parts = [
      { fileData: { fileUri: uploadedFile.uri, mimeType: 'video/mp4' } }
    ];

    // 加入使用者上傳的參考檔案
    if (uploadedFiles.length > 0) {
      console.log(`[Article] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
      for (const file of uploadedFiles) {
        console.log(`[Article] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
        parts.push({
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri
          }
        });
      }
    }

    // 加入參考影片
    if (referenceVideos && referenceVideos.length > 0) {
      console.log(`[Article] 📎 參考影片: ${referenceVideos.length} 個`);
      for (const videoUrl of referenceVideos) {
        console.log(`[Article] 加入參考影片: ${videoUrl}`);
        parts.push({ fileData: { fileUri: videoUrl } });
      }
    }

    // 記錄參考網址數量
    if (referenceUrls && referenceUrls.length > 0) {
      console.log(`[Article] 📎 參考網址: ${referenceUrls.length} 個`);
    }

    // 加入完整的 prompt（已包含所有參考資料的整合指示）
    const finalPrompt = `${fullPrompt}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;
    parts.push({ text: finalPrompt });

    // 日誌：顯示最終的 parts 結構
    console.log(`[Article] 📊 Parts 結構總覽:`);
    console.log(`[Article]   - 總共 ${parts.length} 個 parts`);
    parts.forEach((part, index) => {
      if (part.fileData) {
        console.log(`[Article]   - Part ${index + 1}: 檔案/影片 (${part.fileData.fileUri?.substring(0, 50)}...)`);
      } else if (part.text) {
        console.log(`[Article]   - Part ${index + 1}: 文字 (長度: ${part.text.length} 字元)`);
      }
    });
    if (geminiConfig.tools) {
      console.log(`[Article] 🔧 已啟用工具: ${JSON.stringify(geminiConfig.tools)}`);
    }

    // 呼叫 Gemini API 生成文章與截圖時間點
    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      config: geminiConfig,
    });

    // 檢查 URL Context metadata
    if (response.candidates && response.candidates[0]?.urlContextMetadata) {
      const metadata = response.candidates[0].urlContextMetadata;
      console.log(`[Article] 🔍 URL Context Metadata:`);
      if (metadata.urlMetadata && metadata.urlMetadata.length > 0) {
        console.log(`[Article]   ✅ 成功抓取 ${metadata.urlMetadata.length} 個網址的內容：`);
        metadata.urlMetadata.forEach((urlMeta, index) => {
          console.log(`[Article]   - URL ${index + 1}: ${urlMeta.retrievedUrl}`);
          console.log(`[Article]     狀態: ${urlMeta.urlRetrievalStatus}`);
        });
      } else {
        console.log(`[Article]   ⚠️  沒有 URL metadata 資料（可能是 Gemini 沒有使用 URL Context 工具）`);
      }
    } else {
      console.log(`[Article]   ⚠️  回應中沒有 URL Context Metadata`);
    }

    let result;
    try {
      let responseText = response.text;
      console.log(`[Article] ✅ Gemini 回應長度: ${responseText.length} 字元`);
      console.log(`[Article] 回應預覽: ${responseText.substring(0, 150)}...`);

      // 當使用工具時，可能需要提取 JSON
      if (referenceUrls && referenceUrls.length > 0) {
        console.log(`[Article] 🔍 使用工具模式，嘗試提取 JSON...`);
        // 嘗試找到 JSON 對象
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseText = jsonMatch[0];
          console.log(`[Article] ✅ 成功提取 JSON (長度: ${responseText.length} 字元)`);
        } else {
          console.log(`[Article] ⚠️ 無法找到 JSON 對象，使用原始回應`);
        }
      }

      result = JSON.parse(responseText);
      // 驗證必要欄位
      if (!result.titleA || !result.titleB || !result.titleC || !result.article_text || !result.screenshots) {
        throw new Error('Missing required fields in response');
      }

      console.log(`[Article] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
      console.log(`[Article] 標題 A: ${result.titleA}`);
    } catch (parseError) {
      console.error('[Article] ❌ JSON parsing error:', parseError.message);
      console.error('[Article] 回應內容:', response.text.substring(0, 500));

      // 嘗試找出問題位置
      const lines = response.text.split('\n');
      console.error(`[Article] Response has ${lines.length} lines`);

      throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
    }

    // 不執行截圖，保留影片檔案供後續 /api/capture-screenshots 使用
    console.log(`[Article] ✅ 文章生成完成！截圖時間點已規劃`);
    console.log(`[Article] ℹ️  如需截圖，請使用「截圖」按鈕（需要本地環境或支援 yt-dlp 的環境）`);
    console.log(`[Article] 暫存檔案保留供截圖使用: ${filePath}`);
    console.log(`========== 文章生成完成 ==========\n`);

    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      image_urls: [], // 尚未截圖
      screenshots: result.screenshots,
      needsScreenshots: true, // 標記需要截圖
      videoId: videoId, // 用於後續截圖
      geminiFileName: uploadedFile.name,
      geminiFileUri: uploadedFile.uri
    });

  } catch (error) {
    console.error('Article generation error:', error);

    res.status(500).json({
      error: 'Failed to generate article',
      details: error.message
    });
  }
});

/**
 * 使用現有 Gemini 檔案重新生成文章
 * POST /api/regenerate-article
 * Body: { videoId: string, geminiFileName: string, prompt: string, videoTitle: string }
 */
app.post('/api/regenerate-article', async (req, res) => {
  const { videoId, geminiFileName, prompt, videoTitle, templateId = 'default' } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  if (!geminiFileName) {
    return res.status(400).json({ error: 'Missing required parameter: geminiFileName' });
  }

  try {
    console.log(`Regenerating article using existing file: ${geminiFileName}`);
    console.log(`[Regenerate Article] Template: ${templateId}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 檢查檔案是否存在
    let fileInfo;
    try {
      fileInfo = await ai.files.get({ name: geminiFileName });
    } catch (error) {
      console.log(`File not found: ${error.message}`);
      return res.status(404).json({
        error: 'File not found in Gemini',
        needsRedownload: true
      });
    }

    if (fileInfo.state !== 'ACTIVE') {
      return res.status(400).json({
        error: 'File is not ready',
        state: fileInfo.state
      });
    }

    console.log(`✅ File found and active: ${fileInfo.uri}`);

    // 生成文章提示詞
    const fullPrompt = await generateArticlePrompt(videoTitle, prompt, templateId);

    // 呼叫 Gemini API
    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: fileInfo.uri, mimeType: 'video/mp4' } },
            { text: fullPrompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    let result;
    try {
      const responseText = response.text;
      console.log('Response length:', responseText.length);
      console.log('Response preview:', responseText.substring(0, 200));

      result = JSON.parse(responseText);

      // 驗證必要欄位
      if (!result.titleA || !result.titleB || !result.titleC || !result.article_text || !result.screenshots) {
        throw new Error('Missing required fields in response');
      }

      console.log(`Article regenerated successfully. Found ${result.screenshots.length} screenshots.`);
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError.message);
      console.error('Full response text:', response.text);

      throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
    }

    // 注意：重新生成時無法截圖（因為沒有本地影片檔案）
    // 需要使用者重新下載影片才能截圖
    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      screenshots: result.screenshots,
      geminiFileName: fileInfo.name,
      geminiFileUri: fileInfo.uri,
      reusedExistingFile: true,
      note: 'Screenshots not captured. Please re-download video to generate screenshots.'
    });

  } catch (error) {
    console.error('Article regeneration error:', error);
    res.status(500).json({
      error: 'Failed to regenerate article',
      details: error.message
    });
  }
});

/**
 * 重新生成截圖（讓 Gemini 重新看影片並提供新的截圖建議）
 * POST /api/regenerate-screenshots
 * Body: { videoId: string, videoTitle: string, filePath: string, prompt?: string, quality?: number }
 */
app.post('/api/regenerate-screenshots', async (req, res) => {
  const { videoId, videoTitle, filePath, prompt, quality = 2, templateId = 'default', accessToken } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  if (!videoTitle || !filePath) {
    return res.status(400).json({ error: 'Missing required parameters: videoTitle, filePath' });
  }

  try {
    console.log(`\n========== 🔄 重新生成截圖 ==========`);
    console.log(`[Regenerate Screenshots] Video ID: ${videoId}`);
    console.log(`[Regenerate Screenshots] File Path: ${filePath}`);
    console.log(`[Regenerate Screenshots] Video Title: ${videoTitle}`);
    console.log(`[Regenerate Screenshots] Access Token: ${accessToken ? 'Provided' : 'Not Provided'}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let response;

    // 生成文章提示詞
    const fullPrompt = await generateArticlePrompt(videoTitle, prompt || '', templateId);

    if (accessToken) {
      // 不公開影片邏輯：檢查 Files API
      console.log('[Regenerate Screenshots] (Unlisted Video) 步驟 1/4: 檢查 Files API 中是否已有此檔案...');
      const existingFile = await findFileByDisplayName(ai, videoId);

      if (!existingFile || existingFile.state !== 'ACTIVE') {
        const state = existingFile ? existingFile.state : 'NOT FOUND';
        console.error(`[Regenerate Screenshots] ❌ 檔案不存在或狀態不正確: ${state}`);
        return res.status(404).json({ error: `Video file not found or not active in Files API (state: ${state}). Please generate article for this unlisted video first.` });
      }

      console.log(`[Regenerate Screenshots] ✅ 找到已存在的檔案: ${existingFile.uri}`);
      console.log('[Regenerate Screenshots] 步驟 2/4: 讓 Gemini 重新分析影片並提供新的截圖建議...');

      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: existingFile.uri, mimeType: 'video/mp4' } },
              { text: fullPrompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

    } else {
      // 公開影片邏輯：使用 YouTube URL
      console.log('[Regenerate Screenshots] (Public Video) 步驟 1/4: 使用 YouTube URL 進行分析...');
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      console.log('[Regenerate Screenshots] 步驟 2/4: 讓 Gemini 重新分析影片並提供新的截圖建議...');

      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: youtubeUrl, mimeType: 'video/mp4' } },
              { text: fullPrompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        },
      });
    }

    let result;
    try {
      const responseText = response.text;
      result = JSON.parse(responseText);
      console.log('[Debug] Screenshots array from Gemini:', JSON.stringify(result.screenshots, null, 2));
    } catch (parseError) {
      console.error('[Regenerate Screenshots] ❌ JSON parsing error:', parseError.message);
      throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
    }

    // 步驟 3: 使用本地影片進行截圖
    console.log('[Regenerate Screenshots] 步驟 3/4: 正在截取新的關鍵畫面...');
    console.log(`[Regenerate Screenshots] 截圖品質設定: ${quality} (2=最高, 31=最低)`);

    const imageUrls = [];
    for (let i = 0; i < result.screenshots.length; i++) {
      const screenshot = result.screenshots[i];
      const timestamp = screenshot.timestamp_seconds;
      const currentSeconds = timeToSeconds(timestamp);

      const screenshotGroup = [];
      const offsets = [
        { offset: -2, label: 'before' },
        { offset: 0, label: 'current' },
        { offset: 2, label: 'after' }
      ];

      console.log(`[Regenerate Screenshots] 截圖組 ${i + 1}/${result.screenshots.length} - 時間點: ${timestamp} - 原因: ${screenshot.reason_for_screenshot}`);

      for (const { offset, label } of offsets) {
        const targetSeconds = Math.max(0, currentSeconds + offset);
        const targetTime = secondsToTime(targetSeconds); // 僅用於檔名

        const outputFilename = `${videoId}_screenshot_${i}_${label}_${targetTime.replace(':', '-')}.jpg`;
        const outputPath = path.join(IMAGES_DIR, outputFilename);

        try {
          await captureScreenshot(filePath, targetSeconds, outputPath, quality);
          screenshotGroup.push(`/images/${outputFilename}`);
          console.log(`[Regenerate Screenshots] ✅ 截圖已儲存: ${outputFilename} (${label}: ${targetSeconds}s)`);
        } catch (error) {
          console.error(`[Regenerate Screenshots] ❌ 截圖失敗 (時間點 ${targetSeconds}s, ${label}):`, error.message);
        }
      }

      if (screenshotGroup.length > 0) {
        imageUrls.push(screenshotGroup);
      }
    }

    // 步驟 4: 完成（保留暫存檔案供後續使用）
    console.log(`[Regenerate Screenshots] ✅ 已完成截圖，暫存檔案保留: ${filePath}`);
    console.log(`========== 重新截圖完成 ==========\n`);

    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      image_urls: imageUrls,
      screenshots: result.screenshots,
    });

  } catch (error) {
    console.error('Regenerate screenshots error:', error);

    res.status(500).json({
      error: 'Failed to regenerate screenshots',
      details: error.message
    });
  }
});

/**
 * 檢查 Files API 中是否存在指定 videoId 的檔案
 * GET /api/check-file/:videoId
 */
app.get('/api/check-file/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId format' });
  }

  try {
    console.log(`[Check File] Checking if file exists for videoId: ${videoId}`);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 列出所有檔案，尋找符合 displayName 的檔案
    console.log(`[Check File] Calling ai.files.list()...`);
    const matchingFile = await findFileByDisplayName(ai, videoId);

    if (matchingFile) {
      console.log(`[Check File] ✅ Found file: ${matchingFile.name}, State: ${matchingFile.state}`);

      // 檢查檔案狀態
      if (matchingFile.state === 'ACTIVE') {
        return res.json({
          exists: true,
          file: {
            name: matchingFile.name,
            uri: matchingFile.uri,
            state: matchingFile.state,
            displayName: matchingFile.displayName,
            createTime: matchingFile.createTime,
            expirationTime: matchingFile.expirationTime
          }
        });
      } else if (matchingFile.state === 'PROCESSING') {
        return res.json({
          exists: true,
          processing: true,
          file: {
            name: matchingFile.name,
            state: matchingFile.state,
            displayName: matchingFile.displayName
          }
        });
      } else {
        // 檔案存在但狀態不是 ACTIVE 或 PROCESSING（可能是 FAILED）
        return res.json({
          exists: false,
          reason: `File exists but state is ${matchingFile.state}`
        });
      }
    }

    console.log(`[Check File] ❌ No file found for videoId: ${videoId}`);
    res.json({ exists: false });

  } catch (error) {
    console.error('[Check File] Error:', error);
    res.status(500).json({
      error: 'Failed to check file',
      details: error.message
    });
  }
});

/**
 * 清理暫存檔案
 * DELETE /api/cleanup/:videoId
 */
app.delete('/api/cleanup/:videoId', (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId format' });
  }

  const filePath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up: ${filePath}`);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// ==================== 檔案上傳 API ====================

/**
 * 上傳檔案到 Gemini Files API
 * POST /api/gemini/upload-file
 */
app.post('/api/gemini/upload-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未提供檔案' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const displayName = req.file.originalname;

    console.log(`[File Upload] 接收到檔案: ${displayName}`);
    console.log(`  類型: ${mimeType}`);
    console.log(`  大小: ${(req.file.size / 1024).toFixed(2)} KB`);

    // 上傳到 Gemini Files API
    const fileMetadata = await uploadToGeminiFilesAPI(
      filePath,
      mimeType,
      displayName
    );

    // 清除暫存檔案
    fs.unlinkSync(filePath);

    res.json({
      name: fileMetadata.name,
      uri: fileMetadata.uri,
      mimeType: fileMetadata.mimeType,
      displayName: fileMetadata.displayName,
      sizeBytes: fileMetadata.sizeBytes
    });

  } catch (error) {
    console.error('❌ 檔案上傳錯誤:', error);

    // 清除暫存檔案（如果存在）
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: error.message || '檔案上傳失敗'
    });
  }
});

/**
 * 刪除 Gemini Files API 中的檔案
 * DELETE /api/gemini/file/:fileName
 */
app.delete('/api/gemini/file/:fileName(*)', async (req, res) => {
  try {
    const fileName = req.params.fileName;

    if (!fileName) {
      return res.status(400).json({ error: '未提供檔案名稱' });
    }

    console.log(`[File Delete] 刪除檔案: ${fileName}`);
    await deleteGeminiFile(fileName);

    res.json({ success: true, message: '檔案已刪除' });

  } catch (error) {
    console.error('❌ 檔案刪除錯誤:', error);
    res.status(500).json({
      error: error.message || '檔案刪除失敗'
    });
  }
});

/**
 * 列出所有已上傳的檔案
 * GET /api/gemini/files
 */
app.get('/api/gemini/files', async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 100;
    const files = await listGeminiFiles(pageSize);

    res.json({ files });

  } catch (error) {
    console.error('❌ 列出檔案錯誤:', error);
    res.status(500).json({
      error: error.message || '列出檔案失敗'
    });
  }
});

/**
 * 取得檔案資訊
 * GET /api/gemini/file/:fileName
 */
app.get('/api/gemini/file/:fileName(*)', async (req, res) => {
  try {
    const fileName = req.params.fileName;

    if (!fileName) {
      return res.status(400).json({ error: '未提供檔案名稱' });
    }

    const fileInfo = await getGeminiFile(fileName);
    res.json(fileInfo);

  } catch (error) {
    console.error('❌ 取得檔案資訊錯誤:', error);
    res.status(500).json({
      error: error.message || '取得檔案資訊失敗'
    });
  }
});

// ==================== YouTube Analytics API ====================

/**
 * 獲取頻道影片分析數據
 * POST /api/analytics/channel
 */
app.post('/api/analytics/channel', async (req, res) => {
  try {
    const { accessToken, channelId, daysThreshold } = req.body;

    if (!accessToken || !channelId) {
      return res.status(400).json({
        error: 'Missing required parameters: accessToken and channelId',
      });
    }

    console.log(`[Analytics API] 開始分析頻道: ${channelId}`);

    // 獲取分析數據
    const analyticsData = await getChannelVideosAnalytics(
      accessToken,
      channelId,
      daysThreshold || 365 // 預設 1 年
    );

    // 計算優先級
    const recommendations = calculateUpdatePriority(analyticsData);

    console.log(`[Analytics API] 分析完成，建議更新 ${recommendations.length} 支影片`);

    res.json({
      success: true,
      totalVideos: analyticsData.length,
      recommendations: recommendations,
    });
  } catch (error) {
    console.error('[Analytics API] 錯誤:', error);
    res.status(500).json({
      error: 'Analytics analysis failed',
      message: error.message,
    });
  }
});

/**
 * 分析單一影片的關鍵字並提供優化建議
 * POST /api/analytics/keyword-analysis
 */
app.post('/api/analytics/keyword-analysis', async (req, res) => {
  try {
    const { videoData } = req.body;

    if (!videoData || !videoData.title) {
      return res.status(400).json({
        error: 'Missing required parameters: videoData with title',
      });
    }

    console.log(`[Keyword Analysis] 開始分析影片: ${videoData.title}`);

    // 生成 prompt
    const prompt = generateKeywordAnalysisPrompt(videoData);

    // 調用 Gemini AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    let responseText = '';
    if (typeof result.text === 'function') {
      responseText = result.text();
    } else if (typeof result.response?.text === 'function') {
      responseText = result.response.text();
    } else if (result.candidates?.[0]?.content?.parts?.length) {
      responseText = result.candidates[0].content.parts
        .map(part => part.text || '')
        .join('\n');
    }

    // 解析 JSON 回應
    let analysis;
    try {
      // 移除可能的 markdown 程式碼區塊標記
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[Keyword Analysis] JSON 解析失敗:', parseError);
      console.error('[Keyword Analysis] 原始回應:', responseText);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        message: parseError.message,
        rawResponse: responseText,
      });
    }

    console.log(`[Keyword Analysis] 分析完成`);

    const metadataHints = analysis.metadataHints || {};
    analysis.metadataHints = {
      titleHooks: Array.isArray(metadataHints.titleHooks) ? metadataHints.titleHooks : [],
      descriptionAngles: Array.isArray(metadataHints.descriptionAngles) ? metadataHints.descriptionAngles : [],
      callToActions: Array.isArray(metadataHints.callToActions) ? metadataHints.callToActions : [],
    };

    res.json({
      success: true,
      analysis: analysis,
    });
  } catch (error) {
    console.error('[Keyword Analysis] 錯誤:', error);
    res.status(500).json({
      error: 'Keyword analysis failed',
      message: error.message,
    });
  }
});

/**
 * 獲取單一影片的搜尋字詞數據
 * POST /api/analytics/search-terms
 */
app.post('/api/analytics/search-terms', async (req, res) => {
  try {
    const { accessToken, channelId, videoId, daysThreshold, maxResults } = req.body;

    if (!accessToken || !channelId || !videoId) {
      return res.status(400).json({
        error: 'Missing required parameters: accessToken, channelId, and videoId',
      });
    }

    if (!isValidVideoId(videoId)) {
      return res.status(400).json({
        error: 'Invalid videoId format',
      });
    }

    console.log(`[Search Terms API] 開始獲取影片搜尋字詞: ${videoId}`);

    // 調用 analyticsService 的 getVideoSearchTerms 函數
    const searchTermsData = await getVideoSearchTerms(
      accessToken,
      channelId,
      videoId,
      daysThreshold || 365, // 預設 1 年
      maxResults || 10 // 預設前 10 個
    );

    console.log(`[Search Terms API] 成功獲取 ${searchTermsData.length} 個搜尋字詞`);

    res.json({
      success: true,
      videoId: videoId,
      searchTerms: searchTermsData,
    });
  } catch (error) {
    console.error('[Search Terms API] 錯誤:', error);
    const reason = error.response?.data?.error?.errors?.[0]?.reason || error.message;
    res.status(500).json({
      error: 'Search terms retrieval failed',
      message: reason,
    });
  }
});

/**
 * 獲取單一影片的外部流量詳細資料
 * POST /api/analytics/external-traffic
 */
app.post('/api/analytics/external-traffic', async (req, res) => {
  try {
    const { accessToken, channelId, videoId, daysThreshold, maxResults } = req.body;

    if (!accessToken || !channelId || !videoId) {
      return res.status(400).json({
        error: 'Missing required parameters: accessToken, channelId, and videoId',
      });
    }

    if (!isValidVideoId(videoId)) {
      return res.status(400).json({
        error: 'Invalid videoId format',
      });
    }

    console.log(`[External Details API] 開始獲取影片外部流量細節: ${videoId}`);

    const details = await getVideoExternalTrafficDetails(
      accessToken,
      channelId,
      videoId,
      daysThreshold || 365,
      maxResults || 25
    );

    console.log(`[External Details API] 完成獲取外部流量細節: ${videoId}`);

    res.json({
      success: true,
      videoId,
      ...details,
    });
  } catch (error) {
    console.error('[External Details API] 錯誤:', error);
    const reason = error.response?.data?.error?.errors?.[0]?.reason || error.message;
    res.status(500).json({
      error: 'External traffic details retrieval failed',
      message: reason,
    });
  }
});

// ==================== 影片快取 API ====================

/**
 * API: 生成並上傳影片快取到 Gist
 * POST /api/video-cache/generate
 */
app.post('/api/video-cache/generate', async (req, res) => {
  try {
    const { accessToken, channelId, gistToken, gistId } = req.body;

    console.log('[API] ========================================');
    console.log('[API] 📦 收到生成影片快取請求');
    console.log('[API] ========================================');

    if (!accessToken) {
      console.log('[API] ❌ 缺少 accessToken');
      return res.status(400).json({ error: '缺少 accessToken' });
    }

    if (!channelId) {
      console.log('[API] ❌ 缺少 channelId');
      return res.status(400).json({ error: '缺少 channelId' });
    }

    if (!gistToken) {
      console.log('[API] ❌ 缺少 gistToken');
      return res.status(400).json({ error: '缺少 gistToken' });
    }

    console.log(`[API] 📺 頻道 ID: ${channelId}`);
    console.log(`[API] 🆔 Gist ID: ${gistId || '(首次建立)'}`);
    console.log('[API] 🚀 開始生成影片快取...\n');

    // 步驟 1: 從 YouTube 抓取所有影片標題
    const videos = await fetchAllVideoTitles(accessToken, channelId);

    console.log(`\n[API] ✅ 抓取完成，共 ${videos.length} 支影片`);

    // 步驟 2: 上傳到 Gist
    const gistInfo = await uploadToGist(videos, gistToken, gistId || null);

    console.log('\n[API] ========================================');
    console.log('[API] ✅ 影片快取生成成功！');
    console.log('[API] ========================================');
    console.log(`[API] 📊 總影片數: ${videos.length}`);
    console.log(`[API] 🆔 Gist ID: ${gistInfo.id}`);
    console.log(`[API] 🔗 Gist URL: ${gistInfo.url}`);
    console.log('[API] ========================================\n');

    res.json({
      success: true,
      totalVideos: videos.length,
      gistId: gistInfo.id,
      gistUrl: gistInfo.url,
      rawUrl: gistInfo.rawUrl,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('\n[API] ========================================');
    console.error('[API] ❌ 生成影片快取錯誤');
    console.error('[API] ========================================');
    console.error(`[API] 錯誤訊息: ${error.message}`);
    console.error('[API] ========================================\n');
    res.status(500).json({
      error: error.message || '生成影片快取失敗',
    });
  }
});

/**
 * API: 從 Gist 載入影片快取
 * GET /api/video-cache/load/:gistId
 */
app.get('/api/video-cache/load/:gistId', async (req, res) => {
  try {
    const { gistId } = req.params;
    const { gistToken } = req.query;

    console.log('[API] ========================================');
    console.log('[API] 📥 收到載入 Gist 快取請求');
    console.log('[API] ========================================');

    if (!gistId) {
      console.log('[API] ❌ 缺少 gistId');
      return res.status(400).json({ error: '缺少 gistId' });
    }

    console.log(`[API] 🆔 Gist ID: ${gistId}`);
    console.log(`[API] 🔑 使用 Token: ${gistToken ? '是' : '否'}`);
    console.log('[API] 🚀 開始載入快取...\n');

    const cache = await loadFromGist(gistId, gistToken || null);

    console.log('\n[API] ========================================');
    console.log('[API] ✅ Gist 快取載入成功！');
    console.log('[API] ========================================');
    console.log(`[API] 📊 總影片數: ${cache.totalVideos}`);
    console.log(`[API] 📅 快取更新時間: ${cache.updatedAt}`);
    console.log('[API] ========================================\n');

    res.json({
      success: true,
      ...cache,
    });
  } catch (error) {
    console.error('\n[API] ========================================');
    console.error('[API] ❌ 載入 Gist 快取錯誤');
    console.error('[API] ========================================');
    console.error(`[API] 錯誤訊息: ${error.message}`);
    console.error('[API] ========================================\n');
    res.status(500).json({
      error: error.message || '載入 Gist 快取失敗',
    });
  }
});

/**
 * API: 從 Gist 快取搜尋影片
 * GET /api/video-cache/search
 * Query params: gistId, query, maxResults, gistToken
 */
app.get('/api/video-cache/search', async (req, res) => {
  try {
    const { gistId: requestGistId, query, maxResults = 10, gistToken } = req.query;

    console.log('[API] ========================================');
    console.log('[API] 🔍 收到快取搜尋請求');
    console.log('[API] ========================================');

    // 優先使用請求中的 gistId，如果沒有則使用環境變數
    const gistId = requestGistId || process.env.GITHUB_GIST_ID;

    if (!gistId) {
      console.log('[API] ❌ 缺少 gistId (請求參數或環境變數)');
      return res.status(400).json({ error: '缺少 gistId，請設定 GITHUB_GIST_ID 環境變數' });
    }

    // 優先使用環境變數中的 GIST_TOKEN，如果前端有傳則使用前端的
    const token = gistToken || process.env.GITHUB_GIST_TOKEN || null;

    console.log(`[API] 🆔 Gist ID: ${gistId}`);
    console.log(`[API] 🔑 搜尋關鍵字: ${query || '(無)'}`);
    console.log(`[API] 📊 最大結果數: ${maxResults}`);
    console.log(`[API] 🔐 使用 Token: ${token ? '是 (來源: ' + (gistToken ? '前端' : '環境變數') + ')' : '否'}`);
    console.log('[API] 🚀 開始搜尋...\n');

    const videos = await searchVideosFromCache(
      gistId,
      query,
      parseInt(maxResults) || 10,
      token
    );

    console.log('\n[API] ========================================');
    console.log('[API] ✅ 搜尋完成！');
    console.log('[API] ========================================');
    console.log(`[API] 📤 返回 ${videos.length} 筆結果`);
    console.log('[API] ========================================\n');

    res.json({
      success: true,
      query: query || '',
      totalResults: videos.length,
      videos: videos,
    });
  } catch (error) {
    console.error('\n[API] ========================================');
    console.error('[API] ❌ 快取搜尋錯誤');
    console.error('[API] ========================================');
    console.error(`[API] 錯誤訊息: ${error.message}`);
    console.error('[API] ========================================\n');
    res.status(500).json({
      error: error.message || '搜尋影片快取失敗',
    });
  }
});

// 服務前端靜態檔案（Vite build 輸出的 dist），但排除 index.html
// index.html 需要動態注入環境變數，所以由下面的路由處理
app.use(express.static(path.join(process.cwd(), 'dist'), {
  index: false, // 不自動提供 index.html，讓下面的路由處理
}));

// 單頁應用程式路由 fallback（最後註冊，避免吃掉 /api/*）
app.get('*', (_req, res) => {
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    // 讀取 HTML 並注入 runtime config
    let html = fs.readFileSync(indexPath, 'utf-8');

    // 注入環境變數到前端（只注入安全的公開資訊）
    const runtimeConfig = {
      YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || null,
      YOUTUBE_SCOPES: process.env.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly',
      GITHUB_GIST_ID: process.env.GITHUB_GIST_ID || null,
    };

    // 在 </head> 前注入 config script
    const configScript = `
    <script>
      window.__APP_CONFIG__ = ${JSON.stringify(runtimeConfig)};
    </script>
    `;

    html = html.replace('</head>', `${configScript}</head>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.status(404).send('Build not found. Please run the build process.');
  }
});

// ==================== 啟動時清理過期檔案 ====================

/**
 * 清理指定目錄中超過保留天數的檔案
 * @param {string} directory - 要清理的目錄路徑
 * @param {number} retentionDays - 保留天數
 * @returns {Promise<{deletedCount: number, deletedSize: number}>}
 */
async function cleanupOldFiles(directory, retentionDays) {
  if (!fs.existsSync(directory)) {
    return { deletedCount: 0, deletedSize: 0 };
  }

  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000; // 轉換為毫秒
  let deletedCount = 0;
  let deletedSize = 0;

  try {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);

      try {
        const stats = fs.statSync(filePath);

        // 只處理檔案，跳過目錄
        if (!stats.isFile()) {
          continue;
        }

        // 計算檔案年齡
        const fileAge = now - stats.mtime.getTime();

        // 如果檔案超過保留天數，則刪除
        if (fileAge > retentionMs) {
          const fileSize = stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          deletedSize += fileSize;

          const ageInDays = Math.floor(fileAge / (24 * 60 * 60 * 1000));
          console.log(`  🗑️  已刪除: ${file} (${(fileSize / (1024 * 1024)).toFixed(2)} MB, ${ageInDays} 天前)`);
        }
      } catch (err) {
        console.error(`  ⚠️  無法處理檔案 ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[Cleanup] 讀取目錄失敗 ${directory}:`, err.message);
  }

  return { deletedCount, deletedSize };
}

// ==================== 頻道數據聚合 API ====================

/**
 * POST /api/channel-analytics/aggregate
 * 聚合頻道數據（支援關鍵字過濾和多個日期範圍）
 *
 * Request body:
 * {
 *   accessToken: string,
 *   channelId: string,
 *   keywordGroups: [{ name: string, keyword: string }],
 *   dateRanges: [{ label: string, startDate: string, endDate: string }]
 * }
 */
app.post('/api/channel-analytics/aggregate', async (req, res) => {
  try {
    const { accessToken, channelId, keywordGroups, dateRanges } = req.body;

    // 驗證參數
    if (!accessToken) {
      return res.status(400).json({ error: '缺少 accessToken' });
    }

    if (!channelId) {
      return res.status(400).json({ error: '缺少 channelId' });
    }

    if (!keywordGroups || !Array.isArray(keywordGroups) || keywordGroups.length === 0) {
      return res.status(400).json({ error: '缺少 keywordGroups 或格式錯誤' });
    }

    if (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0) {
      return res.status(400).json({ error: '缺少 dateRanges 或格式錯誤' });
    }

    // 驗證 keywordGroups 格式
    for (const group of keywordGroups) {
      if (!group.name || typeof group.name !== 'string') {
        return res.status(400).json({ error: 'keywordGroups 中的 name 必須為字符串' });
      }
      if (typeof group.keyword !== 'string') {
        return res.status(400).json({ error: 'keywordGroups 中的 keyword 必須為字符串' });
      }
    }

    // 驗證 dateRanges 格式
    for (const range of dateRanges) {
      if (!range.label || typeof range.label !== 'string') {
        return res.status(400).json({ error: 'dateRanges 中的 label 必須為字符串' });
      }
      if (!range.startDate || typeof range.startDate !== 'string') {
        return res.status(400).json({ error: 'dateRanges 中的 startDate 必須為字符串 (YYYY-MM-DD)' });
      }
      if (!range.endDate || typeof range.endDate !== 'string') {
        return res.status(400).json({ error: 'dateRanges 中的 endDate 必須為字符串 (YYYY-MM-DD)' });
      }
    }

    console.log('[API] 開始聚合頻道數據...');
    console.log(`[API]   頻道 ID: ${channelId}`);
    console.log(`[API]   關鍵字組合數: ${keywordGroups.length}`);
    console.log(`[API]   日期範圍數: ${dateRanges.length}`);

    const result = await aggregateChannelData(
      accessToken,
      channelId,
      keywordGroups,
      dateRanges
    );

    res.json(result);
  } catch (error) {
    console.error('[API] 頻道數據聚合錯誤:', error);
    res.status(500).json({
      error: error.message || '數據聚合失敗',
      details: error.toString(),
    });
  }
});

/**
 * POST /api/channel-analytics/clear-cache
 * 清除數據聚合快取
 */
app.post('/api/channel-analytics/clear-cache', (_req, res) => {
  try {
    const result = clearAnalyticsCache();
    res.json({
      success: true,
      message: `已清除 ${result.cleared} 筆快取`,
      cleared: result.cleared,
    });
  } catch (error) {
    console.error('[API] 清除快取錯誤:', error);
    res.status(500).json({
      error: error.message || '清除快取失敗',
    });
  }
});

/**
 * 啟動時執行清理任務
 */
async function startupCleanup() {
  console.log('\n========== 🧹 啟動清理檢查 ==========');
  console.log(`[Cleanup] 檔案保留天數: ${FILE_RETENTION_DAYS} 天`);

  // 清理暫存影片
  console.log('[Cleanup] 檢查 temp_videos 目錄...');
  const tempResult = await cleanupOldFiles(DOWNLOAD_DIR, FILE_RETENTION_DAYS);

  // 清理截圖
  console.log('[Cleanup] 檢查 public/images 目錄...');
  const imagesResult = await cleanupOldFiles(IMAGES_DIR, FILE_RETENTION_DAYS);

  // 統計總計
  const totalDeleted = tempResult.deletedCount + imagesResult.deletedCount;
  const totalSize = (tempResult.deletedSize + imagesResult.deletedSize) / (1024 * 1024);

  if (totalDeleted > 0) {
    console.log(`[Cleanup] ✅ 清理完成: 刪除 ${totalDeleted} 個檔案，釋放 ${totalSize.toFixed(2)} MB 空間`);
  } else {
    console.log('[Cleanup] ✅ 無需清理，所有檔案都在保留期限內');
  }
  console.log('========== 清理檢查完成 ==========\n');
}

// 啟動伺服器前先執行清理
startupCleanup().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Make sure yt-dlp is installed: https://github.com/yt-dlp/yt-dlp#installation`);
  });
}).catch((err) => {
  console.error('❌ Cleanup failed:', err);
  // 即使清理失敗也要啟動伺服器
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Make sure yt-dlp is installed: https://github.com/yt-dlp/yt-dlp#installation`);
  });
});
