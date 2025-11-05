# Notion API 使用限制與規範

## 一、Rate Limits（速率限制）

### 1.1 基本限制

Notion API 使用**滾動速率限制**（rolling rate limit）：

| 限制類型 | 數值 | 說明 |
|---------|------|------|
| **平均速率** | 3 requests/second | 每秒平均請求數 |
| **突發速率** | 最多連續發送 | 短時間內可以發送多個請求 |
| **重試時間** | Retry-After header | 超出限制時，回應會包含重試時間 |

**重要：**
- Rate limit 是**按 integration（應用）計算**，不是按用戶
- 如果有 100 個用戶同時使用，所有請求都計入同一個 rate limit
- 超出限制會收到 `429 Too Many Requests` 錯誤

### 1.2 速率限制計算方式

```
滾動視窗：每秒 3 個請求
├── 0.0s: Request 1 ✅
├── 0.3s: Request 2 ✅
├── 0.6s: Request 3 ✅
├── 0.9s: Request 4 ❌ (需等到 1.0s)
└── 1.0s: Request 4 ✅
```

### 1.3 回應 Header

Notion API 回應會包含以下 headers：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3
Content-Type: application/json

{
  "object": "error",
  "status": 429,
  "code": "rate_limited",
  "message": "Rate limit exceeded. Retry after 3 seconds."
}
```

## 二、內容限制

### 2.1 Page 內容限制

| 項目 | 限制 |
|------|------|
| **Blocks per page** | 無硬性限制 | 但建議分段創建 |
| **Children per block** | 100 個子 blocks |
| **Block nesting** | 最多 2 層巢狀 |
| **Text length** | 2000 字符/block |

### 2.2 Rich Text 限制

```javascript
// ✅ 正確：每個 block 的 rich_text 最多 2000 字符
{
  type: 'paragraph',
  paragraph: {
    rich_text: [
      { text: { content: '不超過 2000 字符的文字...' } }
    ]
  }
}

// ❌ 錯誤：超過 2000 字符需要分割成多個 blocks
{
  type: 'paragraph',
  paragraph: {
    rich_text: [
      { text: { content: '超過 2000 字符的長文...' } } // 會失敗
    ]
  }
}
```

### 2.3 一次創建 Blocks 的限制

使用 `children` 參數一次創建多個 blocks：

```javascript
// 最多一次創建 100 個 blocks
await notion.pages.create({
  parent: { database_id: databaseId },
  properties: { ... },
  children: [
    // 最多 100 個 blocks
  ]
});
```

**超過 100 個 blocks？**
需要使用 `append_block_children` API 分批添加。

## 三、資料庫限制

### 3.1 Properties 限制

| 項目 | 限制 |
|------|------|
| **Properties per database** | 無硬性限制 |
| **Property name length** | 不明確，建議 < 100 字符 |
| **Select/Multi-select options** | 建議 < 100 個選項 |

### 3.2 Query 限制

```javascript
// 每次查詢最多返回 100 筆
const response = await notion.databases.query({
  database_id: databaseId,
  page_size: 100 // 最大值
});

// 如需更多，使用 pagination
let hasMore = true;
let startCursor = undefined;

while (hasMore) {
  const response = await notion.databases.query({
    database_id: databaseId,
    start_cursor: startCursor,
    page_size: 100
  });

  // 處理 results...

  hasMore = response.has_more;
  startCursor = response.next_cursor;
}
```

## 四、檔案與媒體限制

### 4.1 圖片限制

| 類型 | 支援 | 限制 |
|------|------|------|
| **External URLs** | ✅ 支援 | 必須是公開 URL |
| **File uploads** | ❌ 不支援 | 只能使用外部連結 |
| **Image size** | 無限制 | 但 Notion 會自動優化 |

```javascript
// ✅ 正確：使用外部 URL
{
  type: 'image',
  image: {
    type: 'external',
    external: { url: 'https://example.com/image.jpg' }
  }
}

