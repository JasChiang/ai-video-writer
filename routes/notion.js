import { Router } from 'express';
import crypto from 'crypto';
import { publishArticleToNotion, listNotionDatabases, getNotionDatabase } from '../services/server/notionService.js';

export function createNotionRouter({ notionStateStore, pruneExpiredNotionStates }) {
  const router = Router();

  /**
   * 獲取 Notion OAuth URL
   * GET /api/notion/oauth/url
   */
  router.get('/oauth/url', (req, res) => {
    try {
      const clientId = process.env.NOTION_CLIENT_ID;
      const redirectUri = process.env.NOTION_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return res.status(400).json({
          error: 'Notion OAuth 尚未設定，請在環境變數加入 NOTION_CLIENT_ID 及 NOTION_REDIRECT_URI。',
        });
      }

      pruneExpiredNotionStates();

      // 透過 query 明確帶入前端來源，避免瀏覽器省略 Origin header 時無法判別
      let requestOrigin = null;
      if (typeof req.query.origin === 'string' && req.query.origin) {
        requestOrigin = req.query.origin;
      } else if (Array.isArray(req.query.origin) && req.query.origin.length > 0) {
        requestOrigin = req.query.origin[0];
      } else if (req.headers.origin) {
        requestOrigin = req.headers.origin;
      }

      const state = crypto.randomBytes(16).toString('hex');
      notionStateStore.set(state, {
        createdAt: Date.now(),
        origin: requestOrigin,
      });

      const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
      notionAuthUrl.searchParams.set('response_type', 'code');
      notionAuthUrl.searchParams.set('owner', 'user');
      notionAuthUrl.searchParams.set('client_id', clientId);
      notionAuthUrl.searchParams.set('redirect_uri', redirectUri);
      notionAuthUrl.searchParams.set('state', state);
      notionAuthUrl.searchParams.set('scope', 'databases.read,databases.write');

      res.json({ url: notionAuthUrl.toString(), state });
    } catch (error) {
      console.error('[Notion] 產生授權 URL 失敗:', error);
      res.status(500).json({ error: '無法產生 Notion 授權網址' });
    }
  });

  // 舊版回呼路徑相容性：將 /api/notion/callback 重新導向至新的 oauth/callback
  router.get('/callback', (req, res) => {
    const params = new URLSearchParams();
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined) {
            params.append(key, String(item));
          }
        });
      } else if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const redirectPath = `/api/notion/oauth/callback${queryString ? `?${queryString}` : ''}`;
    res.redirect(302, redirectPath);
  });

  /**
   * Notion OAuth callback
   * GET /api/notion/oauth/callback
   */
  router.get('/oauth/callback', async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;

    const sendOAuthResult = (payload, targetOrigin) => {
      const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
      const safeOrigin = targetOrigin || process.env.FRONTEND_URL || 'http://localhost:3000';
      const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Notion 授權</title>
  </head>
  <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
    <div>
      <p>正在關閉視窗...</p>
    </div>
    <script>
      (function () {
        const payload = ${safePayload};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'notion:oauth:result', payload }, '${safeOrigin}');
          window.close();
        } else {
          const pre = document.createElement('pre');
          pre.textContent = JSON.stringify(payload, null, 2);
          document.body.innerHTML = '';
          document.body.appendChild(pre);
        }
      })();
    </script>
  </body>
