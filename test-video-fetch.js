/**
 * 測試腳本：檢查影片獲取行為
 * 用途：診斷為什麼只獲取到 41 支影片而非預期的 275 支
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// 模擬當前的 getAllChannelVideos 函數（加入詳細日誌）
async function testGetAllChannelVideos(youtube, channelId) {
  const videos = [];
  let pageToken = null;
  let pageCount = 0;

  console.log('='.repeat(60));
  console.log('開始測試影片獲取流程');
  console.log('='.repeat(60));

  do {
    pageCount++;
    console.log(`\n📄 正在獲取第 ${pageCount} 頁...`);
    console.log(`   PageToken: ${pageToken || '(首頁)'}`);

    try {
      const response = await youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        maxResults: 50,
        order: 'date',
        type: 'video',
        pageToken: pageToken,
      });

      const items = response.data.items || [];
      console.log(`   ✓ 本頁獲取: ${items.length} 支影片`);

      // 顯示第一支和最後一支影片的發布日期
      if (items.length > 0) {
        const firstDate = new Date(items[0].snippet.publishedAt);
        const lastDate = new Date(items[items.length - 1].snippet.publishedAt);
        console.log(`   📅 發布日期範圍: ${firstDate.toLocaleDateString()} ~ ${lastDate.toLocaleDateString()}`);
      }

      videos.push(...items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url || '',
      })));

      pageToken = response.data.nextPageToken;
      console.log(`   下一頁 Token: ${pageToken || '(無 - 已是最後一頁)'}`);
      console.log(`   累計獲取: ${videos.length} 支影片`);

      // 安全機制：避免無限循環
      if (pageCount > 100) {
        console.log('\n⚠️  警告：已達到最大頁數限制 (100 頁)，停止查詢');
        break;
      }

    } catch (error) {
      console.error(`\n❌ 第 ${pageCount} 頁獲取失敗:`, error.message);
      if (error.response) {
        console.error('   API 錯誤詳情:', error.response.data);
      }
      throw error;
    }

  } while (pageToken);

  console.log('\n' + '='.repeat(60));
  console.log(`✓ 完成！共獲取 ${pageCount} 頁，${videos.length} 支影片`);
  console.log('='.repeat(60));

  return videos;
}

// 測試並分析
async function runTest() {
  try {
    // 需要用戶提供測試用的 access token 和 channel ID
    console.log('\n請先設定環境變數或在此腳本中提供：');
    console.log('- TEST_ACCESS_TOKEN: YouTube OAuth access token');
    console.log('- TEST_CHANNEL_ID: YouTube 頻道 ID\n');

    const accessToken = process.env.TEST_ACCESS_TOKEN;
    const channelId = process.env.TEST_CHANNEL_ID;

    if (!accessToken || !channelId) {
      console.error('❌ 錯誤：缺少必要的環境變數');
      console.log('\n使用方式：');
      console.log('TEST_ACCESS_TOKEN=your_token TEST_CHANNEL_ID=your_channel_id node test-video-fetch.js');
      process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // 執行測試
    const allVideos = await testGetAllChannelVideos(youtube, channelId);

    // 分析結果
    console.log('\n📊 詳細分析：');
    console.log('─'.repeat(60));

    // 計算不同時間範圍的影片數量
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const videosLast1Year = allVideos.filter(v => new Date(v.publishedAt) >= oneYearAgo);
    const videosLast2Years = allVideos.filter(v => new Date(v.publishedAt) >= twoYearsAgo);

    console.log(`總影片數: ${allVideos.length}`);
    console.log(`近 1 年內: ${videosLast1Year.length} 支`);
    console.log(`近 2 年內: ${videosLast2Years.length} 支`);

    // 顯示最舊和最新的影片
    if (allVideos.length > 0) {
      const sortedByDate = [...allVideos].sort((a, b) =>
        new Date(a.publishedAt) - new Date(b.publishedAt)
      );

      console.log('\n📅 時間範圍：');
      console.log(`   最舊影片: ${new Date(sortedByDate[0].publishedAt).toLocaleDateString()}`);
      console.log(`            "${sortedByDate[0].title}"`);
      console.log(`   最新影片: ${new Date(sortedByDate[sortedByDate.length - 1].publishedAt).toLocaleDateString()}`);
      console.log(`            "${sortedByDate[sortedByDate.length - 1].title}"`);
    }

    // 估算 API 配額使用
    const apiQuotaUsed = Math.ceil(allVideos.length / 50) * 100;
    console.log(`\n💰 API 配額使用估算: ${apiQuotaUsed} 單位`);
    console.log(`   (每日限額 10,000 單位，剩餘約 ${10000 - apiQuotaUsed} 單位)`);

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
runTest();
