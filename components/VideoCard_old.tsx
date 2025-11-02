import React, { useState, useEffect } from 'react';
import type { GeneratedContentType, YouTubeVideo } from '../types';
import * as geminiService from '../services/geminiService';
import * as youtubeService from '../services/youtubeService';
import { Loader } from './Loader';
import { SparklesIcon, CheckIcon } from './Icons';
import { ArticleGenerator } from './ArticleGenerator';

interface VideoCardProps {
  video: YouTubeVideo;
}

type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';
interface UpdateState {
  title: UpdateStatus;
  description: UpdateStatus;
  tags: UpdateStatus;
}

// FIX: Changed component from a plain function to React.FC to correctly handle React-specific props like `key`.
export const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentType | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<'titleA' | 'titleB' | 'titleC'>('titleA');
  const [editableContent, setEditableContent] = useState({
    title: video.title,
    description: video.description,
    tags: video.tags.join(', '),
  });
  // 追蹤 YouTube 上的最新值（已成功更新的值）
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
  // 追蹤 Gemini 檔案名稱（用於未列出影片的重新生成）
  const [geminiFileName, setGeminiFileName] = useState<string | undefined>(undefined);
  // 文章生成模式
  const [showArticleGenerator, setShowArticleGenerator] = useState(false);

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

      // 根據影片類型顯示不同的進度訊息
      if (privacyStatus === 'public') {
        setLoadingStep('正在分析公開影片...');
        const result = await geminiService.generateVideoMetadata(
          video.id,
          prompt,
          video.title,
          privacyStatus,
          video.thumbnailUrl
        );
        setGeneratedContent(result.content);
      } else if (privacyStatus === 'unlisted') {
        // 如果有 geminiFileName，顯示檢查訊息
        if (geminiFileName) {
          setLoadingStep('檢查是否可重新使用已上傳的影片...');
        } else {
          setLoadingStep('步驟 1/3: 正在下載未列出影片...');
        }

        // 使用 setTimeout 模擬進度更新（實際會由 API 回應時間決定）
        const step2Timer = setTimeout(() => {
          if (!geminiFileName) {
            setLoadingStep('步驟 2/3: 正在上傳到 Gemini 進行分析...');
          }
        }, 3000);

        const step3Timer = setTimeout(() => {
          setLoadingStep('步驟 3/3: Gemini 正在生成 SEO 內容...');
        }, 8000);

        try {
          const result = await geminiService.generateVideoMetadata(
            video.id,
            prompt,
            video.title,
            privacyStatus,
            video.thumbnailUrl,
            geminiFileName
          );
          clearTimeout(step2Timer);
          clearTimeout(step3Timer);

          // 儲存 Gemini 檔案名稱以供重新生成使用
          if (result.geminiFileName) {
            setGeminiFileName(result.geminiFileName);
            console.log(`[VideoCard] Saved Gemini file name: ${result.geminiFileName}`);
          }

          setGeneratedContent(result.content);
        } catch (e) {
          clearTimeout(step2Timer);
          clearTimeout(step3Timer);
          throw e;
        }
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
      // 使用 YouTube 上的最新值 + 當前編輯的欄位值
      const tagsToUpdate = field === 'tags'
        ? editableContent.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : youtubeCurrentValues.tags;

      const videoDataToUpdate: YouTubeVideo = {
        id: video.id,
        categoryId: video.categoryId,
        title: field === 'title' ? editableContent.title : youtubeCurrentValues.title,
        description: field === 'description' ? editableContent.description : youtubeCurrentValues.description,
        tags: tagsToUpdate,
        thumbnailUrl: video.thumbnailUrl, // Not updated
      };

      console.log(`[VideoCard] Updating ${field}:`, videoDataToUpdate);
      console.log(`[VideoCard] youtubeCurrentValues:`, youtubeCurrentValues);
      console.log(`[VideoCard] editableContent:`, editableContent);
      await youtubeService.updateVideo(videoDataToUpdate);

      // 更新成功後，更新 YouTube 當前值
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
    <div className="bg-gray-800/50 rounded-2xl p-4 shadow-xl border border-gray-700 backdrop-blur-sm flex flex-col gap-4 transition-all duration-300">
      {/* Video Info */}
      <div className="flex gap-4">
        <img src={video.thumbnailUrl} alt={video.title} className="w-32 h-[72px] object-cover rounded-md shadow-lg" />
        <div className="flex-1">
          <p className="text-md font-semibold text-gray-200 line-clamp-2">{video.title}</p>
          {video.privacyStatus && video.privacyStatus !== 'public' && (
            <span className="inline-block mt-1 text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">
              {video.privacyStatus === 'unlisted' ? '未列出' : '私人'}
            </span>
          )}
        </div>
      </div>

      {/* Prompt Input - Always visible before generation */}
      {!generatedContent && !isLoading && (
        <div className="mb-2">
          <label htmlFor={`prompt-${video.id}`} className="block text-xs font-medium text-gray-400 mb-1">
            額外提示（選填）
          </label>
          <input
            type="text"
            id={`prompt-${video.id}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：適合初學者的有趣教學"
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Generation Control */}
      {!generatedContent && !isLoading && !error && (
        <>
          {video.privacyStatus === 'private' ? (
            <div className="w-full bg-gray-700 border border-gray-600 text-gray-400 font-bold py-2 px-4 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>私人影片不支援分析</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">請將影片改為「未列出」或「公開」</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105"
              >
                <SparklesIcon /> 生成 Metadata
              </button>
              <button
                onClick={() => setShowArticleGenerator(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                生成文章
              </button>
            </div>
          )}
        </>
      )}

      {/* States */}
      {isLoading && (
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader />
            <span className="text-gray-300 text-sm">{loadingStep}</span>
          </div>
        </div>
      )}
      {error && <div className="text-red-400 bg-red-900/30 p-3 rounded-lg text-sm">{error}</div>}

      {/* Generated Content Form */}
      {generatedContent && (
        <div className="space-y-4 animate-fade-in">
          {/* Title Options */}
          <div>
            <label className="text-sm font-semibold text-gray-300 mb-2 block">建議標題（請選擇一個）</label>
            <div className="space-y-2 mb-3">
              <div
                onClick={() => setSelectedTitle('titleA')}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedTitle === 'titleA'
                    ? 'bg-indigo-600 border-2 border-indigo-400'
                    : 'bg-gray-700 border-2 border-gray-600 hover:border-indigo-500'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">選項 A（關鍵字導向）</div>
                <div className="text-white">{generatedContent.titleA}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleB')}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedTitle === 'titleB'
                    ? 'bg-indigo-600 border-2 border-indigo-400'
                    : 'bg-gray-700 border-2 border-gray-600 hover:border-indigo-500'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">選項 B（懸念/好奇心導向）</div>
                <div className="text-white">{generatedContent.titleB}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleC')}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedTitle === 'titleC'
                    ? 'bg-indigo-600 border-2 border-indigo-400'
                    : 'bg-gray-700 border-2 border-gray-600 hover:border-indigo-500'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">選項 C（結果/效益導向）</div>
                <div className="text-white">{generatedContent.titleC}</div>
              </div>
            </div>

            {/* Editable Title */}
            <label htmlFor={`title-${video.id}`} className="text-xs text-gray-400 mb-1 block">編輯選定的標題</label>
            <div className="flex gap-2 mt-1">
              <input
                id={`title-${video.id}`}
                type="text"
                value={editableContent.title}
                onChange={e => setEditableContent(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={() => handleUpdate('title')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center">
                {getButtonContent(updateState.title)}
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor={`description-${video.id}`} className="text-sm font-semibold text-gray-300">影片說明（包含章節與標籤）</label>
            <div className="text-xs text-gray-400 mb-1">此欄位包含完整的影片說明、章節導覽和說明用標籤</div>
            <div className="flex gap-2 mt-1">
              <textarea
                id={`description-${video.id}`}
                value={editableContent.description}
                onChange={e => setEditableContent(prev => ({ ...prev, description: e.target.value }))}
                rows={8}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
              <button onClick={() => handleUpdate('description')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center">
                 {getButtonContent(updateState.description)}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor={`tags-${video.id}`} className="text-sm font-semibold text-gray-300">後台標籤（逗號分隔）</label>
            <div className="text-xs text-gray-400 mb-1">這些標籤會設定在 YouTube 後台，不含 # 符號</div>
            <div className="flex gap-2 mt-1">
              <input
                id={`tags-${video.id}`}
                type="text"
                value={editableContent.tags}
                onChange={e => setEditableContent(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={() => handleUpdate('tags')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center">
                {getButtonContent(updateState.tags)}
              </button>
            </div>
          </div>
          <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          >
              {isLoading ? '生成中...' : '重新生成'}
          </button>
        </div>
      )}

      {/* Article Generator Modal */}
      {showArticleGenerator && (
        <ArticleGenerator
          videoId={video.id}
          videoTitle={video.title}
          onClose={() => setShowArticleGenerator(false)}
        />
      )}
    </div>
  );
};
