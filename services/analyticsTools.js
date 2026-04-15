/**
 * Analytics Tools - 供 AI tool calling 使用的工具集
 * 定義工具 schema 並實作執行邏輯
 */

import { google } from 'googleapis';
import { searchVideosFromCache } from './videoCacheService.js';
import { recordQuota } from './quotaTracker.js';

const YOUTUBE_QUOTA_COST = { analyticsReportsQuery: 1 };

// ─────────────────────────────────────────────
// Tool Schema 定義（OpenAI function calling 格式）
// ─────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_videos_by_keyword',
      description:
        '用關鍵字從 Gist 快取搜尋符合標題的影片，返回 videoId 清單。適合用來找特定單元、系列或主題的影片。',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: '搜尋關鍵字清單，例如 ["開箱", "評測"]',
          },
          maxResults: {
            type: 'number',
            description: '最多返回幾支影片，預設 50',
          },
        },
        required: ['keywords'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_video_analytics',
      description:
        '取得指定影片在某時間範圍內的數據（觀看數、觀看時長、完播率、按讚、留言、分享、流量來源）。videoIds 最多 50 支。',
      parameters: {
        type: 'object',
        properties: {
          videoIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'YouTube 影片 ID 清單',
          },
          startDate: {
            type: 'string',
            description: '開始日期 YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            description: '結束日期 YYYY-MM-DD',
          },
        },
        required: ['videoIds', 'startDate', 'endDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_retention_curve',
      description:
        '取得單支影片的觀眾留存率曲線（每個時間進度點還有多少比例的觀眾在看），用來找出影片哪個時間點觀眾流失最多。',
      parameters: {
        type: 'object',
        properties: {
          videoId: {
            type: 'string',
            description: 'YouTube 影片 ID',
          },
          startDate: {
            type: 'string',
            description: '開始日期 YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            description: '結束日期 YYYY-MM-DD',
          },
        },
        required: ['videoId', 'startDate', 'endDate'],
      },
    },
  },
];

// ─────────────────────────────────────────────
// Tool 執行邏輯
// ─────────────────────────────────────────────

/**
 * 執行指定的 tool
 * @param {string} toolName
 * @param {object} args - tool 的參數
 * @param {object} context - { accessToken, channelId, gistId, gistToken }
 */
export async function executeTool(toolName, args, context) {
  const { accessToken, channelId, gistId, gistToken } = context;

  switch (toolName) {
    case 'search_videos_by_keyword':
      return searchVideosByKeyword(args, { gistId, gistToken });

    case 'get_video_analytics':
      return getVideoAnalytics(args, { accessToken, channelId });

    case 'get_retention_curve':
      return getRetentionCurve(args, { accessToken, channelId });

    default:
      throw new Error(`未知的 tool: ${toolName}`);
  }
}

// ─────────────────────────────────────────────
// 各 Tool 的實作
// ─────────────────────────────────────────────

async function searchVideosByKeyword({ keywords, maxResults = 50 }, { gistId, gistToken }) {
  console.log(`[Tool] search_videos_by_keyword: keywords=${keywords.join(',')}`);

  const results = [];

  for (const keyword of keywords) {
    const videos = await searchVideosFromCache(gistId, keyword, maxResults, gistToken);
    for (const v of videos) {
      if (!results.find(r => r.videoId === v.videoId)) {
        results.push({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          keyword, // 哪個關鍵字搜到的
        });
      }
    }
  }

  console.log(`[Tool] search_videos_by_keyword: 找到 ${results.length} 支影片`);
  return { videos: results, totalFound: results.length };
}

