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
        'anthropic/claude-3.5-sonnet',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'anthropic/claude-3.5-sonnet',
          temperature: 0.7,
        })
      );

      this.providers.set(
        'anthropic/claude-3-opus',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'anthropic/claude-3-opus',
          temperature: 0.7,
        })
      );

      // OpenAI Models
      this.providers.set(
        'openai/gpt-4',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'openai/gpt-4',
          temperature: 0.7,
        })
      );

      this.providers.set(
        'openai/gpt-4-turbo',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'openai/gpt-4-turbo',
          temperature: 0.7,
        })
      );

      this.providers.set(
        'openai/gpt-4o',
        new OpenRouterProvider({
          apiKey: this.openRouterApiKey,
          model: 'openai/gpt-4o',
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
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        description: '邏輯清晰，結構化輸出優秀，適合策略規劃',
        cost: 'medium',
        speedRating: 4,
        qualityRating: 5,
        bestFor: ['策略規劃', '報告生成', '邏輯推理', '結構化分析'],
        useOpenRouter: true,
      },
      {
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        description: '最強推理能力，適合最複雜的分析任務',
        cost: 'high',
        speedRating: 2,
        qualityRating: 5,
        bestFor: ['複雜推理', '深度分析', '策略制定', '高品質輸出'],
        useOpenRouter: true,
      },

      // OpenAI Models (via OpenRouter)
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        description: 'OpenAI 最新模型，平衡速度與品質',
        cost: 'medium',
        speedRating: 4,
        qualityRating: 5,
        bestFor: ['全方位分析', '創意建議', '內容優化', '快速回應'],
        useOpenRouter: true,
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'OpenAI',
        description: '更快、更經濟的 GPT-4，適合多數任務',
        cost: 'medium',
        speedRating: 4,
        qualityRating: 4,
        bestFor: ['內容創意', '標題建議', '文案優化', '通用分析'],
        useOpenRouter: true,
      },
      {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        description: '創意豐富，語言表達多樣，經典 GPT-4',
        cost: 'high',
        speedRating: 3,
        qualityRating: 5,
        bestFor: ['創意策略', '內容企劃', '品牌定位', '深度分析'],
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
      'subscriber-growth': 'anthropic/claude-3.5-sonnet', // 策略分析
      'view-optimization': 'gemini-2.5-flash', // 快速優化建議
      'content-strategy': 'openai/gpt-4o', // 創意策略
      'audience-insights': 'anthropic/claude-3.5-sonnet', // 數據洞察
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
