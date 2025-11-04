import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';
import { generateFullPrompt } from './services/promptService.js';
import { generateArticlePrompt } from './services/articlePromptService.js';
import {
  getChannelVideosAnalytics,
  calculateUpdatePriority,
  getVideoSearchTerms,
  getVideoExternalTrafficDetails,
} from './services/analyticsService.js';
import { generateKeywordAnalysisPrompt } from './services/keywordAnalysisPromptService.js';
import {
  uploadToGeminiFilesAPI,
  deleteGeminiFile,
  listGeminiFiles,
  getGeminiFile
} from './services/geminiFilesService.js';

// 載入 .env.local 檔案
dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// 檔案保留天數設定（預設 7 天）
const FILE_RETENTION_DAYS = parseInt(process.env.FILE_RETENTION_DAYS || '7', 10);

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

// ==================== API 端點 ====================

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

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);

  try {
    console.log(`\n========== 🎬 開始下載影片 ==========`);
    console.log(`[Download] Video ID: ${videoId}`);
    console.log(`[Download] Video URL: ${videoUrl}`);

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

    // 建構命令（使用陣列避免換行問題）
    // 注意：不使用 android client，因為它限制只能下載 360p
    // 對於未列出的影片，現代 yt-dlp 可以不需要 cookies 直接下載
    const commandParts = [
      'yt-dlp',
      // 根據品質選擇格式
      '-f', formatSelector,
      // 如果下載分離的音視頻流，合併為 mp4
      '--merge-output-format', 'mp4',
      '-o', `"${outputPath}"`,
      // 增加重試次數
      '--retries', '5',
      '--fragment-retries', '5',
      // 添加影片 URL
      `"${videoUrl}"`,
    ];

    const command = commandParts.join(' ');

    console.log(`[Download] Executing command:\n${command}`);
    console.log(`[Download] 正在下載影片,請稍候...`);

    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

    if (stdout) console.log('[Download] yt-dlp output:', stdout);
    if (stderr) console.log('[Download] yt-dlp warnings:', stderr);

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
 * 使用 YouTube URL 生成文章（僅限公開影片）
 * POST /api/generate-article-url
 * Body: { videoId: string, prompt: string, videoTitle: string, quality?: number }
 */
app.post('/api/generate-article-url', async (req, res) => {
  const { videoId, prompt, videoTitle, quality = 2, uploadedFiles = [] } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);

  try {
    console.log(`\n========== 📝 使用 YouTube URL 生成文章 ==========`);
    console.log(`[Article URL] Video ID: ${videoId}`);
    console.log(`[Article URL] YouTube URL: ${youtubeUrl}`);
    console.log(`[Article URL] Video Title: ${videoTitle}`);
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
      ? generateArticlePromptWithFiles(videoTitle, prompt, uploadedFiles)
      : generateArticlePrompt(videoTitle, prompt);

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
    const response = await ai.models.generateContent({
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

    // 步驟 2: 下載影片用於截圖
    console.log('[Article URL] 步驟 2/3: 下載影片以進行截圖...');

    // 根據截圖品質決定影片解析度
    // quality=2（高畫質截圖）→ 下載 1080p 影片（至少 720p）
    // quality=20（壓縮截圖）→ 下載 720p 影片（至少 480p）
    let formatSelector;
    if (quality <= 10) {
      // 高品質：優先 1080p，次選 720p，最後接受 >=480p 或最佳
      formatSelector = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"';
      console.log(`[Article URL] 截圖品質: ${quality}（高畫質）→ 目標影片解析度: 1080p (退回 720p)`);
    } else {
      // 壓縮：優先 720p，次選 480p，最後接受 360p 或最佳
      formatSelector = '"bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"';
      console.log(`[Article URL] 截圖品質: ${quality}（壓縮）→ 目標影片解析度: 720p (退回 480p)`);
    }

    const commandParts = [
      'yt-dlp',
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '-o', `"${outputPath}"`,
      '--retries', '5',
      '--fragment-retries', '5',
      `"${youtubeUrl}"`,
    ];

    const command = commandParts.join(' ');
    console.log(`[Article URL] Executing: ${command}`);

    await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Video download failed - file not found');
    }

    console.log(`[Article URL] ✅ 影片下載完成: ${outputPath}`);

    // 步驟 3: 使用 FFmpeg 截取畫面
    console.log('[Article URL] 步驟 3/3: 正在截取關鍵畫面...');
    console.log(`[Article URL] 截圖品質設定: ${quality} (2=最高, 31=最低)`);

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

      console.log(`[Article URL] 截圖組 ${i + 1}/${result.screenshots.length} - 時間點: ${timestamp} - 原因: ${screenshot.reason_for_screenshot}`);

      for (const { offset, label } of offsets) {
        const targetSeconds = Math.max(0, currentSeconds + offset);
        const targetTime = secondsToTime(targetSeconds); // 僅用於檔名
        const outputFilename = `${videoId}_screenshot_${i}_${label}_${targetTime.replace(':', '-')}.jpg`;
        const screenshotPath = path.join(IMAGES_DIR, outputFilename);

        try {
          await captureScreenshot(outputPath, targetSeconds, screenshotPath, quality);
          screenshotGroup.push(`/images/${outputFilename}`);
          console.log(`[Article URL] ✅ 截圖已儲存: ${outputFilename} (${label}: ${targetSeconds}s)`);
        } catch (error) {
          console.error(`[Article URL] ❌ 截圖失敗 (時間點 ${targetSeconds}s, ${label}):`, error.message);
        }
      }

      if (screenshotGroup.length > 0) {
        imageUrls.push(screenshotGroup);
      }
    }

    // 保留暫存影片檔案供後續重新截圖使用
    console.log(`[Article URL] ✅ 已完成截圖，暫存檔案保留供後續使用: ${outputPath}`);
    console.log(`========== 文章生成完成 ==========\n`);

    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      image_urls: imageUrls,
      screenshots: result.screenshots,
      usedYouTubeUrl: true
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
 * 生成文章與截圖（用於非公開影片）
 * POST /api/generate-article
 * Body: { videoId: string, filePath: string, prompt: string, videoTitle: string, quality?: number }
 * 注意：filePath 是必需的，因為需要本地檔案來截圖
 */
app.post('/api/generate-article', async (req, res) => {
  const { videoId, filePath, prompt, videoTitle, quality = 2 } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  if (!filePath) {
    return res.status(400).json({ error: 'Missing required parameter: filePath' });
  }

  try {
    console.log(`\n========== 📝 開始生成文章 ==========`);
    console.log(`[Article] Video ID: ${videoId}`);
    console.log(`[Article] File Path: ${filePath}`);
    console.log(`[Article] Video Title: ${videoTitle}`);

    // 檢查 FFmpeg 是否安裝
    console.log('[Article] Checking FFmpeg installation...');
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const version = stdout.split('\n')[0];
      console.log(`[Article] ✅ FFmpeg found: ${version}`);
    } catch (error) {
      console.error('[Article] ❌ FFmpeg not found');
      return res.status(500).json({
        error: 'FFmpeg is not installed. Please install it first.',
        details: 'Install FFmpeg: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Ubuntu)'
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 先檢查檔案是否已存在於 Files API
    console.log('[Article] 步驟 2/5: 檢查 Files API 中是否已有此檔案...');
    const existingFile = await findFileByDisplayName(ai, videoId);

    let uploadedFile;
    let reusedFile = false;

    if (existingFile) {
      console.log(`[Article] ✅ 找到已存在的檔案，將重複使用！`);
      console.log(`[Article] File Name: ${existingFile.name}`);
      console.log(`[Article] Display Name: ${existingFile.displayName}`);
      console.log(`[Article] File URI: ${existingFile.uri}`);
      console.log(`[Article] 跳過上傳步驟，節省時間和流量！`);
      console.log(`[Article] 本地檔案保留用於 FFmpeg 截圖`);
      uploadedFile = existingFile;
      reusedFile = true;
    } else {
      console.log('[Article] 檔案不存在於 Files API，需要上傳...');
      console.log('[Article] 步驟 3/5: 正在上傳影片到 Gemini...');

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
    console.log(reusedFile ? '[Article] 步驟 3/5: 正在生成文章內容與截圖時間點...' : '[Article] 步驟 4/5: 正在生成文章內容與截圖時間點...');
    const fullPrompt = generateArticlePrompt(videoTitle, prompt);

    // 呼叫 Gemini API 生成文章與截圖時間點
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

    let result;
    try {
      const responseText = response.text;
      console.log(`[Article] ✅ Gemini 回應長度: ${responseText.length} 字元`);
      console.log(`[Article] 回應預覽: ${responseText.substring(0, 150)}...`);

      result = JSON.parse(responseText);

      // 驗證必要欄位
      if (!result.titleA || !result.titleB || !result.titleC || !result.article_text || !result.screenshots) {
        throw new Error('Missing required fields in response');
      }

      console.log(`[Article] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
      console.log(`[Article] 標題 A: ${result.titleA}`);
    } catch (parseError) {
      console.error('[Article] ❌ JSON parsing error:', parseError.message);
      console.error('[Article] Full response text:', response.text);

      // 嘗試找出問題位置
      const lines = response.text.split('\n');
      console.error(`[Article] Response has ${lines.length} lines`);

      throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
    }

    // 使用 FFmpeg 截取畫面
    // 每個時間點截取 3 張圖片：前 2 秒、當前、後 2 秒
    console.log(reusedFile ? '[Article] 步驟 4/5: 正在截取關鍵畫面...' : '[Article] 步驟 5/5: 正在截取關鍵畫面...');
    console.log(`[Article] 截圖品質設定: ${quality} (2=最高, 31=最低)`);

    const imageUrls = [];
    for (let i = 0; i < result.screenshots.length; i++) {
      const screenshot = result.screenshots[i];
      const timestamp = screenshot.timestamp_seconds; // 格式：mm:ss
      const currentSeconds = timeToSeconds(timestamp);

      const screenshotGroup = [];
      const offsets = [
        { offset: -2, label: 'before' },
        { offset: 0, label: 'current' },
        { offset: 2, label: 'after' }
      ];

      console.log(`[Article] 截圖組 ${i + 1}/${result.screenshots.length} - 時間點: ${timestamp} - 原因: ${screenshot.reason_for_screenshot}`);

      for (const { offset, label } of offsets) {
        const targetSeconds = Math.max(0, currentSeconds + offset); // 確保不會小於 0
        const targetTime = secondsToTime(targetSeconds); // 僅用於檔名
        const outputFilename = `${videoId}_screenshot_${i}_${label}_${targetTime.replace(':', '-')}.jpg`;
        const outputPath = path.join(IMAGES_DIR, outputFilename);

        try {
          await captureScreenshot(filePath, targetSeconds, outputPath, quality);
          screenshotGroup.push(`/images/${outputFilename}`);
          console.log(`[Article] ✅ 截圖已儲存: ${outputFilename} (${label}: ${targetSeconds}s)`);
        } catch (error) {
          console.error(`[Article] ❌ 截圖失敗 (時間點 ${targetSeconds}s, ${label}):`, error.message);
          // 如果某張截圖失敗，仍然繼續處理其他截圖
        }
      }

      if (screenshotGroup.length > 0) {
        imageUrls.push(screenshotGroup);
      }
    }

    // 保留暫存影片檔案供後續重新截圖使用
    console.log(`[Article] ✅ 已完成截圖，暫存檔案保留供後續使用: ${filePath}`);
    console.log(`========== 文章生成完成 ==========\n`);

    res.json({
      success: true,
      titleA: result.titleA,
      titleB: result.titleB,
      titleC: result.titleC,
      article: result.article_text,
      seo_description: result.seo_description,
      image_urls: imageUrls,
      screenshots: result.screenshots,
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
  const { videoId, geminiFileName, prompt, videoTitle } = req.body;

  if (!videoId || !isValidVideoId(videoId)) {
    return res.status(400).json({ error: 'Missing or invalid videoId format' });
  }

  if (!geminiFileName) {
    return res.status(400).json({ error: 'Missing required parameter: geminiFileName' });
  }

  try {
    console.log(`Regenerating article using existing file: ${geminiFileName}`);

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
    const fullPrompt = generateArticlePrompt(videoTitle, prompt);

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
  const { videoId, videoTitle, filePath, prompt, quality = 2 } = req.body;

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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 步驟 1: 檢查 Files API 中是否有此檔案
    console.log('[Regenerate Screenshots] 步驟 1/4: 檢查 Files API 中是否已有此檔案...');
    const filesList = await ai.files.list();
    const files = filesList.pageInternal || [];
    const existingFile = files.find(file =>
      file.displayName === videoId && file.state === 'ACTIVE'
    );

    if (!existingFile) {
      return res.status(404).json({ error: 'Video file not found in Files API. Please generate article first.' });
    }

    console.log(`[Regenerate Screenshots] ✅ 找到已存在的檔案: ${existingFile.uri}`);

    // 步驟 2: 讓 Gemini 重新看影片並生成新的截圖建議
    console.log('[Regenerate Screenshots] 步驟 2/4: 讓 Gemini 重新分析影片並提供新的截圖建議...');
    const fullPrompt = generateArticlePrompt(videoTitle, prompt || '');

    // 根據最佳實踐：影片應該放在 prompt 之前
    const response = await ai.models.generateContent({
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

    let result;
    try {
      const responseText = response.text;
      result = JSON.parse(responseText);
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
