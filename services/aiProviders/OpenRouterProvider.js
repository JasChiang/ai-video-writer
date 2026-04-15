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

  supportsStreaming() {
    return true;
  }

  async streamAnalyze(request, handlers = {}) {
    const abortSignal = request.abortSignal;
    let abortRequested = false;
    let reader = null;

    const handleAbort = () => {
      abortRequested = true;
      if (reader) {
        try {
          reader.cancel();
        } catch (err) {
          console.error('[OpenRouterProvider] reader cancel error:', err);
        }
      }
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', handleAbort);
    }

    try {
      const messages = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

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
          max_tokens: maxTokens,
          max_output_tokens: maxTokens,
          stream: true,
          route: 'fallback',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `OpenRouter API 錯誤: ${response.status}`
        );
      }

      reader = response.body?.getReader();
      if (!reader) {
        throw new Error('無法讀取 OpenRouter 串流回應');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let aggregatedText = '';
      let finishReason = null;
      let usage = null;

      const processEvent = (rawEvent) => {
        if (!rawEvent.trim()) return;
        const lines = rawEvent.split('\n');
        let eventName = 'message';
        const dataLines = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            eventName = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice(5).trim());
          }
        }

        const dataStr = dataLines.join('\n');
        if (!dataStr) return;
        if (dataStr === '[DONE]') {
          finishReason = finishReason || 'stop';
          return 'done';
        }

        let payload;
        try {
          payload = JSON.parse(dataStr);
        } catch (err) {
          console.error('[OpenRouterProvider] 無法解析串流資料:', err);
          return;
        }

        const choice = payload.choices?.[0];
        if (choice?.delta?.content) {
          const chunkText = this.extractDeltaText(choice.delta.content);
          if (chunkText) {
            aggregatedText += chunkText;
            if (typeof handlers.onChunk === 'function') {
              handlers.onChunk(chunkText);
            }
          }
        }

        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }

        if (payload.usage) {
          usage = {
            promptTokens: payload.usage.prompt_tokens || 0,
            completionTokens: payload.usage.completion_tokens || 0,
            totalTokens: payload.usage.total_tokens || 0,
          };
        }

        if (payload.error) {
          throw new Error(payload.error.message || 'OpenRouter 串流錯誤');
        }

        return eventName;
      };

      let streamClosed = false;
      while (!streamClosed && !abortRequested) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const result = processEvent(rawEvent);
          if (result === 'done') {
            streamClosed = true;
            break;
          }
        }
      }

      if (abortRequested) {
        const abortError = new Error('串流已中止');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const finalResult = {
        text: aggregatedText,
        model: this.config.model,
        provider: this.getProviderName(),
        usage,
        finishReason,
      };

      if (typeof handlers.onComplete === 'function') {
        handlers.onComplete(finalResult);
      }

      return finalResult;
    } catch (error) {
      if (abortRequested || error?.name === 'AbortError') {
        const abortError = new Error('串流已中止');
        abortError.name = 'AbortError';
        throw abortError;
      }
      console.error('[OpenRouterProvider] Streaming Error:', error);
      throw new Error(`OpenRouter 串流錯誤: ${error.message}`);
    } finally {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', handleAbort);
      }
    }
  }

  extractDeltaText(contentDelta) {
    if (!contentDelta) return '';
    if (typeof contentDelta === 'string') {
      return contentDelta;
    }

    if (Array.isArray(contentDelta)) {
      return contentDelta
        .map((part) => part?.text || '')
        .join('');
    }

    if (typeof contentDelta === 'object' && typeof contentDelta.text === 'string') {
      return contentDelta.text;
    }

    return '';
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
