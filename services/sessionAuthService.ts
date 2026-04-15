/**
 * 管理後端 session JWT（與 Google OAuth token 分開）
 * - Google access token：用來呼叫 YouTube API（gapi）
 * - Session JWT：用來驗證後端 /api/* 請求
 */

const SESSION_JWT_KEY = 'youtubeContentAssistant.sessionJwt';

/** 用 Google access token 向後端換取 session JWT */
export async function loginWithGoogleToken(accessToken: string): Promise<boolean> {
  try {
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const baseUrl = isDev ? 'http://localhost:3001' : '';
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[SessionAuth] login failed:', body.error);
      return false;
    }
    const { sessionToken } = await res.json();
    localStorage.setItem(SESSION_JWT_KEY, sessionToken);
    return true;
  } catch (err) {
    console.error('[SessionAuth] login error:', err);
    return false;
  }
}

/** 取得目前的 session JWT，沒有則回傳 null */
export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_JWT_KEY);
}

/** 清除 session JWT（登出時使用） */
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_JWT_KEY);
}
