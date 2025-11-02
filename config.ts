// IMPORTANT: Replace these with your actual client ID.
// YOUTUBE_CLIENT_ID is used for OAuth 2.0 authentication, which is safe to expose in the frontend.
// API Keys should NOT be exposed in the frontend - they are used in the backend only.
export const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;

// The scope required to access and modify the user's YouTube videos.
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube';

if (!YOUTUBE_CLIENT_ID) {
    console.warn(
        'YouTube Client ID is not set. Please configure it in your environment variables.'
    );
}
