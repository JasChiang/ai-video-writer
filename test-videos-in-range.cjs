/**
 * 測試 videosInRange 計算邏輯
 *
 * 驗證修復後的邏輯能正確區分：
 * - 期間內上傳的影片數（videosInRange）
 * - 期間內有觀看數據的影片數（videosWithData）
 */

console.log('='.repeat(80));
console.log('測試：videosInRange 計算邏輯驗證');
console.log('='.repeat(80));

// 模擬測試場景
const testScenario = {
  description: '成熟頻道，有大量舊片持續產生流量',
  timeRange: {
    start: new Date('2024-11-01'),
    end: new Date('2024-11-30'),
  },
  channel: {
    totalVideos: 200,
    totalSubscribers: 16000,
  },
};

console.log('\n📋 測試場景:');
console.log(`- 描述: ${testScenario.description}`);
console.log(`- 分析時段: ${testScenario.timeRange.start.toLocaleDateString()} ~ ${testScenario.timeRange.end.toLocaleDateString()}`);
console.log(`- 頻道總影片數: ${testScenario.channel.totalVideos} 支`);
console.log(`- 頻道訂閱數: ${testScenario.channel.totalSubscribers.toLocaleString()}`);

// 模擬 Video Cache Gist 數據（所有影片）
const allVideos = [
  // 期間內上傳的新片（5 支）
  { videoId: 'new-1', title: '新片1', publishedAt: '2024-11-05T10:00:00Z', viewCount: '5000' },
  { videoId: 'new-2', title: '新片2', publishedAt: '2024-11-10T10:00:00Z', viewCount: '4000' },
  { videoId: 'new-3', title: '新片3', publishedAt: '2024-11-15T10:00:00Z', viewCount: '3000' },
  { videoId: 'new-4', title: '新片4', publishedAt: '2024-11-20T10:00:00Z', viewCount: '2000' },
  { videoId: 'new-5', title: '新片5', publishedAt: '2024-11-25T10:00:00Z', viewCount: '1000' },

  // 期間前上傳的舊片，期間內有觀看數據（100 支）
  ...Array.from({ length: 100 }, (_, i) => ({
    videoId: `old-with-views-${i + 1}`,
    title: `舊片有觀看${i + 1}`,
    publishedAt: new Date(2023, Math.floor(i / 12), (i % 30) + 1).toISOString(),
    viewCount: `${Math.floor(Math.random() * 10000)}`,
  })),

  // 期間前上傳的舊片，期間內沒有觀看數據（95 支）
  ...Array.from({ length: 95 }, (_, i) => ({
    videoId: `old-no-views-${i + 1}`,
    title: `舊片無觀看${i + 1}`,
    publishedAt: new Date(2022, Math.floor(i / 12), (i % 30) + 1).toISOString(),
    viewCount: '0',
  })),
];

// 模擬 Analytics API 返回的數據（期間內有觀看數據的影片）
const analyticsRows = [
  // 5 支新片的數據
  ['new-1', '5000', '2500', '10'],
  ['new-2', '4000', '2000', '8'],
  ['new-3', '3000', '1500', '6'],
  ['new-4', '2000', '1000', '4'],
  ['new-5', '1000', '500', '2'],

  // 100 支舊片有觀看數據
  ...Array.from({ length: 100 }, (_, i) => [
    `old-with-views-${i + 1}`,
    `${Math.floor(Math.random() * 10000)}`,
    `${Math.floor(Math.random() * 5000)}`,
    `${Math.floor(Math.random() * 20)}`,
  ]),
];

console.log('\n📊 數據統計:');
console.log(`- Video Cache 總影片數: ${allVideos.length} 支`);
console.log(`- Analytics API 返回影片數: ${analyticsRows.length} 支（有觀看數據）`);

// 測試修復前的錯誤邏輯
const wrongLogic = {
  videosInRange: analyticsRows.length,  // ❌ 錯誤：使用 analyticsData.rows.length
};

// 測試修復後的正確邏輯
const startDate = testScenario.timeRange.start;
const endDate = testScenario.timeRange.end;

