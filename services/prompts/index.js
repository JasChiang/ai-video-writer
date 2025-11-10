import { TEMPLATE_METADATA, getAllTemplateMetadata, getTemplateMetadata } from './templateMetadata.js';

// 公開版本模板（開源）
import { generateDefaultPrompt } from './templates/default.js';
import { generateEcosystemLoyalistPrompt } from './templates/ecosystem-loyalist.js';
import { generatePragmaticPerformerPrompt } from './templates/pragmatic-performer.js';
import { generateLifestyleIntegratorPrompt } from './templates/lifestyle-integrator.js';
import { generateReliabilitySeekerPrompt } from './templates/reliability-seeker.js';

// 公開版本模板映射
const PUBLIC_TEMPLATE_GENERATORS = {
  default: generateDefaultPrompt,
  'ecosystem-loyalist': generateEcosystemLoyalistPrompt,
  'pragmatic-performer': generatePragmaticPerformerPrompt,
  'lifestyle-integrator': generateLifestyleIntegratorPrompt,
  'reliability-seeker': generateReliabilitySeekerPrompt,
};

// 專屬模板快取
let customTemplatesCache = null;
let customTemplatesMetadata = null;
let customTemplatesLoading = null;
let customTemplatesLastLoaded = null;
let customTemplatesDisabled = false;

const normalizePromptTemplate = (value) => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join('\n');
  }
  return null;
};

function renderTemplatePrompt(promptTemplate, videoTitle, userPrompt = '') {
  let result = promptTemplate.replace(/\$\{videoTitle\}/g, videoTitle);

  if (userPrompt && userPrompt.trim()) {
    const userPromptSection = `\n\n## 使用者額外要求\n${userPrompt}\n`;
    result = result.replace(/\$\{userPrompt\}/g, userPromptSection);
  } else {
    result = result.replace(/\$\{userPrompt \? .*? : .*?\}/g, '');
    result = result.replace(/\$\{userPrompt\}/g, '');
  }

  return result;
}

function pickPromptFromConfig(config, templateId) {
  if (typeof config === 'string') {
    return {
      promptTemplate: config,
      metadataOverride: null,
    };
  }

  if (Array.isArray(config)) {
    return {
      promptTemplate: normalizePromptTemplate(config),
      metadataOverride: null,
    };
  }

  if (config && typeof config === 'object') {
    const {
      prompt,
      template,
      body,
      text,
      metadata,
      ...inlineMetadata
    } = config;

    const promptTemplate =
      normalizePromptTemplate(prompt) ??
      normalizePromptTemplate(template) ??
      normalizePromptTemplate(body) ??
      normalizePromptTemplate(text);

    if (!promptTemplate) {
      console.warn(`[Prompts] 自訂模板 ${templateId} 缺少 prompt 內容，已略過`);
      return null;
    }

    const metadataFromBlock = metadata && typeof metadata === 'object' ? metadata : {};
    const metadataOverride = Object.keys(inlineMetadata).length > 0
      ? { ...inlineMetadata, ...metadataFromBlock }
      : metadataFromBlock;

    return {
      promptTemplate,
      metadataOverride,
    };
  }

  console.warn(`[Prompts] 自訂模板 ${templateId} 格式不正確，已略過`);
  return null;
}

function resolveTemplateMetadata(templateId, metadataOverride = {}) {
  const base = TEMPLATE_METADATA[templateId] || {};

  return {
    id: templateId,
    name: metadataOverride.name || base.name || templateId,
    description: metadataOverride.description || base.description || '自訂模板',
    icon: metadataOverride.icon || base.icon || '📝',
    category: metadataOverride.category || base.category || 'custom',
    targetAudience: metadataOverride.targetAudience || base.targetAudience,
    platforms: metadataOverride.platforms || base.platforms,
    keywords: metadataOverride.keywords || base.keywords,
    source: metadataOverride.source || 'custom',
  };
}

/**
 * 從遠端載入專屬模板
 * 支援組織或個人自訂的提示詞模板
 */
