/**
 * 直接 API 測試 - 啟動服務器並測試分析端點
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { google } from 'googleapis';
import { AIModelManager } from './services/aiProviders/AIModelManager.js';
import { PromptTemplates } from './services/analysisPrompts/PromptTemplates.js';

dotenv.config();

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

console.log('🧪 YouTube API 直接測試');
console.log('='.repeat(60));

// 測試步驟 1: OAuth Token
async function testOAuth() {
  console.log('\n步驟 1: 測試 OAuth Token 獲取');
  console.log('-'.repeat(60));

  try {
    const oauth2Client = new google.auth.OAuth2(
      YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET,
      'http://localhost:3000/auth/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: YOUTUBE_REFRESH_TOKEN,
    });

    // 獲取新的 access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    console.log('✅ OAuth Token 獲取成功');
    console.log(`   Token 前 20 字元: ${accessToken.substring(0, 20)}...`);
    console.log(`   過期時間: ${new Date(credentials.expiry_date).toLocaleString()}`);

    return { oauth2Client, accessToken };
  } catch (error) {
    console.error('❌ OAuth Token 獲取失敗:', error.message);
    throw error;
  }
}

// 測試步驟 2: YouTube Data API
async function testYouTubeDataAPI(oauth2Client) {
  console.log('\n步驟 2: 測試 YouTube Data API');
  console.log('-'.repeat(60));

  try {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.channels.list({
      part: ['statistics', 'snippet'],
      mine: true,
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('未找到頻道數據');
    }

    const channel = response.data.items[0];
    const stats = {
      title: channel.snippet.title,
      channelId: channel.id,
      totalSubscribers: parseInt(channel.statistics.subscriberCount),
      totalViews: parseInt(channel.statistics.viewCount),
      totalVideos: parseInt(channel.statistics.videoCount),
    };

    console.log('✅ YouTube Data API 測試成功');
    console.log(`   頻道名稱: ${stats.title}`);
    console.log(`   頻道 ID: ${stats.channelId}`);
    console.log(`   總訂閱: ${stats.totalSubscribers.toLocaleString()}`);
    console.log(`   總觀看: ${stats.totalViews.toLocaleString()}`);
    console.log(`   總影片: ${stats.totalVideos.toLocaleString()}`);

    return stats;
  } catch (error) {
    console.error('❌ YouTube Data API 測試失敗:', error.message);
    throw error;
  }
}

// 測試步驟 3: YouTube Analytics API
async function testYouTubeAnalyticsAPI(oauth2Client) {
  console.log('\n步驟 3: 測試 YouTube Analytics API');
  console.log('-'.repeat(60));

  try {
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

    // 最近 7 天的數據
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (date) => date.toISOString().split('T')[0];
    const start = formatDate(startDate);
    const end = formatDate(endDate);

    console.log(`   查詢時段: ${start} ~ ${end}`);

    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: start,
      endDate: end,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
    });

    if (!response.data.rows || response.data.rows.length === 0) {
      console.warn('⚠️  時段內無數據');
      return null;
    }

    const [views, minutesWatched, subsGained, subsLost] = response.data.rows[0];

    const analyticsStats = {
      viewsInRange: views,
      watchTimeHours: Math.round(minutesWatched / 60),
      subscribersGained: subsGained,
      subscribersLost: subsLost,
    };

    console.log('✅ YouTube Analytics API 測試成功');
    console.log(`   觀看數: ${analyticsStats.viewsInRange.toLocaleString()}`);
    console.log(`   觀看時長: ${analyticsStats.watchTimeHours.toLocaleString()} 小時`);
    console.log(`   新增訂閱: ${analyticsStats.subscribersGained.toLocaleString()}`);
    console.log(`   流失訂閱: ${analyticsStats.subscribersLost.toLocaleString()}`);

    return { analyticsStats, startDate: start, endDate: end };
  } catch (error) {
    console.error('❌ YouTube Analytics API 測試失敗:', error.message);
    throw error;
  }
}

// 測試步驟 4: 數據完整性驗證
async function testDataIntegrity(channelStats, analyticsData) {
  console.log('\n步驟 4: 數據完整性驗證');
  console.log('-'.repeat(60));

  const mockVideos = [
    {
      videoId: 'test1',
      title: '測試影片 1',
      viewCount: 1000,
      likeCount: 50,
      commentCount: 10,
      publishedAt: '2024-01-01',
    },
  ];

  const requestData = {
    type: 'comprehensive',
    dateRange: {
      startDate: analyticsData.startDate,
      endDate: analyticsData.endDate,
    },
    channelStats: {
      totalSubscribers: channelStats.totalSubscribers,
      totalViews: channelStats.totalViews,
      totalVideos: channelStats.totalVideos,
      viewsInRange: analyticsData.analyticsStats.viewsInRange,
      watchTimeHours: analyticsData.analyticsStats.watchTimeHours,
      subscribersGained: analyticsData.analyticsStats.subscribersGained,
      videosInRange: 1,
    },
    videos: mockVideos,
    analytics: {
      subscribersGained: analyticsData.analyticsStats.subscribersGained,
      trafficSources: [],
      searchTerms: [],
      demographics: [],
      geography: [],
      devices: [],
      trendData: [],
      monthlyData: [],
    },
  };

  console.log('檢查必要欄位:');
  const checks = [
    ['totalSubscribers', requestData.channelStats.totalSubscribers],
    ['totalViews', requestData.channelStats.totalViews],
    ['viewsInRange', requestData.channelStats.viewsInRange],
    ['watchTimeHours', requestData.channelStats.watchTimeHours],
    ['subscribersGained', requestData.channelStats.subscribersGained],
  ];

  let allPresent = true;
  checks.forEach(([field, value]) => {
    const isPresent = value !== undefined && value !== null;
    console.log(`   ${isPresent ? '✅' : '❌'} ${field}: ${value}`);
    if (!isPresent) allPresent = false;
  });

  if (!allPresent) {
    throw new Error('數據欄位不完整');
  }

  console.log('\n✅ 數據完整性驗證通過');
  return requestData;
}

// 測試步驟 5: Prompt 生成
async function testPromptGeneration(requestData) {
  console.log('\n步驟 5: Prompt 生成測試');
  console.log('-'.repeat(60));

  try {
    const prompt = PromptTemplates.generatePrompt(requestData);

    console.log('✅ Prompt 生成成功');
    console.log(`   長度: ${prompt.length} 字元`);
    console.log(`   包含訂閱數: ${prompt.includes(requestData.channelStats.totalSubscribers.toLocaleString()) ? '是' : '否'}`);
    console.log(`   包含時段觀看數: ${prompt.includes(requestData.channelStats.viewsInRange.toLocaleString()) ? '是' : '否'}`);
    console.log(`   包含日期範圍: ${prompt.includes(requestData.dateRange.startDate) ? '是' : '否'}`);

    console.log('\n📄 Prompt 預覽（前 500 字元）:');
    console.log('-'.repeat(60));
    console.log(prompt.substring(0, 500) + '...\n');

    return prompt;
  } catch (error) {
    console.error('❌ Prompt 生成失敗:', error.message);
    throw error;
  }
}

// 主測試流程
async function runTests() {
  try {
    console.log('\n🚀 開始完整 API 測試流程\n');

    const { oauth2Client, accessToken } = await testOAuth();
    const channelStats = await testYouTubeDataAPI(oauth2Client);
    const analyticsData = await testYouTubeAnalyticsAPI(oauth2Client);
    const requestData = await testDataIntegrity(channelStats, analyticsData);
    const prompt = await testPromptGeneration(requestData);

    console.log('='.repeat(60));
    console.log('🎉 所有測試通過！');
    console.log('='.repeat(60));
    console.log('\n✅ YouTube API 連接正常');
    console.log('✅ 數據獲取成功');
    console.log('✅ 數據流驗證通過');
    console.log('✅ Prompt 生成正常\n');

    console.log('📊 系統已準備好進行 AI 分析測試！\n');

    process.exit(0);
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 測試失敗');
    console.log('='.repeat(60));
    console.error('\n錯誤:', error.message);
    if (error.stack) {
      console.error('\n堆疊追蹤:', error.stack);
    }
    process.exit(1);
  }
}

// 執行測試
runTests();
