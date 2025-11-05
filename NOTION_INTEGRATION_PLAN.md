# Notion 整合功能實作計劃

## 功能概述

讓用戶可以將生成的文章一鍵歸檔到 Notion 資料庫，支援：
- Notion OAuth 認證
- 選擇目標資料庫
- 自動轉換 Markdown 為 Notion blocks
- 包含標題、SEO 描述、截圖等完整資訊

## 一、架構設計

### 1.1 認證流程

```
用戶 → 點擊「連接 Notion」
     → 後端生成 OAuth URL
     → 跳轉 Notion 授權頁面
     → Notion 回調後端
     → 後端取得 access token
     → 儲存到資料庫（與 YouTube 帳號關聯）
     → 返回前端顯示「已連接」
```

### 1.2 資料流

```
文章生成完成
     ↓
用戶點擊「存到 Notion」
     ↓
選擇 Notion 資料庫
     ↓
轉換內容為 Notion blocks
     ↓
調用 Notion API 創建頁面
     ↓
顯示成功並提供連結
```

## 二、技術實作

### 2.1 Notion API 註冊

1. 前往 [Notion Developers](https://www.notion.so/my-integrations)
2. 創建新的 Integration
3. 取得以下資訊：
   - `NOTION_CLIENT_ID`
   - `NOTION_CLIENT_SECRET`
   - `NOTION_REDIRECT_URI` (例如: `https://your-app.com/api/notion/callback`)

### 2.2 環境變數設定

```bash
# .env
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
NOTION_REDIRECT_URI=https://your-app.com/api/notion/callback
```

### 2.3 後端實作

#### 檔案結構
```
services/
  ├── notionService.js          # Notion API 封裝
  └── notionBlockConverter.js   # Markdown to Notion blocks

routes/
  └── notionRoutes.js            # API 路由
```

#### A. Notion Service (`services/notionService.js`)

```javascript
import { Client } from '@notionhq/client';

class NotionService {
  constructor(accessToken) {
    this.client = new Client({ auth: accessToken });
  }

  // 取得用戶的所有資料庫
  async getDatabases() {
    const response = await this.client.search({
      filter: { property: 'object', value: 'database' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    });

    return response.results.map(db => ({
      id: db.id,
      title: db.title[0]?.plain_text || 'Untitled',
      icon: db.icon,
      url: db.url
    }));
  }

  // 創建文章頁面
  async createArticlePage(databaseId, articleData) {
    const { selectedTitle, article, seoDescription, videoId, videoTitle, imageUrls } = articleData;

    // 轉換 Markdown 為 Notion blocks
    const blocks = await this.convertMarkdownToBlocks(article, imageUrls);

    const response = await this.client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        // 標題（必須欄位）
        'Name': {
          title: [{ text: { content: selectedTitle } }]
        },
        // SEO 描述
        'SEO 描述': {
          rich_text: [{ text: { content: seoDescription } }]
        },
        // YouTube 影片 ID
        'YouTube ID': {
          rich_text: [{ text: { content: videoId } }]
        },
        // YouTube 連結
        'YouTube 連結': {
          url: `https://www.youtube.com/watch?v=${videoId}`
        },
        // 標籤
        'Tags': {
          multi_select: [
            { name: 'AI Generated' },
            { name: 'YouTube' }
          ]
        },
        // 狀態
        'Status': {
          select: { name: '草稿' }
        }
      },
      children: blocks
    });

    return {
      pageId: response.id,
      url: response.url
    };
  }

  // Markdown 轉 Notion blocks
  async convertMarkdownToBlocks(markdown, imageUrls = []) {
    const blocks = [];
    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // 標題
      if (line.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: line.substring(2) } }]
          }
        });
      }
      else if (line.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: line.substring(3) } }]
          }
        });
      }
      else if (line.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: line.substring(4) } }]
          }
        });
      }
      // 列表
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: line.substring(2) } }]
          }
        });
      }
      // 數字列表
      else if (/^\d+\.\s/.test(line)) {
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ text: { content: line.replace(/^\d+\.\s/, '') } }]
          }
        });
      }
      // 程式碼區塊
      else if (line.startsWith('```')) {
        const codeLines = [];
        i++; // 跳過開始標記
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ text: { content: codeLines.join('\n') } }],
            language: 'plain text'
          }
        });
      }
      // 引用
      else if (line.startsWith('> ')) {
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [{ text: { content: line.substring(2) } }]
          }
        });
      }
      // 分隔線
      else if (line === '---' || line === '***') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
      }
      // 一般段落
      else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: line } }]
          }
        });
      }
    }

    // 添加截圖（如果有）
    if (imageUrls && imageUrls.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: '📸 文章截圖' } }]
        }
      });

      for (const imageGroup of imageUrls) {
        for (const imageUrl of imageGroup) {
          blocks.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: { url: imageUrl }
            }
          });
        }
      }
    }

    return blocks;
  }
}

export default NotionService;
```

#### B. API 路由 (`routes/notionRoutes.js`)

```javascript
import express from 'express';
import fetch from 'node-fetch';
import NotionService from '../services/notionService.js';

