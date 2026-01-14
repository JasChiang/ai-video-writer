import { Router } from 'express';

export function createAiModelsRouter({ aiManager }) {
  const router = Router();

  /**
   * 獲取可用的 AI 模型列表
   * GET /api/ai-models/available
   */
  router.get('/available', async (_req, res) => {
    try {
      const models = aiManager.getAvailableModels();

      res.json({
        success: true,
        models,
        count: models.length,
      });
    } catch (error) {
      console.error('[AI Models] 獲取模型列表失敗:', error);
      res.status(500).json({
        success: false,
        error: '獲取模型列表失敗',
        details: error.message,
      });
    }
  });

  /**
   * 檢查特定模型狀態
   * GET /api/ai-models/:modelId/status
   */
  router.get('/:modelId/status', async (req, res) => {
    try {
      const { modelId } = req.params;
      const status = await aiManager.getModelStatus(modelId);

      res.json({
        success: true,
        modelId,
        status,
      });
    } catch (error) {
      console.error('[AI Models] 檢查模型狀態失敗:', error);
      res.status(500).json({
        success: false,
        error: '檢查模型狀態失敗',
        details: error.message,
      });
    }
  });

  /**
   * 獲取推薦模型
   * GET /api/ai-models/recommend?analysisType=subscriber-growth
   */
  router.get('/recommend', (req, res) => {
    try {
      const { analysisType } = req.query;

      if (!analysisType) {
        return res.status(400).json({
          success: false,
          error: '缺少 analysisType 參數',
        });
      }

      const recommendedModel = aiManager.getRecommendedModel(analysisType);

      if (!recommendedModel) {
        return res.status(404).json({
          success: false,
          error: '沒有可用的推薦模型',
          suggestion: '請檢查 API Key 配置',
        });
      }

      res.json({
        success: true,
        analysisType,
        recommendedModel,
      });
    } catch (error) {
      console.error('[AI Models] 獲取推薦模型失敗:', error);
      res.status(500).json({
        success: false,
        error: '獲取推薦模型失敗',
        details: error.message,
      });
    }
  });

  return router;
}
