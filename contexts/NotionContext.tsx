import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NotionUser {
  name: string;
  avatar: string;
  workspace: string;
}

interface NotionDatabase {
  id: string;
  title: string;
  icon: any;
  url: string;
  lastEditedTime: string;
}

interface NotionContextType {
  isConnected: boolean;
  user: NotionUser | null;
  databases: NotionDatabase[];
  isLoading: boolean;
  checkConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchDatabases: () => Promise<void>;
  saveArticle: (databaseId: string, articleData: any) => Promise<{ success: boolean; pageId?: string; url?: string; error?: string }>;
}

const NotionContext = createContext<NotionContextType | undefined>(undefined);

export function NotionProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<NotionUser | null>(null);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 檢查連接狀態
  const checkConnection = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notion/status', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.connected && data.user) {
        setIsConnected(true);
        setUser(data.user);
      } else {
        setIsConnected(false);
        setUser(null);
      }
    } catch (error) {
      console.error('[Notion] Check connection error:', error);
      setIsConnected(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 斷開連接
  const disconnect = async () => {
    try {
      const response = await fetch('/api/notion/disconnect', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setIsConnected(false);
        setUser(null);
        setDatabases([]);
      }
    } catch (error) {
      console.error('[Notion] Disconnect error:', error);
      throw error;
    }
  };

  // 獲取資料庫列表
  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/notion/databases', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch databases');
      }

      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (error) {
      console.error('[Notion] Fetch databases error:', error);
      throw error;
    }
  };

  // 儲存文章到 Notion
  const saveArticle = async (databaseId: string, articleData: any) => {
    try {
      const response = await fetch('/api/notion/save-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          databaseId,
          articleData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || '儲存失敗'
        };
      }

      return {
        success: true,
        pageId: data.pageId,
        url: data.url
      };
    } catch (error: any) {
      console.error('[Notion] Save article error:', error);
      return {
        success: false,
        error: error.message || '網路錯誤'
      };
    }
  };

  // 初始化時檢查連接狀態
  useEffect(() => {
    checkConnection();
  }, []);

  // 處理 OAuth 回調
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('notion_connected') === 'true') {
      checkConnection();
      // 清除 URL 參數
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (params.get('notion_error')) {
      const error = params.get('notion_error');
      console.error('[Notion] OAuth error:', error);
      // 可以顯示錯誤提示
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const value: NotionContextType = {
    isConnected,
    user,
    databases,
    isLoading,
    checkConnection,
    disconnect,
    fetchDatabases,
    saveArticle
  };

  return (
    <NotionContext.Provider value={value}>
      {children}
    </NotionContext.Provider>
  );
}

export function useNotion() {
  const context = useContext(NotionContext);
  if (context === undefined) {
    throw new Error('useNotion must be used within a NotionProvider');
  }
  return context;
}
