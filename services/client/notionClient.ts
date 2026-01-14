const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export interface NotionPublishPayload {
  title: string;
  article: string;
  seoDescription?: string;
  databaseId?: string;
  notionToken?: string;
  videoUrl?: string;
  titleProperty?: string;
  screenshotPlan?: NotionScreenshotPlanItem[];
  imageUrls?: string[][];
}

export interface NotionPublishResponse {
  success: boolean;
  pageId: string;
  url: string;
}

export interface NotionScreenshotPlanItem {
  timestamp: string;
  reason?: string;
}

export interface NotionAuthUrlResponse {
  url: string;
  state: string;
}

export interface NotionOAuthPayload {
  accessToken: string;
  refreshToken?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
  botId?: string | null;
  duplicatedTemplateId?: string | null;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  icon: string | null;
}

export interface NotionDatabasesResponse {
  databases: NotionDatabase[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface NotionDatabaseInfo {
  id: string;
  title: string;
  titleProperty: string | null;
  properties: Array<{
    name: string;
    type: string | null;
    isTitle: boolean;
  }>;
}

/**
 * 將生成的文章發佈到 Notion
 */
export async function publishArticleToNotion(
  payload: NotionPublishPayload
): Promise<NotionPublishResponse> {
  const response = await fetch(`${API_BASE_URL}/notion/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Notion 發佈失敗，請稍後再試。';
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (err) {
      console.error('無法解析 Notion API 錯誤：', err);
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getNotionAuthUrl(clientOrigin?: string): Promise<NotionAuthUrlResponse> {
  const searchParams = new URLSearchParams();
  if (clientOrigin) {
    searchParams.set('origin', clientOrigin);
  }

  const response = await fetch(`${API_BASE_URL}/notion/oauth/url${searchParams.size ? `?${searchParams.toString()}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = '無法取得 Notion 授權網址。';
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (err) {
      console.error('解析 Notion 授權錯誤時失敗：', err);
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function listNotionDatabases(
  notionToken: string,
  params?: { pageSize?: number; startCursor?: string }
): Promise<NotionDatabasesResponse> {
  const response = await fetch(`${API_BASE_URL}/notion/databases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notionToken,
      pageSize: params?.pageSize,
      startCursor: params?.startCursor,
    }),
  });

  if (!response.ok) {
    let errorMessage = '取得 Notion 資料庫列表失敗。';
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (err) {
      console.error('解析 Notion 資料庫列表錯誤時失敗：', err);
    }

    if (response.status === 401) {
      errorMessage = 'Notion 權杖已失效，請重新登入。';
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getNotionDatabaseInfo(
  notionToken: string,
  databaseId: string
): Promise<NotionDatabaseInfo> {
  const response = await fetch(`${API_BASE_URL}/notion/database-info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notionToken,
      databaseId,
    }),
  });

  if (!response.ok) {
    let errorMessage = '取得 Notion 資料庫資訊失敗。';
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch (err) {
      console.error('解析 Notion 資料庫資訊錯誤時失敗：', err);
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
