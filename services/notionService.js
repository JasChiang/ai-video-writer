import { Client } from '@notionhq/client';

/**
 * Notion API 服務封裝
 * 處理所有與 Notion API 的互動
 */
class NotionService {
  constructor(accessToken) {
    this.client = new Client({
      auth: accessToken,
      notionVersion: '2022-06-28'
    });
  }

  /**
   * 取得用戶的所有資料庫
   * @returns {Promise<Array>} 資料庫列表
   */
  async getDatabases() {
    try {
      const response = await this.client.search({
        filter: {
          property: 'object',
          value: 'database'
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time'
        },
        page_size: 100
      });

      return response.results.map(db => ({
        id: db.id,
        title: this.extractTitle(db.title),
        icon: db.icon,
        url: db.url,
        lastEditedTime: db.last_edited_time
      }));
    } catch (error) {
      console.error('[Notion] Get databases error:', error);
      throw new Error('無法取得 Notion 資料庫列表');
    }
  }

  /**
   * 創建文章頁面到指定資料庫
   * @param {string} databaseId - 目標資料庫 ID
   * @param {Object} articleData - 文章資料
   * @returns {Promise<Object>} 創建的頁面資訊
   */
  async createArticlePage(databaseId, articleData) {
    const {
      selectedTitle,
      article,
      seoDescription,
      videoId,
      videoTitle,
      imageUrls
    } = articleData;

    try {
      console.log('[Notion] Creating article page...');

      // 轉換 Markdown 為 Notion blocks
      const blocks = this.convertMarkdownToBlocks(article, imageUrls);

      // 分批處理 blocks（Notion 限制一次最多 100 個）
      const firstBatch = blocks.slice(0, 100);
      const remainingBlocks = blocks.slice(100);

      // 創建頁面（包含前 100 個 blocks）
      const page = await this.client.pages.create({
        parent: { database_id: databaseId },
        properties: this.buildPageProperties(
          selectedTitle,
          seoDescription,
          videoId,
          videoTitle
        ),
        children: firstBatch
      });

      console.log(`[Notion] Page created: ${page.id}`);

      // 如果還有剩餘 blocks，分批添加
      if (remainingBlocks.length > 0) {
        console.log(`[Notion] Appending ${remainingBlocks.length} remaining blocks...`);
        await this.appendBlocksInBatches(page.id, remainingBlocks);
      }

      return {
        pageId: page.id,
        url: page.url
      };
    } catch (error) {
      console.error('[Notion] Create page error:', error);

      // 提供更友善的錯誤訊息
      if (error.code === 'validation_error') {
        throw new Error('資料格式錯誤，請檢查文章內容');
      } else if (error.code === 'object_not_found') {
        throw new Error('找不到指定的資料庫，可能已被刪除');
      } else if (error.code === 'rate_limited') {
        throw new Error('請求過於頻繁，請稍後再試');
      } else {
        throw new Error(`儲存失敗：${error.message}`);
      }
    }
  }

  /**
   * 分批添加 blocks（避免超過 API 限制）
   * @param {string} pageId - 頁面 ID
   * @param {Array} blocks - 要添加的 blocks
   */
  async appendBlocksInBatches(pageId, blocks) {
    const batchSize = 100;

    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);

