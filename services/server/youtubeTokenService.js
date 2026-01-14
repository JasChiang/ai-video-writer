/**
 * YouTube OAuth Token 管理服務
 * 處理 refresh token 自動刷新
 */

/**
 * 使用 refresh token 取得新的 access token
 * @param {string} refreshToken - YouTube OAuth refresh token
 * @param {string} clientId - YouTube OAuth Client ID
 * @param {string} clientSecret - YouTube OAuth Client Secret
 * @returns {Promise<Object>} { access_token, expires_in }
 */
export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  console.log('[TokenService] 正在刷新 access token...');

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token 刷新失敗: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json();

    console.log('[TokenService] ✅ Access token 刷新成功');
    console.log(`[TokenService] 新 token 有效期限: ${data.expires_in} 秒`);

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    };
  } catch (error) {
    console.error('[TokenService] ❌ Token 刷新失敗:', error.message);
    throw error;
  }
}

/**
 * 檢查 access token 是否過期或即將過期
 * @param {number} expiresAt - Token 過期時間戳（毫秒）
 * @param {number} bufferSeconds - 提前刷新的緩衝時間（秒），預設 5 分鐘
 * @returns {boolean} 是否需要刷新
 */
export function needsTokenRefresh(expiresAt, bufferSeconds = 300) {
  if (!expiresAt) return true;

  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;

  return now >= (expiresAt - bufferMs);
}

/**
 * 從環境變數或 token 字串中提取 refresh token
 * @param {string} tokenInput - 可能是 access token 或完整的 token 物件 JSON
 * @returns {Object} { accessToken, refreshToken, expiresAt }
 */
export function parseTokenInput(tokenInput) {
  try {
    // 嘗試解析為 JSON（localStorage 儲存的完整 token）
    const parsed = JSON.parse(tokenInput);

    if (parsed.token) {
      // localStorage 格式：{ token: { access_token, refresh_token, ... }, expiresAt }
      return {
        accessToken: parsed.token.access_token,
        refreshToken: parsed.token.refresh_token,
        expiresAt: parsed.expiresAt,
      };
    } else if (parsed.access_token) {
      // 直接的 token 物件
      return {
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
        expiresAt: null, // 無過期資訊
      };
    }
  } catch (e) {
    // 不是 JSON，當作純 access token
  }

  // 純 access token 字串
  return {
    accessToken: tokenInput,
    refreshToken: null,
    expiresAt: null,
  };
}
