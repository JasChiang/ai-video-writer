/**
 * 頻道數據聚合服務
 * 提供關鍵字搜尋、日期範圍篩選和數據聚合功能
 */

import { google } from 'googleapis';
import { recordQuota as recordQuotaServer } from './quotaTracker.js';
import { loadFromGist } from './videoCacheService.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const YOUTUBE_QUOTA_COST = {
  channelsList: 1,
  playlistItemsList: 2,
  videosList: 2,
  analyticsReportsQuery: 1,
  searchList: 100, // YouTube Search API 成本較高
};

// 快取結構：{ key: { data, timestamp } }
const analyticsCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 分鐘快取
const MAX_ANALYTICS_VIDEO_FILTER = 200;
const DEFAULT_MAX_VIDEOS = 10000;

/**
 * 根據關鍵字過濾影片（客戶端過濾）
 * @param {Array} videos - 影片列表
 * @param {string} keyword - 關鍵字
 * @returns {Array} 符合條件的影片列表
 */
function filterVideosByKeywordClient(videos, keyword) {
  if (!keyword || keyword.trim() === '') {
    return videos;
  }

  const normalizedKeyword = keyword.toLowerCase().trim();

  return videos.filter(video => {
    if (video.title && video.title.toLowerCase().includes(normalizedKeyword)) {
      return true;
    }
    return false;
  });
}

/**
 * 從 Gist 快取獲取並過濾影片（零配額成本）
 * @param {string} keyword - 關鍵字（可為空，表示所有影片）
 * @returns {Promise<Array>} 影片列表
 */
async function getVideosFromGistCache(keyword) {
  const GIST_ID = process.env.GITHUB_GIST_ID;
  const GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;

  if (!GIST_ID) {
    console.log('[ChannelAnalytics] ⚠️ 未設定 GITHUB_GIST_ID，無法使用快取');
    return null;
  }

  try {
    console.log('[ChannelAnalytics] 📥 從 Gist 快取載入影片列表...');
    const cache = await loadFromGist(GIST_ID, GIST_TOKEN);

    if (!cache || !cache.videos || cache.videos.length === 0) {
      console.log('[ChannelAnalytics] ⚠️ Gist 快取為空');
      return null;
    }

    console.log(`[ChannelAnalytics] ✅ 從快取載入 ${cache.videos.length} 支影片`);

    // 過濾關鍵字
    const normalizedKeyword = keyword?.trim() || '';
    if (!normalizedKeyword) {
      console.log('[ChannelAnalytics] ✅ 未指定關鍵字，返回所有影片');
      return cache.videos;
    }

    const filteredVideos = filterVideosByKeywordClient(cache.videos, normalizedKeyword);
    console.log(
      `[ChannelAnalytics] ✅ 關鍵字 "${normalizedKeyword}" 過濾後: ${filteredVideos.length} 支影片`
    );

    return filteredVideos;
  } catch (error) {
    console.error('[ChannelAnalytics] ⚠️ 從 Gist 快取載入失敗:', error.message);
    return null;
  }
}

/**
 * 獲取並過濾頻道影片（優先使用 Gist 快取，零配額成本）
 * @param {Object} youtube - YouTube API 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {string} keyword - 關鍵字（可為空，表示所有影片）
 * @param {number} maxVideos - 最大影片數量
 * @returns {Promise<Array>} 影片列表
 */
