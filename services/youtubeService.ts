// Add type declarations for Google API scripts
declare const gapi: any;
declare const google: any;

import { YOUTUBE_CLIENT_ID, YOUTUBE_SCOPES } from '../config';
import type { YouTubeVideo } from '../types';
import { recordQuota } from '../utils/quotaTracker';

let tokenClient: any = null;
let isGapiInitialized = false;
let isGisInitialized = false;
let gapiInitializationPromise: Promise<void> | null = null;
let gisInitializationPromise: Promise<void> | null = null;
const TOKEN_STORAGE_KEY = 'youtubeContentAssistant.oauthToken';
let storedTokenExpiry: number | null = null;
let uploadsPlaylistId: string | null = null;
let uploadsPlaylistPromise: Promise<string> | null = null;

type QuotaTriggerOptions = {
    trigger?: string;
    source?: string;
    reset?: boolean;
};

const YT_QUOTA_COST = {
    searchList: 100,
    channelsList: 1,
    playlistItemsPartCost: {
        snippet: 2,
        contentDetails: 2,
        status: 2,
    } as Record<string, number>,
    videosListPartCost: {
        snippet: 2,
        status: 2,
        statistics: 2,
        contentDetails: 2,
    } as Record<string, number>,
    videosUpdate: 50,
};

function calculatePartCost(parts: string, mapping: Record<string, number>): number {
    return parts
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((total, part) => total + (mapping[part] ?? 0), 0);
}

function persistToken(token: any, expiresIn?: number) {
    if (typeof window === 'undefined') return;

    try {
        if (!token) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            storedTokenExpiry = null;
            return;
        }

        let expiresAt: number | null = null;
        if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
            const buffer = Math.max(expiresIn - 60, 0); // refresh one minute early
            expiresAt = Date.now() + buffer * 1000;
        }

        const payload = {
            token,
            expiresAt,
        };
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
        storedTokenExpiry = expiresAt;
    } catch (error) {
        console.warn('Failed to persist OAuth token', error);
    }
}

export function restoreStoredToken(): boolean {
    if (typeof window === 'undefined') return false;

    try {
        const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!raw) return false;

        const parsed = JSON.parse(raw);
        const expiresAt = typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null;

        if (expiresAt && expiresAt <= Date.now()) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            storedTokenExpiry = null;
            return false;
        }

        if (parsed?.token?.access_token) {
            gapi.client.setToken(parsed.token);
            storedTokenExpiry = expiresAt;
            return true;
        }
    } catch (error) {
        console.warn('Failed to restore OAuth token', error);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        storedTokenExpiry = null;
    }

    return false;
}


function initializeGapiClient(): Promise<void> {
    if (gapiInitializationPromise) return gapiInitializationPromise;

    gapiInitializationPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    // 使用 OAuth 2.0 方式初始化，不需要 API Key
                    // API Key 已經移到後端處理，前端只使用 OAuth token
                    await gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
                    });
                    isGapiInitialized = true;
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
    return gapiInitializationPromise;
}

function initializeGisClient(): Promise<void> {
    if (gisInitializationPromise) return gisInitializationPromise;
    
    gisInitializationPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
             try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: YOUTUBE_CLIENT_ID,
                    scope: YOUTUBE_SCOPES,
                    callback: '', // The callback is handled by the promise in requestToken
                });
                isGisInitialized = true;
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
    return gisInitializationPromise;
}

export async function initialize(): Promise<void> {
    if (!YOUTUBE_CLIENT_ID) {
        throw new Error("YouTube Client ID is not configured.");
    }
    await Promise.all([initializeGapiClient(), initializeGisClient()]);
}

export function isTokenValid(): boolean {
    const token = gapi.client.getToken();
    if (!token?.access_token) {
        return false;
    }

    if (storedTokenExpiry && storedTokenExpiry <= Date.now()) {
        persistToken(null);
        return false;
    }

    return true;
}