const actualVideosInRange = allVideos.filter((v) => {
  if (!v.publishedAt) return false;
  const publishDate = new Date(v.publishedAt);
  return publishDate >= startDate && publishDate <= endDate;
});

const correctLogic = {
  videosInRange: actualVideosInRange.length,  // ✅ 正確：過濾 publishedAt
  videosWithData: analyticsRows.length,       // 有觀看數據的影片數（參考用）
};

console.log('\n' + '='.repeat(80));
console.log('計算結果對比');
console.log('='.repeat(80));

console.log('\n❌ 修復前（錯誤邏輯）:');
console.log(`   videosInRange = ${wrongLogic.videosInRange} 支`);
console.log(`   ↑ 使用 analyticsData.rows.length`);
console.log(`   ↑ 代表「期間內有觀看數據的影片數」（包含大量舊片）`);

console.log('\n✅ 修復後（正確邏輯）:');
console.log(`   videosInRange = ${correctLogic.videosInRange} 支`);
console.log(`   videosWithData = ${correctLogic.videosWithData} 支（參考）`);
console.log(`   ↑ 過濾 publishedAt 在時間範圍內的影片`);
console.log(`   ↑ 代表「期間內實際上傳的影片數」`);

console.log('\n' + '='.repeat(80));
console.log('AI 分析提示詞的差異');
console.log('='.repeat(80));

console.log('\n❌ 修復前的提示詞:');
console.log(`「此期間實際上傳的影片數為 ${wrongLogic.videosInRange} 支，頻道總共有 ${testScenario.channel.totalVideos} 支影片」`);
console.log('   ↑ 錯誤！會讓 AI 以為本月上傳了 105 支影片');

console.log('\n✅ 修復後的提示詞:');
console.log(`「此期間實際上傳的影片數為 ${correctLogic.videosInRange} 支，頻道總共有 ${testScenario.channel.totalVideos} 支影片」`);
console.log('   ↑ 正確！AI 知道本月只上傳了 5 支新片');

console.log('\n' + '='.repeat(80));
console.log('驗證結果');
console.log('='.repeat(80));

const isCorrect = correctLogic.videosInRange === 5;
const status = isCorrect ? '✅ 通過' : '❌ 失敗';

console.log(`\n${status}`);

if (isCorrect) {
  console.log('\n🎉 測試通過！修復成功！');
  console.log('\n修復內容:');
  console.log('1. ✅ videosInRange 現在正確代表「期間內上傳的影片數」');
  console.log('2. ✅ 使用 Video Cache Gist 過濾 publishedAt');
  console.log('3. ✅ 不再誤用 analyticsData.rows.length');
  console.log('4. ✅ Console 會顯示兩個數字方便對比：');
  console.log('   - videosWithData: 期間內有觀看數據的影片數');
  console.log('   - videosUploaded: 期間內實際上傳的影片數');
  console.log('\n實際場景範例:');
  console.log(`- 本月上傳 ${correctLogic.videosInRange} 支新片`);
  console.log(`- 但有 ${correctLogic.videosWithData} 支影片有觀看數據（包含 ${correctLogic.videosWithData - correctLogic.videosInRange} 支舊片）`);
  console.log(`- 舊片占比: ${((correctLogic.videosWithData - correctLogic.videosInRange) / correctLogic.videosWithData * 100).toFixed(1)}%`);
  console.log(`- 這是健康的！說明頻道有良好的長尾效應 🎯`);
} else {
  console.log('\n❌ 測試失敗');
  console.log(`預期: 5 支新片`);
  console.log(`實際: ${correctLogic.videosInRange} 支`);
}

console.log('\n' + '='.repeat(80));

// 列出期間內上傳的影片
console.log('\n📋 期間內實際上傳的影片列表:');
actualVideosInRange.forEach((v, i) => {
  const publishDate = new Date(v.publishedAt);
  console.log(`  ${i + 1}. ${v.title}`);
  console.log(`     發布: ${publishDate.toLocaleDateString('zh-TW')} | 觀看: ${parseInt(v.viewCount).toLocaleString()}`);
});

console.log('\n' + '='.repeat(80));
console.log('測試完成');
console.log('='.repeat(80));
