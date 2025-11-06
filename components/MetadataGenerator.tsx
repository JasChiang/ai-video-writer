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
  const [selectedTitle, setSelectedTitle] = useState<'titleA' | 'titleB' | 'titleC'>('titleA');
  const [editableContent, setEditableContent] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags.join(', '),
  });
  const [youtubeCurrentValues, setYoutubeCurrentValues] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>({ title: 'idle', description: 'idle', tags: 'idle' });
  const [geminiFileName, setGeminiFileName] = useState<string | undefined>(undefined);

  // 載入快取內容
  useEffect(() => {
    if (cachedContent) {
      setGeneratedContent(cachedContent);
    }
  }, [cachedContent]);

  useEffect(() => {
    if (generatedContent) {
      setEditableContent({
        title: generatedContent[selectedTitle],
        description: generatedContent.description,
        tags: generatedContent.tags.join(', '),
      });
    }
  }, [generatedContent, selectedTitle]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const privacyStatus = video.privacyStatus || 'public';

      // 使用異步版本（適合手機端，避免切換分頁時中斷）
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
      // 更新快取
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

  const handleUpdate = async (field: 'title' | 'description' | 'tags') => {
    setUpdateState(prev => ({ ...prev, [field]: 'loading' }));
    try {
      const tagsToUpdate = field === 'tags'
        ? editableContent.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : youtubeCurrentValues.tags;

      const videoDataToUpdate: YouTubeVideo = {
        id: video.id,
        categoryId: video.categoryId,
        title: field === 'title' ? editableContent.title : youtubeCurrentValues.title,
        description: field === 'description' ? editableContent.description : youtubeCurrentValues.description,
        tags: tagsToUpdate,
        thumbnailUrl: video.thumbnailUrl,
      };

      await youtubeService.updateVideo(videoDataToUpdate, {
        source: 'MetadataGenerator',
        trigger: `metadata-update-${field}`,
      });

      if (field === 'title') {
        setYoutubeCurrentValues(prev => ({ ...prev, title: editableContent.title }));
      } else if (field === 'description') {
        setYoutubeCurrentValues(prev => ({ ...prev, description: editableContent.description }));
      } else if (field === 'tags') {
        setYoutubeCurrentValues(prev => ({ ...prev, tags: tagsToUpdate }));
      }

      setUpdateState(prev => ({ ...prev, [field]: 'success' }));
    } catch (e: any) {
      console.error('Update failed', e);
      setUpdateState(prev => ({ ...prev, [field]: 'error' }));
    } finally {
      setTimeout(() => setUpdateState(prev => ({ ...prev, [field]: 'idle' })), 2000);
    }
  };

  const getButtonContent = (status: UpdateStatus) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>;
      case 'success':
        return <CheckIcon />;
      case 'error':
        return 'Retry';
      default:
        return 'Update';
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
        <div className="space-y-4 animate-fade-in">
          {/* Title Options */}
          <div>
            <label className="text-sm font-semibold mb-1 block text-neutral-700">建議標題（請選擇一個）</label>
            <p className="text-xs mb-2 text-neutral-500">
              💡 Gemini AI 提供三種不同風格的標題，點選即可選擇並編輯
            </p>
            <div className="space-y-2 mb-3">
              <div
                onClick={() => setSelectedTitle('titleA')}
                className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                  selectedTitle === 'titleA'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    selectedTitle === 'titleA' ? 'text-white/80' : 'text-neutral-500'
                  }`}
                >
                  選項 A（關鍵字導向）
                </div>
                <div>{generatedContent.titleA}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleB')}
                className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                  selectedTitle === 'titleB'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    selectedTitle === 'titleB' ? 'text-white/80' : 'text-neutral-500'
                  }`}
                >
                  選項 B（懸念/好奇心導向）
                </div>
                <div>{generatedContent.titleB}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleC')}
                className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                  selectedTitle === 'titleC'
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300'
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    selectedTitle === 'titleC' ? 'text-white/80' : 'text-neutral-500'
                  }`}
                >
                  選項 C（結果/效益導向）
                </div>
                <div>{generatedContent.titleC}</div>
              </div>
            </div>

            {/* Editable Title */}
            <label className="text-xs mb-1 block text-neutral-500">編輯選定的標題</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={editableContent.title}
                onChange={e => setEditableContent(prev => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
              <button
                onClick={() => handleUpdate('title')}
                className="text-white font-bold px-3 rounded-full text-sm w-24 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {getButtonContent(updateState.title)}
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-neutral-700">影片說明（包含章節與標籤）</label>
            <div className="text-xs mb-1 space-y-0.5 text-neutral-500">
              <p>此欄位包含完整的影片說明、章節導覽和說明用標籤</p>
              <p className="text-neutral-400">💡 Gemini AI 會自動生成章節時間軸（格式：00:00），並在說明中加入相關標籤以提升搜尋能見度</p>
            </div>
            <div className="flex gap-2 mt-1">
              <textarea
                value={editableContent.description}
                onChange={e => setEditableContent(prev => ({ ...prev, description: e.target.value }))}
                rows={8}
                className="w-full rounded-lg px-3 py-2 font-mono text-sm bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
              <button
                onClick={() => handleUpdate('description')}
                className="text-white font-bold px-3 rounded-full text-sm w-24 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {getButtonContent(updateState.description)}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold text-neutral-700">後台標籤（逗號分隔）</label>
            <div className="text-xs mb-1 space-y-0.5 text-neutral-500">
              <p>這些標籤會設定在 YouTube 後台，不含 # 符號</p>
              <p className="text-neutral-400">💡 Gemini AI 根據影片內容選擇相關關鍵字，幫助 YouTube 演算法推薦您的影片給目標觀眾</p>
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={editableContent.tags}
                onChange={e => setEditableContent(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
              <button
                onClick={() => handleUpdate('tags')}
                className="text-white font-bold px-3 rounded-full text-sm w-24 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {getButtonContent(updateState.tags)}
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-4 space-y-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full text-center text-sm py-2 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {isLoading ? '🔄 生成中...' : '🔄 重新生成（讓 AI 提供不同的建議）'}
            </button>
            <p className="text-xs text-center text-neutral-400">
              💡 Gemini AI 每次分析都可能產生不同風格的標題和說明，重新生成可獲得更多靈感
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
