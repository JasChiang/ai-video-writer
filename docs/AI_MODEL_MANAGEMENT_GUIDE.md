# AI 模型管理指南

本指南說明如何在系統中添加、更新或移除 AI 模型。

---

## 📋 目錄

1. [系統架構概覽](#系統架構概覽)
2. [添加新模型](#添加新模型)
3. [更新現有模型](#更新現有模型)
4. [移除模型](#移除模型)
5. [調整推薦策略](#調整推薦策略)
6. [常見問題](#常見問題)

---

## 系統架構概覽

目前系統支援兩種 AI 提供者：

### 1. **Gemini Provider（原生 API）**
- 使用 Google 原生 Gemini API
- 需要 `GEMINI_API_KEY`
- 支援模型：
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`

### 2. **OpenRouter Provider（統一接口）**
- 使用 OpenRouter 統一接口
- 需要 `OPENROUTER_API_KEY`
- 支援模型：
  - Claude 系列（`anthropic/claude-3.5-sonnet`, `anthropic/claude-3-opus`）
  - GPT 系列（`openai/gpt-4o`, `openai/gpt-4-turbo`, `openai/gpt-4`）
  - 其他 OpenRouter 支援的模型

---

## 添加新模型

### 場景 1：添加新的 OpenRouter 模型

這是**最簡單**的方式，因為不需要創建新的 Provider。

#### 步驟：

**1. 更新 `AIModelManager.ts` 中的類型定義**

在 `services/aiProviders/AIModelManager.ts` 文件中：

```typescript
export type AIModelType =
  // Gemini Models (原生 API)
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  // Claude Models (via OpenRouter)
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-opus'
  // OpenAI Models (via OpenRouter)
  | 'openai/gpt-4'
  | 'openai/gpt-4-turbo'
  | 'openai/gpt-4o'
  // 🆕 在這裡添加新模型
  | 'openai/o1'                           // 新增 GPT-o1
  | 'anthropic/claude-opus-4'             // 新增 Claude Opus 4
  | 'meta-llama/llama-3.2-90b-instruct';  // 新增 Llama 3.2
```

**2. 在 `initializeProviders()` 方法中初始化新模型**

在同一文件中：

```typescript
private initializeProviders() {
  // ... 現有代碼 ...

  if (this.openRouterApiKey) {
    // ... 現有模型初始化 ...

    // 🆕 添加新模型
    this.providers.set(
      'openai/o1',
      new OpenRouterProvider({
        apiKey: this.openRouterApiKey,
        model: 'openai/o1',
        temperature: 0.7,
      })
    );

    this.providers.set(
      'anthropic/claude-opus-4',
      new OpenRouterProvider({
        apiKey: this.openRouterApiKey,
        model: 'anthropic/claude-opus-4',
        temperature: 0.7,
      })
    );
  }
}
```

**3. 在 `getAvailableModels()` 方法中添加模型配置**

```typescript
getAvailableModels(): ModelConfig[] {
  const allModels: ModelConfig[] = [
    // ... 現有模型 ...

    // 🆕 添加新模型配置
    {
      id: 'openai/o1',
      name: 'GPT-o1',
      provider: 'OpenAI',
      description: 'OpenAI 最新推理模型，適合複雜邏輯任務',
      cost: 'high',
      speedRating: 2,  // 1-5，5 最快
      qualityRating: 5, // 1-5，5 最高品質
      bestFor: ['複雜推理', '數學問題', '代碼生成', '邏輯分析'],
      useOpenRouter: true,
    },
    {
      id: 'anthropic/claude-opus-4',
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      description: 'Claude 最新旗艦模型',
      cost: 'high',
      speedRating: 2,
      qualityRating: 5,
      bestFor: ['深度分析', '策略制定', '長文本處理', '高品質輸出'],
      useOpenRouter: true,
    },
  ];

  return allModels.filter((model) => this.providers.has(model.id));
}
```

**4. 更新 `OpenRouterProvider.ts` 中的模型信息映射（可選）**

在 `services/aiProviders/OpenRouterProvider.ts` 文件中：

```typescript
getModelInfo() {
  const modelInfo: Record<string, any> = {
    // ... 現有模型 ...

    // 🆕 添加新模型信息
    'openai/o1': {
      name: 'GPT-o1',
      provider: 'OpenAI',
      cost: 'High',
      description: 'OpenAI 最新推理模型',
    },
    'anthropic/claude-opus-4': {
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      cost: 'High',
      description: 'Claude 最新旗艦模型',
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
```

**完成！** 🎉

新模型現在可以在前端選擇並使用了。

---

### 場景 2：添加使用 Gemini 原生 API 的新模型

如果 Google 發布了新的 Gemini 模型（例如 `gemini-2.5-ultra`）：

**1. 更新類型定義**

```typescript
export type AIModelType =
  // Gemini Models (原生 API)
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-ultra'  // 🆕 新增
  // ...
```

**2. 初始化新模型**

```typescript
if (this.geminiApiKey) {
  // ... 現有模型 ...

  this.providers.set(
    'gemini-2.5-ultra',
    new GeminiProvider({
      apiKey: this.geminiApiKey,
      model: 'gemini-2.5-ultra',
      temperature: 0.7,
    })
  );
}
```

**3. 添加模型配置**

```typescript
{
  id: 'gemini-2.5-ultra',
  name: 'Gemini 2.5 Ultra',
  provider: 'Google',
  description: '最強大的 Gemini 模型',
  cost: 'high',
  speedRating: 2,
  qualityRating: 5,
  bestFor: ['複雜分析', '多模態任務', '長文本處理'],
  useOpenRouter: false,  // 使用原生 API
}
```

**4. 更新 `GeminiProvider.ts` 中的模型信息**

```typescript
getModelInfo() {
  const modelInfo: Record<string, any> = {
    'gemini-2.5-flash': { /* ... */ },
    'gemini-2.5-pro': { /* ... */ },
    'gemini-2.5-ultra': {  // 🆕
      name: 'Gemini 2.5 Ultra',
      provider: 'Google',
      cost: 'High',
      description: '最強大的 Gemini 模型',
    },
  };

  return modelInfo[this.config.model] || { /* ... */ };
}
```

---

### 場景 3：添加全新的 AI 提供者（例如 Cohere、Mistral）

如果要添加 OpenRouter 之外的新 AI 提供者：

**1. 創建新的 Provider 類**

創建 `services/aiProviders/CohereProvider.ts`：

```typescript
import {
  BaseAIProvider,
  AIProviderConfig,
  AIAnalysisRequest,
  AIAnalysisResponse,
} from './BaseAIProvider.js';

export class CohereProvider extends BaseAIProvider {
  private baseURL = 'https://api.cohere.ai/v1';

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const response = await fetch(`${this.baseURL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: request.prompt,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
      }),
    });

    const data = await response.json();

    return {
      text: data.generations[0].text,
      model: this.config.model,
      provider: 'Cohere',
      usage: {
        promptTokens: data.meta?.tokens?.input_tokens || 0,
        completionTokens: data.meta?.tokens?.output_tokens || 0,
        totalTokens: (data.meta?.tokens?.input_tokens || 0) +
                     (data.meta?.tokens?.output_tokens || 0),
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  getModelInfo() {
    return {
      name: this.config.model,
      provider: 'Cohere',
      cost: 'Medium',
    };
  }
}
```

**2. 在 `AIModelManager.ts` 中導入並使用**

```typescript
import { CohereProvider } from './CohereProvider.js';

// 在構造函數中添加
private cohereApiKey: string | undefined;

constructor() {
  this.geminiApiKey = process.env.GEMINI_API_KEY;
  this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
  this.cohereApiKey = process.env.COHERE_API_KEY;  // 🆕
  this.initializeProviders();
}

// 在 initializeProviders 中初始化
if (this.cohereApiKey) {
  this.providers.set(
    'cohere/command-r-plus',
    new CohereProvider({
      apiKey: this.cohereApiKey,
      model: 'command-r-plus',
      temperature: 0.7,
    })
  );
}
```

**3. 添加環境變數**

在 `.env.example` 和 `.env.local` 中添加：

```env
# Cohere API 金鑰（可選）
COHERE_API_KEY=your_cohere_api_key_here
```

---

## 更新現有模型

### 更新模型名稱或描述

只需要修改 `getAvailableModels()` 中的模型配置：

```typescript
{
  id: 'openai/gpt-4o',
  name: 'GPT-4o',  // 可以修改顯示名稱
  provider: 'OpenAI',
  description: '更新後的描述',  // 可以修改描述
  cost: 'medium',
  speedRating: 4,
  qualityRating: 5,
  bestFor: ['更新後的適用場景'],  // 可以修改適用場景
  useOpenRouter: true,
}
```

### 更新模型 ID（需謹慎）

如果模型 ID 改變（例如 OpenRouter 更新了模型路徑）：

1. 更新類型定義中的 ID
2. 更新 `initializeProviders()` 中的 ID
3. 更新 `getAvailableModels()` 中的 ID
4. 更新推薦策略中的 ID（如果有使用）

---

## 移除模型

要移除某個模型：

**1. 從類型定義中移除**

```typescript
export type AIModelType =
  // ... 其他模型 ...
  // | 'openai/gpt-4'  // ❌ 註解或刪除這行
```

**2. 從 `initializeProviders()` 中移除**

```typescript
// ❌ 註解或刪除這段
// this.providers.set(
//   'openai/gpt-4',
//   new OpenRouterProvider({ ... })
// );
```

**3. 從 `getAvailableModels()` 中移除**

```typescript
// ❌ 移除這個模型配置對象
// {
//   id: 'openai/gpt-4',
//   ...
// }
```

**4. 檢查推薦策略**

確保沒有推薦策略指向被移除的模型：

```typescript
getRecommendedModel(analysisType: AnalysisType): AIModelType | null {
  const recommendations: Record<AnalysisType, AIModelType> = {
    'content-strategy': 'openai/gpt-4o',  // ✅ 改用其他模型
    // 'content-strategy': 'openai/gpt-4',  // ❌ 不要使用已移除的模型
    // ...
  };
  // ...
}
```

---

## 調整推薦策略

推薦策略決定了「智能推薦模式」下，不同分析類型會使用哪個模型。

在 `AIModelManager.ts` 的 `getRecommendedModel()` 方法中修改：

```typescript
getRecommendedModel(analysisType: AnalysisType): AIModelType | null {
  const recommendations: Record<AnalysisType, AIModelType> = {
    'subscriber-growth': 'anthropic/claude-3.5-sonnet',  // 策略分析
    'view-optimization': 'gemini-2.5-flash',             // 快速優化
    'content-strategy': 'openai/gpt-4o',                 // 創意策略
    'audience-insights': 'anthropic/claude-3.5-sonnet',  // 數據洞察
    'comprehensive': 'gemini-2.5-pro',                   // 綜合分析
  };

  // 修改建議：
  // 1. 根據模型特性選擇：
  //    - 快速任務 → Gemini Flash
  //    - 邏輯推理 → Claude Sonnet
  //    - 創意內容 → GPT-4o
  //    - 深度分析 → Gemini Pro / Claude Opus
  //
  // 2. 考慮成本：
  //    - 低成本：Gemini Flash
  //    - 中成本：Claude Sonnet, GPT-4o/Turbo
  //    - 高成本：Gemini Pro, Claude Opus, GPT-4

  const recommended = recommendations[analysisType];

  if (recommended && this.providers.has(recommended)) {
    return recommended;
  }

  // 降級方案
  const availableModels = this.getAvailableModels();
  return availableModels.length > 0 ? availableModels[0].id : null;
}
```

---

## 常見問題

### Q1: 如何查看 OpenRouter 支援哪些模型？

訪問 [OpenRouter Models](https://openrouter.ai/models) 查看所有可用模型及其定價。

### Q2: 添加新模型後，為什麼前端看不到？

檢查以下幾點：
1. 是否重啟了後端伺服器？
2. 是否在 `getAvailableModels()` 中添加了模型配置？
3. 對應的 API Key 是否已配置在 `.env.local`？
4. 瀏覽器控制台有沒有錯誤訊息？

### Q3: 如何測試新模型是否正常工作？

```bash
# 1. 啟動伺服器
npm run dev

# 2. 檢查可用模型
curl http://localhost:3001/api/ai-models/available

# 3. 檢查特定模型狀態
curl http://localhost:3001/api/ai-models/openai%2Fgpt-4o/status

# 4. 獲取推薦模型
curl "http://localhost:3001/api/ai-models/recommend?analysisType=content-strategy"
```

### Q4: 不同模型的成本如何？

OpenRouter 提供的模型會在 API 響應中返回實際成本（`cost` 欄位）。你可以在：
- 後端 console 日誌中看到
- 前端分析結果的 metadata 中看到
- OpenRouter 儀表板查看詳細使用情況

### Q5: 如何臨時禁用某個模型？

最簡單的方法：在 `initializeProviders()` 中註解掉該模型的初始化代碼：

```typescript
// 臨時禁用 GPT-4
// this.providers.set(
//   'openai/gpt-4',
//   new OpenRouterProvider({ ... })
// );
```

### Q6: 多個模型使用相同的 API Key 嗎？

- 所有 Gemini 模型使用同一個 `GEMINI_API_KEY`
- 所有 OpenRouter 模型使用同一個 `OPENROUTER_API_KEY`
- 如果添加其他提供者（如 Cohere），需要對應的 API Key

---

## 快速參考：文件位置

| 檔案 | 用途 |
|------|------|
| `services/aiProviders/AIModelManager.ts` | 模型管理核心，添加/移除模型主要在這裡 |
| `services/aiProviders/BaseAIProvider.ts` | Provider 基類，定義接口 |
| `services/aiProviders/GeminiProvider.ts` | Gemini 原生 API Provider |
| `services/aiProviders/OpenRouterProvider.ts` | OpenRouter 統一接口 Provider |
| `services/analysisPrompts/PromptTemplates.ts` | 分析提示詞模板（不需要修改） |
| `server.js` | 後端 API 端點（不需要修改） |
| `.env.local` | 環境變數配置，添加 API Keys |

---

## 實用工具腳本

可以創建這些腳本來輔助管理：

### 檢查模型可用性

創建 `scripts/check-models.js`：

```javascript
import { AIModelManager } from '../services/aiProviders/AIModelManager.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const manager = new AIModelManager();
const models = manager.getAvailableModels();

console.log(`\n可用模型數量: ${models.length}\n`);

for (const model of models) {
  const status = await manager.getModelStatus(model.id);
  console.log(`✅ ${model.name}`);
  console.log(`   ID: ${model.id}`);
  console.log(`   Provider: ${model.provider}`);
  console.log(`   Cost: ${model.cost}`);
  console.log(`   Status: ${status.available ? '可用' : '不可用'}`);
  console.log('');
}
```

運行：`node scripts/check-models.js`

---

**更新日期：** 2025-01-15
**版本：** 1.0.0
