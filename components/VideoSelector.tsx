import React, { useEffect, useState } from 'react';
import type { YouTubeVideo } from '../types';
import { Loader } from './Loader';
import { VideoCard } from './VideoCard';

interface VideoSelectorProps {
  videos: YouTubeVideo[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function VideoSelector({ videos, isLoading, error, hasMore, onLoadMore }: VideoSelectorProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const handleToggle = (videoId: string) => {
    setSelectedVideoId(prev => (prev === videoId ? null : videoId));
  };

  useEffect(() => {
    if (videos.length === 0) {
      setSelectedVideoId(null);
      return;
    }

    const currentVideoStillExists = selectedVideoId
      ? videos.some(video => video.id === selectedVideoId)
      : false;

    if (!currentVideoStillExists) {
      setSelectedVideoId(null);
    }
  }, [videos, selectedVideoId]);

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-1" style={{ color: '#03045E' }}>Your YouTube Videos</h2>
        <p style={{ color: '#0077B6' }}>Generate optimized titles, descriptions, and tags for your content.</p>
      </div>

      {videos.length > 0 && (
        <div className="space-y-6 mb-8">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isExpanded={selectedVideoId === video.id}
              onToggle={handleToggle}
              showDetailInline
              isSelected={selectedVideoId === video.id}
            />
          ))}

          {!isLoading && hasMore && videos.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={onLoadMore}
                className="text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:opacity-90"
                style={{ backgroundColor: '#0077B6' }}
              >
                載入更多影片
              </button>
            </div>
          )}

          {!isLoading && !hasMore && videos.length > 0 && (
            <div className="text-center py-4" style={{ color: '#0077B6' }}>
              <p className="text-sm">已載入所有影片</p>
            </div>
          )}
        </div>
      )}

      {isLoading && <Loader />}

      {!isLoading && videos.length === 0 && !error && (
        <div className="text-center py-8 rounded-2xl" style={{ backgroundColor: 'rgba(144, 224, 239, 0.3)', color: '#0077B6' }}>
          <p>No videos found on your channel.</p>
          <p className="text-sm mt-1">Make sure you have uploaded videos to your channel.</p>
        </div>
      )}

    </div>
  );
}
