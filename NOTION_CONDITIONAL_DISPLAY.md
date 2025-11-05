# Notion 功能條件顯示實作

## 一、需求說明

只有**已連接 Notion 帳號**的用戶才能看到：
- 「儲存到 Notion」按鈕
- Notion 相關設定和功能

## 二、實作架構

### 2.1 認證狀態管理

使用 React Context 管理 Notion 連接狀態：

```typescript
// contexts/NotionContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as notionService from '../services/notionService';

interface NotionContextType {
  isConnected: boolean;
  isChecking: boolean;
  databases: any[];
  checkConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const NotionContext = createContext<NotionContextType | undefined>(undefined);

export function NotionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [databases, setDatabases] = useState<any[]>([]);

  // 檢查連接狀態
  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const dbs = await notionService.getNotionDatabases();
      setDatabases(dbs);
      setIsConnected(true);
    } catch (error) {
      console.log('Notion not connected');
      setIsConnected(false);
      setDatabases([]);
    } finally {
      setIsChecking(false);
    }
  };

  // 斷開連接
  const disconnect = async () => {
    await notionService.disconnectNotion();
    setIsConnected(false);
    setDatabases([]);
  };

  // 初始化時檢查
  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <NotionContext.Provider value={{
      isConnected,
      isChecking,
      databases,
      checkConnection,
      disconnect
    }}>
      {children}
    </NotionContext.Provider>
  );
}

export function useNotion() {
  const context = useContext(NotionContext);
  if (!context) {
    throw new Error('useNotion must be used within NotionProvider');
  }
  return context;
}
```

### 2.2 在 App 中使用 Provider

```tsx
// App.tsx
import { NotionProvider } from './contexts/NotionContext';

function App() {
  return (
    <NotionProvider>
      {/* 其他組件 */}
    </NotionProvider>
  );
}
```

## 三、條件顯示實作

### 3.1 ArticleGenerator 中條件顯示

```tsx
// components/ArticleGenerator.tsx
import { useNotion } from '../contexts/NotionContext';
import { NotionSaveButton } from './NotionSaveButton';

export function ArticleGenerator({ video, onClose }: ArticleGeneratorProps) {
  const { isConnected, isChecking } = useNotion();
  const [result, setResult] = useState<ArticleGenerationResult | null>(null);

  // ... 其他邏輯

  return (
    <div className="rounded-2xl p-6 bg-white border border-neutral-200 shadow-sm">
      {/* 文章生成表單 */}
      {!result && (
        <div className="space-y-4">
          {/* ... 現有的生成表單 */}
        </div>
      )}

      {/* 生成結果 */}
      {result && (
        <div className="space-y-6">
          {/* 標題選項 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-neutral-900">
              建議標題（三種風格）
            </h3>
            {/* ... 標題內容 */}
          </div>

          {/* SEO 描述 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-neutral-900">
              SEO 描述
            </h3>
            {/* ... SEO 內容 */}
          </div>

          {/* 文章內容 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 text-neutral-900">
              文章內容（Markdown）
            </h3>
            {/* ... 文章內容 */}
          </div>

          {/* ✨ 條件顯示：Notion 儲存功能 */}
          {isConnected && (
            <div className="border-t border-neutral-200 pt-6">
              <h3 className="text-lg font-semibold mb-3 text-neutral-900">
                📌 儲存到 Notion
              </h3>
              <NotionSaveButton
                articleData={result}
                videoTitle={video.title}
                videoId={video.id}
                selectedTitle="titleA"
              />
            </div>
          )}

          {/* ❌ 未連接提示 */}
          {!isConnected && !isChecking && (
            <div className="border-t border-neutral-200 pt-6">
              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900 mb-1">
                      連接 Notion 以儲存文章
                    </p>
                    <p className="text-sm text-neutral-600 mb-3">
                      將生成的文章一鍵儲存到你的 Notion 資料庫，方便管理和發布。
                    </p>
                    <a
                      href="/settings?tab=integrations"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-all"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                      </svg>
                      前往連接 Notion
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 截圖相關功能 */}
          {result.screenshots && result.screenshots.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-neutral-900">
                關鍵畫面截圖
              </h3>
              {/* ... 截圖內容 */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 3.2 設定頁面中的 Notion 整合

```tsx
// pages/Settings.tsx (或在 Header 中)
import { useNotion } from '../contexts/NotionContext';
import { NotionConnect } from '../components/NotionConnect';

