/**
 * YouTube Analytics API Service
 * 處理影片表現分析與數據收集
 */

import { google } from 'googleapis';

/**
 * 取得頻道的所有影片分析數據
 * @param {string} accessToken - YouTube OAuth access token
 * @param {string} channelId - YouTube 頻道 ID
 * @param {number} daysThreshold - 排除多少天前的影片（預設 365 天 = 1 年）
 * @returns {Promise<Array>} 影片分析數據陣列
 */
export async function getChannelVideosAnalytics(accessToken, channelId, daysThreshold = 365) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

    // 計算日期範圍
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysThreshold);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    // 步驟 1: 獲取頻道指定時間範圍內的影片
    console.log(`[Analytics] 開始獲取頻道影片列表（近 ${daysThreshold} 天）...`);
    const recentVideos = await getAllChannelVideos(youtube, channelId, cutoffDate);
    console.log(`[Analytics] 找到 ${recentVideos.length} 支影片（近 ${daysThreshold} 天內發布）`);

    if (recentVideos.length === 0) {
      console.log('[Analytics] 沒有符合條件的影片');
      return [];
    }

    // 步驟 2: 批次獲取影片的詳細分析數據
    const analyticsData = await getVideosAnalyticsData(
      youtubeAnalytics,
      channelId,
      recentVideos,
      startDate,
      endDate
    );

    return analyticsData;
  } catch (error) {
    console.error('[Analytics] 錯誤:', error.message);
    throw error;
  }
}

/**
 * 獲取頻道指定時間範圍內的影片（使用 PlaylistItems API - 更可靠且省配額）
 * @param {Object} youtube - YouTube API 客戶端
 * @param {string} channelId - 頻道 ID
 * @param {Date} cutoffDate - 截止日期，只獲取此日期之後的影片
 * @returns {Promise<Array>} 影片列表
 */
