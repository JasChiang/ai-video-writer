import React from 'react';
import { AppIcon, resolveIconName } from '../AppIcon';
import { Loader } from '../Loader';
import type { TemplateOption } from './types';

interface TemplateSelectorProps {
  isFetchingTemplates: boolean;
  templateFetchError: string | null;
  templatesStatus: { usingCustomTemplates: boolean; lastLoadedAt: string | null; disabled: boolean };
  templateLastLoadedLabel: string | null;
  isRefreshingTemplates: boolean;
  isTogglingTemplates: boolean;
  templateOptions: TemplateOption[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  onRefreshTemplates: () => void;
  onDisableCustomTemplates: () => void;
  onEnableCustomTemplates: () => void;
}

export function TemplateSelector({
  isFetchingTemplates,
  templateFetchError,
  templatesStatus,
  templateLastLoadedLabel,
  isRefreshingTemplates,
  isTogglingTemplates,
  templateOptions,
  selectedTemplateId,
  onSelectTemplate,
  onRefreshTemplates,
  onDisableCustomTemplates,
  onEnableCustomTemplates,
}: TemplateSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">
        文章模板
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        選擇對應的讀者角色或風格，Gemini 會以該模板生成文章架構與語氣。
      </p>
      <div className="mt-2 space-y-1">
        {isFetchingTemplates && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Loader />
            <span>正在同步遠端模板...</span>
          </div>
        )}
        {templateFetchError && (
          <p className="text-xs text-red-600">{templateFetchError}</p>
        )}
        {templatesStatus.disabled ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>目前已停用遠端模板，系統使用內建模板。</span>
            <button
              type="button"
              onClick={onEnableCustomTemplates}
              disabled={isTogglingTemplates}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-green-500 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTogglingTemplates ? '啟用中...' : '重新啟用遠端模板'}
            </button>
          </div>
        ) : templatesStatus.usingCustomTemplates ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            {templateLastLoadedLabel && <span>最後更新：{templateLastLoadedLabel}</span>}
            <button
              type="button"
              onClick={onRefreshTemplates}
              disabled={isRefreshingTemplates}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshingTemplates ? '重新載入中...' : '重新載入遠端模板'}
            </button>
            <button
              type="button"
              onClick={onDisableCustomTemplates}
              disabled={isTogglingTemplates}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTogglingTemplates ? '切換中...' : '退出自訂模板'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>目前使用內建模板。</span>
            <button
              type="button"
              onClick={onEnableCustomTemplates}
              disabled={isTogglingTemplates}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-green-500 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTogglingTemplates ? '啟用中...' : '啟用遠端模板'}
            </button>
          </div>
        )}
      </div>
      {templateOptions.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {templateOptions.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (
              <label
                key={template.id}
                className={`relative flex h-full cursor-pointer flex-col rounded-xl border p-4 text-left transition ${
                  isSelected ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-neutral-200 hover:border-red-300'
                }`}
              >
                <input
                  type="radio"
                  name="article-template"
                  value={template.id}
                  checked={isSelected}
                  onChange={() => onSelectTemplate(template.id)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xl text-red-600" aria-hidden="true">
                    <AppIcon name={resolveIconName(template.icon)} size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{template.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {template.category && (
                        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                          {template.category}
                        </span>
                      )}
                      {template.source === 'custom' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          自訂模板
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{template.description}</p>
                {template.targetAudience && (
                  <p className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
                    <AppIcon name="target" size={14} className="text-red-500" />
                    {template.targetAudience}
                  </p>
                )}
                {template.platforms && template.platforms.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-400 flex items-center gap-1">
                    <AppIcon name="mapPin" size={14} className="text-red-500" />
                    {template.platforms.join(' / ')}
                  </p>
                )}
                {isSelected && (
                  <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                    已選擇
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">
          找不到可用的模板設定，系統將使用預設風格。
        </p>
      )}
    </div>
  );
}