async function searchChannelVideos(youtube, channelId, keyword, maxVideos = DEFAULT_MAX_VIDEOS) {
  const normalizedKeyword = keyword?.trim() || '';

  // 🚀 優先策略：從 Gist 快取獲取影片列表（零配額成本）
  console.log('[ChannelAnalytics] 🚀 優先策略：嘗試從 Gist 快取獲取影片列表...');
  const cachedVideos = await getVideosFromGistCache(normalizedKeyword);

  if (cachedVideos && cachedVideos.length > 0) {
    console.log(
      `[ChannelAnalytics] ✅ 成功從 Gist 快取獲取 ${cachedVideos.length} 支影片（零配額成本）`
    );
    return cachedVideos;
  }

  // 📌 備援策略：如果快取不可用，回退到原來的邏輯
  console.log('[ChannelAnalytics] 📌 Gist 快取不可用，回退到 YouTube API...');

  if (normalizedKeyword) {
    try {
      const searchResults = await searchVideosViaSearchApi(
        youtube,
        channelId,
        normalizedKeyword,
        maxVideos
      );

      if (searchResults.length > 0) {
        const filteredSearch = filterVideosByKeywordClient(searchResults, normalizedKeyword);
        if (filteredSearch.length > 0) {
          console.log(
            `[ChannelAnalytics] ✅ Search API 找到 ${filteredSearch.length}/${searchResults.length} 支符合 "${normalizedKeyword}" 的影片`
          );
          return filteredSearch;
        }
        console.log(
          `[ChannelAnalytics] ⚠️ Search API 返回 ${searchResults.length} 支影片，但無法匹配 "${normalizedKeyword}"，改用播放清單全量掃描`
        );
      }

      console.log(
        `[ChannelAnalytics] ⚠️ Search API 找不到符合 "${normalizedKeyword}" 的影片，改用播放清單全量掃描`
      );
    } catch (error) {
      console.warn(
        `[ChannelAnalytics] ⚠️ Search API 搜尋失敗（${error.message}），改用播放清單全量掃描`
      );
    }
  }

  // 若無關鍵字或 Search API 失敗則改為掃描全部影片
  console.log(`[ChannelAnalytics] 🔍 獲取頻道所有影片（公開/未列出/私人）...`);
  const allVideos = await getAllChannelVideos(youtube, channelId, maxVideos);

  if (!normalizedKeyword) {
    console.log(`[ChannelAnalytics] ✅ 未指定關鍵字，返回所有 ${allVideos.length} 支影片`);
    return allVideos;
  }

  const filteredVideos = filterVideosByKeywordClient(allVideos, normalizedKeyword);

  console.log(
    `[ChannelAnalytics] ✅ 關鍵字 "${normalizedKeyword}" 過濾後: ${filteredVideos.length} 支影片（總共 ${allVideos.length} 支影片）`
  );
  return filteredVideos;
}

/**
 * 透過 YouTube Search API 搜尋影片（支援私人與未列出）
 */
async function searchVideosViaSearchApi(youtube, channelId, keyword, maxVideos = DEFAULT_MAX_VIDEOS) {
  console.log(
    `[ChannelAnalytics] 🔎 使用 Search API 搜尋關鍵字 "${keyword}"（最多 ${maxVideos} 支）`
  );

  const videos = [];
  const seenVideoIds = new Set();
  let pageToken = null;
  let page = 0;

  do {
    page++;
    const searchResponse = await youtube.search.list({
      part: 'id,snippet',
      forMine: true,
      type: 'video',
      maxResults: 50,
      order: 'date',
      q: keyword,
      pageToken,
    });
    recordQuotaServer('youtube.search.list', YOUTUBE_QUOTA_COST.searchList, {
      keyword,
      page,
      context: 'channelAnalytics:search',
      caller: 'channelAnalyticsService.searchVideosViaSearchApi',
    });

    const searchItems = searchResponse.data.items || [];
    if (searchItems.length === 0) {
      break;
    }

    const videoIds = [];
    for (const item of searchItems) {
      const videoId = item.id?.videoId;
      if (!videoId || seenVideoIds.has(videoId)) {
        continue;
      }

      const snippetChannelId = item.snippet?.channelId;
      if (snippetChannelId && snippetChannelId !== channelId) {
        continue;
      }

      seenVideoIds.add(videoId);
      videoIds.push(videoId);
    }

    if (videoIds.length === 0) {
      pageToken = searchResponse.data.nextPageToken || null;
      continue;
    }

    const detailsResponse = await youtube.videos.list({
      part: 'snippet,status',
      id: videoIds.join(','),
    });
    recordQuotaServer('youtube.videos.list', YOUTUBE_QUOTA_COST.videosList * 2, {
      part: 'snippet,status',
      context: 'channelAnalytics:search:details',
      caller: 'channelAnalyticsService.searchVideosViaSearchApi',
    });

    const detailItems = detailsResponse.data.items || [];
    for (const video of detailItems) {
      videos.push({
        videoId: video.id,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        tags: video.snippet?.tags || [],
        publishedAt: video.snippet?.publishedAt,
        thumbnail: video.snippet?.thumbnails?.medium?.url || '',
        privacyStatus: video.status?.privacyStatus || 'public',
      });

      if (videos.length >= maxVideos) {
        console.log(
          `[ChannelAnalytics] 🔎 Search API 已達最大數量限制 (${maxVideos})，停止搜尋`
        );
        return videos;
      }
    }

    pageToken = searchResponse.data.nextPageToken || null;
  } while (pageToken);

  console.log(
    `[ChannelAnalytics] 🔎 Search API 搜尋完成，找到 ${videos.length} 支影片（關鍵字: "${keyword}"）`
  );
  return videos;
}

