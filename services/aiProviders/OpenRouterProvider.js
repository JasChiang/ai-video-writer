/**
 * OpenRouter Provider - 使用 OpenRouter 統一接口
 * 支援 Claude, GPT-4, 和其他模型
 */

import { BaseAIProvider } from './BaseAIProvider.js';

export class OpenRouterProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async analyze(request) {
    try {
      const messages = [];

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

      const maxTokens = request.maxTokens ?? this.config.maxTokens ?? 4096;

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
          // GPT-5.x 等模型採用 Responses API 格式，必須同時指定 max_tokens / max_output_tokens
          max_tokens: maxTokens,
          max_output_tokens: maxTokens,
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
      const finishReason = completion.finish_reason;

      // 兼容 Responses API 可能回傳的 content 陣列格式
      let content = completion.message?.content ?? '';
      if (Array.isArray(content)) {
        content = content
          .map((block) => {
            if (typeof block === 'string') return block;
            if (typeof block?.text === 'string') return block.text;
            if (block?.type === 'output_text' && typeof block.output_text === 'string') {
              return block.output_text;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n\n');
      }

      if (!content) {
        console.warn(
          `[OpenRouterProvider] 收到空白內容 (finish_reason: ${finishReason || 'unknown'})`
        );
      }

      return {
        text: content,
        model: this.config.model,
        provider: this.getProviderName(),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        cost: data.usage?.total_cost, // OpenRouter 提供的成本
        finishReason,
      };
    } catch (error) {
      console.error('[OpenRouterProvider] Error:', error);
      throw new Error(`OpenRouter API 錯誤: ${error.message}`);
    }
  }

  async isAvailable() {
    return !!this.config.apiKey;
  }

  getModelInfo() {
    // OpenRouter 模型映射
    const modelInfo = {
      'anthropic/claude-sonnet-4.5': {
        name: 'Claude Sonnet 4.5',
        provider: 'Anthropic',
        cost: 'Medium',
        description: '最新 Claude 模型，邏輯清晰、結構化輸出優秀',
      },
      'openai/gpt-5.1': {
        name: 'GPT-5.1',
        provider: 'OpenAI',
        cost: 'High',
        description: 'OpenAI 最新旗艦模型，頂級推理與創意能力',
      },
      'x-ai/grok-4': {
        name: 'Grok 4',
        provider: 'xAI',
        cost: 'Medium',
        description: 'xAI 最新模型，快速反應，適合即時分析',
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

  getProviderName() {
    const model = this.config.model.toLowerCase();
    if (model.includes('claude')) return 'Anthropic';
    if (model.includes('gpt')) return 'OpenAI';
    if (model.includes('gemini')) return 'Google';
    if (model.includes('llama')) return 'Meta';
    return 'OpenRouter';
  }
}
