/**
 * 測試數據流驗證腳本
 * 驗證前端傳送的數據是否完整對應提示詞需求
 */

import { PromptTemplates } from './services/analysisPrompts/PromptTemplates.js';

// 模擬前端傳送的數據
const mockRequestData = {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  channelStats: {
    totalViews: 1000000,
    totalSubscribers: 50000,
    totalVideos: 200,
    viewsInRange: 50000,
    watchTimeHours: 5000,
    subscribersGained: 1000,
    videosInRange: 50,
  },
  videos: Array.from({ length: 50 }, (_, i) => ({
    videoId: `video${i + 1}`,
    title: `測試影片 ${i + 1}`,
    viewCount: 10000 - i * 100,
    likeCount: 500 - i * 5,
    commentCount: 100 - i,
    publishedAt: '2024-01-15',
  })),
  analytics: {
    subscribersGained: 1000,
    trafficSources: [
      { source: 'YouTube 搜尋', views: 20000, percentage: 40 },
      { source: '推薦影片', views: 15000, percentage: 30 },
    ],
    searchTerms: [
      { term: 'AI 教學', views: 5000 },
      { term: 'YouTube 分析', views: 3000 },
    ],
    demographics: [
      { ageGroup: '25-34', gender: '男性', viewsPercentage: 35 },
      { ageGroup: '18-24', gender: '女性', viewsPercentage: 25 },
    ],
    geography: [
      { country: '台灣', views: 30000, percentage: 60 },
      { country: '香港', views: 10000, percentage: 20 },
    ],
    devices: [
      { deviceType: '手機', views: 25000, percentage: 50 },
      { deviceType: '電腦', views: 20000, percentage: 40 },
    ],
    trendData: [
      { date: '2024-01-01', views: 1500 },
      { date: '2024-01-15', views: 2000 },
    ],
    monthlyData: [
      { month: '2023-12', views: 40000, watchTimeHours: 4000 },
      { month: '2024-01', views: 50000, watchTimeHours: 5000 },
    ],
  },
};

console.log('📊 開始測試數據流...\n');

// 測試 1: 檢查 generatePrompt 是否正確處理數據
console.log('測試 1: 驗證 generatePrompt 數據處理');
console.log('=' .repeat(50));

const prompt = PromptTemplates.generatePrompt({
  type: 'comprehensive',
  dateRange: { startDate: mockRequestData.startDate, endDate: mockRequestData.endDate },
  channelStats: mockRequestData.channelStats,
  videos: mockRequestData.videos,
  analytics: mockRequestData.analytics,
});

console.log('✅ Prompt 生成成功');
console.log(`📄 Prompt 長度: ${prompt.length} 字元\n`);

// 測試 2: 檢查必要欄位是否存在
console.log('測試 2: 檢查 Prompt 中的必要數據');
console.log('=' .repeat(50));

const requiredFields = {
  '總訂閱者': mockRequestData.channelStats.totalSubscribers.toLocaleString(),
  '總觀看數': mockRequestData.channelStats.totalViews.toLocaleString(),
  '總影片數': mockRequestData.channelStats.totalVideos,
  '時段內觀看數': mockRequestData.channelStats.viewsInRange.toLocaleString(),
  '觀看時長': mockRequestData.channelStats.watchTimeHours.toLocaleString(),
  '新增訂閱': mockRequestData.channelStats.subscribersGained,
  '分析期間': `${mockRequestData.startDate} ~ ${mockRequestData.endDate}`,
};

let allFieldsFound = true;
for (const [field, value] of Object.entries(requiredFields)) {
  const found = prompt.includes(value.toString());
  const status = found ? '✅' : '❌';
  console.log(`${status} ${field}: ${value} ${!found ? '(未找到)' : ''}`);
  if (!found) allFieldsFound = false;
}

console.log('\n測試 3: 檢查 analytics 數據');
console.log('=' .repeat(50));

const analyticsChecks = {
  '流量來源': mockRequestData.analytics.trafficSources.length > 0,
  '搜尋關鍵詞': mockRequestData.analytics.searchTerms.length > 0,
  '人口統計': mockRequestData.analytics.demographics.length > 0,
  '地理分布': mockRequestData.analytics.geography.length > 0,
  '設備類型': mockRequestData.analytics.devices.length > 0,
  '趨勢數據': mockRequestData.analytics.trendData?.length > 0,
  '月度數據': mockRequestData.analytics.monthlyData?.length > 0,
};

for (const [field, hasData] of Object.entries(analyticsChecks)) {
  const status = hasData ? '✅' : '❌';
  console.log(`${status} ${field}: ${hasData ? '有數據' : '無數據'}`);
}

// 測試 4: 檢查兼容性（舊欄位名稱）
console.log('\n測試 4: 測試欄位名稱兼容性');
console.log('=' .repeat(50));

const oldFormatData = {
  ...mockRequestData,
  channelStats: {
    ...mockRequestData.channelStats,
    subscriberCount: mockRequestData.channelStats.totalSubscribers, // 舊欄位名稱
  },
};
delete oldFormatData.channelStats.totalSubscribers;

const promptWithOldFormat = PromptTemplates.generatePrompt({
  type: 'comprehensive',
  dateRange: { startDate: oldFormatData.startDate, endDate: oldFormatData.endDate },
  channelStats: oldFormatData.channelStats,
  videos: oldFormatData.videos,
  analytics: oldFormatData.analytics,
});

const hasSubscriberCount = promptWithOldFormat.includes(
  mockRequestData.channelStats.totalSubscribers.toLocaleString()
);
console.log(
  `${hasSubscriberCount ? '✅' : '❌'} subscriberCount 欄位兼容性: ${hasSubscriberCount ? '通過' : '失敗'}`
);

// 總結
console.log('\n' + '='.repeat(50));
console.log('📊 測試總結');
console.log('=' .repeat(50));

if (allFieldsFound && hasSubscriberCount) {
  console.log('✅ 所有測試通過！數據流正常。');
} else {
  console.log('❌ 發現問題，請檢查數據傳送邏輯。');
}

// 輸出部分 Prompt 預覽
console.log('\n📄 Prompt 預覽（前 500 字元）:');
console.log('=' .repeat(50));
console.log(prompt.substring(0, 500) + '...\n');