/**
 * 獲取所有頻道影片（不限日期，歷史至今，包含公開、未列出、私人影片）
 * @param {Object} youtube - YouTube API 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {number} maxVideos - 最大影片數量（防止過度請求）
 * @returns {Promise<Array>} 影片列表
 */
async function getAllChannelVideos(youtube, channelId, maxVideos = DEFAULT_MAX_VIDEOS) {
  console.log(`[ChannelAnalytics] 🎬 開始獲取頻道所有歷史影片（包含公開、未列出、私人影片，最多 ${maxVideos} 支）...`);

  // 步驟 1: 獲取頻道的「上傳播放清單 ID」
  const channelResponse = await youtube.channels.list({
    part: 'contentDetails',
    id: channelId,
  });
  recordQuotaServer('youtube.channels.list', YOUTUBE_QUOTA_COST.channelsList, {
    part: 'contentDetails',
    context: 'channelAnalytics:getAllChannelVideos',
    caller: 'channelAnalyticsService.getAllChannelVideos',
  });

  if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
    throw new Error('找不到頻道資訊');
  }

  const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
  console.log(`[ChannelAnalytics] 上傳播放清單 ID: ${uploadsPlaylistId}`);

  // 步驟 2: 獲取播放清單中的所有影片（分頁）
  const videos = [];
  let pageToken = null;
  let pageCount = 0;
  const MAX_SAFE_PAGES = 400; // 安全上限，約 20,000 支影片

  do {
    pageCount++;
    console.log(`[ChannelAnalytics] 正在獲取第 ${pageCount} 頁...`);

    const response = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: pageToken,
    });
    recordQuotaServer('youtube.playlistItems.list', YOUTUBE_QUOTA_COST.playlistItemsList, {
      part: 'snippet',
      page: pageCount,
      caller: 'channelAnalyticsService.getAllChannelVideos',
    });

    const items = response.data.items || [];

    if (items.length === 0) {
      break;
    }

    // 批次獲取影片詳細資訊（包含隱私狀態）
    const videoIds = items.map(item => item.snippet.resourceId.videoId).join(',');
    const videoDetailsResponse = await youtube.videos.list({
      part: 'snippet,status',
      id: videoIds,
    });
    recordQuotaServer('youtube.videos.list', YOUTUBE_QUOTA_COST.videosList * 2, {
      part: 'snippet,status',
      context: 'channelAnalytics:getAllChannelVideos:details',
      caller: 'channelAnalyticsService.getAllChannelVideos',
    });

    const videoDetailsMap = new Map();
    if (videoDetailsResponse.data.items) {
      videoDetailsResponse.data.items.forEach(video => {
        videoDetailsMap.set(video.id, {
          snippet: video.snippet,
          status: video.status,
        });
      });
    }

    let skippedCount = 0;
    for (const item of items) {
      const videoId = item.snippet.resourceId.videoId;
      const details = videoDetailsMap.get(videoId);
      if (details && details.snippet) {
        const privacyStatus = details.status?.privacyStatus || 'public';
        videos.push({
          videoId: videoId,
          title: details.snippet.title,
          description: details.snippet.description,
          tags: details.snippet.tags || [],
          publishedAt: details.snippet.publishedAt,
          thumbnail: details.snippet.thumbnails?.medium?.url || '',
          privacyStatus,
        });
      } else {
        skippedCount++;
      }
    }

    if (skippedCount > 0) {
      console.log(`[ChannelAnalytics] ⚠️ 跳過 ${skippedCount} 支無法讀取詳細資訊的影片（可能已刪除或存取受限）`);
    }

    console.log(`[ChannelAnalytics] 已獲取 ${videos.length} 支影片`);

    pageToken = response.data.nextPageToken;

    // 達到最大數量限制
    if (videos.length >= maxVideos) {
      console.log(`[ChannelAnalytics] 已達最大影片數量限制 (${maxVideos})`);
      break;
    }

    if (pageCount >= MAX_SAFE_PAGES) {
      console.log(`[ChannelAnalytics] ⚠️ 已達安全頁數上限 (${MAX_SAFE_PAGES} 頁)，建議縮小關鍵字或拆分查詢`);
      break;
    }

  } while (pageToken);

  console.log(`[ChannelAnalytics] ✅ 共獲取 ${videos.length} 支影片（歷史至今，含公開/未列出/私人）`);
  return videos;
}

