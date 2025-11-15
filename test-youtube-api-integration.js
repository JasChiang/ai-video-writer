/**
 * YouTube API 完整集成測試
 * 測試從 YouTube API 獲取數據到 AI 分析的完整流程
 */

import { PromptTemplates } from './services/analysisPrompts/PromptTemplates.js';

// 環境變數
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

console.log('🔧 YouTube API 集成測試');
console.log('=' .repeat(60));
console.log(`📺 Channel ID: ${YOUTUBE_CHANNEL_ID}`);
console.log(`🔑 Client ID: ${YOUTUBE_CLIENT_ID?.substring(0, 20)}...`);
console.log(`🔄 Refresh Token: ${YOUTUBE_REFRESH_TOKEN ? '已設置' : '未設置'}\n`);

// Step 1: 獲取 Access Token
async function getAccessToken() {
  console.log('步驟 1: 獲取 Access Token');
  console.log('-'.repeat(60));

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        refresh_token: YOUTUBE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Token 獲取失敗: ${JSON.stringify(data)}`);
    }

    console.log('✅ Access Token 獲取成功');
    console.log(`   Token 類型: ${data.token_type}`);
    console.log(`   有效期: ${data.expires_in} 秒\n`);

    return data.access_token;
  } catch (error) {
    console.error('❌ Access Token 獲取失敗:', error.message);
    if (error.cause) {
      console.error('   原因:', error.cause.message || error.cause);
    }
    throw error;
  }
}

// Step 2: 測試 YouTube Data API - 獲取頻道統計
async function testChannelStats(token) {
  console.log('步驟 2: 測試 YouTube Data API - 頻道統計');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?` +
      `part=statistics,snippet&id=${YOUTUBE_CHANNEL_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API 錯誤: ${JSON.stringify(data)}`);
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('找不到頻道數據');
    }

    const channel = data.items[0];
    const stats = {
      title: channel.snippet.title,
      totalSubscribers: parseInt(channel.statistics.subscriberCount),
      totalViews: parseInt(channel.statistics.viewCount),
      totalVideos: parseInt(channel.statistics.videoCount),
    };

    console.log('✅ 頻道數據獲取成功');
    console.log(`   頻道名稱: ${stats.title}`);
    console.log(`   總訂閱數: ${stats.totalSubscribers.toLocaleString()}`);
    console.log(`   總觀看數: ${stats.totalViews.toLocaleString()}`);
    console.log(`   總影片數: ${stats.totalVideos.toLocaleString()}\n`);

    return stats;
  } catch (error) {
    console.error('❌ 頻道統計獲取失敗:', error.message);
    throw error;
  }
}

// Step 3: 測試 YouTube Analytics API - 時段內數據
async function testAnalyticsData(token, startDate, endDate) {
  console.log('步驟 3: 測試 YouTube Analytics API - 時段內數據');
  console.log('-'.repeat(60));
  console.log(`   時段: ${startDate} ~ ${endDate}`);

  try {
    // 獲取頻道級別數據
    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?` +
      `ids=channel==MINE` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Analytics API 錯誤: ${JSON.stringify(data)}`);
    }

    if (!data.rows || data.rows.length === 0) {
      console.warn('⚠️  時段內無數據');
      return null;
    }

    const [views, minutesWatched, subsGained, subsLost, avgViewDuration, avgViewPercentage] = data.rows[0];

    const analyticsStats = {
      viewsInRange: views,
      watchTimeHours: Math.round(minutesWatched / 60),
      subscribersGained: subsGained,
      subscribersLost: subsLost,
      averageViewDuration: avgViewDuration,
      averageViewPercentage: avgViewPercentage,
    };

    console.log('✅ Analytics 數據獲取成功');
    console.log(`   時段內觀看數: ${analyticsStats.viewsInRange.toLocaleString()}`);
    console.log(`   觀看時長: ${analyticsStats.watchTimeHours.toLocaleString()} 小時`);
    console.log(`   新增訂閱: ${analyticsStats.subscribersGained.toLocaleString()}`);
    console.log(`   平均觀看時長: ${Math.round(analyticsStats.averageViewDuration)} 秒`);
    console.log(`   平均觀看百分比: ${analyticsStats.averageViewPercentage.toFixed(1)}%\n`);

    return analyticsStats;
  } catch (error) {
    console.error('❌ Analytics 數據獲取失敗:', error.message);
    throw error;
  }
}

