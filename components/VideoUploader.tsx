
import React from 'react';
import { UploadIcon } from './Icons';

interface VideoUploaderProps {
  onVideoSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string | undefined;
}

export function VideoUploader({ onVideoSelect, fileName }: VideoUploaderProps) {
  return (
    <div>
      <label
        htmlFor="video-upload"
        className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-3 px-5 rounded-lg inline-flex items-center justify-center transition-colors duration-200 w-full"
      >
        <UploadIcon />
        <span className="ml-2">
          {fileName ? 'Choose a different video' : 'Choose a video file'}
        </span>
      </label>
      <input
        id="video-upload"
        type="file"
        className="hidden"
        accept="video/*"
        onChange={onVideoSelect}
      />
      {fileName && (
        <p className="text-center mt-3 text-sm text-gray-400 truncate">
          Selected: {fileName}
        </p>
      )}
    </div>
  );
}
   