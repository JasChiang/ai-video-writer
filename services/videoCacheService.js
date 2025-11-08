/**
 * 影片快取服務
 * 功能：將頻道所有影片的 videoId 和 title 快取到 GitHub Gist
 */

import { google } from 'googleapis';
import { recordQuota as recordQuotaServer } from './quotaTracker.js';

const YOUTUBE_QUOTA_COST = {
  channelsList: 1,
  playlistItemsList: 2, // 只用 snippet
};

/**
 * 從 YouTube 抓取所有影片的 videoId 和 title
 * @param {string} accessToken - YouTube OAuth access token
 * @param {string} channelId - 頻道 ID
 * @returns {Promise<Array>} 影片列表 [{videoId, title, publishedAt, thumbnail}]
 */
export async function fetchAllVideoTitles(accessToken, channelId) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // 步驟 1: 獲取上傳播放清單 ID
    console.log('[VideoCache] 獲取上傳播放清單 ID...');
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
    console.log(`[VideoCache] 上傳播放清單 ID: ${uploadsPlaylistId}`);

    // 步驟 2: 獲取所有影片（只要 snippet）
    const videos = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[VideoCache] 正在獲取第 ${pageCount} 頁...`);

      const response = await youtube.playlistItems.list({
        part: 'snippet', // 只要 snippet，不要 contentDetails 和 status
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken,
      });
      recordQuotaServer('youtube.playlistItems.list', YOUTUBE_QUOTA_COST.playlistItemsList, {
        part: 'snippet',
        page: pageCount,
        context: 'videoCache:fetchAllVideoTitles',
        caller: 'videoCacheService.fetchAllVideoTitles',
      });

      const items = response.data.items || [];

      for (const item of items) {
        const videoId = item.snippet.resourceId.videoId;
        const title = item.snippet.title;
        const publishedAt = item.snippet.publishedAt;
        const thumbnail = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '';

        // 過濾掉「已刪除的影片」或「私人影片」
        if (title !== 'Deleted video' && title !== 'Private video') {
          videos.push({
            videoId,
            title,
            publishedAt,
            thumbnail,
          });
        }
      }

      console.log(`[VideoCache] 已獲取 ${videos.length} 支影片`);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`[VideoCache] ✅ 完成！總共 ${videos.length} 支影片`);

    return videos;
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
    const gistContent = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      totalVideos: videos.length,
      videos: videos,
    };

    const gistData = {
      description: `YouTube 頻道影片快取 - ${videos.length} 支影片 - 更新於 ${new Date().toLocaleString('zh-TW')}`,
      public: false, // 私人 Gist
      files: {
        'youtube-videos-cache.json': {
          content: JSON.stringify(gistContent, null, 2),
        },
      },
    };

    const url = gistId
      ? `https://api.github.com/gists/${gistId}` // 更新現有 Gist
      : 'https://api.github.com/gists'; // 建立新 Gist

    const method = gistId ? 'PATCH' : 'POST';

    console.log(`[VideoCache] ${gistId ? '更新' : '建立'} Gist...`);

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

    console.log(`[VideoCache] ✅ Gist ${gistId ? '更新' : '建立'}成功！`);
    console.log(`[VideoCache] Gist ID: ${result.id}`);
    console.log(`[VideoCache] Gist URL: ${result.html_url}`);

    return {
      id: result.id,
      url: result.html_url,
      rawUrl: result.files['youtube-videos-cache.json'].raw_url,
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
    console.log(`[VideoCache] 從 Gist 載入快取: ${gistId}`);

    const url = `https://api.github.com/gists/${gistId}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (gistToken) {
      headers['Authorization'] = `token ${gistToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Gist 載入失敗: ${response.status}`);
    }

    const result = await response.json();
    const fileContent = result.files['youtube-videos-cache.json'].content;
    const cache = JSON.parse(fileContent);

    console.log(`[VideoCache] ✅ 載入成功！共 ${cache.totalVideos} 支影片`);
    console.log(`[VideoCache] 快取更新時間: ${cache.updatedAt}`);

    return cache;
  } catch (error) {
    console.error('[VideoCache] Gist 載入錯誤:', error.message);
    throw error;
  }
}