export function requestToken(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!isGisInitialized) {
            return reject(new Error("Google Identity Service not initialized."));
        }

        const callback = (resp: any) => {
            if (resp.error) {
                return reject(resp);
            }
            gapi.client.setToken(resp);
            const expiresIn = typeof resp.expires_in === 'number'
                ? resp.expires_in
                : parseInt(resp.expires_in, 10);
            persistToken(gapi.client.getToken(), Number.isFinite(expiresIn) ? expiresIn : undefined);
            resolve();
        };

        tokenClient.callback = callback;
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

async function resolveUploadsPlaylistId(): Promise<string> {
    if (uploadsPlaylistId) {
        return uploadsPlaylistId;
    }

    if (uploadsPlaylistPromise) {
        return uploadsPlaylistPromise;
    }

    uploadsPlaylistPromise = new Promise(async (resolve, reject) => {
        try {
            const response = await gapi.client.youtube.channels.list({
                part: 'contentDetails',
                mine: true,
            });
            recordQuota('youtube.channels.list', YT_QUOTA_COST.channelsList, {
                part: 'contentDetails',
                context: 'resolveUploadsPlaylistId',
                caller: 'youtubeService.resolveUploadsPlaylistId',
            });

            const uploadsId = response.result?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) {
                throw new Error('Could not resolve uploads playlist ID');
            }

            uploadsPlaylistId = uploadsId;
            resolve(uploadsId);
        } catch (error) {
            uploadsPlaylistPromise = null;
            reject(error);
        }
    });

    return uploadsPlaylistPromise;
}

function mapVideoItem(item: any): YouTubeVideo {
    return {
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
    };
}

async function listVideosBySearch(
    maxResults: number,
    pageToken: string | undefined,
    showPrivateVideos: boolean,
    searchQuery: string | undefined,
    showUnlistedVideos: boolean,
    options: QuotaTriggerOptions
): Promise<{ videos: YouTubeVideo[]; nextPageToken: string | null }> {
    console.log('[YouTubeService] listVideosBySearch:start', {
        searchQuery,
        pageToken,
        maxResults,
        showPrivateVideos,
        showUnlistedVideos,
        trigger: options.trigger,
    });

    const searchParams: any = {
        part: 'snippet',
        forMine: true,
        type: 'video',
        maxResults,
        order: 'date',
    };

    if (searchQuery && searchQuery.trim()) {
        searchParams.q = searchQuery.trim();
    }

    if (pageToken) {
        searchParams.pageToken = pageToken;
    }

    const searchResponse = await gapi.client.youtube.search.list(searchParams);
    recordQuota('youtube.search.list', YT_QUOTA_COST.searchList, {
        hasQuery: Boolean(searchParams.q),
        maxResults,
        trigger: options.trigger,
        caller: options.source,
        reset: options.reset,
    });

    if (!searchResponse.result.items || searchResponse.result.items.length === 0) {
        console.log('[YouTubeService] listVideosBySearch:empty', {
            searchQuery,
            pageToken,
        });
        return { videos: [], nextPageToken: null };
    }

    const nextPageToken = searchResponse.result.nextPageToken || null;

    const videoIds = searchResponse.result.items.map((item: any) => item.id.videoId).join(',');

    const videosResponse = await gapi.client.youtube.videos.list({
        part: 'snippet,status,statistics,contentDetails',
        id: videoIds,
    });
    const searchParts = 'snippet,status,statistics,contentDetails';
    recordQuota(
        'youtube.videos.list',
        calculatePartCost(searchParts, YT_QUOTA_COST.videosListPartCost),
        {
            part: searchParts,
            apiSource: 'search',
            trigger: options.trigger,
            caller: options.source,
            reset: options.reset,
            searchQuery: searchQuery?.trim() || null,
        }
    );

    if (!videosResponse.result.items) {
        console.log('[YouTubeService] listVideosBySearch:noDetails', {
            searchQuery,
            pageToken,
            requestedIds: videoIds.split(',').length,
        });
        return { videos: [], nextPageToken: null };
    }

    const videos = videosResponse.result.items
        .filter((item: any) => {
            const privacyStatus = item.status?.privacyStatus || 'public';

            if (privacyStatus === 'public') {
                return true;
            }

            if (privacyStatus === 'unlisted') {
                return showUnlistedVideos;
            }

            if (privacyStatus === 'private') {
                return showPrivateVideos;
            }

            return false;
        })
        .map(mapVideoItem);

    console.log('[YouTubeService] listVideosBySearch:done', {
        searchQuery,
        pageToken,
        returned: videos.length,
        nextPageToken,
    });

    return { videos, nextPageToken };
}

