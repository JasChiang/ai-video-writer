import { ApiError, requestJson } from './api';

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
  return requestJson<NotionPublishResponse>('/notion/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    errorMessage: 'Notion 發佈失敗，請稍後再試。'
  });
}

export async function getNotionAuthUrl(clientOrigin?: string): Promise<NotionAuthUrlResponse> {
  const searchParams = new URLSearchParams();
  if (clientOrigin) {
    searchParams.set('origin', clientOrigin);
  }

  return requestJson<NotionAuthUrlResponse>(
    `/notion/oauth/url${searchParams.size ? `?${searchParams.toString()}` : ''}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      errorMessage: '無法取得 Notion 授權網址。'
    }
  );
}

export async function listNotionDatabases(
  notionToken: string,
  params?: { pageSize?: number; startCursor?: string }
): Promise<NotionDatabasesResponse> {
  try {
    return await requestJson<NotionDatabasesResponse>('/notion/databases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notionToken,
        pageSize: params?.pageSize,
        startCursor: params?.startCursor,
      }),
      errorMessage: '取得 Notion 資料庫列表失敗。'
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new Error('Notion 權杖已失效，請重新登入。');
    }
    throw error;
  }
}

export async function getNotionDatabaseInfo(
  notionToken: string,
  databaseId: string
): Promise<NotionDatabaseInfo> {
  return requestJson<NotionDatabaseInfo>('/notion/database-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notionToken,
      databaseId,
    }),
    errorMessage: '取得 Notion 資料庫資訊失敗。'
  });
}
