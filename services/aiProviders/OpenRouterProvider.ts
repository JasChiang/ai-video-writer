/**
 * OpenRouter Provider - 使用 OpenRouter 統一接口
 * 支援 Claude, GPT-4, 和其他模型
 */

import {
  BaseAIProvider,
  AIProviderConfig,
  AIAnalysisRequest,
  AIAnalysisResponse,
} from './BaseAIProvider.js';

export class OpenRouterProvider extends BaseAIProvider {
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(config: AIProviderConfig) {
    super(config);
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const messages: any[] = [];

      // 如果有 system prompt，加入 system message
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      // 加入 user prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://ai-video-writer.com',
          'X-Title': 'AI Video Writer - YouTube Analytics',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
          route: 'fallback', // 如果模型不可用，自動降級
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `OpenRouter API 錯誤: ${response.status}`
        );
      }

      const data = await response.json();
      const completion = data.choices[0];

      return {
        text: completion.message.content,
        model: this.config.model,
        provider: this.getProviderName(),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        cost: data.usage?.total_cost, // OpenRouter 提供的成本
      };
    } catch (error: any) {
      console.error('[OpenRouterProvider] Error:', error);
      throw new Error(`OpenRouter API 錯誤: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  getModelInfo() {
    // OpenRouter 模型映射
    const modelInfo: Record<string, any> = {
      'anthropic/claude-3.5-sonnet': {
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        cost: 'Medium',
        description: '邏輯清晰、結構化輸出優秀',
      },
      'anthropic/claude-3-opus': {
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        cost: 'High',
        description: '最強推理能力，適合複雜任務',
      },
      'openai/gpt-4': {
        name: 'GPT-4',
        provider: 'OpenAI',
        cost: 'High',
        description: '創意豐富、語言表達多樣',
      },
      'openai/gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        provider: 'OpenAI',
        cost: 'Medium',
        description: '更快、更經濟的 GPT-4',
      },
      'openai/gpt-4o': {
        name: 'GPT-4o',
        provider: 'OpenAI',
        cost: 'Medium',
        description: 'OpenAI 最新多模態模型',
      },
      'google/gemini-2.0-flash-exp': {
        name: 'Gemini 2.0 Flash (Experimental)',
        provider: 'Google',
        cost: 'Low',
        description: '實驗性快速模型',
      },
      'meta-llama/llama-3.1-70b-instruct': {
        name: 'Llama 3.1 70B',
        provider: 'Meta',
        cost: 'Low',
        description: '開源大模型，經濟實惠',
      },
    };

    return (
      modelInfo[this.config.model] || {
        name: this.config.model,
        provider: 'OpenRouter',
        cost: 'Medium',
      }
    );
  }

  private getProviderName(): string {
    const model = this.config.model.toLowerCase();
    if (model.includes('claude')) return 'Anthropic';
    if (model.includes('gpt')) return 'OpenAI';
    if (model.includes('gemini')) return 'Google';
    if (model.includes('llama')) return 'Meta';
    return 'OpenRouter';
  }
}
