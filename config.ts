// IMPORTANT: Replace these with your actual client ID.
// YOUTUBE_CLIENT_ID is used for OAuth 2.0 authentication, which is safe to expose in the frontend.
// API Keys should NOT be exposed in the frontend - they are used in the backend only.

// 宣告全域介面以支援 TypeScript
declare global {
    interface Window {
        __APP_CONFIG__?: {
            YOUTUBE_CLIENT_ID: string | null;
            YOUTUBE_SCOPES: string;
            GITHUB_GIST_ID: string | null;
        };
    }
}

const runtimeConfig =
    typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;

const envConfig =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
        ? {
              YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? null,
              YOUTUBE_SCOPES: process.env.YOUTUBE_SCOPES ?? null,
              GITHUB_GIST_ID: process.env.GITHUB_GIST_ID ?? null,
          }
        : { YOUTUBE_CLIENT_ID: null, YOUTUBE_SCOPES: null, GITHUB_GIST_ID: null };

// 從執行期注入的 config 優先，若不存在則回退至 build-time 注入的環境變數
export const YOUTUBE_CLIENT_ID =
    runtimeConfig?.YOUTUBE_CLIENT_ID ??
    envConfig.YOUTUBE_CLIENT_ID ??
    null;

// The scopes required to access and modify the user's YouTube videos and analytics.
export const YOUTUBE_SCOPES =
    runtimeConfig?.YOUTUBE_SCOPES ??
    envConfig.YOUTUBE_SCOPES ??
    'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly';

// GitHub Gist ID for video cache
export const GITHUB_GIST_ID =
    runtimeConfig?.GITHUB_GIST_ID ??
    envConfig.GITHUB_GIST_ID ??
    null;

if (!YOUTUBE_CLIENT_ID) {
    console.warn(
        'YouTube Client ID is not set. Please configure it in your environment variables.'
    );
}

if (!GITHUB_GIST_ID) {
    console.warn(
        'GitHub Gist ID is not set. Video cache search will not be available. Please configure GITHUB_GIST_ID in your environment variables.'
    );
}