async function listVideosFromUploadsPlaylist(
    maxResults: number,
    pageToken: string | undefined,
    showPrivateVideos: boolean,
    showUnlistedVideos: boolean,
    options: QuotaTriggerOptions
): Promise<{ videos: YouTubeVideo[]; nextPageToken: string | null }> {
    const playlistId = await resolveUploadsPlaylistId();

    const playlistResponse = await gapi.client.youtube.playlistItems.list({
        part: 'snippet,contentDetails,status',
        playlistId,
        maxResults: Math.min(maxResults, 50),
        pageToken,
    });
    const playlistParts = 'snippet,contentDetails,status';
    recordQuota(
        'youtube.playlistItems.list',
        calculatePartCost(playlistParts, YT_QUOTA_COST.playlistItemsPartCost),
        {
            part: playlistParts,
            maxResults: Math.min(maxResults, 50),
            trigger: options.trigger,
            caller: options.source,
            reset: options.reset,
        }
    );

    const items = playlistResponse.result.items || [];
    if (items.length === 0) {
        return { videos: [], nextPageToken: null };
    }

    const nextPageToken = playlistResponse.result.nextPageToken || null;
    const videoIds = items
        .map((item: any) => item.contentDetails?.videoId)
        .filter(Boolean);

    if (videoIds.length === 0) {
        return { videos: [], nextPageToken };
    }

    const videosResponse = await gapi.client.youtube.videos.list({
        part: 'snippet,status,statistics,contentDetails',
        id: videoIds.join(','),
    });
    const playlistVideoParts = 'snippet,status,statistics,contentDetails';
    recordQuota(
        'youtube.videos.list',
        calculatePartCost(playlistVideoParts, YT_QUOTA_COST.videosListPartCost),
        {
            part: playlistVideoParts,
            apiSource: 'uploadsPlaylist',
            trigger: options.trigger,
            caller: options.source,
            reset: options.reset,
            showPrivateVideos,
            showUnlistedVideos,
        }
    );

    const detailedItems = videosResponse.result.items || [];
    const itemMap = new Map<string, any>();
    detailedItems.forEach((item: any) => {
        if (item.id) {
            itemMap.set(item.id, item);
        }
    });

    const orderedVideos = videoIds
        .map((id: string) => itemMap.get(id))
        .filter((item: any) => {
            if (!item) return false;

            const privacyStatus = item.status?.privacyStatus || 'public';
            if (privacyStatus === 'public') return true;
            if (privacyStatus === 'unlisted') return showUnlistedVideos;
            if (privacyStatus === 'private') return showPrivateVideos;
            return false;
        })
        .map(mapVideoItem);

    return { videos: orderedVideos, nextPageToken };
}

