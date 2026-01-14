import fs from 'fs';
import path from 'path';
const NOTION_API_ENDPOINT = 'https://api.notion.com/v1/pages';
export const NOTION_API_VERSION = '2022-06-28';
const NOTION_FILES_VERSION = '2025-09-03';

const { promises: fsPromises } = fs;

const IMAGE_PURPOSE = 'file';
const IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function guessImageMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return IMAGE_MIME_TYPES[ext] || 'image/png';
}

function resolveLocalImagePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  const candidates = [];

  const pushCandidatesForPath = (rawPath) => {
    if (!rawPath) return;
    const trimmed = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
    // Absolute path
    if (path.isAbsolute(rawPath)) {
      candidates.push(rawPath);
    } else {
      candidates.push(path.join(process.cwd(), trimmed));
    }
    candidates.push(path.join(process.cwd(), 'public', trimmed));
    if (trimmed.startsWith('images/')) {
      candidates.push(path.join(process.cwd(), 'public', trimmed));
    }
  };

  try {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const parsed = new URL(imageUrl);
      const pathname = decodeURIComponent(parsed.pathname || '');
      pushCandidatesForPath(pathname);
    } else {
      pushCandidatesForPath(imageUrl);
    }
  } catch (err) {
    pushCandidatesForPath(imageUrl);
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function uploadImageToNotion(notionToken, buffer, filename, mimeType, contentLength) {
  const { FormData, File } = globalThis;
  if (!FormData || !File) {
    throw new Error('FormData/File is not available in this runtime. Please use Node.js >= 18.');
  }

  const createResponse = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_FILES_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'single_part',
      filename,
      content_type: mimeType,
      content_length: contentLength,
    }),
  });

  if (!createResponse.ok) {
    let errorMessage = `Notion 準備檔案上傳失敗 (${createResponse.status})`;
    try {
      const errorData = await createResponse.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const uploadInfo = await createResponse.json();
  const uploadId = uploadInfo?.id;
  const uploadUrl = uploadInfo?.upload_url;

  if (!uploadId || !uploadUrl) {
    throw new Error('Notion 回傳的上傳資訊不完整，缺少 id 或 upload_url');
  }

  const formData = new FormData();
  const file = new File([buffer], filename, { type: mimeType || 'application/octet-stream' });
  formData.append('file', file);

  const sendResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_FILES_VERSION,
    },
    body: formData,
  });

  if (!sendResponse.ok) {
    let errorMessage = `Notion 圖片上傳失敗 (${sendResponse.status})`;
    try {
      const errorData = await sendResponse.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return {
    fileUploadId: uploadId,
    name: uploadInfo?.filename || filename,
  };
}

async function prepareImageForNotion(notionToken, imageUrl) {
  const localPath = resolveLocalImagePath(imageUrl);
  if (!localPath) {
    return {
      type: 'external',
      url: imageUrl,
    };
  }

  try {
    const fileBuffer = await fsPromises.readFile(localPath);
    const fileName = path.basename(localPath);
    const mimeType = guessImageMimeType(localPath);
    const stats = await fsPromises.stat(localPath);
    const uploaded = await uploadImageToNotion(
      notionToken,
      fileBuffer,
      fileName,
      mimeType,
      stats.size,
    );
    return {
      type: 'file_upload',
      file_upload_id: uploaded.fileUploadId,
      name: uploaded.name || fileName,
    };
  } catch (error) {
    console.error('[Notion] 圖片上傳失敗，改用原始 URL:', error);
    return {
      type: 'external',
      url: imageUrl,
    };
  }
}

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
 * @param {Array<{ timestamp_seconds?: string, timestamp?: string, reason_for_screenshot?: string, reason?: string }>} [params.screenshotPlan] - 截圖規劃
 * @param {string[][]} [params.imageUrls] - 截圖圖片 URL 陣列
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
  screenshotPlan,
  imageUrls,
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
  const normalizedPlan = Array.isArray(screenshotPlan)
    ? screenshotPlan
        .map((item, index) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const timestamp =
            typeof item.timestamp_seconds === 'string' && item.timestamp_seconds.trim()
              ? item.timestamp_seconds.trim()
              : typeof item.timestamp === 'string' && item.timestamp.trim()
                ? item.timestamp.trim()
                : `Step ${index + 1}`;
          const reason =
            typeof item.reason_for_screenshot === 'string' && item.reason_for_screenshot.trim()
              ? item.reason_for_screenshot.trim()
              : typeof item.reason === 'string' && item.reason.trim()
                ? item.reason.trim()
                : '';
          return {
            timestamp,
            reason,
          };
        })
        .filter(Boolean)
    : [];

  const normalizedImages = Array.isArray(imageUrls)
    ? imageUrls
        .map((group) =>
          Array.isArray(group)
            ? group
                .map((url) => (typeof url === 'string' ? url.trim() : ''))
                .filter((url) => url.length > 0)
            : []
        )
        .filter((group) => group.length > 0)
    : [];

  const uploadedImageGroups = [];
  if (normalizedImages.length > 0) {
    for (const group of normalizedImages) {
      const uploadedGroup = [];
      for (const imageUrl of group) {
        uploadedGroup.push(await prepareImageForNotion(notionToken, imageUrl));
      }
      uploadedImageGroups.push(uploadedGroup);
    }
  }

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

  if (normalizedPlan.length > 0) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: '截圖時間點規劃' },
          },
        ],
        color: 'default',
      },
    });

    normalizedPlan.forEach((planItem) => {
      const textContent = planItem.reason
        ? `${planItem.timestamp} — ${planItem.reason}`
        : planItem.timestamp;
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: { content: textContent },
            },
          ],
        },
      });
    });
  }

  if (uploadedImageGroups.length > 0) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: '截圖圖像' },
          },
        ],
        color: 'default',
      },
    });

    uploadedImageGroups.forEach((group, index) => {
      let headingLabel = `截圖組 ${index + 1}`;
      if (normalizedPlan[index]?.timestamp) {
        headingLabel = `截圖 ${normalizedPlan[index].timestamp}`;
      }

      children.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [
            {
              type: 'text',
              text: { content: headingLabel },
            },
          ],
          color: 'default',
        },
      });

      group.forEach((imageData, imageIndex) => {
        const caption = normalizedPlan[index]?.reason && imageIndex === 0
          ? [
              {
                type: 'text',
                text: {
                  content: normalizedPlan[index].reason,
                },
              },
            ]
          : [];

        if (imageData.type === 'file_upload' && imageData.file_upload_id) {
          children.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'file_upload',
              file_upload: {
                id: imageData.file_upload_id,
              },
              caption,
            },
          });
        } else {
          children.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: {
                url: imageData.url,
              },
              caption,
            },
          });
        }
      });
    });
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
