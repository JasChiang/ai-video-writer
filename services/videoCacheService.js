/**
 * 影片快取服務
 * 功能：將頻道所有影片的 videoId 和 title 快取到 GitHub Gist
 */

import { google } from 'googleapis';
import { recordQuota as recordQuotaServer } from './quotaTracker.js';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const YOUTUBE_QUOTA_COST = {
  channelsList: 1,
  playlistItemsList: 3, // snippet + status
  videosListSnippet: 2, // snippet part
  videosListStatistics: 2, // statistics part
};

// Gist 檔案名稱（可透過環境變數設定）
const GIST_FILENAME = process.env.GITHUB_GIST_FILENAME || 'youtube-videos-cache.json';

/**
 * 清理文字內容，移除可能造成 JSON 問題的字元
 * @param {string} text - 原始文字
 * @returns {string} 清理後的文字
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // 移除控制字元（保留換行、回車、Tab）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // 正規化空白字元
    .replace(/\s+/g, ' ')
    // 移除前後空白
    .trim();
}

/**
 * 從 YouTube 抓取所有影片的詳細資訊（含統計數據）
 * @param {string} accessToken - YouTube OAuth access token
 * @param {string} channelId - 頻道 ID
 * @returns {Promise<Array>} 影片列表 [{videoId, title, tags, categoryId, viewCount, likeCount, commentCount, publishedAt, thumbnail, privacyStatus}]
 */
