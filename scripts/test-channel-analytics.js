/**
 * 測試頻道分析功能
 * 驗證使用 video cache 的數據是否正確
 */

import { aggregateChannelData } from '../services/channelAnalyticsService.js';
import dotenv from 'dotenv';
import { google } from 'googleapis';

// 載入環境變數
dotenv.config({ path: '.env.local' });

async function getAccessToken() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );

  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token;
  } else if (process.env.YOUTUBE_TOKEN) {
    return process.env.YOUTUBE_TOKEN;
  } else {
    throw new Error('未設定 YouTube Token 或 Refresh Token');
  }
}

async function testChannelAnalytics() {
  try {
    console.log('========================================');
    console.log('測試頻道分析功能（使用 Video Cache）');
    console.log('========================================\n');

    // 1. 獲取 access token
    console.log('1. 獲取 Access Token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access Token 已獲取\n');

    // 2. 設定測試參數
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    console.log(`2. 頻道 ID: ${channelId}\n`);

    // 3. 設定關鍵字組合
    const keywordGroups = [
      { name: '秒懂潮科技', keyword: '秒懂潮科技' },
      { name: '神來點蘋', keyword: '神來點蘋' },
    ];

    // 4. 設定日期範圍（2024 年）
    const dateRanges = [
      {
        label: '2024 年',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
    ];

    console.log('3. 測試參數：');
    console.log('   關鍵字組合:', keywordGroups.map(g => g.name).join(', '));
    console.log('   日期範圍:', dateRanges[0].label);
    console.log('');

    // 5. 執行頻道分析
    console.log('4. 執行頻道分析...\n');
    const result = await aggregateChannelData(
      accessToken,
      channelId,
      keywordGroups,
      dateRanges
    );

    // 6. 顯示結果
    console.log('\n========================================');
    console.log('分析結果');
    console.log('========================================\n');

    for (const row of result.rows) {
      const data = row.dateRanges['2024 年'];
      console.log(`📊 ${row.name} (關鍵字: "${row.keyword}")`);
      console.log(`   影片數量: ${row.videoCount}`);
      console.log(`   觀看次數: ${data.views.toLocaleString()}`);
      console.log(`   平均觀看百分比: ${data.averageViewPercentage.toFixed(2)}%`);
      console.log(`   平均觀看時長: ${data.averageViewDuration.toFixed(0)} 秒`);
      console.log(`   觀看時長總計: ${data.estimatedMinutesWatched.toLocaleString()} 分鐘`);
      console.log(`   讚數: ${data.likes.toLocaleString()}`);
      console.log('');
    }

    // 7. 驗證數據
    console.log('========================================');
    console.log('數據驗證');
    console.log('========================================\n');

    const expectedData = {
      '秒懂潮科技': {
        views: 174268,
        averageViewPercentage: 75.55,
      },
      '神來點蘋': {
        views: 97585,
        averageViewPercentage: 59.62,
      },
    };

    let allCorrect = true;

    for (const row of result.rows) {
      const data = row.dateRanges['2024 年'];
      const expected = expectedData[row.name];

      if (!expected) {
        console.log(`⚠️  未找到 "${row.name}" 的預期數據`);
        continue;
      }

      const viewsMatch = data.views === expected.views;
      const percentageMatch = Math.abs(data.averageViewPercentage - expected.averageViewPercentage) < 0.01;

      console.log(`${row.name}:`);
      console.log(`  觀看次數: ${data.views.toLocaleString()} ${viewsMatch ? '✅' : '❌'} (預期: ${expected.views.toLocaleString()})`);
      console.log(`  平均觀看百分比: ${data.averageViewPercentage.toFixed(2)}% ${percentageMatch ? '✅' : '❌'} (預期: ${expected.averageViewPercentage}%)`);
      console.log('');

      if (!viewsMatch || !percentageMatch) {
        allCorrect = false;
      }
    }

    console.log('========================================');
    if (allCorrect) {
      console.log('✅ 所有數據驗證通過！');
    } else {
      console.log('❌ 部分數據與預期不符，請檢查');
    }
    console.log('========================================\n');

    process.exit(allCorrect ? 0 : 1);
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行測試
testChannelAnalytics();
