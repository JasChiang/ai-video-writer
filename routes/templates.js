import { Router } from 'express';
import {
  enableArticleTemplates,
  disableArticleTemplates,
  refreshArticleTemplates,
  getArticleTemplateStatus,
  listAvailableArticleTemplates,
} from '../services/server/articlePromptService.js';

export function createTemplatesRouter() {
  const router = Router();

  /**
   * 啟用模板功能
   * POST /api/templates/enable
   */
  router.post('/enable', async (_req, res) => {
    try {
      await enableArticleTemplates();
      const status = getArticleTemplateStatus();
      res.json({
        success: true,
        message: 'Custom templates enabled',
        usingCustomTemplates: status.usingCustomTemplates,
        lastLoadedAt: status.lastLoadedAt,
      });
    } catch (error) {
      console.error('[Templates] Enable error:', error);
      res.status(500).json({
        error: 'Failed to enable templates',
        details: error.message,
      });
    }
  });

  /**
   * 停用模板功能
   * POST /api/templates/disable
   */
  router.post('/disable', (_req, res) => {
    try {
      disableArticleTemplates();
      res.json({ success: true, message: 'Custom templates disabled' });
    } catch (error) {
      console.error('[Templates] Disable error:', error);
      res.status(500).json({
        error: 'Failed to disable templates',
        details: error.message,
      });
    }
  });

  /**
   * 重新載入模板
   * POST /api/templates/refresh
   */
  router.post('/refresh', async (_req, res) => {
    try {
      const result = await refreshArticleTemplates();
      res.json({ success: true, message: 'Templates refreshed', ...result });
    } catch (error) {
      console.error('[Templates] Refresh error:', error);
      res.status(500).json({
        error: 'Failed to refresh templates',
        details: error.message,
      });
    }
  });

  /**
   * 查詢模板狀態
   * GET /api/templates/status
   */
  router.get('/status', (_req, res) => {
    try {
      const status = getArticleTemplateStatus();
      res.json(status);
    } catch (error) {
      console.error('[Templates] Status error:', error);
      res.status(500).json({
        error: 'Failed to get template status',
        details: error.message,
      });
    }
  });

  /**
   * 列出可用模板
   * GET /api/templates
   */
  router.get('/', async (_req, res) => {
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
      console.error('[Templates] List error:', error);
      res.status(500).json({
        error: 'Failed to list templates',
        details: error.message,
      });
    }
  });

  return router;
}
