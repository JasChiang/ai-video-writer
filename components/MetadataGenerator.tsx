import React, { useState, useEffect } from 'react';
import type { GeneratedContentType, YouTubeVideo } from '../types';
import * as geminiService from '../services/geminiService';
import * as youtubeService from '../services/youtubeService';
import { Loader } from './Loader';
import { SparklesIcon, CheckIcon } from './Icons';

interface MetadataGeneratorProps {
  video: YouTubeVideo;
  onClose: () => void;
  cachedContent?: GeneratedContentType | null;
  onContentUpdate?: (content: GeneratedContentType | null) => void;
}

type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';
interface UpdateState {
  title: UpdateStatus;
  description: UpdateStatus;
  tags: UpdateStatus;
}

export function MetadataGenerator({ video, onClose, cachedContent, onContentUpdate }: MetadataGeneratorProps) {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentType | null>(cachedContent || null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [geminiFileName, setGeminiFileName] = useState<string | undefined>(undefined);

  // 原始影片資料，作為比較的基準
  const [originalContent] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags || [],
  });

  // 用於使用者編輯的草稿狀態
  const [draftContent, setDraftContent] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags.join(', '),
  });

  // 追蹤變更的狀態
  const [isDirty, setIsDirty] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  // 載入快取內容
  useEffect(() => {
    if (cachedContent) {
      setGeneratedContent(cachedContent);
    }
  }, [cachedContent]);

  // 當影片切換時，重設所有狀態
  useEffect(() => {
    setDraftContent({
      title: video.title,
      description: video.description,
      tags: video.tags.join(', '),
    });
    setGeneratedContent(cachedContent || null);
    setError(null);
    setIsLoading(false);
    setUpdateStatus('idle');
  }, [video, cachedContent]);

  // 檢查草稿與原始資料是否有差異
  useEffect(() => {
    const tagsHaveChanged = draftContent.tags.split(',').map(t => t.trim()).filter(Boolean).join(',') !== originalContent.tags.join(',');
    const hasChanges = draftContent.title !== originalContent.title ||
                       draftContent.description !== originalContent.description ||
                       tagsHaveChanged;
    setIsDirty(hasChanges);
  }, [draftContent, originalContent]);


  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const privacyStatus = video.privacyStatus || 'public';
      const result = await geminiService.generateVideoMetadataAsync(
        video.id,
        prompt,
        video.title,
        privacyStatus,
        video.thumbnailUrl,
        geminiFileName,
        (step: string) => {
          setLoadingStep(step);
          console.log(`[Progress] ${step}`);
        }
      );

      if (result.geminiFileName) {
        setGeminiFileName(result.geminiFileName);
      }

      setGeneratedContent(result.content);
      if (onContentUpdate) {
        onContentUpdate(result.content);
      }
    } catch (e: any) {
      console.error(e);
      setError(`生成失敗：${e.message}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleUpdateAll = async () => {
    if (!isDirty) return;

    const isConfirmed = window.confirm(
      "您確定要將變更更新到 YouTube 嗎？\n\n此操作將花費 50 點 API 配額。"
    );

    if (!isConfirmed) {
      return;
    }

    setUpdateStatus('loading');
    try {
      const tagsToUpdate = draftContent.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      const videoDataToUpdate: YouTubeVideo = {
        id: video.id,
        categoryId: video.categoryId,
        title: draftContent.title,
        description: draftContent.description,
        tags: tagsToUpdate,
        thumbnailUrl: video.thumbnailUrl, // Not updated, but part of the type
      };

      await youtubeService.updateVideo(videoDataToUpdate, {
        source: 'MetadataGenerator',
        trigger: 'metadata-update-all',
      });

      setUpdateStatus('success');
      // 更新成功後，將當前的草稿設為新的原始基準
      setOriginalContent({
        title: draftContent.title,
        description: draftContent.description,
        tags: tagsToUpdate,
      });

    } catch (e: any) {
      console.error('Update failed', e);
      setError(`更新失敗: ${e.message}`);
      setUpdateStatus('error');
    } finally {
      setTimeout(() => setUpdateStatus('idle'), 2000);
    }
  };

  // 採用建議的函式
  const handleApplySuggestion = (field: 'title' | 'description' | 'tags', value: string | string[]) => {
    if (field === 'title') {
      setDraftContent(prev => ({ ...prev, title: value as string }));
    } else if (field === 'description') {
      setDraftContent(prev => ({ ...prev, description: value as string }));
    } else if (field === 'tags') {
      setDraftContent(prev => ({ ...prev, tags: (value as string[]).join(', ') }));
    }
  };

  const getButtonContent = (status: UpdateStatus) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>;
      case 'success':
        return <CheckIcon />;
      default:
        return '更新到 YouTube';
    }
  };

  return (
    <div className="rounded-2xl p-6 bg-white border border-neutral-200 shadow-sm space-y-6">
      {/* Prompt Input */}
      {!generatedContent && !isLoading && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-neutral-700">
            額外提示（選填）
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：適合初學者的有趣教學"
            className="w-full rounded-lg px-3 py-2 bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
          />
        </div>
      )}

      {/* Generate Button */}
      {!generatedContent && !isLoading && !error && (
        <div className="space-y-3">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-full transition-transform duration-200 transform hover:scale-105 bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md"
          >
            <SparklesIcon /> 使用 Gemini AI 生成 SEO 強化內容
          </button>
          <div className="space-y-2">
            <p className="text-xs text-center text-neutral-600">
              Gemini AI 將分析影片內容，自動生成三種風格標題、章節時間軸及 SEO 標籤
            </p>
            <p className="text-xs text-center text-neutral-400">
              💡 處理流程：檢查雲端檔案 → 分析影片內容 → 生成 SEO 強化建議（公開影片約 30 秒，未列出影片首次需下載約 2-5 分鐘）
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-4 rounded-lg bg-neutral-100 border border-neutral-200">
          <div className="flex items-center gap-3">
            <Loader />
            <span className="text-sm text-neutral-600">{loadingStep}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {/* Generated Content Form */}
      {generatedContent && (
        <div className="space-y-6 animate-fade-in">
          {/* Title Section */}
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-800">標題</h3>
            <div className="space-y-2">
              {(['titleA', 'titleB', 'titleC'] as const).map((key, index) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-grow p-3 rounded-md bg-neutral-100 text-sm text-neutral-700">
                    <span className="text-xs text-neutral-500">建議 {String.fromCharCode(65 + index)}: </span>
                    {generatedContent[key]}
                  </div>
                  <button 
                    onClick={() => handleApplySuggestion('title', generatedContent[key])}
                    className="flex-shrink-0 rounded-md px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    採用
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs mb-1 block text-neutral-500">最終預覽 (可編輯)</label>
              <input
                type="text"
                value={draftContent.title}
                onChange={e => setDraftContent(prev => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-800">影片說明</h3>
            <div className="flex items-start gap-2">
              <div className="flex-grow p-3 rounded-md bg-neutral-100 text-sm text-neutral-700 whitespace-pre-wrap font-mono">{
                generatedContent.description
              }</div>
              <button 
                onClick={() => handleApplySuggestion('description', generatedContent.description)}
                className="flex-shrink-0 rounded-md px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                採用
              </button>
            </div>
            <div>
              <label className="text-xs mb-1 block text-neutral-500">最終預覽 (可編輯)</label>
              <textarea
                value={draftContent.description}
                onChange={e => setDraftContent(prev => ({ ...prev, description: e.target.value }))}
                rows={8}
                className="w-full rounded-lg px-3 py-2 font-mono text-sm bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-800">後台標籤</h3>
            <div className="flex items-start gap-2">
              <div className="flex-grow p-3 rounded-md bg-neutral-100 text-sm text-neutral-700">
                {generatedContent.tags.join(', ')}
              </div>
              <button 
                onClick={() => handleApplySuggestion('tags', generatedContent.tags)}
                className="flex-shrink-0 rounded-md px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                採用
              </button>
            </div>
            <div>
              <label className="text-xs mb-1 block text-neutral-500">最終預覽 (可編輯，以逗號分隔)</label>
              <input
                type="text"
                value={draftContent.tags}
                onChange={e => setDraftContent(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-neutral-200 pt-4 space-y-4">
            <button
              onClick={handleUpdateAll}
              disabled={!isDirty || updateStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-full transition-all duration-200 transform hover:scale-105 bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md disabled:bg-neutral-400 disabled:cursor-not-allowed disabled:scale-100"
            >
              {getButtonContent(updateStatus)}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full text-center text-sm py-2 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {isLoading ? '🔄 生成中...' : '🔄 重新生成（讓 AI 提供不同的建議）'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