</html>`;
      res.type('text/html').send(html);
    };

    pruneExpiredNotionStates();

    if (error) {
      console.error('[Notion] OAuth error:', error, errorDescription);
      return sendOAuthResult(
        {
          success: false,
          error,
          message: errorDescription || 'Notion 授權失敗',
        },
        process.env.FRONTEND_URL
      );
    }

    if (!state || !notionStateStore.has(state)) {
      console.error('[Notion] OAuth state 驗證失敗');
      return sendOAuthResult(
        {
          success: false,
          error: 'invalid_state',
          message: '授權逾時或來源無效，請重新嘗試。',
        },
        process.env.FRONTEND_URL
      );
    }

    const stateMeta = notionStateStore.get(state);
    notionStateStore.delete(state);

    if (!code) {
      return sendOAuthResult(
        {
          success: false,
          error: 'missing_code',
          message: '未收到授權碼，請重新嘗試。',
        },
        stateMeta?.origin || process.env.FRONTEND_URL
      );
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[Notion] OAuth 環境變數未設定完整');
      return sendOAuthResult(
        {
          success: false,
          error: 'missing_environment',
          message: '伺服器未設定 Notion OAuth 所需環境變數。',
        },
        stateMeta?.origin || process.env.FRONTEND_URL
      );
    }

    try {
      const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('[Notion] 交換 token 失敗:', tokenData);
        return sendOAuthResult(
          {
            success: false,
            error: 'token_exchange_failed',
            message: tokenData?.message || 'Notion token 交換失敗，請稍後再試。',
          },
          stateMeta?.origin || process.env.FRONTEND_URL
        );
      }

      sendOAuthResult(
        {
          success: true,
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            workspaceId: tokenData.workspace_id || null,
            workspaceName: tokenData.workspace_name || '',
            workspaceIcon: tokenData.workspace_icon || null,
            botId: tokenData.bot_id || null,
            duplicatedTemplateId: tokenData.duplicated_template_id || null,
          },
        },
        stateMeta?.origin || process.env.FRONTEND_URL
      );
    } catch (err) {
      console.error('[Notion] OAuth callback 發生錯誤:', err);
      sendOAuthResult(
        {
          success: false,
          error: 'unexpected_error',
          message: err.message || 'Notion 授權時發生未知錯誤。',
        },
        stateMeta?.origin || process.env.FRONTEND_URL
      );
    }
  });

  /**
   * 發佈文章到 Notion 資料庫
   * POST /api/notion/publish
   */
  router.post('/publish', async (req, res) => {
    try {
      const {
        notionToken,
        databaseId,
        title,
        article,
        seoDescription,
        videoUrl,
        titleProperty,
        screenshotPlan,
        imageUrls,
      } = req.body || {};

      const resolvedToken = notionToken || process.env.NOTION_API_TOKEN;
      const resolvedDatabaseId = databaseId || process.env.NOTION_DATABASE_ID;
      const resolvedTitleProperty =
        titleProperty || process.env.NOTION_TITLE_PROPERTY || 'Name';

      if (!resolvedToken) {
        return res.status(400).json({
          error: '缺少 Notion 金鑰。請在請求中提供 notionToken 或設定 NOTION_API_TOKEN 環境變數。',
        });
      }

      if (!resolvedDatabaseId) {
        return res.status(400).json({
          error: '缺少 Notion 資料庫 ID。請在請求中提供 databaseId 或設定 NOTION_DATABASE_ID 環境變數。',
        });
      }

      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: '缺少 Notion 頁面標題。' });
      }

      if (typeof article !== 'string' || article.trim().length === 0) {
        return res.status(400).json({ error: '缺少文章內容。' });
      }

      console.log('[Notion] 正在發佈文章到資料庫:', resolvedDatabaseId);

      const result = await publishArticleToNotion({
        notionToken: resolvedToken,
        databaseId: resolvedDatabaseId,
        title: title.trim(),
        article,
        seoDescription: typeof seoDescription === 'string' ? seoDescription : undefined,
        videoUrl: typeof videoUrl === 'string' ? videoUrl : undefined,
        titleProperty: resolvedTitleProperty,
        screenshotPlan: Array.isArray(screenshotPlan) ? screenshotPlan : undefined,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
      });

      console.log('[Notion] 發佈成功，頁面 ID:', result.pageId);

      res.json({
        success: true,
        pageId: result.pageId,
        url: result.url,
      });
    } catch (error) {
      console.error('[Notion] 發佈失敗:', error);
      res.status(500).json({
        error: error.message || 'Notion 發佈失敗，請稍後再試。',
      });
    }
  });

  /**
   * Notion OAuth 回調處理 (POST - 舊版相容)
   * POST /api/notion/oauth/callback
   */
  router.post('/oauth/callback', async (req, res) => {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
      });
    }

    const notionClientId = process.env.NOTION_CLIENT_ID;
    const notionClientSecret = process.env.NOTION_CLIENT_SECRET;
    const notionRedirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:3000/notion-callback';

    if (!notionClientId || !notionClientSecret) {
      return res.status(500).json({
        error: 'Notion integration not configured properly',
      });
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${notionClientId}:${notionClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: notionRedirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[Notion OAuth] Token exchange failed:', errorText);
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();

      res.json({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        workspaceId: tokenData.workspace_id || null,
        workspaceName: tokenData.workspace_name || null,
        workspaceIcon: tokenData.workspace_icon || null,
        botId: tokenData.bot_id || null,
        duplicatedTemplateId: tokenData.duplicated_template_id || null,
      });
    } catch (error) {
      console.error('[Notion OAuth] Callback error:', error);
      res.status(500).json({
        error: 'OAuth callback failed',
        details: error.message,
      });
    }
  });

  /**
   * 取得 Notion 資料庫列表
   * POST /api/notion/databases
   */
  router.post('/databases', async (req, res) => {
    try {
      const { notionToken, pageSize, startCursor } = req.body || {};

      if (!notionToken) {
        return res.status(400).json({
          error: '缺少 Notion Access Token',
        });
      }

      const parsedPageSize = pageSize ? parseInt(pageSize, 10) : undefined;

      const result = await listNotionDatabases(notionToken, {
        pageSize: parsedPageSize,
        startCursor: startCursor || undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('[Notion] 取得資料庫列表失敗:', error);
      const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
      res.status(statusCode).json({
        error: error.message || '取得 Notion 資料庫列表失敗',
      });
    }
  });

  /**
   * 取得指定 Notion 資料庫的欄位資訊
   * POST /api/notion/database-info
   */
  router.post('/database-info', async (req, res) => {
    try {
      const { notionToken, databaseId } = req.body || {};

      if (!notionToken || !databaseId) {
        return res.status(400).json({
          error: '缺少 Notion Access Token 或資料庫 ID',
        });
      }

      const databaseInfo = await getNotionDatabase(notionToken, databaseId);

      res.json(databaseInfo);
    } catch (error) {
      console.error('[Notion] 取得資料庫資訊失敗:', error);
      const statusCode = error?.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
      res.status(statusCode).json({
        error: error.message || '取得 Notion 資料庫資訊失敗',
      });
    }
  });

  return router;
}