// ❌ 錯誤：不支援直接上傳檔案
{
  type: 'image',
  image: {
    type: 'file',
    file: { ... } // 不支援
  }
}
```

**重要：**
- 必須使用 HTTPS
- URL 必須可公開存取
- 建議將截圖上傳到自己的 CDN 或圖床

### 4.2 影片嵌入

支援的影片平台：
- ✅ YouTube
- ✅ Vimeo
- ✅ 其他支援 oEmbed 的平台

```javascript
{
  type: 'video',
  video: {
    type: 'external',
    external: { url: 'https://www.youtube.com/watch?v=...' }
  }
}
```

## 五、OAuth 限制

### 5.1 Token 有效期

| Token 類型 | 有效期 | 說明 |
|-----------|-------|------|
| **Access Token** | 永久有效 | 除非用戶撤銷 |
| **No Refresh Token** | - | Notion 不使用 refresh token |

**重要：**
- Access token 不會過期（除非用戶主動撤銷）
- 但建議定期檢查 token 有效性
- 用戶可以在 Notion 設定中撤銷授權

### 5.2 授權範圍

Notion OAuth 的權限是**全有或全無**：

```
授權後，應用可以：
├── ✅ 讀取用戶所有可訪問的 pages 和 databases
├── ✅ 創建新的 pages
├── ✅ 更新現有 pages
└── ✅ 搜尋用戶的工作區
```

**無法細分權限**，例如無法只要求「寫入特定資料庫」的權限。

## 六、Search API 限制

### 6.1 搜尋限制

```javascript
const response = await notion.search({
  query: 'keyword',
  page_size: 100, // 最大值
  filter: {
    property: 'object',
    value: 'database'
  }
});
```

| 限制 | 數值 |
|------|------|
| 每次搜尋結果 | 最多 100 筆 |
| 搜尋速度 | 較慢，建議快取結果 |
| 搜尋範圍 | 用戶有權限的所有內容 |

## 七、錯誤處理

### 7.1 常見錯誤碼

| 錯誤碼 | 說明 | 處理方式 |
|-------|------|---------|
| `400` | Bad Request | 檢查請求格式 |
| `401` | Unauthorized | Token 無效或過期 |
| `403` | Forbidden | 無權限訪問資源 |
| `404` | Not Found | 資源不存在 |
| `429` | Rate Limited | 等待後重試 |
| `500` | Internal Error | Notion 服務問題，重試 |
| `503` | Service Unavailable | Notion 維護中 |

### 7.2 重試策略

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'rate_limited') {
        const retryAfter = error.headers['retry-after'] || (2 ** i); // 指數退避
        console.log(`Rate limited, retry after ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }
      throw error; // 其他錯誤直接拋出
    }
  }
  throw new Error('Max retries exceeded');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 八、最佳實踐

### 8.1 避免 Rate Limit

**1. 批次處理**
```javascript
// ❌ 錯誤：逐個創建 blocks
for (const block of blocks) {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [block]
  });
}

// ✅ 正確：批次創建（最多 100 個）
await notion.blocks.children.append({
  block_id: pageId,
  children: blocks.slice(0, 100)
});
```

**2. 加入延遲**
```javascript
async function createPageWithDelay(data) {
  const result = await notion.pages.create(data);
  await sleep(333); // 確保每秒不超過 3 個請求
  return result;
}
```

**3. 使用隊列**
```javascript
import PQueue from 'p-queue';

const queue = new PQueue({
  interval: 1000, // 每秒
  intervalCap: 3  // 最多 3 個請求
});

queue.add(() => notion.pages.create(...));
queue.add(() => notion.pages.create(...));
```

### 8.2 優化內容

**1. 分割長文**
```javascript
function splitTextIntoBlocks(text, maxLength = 1900) {
  const blocks = [];
  const paragraphs = text.split('\n\n');

  let currentBlock = '';

  for (const para of paragraphs) {
    if ((currentBlock + para).length > maxLength) {
      if (currentBlock) {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: currentBlock.trim() } }]
          }
        });
      }
      currentBlock = para;
    } else {
      currentBlock += (currentBlock ? '\n\n' : '') + para;
    }
  }

  if (currentBlock) {
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: currentBlock.trim() } }]
      }
    });
  }

  return blocks;
}
```

