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
    console.log('[VideoCache] 🚀 開始抓取影片快取');
    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] 頻道 ID: ${channelId}`);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // 步驟 1: 獲取上傳播放清單 ID
    console.log('[VideoCache] 📋 步驟 1: 獲取上傳播放清單 ID...');
    const channelResponse = await youtube.channels.list({
      part: 'contentDetails',
      id: channelId,
    });
    recordQuotaServer('youtube.channels.list', YOUTUBE_QUOTA_COST.channelsList, {
      part: 'contentDetails',
      context: 'videoCache:fetchAllVideoTitles',
      caller: 'videoCacheService.fetchAllVideoTitles',
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      throw new Error('找不到頻道資訊');
    }

    const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
    console.log(`[VideoCache] ✅ 上傳播放清單 ID: ${uploadsPlaylistId}`);

    // 步驟 2: 獲取所有影片 ID（使用 playlistItems.list）
    console.log('[VideoCache] 📹 步驟 2: 開始抓取所有影片 ID...');
    const videoBasicInfo = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[VideoCache] 📄 正在獲取第 ${pageCount} 頁...`);

      const response = await youtube.playlistItems.list({
        part: 'snippet,status',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken,
      });
      recordQuotaServer('youtube.playlistItems.list', YOUTUBE_QUOTA_COST.playlistItemsList, {
        part: 'snippet,status',
        page: pageCount,
        context: 'videoCache:fetchAllVideoTitles',
        caller: 'videoCacheService.fetchAllVideoTitles',
      });

      const items = response.data.items || [];

      for (const item of items) {
        videoBasicInfo.push({
          videoId: item.snippet.resourceId.videoId,
          publishedAt: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          privacyStatus: item.status?.privacyStatus || 'unknown',
        });
      }

      console.log(`[VideoCache] 📊 目前已獲取: ${videoBasicInfo.length} 支影片 ID`);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[VideoCache] ✅ 步驟 2 完成！總共 ${videoBasicInfo.length} 支影片`);

    // 步驟 3: 批次獲取詳細資訊（snippet + statistics）
    console.log('[VideoCache] 📊 步驟 3: 批次獲取詳細資訊（tags, categoryId, statistics）...');
    const videos = [];
    const batchSize = 50; // YouTube API 限制每次最多 50 個
    const totalBatches = Math.ceil(videoBasicInfo.length / batchSize);

    for (let i = 0; i < videoBasicInfo.length; i += batchSize) {
      const batch = videoBasicInfo.slice(i, i + batchSize);
      const videoIds = batch.map(v => v.videoId).join(',');
      const currentBatch = Math.floor(i / batchSize) + 1;

      console.log(`[VideoCache] 📦 正在處理批次 ${currentBatch}/${totalBatches} (${batch.length} 支影片)...`);

      const detailsResponse = await youtube.videos.list({
        part: 'snippet,statistics',
        id: videoIds,
        maxResults: 50,
      });

      // 記錄配額
      const quotaCost = YOUTUBE_QUOTA_COST.videosListSnippet + YOUTUBE_QUOTA_COST.videosListStatistics + 1; // 1 for base cost
      recordQuotaServer('youtube.videos.list', quotaCost, {
        part: 'snippet,statistics',
        batch: currentBatch,
        videoCount: batch.length,
        context: 'videoCache:fetchAllVideoTitles',
        caller: 'videoCacheService.fetchAllVideoTitles',
      });

      const detailItems = detailsResponse.data.items || [];

      // 合併基本資訊和詳細資訊
      for (const basicInfo of batch) {
        const detailItem = detailItems.find(item => item.id === basicInfo.videoId);

        if (detailItem) {
          videos.push({
            videoId: basicInfo.videoId,
            title: sanitizeText(detailItem.snippet.title),
            tags: (detailItem.snippet.tags || []).map(tag => sanitizeText(tag)),
            categoryId: detailItem.snippet.categoryId || '',
            viewCount: parseInt(detailItem.statistics.viewCount || '0'),
            likeCount: parseInt(detailItem.statistics.likeCount || '0'),
            commentCount: parseInt(detailItem.statistics.commentCount || '0'),
            publishedAt: basicInfo.publishedAt,
            thumbnail: basicInfo.thumbnail,
            privacyStatus: basicInfo.privacyStatus,
          });
        } else {
          // 如果找不到詳細資訊，使用基本資訊
          console.warn(`[VideoCache] ⚠️  找不到影片詳細資訊: ${basicInfo.videoId}`);
          videos.push({
            videoId: basicInfo.videoId,
            title: '(無法取得標題)',
            tags: [],
            categoryId: '',
            viewCount: 0,
            likeCount: 0,
            commentCount: 0,
            publishedAt: basicInfo.publishedAt,
            thumbnail: basicInfo.thumbnail,
            privacyStatus: basicInfo.privacyStatus,
          });
        }
      }

      console.log(`[VideoCache] ✅ 批次 ${currentBatch} 完成，已處理 ${videos.length}/${videoBasicInfo.length} 支影片`);
    }

    // 步驟 4: 去重（確保每個 videoId 只出現一次）
    console.log('[VideoCache] 🔄 步驟 4: 檢查並移除重複影片...');

    const videoMap = new Map();
    const duplicates = [];

    for (const video of videos) {
      if (videoMap.has(video.videoId)) {
        duplicates.push({
          videoId: video.videoId,
          title: video.title,
          publishedAt: video.publishedAt
        });
      } else {
        videoMap.set(video.videoId, video);
      }
    }

    const uniqueVideos = Array.from(videoMap.values());

    if (duplicates.length > 0) {
      console.log(`[VideoCache] ⚠️  發現 ${duplicates.length} 支重複影片，已移除:`);
      console.table(duplicates);
    }

    console.log('[VideoCache] ========================================');
    console.log(`[VideoCache] ✅ 抓取完成！總共 ${uniqueVideos.length} 支影片（去重前: ${videos.length}）`);
    console.log('[VideoCache] ========================================');

    return uniqueVideos;
  } catch (error) {
    console.error('[VideoCache] 錯誤:', error.message);
    throw error;
  }
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
        'Authorization': `token ${gistToken}`,
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
      headers['Authorization'] = `token ${gistToken}`;
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
      rawHeaders['Authorization'] = `token ${gistToken}`;
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
