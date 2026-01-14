import React from 'react';
import { AppIcon } from '../AppIcon';
import type { UploadedFile } from './types';

interface ReferenceInputsProps {
  isGenerating: boolean;
  isUploading: boolean;
  uploadedFiles: UploadedFile[];
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onFileUpload: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  referenceUrls: string[];
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (index: number) => void;
  referenceVideos: string[];
  videoUrlInput: string;
  onVideoUrlInputChange: (value: string) => void;
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  extractVideoId: (url: string) => string | null;
}

export function ReferenceInputs({
  isGenerating,
  isUploading,
  uploadedFiles,
  onDrop,
  onFileUpload,
  onRemoveFile,
  referenceUrls,
  urlInput,
  onUrlInputChange,
  onAddUrl,
  onRemoveUrl,
  referenceVideos,
  videoUrlInput,
  onVideoUrlInputChange,
  onAddVideo,
  onRemoveVideo,
  extractVideoId,
}: ReferenceInputsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2 text-neutral-700">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="paperclip" size={16} className="text-red-500" />
            上傳參考資料（選填）
          </span>
        </label>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-500 hover:bg-neutral-50 transition"
        >
          <input
            type="file"
            multiple
            onChange={(e) => onFileUpload(e.target.files)}
            className="hidden"
            id="file-upload"
            accept="image/*,.pdf,.txt,.csv,.md"
            disabled={isUploading || isGenerating}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-neutral-600">
              <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2">
                拖放檔案到這裡，或點擊選擇檔案
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                支援：圖片（JPG, PNG, GIF, WEBP）、PDF、Markdown、文字檔（最大 100MB）
              </p>
            </div>
          </label>
        </div>

        {isUploading && (
          <div className="mt-3 flex items-center gap-2 text-neutral-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-red-500" />
            <span className="text-sm">正在上傳檔案...</span>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-neutral-700">已上傳的檔案：</p>
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-neutral-600">
                    <AppIcon
                      name={
                        file.mimeType.startsWith('image/') ? 'image' :
                        file.mimeType === 'application/pdf' ? 'document' :
                        file.displayName.endsWith('.md') ? 'notepad' : 'paperclip'
                      }
                      size={18}
                      className="text-red-500"
                    />
                  </span>
                  <span className="text-sm text-neutral-700 truncate">
                    {file.displayName}
                  </span>
                  <span className="text-xs text-neutral-500">
                    ({(file.sizeBytes / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => onRemoveFile(index)}
                  className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                  disabled={isUploading || isGenerating}
                  title="移除檔案"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
          <AppIcon name="idea" size={14} className="text-amber-500" />
          上傳相關文件、圖片或 Markdown 檔案，AI 會參考這些資料來生成更精準的文章內容
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-neutral-700">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="globe" size={16} className="text-red-500" />
            參考網址（選填）
          </span>
        </label>

        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => onUrlInputChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddUrl();
              }
            }}
            placeholder="輸入網址（需包含 http:// 或 https://）"
            className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            disabled={isGenerating || referenceUrls.length >= 20}
          />
          <button
            onClick={onAddUrl}
            disabled={isGenerating || !urlInput.trim() || referenceUrls.length >= 20}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            新增
          </button>
        </div>

        {referenceUrls.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-neutral-700">已新增的網址：</p>
            {referenceUrls.map((url, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-neutral-600">
                    <AppIcon name="globe" size={18} className="text-red-500" />
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 truncate underline"
                    title={url}
                  >
                    {url}
                  </a>
                </div>
                <button
                  onClick={() => onRemoveUrl(index)}
                  className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                  disabled={isGenerating}
                  title="移除網址"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
          <AppIcon name="idea" size={14} className="text-amber-500" />
          提供相關網址讓 AI 參考，支援文章、文件、PDF 等（最多 20 個網址）
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-neutral-700">
          <span className="inline-flex items-center gap-1">
            <AppIcon name="video" size={16} className="text-red-500" />
            參考影片（選填）
          </span>
        </label>

        <div className="flex gap-2">
          <input
            type="url"
            value={videoUrlInput}
            onChange={(e) => onVideoUrlInputChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddVideo();
              }
            }}
            placeholder="輸入 YouTube 影片網址"
            className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            disabled={isGenerating || referenceVideos.length >= 9}
          />
          <button
            onClick={onAddVideo}
            disabled={isGenerating || !videoUrlInput.trim() || referenceVideos.length >= 9}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            新增
          </button>
        </div>

        {referenceVideos.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-neutral-700">已新增的參考影片：</p>
            {referenceVideos.map((videoUrl, index) => {
              const videoId = extractVideoId(videoUrl);
              const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';

              return (
                <div
                  key={index}
                  className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {thumbnailUrl && (
                      <img
                        src={thumbnailUrl}
                        alt="影片縮圖"
                        className="w-12 h-9 object-cover rounded"
                      />
                    )}
                    <span className="text-neutral-600">
                      <AppIcon name="video" size={18} className="text-red-500" />
                    </span>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 truncate underline"
                      title={videoUrl}
                    >
                      {videoUrl}
                    </a>
                  </div>
                  <button
                    onClick={() => onRemoveVideo(index)}
                    className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                    disabled={isGenerating}
                    title="移除影片"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
          <AppIcon name="idea" size={14} className="text-amber-500" />
          提供額外的 YouTube 影片讓 AI 參考，最多 9 個（加上主要影片共 10 個）
        </p>
      </div>
    </>
  );
}