export async function fetchAllVideoTitles(accessToken, channelId) {
  try {
    console.log('[VideoCache] ========================================');
    console.log('[VideoCache] 🚀 開始抓取影片快取 (使用 search.list 策略)');
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 頻道 ID: ${channelId}`);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // 步驟 1: 使用 search.list 獲取所有影片的基本資訊
    console.log('[VideoCache] 📹 步驟 1: 開始使用 search.list 抓取所有影片...');
    const videoBasicInfo = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[VideoCache] 📄 正在獲取第 ${pageCount} 頁... (配額成本: 100)`);

      const response = await youtube.search.list({
        part: 'snippet',
        forMine: true,
        type: 'video',
        order: 'date', // 按日期排序
        maxResults: 50,
        pageToken: pageToken,
      });
      recordQuotaServer('youtube.search.list', 100, {
        part: 'snippet',
        page: pageCount,
        context: 'videoCache:fetchAllVideoTitles',
        caller: 'videoCacheService.fetchAllVideoTitles',
      });

      const items = response.data.items || [];

      for (const item of items) {
        // 確保影片屬於指定的頻道 ID，避免多頻道帳號的問題
        // 同時檢查 item.id 和 item.id.videoId 是否存在
        if (item && item.id && item.id.videoId && item.snippet && item.snippet.channelId === channelId) {
            videoBasicInfo.push({
              videoId: item.id.videoId,
              title: sanitizeText(item.snippet.title),
              publishedAt: item.snippet.publishedAt,
              thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
              // 注意：search.list 的 snippet 不包含 tags 和 categoryId
              // 這些資訊將在步驟 2 透過 videos.list 獲取
            });
        }
      }

      console.log(`[VideoCache] 📊 目前已獲取: ${videoBasicInfo.length} 支影片`);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[VideoCache] ✅ 步驟 1 完成！總共 ${videoBasicInfo.length} 支影片`);

    // 步驟 2: 批次獲取統計資訊（statistics）
    console.log('[VideoCache] 📊 步驟 2: 批次獲取統計資訊 (statistics)...');
    const videos = [];
    const batchSize = 50; // YouTube API 限制每次最多 50 個
    const totalBatches = Math.ceil(videoBasicInfo.length / batchSize);

    for (let i = 0; i < videoBasicInfo.length; i += batchSize) {
      const batch = videoBasicInfo.slice(i, i + batchSize);
      const videoIds = batch.map(v => v.videoId).join(',');
      const currentBatch = Math.floor(i / batchSize) + 1;

      console.log(`[VideoCache] 📦 正在處理批次 ${currentBatch}/${totalBatches} (${batch.length} 支影片)...`);

      const statsResponse = await youtube.videos.list({
        part: 'statistics,status,snippet', // 同時獲取 status 和 snippet (包含 tags, categoryId)
        id: videoIds,
        maxResults: 50,
      });

      // snippet: 2, statistics: 2, status: 2
      const quotaCost = 2 + 2 + 2;
      recordQuotaServer('youtube.videos.list', quotaCost, {
        part: 'statistics,status,snippet',
        batch: currentBatch,
        videoCount: batch.length,
        context: 'videoCache:fetchAllVideoTitles',
        caller: 'videoCacheService.fetchAllVideoTitles',
      });

      const statsItems = statsResponse.data.items || [];

      // 合併基本資訊和統計資訊
      for (const basicInfo of batch) {
        const statsItem = statsItems.find(item => item.id === basicInfo.videoId);

        if (statsItem) {
          videos.push({
            ...basicInfo,
            viewCount: parseInt(statsItem.statistics?.viewCount || '0'),
            likeCount: parseInt(statsItem.statistics?.likeCount || '0'),
            commentCount: parseInt(statsItem.statistics?.commentCount || '0'),
            privacyStatus: statsItem.status?.privacyStatus || 'unknown',
            // 從 videos.list 的 snippet 獲取 tags 和 categoryId
            tags: (statsItem.snippet?.tags || []).map(tag => sanitizeText(tag)),
            categoryId: statsItem.snippet?.categoryId || '',
          });
        } else {
          // 如果找不到統計資訊，使用基本資訊並給予預設值
          console.warn(`[VideoCache] ⚠️  找不到影片統計資訊: ${basicInfo.videoId}`);
          videos.push({
            ...basicInfo,
            viewCount: 0,
            likeCount: 0,
            commentCount: 0,
            privacyStatus: 'unknown',
            tags: [],
            categoryId: '',
          });
        }
      }
      console.log(`[VideoCache] ✅ 批次 ${currentBatch} 完成，已處理 ${videos.length}/${videoBasicInfo.length} 支影片`);
    }

    // 步驟 3: 去重（search.list 理論上不會重複，但作為保險措施）
    console.log('[VideoCache] 🔄 步驟 3: 檢查並移除重複影片...');
    const videoMap = new Map();
    videos.forEach(video => videoMap.set(video.videoId, video));
    const uniqueVideos = Array.from(videoMap.values());

    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] ✅ 抓取完成！總共 ${uniqueVideos.length} 支影片`);
    console.log('[VideoCache] ========================================');

    return uniqueVideos;
  } catch (error) {
    console.error('[VideoCache] 錯誤:', error.message);
    throw error;
  }
}

/**
 * 取得正確的 GitHub Authorization header
 * @param {string} token - GitHub token
 * @returns {string} Authorization header 值
 */
function getGitHubAuthHeader(token) {
  // GitHub 支援兩種認證格式：
  // 1. Classic PAT (ghp_*): 同時支援 "token xxx" 和 "Bearer xxx"
  // 2. Fine-grained PAT (github_pat_*): 只支援 "Bearer xxx"
  // 3. GitHub Actions token (ghs_*): 只支援 "Bearer xxx"

  // 現在 GitHub 建議統一使用 Bearer 格式（向後兼容 classic PAT）
  // 參考: https://docs.github.com/en/rest/overview/authenticating-to-the-rest-api
  return `Bearer ${token}`;
}

/**
 * 上傳快取到 GitHub Gist
 * @param {Array} videos - 影片列表
 * @param {string} gistToken - GitHub Personal Access Token
 * @param {string} gistId - Gist ID（可選，如果提供則更新現有 Gist）
 * @returns {Promise<Object>} Gist 資訊 {id, url}
 */
