/**
 * 前端影片快取服務
 * 從 Gist 載入快取並進行搜尋
 */

import type { YouTubeVideo } from '../types';
import { recordQuota } from '../utils/quotaTracker';

declare const gapi: any;

const CACHE_STORAGE_KEY = 'youtubeContentAssistant.videoCache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時

interface CachedVideo {
    videoId: string;
    title: string;
    publishedAt: string;
    thumbnail: string;
}

interface VideoCache {
    version: string;
    updatedAt: string;
    totalVideos: number;
    videos: CachedVideo[];
}

interface StoredCache {
    data: VideoCache;
    timestamp: number;
}

const YT_QUOTA_COST = {
    videosListPartCost: {
        snippet: 2,
        status: 2,
        statistics: 2,
        contentDetails: 2,
    } as Record<string, number>,
};

function calculatePartCost(parts: string, mapping: Record<string, number>): number {
    return parts
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((total, part) => total + (mapping[part] ?? 0), 0);
}

/**
 * 從 localStorage 載入快取
 */
function loadCacheFromLocalStorage(): VideoCache | null {
    try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY);
        if (!stored) return null;

        const cache: StoredCache = JSON.parse(stored);

        // 檢查快取是否過期
        if (Date.now() - cache.timestamp > CACHE_TTL_MS) {
            console.log('[VideoCache] 快取已過期');
            localStorage.removeItem(CACHE_STORAGE_KEY);
            return null;
        }

        console.log(`[VideoCache] 從 localStorage 載入快取: ${cache.data.totalVideos} 支影片`);
        return cache.data;
    } catch (error) {
        console.error('[VideoCache] 載入 localStorage 快取失敗:', error);
        return null;
    }
}

/**
 * 儲存快取到 localStorage
 */
function saveCacheToLocalStorage(cache: VideoCache): void {
    try {
        const stored: StoredCache = {
            data: cache,
            timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
        console.log(`[VideoCache] 快取已儲存到 localStorage`);
    } catch (error) {
        console.error('[VideoCache] 儲存快取到 localStorage 失敗:', error);
    }
}

/**
 * 從 Gist 載入快取
 */
export async function loadCacheFromGist(gistId: string): Promise<VideoCache> {
    // 先嘗試從 localStorage 載入
    const localCache = loadCacheFromLocalStorage();
    if (localCache) {
        return localCache;
    }

    // 從 Gist 載入
    console.log(`[VideoCache] 從 Gist 載入快取: ${gistId}`);

    const response = await fetch(`/api/video-cache/load/${gistId}`);

    if (!response.ok) {
        throw new Error(`載入快取失敗: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || '載入快取失敗');
    }

    const cache: VideoCache = {
        version: result.version,
        updatedAt: result.updatedAt,
        totalVideos: result.totalVideos,
        videos: result.videos,
    };

    // 儲存到 localStorage
    saveCacheToLocalStorage(cache);

    return cache;
}

/**
 * 在快取中搜尋影片
 */
export function searchInCache(cache: VideoCache, keyword: string): CachedVideo[] {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
        return cache.videos;
    }

    return cache.videos.filter(video =>
        video.title.toLowerCase().includes(normalizedKeyword)
    );
}

/**
 * 使用 videos.list 分批載入影片詳細資訊
 * @param videoIds - 影片 ID 列表
 * @param batchSize - 每批數量（最大 50）
 * @param onBatch - 每批載入完成的回調函數
 */
export async function loadVideoDetailsBatch(
    videoIds: string[],
    batchSize: number = 50,
    onBatch?: (videos: YouTubeVideo[], batchIndex: number, totalBatches: number) => void
): Promise<YouTubeVideo[]> {
    const allVideos: YouTubeVideo[] = [];
    const totalBatches = Math.ceil(videoIds.length / batchSize);

    console.log(`[VideoCache] 開始分批載入 ${videoIds.length} 支影片詳細資訊（每批 ${batchSize} 支，共 ${totalBatches} 批）`);

    for (let i = 0; i < videoIds.length; i += batchSize) {
        const batchIndex = Math.floor(i / batchSize);
        const batch = videoIds.slice(i, i + batchSize);

        console.log(`[VideoCache] 載入第 ${batchIndex + 1}/${totalBatches} 批（${batch.length} 支影片）...`);

        try {
            const videosResponse = await gapi.client.youtube.videos.list({
                part: 'snippet,status,statistics,contentDetails',
                id: batch.join(','),
            });

            const parts = 'snippet,status,statistics,contentDetails';
            recordQuota(
                'youtube.videos.list',
                calculatePartCost(parts, YT_QUOTA_COST.videosListPartCost),
                {
                    part: parts,
                    apiSource: 'videoCache',
                    trigger: 'search-from-cache',
                    caller: 'videoCacheService.loadVideoDetailsBatch',
                    batch: batchIndex + 1,
                    totalBatches,
                    batchSize: batch.length,
                }
            );

            const items = videosResponse.result.items || [];
            const videos: YouTubeVideo[] = items.map((item: any) => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                tags: item.snippet.tags || [],
                categoryId: item.snippet.categoryId,
                privacyStatus: item.status?.privacyStatus || 'public',
                duration: item.contentDetails?.duration,
                viewCount: item.statistics?.viewCount,
                likeCount: item.statistics?.likeCount,
                publishedAt: item.snippet?.publishedAt,
            }));

            allVideos.push(...videos);

            // 呼叫回調函數
            if (onBatch) {
                onBatch(videos, batchIndex + 1, totalBatches);
            }

            console.log(`[VideoCache] 第 ${batchIndex + 1}/${totalBatches} 批載入完成（${videos.length} 支影片）`);
        } catch (error) {
            console.error(`[VideoCache] 第 ${batchIndex + 1}/${totalBatches} 批載入失敗:`, error);
            throw error;
        }
    }

    console.log(`[VideoCache] ✅ 所有批次載入完成，共 ${allVideos.length} 支影片`);

    return allVideos;
}

/**
 * 清除 localStorage 快取
 */
export function clearCache(): void {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    console.log('[VideoCache] 快取已清除');
}

/**
 * 檢查快取是否需要更新
 */
export function needsCacheUpdate(): boolean {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!stored) return true;

    try {
        const cache: StoredCache = JSON.parse(stored);
        return Date.now() - cache.timestamp > CACHE_TTL_MS;
    } catch {
        return true;
    }
}