export async function listVideos(
    maxResults = 12,
    pageToken?: string,
    showPrivateVideos = false,
    searchQuery?: string,
    showUnlistedVideos = false,
    options: QuotaTriggerOptions = {}
): Promise<{ videos: YouTubeVideo[], nextPageToken: string | null }> {
    if (!isGapiInitialized || !isTokenValid()) {
        throw new Error("Authentication required.");
    }

    try {
        const hasSearchQuery = Boolean(searchQuery && searchQuery.trim());

        if (hasSearchQuery) {
            return await listVideosBySearch(
                maxResults,
                pageToken,
                showPrivateVideos,
                searchQuery,
                showUnlistedVideos,
                options
            );
        }

        return await listVideosFromUploadsPlaylist(
            maxResults,
            pageToken,
            showPrivateVideos,
            showUnlistedVideos,
            options
        );
    } catch (error: any) {
        console.error("Error listing videos:", error);
        const status = error?.status || error?.result?.error?.code;
        if (status === 401) {
            persistToken(null);
        }
        throw new Error(error.result?.error?.message || "Failed to fetch videos from YouTube.");
    }
}

export async function fetchVideoDetails(videoId: string): Promise<YouTubeVideo> {
    if (!isGapiInitialized || !isTokenValid()) {
        throw new Error('Authentication required.');
    }

    try {
        const parts = 'snippet,status,statistics,contentDetails';
        const response = await gapi.client.youtube.videos.list({
            part: parts,
            id: videoId,
        });
        recordQuota(
            'youtube.videos.list',
            calculatePartCost(parts, YT_QUOTA_COST.videosListPartCost),
            {
                part: parts,
                trigger: 'fetch-video-details',
                caller: 'youtubeService.fetchVideoDetails',
                videoId,
            }
        );

        const item = response.result.items?.[0];
        if (!item) {
            throw new Error('找不到指定影片，請確認連結是否正確或影片權限。');
        }

        return mapVideoItem(item);
    } catch (error: any) {
        console.error('Error fetching video details:', error);
        throw new Error(error.result?.error?.message || '無法取得影片資訊');
    }
}

export async function searchVideosByKeyword(query: string, maxResults = 10): Promise<YouTubeVideo[]> {
    if (!isGapiInitialized || !isTokenValid()) {
        throw new Error('Authentication required.');
    }

    try {
        console.log('[YouTubeService] searchVideosByKeyword:start', { query, maxResults });
        const searchResponse = await gapi.client.youtube.search.list({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults,
            order: 'relevance',
        });
        recordQuota('youtube.search.list', YT_QUOTA_COST.searchList, {
            hasQuery: true,
            maxResults,
            trigger: 'article-search',
            caller: 'youtubeService.searchVideosByKeyword',
        });

        const items = searchResponse.result.items || [];
        if (items.length === 0) return [];

        const ids = items.map((item: any) => item.id?.videoId).filter(Boolean);
        if (ids.length === 0) {
            return [];
        }

        const parts = 'snippet,status,statistics,contentDetails';
        const videosResponse = await gapi.client.youtube.videos.list({
            part: parts,
            id: ids.join(','),
        });
        recordQuota(
            'youtube.videos.list',
            calculatePartCost(parts, YT_QUOTA_COST.videosListPartCost),
            {
                part: parts,
                trigger: 'article-search',
                caller: 'youtubeService.searchVideosByKeyword',
                searchQuery: query,
            }
        );

        const details = videosResponse.result.items || [];
        const mapById = new Map(details.map((item: any) => [item.id, mapVideoItem(item)]));
        const videos = ids
            .map(id => mapById.get(id))
            .filter((video): video is YouTubeVideo => Boolean(video));
        console.log('[YouTubeService] searchVideosByKeyword:done', {
            query,
            requested: ids.length,
            resolved: videos.length,
        });
        return videos;
    } catch (error: any) {
        console.error('Error searching videos:', error);
        throw new Error(error.result?.error?.message || '搜尋影片時發生錯誤');
    }
}

export function resetPagination(): void {
    // 重置分頁狀態（如果需要的話）
    // 目前 pageToken 由 App.tsx 管理，這裡保留函數以保持 API 一致性
}