async function getAllChannelVideos(youtube, channelId, cutoffDate) {
  console.log('[Analytics] 開始獲取頻道影片...');
  console.log(`[Analytics]   截止日期: ${cutoffDate.toLocaleDateString()}`);

  // 步驟 1: 獲取頻道的「上傳播放清單 ID」
  console.log('[Analytics]   → 步驟 1: 獲取頻道資訊...');
  const channelResponse = await youtube.channels.list({
    part: 'contentDetails',
    id: channelId,
  });

  if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
    throw new Error('找不到頻道資訊');
  }

  const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
  console.log(`[Analytics]     ✓ 上傳播放清單 ID: ${uploadsPlaylistId}`);

  // 步驟 2: 獲取播放清單中指定時間範圍的影片（分頁）
  console.log('[Analytics]   → 步驟 2: 開始分頁查詢影片...');
  const videos = [];
  let pageToken = null;
  let pageCount = 0;
  let shouldContinue = true;
  const maxPages = 200; // 安全上限

  do {
    pageCount++;
    console.log(`[Analytics]     → 正在獲取第 ${pageCount} 頁 (pageToken: ${pageToken || '首頁'})`);

    try {
      const response = await youtube.playlistItems.list({
        part: 'snippet',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken,
      });

      const items = response.data.items || [];

      if (items.length === 0) {
        console.log(`[Analytics]       ⚠ 本頁: 0 支影片`);
        break;
      }

      // 處理本頁影片，並檢查日期
      let addedCount = 0;
      let stoppedByDate = false;

      for (const item of items) {
        const publishDate = new Date(item.snippet.publishedAt);

        // 檢查是否超過截止日期
        if (publishDate < cutoffDate) {
          console.log(`[Analytics]       ⚠ 發現超過截止日期的影片 (${publishDate.toLocaleDateString()})，停止獲取`);
          shouldContinue = false;
          stoppedByDate = true;
          break;
        }

        // 在範圍內，加入列表
        videos.push({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          publishedAt: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails?.medium?.url || '',
        });
        addedCount++;
      }

      if (addedCount > 0) {
        const firstDate = new Date(items[0].snippet.publishedAt);
        const lastAddedDate = new Date(videos[videos.length - 1].publishedAt);
        console.log(`[Analytics]       ✓ 本頁: ${addedCount}/${items.length} 支影片在範圍內 (${firstDate.toLocaleDateString()} ~ ${lastAddedDate.toLocaleDateString()})`);
      }

      console.log(`[Analytics]       累計: ${videos.length} 支 | ${stoppedByDate ? '已達截止日期' : (response.data.nextPageToken ? '繼續下一頁' : '已是最後一頁')}`);

      // 如果因日期停止，不需要繼續
      if (stoppedByDate) {
        break;
      }

      pageToken = response.data.nextPageToken;

      // 安全機制
      if (pageCount >= maxPages) {
        console.log(`[Analytics]     ⚠️  已達最大頁數限制 (${maxPages} 頁)，停止查詢`);
        break;
      }

    } catch (error) {
      console.error(`[Analytics]     ❌ 第 ${pageCount} 頁查詢失敗:`, error.message);
      if (error.response?.data) {
        console.error('[Analytics]        API 錯誤詳情:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }

  } while (pageToken && shouldContinue);

  console.log(`[Analytics] ✓ 分頁查詢完成：共 ${pageCount} 頁，${videos.length} 支影片`);
  return videos;
}

/**
 * 獲取影片的分析數據（批次處理）
 */
async function getVideosAnalyticsData(youtubeAnalytics, channelId, videos, startDate, endDate) {
  const analyticsData = [];
  const videoIds = videos.map(v => v.videoId).join(',');

  // 格式化日期為 YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split('T')[0];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.log(`[Analytics] 查詢日期範圍: ${startDateStr} 到 ${endDateStr}`);

  try {
    // 查詢 1: 基本指標（觀看次數、觀看時長、互動數據）
    const basicMetrics = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: startDateStr,
      endDate: endDateStr,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained',
      dimensions: 'video',
      filters: `video==${videoIds}`,
      sort: '-views',
    });

    // 查詢 2: 流量來源數據
    const trafficSources = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: startDateStr,
      endDate: endDateStr,
      metrics: 'views',
      dimensions: 'video,insightTrafficSourceType',
      filters: `video==${videoIds}`,
    });

    // 查詢 3: 曝光與點擊數據（CTR）
    let impressionData = null;
    try {
      impressionData = await youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDateStr,
        endDate: endDateStr,
        metrics: 'cardImpressions,cardClicks,cardClickRate',
        dimensions: 'video',
        filters: `video==${videoIds}`,
      });
    } catch (error) {
      console.log('[Analytics] 曝光數據不可用（正常，部分頻道沒有此數據）');
    }

    // 整合數據
    const basicMetricsMap = new Map();
    if (basicMetrics.data.rows) {
      basicMetrics.data.rows.forEach(row => {
        const videoId = row[0];
        basicMetricsMap.set(videoId, {
          views: row[1] || 0,
          estimatedMinutesWatched: row[2] || 0,
          averageViewDuration: row[3] || 0,
          likes: row[4] || 0,
          comments: row[5] || 0,
          shares: row[6] || 0,
          subscribersGained: row[7] || 0,
        });
      });
    }

    // 整合流量來源數據
    const trafficSourceMap = new Map();
    if (trafficSources.data.rows) {
      trafficSources.data.rows.forEach(row => {
        const videoId = row[0];
        const sourceType = row[1];
        const views = row[2] || 0;

        if (!trafficSourceMap.has(videoId)) {
          trafficSourceMap.set(videoId, {
            youtubeSearch: 0,
            googleSearch: 0,
            suggested: 0,
            external: 0,
            other: 0,
          });
        }

        const sources = trafficSourceMap.get(videoId);
        switch (sourceType) {
          case 'YT_SEARCH':
            sources.youtubeSearch = views;
            break;
          case 'GOOGLE_SEARCH':
            sources.googleSearch = views;
            break;
          case 'RELATED_VIDEO':
          case 'SUGGESTED_VIDEO':
            sources.suggested = views;
            break;
          case 'EXT_URL':
            sources.external = views;
            break;
          default:
            sources.other += views;
        }
      });
    }

    // 整合曝光數據
    const impressionMap = new Map();
    if (impressionData?.data.rows) {
      impressionData.data.rows.forEach(row => {
        const videoId = row[0];
        impressionMap.set(videoId, {
          impressions: row[1] || 0,
          clicks: row[2] || 0,
          ctr: row[3] || 0,
        });
      });
    }

    // 組合所有數據
    videos.forEach(video => {
      const basic = basicMetricsMap.get(video.videoId) || {};
      const traffic = trafficSourceMap.get(video.videoId) || {
        youtubeSearch: 0,
        googleSearch: 0,
        suggested: 0,
        external: 0,
        other: 0,
      };
      const impression = impressionMap.get(video.videoId) || {
        impressions: 0,
        clicks: 0,
        ctr: 0,
      };

      const totalViews = basic.views || 0;
      const avgDuration = basic.averageViewDuration || 0;
      const estimatedMinutes = basic.estimatedMinutesWatched || 0;

      // 計算平均觀看時長百分比（需要先取得影片總長度）
      const averageViewPercentage = avgDuration > 0 ? (avgDuration / 60) * 100 : 0; // 暫時估算

      analyticsData.push({
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
        thumbnail: video.thumbnail,
        metrics: {
          views: totalViews,
          estimatedMinutesWatched: estimatedMinutes,
          averageViewDuration: avgDuration,
          averageViewPercentage: averageViewPercentage.toFixed(2),
          likes: basic.likes || 0,
          comments: basic.comments || 0,
          shares: basic.shares || 0,
          subscribersGained: basic.subscribersGained || 0,
          likeRatio: totalViews > 0 ? ((basic.likes / totalViews) * 100).toFixed(2) : 0,
        },
        trafficSources: {
          youtubeSearch: traffic.youtubeSearch,
          googleSearch: traffic.googleSearch,
          suggested: traffic.suggested,
          external: traffic.external,
          other: traffic.other,
          searchPercentage: totalViews > 0
            ? (((traffic.youtubeSearch + traffic.googleSearch) / totalViews) * 100).toFixed(2)
            : 0,
        },
        impressions: impression,
      });
    });

    console.log(`[Analytics] 成功獲取 ${analyticsData.length} 支影片的分析數據`);
    return analyticsData;
  } catch (error) {
    console.error('[Analytics] 獲取分析數據錯誤:', error.message);
    throw error;
  }
}

