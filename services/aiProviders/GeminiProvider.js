/**
 * Gemini Provider - 使用 Google Gemini 原生 API
 */

import { GoogleGenAI } from '@google/genai';
import { BaseAIProvider } from './BaseAIProvider.js';

export class GeminiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async analyze(request) {
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
    } catch (error) {
      console.error('[GeminiProvider] Error:', error);
      throw new Error(`Gemini API 錯誤: ${error.message}`);
    }
  }

  supportsStreaming() {
    return true;
  }

  async streamAnalyze(request, handlers = {}) {
    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.config.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        config: {
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 8192,
          abortSignal: request.abortSignal,
        },
      });

      let aggregatedText = '';
      let lastChunk = null;

      for await (const chunk of stream) {
        lastChunk = chunk;
        const chunkText = chunk.text;
        if (chunkText) {
          aggregatedText += chunkText;
          if (typeof handlers.onChunk === 'function') {
            handlers.onChunk(chunkText);
          }
        }
      }

      const usageMetadata = lastChunk?.usageMetadata;
      const result = {
        text: aggregatedText,
        model: this.config.model,
        provider: 'Google Gemini',
        usage: {
          promptTokens: usageMetadata?.promptTokenCount || 0,
          completionTokens: usageMetadata?.candidatesTokenCount || 0,
          totalTokens: usageMetadata?.totalTokenCount || 0,
        },
      };

      if (typeof handlers.onComplete === 'function') {
        handlers.onComplete(result);
      }

      return result;
    } catch (error) {
      console.error('[GeminiProvider] Streaming Error:', error);
      throw new Error(`Gemini API 串流錯誤: ${error.message}`);
    }
  }

  async isAvailable() {
    return !!this.config.apiKey;
  }

  getModelInfo() {
    const modelInfo = {
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
