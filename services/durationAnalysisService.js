/**
 * 影片時長分析服務
 * 提供按時長區間分組的數據分析功能
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
};

// 時長區間定義（以秒為單位）
const DURATION_BUCKETS = [
  { id: 'shorts', label: '0-1 分鐘 (Shorts)', min: 0, max: 60 },
  { id: 'short', label: '1-5 分鐘', min: 60, max: 300 },
  { id: 'medium', label: '5-10 分鐘', min: 300, max: 600 },
  { id: 'long', label: '10-20 分鐘', min: 600, max: 1200 },
  { id: 'veryLong', label: '20+ 分鐘', min: 1200, max: Infinity },
];

/**
 * 解析 ISO 8601 時長格式
 * @param {string} duration - ISO 8601 格式時長（例如：PT1M30S）
 * @returns {number} 總秒數
 */
function parseISO8601Duration(duration) {
  if (!duration) return 0;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * 根據時長獲取所屬區間
 * @param {number} durationSeconds - 時長（秒）
 * @returns {object|null} 時長區間對象
 */
function getDurationBucket(durationSeconds) {
  for (const bucket of DURATION_BUCKETS) {
    if (durationSeconds >= bucket.min && durationSeconds < bucket.max) {
      return bucket;
    }
  }
  return null;
}

/**
 * 從 Gist 快取獲取影片並附加時長信息
 * @param {Object} youtube - YouTube API 客戶端
 * @returns {Promise<Array>} 影片列表（包含時長）
 */
async function getVideosWithDurationFromCache(youtube) {
  const GIST_ID = process.env.GITHUB_GIST_ID;
  const GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;

  if (!GIST_ID) {
    console.log('[DurationAnalysis] ⚠️ 未設定 GITHUB_GIST_ID，無法使用快取');
    return null;
  }

  try {
    console.log('[DurationAnalysis] 📥 從 Gist 快取載入影片列表...');
    const cache = await loadFromGist(GIST_ID, GIST_TOKEN);

    if (!cache || !cache.videos || cache.videos.length === 0) {
      console.log('[DurationAnalysis] ⚠️ Gist 快取為空');
      return null;
    }

    console.log(`[DurationAnalysis] ✅ 從快取載入 ${cache.videos.length} 支影片`);

    // 檢查快取中是否已包含時長信息
    const firstVideo = cache.videos[0];
    if (firstVideo && firstVideo.durationSeconds !== undefined) {
      console.log('[DurationAnalysis] ✅ 快取中已包含時長信息');
      return cache.videos;
    }

    // 如果快取中沒有時長信息，需要從 API 獲取
    console.log('[DurationAnalysis] ⚠️ 快取中沒有時長信息，從 API 獲取...');
    const videoIds = cache.videos.map(v => v.videoId);
    const videosWithDuration = await getVideosDuration(youtube, videoIds);

    // 合併時長信息到快取的影片數據
    const mergedVideos = cache.videos.map(video => {
      const durationInfo = videosWithDuration.find(v => v.videoId === video.videoId);
      return {
        ...video,
        durationSeconds: durationInfo?.durationSeconds || 0,
        duration: durationInfo?.duration || 'PT0S',
      };
    });

    return mergedVideos;
  } catch (error) {
    console.error('[DurationAnalysis] ⚠️ 從 Gist 快取載入失敗:', error.message);
    return null;
  }
}

/**
 * 獲取影片時長信息
 * @param {Object} youtube - YouTube API 客戶端
 * @param {Array} videoIds - 影片 ID 列表
 * @returns {Promise<Array>} 影片時長列表
 */
async function getVideosDuration(youtube, videoIds) {
  if (!videoIds || videoIds.length === 0) {
    return [];
  }

  const videosWithDuration = [];
  const chunkSize = 50; // YouTube API 每次最多查詢 50 支影片

  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize);

    const response = await youtube.videos.list({
      part: 'contentDetails',
      id: chunk.join(','),
    });

    recordQuotaServer('youtube.videos.list', YOUTUBE_QUOTA_COST.videosList, {
      part: 'contentDetails',
      context: 'durationAnalysis:getVideosDuration',
      videoCount: chunk.length,
    });

    const items = response.data.items || [];
    for (const item of items) {
      const duration = item.contentDetails?.duration || 'PT0S';
      const durationSeconds = parseISO8601Duration(duration);

      videosWithDuration.push({
        videoId: item.id,
        duration,
        durationSeconds,
      });
    }
  }

  return videosWithDuration;
}

/**
 * 獲取所有影片並附加時長信息
 * @param {Object} youtube - YouTube API 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {boolean} isOwnChannel - 是否為自己的頻道
 * @returns {Promise<Array>} 影片列表（包含時長）
 */
