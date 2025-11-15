/**
 * Base AI Provider - 所有 AI 提供者的抽象基類
 */

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
}

export interface AIAnalysisRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIAnalysisResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  cost?: number; // OpenRouter 提供的成本信息
}

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * 執行 AI 分析
   */
  abstract analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;

  /**
   * 檢查 Provider 是否可用（API Key 是否已配置）
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * 獲取模型信息
   */
  abstract getModelInfo(): {
    name: string;
    provider: string;
    cost: string;
    description?: string;
  };
}