      try {
        await this.client.blocks.children.append({
          block_id: pageId,
          children: batch
        });

        console.log(`[Notion] Appended batch ${Math.floor(i / batchSize) + 1}`);

        // 避免 rate limit（每秒最多 3 個請求）
        if (i + batchSize < blocks.length) {
          await this.sleep(350); // 等待 350ms
        }
      } catch (error) {
        console.error(`[Notion] Append batch error:`, error);
        // 繼續處理剩餘 blocks，不中斷整個流程
      }
    }
  }

  /**
   * 建立頁面屬性
   * @param {string} title - 標題
   * @param {string} seoDescription - SEO 描述
   * @param {string} videoId - YouTube 影片 ID
   * @param {string} videoTitle - 原始影片標題
   * @returns {Object} Notion 頁面屬性
   */
  buildPageProperties(title, seoDescription, videoId, videoTitle) {
    const properties = {
      // Name 是必須欄位（Title 類型）
      'Name': {
        title: [{ text: { content: this.truncateText(title, 2000) } }]
      }
    };

    // 以下是可選欄位，只有在資料庫有這些欄位時才會使用
    // Notion 會自動忽略不存在的欄位

    if (seoDescription) {
      properties['SEO 描述'] = {
        rich_text: [{ text: { content: this.truncateText(seoDescription, 2000) } }]
      };
    }

    if (videoId) {
      properties['YouTube ID'] = {
        rich_text: [{ text: { content: videoId } }]
      };

      properties['YouTube 連結'] = {
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
    }

    if (videoTitle) {
      properties['原始標題'] = {
        rich_text: [{ text: { content: this.truncateText(videoTitle, 2000) } }]
      };
    }

    // 自動標籤
    properties['Tags'] = {
      multi_select: [
        { name: 'AI Generated' },
        { name: 'YouTube' }
      ]
    };

    // 狀態
    properties['Status'] = {
      select: { name: '草稿' }
    };

    return properties;
  }

  /**
   * Markdown 轉 Notion blocks
   * @param {string} markdown - Markdown 文字
   * @param {Array} imageUrls - 截圖 URLs
   * @returns {Array} Notion blocks
   */
  convertMarkdownToBlocks(markdown, imageUrls = []) {
    const blocks = [];
    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      // 標題 H1
      if (line.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: this.truncateText(line.substring(2), 2000) } }]
          }
        });
        i++;
      }
      // 標題 H2
      else if (line.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: this.truncateText(line.substring(3), 2000) } }]
          }
        });
        i++;
      }
      // 標題 H3
      else if (line.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: this.truncateText(line.substring(4), 2000) } }]
          }
        });
        i++;
      }
      // 程式碼區塊
      else if (line.startsWith('```')) {
        const codeLines = [];
        i++; // 跳過開始標記

        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }

        i++; // 跳過結束標記

        if (codeLines.length > 0) {
          blocks.push({
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ text: { content: this.truncateText(codeLines.join('\n'), 2000) } }],
              language: 'plain text'
            }
          });
        }
      }
      // 無序列表
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: this.truncateText(line.substring(2), 2000) } }]
          }
        });
        i++;
      }
      // 有序列表
      else if (/^\d+\.\s/.test(line)) {
        blocks.push({
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ text: { content: this.truncateText(line.replace(/^\d+\.\s/, ''), 2000) } }]
          }
        });
        i++;
      }
      // 引用
      else if (line.startsWith('> ')) {
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [{ text: { content: this.truncateText(line.substring(2), 2000) } }]
          }
        });
        i++;
      }
      // 分隔線
      else if (line === '---' || line === '***' || line === '___') {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
        i++;
      }
      // 一般段落
      else {
        // 收集連續的段落文字（直到空行或特殊標記）
        let paragraphText = line;
        i++;

        while (i < lines.length) {
          const nextLine = lines[i].trim();

          // 遇到空行、標題、列表等，停止
          if (!nextLine ||
              nextLine.startsWith('#') ||
              nextLine.startsWith('-') ||
              nextLine.startsWith('*') ||
              nextLine.startsWith('>') ||
              nextLine.startsWith('```') ||
              /^\d+\.\s/.test(nextLine)) {
            break;
          }

          paragraphText += ' ' + nextLine;
          i++;
        }

        // 檢查是否超過 2000 字符限制，需要分割
        if (paragraphText.length > 2000) {
          const chunks = this.splitTextIntoChunks(paragraphText, 1900);
          chunks.forEach(chunk => {
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ text: { content: chunk } }]
              }
            });
          });
        } else {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: paragraphText } }]
            }
          });
        }
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

      // 扁平化二維陣列並添加圖片
      const flatImages = imageUrls.flat();
      flatImages.forEach((imageUrl, index) => {
        // 確保是完整 URL
        const fullUrl = imageUrl.startsWith('http')
          ? imageUrl
          : `${process.env.VITE_SERVER_BASE_URL || ''}${imageUrl}`;

        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: fullUrl }
          }
        });
      });
    }

    return blocks;
  }

  /**
   * 分割長文字為多個區塊
   * @param {string} text - 原始文字
   * @param {number} maxLength - 最大長度
   * @returns {Array<string>} 分割後的文字陣列
   */
  splitTextIntoChunks(text, maxLength) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      // 嘗試在句號、問號、驚嘆號處分割
      let splitIndex = maxLength;
      const sentenceEnd = /[。！？.!?]\s/g;
      let match;

      while ((match = sentenceEnd.exec(remaining.substring(0, maxLength))) !== null) {
        splitIndex = match.index + match[0].length;
      }

      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  }

  /**
   * 提取 Notion title
   * @param {Array} titleArray - Notion title 陣列
   * @returns {string} 標題文字
   */
  extractTitle(titleArray) {
    if (!titleArray || titleArray.length === 0) {
      return 'Untitled';
    }
    return titleArray[0]?.plain_text || 'Untitled';
  }

  /**
   * 截斷文字到指定長度
   * @param {string} text - 原始文字
   * @param {number} maxLength - 最大長度
   * @returns {string} 截斷後的文字
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 延遲函數（避免 rate limit）
   * @param {number} ms - 毫秒
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default NotionService;
