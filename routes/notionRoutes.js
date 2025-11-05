import express from 'express';
import fetch from 'node-fetch';
import NotionService from '../services/notionService.js';

const router = express.Router();

/**
 * 取得 Notion OAuth 授權 URL
 * GET /api/notion/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: 'Notion integration not configured'
      });
    }

    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('[Notion] Auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * OAuth 回調處理
 * GET /api/notion/callback
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[Notion] OAuth error:', error);
    return res.redirect(`/?notion_error=${error}`);
  }

  if (!code) {
    return res.redirect('/?notion_error=missing_code');
  }

  try {
    console.log('[Notion] Exchanging code for token...');

    // 交換 access token
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Notion] Token exchange failed:', data);
      return res.redirect('/?notion_error=auth_failed');
    }

    if (data.access_token) {
      console.log('[Notion] Token obtained successfully');

      // TODO: 在實際應用中，應該將 token 儲存到資料庫
      // 並與當前登入的 YouTube 用戶關聯

      // 暫時儲存在 cookie（僅供開發測試）
      res.cookie('notion_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000 // 90 天
      });

      // 也可以儲存 workspace 資訊
      if (data.workspace_name) {
        res.cookie('notion_workspace', data.workspace_name, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60 * 1000
        });
      }

      res.redirect('/?notion_connected=true');
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    console.error('[Notion] Callback error:', error);
    res.redirect('/?notion_error=callback_failed');
  }
});

/**
 * 檢查 Notion 連接狀態
 * GET /api/notion/status
 */
router.get('/status', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token;

    if (!accessToken) {
      return res.json({
        connected: false,
        message: 'Not connected to Notion'
      });
    }

    // 驗證 token 是否有效
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (response.ok) {
      const user = await response.json();
      const workspaceName = req.cookies.notion_workspace;

      return res.json({
        connected: true,
        user: {
          name: user.name,
          avatar: user.avatar_url,
          workspace: workspaceName
        }
      });
    } else {
      // Token 無效或過期
      res.clearCookie('notion_token');
      res.clearCookie('notion_workspace');

      return res.json({
        connected: false,
        message: 'Token expired or invalid'
      });
    }
  } catch (error) {
    console.error('[Notion] Status check error:', error);
    res.json({
      connected: false,
      message: 'Error checking status'
    });
  }
});

/**
 * 取得用戶的 Notion 資料庫列表
 * GET /api/notion/databases
 */
router.get('/databases', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token;

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated with Notion'
      });
    }

    const notionService = new NotionService(accessToken);
    const databases = await notionService.getDatabases();

    res.json({ databases });
  } catch (error) {
    console.error('[Notion] Get databases error:', error);

    if (error.code === 'unauthorized') {
      res.clearCookie('notion_token');
      return res.status(401).json({
        error: 'Notion authorization expired',
        needsReauth: true
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to get databases'
    });
  }
});

/**
 * 儲存文章到 Notion
 * POST /api/notion/save-article
 * Body: { databaseId, articleData }
 */
router.post('/save-article', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token;

    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated with Notion'
      });
    }

    const { databaseId, articleData } = req.body;

    // 驗證必要欄位
    if (!databaseId) {
      return res.status(400).json({ error: 'Database ID is required' });
    }

    if (!articleData || !articleData.selectedTitle || !articleData.article) {
      return res.status(400).json({ error: 'Article data is incomplete' });
    }

    console.log('[Notion] Saving article to database:', databaseId);

    const notionService = new NotionService(accessToken);
    const result = await notionService.createArticlePage(databaseId, articleData);

    console.log('[Notion] Article saved successfully:', result.pageId);

    res.json({
      success: true,
      pageId: result.pageId,
      url: result.url
    });
  } catch (error) {
    console.error('[Notion] Save article error:', error);

    // 處理特定錯誤
    if (error.code === 'unauthorized') {
      res.clearCookie('notion_token');
      return res.status(401).json({
        error: 'Notion authorization expired',
        needsReauth: true
      });
    }

    if (error.code === 'rate_limited') {
      return res.status(429).json({
        error: '請求過於頻繁，請稍後再試',
        retryAfter: error.headers?.['retry-after'] || 3
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to save article'
    });
  }
});

/**
 * 斷開 Notion 連接
 * POST /api/notion/disconnect
 */
router.post('/disconnect', (req, res) => {
  try {
    // 清除 cookies
    res.clearCookie('notion_token');
    res.clearCookie('notion_workspace');

    // TODO: 在實際應用中，應該從資料庫刪除 token

    console.log('[Notion] User disconnected');

    res.json({
      success: true,
      message: 'Disconnected from Notion'
    });
  } catch (error) {
    console.error('[Notion] Disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect'
    });
  }
});

export default router;
