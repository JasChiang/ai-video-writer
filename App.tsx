import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Loader } from './components/Loader';
import * as youtubeService from './services/youtubeService';
import type { YouTubeVideo } from './types';
import { YouTubeLogin } from './components/YouTubeLogin';
import { VideoSelector } from './components/VideoSelector';
import { VideoAnalytics } from './components/VideoAnalytics';

type ActiveTab = 'videos' | 'analytics';

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
  
  const init = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      await youtubeService.initialize();
      const restored = youtubeService.restoreStoredToken();

      if (youtubeService.isTokenValid()) {
        setIsLoggedIn(true);
        await fetchVideos();
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
          fetchVideos();
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
  };

  const fetchVideos = async (reset: boolean = true) => {
    setIsLoadingVideos(true);
    setError(null);
    try {
      if (reset) {
        youtubeService.resetPagination();
        setVideos([]);
        setNextPageToken(null);
      }

      const result = await youtubeService.listVideos(
        12,
        reset ? undefined : nextPageToken || undefined,
        showPrivateVideos,
        searchQuery,
        showUnlistedVideos
      );

      if (reset) {
        setVideos(result.videos);
        setNextPageToken(result.nextPageToken);
        setHasMore(!!result.nextPageToken);
      } else {
        // 去重：過濾掉已經存在的影片
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          const newVideos = result.videos.filter(v => !existingIds.has(v.id));

          // 如果沒有新影片但還有下一頁，自動載入下一頁
          if (newVideos.length === 0 && result.nextPageToken) {
            setNextPageToken(result.nextPageToken);
            // 不要在這裡遞迴調用，讓使用者再按一次
            setHasMore(true);
          } else {
            setNextPageToken(result.nextPageToken);
            setHasMore(!!result.nextPageToken);
          }

          return [...prev, ...newVideos];
        });
      }
    } catch (e: any) {
      setError('Could not fetch YouTube videos. The API quota may be exceeded or permissions are missing.');
      console.error(e);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const loadMoreVideos = async () => {
    if (!hasMore || isLoadingVideos) return;
    await fetchVideos(false);
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
      fetchVideos(true);
    }
  }, [showPrivateVideos, showUnlistedVideos]);

  // Re-fetch videos when searchQuery changes (with debounce)
  useEffect(() => {
    if (!isLoggedIn) return;

    const timer = setTimeout(() => {
      fetchVideos(true);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

    return (
      <>
        <div className="mb-6 space-y-4">
          {/* 搜尋框和篩選選項 */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* 搜尋框 */}
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋影片標題或描述..."
                className="w-full pl-12 pr-10 py-3 rounded-full bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  aria-label="清除搜尋"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* 顯示未公開 / 私人影片開關 */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-end md:justify-start">
              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-sm text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  顯示未公開影片
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showUnlistedVideos}
                    onChange={handleToggleUnlistedVideos}
                    className="sr-only peer"
                  />
                  <div
                    className="w-12 h-6 rounded-full transition-colors peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-neutral-300 after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{
                      backgroundColor: showUnlistedVideos ? '#FF0000' : '#E5E5E5',
                      border: `1px solid ${showUnlistedVideos ? '#CC0000' : '#E5E5E5'}`
                    }}
                  ></div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-sm text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  顯示私人影片
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showPrivateVideos}
                    onChange={handleTogglePrivateVideos}
                    className="sr-only peer"
                  />
                  <div
                    className="w-12 h-6 rounded-full transition-colors peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-neutral-300 after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{
                      backgroundColor: showPrivateVideos ? '#FF0000' : '#E5E5E5',
                      border: `1px solid ${showPrivateVideos ? '#CC0000' : '#E5E5E5'}`
                    }}
                  ></div>
                </div>
              </label>
            </div>
          </div>

          {/* 搜尋結果提示 */}
          {searchQuery && !isLoadingVideos && (
            <div className="text-sm text-red-600">
              {videos.length > 0 ? (
                <span>找到 {videos.length} 個包含「{searchQuery}」的影片</span>
              ) : (
                <span>未找到包含「{searchQuery}」的影片</span>
              )}
            </div>
          )}
        </div>

        <VideoSelector
          videos={videos}
          isLoading={isLoadingVideos}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMoreVideos}
        />
      </>
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
        <div className="container mx-auto max-w-7xl">
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
    </div>
  );
}