/**
 * 獲取指定日期範圍的影片聚合數據
 * 注意：此函數只查詢指定時間段內的數據，不是影片的全部歷史數據
 * @param {Object} youtubeAnalytics - YouTube Analytics API 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {Array} videoIds - 影片 ID 列表
 * @param {string} startDate - 開始日期 (YYYY-MM-DD)
 * @param {string} endDate - 結束日期 (YYYY-MM-DD)
 * @returns {Promise<Object>} 聚合數據
 */
async function getAggregatedAnalytics(youtubeAnalytics, channelId, videoIds, startDate, endDate) {
  // 檢查快取
  const cacheKey = `${channelId}:${videoIds.join(',')}:${startDate}:${endDate}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[ChannelAnalytics] 💾 使用快取數據: ${startDate} ~ ${endDate}`);
    return cached.data;
  }

  console.log(`[ChannelAnalytics] 📊 查詢指定時間段數據: ${startDate} ~ ${endDate} (${videoIds.length} 支影片)`);

  if (videoIds.length === 0) {
    const emptyData = {
      views: 0,
      estimatedMinutesWatched: 0,
      averageViewDuration: 0,
      averageViewPercentage: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      subscribersGained: 0,
      videoCount: 0,
    };
    analyticsCache.set(cacheKey, { data: emptyData, timestamp: Date.now() });
    return emptyData;
  }

  try {
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += MAX_ANALYTICS_VIDEO_FILTER) {
      chunks.push(videoIds.slice(i, i + MAX_ANALYTICS_VIDEO_FILTER));
    }

    let totalViews = 0;
    let totalEstimatedMinutesWatched = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSubscribersGained = 0;
    let weightedDuration = 0;
    let weightedPercentage = 0;
    let hasData = false;

    for (const chunk of chunks) {
      const chunkIds = chunk.join(',');
      const chunkMetrics = await youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate,
        endDate: endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
        filters: `video==${chunkIds}`,
      });
      recordQuotaServer('youtubeAnalytics.reports.query', YOUTUBE_QUOTA_COST.analyticsReportsQuery, {
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
        context: 'channelAnalytics:aggregated',
        filterVideos: chunk.length,
        dateRange: `${startDate} ~ ${endDate}`,
        caller: 'channelAnalyticsService.getAggregatedAnalytics',
      });

      const rows = chunkMetrics.data.rows || [];
      if (rows.length === 0) {
        continue;
      }

      hasData = true;
      const views = parseInt(rows[0][0] || 0, 10);
      const estimatedMinutesWatched = parseFloat(rows[0][1] || 0);
      const avgDuration = parseFloat(rows[0][2] || 0);
      const avgPercentage = parseFloat(rows[0][3] || 0);
      const likes = parseInt(rows[0][4] || 0, 10);
      const comments = parseInt(rows[0][5] || 0, 10);
      const shares = parseInt(rows[0][6] || 0, 10);
      const subscribersGained = parseInt(rows[0][7] || 0, 10);

      totalViews += views;
      totalEstimatedMinutesWatched += estimatedMinutesWatched;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;
      totalSubscribersGained += subscribersGained;
      weightedDuration += views * avgDuration;
      weightedPercentage += views * avgPercentage;
    }

    if (!hasData) {
      const emptyData = {
        views: 0,
        estimatedMinutesWatched: 0,
        averageViewDuration: 0,
        averageViewPercentage: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        subscribersGained: 0,
        videoCount: videoIds.length,
      };
      analyticsCache.set(cacheKey, { data: emptyData, timestamp: Date.now() });
      return emptyData;
    }

    const data = {
      views: totalViews,
      estimatedMinutesWatched: totalEstimatedMinutesWatched,
      averageViewDuration: totalViews > 0 ? weightedDuration / totalViews : 0,
      averageViewPercentage: totalViews > 0 ? weightedPercentage / totalViews : 0,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      subscribersGained: totalSubscribersGained,
      videoCount: videoIds.length,
    };

    // 存入快取
    analyticsCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('[ChannelAnalytics] 查詢數據時發生錯誤:', error.message);

    // 如果是配額錯誤，拋出特定錯誤
    if (error.message && error.message.includes('quota')) {
      throw new Error('API 配額已用盡，請稍後再試');
    }

    throw error;
  }
}

