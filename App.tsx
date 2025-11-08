import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Loader } from './components/Loader';
import * as youtubeService from './services/youtubeService';
import type { YouTubeVideo } from './types';
import { YouTubeLogin } from './components/YouTubeLogin';
import { VideoSelector } from './components/VideoSelector';
import { VideoAnalytics } from './components/VideoAnalytics';
import { VideoDetailPanel } from './components/VideoDetailPanel';
import { QuotaDebugger } from './components/QuotaDebugger';
import { ArticleWorkspace } from './components/ArticleWorkspace';
import { ChannelAnalytics } from './components/ChannelAnalytics';

type ActiveTab = 'videos' | 'analytics' | 'articles' | 'channel-analytics';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [showPrivateVideos, setShowPrivateVideos] = useState<boolean>(false);
  const [showUnlistedVideos, setShowUnlistedVideos] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('videos');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  const isDesktop = viewportWidth >= 1024;
  const showDetailSidebar = viewportWidth >= 1280;
  const useInlineDetail = !showDetailSidebar;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const init = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      await youtubeService.initialize();
      const restored = youtubeService.restoreStoredToken();

      if (youtubeService.isTokenValid()) {
        setIsLoggedIn(true);
        await fetchVideos({ reset: true, trigger: 'initial-load' });
      } else if (restored) {
        // 如果已恢復舊 token 但立即失效，清除狀態避免無限循環
        console.warn('Stored YouTube token expired; user needs to re-authenticate.');
      }
    } catch (e: any) {
      setError(`Initialization failed. Please ensure you have configured your YouTube API credentials correctly. Details: ${e.message}`);
      console.error(e);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const handleLogin = async () => {
    try {
      await youtubeService.requestToken();
      // After requesting token, user interacts with a popup.
      // We poll for the token to be available after a short delay.
      const interval = setInterval(() => {
        if (youtubeService.isTokenValid()) {
          clearInterval(interval);
          setIsLoggedIn(true);
          fetchVideos({ reset: true, trigger: 'post-login' });
        }
      }, 1000);

      // Stop polling after 1 minute if user doesn't complete
      setTimeout(() => clearInterval(interval), 60000);

    } catch (e: any) {
      setError(`Login failed: ${e.message}`);
      console.error(e);
    }
  };

  const handleLogout = () => {
    // 調用 youtubeService 的登出方法
    youtubeService.logout();

    // 重置應用狀態
    setIsLoggedIn(false);
    setVideos([]);
    setNextPageToken(null);
    setHasMore(true);
    setShowPrivateVideos(false);
    setShowUnlistedVideos(false);
    setSearchQuery('');
    setError(null);
    setSelectedVideoId(null);
    setIsFilterPanelOpen(false);
  };

  const fetchVideos = async ({ reset = true, trigger }: { reset?: boolean; trigger?: string } = {}) => {
    setIsLoadingVideos(true);
    setError(null);
    try {
      if (reset) {
        youtubeService.resetPagination();
        setVideos([]);
        setNextPageToken(null);
      }

      const actionTrigger = trigger ?? (reset ? 'initial-load' : 'load-more');
      // 增加單次載入數量到 24，減少 loadmore 次數
      // 這樣可以在有搜尋關鍵字時，減少總配額消耗
      const result = await youtubeService.listVideos(
        24,
        reset ? undefined : nextPageToken || undefined,
        showPrivateVideos,
        searchQuery,
        showUnlistedVideos,
        {
          trigger: actionTrigger,
          source: 'App.fetchVideos',
          reset,
        }
      );

      const existingIds = reset ? new Set<string>() : new Set(videos.map(v => v.id));
      const dedupedVideos = reset
        ? result.videos
        : [...videos, ...result.videos.filter(video => !existingIds.has(video.id))];

      setVideos(dedupedVideos);
      setNextPageToken(result.nextPageToken);
      setHasMore(!!result.nextPageToken);
      setSelectedVideoId(prev => {
        if (prev && dedupedVideos.some(video => video.id === prev)) {
          return prev;
        }
        return showDetailSidebar ? dedupedVideos[0]?.id ?? null : null;
      });
    } catch (e: any) {
      setError('Could not fetch YouTube videos. The API quota may be exceeded or permissions are missing.');
      console.error(e);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const loadMoreVideos = async () => {
    if (!hasMore || isLoadingVideos) return;
    await fetchVideos({ reset: false, trigger: 'load-more' });
  };

  const handleTogglePrivateVideos = () => {
    setShowPrivateVideos(prev => !prev);
  };

  const handleToggleUnlistedVideos = () => {
    setShowUnlistedVideos(prev => !prev);
  };

  // Re-fetch videos when showPrivateVideos changes
  useEffect(() => {
    if (isLoggedIn) {
      fetchVideos({ reset: true, trigger: 'privacy-filter-change' });
    }
  }, [showPrivateVideos, showUnlistedVideos]);

  // Re-fetch videos when searchQuery changes (with debounce)
  useEffect(() => {
    if (!isLoggedIn) return;

    const timer = setTimeout(() => {
      fetchVideos({ reset: true, trigger: 'search-query' });
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResetFilters = () => {
    setShowPrivateVideos(false);
    setShowUnlistedVideos(false);
    setSearchQuery('');
  };

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    if (!showDetailSidebar) {
      const target = document.getElementById(`video-card-${videoId}`);
      if (target) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  };

  const selectedVideo = selectedVideoId
    ? videos.find(video => video.id === selectedVideoId) ?? null
    : null;

  useEffect(() => {
    if (isDesktop) {
      setIsFilterPanelOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (showDetailSidebar) {
      setSelectedVideoId(prev => prev ?? (videos[0]?.id ?? null));
    }
  }, [showDetailSidebar, videos]);

  const layoutTemplateColumns = useMemo(() => {
    if (!isDesktop) {
      return 'minmax(0, 1fr)';
    }

    if (showDetailSidebar) {
      return 'minmax(280px, 340px) minmax(0, 1fr) clamp(320px, 30vw, 560px)';
    }

    return 'minmax(280px, 340px) minmax(0, 1fr)';
  }, [isDesktop, showDetailSidebar]);

  const hasActiveFilters = showPrivateVideos || showUnlistedVideos || Boolean(searchQuery);

  const renderFilterControls = () => (
    <div className="space-y-5">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋影片標題..."
          className="w-full rounded-full border border-neutral-300 bg-white pl-12 pr-12 py-3 text-sm text-neutral-900 shadow-sm transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 sm:text-base"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-neutral-600 focus:outline-none"
            aria-label="清除搜尋"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleToggleUnlistedVideos}
          aria-pressed={showUnlistedVideos}
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
            showUnlistedVideos
              ? 'border-red-500 bg-red-50/80 text-red-600 shadow-sm'
              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          <span className="font-medium">顯示未公開影片</span>
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showUnlistedVideos ? 'bg-red-500' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                showUnlistedVideos ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={handleTogglePrivateVideos}
          aria-pressed={showPrivateVideos}
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
            showPrivateVideos
              ? 'border-red-500 bg-red-50/80 text-red-600 shadow-sm'
              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          <span className="font-medium">顯示私人影片</span>
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showPrivateVideos ? 'bg-red-500' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                showPrivateVideos ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-neutral-500">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-600">
            {videos.length}
          </span>
          <span>符合條件的影片</span>
        </div>
        <button
          type="button"
          onClick={handleResetFilters}
          disabled={!hasActiveFilters}
          className={`text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
            hasActiveFilters
              ? 'text-red-600 hover:text-red-700'
              : 'cursor-not-allowed text-neutral-300'
          }`}
        >
          重設篩選
        </button>
      </div>

      {searchQuery && !isLoadingVideos && (
        <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-sm text-red-600">
          {videos.length > 0 ? (
            <span>
              找到 <span className="font-semibold">{videos.length}</span> 個包含「{searchQuery}」的影片
            </span>
          ) : (
            <span>未找到包含「{searchQuery}」的影片，可試試其他標題關鍵字。</span>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (isInitializing) {
      return <div className="flex justify-center items-center h-64"><Loader /></div>;
    }

    if (!isLoggedIn) {
      return <YouTubeLogin onLogin={handleLogin} />;
    }

    // 根據 activeTab 渲染不同內容
    if (activeTab === 'analytics') {
      return <VideoAnalytics />;
    }

    if (activeTab === 'articles') {
      return <ArticleWorkspace />;
    }

    if (activeTab === 'channel-analytics') {
      return <ChannelAnalytics />;
    }

    return (
      <div className="space-x-0 space-y-6">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen(prev => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <span>搜尋與篩選</span>
            <svg
              className={`h-5 w-5 transition-transform ${isFilterPanelOpen ? 'rotate-180 text-red-600' : 'text-neutral-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isFilterPanelOpen && (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-sm">
              {renderFilterControls()}
            </div>
          )}
        </div>

        <div
          className="grid gap-6 lg:gap-6 xl:gap-8 2xl:gap-10"
          style={{ gridTemplateColumns: layoutTemplateColumns }}
        >
          <aside className="mb-6 hidden lg:block xl:mb-0">
            <div className="space-y-5 rounded-2xl border border-neutral-200 bg-white/95 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:sticky lg:top-28">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-neutral-900">搜尋與篩選</h2>
                <p className="text-sm text-neutral-500">
                  依標題、描述或公開設定快速鎖定需要優化的影片。
                </p>
              </div>
              {renderFilterControls()}
            </div>
          </aside>

          <section className="space-y-4">
            <VideoSelector
              videos={videos}
              isLoading={isLoadingVideos}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMoreVideos}
              selectedVideoId={selectedVideoId}
              onSelectVideo={handleVideoSelect}
              inlineDetail={useInlineDetail}
              selectedVideo={selectedVideo}
            />
          </section>

          <aside className="hidden xl:block">
            {selectedVideo ? (
              <div className="lg:sticky lg:top-28">
                <VideoDetailPanel video={selectedVideo} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-neutral-500">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-700">選擇左側影片以檢視內容</h3>
                  <p className="mt-2 text-sm">包含影片預覽、近期數據與 Gemini 建議。</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  };
  
  return (
    <div
      className="min-h-screen font-sans flex flex-col bg-neutral-50 text-neutral-900"
      style={{ color: '#1F1F1F' }}
    >
      <Header
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="flex-grow p-4 md:p-8">
        <div className="container mx-auto max-w-[1400px]">
          {error && !isLoadingVideos && (
            <div
              className="p-4 rounded-lg mb-4 text-center"
              style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', color: '#B91C1C' }}
            >
              <p className="font-bold">An error occurred:</p>
              <p>{error}</p>
            </div>
          )}
          {renderContent()}
        </div>
      </main>
      <Footer />
      <QuotaDebugger />
    </div>
  );
}
