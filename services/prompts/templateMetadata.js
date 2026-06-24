export const TEMPLATE_METADATA = {
  'aeo-html-v5': {
    id: 'aeo-html-v5',
    name: 'HTML 文章',
    description: 'SEO/AEO/GEO 三合一 HTML 文章，snippet-first 結構，可直接貼入 CMS',
    icon: '🌐',
    category: 'seo',
    targetAudience: '內容行銷、SEO 寫手、自媒體創作者',
    platforms: ['部落格', 'CMS', 'WordPress', 'Notion'],
    outputFormat: 'html',
  },

  default: {
    id: 'default',
    name: '預設模板',
    description: '通用型的文章模板',
    icon: '📝',
    category: 'general',
    targetAudience: '一般網路使用者',
    platforms: ['部落格']
  },

  'ecosystem-loyalist': {
    id: 'ecosystem-loyalist',
    name: '生態忠誠者',
    description: '強調品牌整合、生態系無縫體驗、尊榮感',
    icon: '🏆',
    category: 'premium',
    targetAudience: '蘋果、三星等品牌忠誠用戶',
    platforms: ['YouTube (視覺展示整合)', '生活誌 (深度體驗文)'],
    keywords: ['整合', '生態系', '無縫體驗', '尊榮']
  },

  'pragmatic-performer': {
    id: 'pragmatic-performer',
    name: '務實效能者',
    description: '聚焦 CP 值、規格分析、效能實測',
    icon: '⚡',
    category: 'professional',
    targetAudience: '規格控、分析型消費者、專家型受眾',
    platforms: ['生活誌 (深度規格分析)', 'YouTube (效能實測)'],
    keywords: ['CP值', '規格', '效能', '性價比']
  },

  'lifestyle-integrator': {
    id: 'lifestyle-integrator',
    name: '生活整合者',
    description: '展示生活情境、便利性、美學設計',
    icon: '🏡',
    category: 'lifestyle',
    targetAudience: '家長、健康專業人士、風格玩家/創作者',
    platforms: ['生活誌 (情境指南)', 'YouTube (一日生活)'],
    keywords: ['情境', '便利', '生活品質', '美學'],
    subPersonas: ['互聯家長', '健康專業人士', '風格玩家/創作者']
  },

  'reliability-seeker': {
    id: 'reliability-seeker',
    name: '信賴致上者',
    description: '強調簡易操作、耐用、服務保障',
    icon: '🛡️',
    category: 'service',
    targetAudience: '銀髮族及照護者、科技初學者、小型企業主',
    platforms: ['生活誌 (圖文教學)', 'YouTube (簡易操作示範)'],
    keywords: ['簡單', '耐用', '安心', '服務'],
    subPersonas: ['銀髮族及其照護者', '能用就好的使用者']
  }
};

export function getAllTemplateMetadata() {
  return Object.values(TEMPLATE_METADATA);
}

export function getTemplateMetadata(templateId) {
  return TEMPLATE_METADATA[templateId] || TEMPLATE_METADATA.default;
}
