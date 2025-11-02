import React from 'react';

interface VideoPlayerProps {
  videoId: string;
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const videoSrc = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div className="space-y-4">
      <div className="aspect-video w-full">
        <iframe
            src={videoSrc}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full rounded-lg shadow-lg"
        ></iframe>
      </div>
    </div>
  );
}