export async function getVideoMetadata(
    videoId: string,
    options: QuotaTriggerOptions = {}
): Promise<{ title: string; description: string; tags: string[]; categoryId: string }> {
    if (!isGapiInitialized || !isTokenValid()) {
        throw new Error("Authentication required.");
    }

    try {
        const response = await gapi.client.youtube.videos.list({
            part: 'snippet',
            id: videoId,
        });
        recordQuota(
            'youtube.videos.list',
            calculatePartCost('snippet', YT_QUOTA_COST.videosListPartCost),
            {
                part: 'snippet',
                context: 'getVideoMetadata',
                trigger: options.trigger,
                caller: options.source,
                videoId,
            }
        );

        const item = response.result.items?.[0];
        if (!item) {
            throw new Error('找不到影片資訊');
        }

        return {
            title: item.snippet?.title || '',
            description: item.snippet?.description || '',
            tags: item.snippet?.tags || [],
            categoryId: item.snippet?.categoryId || '',
        };
    } catch (error: any) {
        console.error('Error fetching video metadata:', error);
        throw new Error(error.result?.error?.message || 'Failed to fetch video metadata');
    }
}


export async function updateVideo(
    video: Partial<YouTubeVideo> & { id: string; categoryId: string },
    options: QuotaTriggerOptions = {}
): Promise<any> {
     if (!isGapiInitialized || !isTokenValid()) {
        throw new Error("Authentication required.");
    }
    try {
        const resource = {
            id: video.id,
            snippet: {
                title: video.title,
                description: video.description,
                tags: video.tags,
                categoryId: video.categoryId,
            },
        };

        const response = await gapi.client.youtube.videos.update({
            part: 'snippet',
        }, resource);
        recordQuota('youtube.videos.update', YT_QUOTA_COST.videosUpdate, {
            part: 'snippet',
            fields: Object.keys(resource.snippet ?? {}),
            trigger: options.trigger,
            caller: options.source,
            videoId: video.id,
        });

        return response.result;

    } catch (error: any) {
        console.error("Error updating video:", error);
        throw new Error(error.result?.error?.message || "Failed to update the video on YouTube.");
    }
}

export function logout(): void {
    // 清除 gapi token
    if (isGapiInitialized && gapi?.client?.getToken()) {
        gapi.client.setToken(null);
    }

    // 清除 localStorage 中的 token
    persistToken(null);

    // 重置內部狀態
    storedTokenExpiry = null;
    uploadsPlaylistId = null;
    uploadsPlaylistPromise = null;

    // 如果有 Google Identity Services 的 token client，可以調用 revoke
    // 但這不是必需的，因為我們已經清除了本地 token
    console.log('User logged out successfully');
}

/**
 * 取得當前的 access token
 * @returns {string | null} access token 或 null
 */
export function getAccessToken(): string | null {
    if (!isGapiInitialized) return null;

    try {
        const token = gapi.client.getToken();
        return token?.access_token || null;
    } catch (error) {
        console.error('Failed to get access token:', error);
        return null;
    }
}

/**
 * 取得當前用戶的頻道 ID
 * @returns {Promise<string>} 頻道 ID
 */
export async function getChannelId(options: QuotaTriggerOptions = {}): Promise<string> {
    if (!isGapiInitialized) {
        throw new Error('GAPI not initialized');
    }

    try {
        const response = await gapi.client.youtube.channels.list({
            part: 'id',
            mine: true,
        });
        recordQuota('youtube.channels.list', YT_QUOTA_COST.channelsList, {
            part: 'id',
            context: 'getChannelId',
            trigger: options.trigger,
            caller: options.source,
        });

        if (!response.result.items || response.result.items.length === 0) {
            throw new Error('No channel found for this user');
        }

        return response.result.items[0].id;
    } catch (error: any) {
        console.error('Failed to get channel ID:', error);
        throw new Error(`Failed to get channel ID: ${error.message}`);
    }
}
