const NOTION_API_ENDPOINT = 'https://api.notion.com/v1/pages';
export const NOTION_API_VERSION = '2022-06-28';

/**
 * 將長文字切割成 Notion API 可接受的片段（每段 <= 1800 字元）
 * Notion rich_text 單段限制為 2000 字元，保守設為 1800
 * @param {string} text - 需要切割的文字
 * @param {number} [chunkSize=1800] - 單段最大長度
 * @returns {string[]} - 切割後的文字陣列
 */
function chunkText(text, chunkSize = 1800) {
  if (!text) return [];

  const chunks = [];
  let buffer = '';

  const pushBuffer = () => {
    if (buffer.trim().length > 0) {
      chunks.push(buffer);
    }
    buffer = '';
  };

  for (const line of text.split('\n')) {
    const candidate = buffer.length === 0 ? line : `${buffer}\n${line}`;
    if (candidate.length > chunkSize) {
      pushBuffer();
      if (line.length > chunkSize) {
        // 若單行過長，直接硬切
        for (let i = 0; i < line.length; i += chunkSize) {
          chunks.push(line.slice(i, i + chunkSize));
        }
        buffer = '';
      } else {
        buffer = line;
      }
    } else {
      buffer = candidate;
    }
  }

  pushBuffer();
  return chunks;
}

/**
 * 將文章發佈到 Notion 資料庫
 * @param {object} params
 * @param {string} params.notionToken - Notion 整合金鑰
 * @param {string} params.databaseId - 目標資料庫 ID
 * @param {string} params.title - Notion 頁面標題
 * @param {string} params.article - Markdown 文章內容
 * @param {string} [params.seoDescription] - SEO 描述
 * @param {string} [params.videoUrl] - 影片網址
 * @param {string} [params.titleProperty='Name'] - 目標資料庫的標題欄位名稱
 * @returns {Promise<{pageId: string, url: string}>}
 */
export async function publishArticleToNotion({
  notionToken,
  databaseId,
  title,
  article,
  seoDescription,
  videoUrl,
  titleProperty = 'Name',
}) {
  if (!notionToken) {
    throw new Error('缺少 Notion 金鑰');
  }
  if (!databaseId) {
    throw new Error('缺少 Notion 資料庫 ID');
  }
  if (!title) {
    throw new Error('缺少 Notion 頁面標題');
  }
  if (!article) {
    throw new Error('缺少文章內容');
  }

  const headers = {
    Authorization: `Bearer ${notionToken}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_API_VERSION,
  };

  const children = [];

  if (videoUrl) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '🎬 原始影片：',
            },
          },
          {
            type: 'text',
            text: {
              content: videoUrl,
              link: { url: videoUrl },
            },
          },
        ],
      },
    });
  }

  if (seoDescription) {
    children.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `SEO 描述：${seoDescription}`,
            },
          },
        ],
        color: 'default',
      },
    });
  }

  const articleChunks = chunkText(article);
  if (articleChunks.length > 0) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: '文章內容' },
          },
        ],
        color: 'default',
      },
    });

    for (const chunk of articleChunks) {
      children.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [
            {
              type: 'text',
              text: { content: chunk },
            },
          ],
          language: 'markdown',
        },
      });
    }
  }

  const payload = {
    parent: { database_id: databaseId },
    properties: {
      [titleProperty]: {
        title: [
          {
            type: 'text',
            text: { content: title },
          },
        ],
      },
    },
    children,
  };

  const response = await fetch(NOTION_API_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Notion API 呼叫失敗 (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return {
    pageId: data.id,
    url: data.url,
  };
}

/**
 * 從 Notion 搜尋可用的資料庫列表
 * @param {string} notionToken - OAuth 取得的 Notion Access Token
 * @param {object} [options]
 * @param {number} [options.pageSize=50] - 每頁筆數
 * @param {string} [options.startCursor] - 分頁游標
 * @returns {Promise<{ databases: Array, nextCursor?: string|null, hasMore: boolean }>}
 */
export async function listNotionDatabases(
  notionToken,
  { pageSize = 50, startCursor } = {}
) {
  if (!notionToken) {
    throw new Error('缺少 Notion 金鑰');
  }

  const body = {
    filter: {
      property: 'object',
      value: 'database',
    },
    page_size: Math.min(pageSize, 100),
  };

  if (startCursor) {
    body.start_cursor = startCursor;
  }

  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Notion API 呼叫失敗 (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore
    }

    const err = new Error(errorMessage);
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  const databases =
    (data.results || [])
      .filter((item) => item.object === 'database')
      .map((database) => {
        const title =
          database.title && Array.isArray(database.title) && database.title.length > 0
            ? database.title.map((t) => t.plain_text).join('').trim()
            : '未命名資料庫';

        let icon = null;
        if (database.icon) {
          if (database.icon.type === 'emoji') {
            icon = database.icon.emoji;
          } else if (database.icon.type === 'external') {
            icon = database.icon.external?.url || null;
          } else if (database.icon.type === 'file') {
            icon = database.icon.file?.url || null;
          }
        }

        return {
          id: database.id,
          title,
          url: database.url,
          icon,
        };
      }) || [];

  return {
    databases,
    hasMore: Boolean(data.has_more),
    nextCursor: data.next_cursor || null,
  };
}

/**
 * 取得單一 Notion 資料庫資訊
 * @param {string} notionToken
 * @param {string} databaseId
 * @returns {Promise<{ id: string, title: string, titleProperty: string | null, properties: Array }>}
 */
export async function getNotionDatabase(notionToken, databaseId) {
  if (!notionToken) {
    throw new Error('缺少 Notion 金鑰');
  }
  if (!databaseId) {
    throw new Error('缺少 Notion 資料庫 ID');
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
  });

  if (!response.ok) {
    let errorMessage = `Notion API 呼叫失敗 (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore
    }
    const err = new Error(errorMessage);
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  let title = '未命名資料庫';
  if (Array.isArray(data?.title) && data.title.length > 0) {
    title = data.title.map((t) => t?.plain_text || '').join('').trim() || title;
  }

  let titlePropertyName = null;
  const properties = [];

  if (data?.properties && typeof data.properties === 'object') {
    for (const [name, prop] of Object.entries(data.properties)) {
      const propertyInfo = {
        name,
        type: prop?.type || null,
        isTitle: prop?.type === 'title',
      };
      properties.push(propertyInfo);
      if (propertyInfo.isTitle) {
        titlePropertyName = name;
      }
    }
  }

  return {
    id: data.id,
    title,
    titleProperty: titlePropertyName,
    properties,
  };
}
