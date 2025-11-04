import React, { useState } from 'react';
import type { YouTubeVideo } from '../types';
import { MetadataGenerator } from './MetadataGenerator';
import { ArticleGenerator } from './ArticleGenerator';
import { formatDuration, formatViewCount, formatPublishedDate, getPrivacyStatusBadge } from '../utils/formatters';

interface VideoDetailPanelProps {
  video: YouTubeVideo;
}

type ActiveMode = 'none' | 'metadata' | 'article';

export function VideoDetailPanel({ video }: VideoDetailPanelProps) {
  const [activeMode, setActiveMode] = useState<ActiveMode>('none');
  const [showPlayer, setShowPlayer] = useState(false);
  const [fileStatus, setFileStatus] = useState<{
    checking: boolean;
    exists: boolean;
    processing?: boolean;
    file?: {
      name: string;
      uri: string;
      state: string;
      expirationTime?: string;
    };
  }>({ checking: true, exists: false });
  const privacyBadge = getPrivacyStatusBadge(video.privacyStatus);

  // 檢查檔案是否存在於 Files API
  React.useEffect(() => {
    if (video.privacyStatus === 'public') {
      // 公開影片不需要檢查（使用 YouTube URL）
      setFileStatus({ checking: false, exists: false });
      return;
    }

    const checkFile = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/check-file/${video.id}`);
        const data = await response.json();
        setFileStatus({
          checking: false,
          exists: data.exists,
          processing: data.processing,
          file: data.file
        });
      } catch (error) {
        console.error('Failed to check file:', error);
        setFileStatus({ checking: false, exists: false });
      }
    };

    checkFile();
  }, [video.id, video.privacyStatus]);

  return (
    <div className="space-y-6 p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm">
      {/* Video Preview */}
      <div className="space-y-4">
        {showPlayer ? (
          <div className="relative w-full overflow-hidden rounded-xl shadow-lg" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPlayer(true)}
            className="relative block w-full overflow-hidden rounded-xl shadow-lg group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 bg-neutral-100 border border-neutral-200"
          >
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition">
              <div className="bg-red-600 rounded-full p-4 group-hover:scale-105 transition-transform shadow-xl">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
            {video.duration && (
              <span
                className="absolute bottom-3 right-3 px-2 py-1 rounded font-semibold text-xs md:text-sm"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white' }}
              >
                {formatDuration(video.duration)}
              </span>
            )}
          </button>
        )}

        <div className="space-y-3">
          <h3 className="text-xl md:text-2xl font-bold leading-snug text-neutral-900">
            {video.title}
          </h3>
          <div className="flex flex-wrap gap-3 text-xs md:text-sm text-neutral-500">
            {video.privacyStatus && (
              <span
                className="px-3 py-1 rounded-full font-medium"
                style={{
                  color: privacyBadge.color,
                  backgroundColor: privacyBadge.bgColor
                }}
              >
                {privacyBadge.text}
              </span>
            )}

            {video.viewCount && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {formatViewCount(video.viewCount)} 次觀看
              </span>
            )}

            {video.likeCount && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                {formatViewCount(video.likeCount)}
              </span>
            )}

            {video.publishedAt && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                發布於 {formatPublishedDate(video.publishedAt)}
              </span>
            )}
          </div>

          {video.description && (
            <div className="rounded-lg p-4 text-sm whitespace-pre-wrap bg-neutral-100 border border-neutral-200 text-neutral-700">
              {video.description.length > 300
                ? `${video.description.substring(0, 300)}...`
                : video.description}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {activeMode === 'none' && (
        <div className="space-y-4">
          <h4 className="text-base md:text-lg font-semibold text-neutral-900">選擇生成模式</h4>

          {video.privacyStatus !== 'public' && (
            <div
              className={`rounded-lg p-3 border ${
                fileStatus.exists ? 'bg-green-50 border-green-200' : 'bg-neutral-100 border-neutral-200'
              }`}
            >
              {fileStatus.checking ? (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  檢查 Files API 中的檔案...
                </div>
              ) : fileStatus.processing ? (
                <div className="text-sm text-amber-600">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-semibold">檔案處理中</span>
                  </div>
                  <p className="text-xs opacity-80">Gemini 正在處理已上傳的影片</p>
                </div>
              ) : fileStatus.exists ? (
                <div className="text-sm text-green-600">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">已上傳至 Files API</span>
                  </div>
                  <p className="text-xs opacity-80">
                    無需重新下載，可直接生成內容
                    {fileStatus.file?.expirationTime && (
                      <> • 有效期至 {new Date(fileStatus.file.expirationTime).toLocaleString('zh-TW')}</>
                    )}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-neutral-600">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">未上傳至 Files API</span>
                  </div>
                  <p className="text-xs opacity-80">首次生成需下載並上傳影片</p>
                </div>
              )}
            </div>
          )}

          {video.privacyStatus === 'private' ? (
            <div className="p-5 rounded-lg text-center bg-red-50 border border-red-200 text-red-600">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-semibold">私人影片不支援分析</span>
              </div>
              <p className="text-sm opacity-80">請將影片改為「未列出」或「公開」</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveMode('metadata')}
                className="group relative p-5 md:p-6 rounded-xl transition-all duration-200 transform hover:scale-[1.01] shadow-md text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 bg-red-600 hover:bg-red-700"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <h5 className="text-lg font-bold text-white mb-1">YouTube Metadata 生成</h5>
                    <p className="text-sm text-white/80">生成標題、描述、標籤</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveMode('article')}
                className="group relative p-5 md:p-6 rounded-xl transition-all duration-200 transform hover:scale-[1.01] shadow-md text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 bg-neutral-900 hover:bg-neutral-800"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <h5 className="text-lg font-bold text-white mb-1">部落格文章生成</h5>
                    <p className="text-sm text-white/85">生成文章與關鍵截圖</p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {activeMode === 'metadata' && (
        <div>
          <button
            onClick={() => setActiveMode('none')}
            className="mb-4 flex items-center gap-2 text-sm md:text-base text-red-600 hover:text-red-700 transition-colors focus:outline-none"
          >
            ← 返回選擇模式
          </button>
          <MetadataGenerator
            video={video}
            onClose={() => setActiveMode('none')}
          />
        </div>
      )}

      {activeMode === 'article' && (
        <div>
          <button
            onClick={() => setActiveMode('none')}
            className="mb-4 flex items-center gap-2 text-sm md:text-base text-red-600 hover:text-red-700 transition-colors focus:outline-none"
          >
            ← 返回選擇模式
          </button>
          <ArticleGenerator
            video={video}
            onClose={() => setActiveMode('none')}
          />
        </div>
      )}
    </div>
  );
}