export async function uploadToGist(videos, gistToken, gistId = null) {
  try {
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 📤 ${gistId ? '更新' : '建立'} Gist 快取`);
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 影片數量: ${videos.length}`);
    console.log(`[VideoCache] Gist ID: ${gistId || '(首次建立)'}`);

    const gistContent = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      totalVideos: videos.length,
      videos: videos,
    };

    // 先序列化 JSON 內容
    let jsonContent;
    try {
      jsonContent = JSON.stringify(gistContent, null, 2);
    } catch (stringifyError) {
      console.error('[VideoCache] ❌ JSON 序列化失敗:', stringifyError.message);
      throw new Error(`無法將影片資料轉換為 JSON: ${stringifyError.message}`);
    }

    // 驗證 JSON 是否可以正確解析
    try {
      JSON.parse(jsonContent);
      console.log('[VideoCache] ✅ JSON 驗證通過');
    } catch (validateError) {
      console.error('[VideoCache] ❌ JSON 驗證失敗:', validateError.message);
      console.error('[VideoCache] 內容長度:', jsonContent.length);
      throw new Error(`生成的 JSON 無法正確解析: ${validateError.message}`);
    }

    const gistData = {
      description: `YouTube 頻道影片快取 - ${videos.length} 支影片 - 更新於 ${new Date().toLocaleString('zh-TW')}`,
      public: false, // 私人 Gist
      files: {
        [GIST_FILENAME]: {
          content: jsonContent,
        },
      },
    };

    const url = gistId
      ? `https://api.github.com/gists/${gistId}` // 更新現有 Gist
      : 'https://api.github.com/gists'; // 建立新 Gist

    const method = gistId ? 'PATCH' : 'POST';

    console.log(`[VideoCache] 🌐 正在${gistId ? '更新' : '建立'} Gist...`);

    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': getGitHubAuthHeader(gistToken),
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gistData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gist ${gistId ? '更新' : '建立'}失敗: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] ✅ Gist ${gistId ? '更新' : '建立'}成功！`);
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 🆔 Gist ID: ${result.id}`);
    console.log(`[VideoCache] 🔗 Gist URL: ${result.html_url}`);
    console.log(`[VideoCache] 📄 檔案名稱: ${GIST_FILENAME}`);
    console.log(`[VideoCache] 📄 Raw URL: ${result.files[GIST_FILENAME].raw_url}`);

    return {
      id: result.id,
      url: result.html_url,
      rawUrl: result.files[GIST_FILENAME].raw_url,
      filename: GIST_FILENAME,
    };
  } catch (error) {
    console.error('[VideoCache] Gist 上傳錯誤:', error.message);
    throw error;
  }
}

/**
 * 從 Gist 載入快取
 * @param {string} gistId - Gist ID
 * @param {string} gistToken - GitHub Personal Access Token（可選，私人 Gist 需要）
 * @returns {Promise<Object>} 快取內容
 */
