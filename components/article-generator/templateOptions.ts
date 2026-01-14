import { TEMPLATE_METADATA } from '../../services/server/prompts/templateMetadata.js';
import type { TemplateOption } from './types';

export const getDefaultTemplateOptions = (): TemplateOption[] => {
  return Object.values(TEMPLATE_METADATA as Record<string, any>).map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    targetAudience: template.targetAudience,
    platforms: template.platforms,
    keywords: template.keywords,
    source: 'built-in',
  }));
};
