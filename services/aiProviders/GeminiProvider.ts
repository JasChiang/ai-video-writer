/**
 * Gemini Provider - 使用 Google Gemini 原生 API
 */

import { GoogleGenAI } from '@google/generative-ai';
import {
  BaseAIProvider,
  AIProviderConfig,
  AIAnalysisRequest,
  AIAnalysisResponse,
} from './BaseAIProvider.js';

export class GeminiProvider extends BaseAIProvider {
  private ai: GoogleGenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 8192,
        },
      });

      return {
        text: response.text,
        model: this.config.model,
        provider: 'Google Gemini',
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error: any) {
      console.error('[GeminiProvider] Error:', error);
      throw new Error(`Gemini API 錯誤: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  getModelInfo() {
    const modelInfo: Record<string, any> = {
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        cost: 'Low',
        description: '快速、經濟，適合即時分析',
      },
      'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        cost: 'High',
        description: '深度推理，適合複雜分析',
      },
    };

    return (
      modelInfo[this.config.model] || {
        name: this.config.model,
        provider: 'Google Gemini',
        cost: 'Medium',
      }
    );
  }
}