export async function loadFromGist(gistId, gistToken = null) {
  try {
    console.log('[VideoCache] ========================================');
    console.log('[VideoCache] 📥 從 Gist 載入快取');
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 🆔 Gist ID: ${gistId}`);
    console.log(`[VideoCache] 🔑 使用 Token: ${gistToken ? '是' : '否'}`);

    // 添加時間戳避免 GitHub API 快取
    const timestamp = Date.now();
    const url = `https://api.github.com/gists/${gistId}?t=${timestamp}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };

    if (gistToken) {
      headers['Authorization'] = getGitHubAuthHeader(gistToken);
    }

    console.log('[VideoCache] 🌐 正在從 GitHub 載入...');
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Gist 載入失敗: ${response.status}`);
    }

    const result = await response.json();

    // 檢查檔案是否存在
    if (!result.files[GIST_FILENAME]) {
      throw new Error(`Gist 中找不到檔案: ${GIST_FILENAME}`);
    }

    // 使用 raw_url 獲取完整內容（避免大檔案被截斷）
    const rawUrl = result.files[GIST_FILENAME].raw_url;
    const isTruncated = result.files[GIST_FILENAME].truncated;

    if (isTruncated) {
      console.log('[VideoCache] ⚠️  檔案過大，使用 raw_url 獲取完整內容...');
    }

    console.log(`[VideoCache] 📥 正在下載完整內容... (${isTruncated ? 'truncated' : 'normal'})`);

    // 準備 raw_url 的 headers（私人 Gist 需要 token）
    const rawHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };

    if (gistToken) {
      rawHeaders['Authorization'] = getGitHubAuthHeader(gistToken);
    }

    const rawResponse = await fetch(rawUrl, { headers: rawHeaders });

    if (!rawResponse.ok) {
      throw new Error(`下載 raw 內容失敗: ${rawResponse.status}`);
    }

    const fileContent = await rawResponse.text();

    let cache;
    try {
      cache = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('[VideoCache] ========================================');
      console.error('[VideoCache] ❌ JSON 解析錯誤');
      console.error('[VideoCache] ========================================');
      console.error(`[VideoCache] 錯誤訊息: ${parseError.message}`);
      console.error(`[VideoCache] Gist ID: ${gistId}`);
      console.error(`[VideoCache] 檔案名稱: ${GIST_FILENAME}`);
      console.error(`[VideoCache] 內容長度: ${fileContent.length} 字元`);
      console.error('[VideoCache] ========================================');
      console.error('[VideoCache] 💡 可能的解決方案：');
      console.error('[VideoCache] 1. Gist 快取已損壞，需要重新生成');
      console.error('[VideoCache] 2. 執行以下指令重新生成快取：');
      console.error('[VideoCache]    npm run update-cache');
      console.error('[VideoCache] 3. 或檢查 Gist 內容是否手動修改過');
      console.error('[VideoCache] ========================================');

      throw new Error(`JSON 解析失敗: ${parseError.message}。請重新生成快取。`);
    }

    console.log('[VideoCache] ========================================');
    console.log('[VideoCache] ✅ 載入成功！');
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 📄 檔案名稱: ${GIST_FILENAME}`);
    console.log(`[VideoCache] 📊 總影片數: ${cache.totalVideos}`);
    console.log(`[VideoCache] 📅 快取更新時間: ${cache.updatedAt}`);
    console.log(`[VideoCache] 📦 快取版本: ${cache.version}`);

    return cache;
  } catch (error) {
    console.error('[VideoCache] Gist 載入錯誤:', error.message);
    throw error;
  }
}

/**
 * 從 Gist 快取中搜尋影片
 * @param {string} gistId - Gist ID
 * @param {string} query - 搜尋關鍵字
 * @param {number} maxResults - 最大結果數量
 * @param {string} gistToken - GitHub Personal Access Token（可選，私人 Gist 需要）
 * @returns {Promise<Array>} 符合條件的影片列表
 */
export async function searchVideosFromCache(gistId, query, maxResults = 10, gistToken = null) {
  try {
    console.log('[VideoCache] ========================================');
    console.log('[VideoCache] 🔍 從快取搜尋影片');
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 🔑 關鍵字: ${query}`);
    console.log(`[VideoCache] 📊 最大結果數: ${maxResults}`);

    // 載入快取
    const cache = await loadFromGist(gistId, gistToken);

    // 如果沒有搜尋關鍵字，返回前 N 筆
    if (!query || query.trim() === '') {
      console.log('[VideoCache] ℹ️ 無搜尋關鍵字，返回前 ' + maxResults + ' 筆');
      const results = cache.videos.slice(0, maxResults);
      console.log(`[VideoCache] ✅ 返回 ${results.length} 筆結果\n`);
      return results;
    }

    // 搜尋關鍵字（不區分大小寫）
    const normalizedQuery = query.trim().toLowerCase();
    const matchedVideos = cache.videos.filter(video => {
      const title = (video.title || '').toLowerCase();
      return title.includes(normalizedQuery);
    });

    // 限制結果數量
    const results = matchedVideos.slice(0, maxResults);

    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] ✅ 搜尋完成`);
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 📊 符合條件: ${matchedVideos.length} 筆`);
    console.log(`[VideoCache] 📤 返回結果: ${results.length} 筆`);
    console.log('[VideoCache] ========================================\n');

    return results;
  } catch (error) {
    console.error('[VideoCache] 搜尋錯誤:', error.message);
    throw error;
  }
}
