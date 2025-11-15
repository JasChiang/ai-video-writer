import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { GITHUB_GIST_ID } from './config';

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
  const [portalReady, setPortalReady] = useState(false);
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

  // 從 localStorage 合併本地更新
  const mergeLocalUpdates = (videos: YouTubeVideo[]): YouTubeVideo[] => {
    try {
      const updatesJson = localStorage.getItem('videoMetadataUpdates');
      if (!updatesJson) return videos;

      const updates = JSON.parse(updatesJson);

      return videos.map(video => {
        const localUpdate = updates[video.id];
        if (localUpdate) {
          console.log(`[App] 合併本地更新: ${video.id}`, localUpdate);
          return { ...video, ...localUpdate };
        }
        return video;
      });
    } catch (error) {
      console.error('[App] 合併本地更新失敗:', error);
      return videos;
    }
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

      // 如果有搜尋關鍵字且有 GIST_ID，優先使用 Gist 快取搜尋（配額成本 0）
      if (searchQuery && searchQuery.trim() && GITHUB_GIST_ID) {
        console.log('[App] 使用 Gist 快取搜尋，關鍵字:', searchQuery);

        const response = await fetch(
          `/api/video-cache/search?gistId=${encodeURIComponent(GITHUB_GIST_ID)}&query=${encodeURIComponent(searchQuery.trim())}&maxResults=10000`
        );

        if (!response.ok) {
          throw new Error(`快取搜尋失敗: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || '快取搜尋失敗');
        }

        console.log(`[App] API 返回 ${data.videos.length} 支影片`);

        // 將快取資料格式轉換為 YouTubeVideo 格式
        const cacheVideos: YouTubeVideo[] = [];
        const skippedVideos: any[] = [];

        for (const v of data.videos) {
          try {
            // 檢查必要欄位
            if (!v.videoId) {
              skippedVideos.push({ reason: 'missing videoId', data: v });
              continue;
            }

            cacheVideos.push({
              id: v.videoId,
              title: v.title || '(無標題)',
              description: '', // 描述未包含在快取中，需要時才抓取
              thumbnailUrl: v.thumbnail || '',
              tags: v.tags || [],
              categoryId: v.categoryId || '',
              privacyStatus: v.privacyStatus || 'public',
              publishedAt: v.publishedAt || '',
              viewCount: v.viewCount || 0,
              likeCount: v.likeCount || 0,
              commentCount: v.commentCount || 0,
            });
          } catch (err: any) {
            skippedVideos.push({ reason: err.message, data: v });
          }
        }

        if (skippedVideos.length > 0) {
          console.warn(`[App] ⚠️ 轉換時跳過 ${skippedVideos.length} 支影片:`);
          console.table(skippedVideos);
        }

        console.log(`[App] 轉換後 ${cacheVideos.length} 支影片`);

        // 過濾影片狀態
        const filteredVideos = cacheVideos.filter(video => {
          if (video.privacyStatus === 'public') return true;
          if (video.privacyStatus === 'unlisted') return showUnlistedVideos;
          if (video.privacyStatus === 'private') return showPrivateVideos;
          return false;
        });

        // Debug: 顯示被過濾掉的影片
        const filtered = cacheVideos.filter(video => {
          if (video.privacyStatus === 'public') return false;
          if (video.privacyStatus === 'unlisted' && showUnlistedVideos) return false;
          if (video.privacyStatus === 'private' && showPrivateVideos) return false;
          return true;
        });

        if (filtered.length > 0) {
          console.log(`[App] 共 ${cacheVideos.length} 支影片，過濾掉 ${filtered.length} 支 (${filtered.map(v => v.privacyStatus).join(', ')})`);
          console.table(filtered.map(v => ({
            videoId: v.id,
            title: v.title,
            privacyStatus: v.privacyStatus,
            publishedAt: v.publishedAt
          })));
        }

        console.log(`[App] 過濾後 ${filteredVideos.length} 支影片`);

        // 去重：確保每個影片 ID 只出現一次
        const uniqueVideos = Array.from(
          new Map(filteredVideos.map(video => [video.id, video])).values()
        );

        const duplicateCount = filteredVideos.length - uniqueVideos.length;
        if (duplicateCount > 0) {
          console.warn(`[App] ⚠️ 去重移除 ${duplicateCount} 支重複影片`);

          // 找出重複的影片
          const idCounts = new Map<string, number>();
          filteredVideos.forEach(video => {
            idCounts.set(video.id, (idCounts.get(video.id) || 0) + 1);
          });
          const duplicates = Array.from(idCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([id, count]) => ({
              videoId: id,
              count,
              title: filteredVideos.find(v => v.id === id)?.title
            }));
          console.table(duplicates);
        }

        console.log(`[App] 最終顯示 ${uniqueVideos.length} 支影片`);

        // 合併本地更新（覆蓋 Gist 快取中的舊資料）
        const mergedVideos = mergeLocalUpdates(uniqueVideos);

        setVideos(mergedVideos);
        setNextPageToken(null);
        setHasMore(false); // 快取搜尋一次返回所有結果
        setSelectedVideoId(prev => {
          if (prev && mergedVideos.some(video => video.id === prev)) {
            return prev;
          }
          return showDetailSidebar ? mergedVideos[0]?.id ?? null : null;
        });
      } else {
        // 無搜尋關鍵字或沒有 GIST_ID，使用 YouTube API
        if (searchQuery && searchQuery.trim() && !GITHUB_GIST_ID) {
          console.warn('[App] 未設定 GIST_ID，使用 YouTube API 搜尋（配額成本較高）');
        }

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

        // 額外確保去重：使用 Map 確保每個 ID 只出現一次
        const uniqueVideos = Array.from(
          new Map(dedupedVideos.map(video => [video.id, video])).values()
        );

        setVideos(uniqueVideos);
        setNextPageToken(result.nextPageToken);
        setHasMore(!!result.nextPageToken);
        setSelectedVideoId(prev => {
          if (prev && uniqueVideos.some(video => video.id === prev)) {
            return prev;
          }
          return showDetailSidebar ? uniqueVideos[0]?.id ?? null : null;
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

  // 手動搜尋處理函數
  const handleSearch = () => {
    if (isLoggedIn) {
      fetchVideos({ reset: true, trigger: 'search-query' });
    }
  };

  // 處理 Enter 鍵搜尋
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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

  // 更新影片列表中的特定影片資料
  const handleVideoUpdate = (updatedVideo: Partial<YouTubeVideo> & { id: string }) => {
    setVideos(prevVideos =>
      prevVideos.map(video =>
        video.id === updatedVideo.id
          ? { ...video, ...updatedVideo }
          : video
      )
    );
  };

  const selectedVideo = selectedVideoId
    ? videos.find(video => video.id === selectedVideoId) ?? null
    : null;

  // 使用 Portal 渲染 Detail Panel 到指定位置
  const renderDetailPanel = () => {
    if (!selectedVideo || !portalReady) return null;

    const detailPanelContent = (
      <VideoDetailPanel
        key={selectedVideo.id}
        video={selectedVideo}
        onVideoUpdate={handleVideoUpdate}
      />
    );

    if (useInlineDetail) {
      // 小螢幕：使用 Portal 渲染到選中影片的 slot 中
      const targetSlot = document.getElementById(`detail-slot-${selectedVideo.id}`);
      if (!targetSlot) return null;
      return createPortal(detailPanelContent, targetSlot);
    } else {
      // 大螢幕：使用 Portal 渲染到 sidebar 的滾動容器中
      const sidebarScroll = document.getElementById('detail-sidebar-scroll');
      if (!sidebarScroll) return null;
      return createPortal(detailPanelContent, sidebarScroll);
    }
  };

  // 確保 Portal 目標容器已就緒
  useEffect(() => {
    if (!selectedVideo) {
      setPortalReady(false);
      return;
    }

    // 使用 requestAnimationFrame 確保 DOM 已更新
    const checkPortalTarget = () => {
      if (useInlineDetail) {
        const targetSlot = document.getElementById(`detail-slot-${selectedVideo.id}`);
        setPortalReady(!!targetSlot);
      } else {
        const sidebarScroll = document.getElementById('detail-sidebar-scroll');
        setPortalReady(!!sidebarScroll);
      }
    };

    requestAnimationFrame(checkPortalTarget);
  }, [selectedVideo, useInlineDetail]);

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
    <div className="space-y-4 font-['Roboto',sans-serif]">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#606060]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          placeholder="搜尋影片標題（按 Enter 搜尋）..."
          className="w-full rounded-full border border-[#CCCCCC] bg-[#F9F9F9] pl-12 pr-24 py-2.5 text-sm text-[#030303] transition-all duration-200 focus:border-[#065FD4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#065FD4]/20 sm:text-base placeholder:text-[#909090]"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#606060] transition-colors duration-150 hover:text-[#030303] focus:outline-none p-1"
              aria-label="清除搜尋"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSearch}
            className="text-[#065FD4] transition-colors duration-150 hover:text-[#0553C1] focus:outline-none p-1"
            aria-label="搜尋"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleToggleUnlistedVideos}
          aria-pressed={showUnlistedVideos}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065FD4] focus-visible:ring-offset-2 ${
            showUnlistedVideos
              ? 'border-[#065FD4] bg-[#E8F0FE] text-[#065FD4] shadow-sm'
              : 'border-[#E5E5E5] bg-white text-[#030303] hover:border-[#909090] hover:bg-[#F9F9F9]'
          }`}
        >
          <span className="font-medium">顯示未公開影片</span>
          <span
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${
              showUnlistedVideos ? 'bg-[#065FD4]' : 'bg-[#CCCCCC]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                showUnlistedVideos ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={handleTogglePrivateVideos}
          aria-pressed={showPrivateVideos}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065FD4] focus-visible:ring-offset-2 ${
            showPrivateVideos
              ? 'border-[#065FD4] bg-[#E8F0FE] text-[#065FD4] shadow-sm'
              : 'border-[#E5E5E5] bg-white text-[#030303] hover:border-[#909090] hover:bg-[#F9F9F9]'
          }`}
        >
          <span className="font-medium">顯示私人影片</span>
          <span
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${
              showPrivateVideos ? 'bg-[#065FD4]' : 'bg-[#CCCCCC]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                showPrivateVideos ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-[#606060]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F2F2] text-xs font-semibold text-[#030303]">
            {videos.length}
          </span>
          <span className="font-medium">符合條件的影片</span>
        </div>
        <button
          type="button"
          onClick={handleResetFilters}
          disabled={!hasActiveFilters}
          className={`text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065FD4] focus-visible:ring-offset-2 rounded px-2 py-1 ${
            hasActiveFilters
              ? 'text-[#065FD4] hover:text-[#0553C1] hover:bg-[#E8F0FE]'
              : 'cursor-not-allowed text-[#CCCCCC]'
          }`}
        >
          重設篩選
        </button>
      </div>

      {searchQuery && !isLoadingVideos && (
        <div className="rounded-lg border border-[#E8F0FE] bg-[#F8FBFF] px-4 py-3 text-sm text-[#065FD4]">
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
      <div className="space-x-0 space-y-5 font-['Roboto',sans-serif]">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsFilterPanelOpen(prev => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 text-sm font-medium text-[#030303] shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065FD4] focus-visible:ring-offset-2 hover:bg-[#F9F9F9]"
          >
            <span>搜尋與篩選</span>
            <svg
              className={`h-5 w-5 transition-transform duration-200 ${isFilterPanelOpen ? 'rotate-180 text-[#065FD4]' : 'text-[#606060]'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isFilterPanelOpen && (
            <div className="mt-3 rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
              {renderFilterControls()}
            </div>
          )}
        </div>

        <div
          className="grid gap-6 lg:gap-6 xl:gap-8 2xl:gap-10"
          style={{ gridTemplateColumns: layoutTemplateColumns }}
        >
          <aside className="mb-6 hidden lg:block xl:mb-0">
            <div className="space-y-4 rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] lg:sticky lg:top-28">
              <div className="space-y-1.5">
                <h2 className="text-lg font-medium text-[#030303]">搜尋與篩選</h2>
                <p className="text-sm text-[#606060]">
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
              showInlineDetail={useInlineDetail}
            />
          </section>

          {/* Desktop sidebar - 獨立滾動容器 */}
          <aside className="hidden xl:block">
            {selectedVideo ? (
              <div
                className="lg:sticky lg:top-28 overflow-y-auto"
                style={{
                  maxHeight: 'calc(100vh - 8rem)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#909090 transparent',
                }}
                id="detail-sidebar-scroll"
              >
                {/* VideoDetailPanel 將由 Portal 渲染到這裡 */}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#E5E5E5] bg-[#F9F9F9] px-6 py-12 text-center">
                <div>
                  <div className="w-16 h-16 rounded-full bg-white mx-auto mb-4 flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                    <svg className="w-8 h-8 text-[#606060]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-[#030303]">選擇左側影片以檢視內容</h3>
                  <p className="mt-2 text-sm text-[#606060]">包含影片預覽、近期數據與 Gemini 建議。</p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Detail Panel - 使用 Portal 動態渲染到目標位置 */}
        {renderDetailPanel()}
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
