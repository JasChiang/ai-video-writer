/**
 * VideoPreviewCard - 简化的影片预览卡片
 * 用于在分析报告中展示影片信息（标题 + 缩略图）
 */

import React from 'react';
import type { YouTubeVideo } from '../types';
import { Play, Eye, Calendar, Edit } from 'lucide-react';
import { formatViewCount, formatPublishedDate } from '../utils/formatters';

interface VideoPreviewCardProps {
  video: YouTubeVideo;
  compact?: boolean; // 紧凑模式
}

export function VideoPreviewCard({ video, compact = false }: VideoPreviewCardProps) {
  const openYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
  };

  const openStudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://studio.youtube.com/video/${video.id}/edit`, '_blank');
  };

  if (compact) {
    // 紧凑模式：横向布局
    return (
      <div
        className="inline-flex items-center gap-3 bg-white border rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group max-w-md"
        style={{ borderColor: '#E5E7EB' }}
        onClick={openYouTube}
      >
        <div className="relative flex-shrink-0 w-24 h-14 rounded overflow-hidden bg-gray-100">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
            <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#03045E' }}>
            {video.title}
          </h4>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
            {video.viewCount && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {formatViewCount(video.viewCount)}
              </span>
            )}
            {video.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatPublishedDate(video.publishedAt)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={openStudio}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
          title="在 YouTube Studio 中編輯"
        >
          <Edit className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 标准模式：卡片布局
  return (
    <div
      className="bg-white border-2 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all group"
      style={{ borderColor: '#E5E7EB' }}
      onClick={openYouTube}
    >
      <div className="relative w-full aspect-video bg-gray-100">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
          <div className="bg-blue-600 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <h4 className="text-base font-semibold mb-2 line-clamp-2" style={{ color: '#03045E' }}>
          {video.title}
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#6B7280' }}>
          {video.viewCount && (
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {formatViewCount(video.viewCount)} 次觀看
            </span>
          )}
          {video.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatPublishedDate(video.publishedAt)}
            </span>
          )}
        </div>
        {video.tags && video.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 bg-blue-50 rounded"
                style={{ color: '#0077B6' }}
              >
                #{tag}
              </span>
            ))}
            {video.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5" style={{ color: '#6B7280' }}>
                +{video.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={openStudio}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            <Edit className="w-4 h-4" />
            編輯影片
          </button>
        </div>
      </div>
    </div>
  );
}