export function Settings() {
  const { isConnected, isChecking } = useNotion();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">設定</h1>
        <p className="text-neutral-600">管理你的帳號和整合設定</p>
      </div>

      {/* YouTube 設定 */}
      <section>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          YouTube 帳號
        </h2>
        {/* ... YouTube 相關設定 */}
      </section>

      {/* Notion 整合 */}
      <section>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">
          Notion 整合
        </h2>
        <NotionConnect onConnectionChange={(connected) => {
          console.log('Notion connection changed:', connected);
        }} />

        {/* 顯示已連接的資料庫 */}
        {isConnected && (
          <div className="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <h3 className="font-semibold text-neutral-900 mb-2">
              功能說明
            </h3>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>自動將生成的文章儲存到 Notion 資料庫</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>包含標題、SEO 描述、文章內容和截圖</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>自動轉換 Markdown 格式為 Notion blocks</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>連結 YouTube 影片方便追蹤來源</span>
              </li>
            </ul>
          </div>
        )}
      </section>

      {/* 其他設定 */}
    </div>
  );
}
```

### 3.3 在導航/Header 中顯示連接狀態

```tsx
// components/Header.tsx
import { useNotion } from '../contexts/NotionContext';

export function Header() {
  const { isConnected } = useNotion();

  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">YouTube Content Assistant</h1>

          {/* Notion 連接狀態指示器 */}
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium text-green-700">
                Notion 已連接
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 其他按鈕 */}
          <a
            href="/settings"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            設定
          </a>
        </div>
      </div>
    </header>
  );
}
```

## 四、後端認證檢查

### 4.1 檢查連接狀態的 API

```javascript
// routes/notionRoutes.js

// 檢查 Notion 連接狀態
router.get('/status', async (req, res) => {
  try {
    const accessToken = req.cookies.notion_token;

    if (!accessToken) {
      return res.json({
        connected: false,
        message: 'Not connected to Notion'
      });
    }

    // 驗證 token 是否有效（嘗試獲取用戶資訊）
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (response.ok) {
      const user = await response.json();
      return res.json({
        connected: true,
        user: {
          name: user.name,
          avatar: user.avatar_url
        }
      });
    } else {
      // Token 無效
      res.clearCookie('notion_token');
      return res.json({
        connected: false,
        message: 'Token expired or invalid'
      });
    }
  } catch (error) {
    console.error('Check Notion status error:', error);
    res.json({
      connected: false,
      message: 'Error checking status'
    });
  }
});
```

### 4.2 前端檢查狀態

```typescript
// services/notionService.ts

export async function checkNotionStatus() {
  try {
    const response = await fetch('/api/notion/status');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to check Notion status:', error);
    return { connected: false };
  }
}
```

## 五、UI 設計範例

### 5.1 未連接狀態的引導卡片

```tsx
// components/NotionPrompt.tsx
export function NotionPrompt() {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200">
      <div className="flex items-start gap-4">
        {/* Notion Icon */}
        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8.5 6.5c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 6c0-.276.224-.5.5-.5h12a.5.5 0 010 1H9a.5.5 0 01-.5-.5z"/>
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold text-neutral-900 mb-2">
            連接 Notion 以解鎖更多功能
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            將生成的文章自動儲存到 Notion，方便後續編輯和發布。
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-neutral-700">一鍵儲存</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-neutral-700">自動格式化</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-neutral-700">包含截圖</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-neutral-700">永久免費</span>
            </div>
          </div>

          <a
            href="/settings?tab=integrations"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-neutral-900 hover:bg-neutral-800 transition-all shadow-sm hover:shadow-md"
          >
            立即連接 Notion
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 已連接狀態的快速操作

```tsx
// 在文章生成完成後，提供快速儲存按鈕
{result && isConnected && (
  <div className="fixed bottom-6 right-6 z-50">
    <button
      onClick={() => setShowNotionSave(true)}
      className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-white bg-neutral-900 hover:bg-neutral-800 shadow-lg hover:shadow-xl transition-all"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      </svg>
      儲存到 Notion
    </button>
  </div>
)}
```

## 六、總結

### ✅ 實作要點

1. **使用 Context 管理狀態**
   - 全局 Notion 連接狀態
   - 避免重複檢查

2. **條件渲染**
   - `isConnected` 控制顯示
   - 未連接時顯示引導

3. **友善的 UX**
   - 明確的狀態提示
   - 引導用戶連接
   - 快速操作入口

4. **安全性**
   - 後端驗證 token
   - 前端檢查狀態
   - 錯誤處理

### 🎯 用戶流程

```
用戶首次使用
    ↓
看到「連接 Notion」提示
    ↓
點擊前往設定
    ↓
完成 OAuth 授權
    ↓
返回應用，自動顯示「儲存到 Notion」功能
    ↓
生成文章後，一鍵儲存
```
