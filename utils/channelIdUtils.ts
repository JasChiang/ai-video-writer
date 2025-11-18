/**
 * YouTube 頻道 ID 工具函數
 * 用於驗證和解析 YouTube 頻道 ID
 */

/**
 * YouTube 頻道 ID 格式
 * - 標準格式：UC 開頭，24 個字符 (例如: UCxxxxxxxxxxxxxxxxxxxxxx)
 * - Handle 格式：@ 開頭 (例如: @username)
 * - 自訂 URL：/c/ 或 /user/ 格式
 */

export interface ChannelIdValidationResult {
  isValid: boolean;
  channelId?: string;
  error?: string;
  type?: 'channelId' | 'handle' | 'url' | 'customUrl';
}

/**
 * 驗證 YouTube 頻道 ID 格式
 * @param channelId - 頻道 ID
 * @returns 是否為有效的頻道 ID
 */
export function isValidChannelId(channelId: string): boolean {
  if (!channelId) return false;

  // 標準頻道 ID：UC 開頭，24 個字符
  const channelIdPattern = /^UC[\w-]{22}$/;
  return channelIdPattern.test(channelId);
}

/**
 * 從 YouTube URL 提取頻道 ID
 * 支持的 URL 格式：
 * - https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx
 * - https://youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx
 * - https://www.youtube.com/@username
 * - https://www.youtube.com/c/CustomName
 * - https://www.youtube.com/user/Username
 *
 * @param url - YouTube URL
 * @returns 提取的頻道 ID 或 handle
 */
export function extractChannelIdFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    // 移除空白字符
    url = url.trim();

    // 如果已經是純頻道 ID，直接返回
    if (isValidChannelId(url)) {
      return url;
    }

    // 如果是 handle 格式 (@username)，直接返回
    if (url.startsWith('@')) {
      return url;
    }

    // 嘗試解析 URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (e) {
      // 如果不是完整 URL，嘗試添加 https://www.youtube.com
      try {
        urlObj = new URL(`https://www.youtube.com${url.startsWith('/') ? '' : '/'}${url}`);
      } catch (e2) {
        return null;
      }
    }

    // 檢查是否為 YouTube 域名
    if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
      return null;
    }

    const pathname = urlObj.pathname;

    // 提取 /channel/UCxxxxxxxxxxxxxxxxxxxxxx 格式
    const channelMatch = pathname.match(/\/channel\/(UC[\w-]{22})/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // 提取 /@username 格式
    const handleMatch = pathname.match(/\/@([\w-]+)/);
    if (handleMatch) {
      return `@${handleMatch[1]}`;
    }

    // 提取 /c/CustomName 格式
    const customMatch = pathname.match(/\/c\/([\w-]+)/);
    if (customMatch) {
      return `/c/${customMatch[1]}`;
    }

    // 提取 /user/Username 格式
    const userMatch = pathname.match(/\/user\/([\w-]+)/);
    if (userMatch) {
      return `/user/${userMatch[1]}`;
    }

    return null;
  } catch (error) {
    console.error('解析頻道 ID 時出錯:', error);
    return null;
  }
}

/**
 * 驗證並解析頻道 ID 或 URL
 * @param input - 用戶輸入的頻道 ID 或 URL
 * @returns 驗證結果
 */
export function validateAndParseChannelId(input: string): ChannelIdValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      error: '請輸入頻道 ID 或 URL',
    };
  }

  const trimmedInput = input.trim();

  // 情況 1: 標準頻道 ID
  if (isValidChannelId(trimmedInput)) {
    return {
      isValid: true,
      channelId: trimmedInput,
      type: 'channelId',
    };
  }

  // 情況 2: Handle 格式 (@username)
  if (trimmedInput.startsWith('@')) {
    return {
      isValid: true,
      channelId: trimmedInput,
      type: 'handle',
    };
  }

  // 情況 3: 嘗試從 URL 提取
  const extracted = extractChannelIdFromUrl(trimmedInput);
  if (extracted) {
    if (isValidChannelId(extracted)) {
      return {
        isValid: true,
        channelId: extracted,
        type: 'url',
      };
    } else {
      return {
        isValid: true,
        channelId: extracted,
        type: 'customUrl',
      };
    }
  }

  // 情況 4: 可能是自訂 URL
  if (trimmedInput.includes('/c/') || trimmedInput.includes('/user/')) {
    return {
      isValid: true,
      channelId: trimmedInput,
      type: 'customUrl',
    };
  }

  return {
    isValid: false,
    error: '無效的頻道 ID 或 URL 格式',
  };
}

/**
 * 透過 YouTube Data API 驗證頻道是否存在並獲取基本資訊
 * @param channelIdOrHandle - 頻道 ID 或 handle
 * @param accessToken - YouTube OAuth access token
 * @returns 頻道資訊
 */
export async function fetchChannelInfo(
  channelIdOrHandle: string,
  accessToken: string
): Promise<{
  success: boolean;
  channelId?: string;
  title?: string;
  customUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  error?: string;
}> {
  try {
    let apiUrl: string;

    // 根據不同格式構建 API URL
    if (isValidChannelId(channelIdOrHandle)) {
      // 標準頻道 ID
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdOrHandle}`;
    } else if (channelIdOrHandle.startsWith('@')) {
      // Handle 格式
      const handle = channelIdOrHandle.substring(1);
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle}`;
    } else {
      // 自訂 URL 格式，需要先轉換
      return {
        success: false,
        error: '暫不支持此 URL 格式，請使用標準頻道 ID 或 @handle',
      };
    }

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`YouTube API 錯誤: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return {
        success: false,
        error: '找不到該頻道',
      };
    }

    const channel = data.items[0];
    return {
      success: true,
      channelId: channel.id,
      title: channel.snippet?.title,
      customUrl: channel.snippet?.customUrl,
      subscriberCount: channel.statistics?.subscriberCount,
      videoCount: channel.statistics?.videoCount,
    };
  } catch (error: any) {
    console.error('獲取頻道資訊失敗:', error);
    return {
      success: false,
      error: error.message || '獲取頻道資訊失敗',
    };
  }
}

/**
 * 格式化訂閱人數顯示
 * @param count - 訂閱人數
 * @returns 格式化後的字符串
 */
export function formatSubscriberCount(count: string | number): string {
  const num = typeof count === 'string' ? parseInt(count, 10) : count;

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }

  return num.toLocaleString();
}
