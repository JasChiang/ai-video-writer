import { Router } from 'express';
import { PromptTemplates } from '../services/server/analysisPrompts/PromptTemplates.js';

export function createAiAnalysisRouter({ aiManager, getMaxTokensForModel }) {
  const router = Router();

  /**
   * AI 頻道分析（支援多模型、多分析類型）
   * POST /api/analyze-channel
   */
  router.post('/analyze-channel', async (req, res) => {
    const {
      startDate,
      endDate,
      channelId,
      videos,
      channelStats,
      analytics,
      modelType = 'gemini-2.5-flash', // 默認使用 Gemini Flash
      analysisType = 'comprehensive', // 默認使用綜合分析
    } = req.body;

    // 驗證輸入
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Missing startDate or endDate' });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'Missing or invalid videos array' });
    }

    try {
      console.log(`\n========== 📊 開始分析頻道表現 ==========`);
      console.log(`[Channel Analysis] 模型: ${modelType}`);
      console.log(`[Channel Analysis] 分析類型: ${analysisType}`);
      console.log(`[Channel Analysis] 日期範圍: ${startDate} ~ ${endDate}`);
      console.log(`[Channel Analysis] 影片數量: ${videos.length}`);

      // 生成分析 Prompt
      const prompt = PromptTemplates.generatePrompt({
        type: analysisType,
        dateRange: { startDate, endDate },
        channelStats,
        videos,
        analytics,
      });

      console.log('[Channel Analysis] 📤 發送請求到 AI 模型...');

      // 使用 AI 模型管理器進行分析
      const response = await aiManager.analyze(modelType, {
        prompt,
        temperature: 0.7,
        maxTokens: getMaxTokensForModel(modelType),
      });

      console.log('[Channel Analysis] ✅ 分析完成');
      console.log(`[Channel Analysis] 模型: ${response.model}`);
      console.log(`[Channel Analysis] 提供者: ${response.provider}`);
      console.log(
        `[Channel Analysis] Token 使用: ${response.usage?.totalTokens || 'N/A'}`
      );
      if (response.cost) {
        console.log(`[Channel Analysis] 成本: $${response.cost.toFixed(6)}`);
      }
      console.log(`[Channel Analysis] 結果長度: ${response.text.length} 字元`);

      res.json({
        success: true,
        analysis: response.text,
        metadata: {
          model: response.model,
          provider: response.provider,
          analysisType,
          usage: response.usage,
          cost: response.cost,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Channel Analysis] ❌ 分析失敗:', error);
      res.status(500).json({
        success: false,
        error: '頻道分析失敗',
        details: error.message,
      });
    }
  });

  /**
   * 頻道分析（SSE 串流版）
   * POST /api/analyze-channel/stream
   */
  router.post('/analyze-channel/stream', async (req, res) => {
    const {
      startDate,
      endDate,
      channelId,
      videos,
      channelStats,
      analytics,
      modelType = 'gemini-2.5-flash',
      analysisType = 'comprehensive',
    } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      sendEvent('ping', {});
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
    };

    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
      cleanup();
    });

    try {
      if (!startDate || !endDate) {
        throw new Error('Missing startDate or endDate');
      }

      if (!videos || !Array.isArray(videos)) {
        throw new Error('Missing or invalid videos array');
      }

      console.log(`[Server] 收到分析請求: 類型=${analysisType}, 影片數量=${videos.length}`);

      sendEvent('stage', { id: 'prepare', status: 'active' });

      const prompt = PromptTemplates.generatePrompt({
        type: analysisType,
        dateRange: { startDate, endDate },
        channelStats,
        videos,
        analytics,
      });

      sendEvent('stage', { id: 'prepare', status: 'completed' });
      sendEvent('stage', { id: 'request', status: 'active' });

      let finalResult = null;

      await aiManager.streamAnalyze(
        modelType,
        {
          prompt,
          temperature: 0.7,
          maxTokens: getMaxTokensForModel(modelType),
          abortSignal: abortController.signal,
        },
        {
          onChunk: (text) => {
            if (text) {
              sendEvent('chunk', { text });
            }
          },
          onComplete: (result) => {
            finalResult = result;
          },
        }
      );

      sendEvent('stage', { id: 'request', status: 'completed' });
      sendEvent('stage', { id: 'render', status: 'active' });

      if (!finalResult) {
        throw new Error('分析結果為空');
      }

      sendEvent('complete', {
        text: finalResult.text,
        metadata: {
          model: finalResult.model,
          provider: finalResult.provider,
          usage: finalResult.usage,
          cost: finalResult.cost,
          finishReason: finalResult.finishReason,
          analysisType,
          timestamp: new Date().toISOString(),
        },
      });

      sendEvent('stage', { id: 'render', status: 'completed' });
      sendEvent('end', { success: true });
      cleanup();
      res.end();
    } catch (error) {
      const isAbortError =
        error.name === 'AbortError' ||
        (typeof error.message === 'string' && error.message.includes('串流已中止'));

      if (!isAbortError) {
        console.error('[Channel Analysis SSE] ❌ 串流分析失敗:', error);
        sendEvent('error', {
          message: error.message || '串流分析失敗',
        });
      } else {
        console.warn('[Channel Analysis SSE] 串流被中止');
      }
      cleanup();
      res.end();
    }
  });

  /**
   * 多模型協同分析
   * POST /api/analyze-channel/multi-model
   */
  router.post('/analyze-channel/multi-model', async (req, res) => {
    const {
      startDate,
      endDate,
      channelId,
      videos,
      channelStats,
      analytics,
      models, // 用戶指定的模型列表
    } = req.body;

    try {
      console.log(`\n========== 📊 開始多模型協同分析 ==========`);

      // 如果沒有指定模型，使用所有可用模型
      let modelsToUse = models;
      if (!modelsToUse || modelsToUse.length === 0) {
        const availableModels = aiManager.getAvailableModels();
        modelsToUse = availableModels.map((m) => m.id);
      }

      console.log(`[Multi-Model Analysis] 使用模型: ${modelsToUse.join(', ')}`);

      // 並行執行多個模型分析
      const analysisPromises = modelsToUse.map(async (modelType) => {
        try {
          const prompt = PromptTemplates.generatePrompt({
            type: 'comprehensive',
            dateRange: { startDate, endDate },
            channelStats,
            videos,
            analytics,
          });

          const response = await aiManager.analyze(modelType, {
            prompt,
            temperature: 0.7,
            maxTokens: getMaxTokensForModel(modelType),
          });

          return {
            model: response.model,
            provider: response.provider,
            analysis: response.text,
            usage: response.usage,
            cost: response.cost,
            success: true,
          };
        } catch (error) {
          console.error(`[Multi-Model Analysis] ${modelType} 分析失敗:`, error);
          return {
            model: modelType,
            error: error.message,
            success: false,
          };
        }
      });

      const results = await Promise.all(analysisPromises);

      const successCount = results.filter((r) => r.success).length;
      const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

      console.log('[Multi-Model Analysis] ✅ 分析完成');
      console.log(`[Multi-Model Analysis] 成功: ${successCount}/${results.length}`);
      if (totalCost > 0) {
        console.log(`[Multi-Model Analysis] 總成本: $${totalCost.toFixed(6)}`);
      }

      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
          totalCost,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Multi-Model Analysis] ❌ 分析失敗:', error);
      res.status(500).json({
        success: false,
        error: '多模型分析失敗',
        details: error.message,
      });
    }
  });

  /**
   * AI 關鍵字報表分析（支援多模型）
   * POST /api/analyze-keywords
   */
  router.post('/analyze-keywords', async (req, res) => {
    const {
      keywordGroups, // 關鍵字組合列表
      dateColumns, // 日期列列表
      analyticsData, // 分析數據（{ groupId: { columnId: { views, likes, ... } } }）
      selectedMetrics, // 選中的指標
      modelType = 'gemini-2.5-flash', // 使用的模型
    } = req.body;

    try {
      console.log(`\n========== 🔍 開始關鍵字報表分析 ==========`);
      console.log(`[Keyword Analysis] 模型: ${modelType}`);
      console.log(`[Keyword Analysis] 關鍵字組合數: ${keywordGroups?.length || 0}`);
      console.log(`[Keyword Analysis] 日期列數: ${dateColumns?.length || 0}`);

      // 驗證必要參數
      if (!keywordGroups || keywordGroups.length === 0) {
        return res.status(400).json({
          success: false,
          error: '請提供至少一個關鍵字組合',
        });
      }

      if (!dateColumns || dateColumns.length === 0) {
        return res.status(400).json({
          success: false,
          error: '請提供至少一個日期範圍',
        });
      }

      if (!analyticsData) {
        return res.status(400).json({
          success: false,
          error: '請提供分析數據',
        });
      }

      // 生成關鍵字分析 Prompt
      const prompt = PromptTemplates.buildContentUnitPrompt({
        keywordGroups,
        dateColumns,
        analyticsData,
        selectedMetrics: selectedMetrics || ['views', 'likes', 'comments'],
      });

      console.log('[Keyword Analysis] 📤 發送請求到 AI 模型...');

      // 調用 AI 模型分析
      const response = await aiManager.analyze(modelType, {
        prompt,
        temperature: 0.7,
        maxTokens: getMaxTokensForModel(modelType),
      });

      console.log('[Keyword Analysis] ✅ 分析完成');
      console.log(`[Keyword Analysis] 模型: ${response.model}`);
      console.log(`[Keyword Analysis] 提供者: ${response.provider}`);
      if (response.usage) {
        console.log(`[Keyword Analysis] Token 使用: ${response.usage.totalTokens || 'N/A'}`);
      }
      if (response.cost) {
        console.log(`[Keyword Analysis] 成本: $${response.cost.toFixed(6)}`);
      }
      console.log(`[Keyword Analysis] 結果長度: ${response.text?.length || 0} 字元`);

      res.json({
        success: true,
        analysis: response.text,
        metadata: {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
          cost: response.cost,
          keywordGroupCount: keywordGroups.length,
          dateColumnCount: dateColumns.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Keyword Analysis] ❌ 分析失敗:', error);
      res.status(500).json({
        success: false,
        error: '關鍵字分析失敗',
        details: error.message,
      });
    }
  });

  /**
   * AI 關鍵字報表分析（SSE 串流版）
   * POST /api/analyze-keywords/stream
   */
  router.post('/analyze-keywords/stream', async (req, res) => {
    const {
      keywordGroups,
      dateColumns,
      analyticsData,
      selectedMetrics,
      modelType = 'gemini-2.5-flash',
    } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      sendEvent('ping', {});
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
    };

    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
      cleanup();
    });

    const failAndEnd = (message) => {
      sendEvent('error', { message });
      sendEvent('end', { success: false });
      cleanup();
      res.end();
    };

    try {
      if (!keywordGroups || keywordGroups.length === 0) {
        return failAndEnd('請提供至少一個關鍵字組合');
      }
      if (!dateColumns || dateColumns.length === 0) {
        return failAndEnd('請提供至少一個日期範圍');
      }
      if (!analyticsData) {
        return failAndEnd('請提供分析數據');
      }

      sendEvent('stage', { id: 'prepare', status: 'active' });

      const prompt = PromptTemplates.buildContentUnitPrompt({
        keywordGroups,
        dateColumns,
        analyticsData,
        selectedMetrics: selectedMetrics || ['views', 'likes', 'comments'],
      });

      sendEvent('stage', { id: 'prepare', status: 'completed' });
      sendEvent('stage', { id: 'request', status: 'active' });

      let finalResult = null;

      await aiManager.streamAnalyze(
        modelType,
        {
          prompt,
          temperature: 0.7,
          maxTokens: getMaxTokensForModel(modelType),
          abortSignal: abortController.signal,
        },
        {
          onChunk: (text) => {
            if (text) {
              sendEvent('chunk', { text });
            }
          },
          onComplete: (result) => {
            finalResult = result;
          },
        }
      );

      sendEvent('stage', { id: 'request', status: 'completed' });
      sendEvent('stage', { id: 'render', status: 'active' });

      if (!finalResult) {
        throw new Error('分析結果為空');
      }

      sendEvent('complete', {
        text: finalResult.text,
        metadata: {
          model: finalResult.model,
          provider: finalResult.provider,
          usage: finalResult.usage,
          cost: finalResult.cost,
          keywordGroupCount: keywordGroups.length,
          dateColumnCount: dateColumns.length,
          selectedMetricsCount: selectedMetrics?.length || 0,
          timestamp: new Date().toISOString(),
        },
      });

      sendEvent('stage', { id: 'render', status: 'completed' });
      sendEvent('end', { success: true });
      cleanup();
      res.end();
    } catch (error) {
      const isAbortError =
        error.name === 'AbortError' ||
        (typeof error.message === 'string' && error.message.includes('串流'));

      if (!isAbortError) {
        console.error('[Keyword Analysis SSE] ❌ 串流分析失敗:', error);
        failAndEnd(error.message || '串流分析失敗');
      } else {
        console.warn('[Keyword Analysis SSE] 串流被中止');
        cleanup();
        res.end();
      }
    }
  });

  return router;
}
