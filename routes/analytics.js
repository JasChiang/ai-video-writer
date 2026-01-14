import { Router } from 'express';
import { getChannelVideosAnalytics, calculateUpdatePriority, getVideoSearchTerms, getVideoExternalTrafficDetails } from '../services/server/analyticsService.js';
import { generateKeywordAnalysisPrompt } from '../services/server/keywordAnalysisPromptService.js';

export function createAnalyticsRouter({ aiManager }) {
  const router = Router();

  /**
   * 影片表現分析 API
   * POST /api/analytics/channel
   * 分析頻道影片表現，找出需要優化的影片
   */
  router.post('/channel', async (req, res) => {
    try {
      const { accessToken, channelId, daysThreshold = 365 } = req.body;

      // 驗證必要參數
      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: '缺少 accessToken',
        });
      }

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: '缺少 channelId',
        });
      }

      console.log(`\n========== 📊 開始影片表現分析 ==========`);
      console.log(`[Video Analytics] 頻道 ID: ${channelId}`);
      console.log(`[Video Analytics] 天數範圍: ${daysThreshold} 天`);

      // 步驟 1: 獲取頻道影片分析數據
      const analyticsData = await getChannelVideosAnalytics(accessToken, channelId, daysThreshold);
      console.log(`[Video Analytics] 獲取到 ${analyticsData.length} 支影片的分析數據`);

      // 步驟 2: 計算更新優先級
      const recommendations = calculateUpdatePriority(analyticsData);
      console.log(`[Video Analytics] 找到 ${recommendations.length} 支建議更新的影片`);

      res.json({
        success: true,
        totalVideos: analyticsData.length,
        recommendations: recommendations,
      });
    } catch (error) {
      console.error('[Video Analytics] ❌ 分析失敗:', error);
      res.status(500).json({
        success: false,
        message: error.message || '影片表現分析失敗',
      });
    }
  });

  /**
   * 關鍵字分析 API
   * POST /api/analytics/keyword-analysis
   * 使用 AI 分析影片關鍵字並提供優化建議
   */
  router.post('/keyword-analysis', async (req, res) => {
    try {
      const { videoData } = req.body;

      // 驗證必要參數
      if (!videoData || !videoData.title) {
        return res.status(400).json({
          success: false,
          message: '缺少影片資料',
        });
      }

      console.log(`\n========== 🔍 開始關鍵字分析 ==========`);
      console.log(`[Keyword Analysis] 影片標題: ${videoData.title}`);

      // 步驟 1: 生成分析 prompt
      const prompt = generateKeywordAnalysisPrompt(videoData);

      // 步驟 2: 使用 AI 模型進行分析（使用 Gemini Flash 以節省成本）
      const modelType = 'gemini-2.5-flash';
      console.log(`[Keyword Analysis] 使用模型: ${modelType}`);

      const response = await aiManager.analyze(modelType, {
        prompt,
        temperature: 0.7,
        maxTokens: 4096,
      });

      console.log('[Keyword Analysis] ✅ 分析完成');
      console.log(`[Keyword Analysis] 結果長度: ${response.text.length} 字元`);

      // 步驟 3: 解析 JSON 結果
      let analysis;
      try {
        // 嘗試從回應中提取 JSON（可能包含 markdown code block）
        const jsonMatch = response.text.match(/```json\s*([\s\S]*?)\s*```/) ||
          response.text.match(/```\s*([\s\S]*?)\s*```/);

        const jsonText = jsonMatch ? jsonMatch[1] : response.text;
        analysis = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('[Keyword Analysis] ⚠️ JSON 解析失敗，返回原始文本');
        // 如果無法解析為 JSON，返回基本結構
        analysis = {
          currentKeywords: {
            score: 0,
            strengths: [],
            weaknesses: ['AI 分析結果格式錯誤'],
          },
          recommendedKeywords: {
            primary: [],
            secondary: [],
            longtail: [],
          },
          titleSuggestions: [],
          descriptionTips: [],
          actionPlan: {
            priority: 'medium',
            estimatedImpact: '未知',
            steps: [],
          },
          metadataHints: {
            titleHooks: [],
            descriptionAngles: [],
            callToActions: [],
          },
          rawResponse: response.text,
        };
      }

      res.json({
        success: true,
        analysis: analysis,
        metadata: {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
          cost: response.cost,
        },
      });
    } catch (error) {
      console.error('[Keyword Analysis] ❌ 分析失敗:', error);
      res.status(500).json({
        success: false,
        message: error.message || '關鍵字分析失敗',
      });
    }
  });

  /**
   * 影片搜尋字詞 API
   * POST /api/analytics/search-terms
   * 獲取單一影片的熱門搜尋字詞
   */
  router.post('/search-terms', async (req, res) => {
    try {
      const { accessToken, channelId, videoId, daysThreshold = 365, maxResults = 10 } = req.body;

      // 驗證必要參數
      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: '缺少 accessToken',
        });
      }

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: '缺少 channelId',
        });
      }

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: '缺少 videoId',
        });
      }

      console.log(`\n========== 🔍 開始獲取搜尋字詞 ==========`);
      console.log(`[Search Terms] 影片 ID: ${videoId}`);
      console.log(`[Search Terms] 天數範圍: ${daysThreshold} 天`);
      console.log(`[Search Terms] 最大結果數: ${maxResults}`);

      // 調用服務獲取搜尋字詞
      const searchTerms = await getVideoSearchTerms(
        accessToken,
        channelId,
        videoId,
        daysThreshold,
        maxResults
      );

      console.log(`[Search Terms] ✅ 找到 ${searchTerms.length} 個搜尋字詞`);

      res.json({
        success: true,
        searchTerms: searchTerms,
      });
    } catch (error) {
      console.error('[Search Terms] ❌ 獲取失敗:', error);
      res.status(500).json({
        success: false,
        message: error.message || '獲取搜尋字詞失敗',
      });
    }
  });

  /**
   * 外部流量細節 API
   * POST /api/analytics/external-traffic
   * 獲取單一影片的外部流量詳細資料
   */
  router.post('/external-traffic', async (req, res) => {
    try {
      const { accessToken, channelId, videoId, daysThreshold = 365, maxResults = 25 } = req.body;

      // 驗證必要參數
      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: '缺少 accessToken',
        });
      }

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: '缺少 channelId',
        });
      }

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: '缺少 videoId',
        });
      }

      console.log(`\n========== 🌐 開始獲取外部流量細節 ==========`);
      console.log(`[External Traffic] 影片 ID: ${videoId}`);
      console.log(`[External Traffic] 天數範圍: ${daysThreshold} 天`);
      console.log(`[External Traffic] 最大結果數: ${maxResults}`);

      // 調用服務獲取外部流量細節
      const trafficDetails = await getVideoExternalTrafficDetails(
        accessToken,
        channelId,
        videoId,
        daysThreshold,
        maxResults
      );

      console.log(`[External Traffic] ✅ Google 搜尋觀看: ${trafficDetails.googleSearch}`);
      console.log(`[External Traffic] ✅ 外部來源數量: ${trafficDetails.topExternalSources.length}`);

      res.json({
        success: true,
        googleSearch: trafficDetails.googleSearch,
        adjustedExternal: trafficDetails.adjustedExternal,
        totalExternalViews: trafficDetails.totalExternalViews,
        topExternalSources: trafficDetails.topExternalSources,
      });
    } catch (error) {
      console.error('[External Traffic] ❌ 獲取失敗:', error);
      res.status(500).json({
        success: false,
        message: error.message || '獲取外部流量細節失敗',
      });
    }
  });

  return router;
}
