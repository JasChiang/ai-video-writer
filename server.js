import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';
import { generateFullPrompt } from './services/server/promptService.js';
import { generateArticlePrompt } from './services/server/articlePromptService.js';
import { AIModelManager } from './services/server/aiProviders/AIModelManager.js';
import { createQuotaRouter } from './routes/quota.js';
import { createTasksRouter } from './routes/tasks.js';
import { createTemplatesRouter } from './routes/templates.js';
import { createNotionRouter } from './routes/notion.js';
import { createAiModelsRouter } from './routes/aiModels.js';
import { createChannelAnalyticsRouter } from './routes/channelAnalytics.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createVideoCacheRouter } from './routes/videoCache.js';
import { createAiAnalysisRouter } from './routes/aiAnalysis.js';
import { createVideoProcessingRouter } from './routes/videoProcessing.js';

// 載入 .env.local 檔案
dotenv.config({ path: '.env.local' });

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

// 驗證 API Key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY is not set in .env.local');
  console.error('Please add GEMINI_API_KEY=your_api_key to .env.local');
  process.exit(1);
}

console.log('✅ Gemini API Key loaded successfully');

// Gemini API HTTP 配置（設置 15 分鐘超時，適合處理長影片）
const GEMINI_HTTP_OPTIONS = {
  timeout: 15 * 60 * 1000  // 15 分鐘（毫秒）
};

// 初始化 Gemini AI 客戶端（用於 Files API 等）
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: GEMINI_HTTP_OPTIONS
});

// 初始化 AI 模型管理器
const aiManager = new AIModelManager();
const DEFAULT_MAX_TOKENS = 8192;
const MODEL_MAX_TOKEN_MAP = {
  'openai/gpt-5.1': 128000,
};

const getMaxTokensForModel = (modelType = '') => {
  if (!modelType) return DEFAULT_MAX_TOKENS;
  return MODEL_MAX_TOKEN_MAP[modelType] || DEFAULT_MAX_TOKENS;
};
console.log('✅ AI Model Manager initialized');

app.use(cors());
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

// 確保上傳目錄存在（用於 Gemini Files API 暫存）
const UPLOAD_DIR = path.join(process.cwd(), 'temp_uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 設定 multer 用於檔案上傳
const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB 限制
  }
});

// 靜態檔案服務 - 提供截圖存取
app.use('/images', express.static(IMAGES_DIR));

// 前端執行期設定：由後端輸出 config.js，避免在建置期烘入敏感或會變動的設定
app.get('/app-config.js', (_req, res) => {
  const cfg = {
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || null,
    YOUTUBE_SCOPES: 'https://www.googleapis.com/auth/youtube',
  };
  res.type('application/javascript').send(`window.__APP_CONFIG__ = ${JSON.stringify(cfg)};`);
});

app.use('/api/quota', createQuotaRouter());
app.use('/api/task', createTasksRouter());
app.use('/api/templates', createTemplatesRouter());
app.use('/api/notion', createNotionRouter({ notionStateStore, pruneExpiredNotionStates }));
app.use('/api/ai-models', createAiModelsRouter({ aiManager }));
app.use('/api/channel-analytics', createChannelAnalyticsRouter());
app.use('/api/analytics', createAnalyticsRouter({ aiManager }));
app.use('/api/video-cache', createVideoCacheRouter());
app.use('/api', createAiAnalysisRouter({ aiManager, getMaxTokensForModel }));
app.use('/api', createVideoProcessingRouter({
  execAsync,
  ai,
  GoogleGenAI,
  GEMINI_HTTP_OPTIONS,
  generateFullPrompt,
  generateArticlePrompt,
  isValidVideoId,
  findFileByDisplayName,
  checkRateLimit,
  downloadRateLimiter,
  ipRateLimiter,
  MAX_DOWNLOADS_PER_HOUR,
  MAX_DOWNLOADS_PER_HOUR_PER_IP,
  taskQueue,
  upload,
  DOWNLOAD_DIR,
  IMAGES_DIR,
  timeToSeconds,
  secondsToTime,
  captureScreenshot,
  fs,
  path,
}));

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
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
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

// 服務前端靜態檔案（Vite build 輸出的 dist）
app.use(express.static(path.join(process.cwd(), 'dist')));

// 單頁應用程式路由 fallback（最後註冊，避免吃掉 /api/*）
app.get('*', (_req, res) => {
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
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
