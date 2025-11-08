import React from 'react';
import type { YouTubeVideo } from '../types';
import { Loader } from './Loader';
import { VideoCard } from './VideoCard';
import { VideoDetailPanel } from './VideoDetailPanel';

interface VideoSelectorProps {
  videos: YouTubeVideo[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  inlineDetail?: boolean;
  selectedVideo?: YouTubeVideo | null;
  onVideoUpdate?: (updatedVideo: Partial<YouTubeVideo> & { id: string }) => void;
}

export function VideoSelector({
  videos,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  selectedVideoId,
  onSelectVideo,
  inlineDetail = false,
  selectedVideo = null,
  onVideoUpdate,
}: VideoSelectorProps) {
  const canShowInlineDetail = inlineDetail && Boolean(selectedVideo);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 sm:text-xl">影片清單</h2>
          <p className="text-sm text-neutral-500">
            點擊影片即可瀏覽詳細內容、成效指標與 Gemini 建議。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-600">
            {videos.length}
          </span>
          <span>條符合條件的影片</span>
        </div>
      </header>

      {error && !isLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {videos.length === 0 && !isLoading && !error && (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-neutral-500">
          <h3 className="text-base font-semibold text-neutral-700">尚未找到符合條件的影片</h3>
          <p className="mt-2 text-sm">調整搜尋或篩選條件，再試一次。</p>
        </div>
      )}

      {/* 初次載入時顯示完整的 Loader */}
      {isLoading && videos.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white/90">
          <Loader />
        </div>
      )}

      {/* 影片列表 */}
      {videos.length > 0 && (
        <div className="space-y-4">
          {videos.map((video) => {
            const isActive = video.id === selectedVideoId;
            const cardId = `video-card-${video.id}`;

            return (
              <div key={video.id} className="space-y-3">
                <VideoCard
                  video={video}
                  isActive={isActive}
                  onSelect={onSelectVideo}
                  cardId={cardId}
                />
                {canShowInlineDetail && isActive && selectedVideo && (
                  <div className="pt-2">
                    <VideoDetailPanel video={selectedVideo} onVideoUpdate={onVideoUpdate} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 載入更多按鈕或載入中狀態 */}
      {videos.length > 0 && (
        <div className="flex justify-center pt-2">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-neutral-700">正在搜尋更多影片...</span>
              </div>
              <span className="text-xs text-neutral-500">掃描頻道影片中，這可能需要一些時間</span>
            </div>
          ) : hasMore ? (
            <button
              onClick={onLoadMore}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-red-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <span className="text-lg">↻</span> 載入更多影片
            </button>
          ) : (
            <div className="text-center text-sm text-neutral-500">
              已載入所有符合條件的影片
            </div>
          )}
        </div>
      )}
    </div>
  );
}
