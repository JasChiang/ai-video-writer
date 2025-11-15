import React from 'react';
import type { YouTubeVideo } from '../types';
import { formatDuration, formatViewCount, formatPublishedDate, getPrivacyStatusBadge } from '../utils/formatters';

interface VideoCardProps {
  video: YouTubeVideo;
  isActive: boolean;
  onSelect: (videoId: string) => void;
  cardId?: string;
}

export function VideoCard({ video, isActive, onSelect, cardId }: VideoCardProps) {
  const badge = getPrivacyStatusBadge(video.privacyStatus);

  return (
    <article
      id={cardId}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={() => onSelect(video.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(video.id);
        }
      }}
      className={`group relative flex cursor-pointer gap-4 rounded-xl border bg-white p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000] focus-visible:ring-offset-2 scroll-mt-28 font-['Roboto',sans-serif] ${
        isActive
          ? 'border-[#FF0000] shadow-[0_2px_8px_rgba(255,0,0,0.15)]'
          : 'border-[#E5E5E5] shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:border-[#909090] hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
      }`}
    >
      <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2F2F2] sm:h-28 sm:w-48">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </span>
        )}
        {isActive && (
          <span className="absolute left-2 top-2 rounded bg-[#FF0000] px-2 py-1 text-xs font-medium text-white shadow-md">
            正在檢視
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 break-words text-base font-medium text-[#030303] sm:text-lg leading-snug">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#606060] sm:text-sm">
            {video.privacyStatus && (
              <span
                className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                style={{ color: badge.color, backgroundColor: badge.bgColor }}
              >
                {badge.text}
              </span>
            )}
            {video.viewCount && (
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {formatViewCount(video.viewCount)} 次觀看
              </span>
            )}
            {video.publishedAt && (
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                {formatPublishedDate(video.publishedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-[#606060] sm:text-sm">
          <div className="min-w-0 flex-1">
            {video.tags && video.tags.length > 0 ? (
              <span className="block truncate text-[#065FD4]">
                #{video.tags.slice(0, 2).join(' #')}
                {video.tags.length > 2 ? ' ...' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#909090]">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="truncate">尚未設定標籤</span>
              </span>
            )}
          </div>
          <span
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap ${
              isActive
                ? 'bg-[#FF0000] text-white shadow-sm'
                : 'bg-[#F2F2F2] text-[#606060] group-hover:bg-[#E5E5E5]'
            }`}
          >
            {isActive ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                正在檢視
              </>
            ) : (
              '點擊檢視'
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