**2. 快取資料庫列表**
```javascript
// 快取用戶的資料庫列表（避免重複查詢）
const databaseCache = new Map();

async function getDatabasesWithCache(userId, notionService) {
  const cacheKey = `databases:${userId}`;
  const cached = databaseCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 分鐘
    return cached.data;
  }

  const databases = await notionService.getDatabases();
  databaseCache.set(cacheKey, {
    data: databases,
    timestamp: Date.now()
  });

  return databases;
}
```

### 8.3 用戶體驗優化

**1. 顯示進度**
```javascript
async function saveArticleWithProgress(articleData, onProgress) {
  onProgress('正在轉換 Markdown...');
  const blocks = await convertMarkdown(articleData.article);

  onProgress('正在創建 Notion 頁面...');
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: { ... }
  });

  onProgress('正在添加內容...');
  // 分批添加 blocks（每次 100 個）
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: blocks.slice(i, i + 100)
    });
    onProgress(`已添加 ${Math.min(i + 100, blocks.length)}/${blocks.length} 個區塊`);
  }

  onProgress('完成！');
  return page;
}
```

**2. 錯誤友善提示**
```javascript
function getErrorMessage(error) {
  switch (error.code) {
    case 'rate_limited':
      return '請求過於頻繁，請稍後再試';
    case 'unauthorized':
      return 'Notion 授權已過期，請重新連接';
    case 'object_not_found':
      return '找不到指定的資料庫，可能已被刪除';
    case 'validation_error':
      return '資料格式錯誤，請聯繫客服';
    default:
      return `發生錯誤：${error.message}`;
  }
}
```

## 九、配額與計費

### 9.1 免費額度

Notion API **完全免費**，沒有額外費用：

- ✅ 無 API 調用次數限制（只有 rate limit）
- ✅ 無用戶數限制
- ✅ 無資料儲存費用
- ✅ 無隱藏收費

**但注意：**
- Rate limit 是共享的（每個 integration 3 req/s）
- 如果應用用戶很多，可能需要優化請求頻率

### 9.2 企業版差異

Notion **企業版**沒有額外的 API 優勢：

| 功能 | 個人版 | 企業版 |
|------|--------|--------|
| API Access | ✅ | ✅ |
| Rate Limit | 3 req/s | 3 req/s |
| 功能限制 | 相同 | 相同 |

## 十、監控建議

### 10.1 記錄 API 使用

```javascript
import { createLogger } from 'winston';

const logger = createLogger({ ... });

class NotionServiceWithLogging extends NotionService {
  async createPage(data) {
    const startTime = Date.now();

    try {
      const result = await super.createPage(data);

      logger.info('Notion API success', {
        method: 'createPage',
        duration: Date.now() - startTime,
        pageId: result.id
      });

      return result;
    } catch (error) {
      logger.error('Notion API error', {
        method: 'createPage',
        duration: Date.now() - startTime,
        error: error.code,
        message: error.message
      });

      throw error;
    }
  }
}
```

### 10.2 設置警報

監控以下指標：

- ⚠️ 429 錯誤率 > 5%
- ⚠️ 平均回應時間 > 3 秒
- ⚠️ 失敗率 > 1%

## 總結

### ✅ Notion API 優勢

- 完全免費，無配額限制
- 永久 access token，無需 refresh
- 功能強大，支援豐富的內容類型

### ⚠️ 需要注意的限制

- Rate limit: 3 req/s（按 integration 計算）
- 圖片只支援外部 URL，不能直接上傳
- 每個 block 最多 2000 字符
- 一次最多創建 100 個 blocks

### 💡 建議

1. **實作請求隊列**，確保不超過 rate limit
2. **快取常用資料**（如資料庫列表）
3. **分批處理長文**，每個 block 不超過 2000 字符
4. **使用外部 CDN** 儲存截圖
5. **良好的錯誤處理**和重試機制