async function loadCustomTemplates() {
  // 如果已經載入過，直接返回快取
  if (customTemplatesCache) {
    return customTemplatesCache;
  }

  // 如果正在載入中，等待完成
  if (customTemplatesLoading) {
    return customTemplatesLoading;
  }

  // 從環境變數取得遠端模板 URL
  const CUSTOM_TEMPLATE_URL = process.env.CUSTOM_TEMPLATE_URL;

  // 沒有設定遠端 URL 或者手動停用
  if (!CUSTOM_TEMPLATE_URL || customTemplatesDisabled) {
    if (!CUSTOM_TEMPLATE_URL) {
      console.log('[Prompts] ℹ️  未設定自訂模板，使用內建模板');
    } else {
      console.log('[Prompts] ℹ️  自訂模板已停用，使用內建模板');
    }
    return null;
  }

  // 開始載入
  customTemplatesLoading = (async () => {
    try {
      // 附加時間戳以強制繞過快取
      const cacheBustedUrl = `${CUSTOM_TEMPLATE_URL}${CUSTOM_TEMPLATE_URL.includes('?') ? '&' : '?'}v=${Date.now()}`;

      console.log(`[Prompts] 正在從 ${cacheBustedUrl} 載入...`);

      const response = await fetch(cacheBustedUrl, {
        headers: {
          // 如果需要認證（例如使用 GitHub Private Gist）
          ...(process.env.CUSTOM_TEMPLATE_TOKEN && {
            'Authorization': `Bearer ${process.env.CUSTOM_TEMPLATE_TOKEN}`
          })
        },
        // 繞過快取，確保每次都取得最新版本
        cache: 'no-cache',
        // 設定超時
        signal: AbortSignal.timeout(10000) // 10 秒超時
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const customTemplates = await response.json();

      // 轉換為生成函數與 metadata
      const generators = {};
      const metadataList = [];

      for (const [templateId, promptConfig] of Object.entries(customTemplates)) {
        const normalized = pickPromptFromConfig(promptConfig, templateId);
        if (!normalized) {
          continue;
        }

        const { promptTemplate, metadataOverride } = normalized;

        generators[templateId] = (videoTitle, userPrompt = '') =>
          renderTemplatePrompt(promptTemplate, videoTitle, userPrompt);

        metadataList.push(resolveTemplateMetadata(templateId, metadataOverride || {}));
      }

      customTemplatesCache = Object.keys(generators).length > 0 ? generators : null;
      customTemplatesMetadata = customTemplatesCache ? metadataList : null;
      customTemplatesLastLoaded = customTemplatesCache ? new Date().toISOString() : null;

      if (!customTemplatesCache) {
        console.warn('[Prompts] 提供的自訂模板為空，將使用內建模板');
        return null;
      }

      console.log('[Prompts] ✅ 載入專屬模板成功');
      return generators;

    } catch (error) {
      console.error('[Prompts] ❌ 載入專屬模板失敗:', error.message);
      console.log('[Prompts] ℹ️  降級使用內建模板');
      customTemplatesLastLoaded = null;
      return null;
    } finally {
      customTemplatesLoading = null;
    }
  })();

  return customTemplatesLoading;
}

// 應用啟動時預載入（可選，加快首次請求速度）
if (process.env.CUSTOM_TEMPLATE_URL) {
  loadCustomTemplates().catch(err => {
    console.error('[Prompts] 預載入專屬模板失敗:', err.message);
  });
}

/**
 * 生成指定模板的提示詞
 * @param {string} templateId - 模板 ID
 * @param {string} videoTitle - 影片標題
 * @param {string} userPrompt - 使用者自訂提示
 * @returns {Promise<string>} 完整的提示詞
 */
export async function generatePromptFromTemplate(templateId, videoTitle, userPrompt = '') {
  // 嘗試載入專屬模板
  const customTemplates = await loadCustomTemplates();

  // 優先使用專屬版本，否則使用公開版本
  const generator =
    (customTemplates && customTemplates[templateId]) ||
    (customTemplates && customTemplates.default) ||
    PUBLIC_TEMPLATE_GENERATORS[templateId] ||
    PUBLIC_TEMPLATE_GENERATORS.default;

  if (typeof generator !== 'function') {
    throw new Error(`找不到可用的模板：${templateId}`);
  }

  return generator(videoTitle, userPrompt);
}

export function getAllTemplates() {
  return getAllTemplateMetadata();
}

export async function getTemplatesMetadata() {
  const customTemplates = await loadCustomTemplates();

  if (customTemplates && customTemplatesMetadata && customTemplatesMetadata.length > 0) {
    return customTemplatesMetadata;
  }

  return getAllTemplateMetadata().map(template => ({
    ...template,
    source: 'built-in'
  }));
}

export function getTemplate(templateId) {
  return getTemplateMetadata(templateId);
}

/**
 * 檢查是否使用專屬模板
 * @returns {boolean}
 */
export function isUsingCustomTemplates() {
  return customTemplatesCache !== null;
}

export function getCustomTemplatesStatus() {
  return {
    usingCustomTemplates: customTemplatesCache !== null,
    lastLoadedAt: customTemplatesLastLoaded,
    disabled: customTemplatesDisabled,
  };
}

/**
 * 清除專屬模板快取（用於重新載入）
 */
export function clearCustomTemplatesCache() {
  customTemplatesCache = null;
  customTemplatesMetadata = null;
  customTemplatesLoading = null;
  console.log('[Prompts] 🔄 專屬模板快取已清除');
}

export async function refreshCustomTemplates() {
  clearCustomTemplatesCache();
  return loadCustomTemplates();
}

export function disableCustomTemplates() {
  customTemplatesDisabled = true;
  clearCustomTemplatesCache();
}

export function enableCustomTemplates() {
  customTemplatesDisabled = false;
  clearCustomTemplatesCache();
}
