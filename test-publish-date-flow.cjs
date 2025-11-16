/**
 * 測試發布日期數據流
 *
 * 驗證從 ChannelDashboard → ChannelAnalysisPanel → PromptTemplates
 * 是否正確傳遞和顯示發布日期
 */

async function runTest() {
  // 動態 import ES module
  const { PromptTemplates } = await import('./services/analysisPrompts/PromptTemplates.js');

  console.log('='.repeat(80));
  console.log('測試：發布日期數據流驗證');
  console.log('='.repeat(80));

  // 模擬測試數據（包含新舊影片）
  const testData = {
    type: 'comprehensive',
    dateRange: {
      startDate: '2024-11-01',
      endDate: '2024-11-30',
    },
    channelStats: {
      totalSubscribers: 16000,
      totalViews: 5000000,
      totalVideos: 200,
      viewsInRange: 150000,
      watchTimeHours: 8500,
      subscribersGained: 24,
      videosInRange: 5, // 期間內實際上傳 5 支新片
    },
    videos: [
      // Top 50 影片（混合新舊片）
      {
        videoId: 'new-video-1',
        title: '【新片】2024 年度回顧',
        publishedAt: '2024-11-15T10:00:00Z', // 期間內上傳的新片
        viewCount: 50000,
        likeCount: 2500,
        commentCount: 300,
      },
      {
        videoId: 'old-video-1',
        title: '【舊片爆紅】2023 完整教學',
        publishedAt: '2023-06-10T10:00:00Z', // 期間前上傳的舊片
        viewCount: 45000,
        likeCount: 2200,
        commentCount: 280,
      },
      {
        videoId: 'new-video-2',
        title: '【新片】最新功能介紹',
        publishedAt: '2024-11-20T10:00:00Z', // 期間內上傳的新片
        viewCount: 40000,
        likeCount: 2000,
        commentCount: 250,
      },
      {
        videoId: 'old-video-2',
        title: '【舊片長尾】經典技巧分享',
        publishedAt: '2022-03-15T10:00:00Z', // 很久以前的舊片
        viewCount: 35000,
        likeCount: 1800,
        commentCount: 220,
      },
      {
        videoId: 'new-video-3',
        title: '【新片】實戰案例分析',
        publishedAt: '2024-11-25T10:00:00Z', // 期間內上傳的新片
        viewCount: 30000,
        likeCount: 1500,
        commentCount: 180,
      },
    ],
    analytics: {
      subscribersGained: 24,
      bottomVideos: [
        {
          videoId: 'bottom-new-1',
          title: '【新片低效】測試影片',
          publishedAt: '2024-11-10T10:00:00Z', // 期間內上傳但表現差
          viewCount: 500,
          likeCount: 10,
          commentCount: 2,
        },
        {
          videoId: 'bottom-old-1',
          title: '【舊片低效】過時內容',
          publishedAt: '2021-05-10T10:00:00Z', // 舊片且表現差
          viewCount: 300,
          likeCount: 5,
          commentCount: 1,
        },
      ],
      trafficSources: [],
      searchTerms: [],
      demographics: [],
      geography: [],
      devices: [],
      trendData: [],
      monthlyData: [],
    },
  };

  console.log('\n📋 測試數據概覽:');
  console.log(`- 分析期間: ${testData.dateRange.startDate} ~ ${testData.dateRange.endDate}`);
  console.log(`- 期間內實際上傳影片數: ${testData.channelStats.videosInRange} 支`);
  console.log(`- 頻道總影片數: ${testData.channelStats.totalVideos} 支`);
  console.log(`- Top 影片數: ${testData.videos.length} 支`);
  console.log(`- Bottom 影片數: ${testData.analytics.bottomVideos.length} 支`);

  // 分析新舊片比例
  const analysisPeriodStart = new Date(testData.dateRange.startDate);
  const analysisPeriodEnd = new Date(testData.dateRange.endDate);

  const topNewVideos = testData.videos.filter(v => {
    const publishDate = new Date(v.publishedAt);
    return publishDate >= analysisPeriodStart && publishDate <= analysisPeriodEnd;
  });

  const topOldVideos = testData.videos.filter(v => {
    const publishDate = new Date(v.publishedAt);
    return publishDate < analysisPeriodStart;
  });

  console.log('\n📊 Top 影片新舊分佈:');
  console.log(`- 期間內上傳的新片: ${topNewVideos.length} 支 (${(topNewVideos.length / testData.videos.length * 100).toFixed(1)}%)`);
  console.log(`- 期間前上傳的舊片: ${topOldVideos.length} 支 (${(topOldVideos.length / testData.videos.length * 100).toFixed(1)}%)`);

  console.log('\n🔍 Top 影片列表:');
  testData.videos.forEach((v, i) => {
    const publishDate = new Date(v.publishedAt);
    const isNew = publishDate >= analysisPeriodStart && publishDate <= analysisPeriodEnd;
    const ageLabel = isNew ? '✅ 新片' : '⏰ 舊片';
    const ageInDays = Math.floor((new Date() - publishDate) / (1000 * 60 * 60 * 24));
    console.log(`  ${i + 1}. ${ageLabel} | ${v.title}`);
    console.log(`     發布: ${publishDate.toLocaleDateString('zh-TW')} (${ageInDays} 天前) | 觀看: ${v.viewCount.toLocaleString()}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('生成 AI 提示詞...');
  console.log('='.repeat(80));

  try {
    const prompt = PromptTemplates.generatePrompt(testData);

    console.log('\n✅ 提示詞生成成功！');
    console.log('\n' + '='.repeat(80));
    console.log('檢查提示詞內容');
    console.log('='.repeat(80));

    // 檢查關鍵字是否出現
    const checks = [
      {
        name: '發布日期欄位',
        pattern: /發布日期：/g,
        expected: testData.videos.length + testData.analytics.bottomVideos.length,
      },
      {
        name: '期間說明',
        pattern: /並非期間內上傳的影片/g,
        expected: 1,
      },
      {
        name: '實際上傳影片數',
        pattern: new RegExp(`實際上傳的影片數.*為 ${testData.channelStats.videosInRange} 支`, 'g'),
        expected: 1,
      },
      {
        name: '發布日期分析任務',
        pattern: /發布日期分析/g,
        expected: 1,
      },
      {
        name: '新片 vs 舊片',
        pattern: /新片 vs 舊片/g,
        expected: 1,
      },
    ];

    console.log('\n📋 提示詞內容檢查:');
    let allChecksPassed = true;
    checks.forEach(check => {
      const matches = prompt.match(check.pattern);
      const count = matches ? matches.length : 0;
      const passed = count >= check.expected;
      const status = passed ? '✅' : '❌';
      if (!passed) allChecksPassed = false;
      console.log(`  ${status} ${check.name}: ${count} 次 (預期 ≥${check.expected} 次)`);
    });

    // 檢查是否包含所有影片的發布日期
    console.log('\n📋 影片發布日期檢查:');
    const allVideos = [...testData.videos, ...testData.analytics.bottomVideos];
    let allDatesPresent = true;
    allVideos.forEach(v => {
      const publishDate = new Date(v.publishedAt).toLocaleDateString('zh-TW');
      const hasDate = prompt.includes(publishDate);
      const status = hasDate ? '✅' : '❌';
      if (!hasDate) allDatesPresent = false;
      console.log(`  ${status} ${v.title}: ${publishDate}`);
    });

    // 顯示提示詞片段（包含 Top 影片部分）
    console.log('\n' + '='.repeat(80));
    console.log('提示詞片段預覽（Top 影片部分）');
    console.log('='.repeat(80));

    const topVideosMatch = prompt.match(/\*\*時段內熱門影片 Top.*?\n([\s\S]{0,1500})/);
    if (topVideosMatch) {
      console.log(topVideosMatch[0] + '\n...\n');
    } else {
      console.log('⚠️ 找不到 Top 影片區段');
    }

    console.log('\n' + '='.repeat(80));
    if (allChecksPassed && allDatesPresent) {
      console.log('✅ 所有測試通過');
    } else {
      console.log('❌ 部分測試失敗');
    }
    console.log('='.repeat(80));

    console.log('\n📝 測試結論:');
    console.log(`${allChecksPassed ? '✅' : '❌'} 提示詞內容檢查`);
    console.log(`${allDatesPresent ? '✅' : '❌'} 發布日期完整性檢查`);

    if (allChecksPassed && allDatesPresent) {
      console.log('\n🎉 完整測試結論:');
      console.log('1. ✅ 發布日期已正確傳遞到提示詞');
      console.log('2. ✅ 提示詞明確說明「並非期間內上傳的影片」');
      console.log('3. ✅ 提示詞顯示「實際上傳影片數」作為對比');
      console.log('4. ✅ 分析任務包含「新片 vs 舊片」對比分析');
      console.log('5. ✅ AI 可以區分熱門影片中的新片和舊片');
    }

    return allChecksPassed && allDatesPresent ? 0 : 1;

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    console.error(error.stack);
    return 1;
  }
}

// 執行測試
runTest().then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error('❌ 測試執行錯誤:', err);
  process.exit(1);
});
