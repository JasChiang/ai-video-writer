import { Router } from 'express';
import { fetchAllVideoTitles, uploadToGist, searchVideosFromCache } from '../services/server/videoCacheService.js';

export function createVideoCacheRouter() {
  const router = Router();

  /**
   * API: 生成並上傳影片快取到 Gist
   * POST /api/video-cache/generate
   */
  router.post('/generate', async (req, res) => {
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
   * 影片快取搜尋 API
   * GET /api/video-cache/search
   * Query params: query, maxResults
   */
  router.get('/search', async (req, res) => {
    try {
      const { query, maxResults = 10000 } = req.query;
      const gistId = process.env.GITHUB_GIST_ID;
      const gistToken = process.env.GITHUB_GIST_TOKEN || null;

      console.log('[API] 🔍 收到快取搜尋請求');
      console.log(`[API] 🆔 Gist ID: ${gistId || '(未設定)'}`);
      console.log(`[API] 🔑 搜尋關鍵字: ${query || '(無)'}`);
      console.log(`[API] 📊 最大結果數: ${maxResults}`);

      if (!gistId) {
        console.log('[API] ❌ 缺少 GITHUB_GIST_ID 環境變數');
        return res.status(400).json({
          error: '缺少 GITHUB_GIST_ID 環境變數',
          videos: [],
        });
      }

      const videos = await searchVideosFromCache(
        gistId,
        query || '',
        parseInt(maxResults) || 10000,
        gistToken
      );

      console.log(`[API] ✅ 搜尋完成，返回 ${videos.length} 筆結果`);

      res.json({
        success: true,
        query: query || '',
        totalResults: videos.length,
        videos: videos,
      });
    } catch (error) {
      console.error('[API] ❌ 快取搜尋錯誤:', error.message);
      res.status(500).json({
        error: error.message || '搜尋影片快取失敗',
        videos: [],
      });
    }
  });

  return router;
}