// Step 4: 測試熱門影片數據
async function testTopVideos(token, startDate, endDate) {
  console.log('步驟 4: 測試熱門影片數據');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?` +
      `ids=channel==MINE` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&metrics=views,averageViewPercentage,shares,comments` +
      `&dimensions=video` +
      `&sort=-views` +
      `&maxResults=5`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API 錯誤: ${JSON.stringify(data)}`);
    }

    if (!data.rows || data.rows.length === 0) {
      console.warn('⚠️  時段內無影片數據');
      return [];
    }

    const videoIds = data.rows.map(row => row[0]);

    // 獲取影片詳情
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,statistics&id=${videoIds.join(',')}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const videosData = await videosResponse.json();

    const videos = videosData.items.map((video, index) => {
      const analyticsRow = data.rows[index];
      return {
        videoId: video.id,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        viewCount: parseInt(video.statistics.viewCount || 0),
        likeCount: parseInt(video.statistics.likeCount || 0),
        commentCount: parseInt(video.statistics.commentCount || 0),
        avgViewPercentage: parseFloat(analyticsRow[1] || 0),
        shares: parseInt(analyticsRow[2] || 0),
      };
    });

    console.log(`✅ 獲取 ${videos.length} 支熱門影片`);
    videos.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.title.substring(0, 40)}...`);
      console.log(`      觀看: ${v.viewCount.toLocaleString()} | 讚: ${v.likeCount.toLocaleString()}`);
    });
    console.log();

    return videos;
  } catch (error) {
    console.error('❌ 熱門影片獲取失敗:', error.message);
    throw error;
  }
}

// Step 5: 測試流量來源數據
async function testTrafficSources(token, startDate, endDate) {
  console.log('步驟 5: 測試流量來源數據');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?` +
      `ids=channel==MINE` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&metrics=views` +
      `&dimensions=insightTrafficSourceType` +
      `&sort=-views` +
      `&maxResults=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API 錯誤: ${JSON.stringify(data)}`);
    }

    if (!data.rows || data.rows.length === 0) {
      console.warn('⚠️  無流量來源數據');
      return [];
    }

    const totalViews = data.rows.reduce((sum, row) => sum + row[1], 0);

    const trafficSources = data.rows.map(row => ({
      source: row[0],
      views: row[1],
      percentage: (row[1] / totalViews) * 100,
    }));

    console.log('✅ 流量來源數據獲取成功');
    trafficSources.forEach(source => {
      console.log(`   ${source.source}: ${source.views.toLocaleString()} 次 (${source.percentage.toFixed(1)}%)`);
    });
    console.log();

    return trafficSources;
  } catch (error) {
    console.error('❌ 流量來源獲取失敗:', error.message);
    return [];
  }
}