async function getVideoAnalytics({ videoIds, startDate, endDate }, { accessToken, channelId }) {
  console.log(`[Tool] get_video_analytics: ${videoIds.length} 支影片, ${startDate} ~ ${endDate}`);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

  const BATCH_SIZE = 50;
  const allResults = [];

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const videoFilter = batch.join(',');

    // 基本指標
    const basicRes = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
      dimensions: 'video',
      filters: `video==${videoFilter}`,
      sort: '-views',
    });
    recordQuota('youtubeAnalytics.reports.query', YOUTUBE_QUOTA_COST.analyticsReportsQuery, {
      context: 'analyticsTools.getVideoAnalytics.basic',
    });

    // 流量來源
    const trafficRes = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views',
      dimensions: 'video,insightTrafficSourceType',
      filters: `video==${videoFilter}`,
    });
    recordQuota('youtubeAnalytics.reports.query', YOUTUBE_QUOTA_COST.analyticsReportsQuery, {
      context: 'analyticsTools.getVideoAnalytics.traffic',
    });

    // 整合流量來源
    const trafficMap = new Map();
    if (trafficRes.data.rows) {
      for (const row of trafficRes.data.rows) {
        const vid = row[0];
        const src = row[1];
        const views = row[2] || 0;
        if (!trafficMap.has(vid)) trafficMap.set(vid, {});
        trafficMap.get(vid)[src] = views;
      }
    }

    if (basicRes.data.rows) {
      for (const row of basicRes.data.rows) {
        const vid = row[0];
        const traffic = trafficMap.get(vid) || {};
        allResults.push({
          videoId: vid,
          views: row[1] || 0,
          estimatedMinutesWatched: row[2] || 0,
          averageViewDuration: Math.round(row[3] || 0),
          averageViewPercentage: parseFloat((row[4] || 0).toFixed(1)),
          likes: row[5] || 0,
          comments: row[6] || 0,
          shares: row[7] || 0,
          subscribersGained: row[8] || 0,
          trafficSources: {
            youtubeSearch: traffic['YT_SEARCH'] || 0,
            suggested: traffic['SUGGESTED'] || 0,
            external: traffic['EXT_URL'] || 0,
            direct: traffic['DIRECT_OR_UNKNOWN'] || 0,
            other: traffic['NO_LINK_OTHER'] || 0,
          },
        });
      }
    }
  }

  console.log(`[Tool] get_video_analytics: 返回 ${allResults.length} 筆數據`);
  return { analytics: allResults, dateRange: { startDate, endDate } };
}

async function getRetentionCurve({ videoId, startDate, endDate }, { accessToken, channelId }) {
  console.log(`[Tool] get_retention_curve: videoId=${videoId}`);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

  const res = await youtubeAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: 'audienceWatchRatio',
    dimensions: 'elapsedVideoTimeRatio',
    filters: `video==${videoId}`,
  });
  recordQuota('youtubeAnalytics.reports.query', YOUTUBE_QUOTA_COST.analyticsReportsQuery, {
    context: 'analyticsTools.getRetentionCurve',
    videoId,
  });

  const curve = (res.data.rows || []).map(row => ({
    timeRatio: parseFloat(row[0].toFixed(3)),   // 0.0 ~ 1.0
    watchRatio: parseFloat(row[1].toFixed(3)),  // 留存比例
  }));

  // 找出最大流失點
  let maxDropIndex = 0;
  let maxDrop = 0;
  for (let i = 1; i < curve.length; i++) {
    const drop = curve[i - 1].watchRatio - curve[i].watchRatio;
    if (drop > maxDrop) {
      maxDrop = drop;
      maxDropIndex = i;
    }
  }

  const maxDropPoint = curve[maxDropIndex];

  console.log(`[Tool] get_retention_curve: ${curve.length} 個數據點`);
  return {
    videoId,
    curve,
    insight: {
      maxDropAt: maxDropPoint ? `${(maxDropPoint.timeRatio * 100).toFixed(0)}%` : null,
      maxDropValue: parseFloat((maxDrop * 100).toFixed(1)),
      openingRetention: curve[0]?.watchRatio ?? null,
      midpointRetention: curve[Math.floor(curve.length / 2)]?.watchRatio ?? null,
      endingRetention: curve[curve.length - 1]?.watchRatio ?? null,
    },
  };
}
