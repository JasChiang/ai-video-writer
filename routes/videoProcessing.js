import { Router } from 'express';
import { ensureGeminiFileActive, uploadGeminiFile } from '../services/server/videoProcessing/geminiFiles.js';
import { parseGeminiJson } from '../services/server/videoProcessing/jsonParser.js';
import {
  appendJsonInstruction,
  buildAnalysisPrompt,
  buildArticlePrompt,
  buildArticlePromptWithReferences
} from '../services/server/videoProcessing/promptAssembly.js';
import { validateBody, validateParams } from '../services/server/requestValidation.js';

export function createVideoProcessingRouter({
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
}) {
  const router = Router();

  /**
   * 下載 YouTube 影片
   * POST /api/download-video
   * Body: { videoId: string, accessToken: string, quality?: number }
   */
  router.post(
    '/download-video',
    validateBody({
      videoId: { type: 'string' },
      accessToken: { type: 'string', optional: true },
      quality: { type: 'number', optional: true, allowStringNumber: true },
    }),
    async (req, res) => {
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
          error: 'yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp#installation',
        });
      }

      // 根據截圖品質決定影片解析度
      let formatSelector;
      if (quality <= 10) {
        formatSelector = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"';
        console.log(`[Download] 截圖品質: ${quality}（高畫質）→ 目標影片解析度: 1080p (退回 720p)`);
      } else {
        formatSelector = '"bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"';
        console.log(`[Download] 截圖品質: ${quality}（壓縮）→ 目標影片解析度: 720p (退回 480p)`);
      }

      const commandParts = [
        'yt-dlp',
        '-f', formatSelector,
        '--merge-output-format', 'mp4',
        '-o', `"${outputPath}"`,
        '--retries', '5',
        '--fragment-retries', '5',
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
        videoId,
      });
    } catch (error) {
      console.error('Download error:', error);

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
        videoUrl,
      });
    }
    }
  );

  /**
   * 使用 YouTube URL 直接分析影片（僅限公開影片）
   * POST /api/analyze-video-url
   * Body: { videoId: string, prompt: string, videoTitle: string }
   */
  router.post(
    '/analyze-video-url',
    validateBody({
      videoId: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
    }),
    async (req, res) => {
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

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      console.log('[Analyze URL] 正在生成 SEO 強化內容...');
      const fullPrompt = buildAnalysisPrompt(videoTitle, prompt, generateFullPrompt);

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: youtubeUrl } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });

      console.log('[Analyze URL] ✅ Gemini 分析完成!');
      const result = parseGeminiJson(response.text);
      console.log(`[Analyze URL] Generated: ${result.titleA}`);
      console.log(`========== 分析完成 ==========\n`);

      res.json({
        success: true,
        metadata: result,
        usedYouTubeUrl: true,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({
        error: 'Failed to analyze video via YouTube URL',
        details: error.message,
      });
    }
    }
  );

  /**
   * 使用 YouTube URL 直接分析影片（異步版本，適合手機端）
   * POST /api/analyze-video-url-async
   * Body: { videoId: string, prompt: string, videoTitle: string }
   */
  router.post(
    '/analyze-video-url-async',
    validateBody({
      videoId: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
    }),
    async (req, res) => {
    const { videoId, prompt, videoTitle } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    try {
      console.log(`\n========== 🤖 [異步] 使用 YouTube URL 分析影片 ==========`);
      console.log(`[Analyze URL Async] Video ID: ${videoId}`);
      console.log(`[Analyze URL Async] Video Title: ${videoTitle}`);

      const taskId = taskQueue.createTask('analyze-video-url', {
        videoId,
        prompt,
        videoTitle,
      });

      console.log(`[Analyze URL Async] Task created: ${taskId}`);
      res.json({ taskId });

      taskQueue.executeTask(taskId, async (taskId) => {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        taskQueue.updateTaskProgress(taskId, 10, '正在初始化 Gemini AI...');
        const aiClient = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: GEMINI_HTTP_OPTIONS,
        });

        taskQueue.updateTaskProgress(taskId, 30, '正在生成 SEO 強化內容...');
        const fullPrompt = buildAnalysisPrompt(videoTitle, prompt, generateFullPrompt);

        taskQueue.updateTaskProgress(taskId, 50, '正在使用 YouTube URL 分析影片...');
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { fileData: { fileUri: youtubeUrl } },
                { text: fullPrompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          },
        });

        taskQueue.updateTaskProgress(taskId, 90, '正在解析 Gemini 回應...');
        const result = parseGeminiJson(response.text);

        console.log(`[Analyze URL Async] ✅ 分析完成: ${result.titleA}`);

        return {
          success: true,
          metadata: result,
          usedYouTubeUrl: true,
        };
      });
    } catch (error) {
      console.error('[Analyze URL Async] Error:', error);
      res.status(500).json({
        error: 'Failed to create async analysis task',
        details: error.message,
      });
    }
    }
  );

  /**
   * 上傳影片到 Gemini 並生成 metadata（用於非公開影片）
   * POST /api/analyze-video
   * Body: { videoId: string, filePath?: string, prompt: string, videoTitle: string }
   */
  router.post(
    '/analyze-video',
    validateBody({
      videoId: { type: 'string' },
      filePath: { type: 'string', optional: true },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
    }),
    async (req, res) => {
    const { videoId, filePath, prompt, videoTitle } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    try {
      console.log(`\n========== 🤖 開始分析影片 ==========`);
      console.log(`[Analyze] Video ID: ${videoId}`);
      console.log(`[Analyze] File Path: ${filePath || '(not provided, will check Files API)'}`);
      console.log(`[Analyze] Video Title: ${videoTitle}`);

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      console.log('[Analyze] 步驟 1/4: 檢查 Files API 中是否已有此檔案...');
      const { file: uploadedFile, reusedFile } = await ensureGeminiFileActive({
        aiClient,
        displayName: videoId,
        filePath,
        mimeType: 'video/mp4',
        findFileByDisplayName,
        fs,
        logPrefix: '[Analyze] ',
      });

      if (reusedFile) {
        console.log(`[Analyze] ✅ 找到已存在的檔案，將重複使用！`);
        console.log(`[Analyze] File Name: ${uploadedFile.name}`);
        console.log(`[Analyze] Display Name: ${uploadedFile.displayName}`);
        console.log(`[Analyze] File URI: ${uploadedFile.uri}`);
        console.log(`[Analyze] 跳過上傳步驟，節省時間和流量！`);
      } else {
        console.log('[Analyze] 檔案不存在，需要上傳...');
        console.log(`[Analyze] ✅ 檔案已上傳`);
        console.log(`[Analyze] File Name (系統生成): ${uploadedFile.name}`);
        console.log(`[Analyze] Display Name (我們設定): ${uploadedFile.displayName}`);
        console.log(`[Analyze] File URI: ${uploadedFile.uri}`);
        console.log(`[Analyze] File State: ${uploadedFile.state}`);
      }

      console.log('[Analyze] 步驟 4/4: 正在生成 SEO 強化內容...');
      const fullPrompt = buildAnalysisPrompt(videoTitle, prompt, generateFullPrompt);

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: uploadedFile.uri, mimeType: 'video/mp4' } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });

      console.log('[Analyze] ✅ Gemini 分析完成!');
      const result = parseGeminiJson(response.text);
      console.log(`[Analyze] Generated: ${result.titleA}`);

      if (!reusedFile && filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Analyze] 🗑️  已刪除暫存檔案: ${filePath}`);
      }
      console.log(`========== 分析完成 ==========\n`);

      res.json({
        success: true,
        metadata: result,
        geminiFileName: uploadedFile.name,
        geminiFileUri: uploadedFile.uri,
      });
    } catch (error) {
      console.error('Analysis error:', error);

      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (error.message === 'File not found in Files API and no filePath provided for upload') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to analyze video',
        details: error.message,
      });
    }
    }
  );

  /**
   * 檢查 Gemini 檔案是否仍然存在並重新分析
   * POST /api/reanalyze-with-existing-file
   * Body: { geminiFileName: string, prompt: string, videoTitle: string }
   */
  router.post(
    '/reanalyze-with-existing-file',
    validateBody({
      geminiFileName: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
    }),
    async (req, res) => {
    const { geminiFileName, prompt, videoTitle } = req.body;

    if (!geminiFileName) {
      return res.status(400).json({ error: 'Missing geminiFileName' });
    }

    try {
      console.log(`Checking if Gemini file exists: ${geminiFileName}`);

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      let fileInfo;
      try {
        fileInfo = await aiClient.files.get({ name: geminiFileName });
      } catch (error) {
        console.log(`File not found or error: ${error.message}`);
        return res.status(404).json({ error: 'File not found', needsRedownload: true });
      }

      if (fileInfo.state === 'FAILED') {
        return res.status(404).json({ error: 'File processing failed', needsRedownload: true });
      }

      if (fileInfo.state !== 'ACTIVE') {
        return res.status(400).json({ error: 'File is not ready', state: fileInfo.state });
      }

      console.log(`✅ File found and active: ${fileInfo.uri}`);

      const fullPrompt = buildAnalysisPrompt(videoTitle, prompt, generateFullPrompt);

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: fileInfo.uri, mimeType: 'video/mp4' } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });

      const result = parseGeminiJson(response.text);

      res.json({
        success: true,
        metadata: result,
        geminiFileName: fileInfo.name,
        geminiFileUri: fileInfo.uri,
        reusedExistingFile: true,
      });
    } catch (error) {
      console.error('Reanalysis error:', error);
      res.status(500).json({
        error: 'Failed to reanalyze video',
        details: error.message,
      });
    }
    }
  );

  /**
   * 上傳參考檔案到 Gemini Files API
   * POST /api/gemini/upload-file
   * Content-Type: multipart/form-data
   * Body: FormData with 'file' field
   */
  router.post('/gemini/upload-file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`[Gemini Upload] 收到檔案上傳請求: ${req.file.originalname}`);
      console.log(`[Gemini Upload] 檔案大小: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Gemini Upload] MIME Type: ${req.file.mimetype}`);

      const filePath = req.file.path;

      const uploadedFile = await uploadGeminiFile(ai, filePath, {
        mimeType: req.file.mimetype,
        displayName: req.file.originalname,
      });

      console.log(`[Gemini Upload] ✅ 檔案上傳成功`);
      console.log(`[Gemini Upload] File Name: ${uploadedFile.name}`);
      console.log(`[Gemini Upload] File URI: ${uploadedFile.uri}`);
      console.log(`[Gemini Upload] File State: ${uploadedFile.state}`);

      if (uploadedFile.state === 'PROCESSING') {
        console.log('[Gemini Upload] ⏳ 等待 Gemini 處理檔案...');
        let attempts = 0;
        const maxAttempts = 30;
        let isActive = false;

        while (!isActive && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const fetchedFile = await ai.files.get({ name: uploadedFile.name });
            if (fetchedFile.state === 'ACTIVE') {
              isActive = true;
              console.log('[Gemini Upload] ✅ 檔案處理完成');
            } else if (fetchedFile.state === 'FAILED') {
              throw new Error('File processing failed');
            }
          } catch (error) {
            console.log(`[Gemini Upload] ⚠️  檢查狀態時發生錯誤: ${error.message}`);
          }
          attempts++;
        }

        if (!isActive) {
          throw new Error('File processing timeout');
        }
      }

      try {
        fs.unlinkSync(filePath);
        console.log(`[Gemini Upload] 🗑️  已刪除暫存檔案: ${filePath}`);
      } catch (err) {
        console.warn(`[Gemini Upload] ⚠️  無法刪除暫存檔案: ${err.message}`);
      }

      res.json({
        name: uploadedFile.name,
        uri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType,
        displayName: uploadedFile.displayName,
        sizeBytes: uploadedFile.sizeBytes,
      });
    } catch (error) {
      console.error('[Gemini Upload] Error:', error);

      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          // ignore
        }
      }

      res.status(500).json({
        error: 'Failed to upload file to Gemini',
        details: error.message,
      });
    }
  });

  /**
   * 從 Gemini Files API 刪除檔案
   * DELETE /api/gemini/file/:name
   */
  router.delete('/gemini/file/:name', async (req, res) => {
    try {
      const fileName = decodeURIComponent(req.params.name);
      console.log(`[Gemini Delete] 刪除檔案: ${fileName}`);

      await ai.files.delete({ name: fileName });

      console.log(`[Gemini Delete] ✅ 檔案已刪除`);
      res.json({ success: true });
    } catch (error) {
      console.error('[Gemini Delete] Error:', error);
      res.status(500).json({
        error: 'Failed to delete file from Gemini',
        details: error.message,
      });
    }
  });

  /**
   * 使用 YouTube URL 生成文章（僅限公開影片）
   * POST /api/generate-article-url
   * Body: { videoId: string, prompt: string, videoTitle: string, quality?: number }
   */
  router.post(
    '/generate-article-url',
    validateBody({
      videoId: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
      quality: { type: 'number', optional: true, allowStringNumber: true },
    }),
    async (req, res) => {
    const { videoId, prompt, videoTitle, quality = 2 } = req.body;

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

      console.log('[Article URL] Checking FFmpeg installation...');
      try {
        const { stdout } = await execAsync('ffmpeg -version');
        const version = stdout.split('\n')[0];
        console.log(`[Article URL] ✅ FFmpeg found: ${version}`);
      } catch (error) {
        console.error('[Article URL] ❌ FFmpeg not found');
        return res.status(500).json({
          error: 'FFmpeg is not installed. Please install it first.',
          details: 'Install FFmpeg: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Ubuntu)',
        });
      }

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      console.log('[Article URL] 步驟 1/3: 使用 YouTube URL 分析影片並生成文章...');
      const fullPrompt = buildArticlePrompt(videoTitle, prompt, generateArticlePrompt);

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: youtubeUrl } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      let result;
      try {
        const responseText = response.text;
        console.log(`[Article URL] ✅ Gemini 回應長度: ${responseText.length} 字元`);
        result = parseGeminiJson(responseText, {
          requiredFields: ['titleA', 'titleB', 'titleC', 'article_text', 'screenshots'],
        });

        console.log(`[Article URL] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
        console.log(`[Article URL] 標題 A: ${result.titleA}`);
        console.log(`[Article URL] 截圖規劃已生成，等待使用者手動觸發截圖`);
      } catch (parseError) {
        console.error('[Article URL] ❌ JSON parsing error:', parseError.message);
        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

      console.log(`========== 文章生成完成 ==========\n`);

      res.json({
        success: true,
        titleA: result.titleA,
        titleB: result.titleB,
        titleC: result.titleC,
        article: result.article_text,
        seo_description: result.seo_description,
        image_urls: [],
        screenshots: result.screenshots,
        videoId,
        usedYouTubeUrl: true,
        needsScreenshots: true,
        screenshotsCount: result.screenshots.length,
      });
    } catch (error) {
      console.error('Article generation error:', error);

      res.status(500).json({
        error: 'Failed to generate article via YouTube URL',
        details: error.message,
      });
    }
    }
  );

  /**
   * 使用 YouTube URL 生成文章（異步版本，適合手機端）
   * POST /api/generate-article-url-async
   * Body: { videoId: string, prompt: string, videoTitle: string, quality?: number }
   */
  router.post(
    '/generate-article-url-async',
    validateBody({
      videoId: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
      quality: { type: 'number', optional: true, allowStringNumber: true },
      uploadedFiles: { type: 'array', optional: true, elementType: 'object' },
      accessToken: { type: 'string', optional: true },
      templateId: { type: 'string', optional: true },
      referenceUrls: { type: 'array', optional: true, elementType: 'string' },
      referenceVideos: { type: 'array', optional: true, elementType: 'string' },
    }),
    async (req, res) => {
    const {
      videoId,
      prompt,
      videoTitle,
      quality = 2,
      uploadedFiles = [],
      accessToken,
      templateId = 'default',
      referenceUrls = [],
      referenceVideos = [],
    } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    try {
      const taskId = taskQueue.createTask('generate-article-url', {
        videoId,
        prompt,
        videoTitle,
        quality,
        uploadedFiles,
        accessToken,
        templateId,
        referenceUrls,
        referenceVideos,
      });

      res.json({
        success: true,
        taskId,
        message: '任務已建立，請使用 taskId 查詢進度',
      });

      taskQueue.executeTask(taskId, async (taskId) => {
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

        try {
          const { stdout } = await execAsync('ffmpeg -version');
          const version = stdout.split('\n')[0];
          console.log(`[Article URL] ✅ FFmpeg found: ${version}`);
        } catch (error) {
          throw new Error('FFmpeg is not installed. Please install it first.');
        }

        taskQueue.updateTaskProgress(taskId, 20, '初始化 Gemini AI...');

        const aiClient = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: GEMINI_HTTP_OPTIONS,
        });

        taskQueue.updateTaskProgress(taskId, 30, '使用 YouTube URL 分析影片並生成文章...');
        console.log('[Article URL] 步驟 1/3: 使用 YouTube URL 分析影片並生成文章...');

        const { generateArticlePromptWithReferences } = await import('../services/server/articlePromptService.js');

        const references = {
          uploadedFiles: uploadedFiles || [],
          referenceVideos: referenceVideos || [],
          referenceUrls: referenceUrls || [],
        };

        const fullPrompt = await buildArticlePromptWithReferences({
          subject: videoTitle,
          prompt,
          references,
          templateId,
          mode: 'video',
          generateArticlePromptWithReferences,
        });

        const parts = [
          { fileData: { fileUri: youtubeUrl } },
        ];

        if (uploadedFiles.length > 0) {
          console.log(`[Article URL] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
          for (const file of uploadedFiles) {
            console.log(`[Article URL] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
            parts.push({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri,
              },
            });
          }
        }

        if (referenceVideos && referenceVideos.length > 0) {
          console.log(`[Article URL] 📎 參考影片: ${referenceVideos.length} 個`);
          for (const videoUrl of referenceVideos) {
            console.log(`[Article URL] 加入參考影片: ${videoUrl}`);
            parts.push({ fileData: { fileUri: videoUrl } });
          }
        }

        if (referenceUrls && referenceUrls.length > 0) {
          console.log(`[Article URL] 📎 參考網址: ${referenceUrls.length} 個`);
        }

        const finalPrompt = appendJsonInstruction(fullPrompt);
        parts.push({ text: finalPrompt });

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

        let response;
        let attempts = 0;
        const maxAttempts = 3;

        const geminiConfig = {};

        if (referenceUrls && referenceUrls.length > 0) {
          geminiConfig.tools = [{ urlContext: {} }];
          console.log(`[Article URL] 🔧 已啟用 URL Context 工具（無法使用 responseMimeType）`);
        } else {
          geminiConfig.responseMimeType = 'application/json';
        }

        while (attempts < maxAttempts) {
          try {
            response = await aiClient.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  role: 'user',
                  parts: parts,
                },
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
          const responseText = response.text;
          console.log(`[Article URL] ✅ Gemini 回應長度: ${responseText.length} 字元`);

          if (referenceUrls && referenceUrls.length > 0) {
            console.log(`[Article URL] 🔍 使用工具模式，嘗試提取 JSON...`);
          }

          result = parseGeminiJson(responseText, {
            requiredFields: ['titleA', 'titleB', 'titleC', 'article_text', 'screenshots'],
          });

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
          videoId: videoId,
        };
      });
    } catch (error) {
      console.error('Task creation error:', error);
      res.status(500).json({
        error: 'Failed to create task',
        details: error.message,
      });
    }
    }
  );

  /**
   * 手動執行截圖（使用者觸發）
   * POST /api/capture-screenshots
   * Body: { videoId: string, screenshots: array, quality?: number }
   */
  router.post(
    '/capture-screenshots',
    validateBody({
      videoId: { type: 'string' },
      screenshots: { type: 'array' },
      quality: { type: 'number', optional: true, allowStringNumber: true },
    }),
    async (req, res) => {
    const { videoId, screenshots, quality = 2 } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    if (!screenshots || !Array.isArray(screenshots)) {
      return res.status(400).json({ error: 'Missing or invalid screenshots array' });
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(DOWNLOAD_DIR, `${videoId}.mp4`);

    try {
      console.log(`\n========== 📸 開始執行截圖 ==========`);
      console.log(`[Capture Screenshots] Video ID: ${videoId}`);
      console.log(`[Capture Screenshots] 截圖數量: ${screenshots.length}`);
      console.log(`[Capture Screenshots] 截圖品質: ${quality}`);

      try {
        await execAsync('ffmpeg -version');
      } catch (error) {
        return res.status(500).json({
          error: 'FFmpeg is not installed',
          details: 'Please install FFmpeg first',
        });
      }

      if (!fs.existsSync(outputPath)) {
        console.log('[Capture Screenshots] 影片尚未下載，開始下載...');

        let formatSelector;
        if (quality <= 10) {
          formatSelector = '"bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"';
        } else {
          formatSelector = '"bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"';
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
        await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

        if (!fs.existsSync(outputPath)) {
          throw new Error('Video download failed');
        }

        console.log('[Capture Screenshots] ✅ 影片下載完成');
      } else {
        console.log('[Capture Screenshots] 使用已存在的影片檔案');
      }

      console.log('[Capture Screenshots] 開始截取畫面...');
      const imageUrls = [];

      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const timestamp = screenshot.timestamp_seconds;
        const currentSeconds = timeToSeconds(timestamp);

        const screenshotGroup = [];
        const offsets = [
          { offset: -2, label: 'before' },
          { offset: 0, label: 'current' },
          { offset: 2, label: 'after' },
        ];

        console.log(`[Capture Screenshots] 截圖組 ${i + 1}/${screenshots.length} - 時間點: ${timestamp}`);

        for (const { offset, label } of offsets) {
          const targetSeconds = Math.max(0, currentSeconds + offset);
          const targetTime = secondsToTime(targetSeconds);
          const outputFilename = `${videoId}_screenshot_${i}_${label}_${targetTime.replace(':', '-')}.jpg`;
          const screenshotPath = path.join(IMAGES_DIR, outputFilename);

          try {
            await captureScreenshot(outputPath, targetSeconds, screenshotPath, quality);
            screenshotGroup.push(`/images/${outputFilename}`);
            console.log(`[Capture Screenshots] ✅ 截圖已儲存: ${outputFilename}`);
          } catch (error) {
            console.error(`[Capture Screenshots] ❌ 截圖失敗:`, error.message);
          }
        }

        if (screenshotGroup.length > 0) {
          imageUrls.push(screenshotGroup);
        }
      }

      console.log(`[Capture Screenshots] ✅ 截圖完成，共 ${imageUrls.length} 組`);
      console.log(`========== 截圖完成 ==========\n`);

      res.json({
        success: true,
        image_urls: imageUrls,
        screenshotsCount: imageUrls.length,
      });
    } catch (error) {
      console.error('[Capture Screenshots] Error:', error);
      res.status(500).json({
        error: 'Failed to capture screenshots',
        details: error.message,
      });
    }
    }
  );

  /**
   * 從任意 URL 生成文章（異步版本）
   * POST /api/generate-article-from-url-async
   * Body: { url: string, prompt: string, uploadedFiles?: any[], templateId?: string, referenceUrls?: string[], referenceVideos?: string[] }
   */
  router.post(
    '/generate-article-from-url-async',
    validateBody({
      url: { type: 'string' },
      prompt: { type: 'string' },
      uploadedFiles: { type: 'array', optional: true, elementType: 'object' },
      templateId: { type: 'string', optional: true },
      referenceUrls: { type: 'array', optional: true, elementType: 'string' },
      referenceVideos: { type: 'array', optional: true, elementType: 'string' },
    }),
    async (req, res) => {
    const {
      url,
      prompt,
      uploadedFiles = [],
      templateId = 'default',
      referenceUrls = [],
      referenceVideos = [],
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }

    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
      const taskId = taskQueue.createTask('generate-article-from-url', {
        url,
        prompt,
        uploadedFiles,
        templateId,
        referenceUrls,
        referenceVideos,
      });

      res.json({
        success: true,
        taskId,
        message: '任務已建立，請使用 taskId 查詢進度',
      });

      taskQueue.executeTask(taskId, async (taskId) => {
        console.log(`\n========== 📝 [Task ${taskId}] 使用純網址生成文章 ==========`);
        console.log(`[Article URL-Only] URL: ${url}`);
        console.log(`[Article URL-Only] Template: ${templateId}`);

        if (uploadedFiles.length > 0) {
          console.log(`[Article URL-Only] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
        }

        taskQueue.updateTaskProgress(taskId, 20, '初始化 Gemini AI...');

        const aiClient = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: GEMINI_HTTP_OPTIONS,
        });

        taskQueue.updateTaskProgress(taskId, 30, '使用 URL Context 工具分析網址並生成文章...');
        console.log('[Article URL-Only] 使用 URL Context 工具分析網址並生成文章...');

        const { generateArticlePromptWithReferences } = await import('../services/server/articlePromptService.js');

        const references = {
          uploadedFiles: uploadedFiles || [],
          referenceVideos: referenceVideos || [],
          referenceUrls: referenceUrls || [],
        };

        const fullPrompt = await buildArticlePromptWithReferences({
          subject: url,
          prompt,
          references,
          templateId,
          mode: 'url',
          generateArticlePromptWithReferences,
        });

        const parts = [];

        if (uploadedFiles.length > 0) {
          console.log(`[Article URL-Only] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
          for (const file of uploadedFiles) {
            console.log(`[Article URL-Only] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
            parts.push({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri,
              },
            });
          }
        }

        if (referenceVideos && referenceVideos.length > 0) {
          console.log(`[Article URL-Only] 📎 參考影片: ${referenceVideos.length} 個`);
          for (const videoUrl of referenceVideos) {
            console.log(`[Article URL-Only] 加入參考影片: ${videoUrl}`);
            parts.push({ fileData: { fileUri: videoUrl } });
          }
        }

        console.log(`[Article URL-Only] 📎 參考網址總數: ${referenceUrls.length} 個`);
        referenceUrls.forEach((url, index) => {
          console.log(`[Article URL-Only]   ${index + 1}. ${url}`);
        });

        const finalPrompt = appendJsonInstruction(fullPrompt);
        parts.push({ text: finalPrompt });

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

        let response;
        let attempts = 0;
        const maxAttempts = 3;

        const geminiConfig = {
          tools: [{ urlContext: {} }],
        };
        console.log(`[Article URL-Only] 🔧 已啟用 URL Context 工具`);

        while (attempts < maxAttempts) {
          try {
            response = await aiClient.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  role: 'user',
                  parts: parts,
                },
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
          const responseText = response.text;
          console.log(`[Article URL-Only] ✅ Gemini 回應長度: ${responseText.length} 字元`);

          console.log(`[Article URL-Only] 🔍 使用工具模式，嘗試提取 JSON...`);

          result = parseGeminiJson(responseText, {
            requiredFields: ['titleA', 'titleB', 'titleC', 'article_text'],
            preferLastObject: true,
          });

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
          videoId: null,
        };
      });
    } catch (error) {
      console.error('Task creation error:', error);
      res.status(500).json({
        error: 'Failed to create task',
        details: error.message,
      });
    }
    }
  );

  /**
   * 生成文章與截圖（用於非公開影片）
   * POST /api/generate-article
   * Body: { videoId: string, filePath: string, prompt: string, videoTitle: string, quality?: number }
   */
  router.post(
    '/generate-article',
    validateBody({
      videoId: { type: 'string' },
      filePath: { type: 'string', optional: true },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
      templateId: { type: 'string', optional: true },
      referenceUrls: { type: 'array', optional: true, elementType: 'string' },
      uploadedFiles: { type: 'array', optional: true, elementType: 'object' },
      referenceVideos: { type: 'array', optional: true, elementType: 'string' },
    }),
    async (req, res) => {
    const { videoId, filePath, prompt, videoTitle, templateId = 'default', referenceUrls = [], uploadedFiles = [], referenceVideos = [] } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    try {
      console.log(`\n========== 📝 開始生成文章（未公開影片）==========`);
      console.log(`[Article] Video ID: ${videoId}`);
      console.log(`[Article] File Path: ${filePath || '(not provided, will check Files API)'}`);
      console.log(`[Article] Video Title: ${videoTitle}`);

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      console.log('[Article] 步驟 1/5: 檢查 Files API 中是否已有此檔案...');
      const { file: uploadedFile, reusedFile } = await ensureGeminiFileActive({
        aiClient,
        displayName: videoId,
        filePath,
        mimeType: 'video/mp4',
        findFileByDisplayName,
        fs,
        logPrefix: '[Article] ',
      });

      if (reusedFile) {
        console.log(`[Article] ✅ 找到已存在的檔案，將重複使用！`);
        console.log(`[Article] File Name: ${uploadedFile.name}`);
        console.log(`[Article] Display Name: ${uploadedFile.displayName}`);
        console.log(`[Article] File URI: ${uploadedFile.uri}`);
        console.log(`[Article] 跳過上傳步驟，節省時間和流量！`);
      } else {
        console.log('[Article] 檔案不存在於 Files API，需要上傳...');
        console.log('[Article] 步驟 2/5: 正在上傳影片到 Gemini...');
        console.log(`[Article] ✅ 檔案已上傳`);
        console.log(`[Article] File Name (系統生成): ${uploadedFile.name}`);
        console.log(`[Article] Display Name (我們設定): ${uploadedFile.displayName}`);
        console.log(`[Article] File URI: ${uploadedFile.uri}`);
        console.log(`[Article] File State: ${uploadedFile.state}`);
      }

      console.log(reusedFile ? '[Article] 步驟 3/4: 正在生成文章內容與截圖時間點...' : '[Article] 步驟 4/5: 正在生成文章內容與截圖時間點...');

      const { generateArticlePromptWithReferences } = await import('../services/server/articlePromptService.js');

      const references = {
        uploadedFiles: uploadedFiles || [],
        referenceVideos: referenceVideos || [],
        referenceUrls: referenceUrls || [],
      };

      const fullPrompt = await buildArticlePromptWithReferences({
        subject: videoTitle,
        prompt,
        references,
        templateId,
        mode: 'video',
        generateArticlePromptWithReferences,
      });

      const geminiConfig = {};

      if (referenceUrls && referenceUrls.length > 0) {
        geminiConfig.tools = [{ urlContext: {} }];
        console.log(`[Article] 🔧 已啟用 URL Context 工具（無法使用 responseMimeType）`);
      } else {
        geminiConfig.responseMimeType = 'application/json';
      }

      const parts = [
        { fileData: { fileUri: uploadedFile.uri, mimeType: 'video/mp4' } },
      ];

      if (uploadedFiles.length > 0) {
        console.log(`[Article] 📎 上傳的參考檔案: ${uploadedFiles.length} 個`);
        for (const file of uploadedFiles) {
          console.log(`[Article] 加入參考檔案: ${file.displayName} (${file.mimeType})`);
          parts.push({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri,
            },
          });
        }
      }

      if (referenceVideos && referenceVideos.length > 0) {
        console.log(`[Article] 📎 參考影片: ${referenceVideos.length} 個`);
        for (const videoUrl of referenceVideos) {
          console.log(`[Article] 加入參考影片: ${videoUrl}`);
          parts.push({ fileData: { fileUri: videoUrl } });
        }
      }

      if (referenceUrls && referenceUrls.length > 0) {
        console.log(`[Article] 📎 參考網址: ${referenceUrls.length} 個`);
      }

      const finalPrompt = appendJsonInstruction(fullPrompt);
      parts.push({ text: finalPrompt });

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

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: parts,
          },
        ],
        config: geminiConfig,
      });

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
        const responseText = response.text;
        console.log(`[Article] ✅ Gemini 回應長度: ${responseText.length} 字元`);
        console.log(`[Article] 回應預覽: ${responseText.substring(0, 150)}...`);

        if (referenceUrls && referenceUrls.length > 0) {
          console.log(`[Article] 🔍 使用工具模式，嘗試提取 JSON...`);
        }

        result = parseGeminiJson(responseText, {
          requiredFields: ['titleA', 'titleB', 'titleC', 'article_text', 'screenshots'],
        });

        console.log(`[Article] ✅ 文章生成成功! 找到 ${result.screenshots.length} 個截圖時間點`);
        console.log(`[Article] 標題 A: ${result.titleA}`);
      } catch (parseError) {
        console.error('[Article] ❌ JSON parsing error:', parseError.message);
        console.error('[Article] 回應內容:', response.text.substring(0, 500));

        const lines = response.text.split('\n');
        console.error(`[Article] Response has ${lines.length} lines`);

        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

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
        image_urls: [],
        screenshots: result.screenshots,
        needsScreenshots: true,
        videoId: videoId,
        geminiFileName: uploadedFile.name,
        geminiFileUri: uploadedFile.uri,
      });
    } catch (error) {
      console.error('Article generation error:', error);

      if (error.message === 'File not found in Files API and no filePath provided for upload') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to generate article',
        details: error.message,
      });
    }
    }
  );

  /**
   * 使用現有 Gemini 檔案重新生成文章
   * POST /api/regenerate-article
   * Body: { videoId: string, geminiFileName: string, prompt: string, videoTitle: string }
   */
  router.post(
    '/regenerate-article',
    validateBody({
      videoId: { type: 'string' },
      geminiFileName: { type: 'string' },
      prompt: { type: 'string' },
      videoTitle: { type: 'string' },
    }),
    async (req, res) => {
    const { videoId, geminiFileName, prompt, videoTitle } = req.body;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Missing or invalid videoId format' });
    }

    if (!geminiFileName) {
      return res.status(400).json({ error: 'Missing required parameter: geminiFileName' });
    }

    try {
      console.log(`Regenerating article using existing file: ${geminiFileName}`);

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      let fileInfo;
      try {
        fileInfo = await aiClient.files.get({ name: geminiFileName });
      } catch (error) {
        console.log(`File not found: ${error.message}`);
        return res.status(404).json({
          error: 'File not found in Gemini',
          needsRedownload: true,
        });
      }

      if (fileInfo.state !== 'ACTIVE') {
        return res.status(400).json({
          error: 'File is not ready',
          state: fileInfo.state,
        });
      }

      console.log(`✅ File found and active: ${fileInfo.uri}`);

      const fullPrompt = buildArticlePrompt(videoTitle, prompt, generateArticlePrompt);

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: fileInfo.uri, mimeType: 'video/mp4' } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });

      let result;
      try {
        const responseText = response.text;
        console.log('Response length:', responseText.length);
        console.log('Response preview:', responseText.substring(0, 200));

        result = parseGeminiJson(responseText, {
          requiredFields: ['titleA', 'titleB', 'titleC', 'article_text', 'screenshots'],
        });

        console.log(`Article regenerated successfully. Found ${result.screenshots.length} screenshots.`);
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError.message);
        console.error('Full response text:', response.text);

        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

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
        note: 'Screenshots not captured. Please re-download video to generate screenshots.',
      });
    } catch (error) {
      console.error('Article regeneration error:', error);
      res.status(500).json({
        error: 'Failed to regenerate article',
        details: error.message,
      });
    }
    }
  );

  /**
   * 重新生成截圖（讓 Gemini 重新看影片並提供新的截圖建議）
   * POST /api/regenerate-screenshots
   * Body: { videoId: string, videoTitle: string, filePath: string, prompt?: string, quality?: number }
   */
  router.post(
    '/regenerate-screenshots',
    validateBody({
      videoId: { type: 'string' },
      videoTitle: { type: 'string' },
      filePath: { type: 'string' },
      prompt: { type: 'string', optional: true },
      quality: { type: 'number', optional: true, allowStringNumber: true },
    }),
    async (req, res) => {
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

      const aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: GEMINI_HTTP_OPTIONS,
      });

      console.log('[Regenerate Screenshots] 步驟 1/4: 檢查 Files API 中是否已有此檔案...');
      const { file: uploadedFile, reusedFile } = await ensureGeminiFileActive({
        aiClient,
        displayName: videoId,
        filePath,
        mimeType: 'video/mp4',
        findFileByDisplayName,
        fs,
        logPrefix: '[Regenerate Screenshots] ',
        preserveLocalFile: true,
      });

      if (reusedFile) {
        console.log('[Regenerate Screenshots] ✅ 找到已存在的檔案');
      } else {
        console.log('[Regenerate Screenshots] 檔案不存在，需要重新上傳...');
      }

      console.log('[Regenerate Screenshots] 步驟 2/4: 生成截圖時間點...');
      const fullPrompt = buildArticlePrompt(
        videoTitle,
        prompt || '請提供新的截圖時間點建議',
        generateArticlePrompt
      );

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri: uploadedFile.uri, mimeType: 'video/mp4' } },
              { text: fullPrompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      let result;
      try {
        result = parseGeminiJson(response.text);
      } catch (parseError) {
        console.error('[Regenerate Screenshots] ❌ JSON parsing error:', parseError.message);
        throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${parseError.message}`);
      }

      res.json({
        success: true,
        screenshots: result.screenshots || [],
      });
    } catch (error) {
      console.error('[Regenerate Screenshots] Error:', error);
      res.status(500).json({
        error: 'Failed to regenerate screenshots',
        details: error.message,
      });
    }
    }
  );

  /**
   * 檢查是否已有指定影片檔案
   * GET /api/check-file/:videoId
   */
  router.get(
    '/check-file/:videoId',
    validateParams({
      videoId: { type: 'string' },
    }),
    async (req, res) => {
    const { videoId } = req.params;

    if (!videoId || !isValidVideoId(videoId)) {
      return res.status(400).json({ error: 'Invalid videoId format' });
    }

    try {
      const files = await ai.files.list();
      const list = files.pageInternal || [];
      const matchingFile = list.find(file => file.displayName === videoId);

      if (matchingFile) {
        if (matchingFile.state === 'ACTIVE' || matchingFile.state === 'PROCESSING') {
          return res.json({
            exists: true,
            processing: matchingFile.state === 'PROCESSING',
            file: {
              name: matchingFile.name,
              state: matchingFile.state,
              displayName: matchingFile.displayName,
            },
          });
        }

        return res.json({
          exists: false,
          reason: `File exists but state is ${matchingFile.state}`,
        });
      }

      console.log(`[Check File] ❌ No file found for videoId: ${videoId}`);
      res.json({ exists: false });
    } catch (error) {
      console.error('[Check File] Error:', error);
      res.status(500).json({
        error: 'Failed to check file',
        details: error.message,
      });
    }
    }
  );

  /**
   * 清理暫存檔案
   * DELETE /api/cleanup/:videoId
   */
  router.delete(
    '/cleanup/:videoId',
    validateParams({
      videoId: { type: 'string' },
    }),
    (req, res) => {
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
    }
  );

  return router;
}