/**
 * 計算影片更新優先級
 * @param {Array} analyticsData - 影片分析數據
 * @returns {Array} 排序後的前 50 名建議更新影片
 */
export function calculateUpdatePriority(analyticsData) {
  const scored = analyticsData.map(video => {
    let score = 0;
    let reasons = [];

    const { metrics, trafficSources, impressions } = video;
    const views = metrics.views;
    const avgViewPercentage = parseFloat(metrics.averageViewPercentage);
    const ctr = impressions.ctr;
    const searchPercentage = parseFloat(trafficSources.searchPercentage);
    const likeRatio = parseFloat(metrics.likeRatio);

    // 規則 1: CTR 過低且有曝光（高優先）
    if (ctr < 5 && impressions.impressions > 1000) {
      score += 50;
      reasons.push(`CTR 過低 (${ctr.toFixed(2)}%)，但曝光量高 (${impressions.impressions})`);
    }

    // 規則 2: 平均觀看時長過低（高優先）
    if (avgViewPercentage < 40 && views > 100) {
      score += 40;
      reasons.push(`觀看時長過低 (${avgViewPercentage}%)，可能標題與內容不符`);
    }

    // 規則 3: 搜尋流量佔比高但 CTR 低（中優先）
    if (searchPercentage > 30 && ctr < 8) {
      score += 30;
      reasons.push(`搜尋流量佔比高 (${searchPercentage}%)，SEO 有潛力`);
    }

    // 規則 4: 讚數比例過低（低優先）
    if (likeRatio < 1 && views > 200) {
      score += 20;
      reasons.push(`讚數比例過低 (${likeRatio}%)，內容品質可能需改善`);
    }

    // 規則 5: 近期觀看次數過低（排除條件）
    if (views < 50) {
      score = 0;
      reasons = ['近期觀看次數過低，不建議更新'];
    }

    return {
      ...video,
      priorityScore: score,
      updateReasons: reasons,
    };
  });

  // 排序並取前 50 名
  const sorted = scored
    .filter(v => v.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 50);

  console.log(`[Analytics] 計算完成，找到 ${sorted.length} 支建議更新的影片`);
  return sorted;
}
