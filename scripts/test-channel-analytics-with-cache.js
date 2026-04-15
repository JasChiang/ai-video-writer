/**
 * 測試頻道分析使用 Gist 快取（互動式）
 */

import dotenv from 'dotenv';
import readline from 'readline';
import { refreshAccessToken } from '../services/youtubeTokenService.js';
import { aggregateChannelData } from '../services/channelAnalyticsService.js';

dotenv.config({ path: '.env.local' });

const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

/**
 * 創建 readline 介面
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 詢問使用者問題
 */
function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * 解析關鍵字輸入
 */
function parseKeywords(input) {
  if (!input || input.trim() === '') {
    return [];
  }

  return input
    .split(',')
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0)
    .map(kw => ({
      name: kw,
      keyword: kw,
    }));
}

/**
 * 驗證日期格式 (YYYY-MM-DD)
 */
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

async function testChannelAnalytics() {
  let rl = null;

  try {
    rl = createReadlineInterface();
    console.log('========================================');
    console.log('🧪 頻道分析測試工具（使用 Gist 快取）');
    console.log('========================================\n');

    // 1. 詢問使用者輸入
    console.log('💡 請輸入要分析的關鍵字（用逗號分隔，例如：科技新聞,產品評測）');
    const keywordsInput = await askQuestion(rl, '關鍵字: ');
    const keywordGroups = parseKeywords(keywordsInput);

    if (keywordGroups.length === 0) {
      console.log('❌ 未輸入任何關鍵字，結束程式');
      rl.close();
      return;
    }

    console.log(`\n✅ 將分析 ${keywordGroups.length} 個關鍵字\n`);

    // 2. 詢問日期範圍
    console.log('💡 請輸入開始日期（格式: YYYY-MM-DD，例如：2024-01-01）');
    let startDate = await askQuestion(rl, '開始日期: ');
    while (!isValidDate(startDate)) {
      console.log('❌ 日期格式錯誤，請重新輸入（格式: YYYY-MM-DD）');
      startDate = await askQuestion(rl, '開始日期: ');
    }

    console.log('💡 請輸入結束日期（格式: YYYY-MM-DD，例如：2024-12-31）');
    let endDate = await askQuestion(rl, '結束日期: ');
    while (!isValidDate(endDate)) {
      console.log('❌ 日期格式錯誤，請重新輸入（格式: YYYY-MM-DD）');
      endDate = await askQuestion(rl, '結束日期: ');
    }

    rl.close();

    // 3. 定義日期範圍
    const dateRanges = [
      { label: `${startDate} ~ ${endDate}`, startDate, endDate },
    ];

    console.log('\n========================================');
    console.log('🔑 獲取 Access Token...');
    console.log('========================================\n');

    const tokenData = await refreshAccessToken(
      YOUTUBE_REFRESH_TOKEN,
      YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET
    );
    const accessToken = tokenData.access_token;
    console.log('✅ Access token 取得成功\n');

    // 4. 執行頻道分析
    console.log('========================================');
    console.log('📊 執行頻道分析');
    console.log('========================================\n');

    const result = await aggregateChannelData(
      accessToken,
      CHANNEL_ID,
      keywordGroups,
      dateRanges
    );

    // 5. 顯示結果
    console.log('\n========================================');
    console.log('📈 分析結果');
    console.log('========================================\n');

    for (const row of result.rows) {
      console.log(`\n🔹 關鍵字: "${row.keyword}"`);
      console.log(`   匹配影片數: ${row.videoCount} 支`);

      for (const [label, data] of Object.entries(row.dateRanges)) {
        if (data.error) {
          console.log(`\n   ❌ ${label}: ${data.error}`);
        } else {
          console.log(`\n   📊 時間範圍: ${label}`);
          console.log(`      觀看次數: ${data.views.toLocaleString()}`);
          console.log(`      觀看時長: ${Math.round(data.estimatedMinutesWatched).toLocaleString()} 分鐘`);
          console.log(`      平均觀看時長: ${Math.round(data.averageViewDuration)} 秒`);
          console.log(`      平均觀看百分比: ${data.averageViewPercentage.toFixed(1)}%`);
          console.log(`      按讚數: ${data.likes.toLocaleString()}`);
          console.log(`      留言數: ${data.comments.toLocaleString()}`);
          console.log(`      分享數: ${data.shares.toLocaleString()}`);
          console.log(`      新增訂閱: ${data.subscribersGained.toLocaleString()}`);
        }
      }
    }

    console.log('\n========================================');
    console.log('✅ 分析完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 分析失敗');
    console.error('========================================');
    console.error('錯誤訊息:', error.message);
    console.error('========================================\n');

    // 確保 readline 介面關閉
    if (rl && !rl.closed) {
      rl.close();
    }

    process.exit(1);
  }
}

testChannelAnalytics();
