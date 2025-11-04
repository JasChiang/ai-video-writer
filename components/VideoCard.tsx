import React from 'react';
import type { YouTubeVideo } from '../types';
import { VideoDetailPanel } from './VideoDetailPanel';
import { formatDuration, formatViewCount, formatPublishedDate, getPrivacyStatusBadge } from '../utils/formatters';

interface VideoCardProps {
  video: YouTubeVideo;
  isExpanded: boolean;
  onToggle: (videoId: string) => void;
  showDetailInline: boolean;
  isSelected?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isExpanded,
  onToggle,
  showDetailInline,
  isSelected = false,
}) => {
  const privacyBadge = getPrivacyStatusBadge(video.privacyStatus);
  const isActive = showDetailInline ? isExpanded : isSelected;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 shadow-sm ${
        isActive ? 'border-red-500 shadow-md bg-white' : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(video.id)}
        aria-expanded={showDetailInline ? isExpanded : undefined}
        className="w-full text-left flex flex-col gap-4 p-4 md:p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 rounded-2xl transition text-neutral-900"
      >
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="relative w-full md:w-44 lg:w-48 overflow-hidden rounded-xl shadow-md">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            {video.duration && (
              <span
                className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white' }}
              >
                {formatDuration(video.duration)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg md:text-xl font-semibold leading-snug line-clamp-2">
                {video.title}
              </h3>
              {showDetailInline && (
                <svg
                  className={`w-6 h-6 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="#DC2626"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-neutral-500">
              {video.privacyStatus && (
                <span
                  className="px-2 py-0.5 rounded font-medium"
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

              {video.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {formatPublishedDate(video.publishedAt)}
                </span>
              )}
            </div>

            {video.description && (
              <p className="text-sm text-neutral-600 line-clamp-2 md:line-clamp-3" style={{ opacity: showDetailInline ? 1 : 0.75 }}>
                {video.description}
              </p>
            )}
          </div>
        </div>
      </button>

      {showDetailInline && isExpanded && (
        <div className="border-t border-neutral-200">
          <VideoDetailPanel video={video} />
        </div>
      )}
    </div>
  );
};
