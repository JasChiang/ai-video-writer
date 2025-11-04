// IMPORTANT: Replace these with your actual client ID.
// YOUTUBE_CLIENT_ID is used for OAuth 2.0 authentication, which is safe to expose in the frontend.
// API Keys should NOT be exposed in the frontend - they are used in the backend only.

// 宣告全域介面以支援 TypeScript
declare global {
    interface Window {
        __APP_CONFIG__?: {
            YOUTUBE_CLIENT_ID: string | null;
            YOUTUBE_SCOPES: string;
        };
    }
}

// 從後端動態注入的配置讀取（/app-config.js）
export const YOUTUBE_CLIENT_ID = typeof window !== 'undefined'
    ? window.__APP_CONFIG__?.YOUTUBE_CLIENT_ID || null
    : null;

// The scopes required to access and modify the user's YouTube videos and analytics.
export const YOUTUBE_SCOPES = typeof window !== 'undefined'
    ? window.__APP_CONFIG__?.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly'
    : 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly';

if (!YOUTUBE_CLIENT_ID) {
    console.warn(
        'YouTube Client ID is not set. Please configure it in your environment variables.'
    );
}
