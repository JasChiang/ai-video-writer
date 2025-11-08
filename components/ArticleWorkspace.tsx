import React, { useCallback, useMemo, useState } from 'react';
import type { ArticleGenerationResult, YouTubeVideo } from '../types';
import * as youtubeService from '../services/youtubeService';
import { GITHUB_GIST_ID } from '../config';
import { ArticleGenerator } from './ArticleGenerator';
import { Loader } from './Loader';

function extractVideoId(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const directMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directMatch) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const candidate = url.pathname.replace('/', '');
      return candidate.length === 11 ? candidate : null;
    }
    const v = url.searchParams.get('v');
    if (v && v.length === 11) return v;
    const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return shorts[1];
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
  } catch {
    // ignore parse error
  }
  return null;
}

export function ArticleWorkspace() {
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [cachedArticle, setCachedArticle] = useState<ArticleGenerationResult | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedVideo(null);
    setCachedArticle(null);
  }, []);

  const handleLoadFromUrl = async () => {
    setError(null);
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      setError('請輸入有效的 YouTube 影片網址或 ID');
      return;
    }
    setIsLoadingUrl(true);
    try {
      const video = await youtubeService.fetchVideoDetails(videoId);
      setSelectedVideo(video);
      setCachedArticle(null);
    } catch (err: any) {
      setError(err?.message || '無法取得影片資訊，請確認影片連結是否正確。');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      // 優先使用 Gist 快取搜尋（配額成本 0）
      if (GITHUB_GIST_ID) {
        console.log('[ArticleWorkspace] 使用 Gist 快取搜尋');
        const response = await fetch(
          `/api/video-cache/search?gistId=${encodeURIComponent(GITHUB_GIST_ID)}&query=${encodeURIComponent(searchQuery.trim())}&maxResults=8`
        );

        if (!response.ok) {
          throw new Error(`搜尋失敗: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || '搜尋失敗');
        }

        // 將快取資料格式轉換為 YouTubeVideo 格式
        const videos: YouTubeVideo[] = data.videos.map((v: any) => ({
          id: v.videoId,
          title: v.title,
          description: '',
          thumbnailUrl: v.thumbnail,
          tags: [],
          categoryId: '',
          privacyStatus: v.privacyStatus || 'public',
          publishedAt: v.publishedAt,
        }));

        setSearchResults(videos);
      } else {
        // 如果沒有 GIST_ID，退回到使用 YouTube API（配額成本 100）
        console.warn('[ArticleWorkspace] 未設定 GIST_ID，使用 YouTube API 搜尋（配額成本 100）');
        const videos = await youtubeService.searchVideosByKeyword(searchQuery.trim(), 8);
        setSearchResults(videos);
      }
    } catch (err: any) {
      setError(err?.message || '搜尋失敗，請稍後再試');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    setCachedArticle(null);
  };

  const hasSelection = Boolean(selectedVideo);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">輸入 YouTube 影片連結</h2>
          <p className="mt-1 text-sm text-neutral-500">
            支援 YouTube 網址、短網址（youtu.be）或直接貼上 11 碼影片 ID。
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=xxxxxxx"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={handleLoadFromUrl}
              disabled={isLoadingUrl || !urlInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isLoadingUrl ? (
                <>
                  <Loader />
                  <span>載入中...</span>
                </>
              ) : (
                '載入影片'
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">搜尋影片</h2>
          <p className="mt-1 text-sm text-neutral-500">輸入關鍵字搜尋影片（可搜尋非自己頻道的公開影片）。</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="輸入關鍵字..."
                className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isSearching ? '搜尋中…' : '搜尋'}
              </button>
            </div>
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader />
                <span>正在搜尋影片...</span>
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {searchResults.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(video)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:border-red-400 ${
                      selectedVideo?.id === video.id ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="font-semibold text-neutral-900">{video.title}</div>
                    <div className="text-xs text-neutral-500">{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : '未知日期'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-4 shadow-sm">
        {hasSelection && selectedVideo ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-neutral-500">目前選擇的影片</p>
                <h3 className="text-lg font-semibold text-neutral-900">{selectedVideo.title}</h3>
                <p className="text-sm text-neutral-500">影片 ID：{selectedVideo.id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
                >
                  清除選擇
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideo.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                >
                  在 YouTube 中開啟
                </a>
              </div>
            </div>
            <ArticleGenerator
              video={selectedVideo}
              cachedContent={cachedArticle}
              onContentUpdate={setCachedArticle}
              onClose={clearSelection}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-center text-neutral-500">
            <div>
              <p className="text-lg font-semibold text-neutral-700">尚未選擇影片</p>
              <p className="mt-2 text-sm">請輸入 YouTube 連結或搜尋影片，並選擇要生成文章的對象。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
