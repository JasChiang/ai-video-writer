import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { google } from 'googleapis';

const REQUIRED_ENVS = ['YT_CHANNEL_ID', 'YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'];
const MISSING = REQUIRED_ENVS.filter((key) => !process.env[key]);
if (MISSING.length > 0) {
  console.error(`[syncChannelVideos] 缺少必要環境變數: ${MISSING.join(', ')}`);
  process.exit(1);
}

const CHANNEL_ID = process.env.YT_CHANNEL_ID;
const OUTPUT_PATH = process.env.CHANNEL_VIDEOS_OUTPUT || 'cache/channelVideos.json';
const MAX_PAGES = parseInt(process.env.CHANNEL_VIDEOS_MAX_PAGES || '', 10) || 400;

const oauth2Client = new google.auth.OAuth2(
  process.env.YT_CLIENT_ID,
  process.env.YT_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function getUploadsPlaylistId() {
  const response = await youtube.channels.list({
    part: 'contentDetails',
    id: CHANNEL_ID,
  });

  const playlistId = response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) {
    throw new Error('無法取得頻道上傳清單 ID');
  }
  return playlistId;
}

async function fetchAllVideos(playlistId) {
  const videos = [];
  let pageToken = undefined;
  let page = 0;

  do {
    page += 1;
    console.log(`[syncChannelVideos] 讀取播放清單第 ${page} 頁...`);

    const playlistResponse = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    });

    const items = playlistResponse.data.items || [];
    if (items.length === 0) {
      break;
    }

    const videoIds = items
      .map((item) => item.contentDetails?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      pageToken = playlistResponse.data.nextPageToken;
      continue;
    }

    const detailsResponse = await youtube.videos.list({
      part: 'snippet,status',
      id: videoIds.join(','),
    });

    const detailMap = new Map();
    detailsResponse.data.items?.forEach((video) => {
      detailMap.set(video.id, video);
    });

    videoIds.forEach((id) => {
      const detail = detailMap.get(id);
      if (!detail) {
        return;
      }

      videos.push({
        videoId: id,
        title: detail.snippet?.title || '',
        description: detail.snippet?.description || '',
        tags: detail.snippet?.tags || [],
        publishedAt: detail.snippet?.publishedAt || null,
        privacyStatus: detail.status?.privacyStatus || 'public',
        thumbnail:
          detail.snippet?.thumbnails?.medium?.url ||
          detail.snippet?.thumbnails?.default?.url ||
          '',
      });
    });

    pageToken = playlistResponse.data.nextPageToken;
    if (page >= MAX_PAGES) {
      console.warn(`[syncChannelVideos] 達到最大頁數 ${MAX_PAGES}，提前停止`);
      break;
    }
  } while (pageToken);

  return videos;
}

async function main() {
  console.log('[syncChannelVideos] 開始同步頻道影片...');
  const playlistId = await getUploadsPlaylistId();
  const videos = await fetchAllVideos(playlistId);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  const payload = {
    updatedAt: new Date().toISOString(),
    channelId: CHANNEL_ID,
    total: videos.length,
    videos,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[syncChannelVideos] 已寫入 ${videos.length} 支影片到 ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error('[syncChannelVideos] 執行失敗:', error);
  process.exit(1);
});