async function getAllVideosWithDuration(youtube, channelId, isOwnChannel = true) {
  // 如果是自己的頻道，優先從快取獲取
  if (isOwnChannel) {
    const cachedVideos = await getVideosWithDurationFromCache(youtube);
    if (cachedVideos && cachedVideos.length > 0) {
      return cachedVideos;
    }
  }

  // 獲取頻道的上傳播放清單
  const channelResponse = await youtube.channels.list({
    part: 'contentDetails',
    id: channelId,
  });

  recordQuotaServer('youtube.channels.list', YOUTUBE_QUOTA_COST.channelsList, {
    part: 'contentDetails',
    context: 'durationAnalysis:getAllVideosWithDuration',
  });

  if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
    throw new Error('找不到頻道資訊');
  }

  const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

  // 獲取播放清單中的所有影片
  const videos = [];
  let pageToken = null;
  let pageCount = 0;
  const MAX_PAGES = 100; // 最多獲取 5000 支影片

  do {
    pageCount++;
    const response = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });

    recordQuotaServer('youtube.playlistItems.list', YOUTUBE_QUOTA_COST.playlistItemsList, {
      part: 'snippet',
      page: pageCount,
    });

    const items = response.data.items || [];
    if (items.length === 0) break;

    // 批次獲取影片詳細資訊（包含時長和隱私狀態）
    const videoIds = items.map(item => item.snippet.resourceId.videoId);
    const videoDetailsResponse = await youtube.videos.list({
      part: 'snippet,status,contentDetails',
      id: videoIds.join(','),
    });

    recordQuotaServer('youtube.videos.list', YOUTUBE_QUOTA_COST.videosList * 3, {
      part: 'snippet,status,contentDetails',
      context: 'durationAnalysis:getAllVideosWithDuration',
    });

    const videoDetailsMap = new Map();
    if (videoDetailsResponse.data.items) {
      videoDetailsResponse.data.items.forEach(video => {
        videoDetailsMap.set(video.id, video);
      });
    }

    for (const item of items) {
      const videoId = item.snippet.resourceId.videoId;
      const details = videoDetailsMap.get(videoId);

      if (details) {
        const privacyStatus = details.status?.privacyStatus || 'public';

        // 如果是競爭對手頻道，只取公開影片
        if (!isOwnChannel && privacyStatus !== 'public') {
          continue;
        }

        const duration = details.contentDetails?.duration || 'PT0S';
        const durationSeconds = parseISO8601Duration(duration);

        videos.push({
          videoId,
          title: details.snippet?.title || '',
          publishedAt: details.snippet?.publishedAt,
          privacyStatus,
          duration,
          durationSeconds,
        });
      }
    }

    pageToken = response.data.nextPageToken;

    if (pageCount >= MAX_PAGES) {
      console.log(`[DurationAnalysis] ⚠️ 已達最大頁數限制 (${MAX_PAGES} 頁)`);
      break;
    }
  } while (pageToken);

  console.log(`[DurationAnalysis] ✅ 共獲取 ${videos.length} 支影片（包含時長信息）`);
  return videos;
}

/**
 * 按時長區間分組影片並獲取數據
 * @param {string} accessToken - YouTube OAuth access token
 * @param {string} channelId - 頻道 ID
 * @param {Array} dateRanges - 日期範圍列表
 * @param {boolean} isOwnChannel - 是否為自己的頻道
 * @returns {Promise<Object>} 分析結果
 */
export async function analyzeDurationPerformance(accessToken, channelId, dateRanges, isOwnChannel = true) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

    console.log('[DurationAnalysis] 📊 開始分析影片時長表現...');

    // 獲取所有影片及其時長
    const videos = await getAllVideosWithDuration(youtube, channelId, isOwnChannel);

    // 按時長區間分組
    const bucketGroups = DURATION_BUCKETS.map(bucket => ({
      ...bucket,
      videos: [],
      videoIds: [],
    }));

    for (const video of videos) {
      const bucket = getDurationBucket(video.durationSeconds);
      if (bucket) {
        const group = bucketGroups.find(g => g.id === bucket.id);
        if (group) {
          group.videos.push(video);
          group.videoIds.push(video.videoId);
        }
      }
    }

    console.log('[DurationAnalysis] 時長區間分布:');
    bucketGroups.forEach(group => {
      console.log(`  ${group.label}: ${group.videoIds.length} 支影片`);
    });

    // 為每個時長區間和每個日期範圍獲取數據
    const results = [];

    for (const group of bucketGroups) {
      const rowData = {
        bucketId: group.id,
        label: group.label,
        videoCount: group.videoIds.length,
        dateRanges: {},
      };

      for (const dateRange of dateRanges) {
        try {
          if (group.videoIds.length === 0) {
            rowData.dateRanges[dateRange.label] = {
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
            continue;
          }

          // 調用 Analytics API 獲取數據
          const data = await getAggregatedAnalytics(
            youtubeAnalytics,
            channelId,
            group.videoIds,
            dateRange.startDate,
            dateRange.endDate
          );

          rowData.dateRanges[dateRange.label] = data;
        } catch (error) {
          console.error(`[DurationAnalysis] 獲取數據失敗 (${group.label}, ${dateRange.label}):`, error.message);
          rowData.dateRanges[dateRange.label] = {
            error: error.message,
          };
        }
      }

      results.push(rowData);
    }

    return {
      rows: results,
      columns: dateRanges.map(dr => dr.label),
      summary: {
        totalVideos: videos.length,
        buckets: bucketGroups.map(g => ({
          label: g.label,
          videoCount: g.videoIds.length,
        })),
      },
    };
  } catch (error) {
    console.error('[DurationAnalysis] 錯誤:', error.message);
    throw error;
  }
}

/**
 * 獲取指定日期範圍的聚合數據
 */
async function getAggregatedAnalytics(youtubeAnalytics, channelId, videoIds, startDate, endDate) {
  if (videoIds.length === 0) {
    return {
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
  }

  const MAX_ANALYTICS_VIDEO_FILTER = 200;
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
      context: 'durationAnalysis:aggregated',
      filterVideos: chunk.length,
      dateRange: `${startDate} ~ ${endDate}`,
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
    return {
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
  }

  return {
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
}
