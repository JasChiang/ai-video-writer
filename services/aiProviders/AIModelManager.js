/**
 * AI Model Manager - 統一管理所有 AI 模型
 * 支援智能推薦和手動選擇
 */

import { GeminiProvider } from './GeminiProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';

export class AIModelManager {
  constructor() {
    this.providers = new Map();
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.initializeProviders();
  }

  initializeProviders() {
    // 初始化 Gemini Models (使用原生 API)
    if (this.geminiApiKey) {
      this.providers.set(
        'gemini-2.5-flash',
        new GeminiProvider({
          apiKey: this.geminiApiKey,
          model: 'gemini-2.5-flash',
          temperature: 0.7,
        })
      );

      this.providers.set(
        'gemini-2.5-pro',
        new GeminiProvider({
          apiKey: this.geminiApiKey,
          model: 'gemini-2.5-pro',
          temperature: 0.7,
        })
      );
    }

    // 初始化 OpenRouter Models
    if (this.openRouterApiKey) {
      // Claude Models
      this.providers.set(
        'anthropic/claude-sonnet-4.5',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'anthropic/claude-sonnet-4.5',
          temperature: 0.7,
        })
      );

      // OpenAI Models
      this.providers.set(
        'openai/gpt-5.1',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'openai/gpt-5.1',
          temperature: 0.7,
        })
      );

      // Grok Models
      this.providers.set(
        'x-ai/grok-4',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'x-ai/grok-4',
          temperature: 0.7,
        })
      );

      // 可選：其他模型
      // this.providers.set(
      //   'google/gemini-2.0-flash-exp',
      //   new OpenRouterProvider({
      //     apiKey: this.openRouterApiKey,
      //     model: 'google/gemini-2.0-flash-exp',
      //     temperature: 0.7,
      //   })
      // );

      // this.providers.set(
      //   'meta-llama/llama-3.1-70b-instruct',
      //   new OpenRouterProvider({
      //     apiKey: this.openRouterApiKey,
      //     model: 'meta-llama/llama-3.1-70b-instruct',
      //     temperature: 0.7,
      //   })
      // );
    }
  }

  /**
   * 執行 AI 分析
   */
  async analyze(modelType, request) {
    const provider = this.providers.get(modelType);

    if (!provider) {
      throw new Error(`模型 ${modelType} 不可用。請檢查 API Key 配置。`);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`模型 ${modelType} 配置不正確。`);
    }

    return provider.analyze(request);
  }

  /**
   * 獲取所有可用模型
   */
  getAvailableModels() {
    const allModels = [
      // Gemini Models (原生 API)
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        description: '快速、經濟的分析，適合日常監控和即時反饋',
        cost: 'low',
        speedRating: 5,
        qualityRating: 4,
        bestFor: ['快速分析', '日常監控', '即時反饋', '成本敏感'],
        useOpenRouter: false,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        description: '深度分析，強大的推理能力，適合複雜問題',
        cost: 'high',
        speedRating: 3,
        qualityRating: 5,
        bestFor: ['深度策略分析', '複雜問題', '預測分析', '數據洞察'],
        useOpenRouter: false,
      },

      // Claude Models (via OpenRouter)
      {
        id: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        provider: 'Anthropic',
        description: '最新 Claude 模型，邏輯清晰，結構化輸出優秀，適合策略規劃',
        cost: 'medium',
        speedRating: 4,
        qualityRating: 5,
        bestFor: ['策略規劃', '報告生成', '邏輯推理', '結構化分析'],
        useOpenRouter: true,
      },

      // OpenAI Models (via OpenRouter)
      {
        id: 'openai/gpt-5.1',
        name: 'GPT-5.1',
        provider: 'OpenAI',
        description: 'OpenAI 最新旗艦模型，頂級推理與創意能力',
        cost: 'high',
        speedRating: 4,
        qualityRating: 5,
        bestFor: ['全方位分析', '創意策略', '複雜推理', '深度洞察'],
        useOpenRouter: true,
      },

      // Grok Models (via OpenRouter)
      {
        id: 'x-ai/grok-4',
        name: 'Grok 4',
        provider: 'xAI',
        description: 'xAI 最新模型，快速反應，適合即時分析',
        cost: 'medium',
        speedRating: 5,
        qualityRating: 4,
        bestFor: ['即時分析', '快速洞察', '趨勢預測', '數據解讀'],
        useOpenRouter: true,
      },
    ];

    // 只返回已配置的模型
    return allModels.filter((model) => this.providers.has(model.id));
  }

  /**
   * 獲取特定模型的狀態
   */
  async getModelStatus(modelType) {
    const provider = this.providers.get(modelType);

    if (!provider) {
      return {
        available: false,
        configured: false,
        apiKeyStatus: {
          gemini: !!this.geminiApiKey,
          openRouter: !!this.openRouterApiKey,
        },
      };
    }

    const available = await provider.isAvailable();

    return {
      available,
      configured: true,
      info: provider.getModelInfo(),
      apiKeyStatus: {
        gemini: !!this.geminiApiKey,
        openRouter: !!this.openRouterApiKey,
      },
    };
  }

  /**
   * 根據分析類型獲取推薦模型（智能推薦）
   */
  getRecommendedModel(analysisType) {
    const recommendations = {
      'subscriber-growth': 'anthropic/claude-sonnet-4.5', // 策略分析
      'view-optimization': 'gemini-2.5-flash', // 快速優化建議
      'content-strategy': 'openai/gpt-5.1', // 創意策略
      'audience-insights': 'anthropic/claude-sonnet-4.5', // 數據洞察
      comprehensive: 'gemini-2.5-pro', // 綜合分析
    };

    const recommended = recommendations[analysisType];

    // 確保推薦的模型實際可用
    if (recommended && this.providers.has(recommended)) {
      return recommended;
    }

    // 降級方案：返回第一個可用模型
    const availableModels = this.getAvailableModels();
    return availableModels.length > 0 ? availableModels[0].id : null;
  }
}
