/**
 * Gemini 模型備援 (fallback) 工具
 *
 * 當主模型遇到過載（503 等暫時性錯誤）時，自動依序降級到 chain 中的下一個模型，
 * 解決「一直撞到 503」的問題。
 *
 * 預設 chain：
 *   gemini-flash-latest  （= 現行 GA 的 gemini-3.5-flash，latest alias）
 *   gemini-3.5-flash     （pin 住的 3.5，防 latest alias 本身異常）
 *   gemini-2.5-flash     （真正不同的模型，才是躲開 flash 過載的逃生口）
 *
 * 可用環境變數 GEMINI_MODEL_CHAIN 覆寫（逗號分隔），例如：
 *   GEMINI_MODEL_CHAIN=gemini-flash-latest,gemini-2.5-flash
 *
 * 註：gemini-2.0-flash 系列已於 2026-06-01 被 Google 停用，請勿放入 chain。
 */

const DEFAULT_GEMINI_MODEL_CHAIN = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
];

/** 由環境變數解析出的 chain（空 = 用預設） */
export const GEMINI_MODEL_CHAIN = (process.env.GEMINI_MODEL_CHAIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * 取得實際要嘗試的模型順序。
 * 若指定 preferredModel，會把它排在最前面（其餘去重接在後面），
 * 讓使用者選的模型優先，過載時才降級。
 */
export function getModelChain(preferredModel) {
  const base = GEMINI_MODEL_CHAIN.length > 0 ? GEMINI_MODEL_CHAIN : DEFAULT_GEMINI_MODEL_CHAIN;
  if (!preferredModel) return [...base];
  return [preferredModel, ...base.filter((m) => m !== preferredModel)];
}

/**
 * 判斷錯誤是否為「可降級」的過載／暫時性錯誤。
 * 只有這類錯誤才換模型；其餘（例如 400 參數錯誤、權限錯誤）直接往上拋。
 */
export function isGeminiOverloadError(error) {
  if (!error) return false;
  const status = Number(error.status ?? error.code ?? error?.response?.status);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('try again later') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500')
  );
}

/**
 * 呼叫 generateContent，遇過載自動降級到 chain 的下一個模型。
 *
 * @param {object} client - GoogleGenAI 實例
 * @param {object} params - generateContent 參數（不需帶 model；由 chain 注入）
 * @param {object} [opts]
 * @param {string} [opts.preferredModel] - 優先嘗試的模型（排在 chain 最前）
 * @param {string[]} [opts.chain] - 自訂 chain（覆寫預設與環境變數）
 * @param {(info:{from:string,to:string,index:number,error:Error})=>void} [opts.onFallback] - 每次降級時呼叫（可更新進度）
 * @param {string} [opts.logPrefix]
 * @returns {Promise<object>} 原始 generateContent 回應
 */
export async function generateContentWithFallback(client, params, opts = {}) {
  const chain = opts.chain || getModelChain(opts.preferredModel);
  const logPrefix = opts.logPrefix || '[Gemini Fallback]';
  let lastError;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const response = await client.models.generateContent({ ...params, model });
      if (i > 0) console.log(`${logPrefix} ✅ 已改用備援模型 ${model} 成功`);
      return response;
    } catch (error) {
      lastError = error;
      const hasNext = i < chain.length - 1;
      if (hasNext && isGeminiOverloadError(error)) {
        const next = chain[i + 1];
        const code = error.status ?? error.code ?? '';
        console.warn(`${logPrefix} ⚠️  ${model} 過載${code ? ` (${code})` : ''}，降級到 ${next}`);
        if (typeof opts.onFallback === 'function') {
          try { opts.onFallback({ from: model, to: next, index: i, error }); } catch { /* ignore */ }
        }
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * 串流版本：只在「還沒吐出任何 chunk」前才允許降級，
 * 避免使用者已收到部分內容後又重來造成內容重複／錯亂。
 * 過載通常發生在連線/首 token 之前，所以這個策略能涵蓋大多數 503。
 *
 * @param {object} client - GoogleGenAI 實例
 * @param {object} params - generateContentStream 參數（不需帶 model）
 * @param {object} [handlers] - { onChunk(text) }
 * @param {object} [opts] - 同 generateContentWithFallback
 * @returns {Promise<{text:string, model:string, lastChunk:object|null}>}
 */
export async function generateContentStreamWithFallback(client, params, handlers = {}, opts = {}) {
  const chain = opts.chain || getModelChain(opts.preferredModel);
  const logPrefix = opts.logPrefix || '[Gemini Fallback]';
  let lastError;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    let emitted = false;
    try {
      const stream = await client.models.generateContentStream({ ...params, model });
      let aggregatedText = '';
      let lastChunk = null;
      for await (const chunk of stream) {
        lastChunk = chunk;
        const chunkText = chunk.text;
        if (chunkText) {
          emitted = true;
          aggregatedText += chunkText;
          if (typeof handlers.onChunk === 'function') handlers.onChunk(chunkText);
        }
      }
      if (i > 0) console.log(`${logPrefix} ✅ 已改用備援模型 ${model} 完成串流`);
      return { text: aggregatedText, model, lastChunk };
    } catch (error) {
      lastError = error;
      const hasNext = i < chain.length - 1;
      // 已經吐過內容就不能再換模型重來，只能往上拋
      if (!emitted && hasNext && isGeminiOverloadError(error)) {
        const next = chain[i + 1];
        const code = error.status ?? error.code ?? '';
        console.warn(`${logPrefix} ⚠️  ${model} 串流過載${code ? ` (${code})` : ''}，降級到 ${next}`);
        if (typeof opts.onFallback === 'function') {
          try { opts.onFallback({ from: model, to: next, index: i, error }); } catch { /* ignore */ }
        }
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