/**
 * 清理過期快取
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of analyticsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      analyticsCache.delete(key);
    }
  }
}

// 定期清理快取（每 30 分鐘）
setInterval(cleanupCache, 30 * 60 * 1000);

/**
 * 獲取頻道時區
 * @param {Object} youtube - YouTube API 客戶端
 * @param {string} channelId - 頻道 ID
 * @returns {Promise<string>} 頻道時區
 */
async function getChannelTimezone(youtube, channelId) {
  try {
    const response = await youtube.channels.list({
      part: 'snippet',
      id: channelId,
    });
    recordQuotaServer('youtube.channels.list', YOUTUBE_QUOTA_COST.channelsList, {
      part: 'snippet',
      context: 'channelAnalytics:getChannelTimezone',
      caller: 'channelAnalyticsService.getChannelTimezone',
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].snippet.country || 'Unknown';
    }
    return 'Unknown';
  } catch (error) {
    console.error('[ChannelAnalytics] 獲取頻道時區失敗:', error.message);
    return 'Unknown';
  }
}

/**
 * 聚合頻道數據（支援多個關鍵字和多個日期範圍）
 * @param {string} accessToken - YouTube OAuth access token
 * @param {string} channelId - 頻道 ID
 * @param {Array} keywordGroups - 關鍵字組合列表 [{name, keyword}]
 * @param {Array} dateRanges - 日期範圍列表 [{label, startDate, endDate}]
 * @returns {Promise<Object>} 聚合結果
 */
export async function aggregateChannelData(accessToken, channelId, keywordGroups, dateRanges) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

    // 獲取頻道國家/時區資訊
    const channelCountry = await getChannelTimezone(youtube, channelId);
    console.log(`[ChannelAnalytics] 頻道國家設定: ${channelCountry}`);

    // 步驟 1: 為每個關鍵字組合搜尋影片
    console.log('[ChannelAnalytics] 步驟 1: 根據關鍵字搜尋影片...');
    const filteredVideoGroups = [];

    for (const group of keywordGroups) {
      console.log(`[ChannelAnalytics] 正在搜尋關鍵字: "${group.keyword || '(所有影片)'}"`);
      const videos = await searchChannelVideos(youtube, channelId, group.keyword);

      filteredVideoGroups.push({
        name: group.name,
        keyword: group.keyword,
        videos: videos,
        videoIds: videos.map(v => v.videoId),
      });

      console.log(`[ChannelAnalytics] ✓ 關鍵字 "${group.keyword || '(所有影片)'}": ${videos.length} 支影片`);
    }

    // 步驟 2: 為每個組合和每個日期範圍獲取數據
    console.log('[ChannelAnalytics] 步驟 2: 獲取數據...');
    const results = [];

    for (const group of filteredVideoGroups) {
      const rowData = {
        name: group.name,
        keyword: group.keyword,
        videoCount: group.videoIds.length,
        dateRanges: {},
      };

      for (const dateRange of dateRanges) {
        try {
          const data = await getAggregatedAnalytics(
            youtubeAnalytics,
            channelId,
            group.videoIds,
            dateRange.startDate,
            dateRange.endDate
          );
          rowData.dateRanges[dateRange.label] = data;
        } catch (error) {
          console.error(`[ChannelAnalytics] 獲取數據失敗 (${group.name}, ${dateRange.label}):`, error.message);
          rowData.dateRanges[dateRange.label] = {
            error: error.message,
          };
        }
      }

      results.push(rowData);
    }

    console.log('[ChannelAnalytics] 完成！');

    return {
      rows: results,
      columns: dateRanges.map(dr => dr.label),
      summary: {
        channelCountry: channelCountry,
        keywordGroups: filteredVideoGroups.map(g => ({
          name: g.name,
          keyword: g.keyword || '(所有影片)',
          videoCount: g.videoIds.length,
        })),
      },
    };
  } catch (error) {
    console.error('[ChannelAnalytics] 錯誤:', error.message);
    throw error;
  }
}

/**
 * 清除快取（用於強制刷新）
 */
export function clearAnalyticsCache() {
  const size = analyticsCache.size;
  analyticsCache.clear();
  console.log(`[ChannelAnalytics] 已清除 ${size} 筆快取`);
  return { cleared: size };
}
