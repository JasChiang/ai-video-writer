import { Router } from 'express';
import { aggregateChannelData, clearAnalyticsCache } from '../services/server/channelAnalyticsService.js';
import { analyzeDurationPerformance } from '../services/server/durationAnalysisService.js';

export function createChannelAnalyticsRouter() {
  const router = Router();

  /**
   * 頻道數據聚合（支援關鍵字過濾和多個日期範圍）
   * POST /api/channel-analytics/aggregate
   */
  router.post('/aggregate', async (req, res) => {
    try {
      const { accessToken, channelId, keywordGroups, dateRanges, isOwnChannel = true } = req.body;

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

      console.log('\n========== 📊 開始聚合頻道數據 ==========');
      console.log(`[Channel Analytics] 頻道 ID: ${channelId}`);
      console.log(`[Channel Analytics] 模式: ${isOwnChannel ? '我的頻道' : '競爭對手分析'}`);
      console.log(`[Channel Analytics] 關鍵字組合數: ${keywordGroups.length}`);
      console.log(`[Channel Analytics] 日期範圍數: ${dateRanges.length}`);

      const result = await aggregateChannelData(
        accessToken,
        channelId,
        keywordGroups,
        dateRanges,
        isOwnChannel
      );

      console.log('[Channel Analytics] ✅ 數據聚合完成');
      res.json(result);
    } catch (error) {
      console.error('[Channel Analytics] ❌ 數據聚合失敗:', error);
      res.status(500).json({
        error: error.message || '數據聚合失敗',
        details: error.toString(),
      });
    }
  });

  /**
   * 清除數據聚合快取
   * POST /api/channel-analytics/clear-cache
   */
  router.post('/clear-cache', (_req, res) => {
    try {
      const result = clearAnalyticsCache();
      res.json({
        success: true,
        message: `已清除 ${result.cleared} 筆快取`,
        cleared: result.cleared,
      });
    } catch (error) {
      console.error('[Channel Analytics] ❌ 清除快取失敗:', error);
      res.status(500).json({
        error: error.message || '清除快取失敗',
      });
    }
  });

  /**
   * 影片時長表現分析
   * POST /api/channel-analytics/duration-analysis
   */
  router.post('/duration-analysis', async (req, res) => {
    try {
      const { accessToken, channelId, dateRanges, isOwnChannel = true } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: '缺少 accessToken' });
      }

      if (!channelId) {
        return res.status(400).json({ error: '缺少 channelId' });
      }

      if (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0) {
        return res.status(400).json({ error: '缺少 dateRanges 或格式錯誤' });
      }

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

      console.log('\n========== 📊 開始影片時長分析 ==========');
      console.log(`[Duration Analysis] 頻道 ID: ${channelId}`);
      console.log(`[Duration Analysis] 模式: ${isOwnChannel ? '我的頻道' : '競爭對手分析'}`);
      console.log(`[Duration Analysis] 日期範圍數: ${dateRanges.length}`);

      const result = await analyzeDurationPerformance(
        accessToken,
        channelId,
        dateRanges,
        isOwnChannel
      );

      console.log('[Duration Analysis] ✅ 時長分析完成');
      res.json(result);
    } catch (error) {
      console.error('[Duration Analysis] ❌ 時長分析失敗:', error);
      res.status(500).json({
        error: error.message || '時長分析失敗',
        details: error.toString(),
      });
    }
  });

  return router;
}
