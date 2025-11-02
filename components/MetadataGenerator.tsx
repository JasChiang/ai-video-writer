import React, { useState, useEffect } from 'react';
import type { GeneratedContentType, YouTubeVideo } from '../types';
import * as geminiService from '../services/geminiService';
import * as youtubeService from '../services/youtubeService';
import { Loader } from './Loader';
import { SparklesIcon, CheckIcon } from './Icons';

interface MetadataGeneratorProps {
  video: YouTubeVideo;
  onClose: () => void;
}

type UpdateStatus = 'idle' | 'loading' | 'success' | 'error';
interface UpdateState {
  title: UpdateStatus;
  description: UpdateStatus;
  tags: UpdateStatus;
}

export function MetadataGenerator({ video, onClose }: MetadataGeneratorProps) {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentType | null>(null);
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

      const result = await geminiService.generateVideoMetadata(
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

      await youtubeService.updateVideo(videoDataToUpdate);

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
    <div className="rounded-lg p-6" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
      {/* Prompt Input */}
      {!generatedContent && !isLoading && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: '#03045E' }}>
            額外提示（選填）
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：適合初學者的有趣教學"
            className="w-full rounded-md px-3 py-2 focus:outline-none"
            style={{
              backgroundColor: 'rgba(202, 240, 248, 0.5)',
              border: '1px solid #90E0EF',
              color: '#03045E'
            }}
          />
        </div>
      )}

      {/* Generate Button */}
      {!generatedContent && !isLoading && !error && (
        <div className="space-y-3">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 transform hover:scale-105"
            style={{ backgroundColor: '#0077B6' }}
          >
            <SparklesIcon /> 使用 Gemini AI 生成 SEO 強化內容
          </button>
          <div className="space-y-2">
            <p className="text-xs text-center" style={{ color: '#0077B6' }}>
              Gemini AI 將分析影片內容，自動生成三種風格標題、章節時間軸及 SEO 標籤
            </p>
            <p className="text-xs text-center" style={{ color: '#90E0EF' }}>
              💡 處理流程：檢查雲端檔案 → 分析影片內容 → 生成 SEO 強化建議（公開影片約 30 秒，未列出影片首次需下載約 2-5 分鐘）
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 180, 216, 0.1)', border: '1px solid #00B4D8' }}>
          <div className="flex items-center gap-3">
            <Loader />
            <span className="text-sm" style={{ color: '#0077B6' }}>{loadingStep}</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#DC2626' }}>{error}</div>}

      {/* Generated Content Form */}
      {generatedContent && (
        <div className="space-y-4 animate-fade-in">
          {/* Title Options */}
          <div>
            <label className="text-sm font-semibold mb-1 block" style={{ color: '#03045E' }}>建議標題（請選擇一個）</label>
            <p className="text-xs mb-2" style={{ color: '#90E0EF' }}>
              💡 Gemini AI 提供三種不同風格的標題，點選即可選擇並編輯
            </p>
            <div className="space-y-2 mb-3">
              <div
                onClick={() => setSelectedTitle('titleA')}
                className="p-3 rounded-lg cursor-pointer transition-all border-2"
                style={{
                  backgroundColor: selectedTitle === 'titleA' ? '#0077B6' : 'rgba(202, 240, 248, 0.5)',
                  borderColor: selectedTitle === 'titleA' ? '#00B4D8' : '#90E0EF',
                  color: selectedTitle === 'titleA' ? 'white' : '#03045E'
                }}
              >
                <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleA' ? 'rgba(255,255,255,0.8)' : '#0077B6' }}>選項 A（關鍵字導向）</div>
                <div>{generatedContent.titleA}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleB')}
                className="p-3 rounded-lg cursor-pointer transition-all border-2"
                style={{
                  backgroundColor: selectedTitle === 'titleB' ? '#0077B6' : 'rgba(202, 240, 248, 0.5)',
                  borderColor: selectedTitle === 'titleB' ? '#00B4D8' : '#90E0EF',
                  color: selectedTitle === 'titleB' ? 'white' : '#03045E'
                }}
              >
                <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleB' ? 'rgba(255,255,255,0.8)' : '#0077B6' }}>選項 B（懸念/好奇心導向）</div>
                <div>{generatedContent.titleB}</div>
              </div>
              <div
                onClick={() => setSelectedTitle('titleC')}
                className="p-3 rounded-lg cursor-pointer transition-all border-2"
                style={{
                  backgroundColor: selectedTitle === 'titleC' ? '#0077B6' : 'rgba(202, 240, 248, 0.5)',
                  borderColor: selectedTitle === 'titleC' ? '#00B4D8' : '#90E0EF',
                  color: selectedTitle === 'titleC' ? 'white' : '#03045E'
                }}
              >
                <div className="text-xs mb-1" style={{ color: selectedTitle === 'titleC' ? 'rgba(255,255,255,0.8)' : '#0077B6' }}>選項 C（結果/效益導向）</div>
                <div>{generatedContent.titleC}</div>
              </div>
            </div>

            {/* Editable Title */}
            <label className="text-xs mb-1 block" style={{ color: '#0077B6' }}>編輯選定的標題</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={editableContent.title}
                onChange={e => setEditableContent(prev => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-md px-3 py-2 focus:outline-none"
                style={{
                  backgroundColor: 'rgba(202, 240, 248, 0.5)',
                  border: '1px solid #90E0EF',
                  color: '#03045E'
                }}
              />
              <button onClick={() => handleUpdate('title')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#0077B6' }}>
                {getButtonContent(updateState.title)}
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold" style={{ color: '#03045E' }}>影片說明（包含章節與標籤）</label>
            <div className="text-xs mb-1 space-y-0.5" style={{ color: '#0077B6' }}>
              <p>此欄位包含完整的影片說明、章節導覽和說明用標籤</p>
              <p style={{ color: '#90E0EF' }}>💡 Gemini AI 會自動生成章節時間軸（格式：00:00），並在說明中加入相關標籤以提升搜尋能見度</p>
            </div>
            <div className="flex gap-2 mt-1">
              <textarea
                value={editableContent.description}
                onChange={e => setEditableContent(prev => ({ ...prev, description: e.target.value }))}
                rows={8}
                className="w-full rounded-md px-3 py-2 font-mono text-sm focus:outline-none"
                style={{
                  backgroundColor: 'rgba(202, 240, 248, 0.5)',
                  border: '1px solid #90E0EF',
                  color: '#03045E'
                }}
              />
              <button onClick={() => handleUpdate('description')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#0077B6' }}>
                {getButtonContent(updateState.description)}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold" style={{ color: '#03045E' }}>後台標籤（逗號分隔）</label>
            <div className="text-xs mb-1 space-y-0.5" style={{ color: '#0077B6' }}>
              <p>這些標籤會設定在 YouTube 後台，不含 # 符號</p>
              <p style={{ color: '#90E0EF' }}>💡 Gemini AI 根據影片內容選擇相關關鍵字，幫助 YouTube 演算法推薦您的影片給目標觀眾</p>
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={editableContent.tags}
                onChange={e => setEditableContent(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded-md px-3 py-2 focus:outline-none"
                style={{
                  backgroundColor: 'rgba(202, 240, 248, 0.5)',
                  border: '1px solid #90E0EF',
                  color: '#03045E'
                }}
              />
              <button onClick={() => handleUpdate('tags')} className="text-white font-bold px-3 rounded-lg text-sm w-24 flex items-center justify-center hover:opacity-90" style={{ backgroundColor: '#0077B6' }}>
                {getButtonContent(updateState.tags)}
              </button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2" style={{ borderColor: '#90E0EF' }}>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full text-center text-sm py-2 hover:opacity-80 disabled:opacity-50 font-medium"
              style={{ color: '#0077B6' }}
            >
              {isLoading ? '🔄 生成中...' : '🔄 重新生成（讓 AI 提供不同的建議）'}
            </button>
            <p className="text-xs text-center" style={{ color: '#CAF0F8' }}>
              💡 Gemini AI 每次分析都可能產生不同風格的標題和說明，重新生成可獲得更多靈感
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