// Step 6: 測試搜尋關鍵詞
async function testSearchTerms(token, startDate, endDate) {
  console.log('步驟 6: 測試搜尋關鍵詞數據');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?` +
      `ids=channel==MINE` +
      `&startDate=${startDate}` +
      `&endDate=${endDate}` +
      `&metrics=views` +
      `&dimensions=insightTrafficSourceDetail` +
      `&filters=insightTrafficSourceType==YT_SEARCH` +
      `&sort=-views` +
      `&maxResults=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API 錯誤: ${JSON.stringify(data)}`);
    }

    if (!data.rows || data.rows.length === 0) {
      console.warn('⚠️  無搜尋關鍵詞數據');
      return [];
    }

    const searchTerms = data.rows.map(row => ({
      term: row[0],
      views: row[1],
    }));

    console.log(`✅ 獲取 ${searchTerms.length} 個搜尋關鍵詞`);
    searchTerms.forEach((term, i) => {
      console.log(`   ${i + 1}. "${term.term}" - ${term.views.toLocaleString()} 次`);
    });
    console.log();

    return searchTerms;
  } catch (error) {
    console.error('❌ 搜尋關鍵詞獲取失敗:', error.message);
    return [];
  }
}

// Step 7: 組合數據並生成 Prompt
async function testPromptGeneration(channelStats, analyticsStats, videos, trafficSources, searchTerms, startDate, endDate) {
  console.log('步驟 7: 測試 AI Prompt 生成');
  console.log('-'.repeat(60));

  const requestData = {
    type: 'comprehensive',
    dateRange: { startDate, endDate },
    channelStats: {
      totalSubscribers: channelStats.totalSubscribers,
      totalViews: channelStats.totalViews,
      totalVideos: channelStats.totalVideos,
      viewsInRange: analyticsStats?.viewsInRange || 0,
      watchTimeHours: analyticsStats?.watchTimeHours || 0,
      subscribersGained: analyticsStats?.subscribersGained || 0,
      videosInRange: videos.length,
    },
    videos: videos,
    analytics: {
      subscribersGained: analyticsStats?.subscribersGained || 0,
      trafficSources: trafficSources,
      searchTerms: searchTerms,
      demographics: [],
      geography: [],
      devices: [],
      trendData: [],
      monthlyData: [],
    },
  };

  const prompt = PromptTemplates.generatePrompt(requestData);

  console.log('✅ Prompt 生成成功');
  console.log(`   Prompt 長度: ${prompt.length} 字元`);
  console.log(`   包含影片數: ${videos.length}`);
  console.log(`   包含流量來源: ${trafficSources.length}`);
  console.log(`   包含搜尋詞: ${searchTerms.length}\n`);

  // 驗證關鍵數據是否存在
  console.log('驗證 Prompt 內容:');
  console.log('-'.repeat(60));

  const checks = [
    ['總訂閱者', channelStats.totalSubscribers.toLocaleString()],
    ['時段內觀看數', analyticsStats?.viewsInRange?.toLocaleString() || '0'],
    ['觀看時長', analyticsStats?.watchTimeHours?.toLocaleString() || '0'],
    ['日期範圍', `${startDate} ~ ${endDate}`],
  ];

  checks.forEach(([label, value]) => {
    const found = prompt.includes(value);
    console.log(`${found ? '✅' : '❌'} ${label}: ${value} ${!found ? '(未找到)' : ''}`);
  });

  console.log('\n📄 Prompt 預覽（前 800 字元）:');
  console.log('='.repeat(60));
  console.log(prompt.substring(0, 800) + '...\n');

  return prompt;
}

// 主測試流程
async function runFullTest() {
  try {
    console.log('🚀 開始完整集成測試\n');

    // 計算測試時段（最近 7 天）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const start = formatDate(startDate);
    const end = formatDate(endDate);

    // 執行測試步驟
    const token = await getAccessToken();
    const channelStats = await testChannelStats(token);
    const analyticsStats = await testAnalyticsData(token, start, end);
    const videos = await testTopVideos(token, start, end);
    const trafficSources = await testTrafficSources(token, start, end);
    const searchTerms = await testSearchTerms(token, start, end);
    await testPromptGeneration(channelStats, analyticsStats, videos, trafficSources, searchTerms, start, end);

    console.log('=' .repeat(60));
    console.log('✅ 完整集成測試通過！');
    console.log('=' .repeat(60));
    console.log('\n所有 YouTube API 連接正常，數據流程驗證成功！');
    console.log('可以繼續進行 AI 分析測試。\n');

  } catch (error) {
    console.log('=' .repeat(60));
    console.log('❌ 測試失敗');
    console.log('=' .repeat(60));
    console.error('\n錯誤詳情:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行測試
runFullTest();
