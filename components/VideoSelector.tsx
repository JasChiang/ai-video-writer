import React from 'react';
import type { YouTubeVideo } from '../types';
import { Loader } from './Loader';
import { VideoCard } from './VideoCard';

interface VideoSelectorProps {
  videos: YouTubeVideo[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  showInlineDetail?: boolean;
}

export function VideoSelector({
  videos,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  selectedVideoId,
  onSelectVideo,
  showInlineDetail = false,
}: VideoSelectorProps) {

  return (
    <div className="space-y-5 font-['Roboto',sans-serif]">
      <header className="flex flex-col gap-3 rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-medium text-[#030303] sm:text-2xl">影片清單</h2>
          <p className="text-sm text-[#606060] mt-1">
            點擊影片即可瀏覽詳細內容、成效指標與 Gemini 建議。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#606060]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F2F2] text-sm font-semibold text-[#030303]">
            {videos.length}
          </span>
          <span>條符合條件的影片</span>
        </div>
      </header>

      {error && !isLoading && (
        <div className="rounded-xl border border-[#FCE8E8] bg-[#FEF7F7] px-4 py-3 text-sm text-[#C5221F] shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          <div className="flex items-start gap-2">
            <span className="font-medium">⚠</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {videos.length === 0 && !isLoading && !error && (
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#F9F9F9] px-6 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white mx-auto mb-4 flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
            <svg className="w-8 h-8 text-[#606060]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-[#030303]">尚未找到符合條件的影片</h3>
          <p className="mt-2 text-sm text-[#606060]">調整搜尋或篩選條件，再試一次。</p>
        </div>
      )}

      {/* 初次載入時顯示完整的 Loader */}
      {isLoading && videos.length === 0 && (
        <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] p-8">
          <Loader />
        </div>
      )}

      {/* 影片列表 */}
      {videos.length > 0 && (
        <div className="space-y-3">
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
                {/* Inline detail 佔位元素 - 由 App.tsx 透過條件渲染或 Portal */}
                <div
                  id={`detail-slot-${video.id}`}
                  className={`pt-2 ${showInlineDetail && isActive ? '' : 'hidden'}`}
                >
                  {/* Portal target - VideoDetailPanel 將渲染到這裡 */}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 載入更多按鈕或載入中狀態 */}
      {videos.length > 0 && (
        <div className="flex justify-center pt-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E5E5E5] bg-white px-8 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF0000] border-t-transparent"></div>
                <span className="text-sm font-medium text-[#030303]">正在搜尋更多影片...</span>
              </div>
              <span className="text-xs text-[#606060]">掃描頻道影片中，這可能需要一些時間</span>
            </div>
          ) : hasMore ? (
            <button
              onClick={onLoadMore}
              className="inline-flex items-center gap-2 rounded-full bg-[#FF0000] px-6 py-3 font-medium text-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-all duration-200 hover:bg-[#CC0000] hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000] focus-visible:ring-offset-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              載入更多影片
            </button>
          ) : (
            <div className="text-center text-sm text-[#606060]">
              已載入所有符合條件的影片
            </div>
          )}
        </div>
      )}
    </div>
  );
}
