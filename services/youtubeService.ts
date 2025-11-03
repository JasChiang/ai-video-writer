// Add type declarations for Google API scripts
declare const gapi: any;
declare const google: any;

import { YOUTUBE_CLIENT_ID, YOUTUBE_SCOPES } from '../config';
import type { YouTubeVideo } from '../types';

let tokenClient: any = null;
let isGapiInitialized = false;
let isGisInitialized = false;
let gapiInitializationPromise: Promise<void> | null = null;
let gisInitializationPromise: Promise<void> | null = null;
const TOKEN_STORAGE_KEY = 'youtubeContentAssistant.oauthToken';
let storedTokenExpiry: number | null = null;

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

export async function listVideos(
    maxResults = 12,
    pageToken?: string,
    showPrivateVideos = false,
    searchQuery?: string,
    showUnlistedVideos = false
): Promise<{ videos: YouTubeVideo[], nextPageToken: string | null }> {
    if (!isGapiInitialized || !isTokenValid()) {
        throw new Error("Authentication required.");
    }
    try {
        // 使用 search.list API 搭配 forMine: true 來取得用戶的所有影片
        // 這個方法可以正確返回 public、unlisted 和 private 影片
        const searchParams: any = {
            part: 'snippet',
            forMine: true,
            type: 'video',
            maxResults: maxResults,
            order: 'date', // 按日期排序，最新的在前面
        };

        // 如果有搜尋關鍵字，加入 q 參數
        if (searchQuery && searchQuery.trim()) {
            searchParams.q = searchQuery.trim();
        }

        if (pageToken) {
            searchParams.pageToken = pageToken;
        }

        const searchResponse = await gapi.client.youtube.search.list(searchParams);

        if (!searchResponse.result.items || searchResponse.result.items.length === 0) {
            return { videos: [], nextPageToken: null };
        }

        const nextPageToken = searchResponse.result.nextPageToken || null;

        // 取得影片的完整詳細資訊（包含 tags、status、statistics、contentDetails）
        const videoIds = searchResponse.result.items.map((item: any) => item.id.videoId).join(',');

        const videosResponse = await gapi.client.youtube.videos.list({
            part: 'snippet,status,statistics,contentDetails',
            id: videoIds,
        });

        if (!videosResponse.result.items) return { videos: [], nextPageToken: null };

        // 根據使用者偏好過濾影片
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
            .map((item: any) => ({
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

        return { videos, nextPageToken };
    } catch (error: any) {
        console.error("Error listing videos:", error);
        const status = error?.status || error?.result?.error?.code;
        if (status === 401) {
            persistToken(null);
        }
        throw new Error(error.result?.error?.message || "Failed to fetch videos from YouTube.");
    }
}

export function resetPagination(): void {
    // 重置分頁狀態（如果需要的話）
    // 目前 pageToken 由 App.tsx 管理，這裡保留函數以保持 API 一致性
}


export async function updateVideo(video: Partial<YouTubeVideo> & { id: string; categoryId: string }): Promise<any> {
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
export async function getChannelId(): Promise<string> {
    if (!isGapiInitialized) {
        throw new Error('GAPI not initialized');
    }

    try {
        const response = await gapi.client.youtube.channels.list({
            part: 'id',
            mine: true,
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