const router = express.Router();

// OAuth 認證 URL
router.get('/auth-url', (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.json({ authUrl });
});

// OAuth 回調
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/settings?notion_error=${error}`);
  }

  try {
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

    if (data.access_token) {
      // TODO: 儲存 access_token 到資料庫
      // 與當前登入的 YouTube 用戶關聯

      // 暫時存在 session 或 cookie
      res.cookie('notion_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 90 * 24 * 60 * 60 * 1000 // 90 天
      });

      res.redirect('/settings?notion_connected=true');
    } else {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    console.error('Notion OAuth error:', error);
    res.redirect('/settings?notion_error=auth_failed');
  }
});

// 取得用戶的 Notion 資料庫列表
router.get('/databases', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token; // 或從資料庫取得

    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Notion' });
    }

    const notionService = new NotionService(accessToken);
    const databases = await notionService.getDatabases();

    res.json({ databases });
  } catch (error) {
    console.error('Get databases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 儲存文章到 Notion
router.post('/save-article', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Notion' });
    }

    const { databaseId, articleData } = req.body;

    const notionService = new NotionService(accessToken);
    const result = await notionService.createArticlePage(databaseId, articleData);

    res.json({
      success: true,
      pageId: result.pageId,
      url: result.url
    });
  } catch (error) {
    console.error('Save article error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 斷開 Notion 連接
router.post('/disconnect', (req, res) => {
  // TODO: 從資料庫刪除 token
  res.clearCookie('notion_token');
  res.json({ success: true });
});

export default router;
```

#### C. 整合到 server.js

```javascript
import notionRoutes from './routes/notionRoutes.js';

// ... 其他 imports

app.use('/api/notion', notionRoutes);
```

### 2.4 前端實作

#### A. Notion Service (`services/notionService.ts`)

```typescript
interface NotionDatabase {
  id: string;
  title: string;
  icon?: any;
  url: string;
}

interface SaveArticlePayload {
  databaseId: string;
  articleData: {
    selectedTitle: string;
    article: string;
    seoDescription: string;
    videoId: string;
    videoTitle: string;
    imageUrls: string[][];
  };
}

export async function getNotionAuthUrl(): Promise<string> {
  const response = await fetch('/api/notion/auth-url');
  const data = await response.json();
  return data.authUrl;
}

export async function getNotionDatabases(): Promise<NotionDatabase[]> {
  const response = await fetch('/api/notion/databases');
  const data = await response.json();
  return data.databases;
}

export async function saveArticleToNotion(payload: SaveArticlePayload) {
  const response = await fetch('/api/notion/save-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save to Notion');
  }

  return response.json();
}

export async function disconnectNotion() {
  const response = await fetch('/api/notion/disconnect', { method: 'POST' });
  return response.json();
}
```

#### B. Notion 連接按鈕組件 (`components/NotionConnect.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import * as notionService from '../services/notionService';

