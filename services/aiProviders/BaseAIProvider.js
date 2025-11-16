/**
 * Base AI Provider - 所有 AI 提供者的抽象基類
 */

export class BaseAIProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * 執行 AI 分析
   * @param {Object} request - { prompt, systemPrompt?, temperature?, maxTokens? }
   * @returns {Promise<Object>} { text, usage, model, provider, cost? }
   */
  async analyze(request) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * 是否支援串流輸出
   * @returns {boolean}
   */
  supportsStreaming() {
    return false;
  }

  /**
   * 串流分析：預設退化為一次性分析
   * @param {Object} request
   * @param {Object} handlers
   * @param {(chunk: string) => void} handlers.onChunk
   * @returns {Promise<Object>}
   */
  async streamAnalyze(request, handlers = {}) {
    const result = await this.analyze(request);
    if (result?.text && typeof handlers.onChunk === 'function') {
      handlers.onChunk(result.text);
    }
    if (typeof handlers.onComplete === 'function') {
      handlers.onComplete(result);
    }
    return result;
  }

  /**
   * 檢查 Provider 是否可用（API Key 是否已配置）
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by subclass');
  }

  /**
   * 獲取模型信息
   * @returns {Object} { name, provider, cost, description? }
   */
  getModelInfo() {
    throw new Error('getModelInfo() must be implemented by subclass');
  }
}
