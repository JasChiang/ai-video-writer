/**
 * 批次更新 Gist 快取中所有影片的 tags 資訊
 * 使用 videos.list API 獲取最新的 tags，並更新到 Gist
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
import { refreshAccessToken, parseTokenInput } from '../services/server/youtubeTokenService.js';
import { loadFromGist, uploadToGist } from '../services/server/videoCacheService.js';
import { recordQuota as recordQuotaServer } from '../services/server/quotaTracker.js';

dotenv.config({ path: '.env.local' });

const YOUTUBE_TOKEN = process.env.YOUTUBE_TOKEN || process.env.YOUTUBE_ACCESS_TOKEN;
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const GIST_ID = process.env.GITHUB_GIST_ID;
const GIST_TOKEN = process.env.GITHUB_GIST_TOKEN;

/**
 * 清理文字內容
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 批次獲取影片的 tags
 */
async function fetchVideoTags(accessToken, videoIds) {
  try {
    console.log('\n========================================');
    console.log('🏷️  使用 videos.list 批次獲取 tags');
    console.log('========================================');
    console.log(`總影片數: ${videoIds.length}`);

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const tagsMap = new Map();
    const batchSize = 50;
    const totalBatches = Math.ceil(videoIds.length / batchSize);

    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;

      console.log(`📦 處理批次 ${currentBatch}/${totalBatches} (${batch.length} 支影片)...`);

      const response = await youtube.videos.list({
        part: 'snippet',
        id: batch.join(','),
        maxResults: 50,
      });

      recordQuotaServer('youtube.videos.list', 2, {
        part: 'snippet',
        batch: currentBatch,
        videoCount: batch.length,
        context: 'updateCacheTags',
        caller: 'update-cache-tags.js',
      });

      const items = response.data.items || [];
      for (const item of items) {
        const tags = (item.snippet?.tags || []).map(tag => sanitizeText(tag));
        tagsMap.set(item.id, tags);
      }

      console.log(`✅ 批次 ${currentBatch} 完成`);
    }

    console.log(`✅ 所有 tags 獲取完成！共 ${tagsMap.size} 支影片`);
    return tagsMap;
  } catch (error) {
    console.error('❌ 獲取 tags 失敗:', error.message);
    throw error;
  }
}

/**
 * 主程式
 */
async function main() {
  try {
    console.log('========================================');
    console.log('🚀 開始更新快取中的 tags 資訊');
    console.log('========================================\n');

    // 1. 獲取 access token
    let accessToken;

    try {
      if (YOUTUBE_REFRESH_TOKEN) {
        console.log('🔄 使用 refresh token 取得 access token...');
        const tokenData = await refreshAccessToken(
          YOUTUBE_REFRESH_TOKEN,
          YOUTUBE_CLIENT_ID,
          YOUTUBE_CLIENT_SECRET
        );
        accessToken = tokenData.access_token;
        console.log(`✅ Access token 取得成功（有效期限: ${tokenData.expires_in} 秒）\n`);
      } else {
        const parsed = parseTokenInput(YOUTUBE_TOKEN);
        accessToken = parsed.accessToken;
        console.log('✅ Access token 取得成功\n');
      }
    } catch (error) {
      console.error('❌ Token 處理失敗:', error.message);
      process.exit(1);
    }

    // 2. 從 Gist 載入快取
    console.log('📥 從 Gist 載入快取...');
    const cache = await loadFromGist(GIST_ID, GIST_TOKEN);
    console.log(`✅ 快取載入成功，共 ${cache.videos.length} 支影片\n`);

    // 3. 批次獲取所有影片的 tags
    console.log('🏷️  開始批次獲取所有影片的 tags...');
    const allVideoIds = cache.videos.map(v => v.videoId);
    const tagsMap = await fetchVideoTags(accessToken, allVideoIds);

    // 4. 更新快取中的 tags
    console.log('\n🔄 更新快取中的 tags...');
    let updatedCount = 0;
    cache.videos.forEach(video => {
      if (tagsMap.has(video.videoId)) {
        video.tags = tagsMap.get(video.videoId);
        updatedCount++;
      } else {
        video.tags = video.tags || [];
      }
    });
    console.log(`✅ 已更新 ${updatedCount} 支影片的 tags\n`);

    // 5. 上傳更新後的快取到 Gist
    console.log('📤 上傳更新後的快取到 Gist...');
    const result = await uploadToGist(cache.videos, GIST_TOKEN, GIST_ID);

    console.log('\n========================================');
    console.log('✅ Tags 更新完成！');
    console.log('========================================');
    console.log(`📊 總影片數: ${cache.videos.length}`);
    console.log(`🏷️  已更新 tags: ${updatedCount} 支影片`);
    console.log(`🆔 Gist ID: ${result.id}`);
    console.log(`🔗 Gist URL: ${result.url}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 執行失敗');
    console.error('========================================');
    console.error('錯誤訊息:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

main();
