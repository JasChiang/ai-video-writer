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
      className={`group relative flex cursor-pointer gap-4 rounded-2xl border bg-white p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 scroll-mt-28 ${
        isActive ? 'border-red-500 shadow-lg' : 'border-neutral-200 shadow-sm hover:border-neutral-300'
      }`}
    >
      <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-md sm:h-28 sm:w-48">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
        />
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-xs font-semibold text-white">
            {formatDuration(video.duration)}
          </span>
        )}
        {isActive && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-red-600 shadow-sm">
            檢視中
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="space-y-1">
          <h3 className="line-clamp-2 break-words text-base font-semibold text-neutral-900 sm:text-lg">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 sm:text-sm">
            {video.privacyStatus && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
                style={{ color: badge.color, backgroundColor: badge.bgColor }}
              >
                {badge.text}
              </span>
            )}
            {video.viewCount && (
              <span className="flex items-center gap-1.5">
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
              <span className="flex items-center gap-1.5">
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

        <div className="flex items-center justify-between text-xs text-neutral-500 sm:text-sm">
          {video.tags && video.tags.length > 0 ? (
            <span className="line-clamp-1">
              #{video.tags.slice(0, 2).join(' #')}
              {video.tags.length > 2 ? ' ...' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-neutral-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              尚未設定標籤
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              isActive ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200'
            }`}
          >
            {isActive ? '正在檢視' : '點擊檢視'}
          </span>
        </div>
      </div>
    </article>
  );
}