interface NotionConnectProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function NotionConnect({ onConnectionChange }: NotionConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 檢查連接狀態（可以通過 API 確認）
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await notionService.getNotionDatabases();
      setIsConnected(true);
      onConnectionChange?.(true);
    } catch {
      setIsConnected(false);
      onConnectionChange?.(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const authUrl = await notionService.getNotionAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      alert('連接失敗，請稍後再試');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('確定要斷開 Notion 連接嗎？')) return;

    setIsLoading(true);
    try {
      await notionService.disconnectNotion();
      setIsConnected(false);
      onConnectionChange?.(false);
      alert('已斷開 Notion 連接');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('斷開連接失敗');
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <div className="flex-1">
          <p className="font-semibold text-green-900">已連接 Notion</p>
          <p className="text-sm text-green-700">可以將文章儲存到 Notion 資料庫</p>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 bg-white border border-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {isLoading ? '處理中...' : '斷開連接'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
      <svg className="w-6 h-6 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8.5 6.5c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zM6.002 11.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-neutral-900">連接 Notion</p>
        <p className="text-sm text-neutral-600">將文章自動歸檔到 Notion 資料庫</p>
      </div>
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50"
      >
        {isLoading ? '連接中...' : '連接 Notion'}
      </button>
    </div>
  );
}
```

#### C. 整合到 ArticleGenerator (`components/NotionSaveButton.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import * as notionService from '../services/notionService';
import type { ArticleGenerationResult } from '../types';

interface NotionSaveButtonProps {
  articleData: ArticleGenerationResult;
  videoTitle: string;
  videoId: string;
  selectedTitle: 'titleA' | 'titleB' | 'titleC';
}

export function NotionSaveButton({ articleData, videoTitle, videoId, selectedTitle }: NotionSaveButtonProps) {
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    setIsLoading(true);
    try {
      const dbs = await notionService.getNotionDatabases();
      setDatabases(dbs);
      if (dbs.length > 0) {
        setSelectedDatabase(dbs[0].id);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDatabase) {
      alert('請選擇一個 Notion 資料庫');
      return;
    }

    setIsSaving(true);
    try {
      const result = await notionService.saveArticleToNotion({
        databaseId: selectedDatabase,
        articleData: {
          selectedTitle: articleData[selectedTitle],
          article: articleData.article,
          seoDescription: articleData.seo_description,
          videoId,
          videoTitle,
          imageUrls: articleData.image_urls
        }
      });

      setSavedUrl(result.url);
      setShowDatabasePicker(false);
      alert('✅ 文章已成功儲存到 Notion！');
    } catch (error: any) {
      console.error('Failed to save to Notion:', error);
      alert(`儲存失敗：${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (savedUrl) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="flex-1 text-green-900 font-medium">已儲存到 Notion</span>
        <a
          href={savedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700"
        >
          開啟頁面
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowDatabasePicker(!showDatabasePicker)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-neutral-900 bg-white border-2 border-neutral-300 hover:border-neutral-400 transition-all"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8.5 6.5c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zM6.002 11.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
        </svg>
        儲存到 Notion
      </button>

      {showDatabasePicker && (
        <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-2 text-neutral-900">
              選擇 Notion 資料庫
            </label>
            {isLoading ? (
              <p className="text-sm text-neutral-600">載入中...</p>
            ) : databases.length === 0 ? (
              <p className="text-sm text-neutral-600">找不到可用的資料庫</p>
            ) : (
              <select
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedDatabase}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '儲存中...' : '確認儲存'}
            </button>
            <button
              onClick={() => setShowDatabasePicker(false)}
              className="px-4 py-2 rounded-lg font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### D. 整合到 ArticleGenerator.tsx

在 `ArticleGenerator.tsx` 的結果顯示區塊添加：

```tsx
import { NotionSaveButton } from './NotionSaveButton';

// ... 在結果顯示區域

{result && (
  <div className="space-y-6">
    {/* 現有的標題、描述、文章內容 */}

    {/* 新增：Notion 儲存按鈕 */}
    <div>
      <h3 className="text-lg font-semibold mb-2 text-neutral-900">
        📌 儲存到 Notion
      </h3>
      <NotionSaveButton
        articleData={result}
        videoTitle={video.title}
        videoId={video.id}
        selectedTitle="titleA" // 或讓用戶選擇
      />
    </div>
  </div>
)}
```

## 三、安裝依賴

```bash
# 後端
npm install @notionhq/client

# 如果使用 TypeScript
npm install --save-dev @types/node
```

## 四、Notion 資料庫範本

建議的 Notion 資料庫屬性：

| 屬性名稱 | 類型 | 說明 |
|---------|------|------|
| Name | Title | 文章標題 |
| SEO 描述 | Text | SEO 描述 |
| YouTube ID | Text | 影片 ID |
| YouTube 連結 | URL | 影片連結 |
| Tags | Multi-select | 標籤 |
| Status | Select | 狀態（草稿/已發布） |
| Created | Date | 創建日期（自動） |

用戶可以在 Notion 創建這個範本資料庫，或使用任何現有資料庫。

## 五、測試流程

1. **連接測試**
   - 點擊「連接 Notion」
   - 完成 OAuth 授權
   - 確認顯示「已連接」狀態

2. **資料庫選擇測試**
   - 生成文章後
   - 點擊「儲存到 Notion」
   - 確認可以看到資料庫列表

3. **儲存測試**
   - 選擇目標資料庫
   - 點擊「確認儲存」
   - 確認文章成功創建
   - 檢查 Notion 頁面內容格式正確

4. **內容檢查**
   - 標題正確
   - SEO 描述正確
   - Markdown 轉換正確（標題、列表、段落）
   - 截圖顯示正常

## 六、進階功能（選配）

### 6.1 自動標籤

根據文章內容自動添加標籤：

```javascript
function extractTags(article) {
  const keywords = ['教學', '開箱', '評測', '技術'];
  const tags = [];

  for (const keyword of keywords) {
    if (article.includes(keyword)) {
      tags.push({ name: keyword });
    }
  }

  return tags;
}
```

### 6.2 批量儲存

允許一次儲存多篇文章到 Notion。

### 6.3 同步狀態

在 Notion 更新文章狀態時，同步回應用。

## 七、安全考量

1. **Token 儲存**
   - 使用加密儲存 access token
   - 與 YouTube 用戶帳號綁定
   - 定期檢查 token 有效性

2. **權限控制**
   - 只允許寫入用戶授權的資料庫
   - 不儲存敏感資料

3. **錯誤處理**
   - Token 過期時提示重新授權
   - 網路錯誤重試機制
   - 詳細錯誤訊息

## 八、總結

這個整合方案提供：

✅ 完整的 Notion OAuth 認證流程
✅ 資料庫選擇功能
✅ Markdown 到 Notion blocks 的轉換
✅ 包含截圖的完整內容儲存
✅ 友善的 UI 介面
✅ 錯誤處理和狀態提示

用戶可以：
1. 一鍵連接 Notion 帳號
2. 選擇目標資料庫
3. 自動儲存生成的文章
4. 直接在 Notion 中查看和編輯

---

**實作優先順序**：
1. 後端 Notion Service（核心功能）
2. OAuth 認證流程
3. 前端 UI 組件
4. Markdown 轉換優化
5. 進階功能
