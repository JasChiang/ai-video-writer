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
let customTemplatesLoading = null;

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

  // 沒有設定遠端 URL，使用公開版本
  if (!CUSTOM_TEMPLATE_URL) {
    console.log('[Prompts] ℹ️  未設定自訂模板，使用內建模板');
    return null;
  }

  // 開始載入
  customTemplatesLoading = (async () => {
    try {
      console.log('[Prompts] 🔄 正在載入專屬模板...');

      const response = await fetch(CUSTOM_TEMPLATE_URL, {
        headers: {
          // 如果需要認證（例如使用 GitHub Private Gist）
          ...(process.env.CUSTOM_TEMPLATE_TOKEN && {
            'Authorization': `Bearer ${process.env.CUSTOM_TEMPLATE_TOKEN}`
          })
        },
        // 設定超時
        signal: AbortSignal.timeout(10000) // 10 秒超時
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const customTemplates = await response.json();

      // 轉換為生成函數
      const generators = {};
      for (const [templateId, promptTemplate] of Object.entries(customTemplates)) {
        generators[templateId] = (videoTitle, userPrompt = '') => {
          // 支援模板變數替換
          let result = promptTemplate
            .replace(/\$\{videoTitle\}/g, videoTitle);

          // 處理 userPrompt（如果有的話）
          if (userPrompt && userPrompt.trim()) {
            const userPromptSection = `\n\n## 使用者額外要求\n${userPrompt}\n`;
            result = result.replace(/\$\{userPrompt\}/g, userPromptSection);
          } else {
            // 如果沒有 userPrompt，移除相關的條件區塊
            result = result.replace(/\$\{userPrompt \? [`'].*?[`'] : ['"']\}/g, '');
            result = result.replace(/\$\{userPrompt\}/g, '');
          }

          return result;
        };
      }

      customTemplatesCache = generators;
      console.log('[Prompts] ✅ 載入專屬模板成功');
      return generators;

    } catch (error) {
      console.error('[Prompts] ❌ 載入專屬模板失敗:', error.message);
      console.log('[Prompts] ℹ️  降級使用內建模板');
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
  const generators = customTemplates || PUBLIC_TEMPLATE_GENERATORS;
  const generator = generators[templateId] || generators.default;

  return generator(videoTitle, userPrompt);
}

export function getAllTemplates() {
  return getAllTemplateMetadata();
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

/**
 * 清除專屬模板快取（用於重新載入）
 */
export function clearCustomTemplatesCache() {
  customTemplatesCache = null;
  customTemplatesLoading = null;
  console.log('[Prompts] 🔄 專屬模板快取已清除');
}
