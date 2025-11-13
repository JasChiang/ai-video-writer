/**
 * Mock 資料服務
 *
 * 提供完整的 mock 資料用於 dashboard 截圖展示
 * 包含所有儀表板功能的假資料
 */

// 生成隨機數字
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) => {
  const num = Math.random() * (max - min) + min;
  return parseFloat(num.toFixed(decimals));
};

// 生成日期字符串
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// 生成過去 N 天的日期
const getPastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// 頻道影片 Mock 資料
const mockVideos = [
  {
    videoId: 'dQw4w9WgXcQ',
    title: '如何用 AI 提升 YouTube 影片表現：完整指南',
    thumbnail: 'https://picsum.photos/seed/video1/480/360',
    publishedAt: '2024-10-15T10:00:00Z',
    viewCount: 152340,
    likeCount: 8234,
    commentCount: 432,
    tags: ['AI', 'YouTube', '教學', '影片優化'],
    categoryId: '28',
    privacyStatus: 'public'
  },
  {
    videoId: 'jNQXAC9IVRw',
    title: '2024 YouTube Analytics 完整解析｜數據分析實戰',
    thumbnail: 'https://picsum.photos/seed/video2/480/360',
    publishedAt: '2024-10-20T14:30:00Z',
    viewCount: 98765,
    likeCount: 5432,
    commentCount: 289,
    tags: ['YouTube', 'Analytics', '數據分析'],
    categoryId: '28',
    privacyStatus: 'public'
  },
  {
    videoId: 'jNQXAC9IVRz',
    title: '5 個讓觀眾秒點的標題技巧｜SEO 優化實測',
    thumbnail: 'https://picsum.photos/seed/video3/480/360',
    publishedAt: '2024-10-25T09:15:00Z',
    viewCount: 76543,
    likeCount: 4123,
    commentCount: 198,
    tags: ['SEO', '標題優化', 'YouTube技巧'],
    categoryId: '22',
    privacyStatus: 'public'
  },
  {
    videoId: 'M7lc1UVf-VE',
    title: '我如何在 30 天內讓頻道成長 10 倍｜實戰分享',
    thumbnail: 'https://picsum.photos/seed/video4/480/360',
    publishedAt: '2024-11-01T16:45:00Z',
    viewCount: 234567,
    likeCount: 12345,
    commentCount: 876,
    tags: ['頻道成長', 'YouTube策略', '創作者心得'],
    categoryId: '22',
    privacyStatus: 'public'
  },
  {
    videoId: 'oHg5SJYRHA0',
    title: 'YouTube Shorts 爆紅秘訣｜短影音製作攻略',
    thumbnail: 'https://picsum.photos/seed/video5/480/360',
    publishedAt: '2024-11-05T12:00:00Z',
    viewCount: 543210,
    likeCount: 28901,
    commentCount: 1234,
    tags: ['Shorts', '短影音', 'YouTube'],
    categoryId: '24',
    privacyStatus: 'public',
    isShort: true
  },
  {
    videoId: 'RgKAFK5djSk',
    title: '頻道流量來源分析｜我的觀眾從哪裡來？',
    thumbnail: 'https://picsum.photos/seed/video6/480/360',
    publishedAt: '2024-09-10T08:30:00Z',
    viewCount: 45678,
    likeCount: 2345,
    commentCount: 123,
    tags: ['流量分析', 'YouTube教學', '數據'],
    categoryId: '28',
    privacyStatus: 'public'
  },
  {
    videoId: 'RgKAFK5djSl',
    title: '提升觀看時長的 7 個技巧｜觀眾留不住？試試這些方法',
    thumbnail: 'https://picsum.photos/seed/video7/480/360',
    publishedAt: '2024-09-20T15:20:00Z',
    viewCount: 67890,
    likeCount: 3456,
    commentCount: 234,
    tags: ['觀看時長', '內容優化', 'YouTube'],
    categoryId: '22',
    privacyStatus: 'public'
  },
  {
    videoId: 'fJ9rUzIMcZQ',
    title: '我的影片製作流程大公開｜從企劃到上架',
    thumbnail: 'https://picsum.photos/seed/video8/480/360',
    publishedAt: '2024-08-15T11:00:00Z',
    viewCount: 123456,
    likeCount: 6789,
    commentCount: 456,
    tags: ['影片製作', '創作流程', 'YouTube'],
    categoryId: '26',
    privacyStatus: 'public'
  },
  {
    videoId: 'fJ9rUzIMcZR',
    title: '新手創作者常犯的 10 個錯誤｜避開這些坑',
    thumbnail: 'https://picsum.photos/seed/video9/480/360',
    publishedAt: '2024-08-25T13:45:00Z',
    viewCount: 89012,
    likeCount: 4567,
    commentCount: 345,
    tags: ['新手教學', 'YouTube技巧', '創作者'],
    categoryId: '27',
    privacyStatus: 'public'
  },
  {
    videoId: 'dQw4w9WgXcR',
    title: '如何設計吸睛的縮圖｜點擊率提升 300%',
    thumbnail: 'https://picsum.photos/seed/video10/480/360',
    publishedAt: '2024-07-10T10:30:00Z',
    viewCount: 198765,
    likeCount: 10234,
    commentCount: 678,
    tags: ['縮圖設計', 'CTR優化', 'YouTube'],
    categoryId: '26',
    privacyStatus: 'public'
  },
  {
    videoId: 'short1',
    title: '30 秒教你優化 YouTube 標題 #Shorts',
    thumbnail: 'https://picsum.photos/seed/short1/480/360',
    publishedAt: '2024-11-08T09:00:00Z',
    viewCount: 876543,
    likeCount: 45678,
    commentCount: 2345,
    tags: ['Shorts', 'YouTube技巧', '標題優化'],
    categoryId: '24',
    privacyStatus: 'public',
    isShort: true
  },
  {
    videoId: 'short2',
    title: '演算法最愛的 3 種內容 #Shorts',
    thumbnail: 'https://picsum.photos/seed/short2/480/360',
    publishedAt: '2024-11-10T14:00:00Z',
    viewCount: 654321,
    likeCount: 34567,
    commentCount: 1876,
    tags: ['Shorts', 'YouTube演算法', '內容策略'],
    categoryId: '24',
    privacyStatus: 'public',
    isShort: true
  }
];

// 生成 Channel Dashboard 需要的統計資料
const generateChannelStats = () => {
  return {
    totalSubscribers: 125680,
    totalViews: 8976543,
    viewsInRange: 456789,
    watchTimeHours: 23456,
    subscribersGained: 3245,
    videosInRange: 12
  };
};

// 生成趨勢資料（過去 30 天）
const generateTrendData = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = getPastDate(i);
    const topVideo = i % 5 === 0 ? mockVideos[randomInt(0, 3)] : null;
    data.push({
      date: formatDate(date),
      views: randomInt(10000, 25000),
      subscribers: randomInt(50, 200),
      topVideo: topVideo ? {
        id: topVideo.videoId,
        title: topVideo.title,
        thumbnailUrl: topVideo.thumbnail,
        views: randomInt(5000, 15000)
      } : null
    });
  }
  return data;
};

// 生成月度資料（過去 12 個月）
const generateMonthlyData = () => {
  const data = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const subscribersGained = randomInt(1000, 5000);
    const subscribersLost = randomInt(100, 800);

    data.push({
      month,
      views: randomInt(300000, 800000),
      watchTimeHours: randomInt(15000, 35000),
      subscribersGained,
      subscribersLost,
      subscribersNet: subscribersGained - subscribersLost,
      isCurrentMonth: i === 11
    });
  }
  return data;
};

// 生成流量來源資料
const generateTrafficSources = () => {
  const sources = [
    { source: 'YouTube 搜尋', views: 145678, percentage: 31.8 },
    { source: '建議影片', views: 123456, percentage: 27.0 },
    { source: '瀏覽功能', views: 89012, percentage: 19.5 },
    { source: '外部來源', views: 56789, percentage: 12.4 },
    { source: '播放清單', views: 23456, percentage: 5.1 },
    { source: '其他', views: 18398, percentage: 4.2 }
  ];
  return sources;
};

// 生成外部來源詳細資料
const generateExternalSources = () => {
  return [
    { source: 'Google 搜尋', views: 28945, percentage: 51.0 },
    { source: 'Facebook', views: 12345, percentage: 21.7 },
    { source: 'Twitter', views: 8901, percentage: 15.7 },
    { source: 'Instagram', views: 4567, percentage: 8.0 },
    { source: '其他網站', views: 2031, percentage: 3.6 }
  ];
};

// 生成搜尋關鍵字資料
const generateSearchTerms = () => {
  return [
    { term: 'YouTube 優化技巧', views: 23456 },
    { term: 'AI 影片製作', views: 18901 },
    { term: 'YouTube Analytics 教學', views: 15678 },
    { term: '提升觀看次數', views: 12345 },
    { term: 'YouTube SEO', views: 10234 },
    { term: '影片標題優化', views: 8901 },
    { term: 'YouTube 演算法', views: 7654 },
    { term: '縮圖設計技巧', views: 6543 },
    { term: 'YouTube Shorts 策略', views: 5432 },
    { term: '頻道成長秘訣', views: 4321 }
  ];
};

// 生成人口統計資料
const generateDemographics = () => {
  const ageGroups = ['age13-17', 'age18-24', 'age25-34', 'age35-44', 'age45-54', 'age55-64', 'age65-'];
  const genders = ['male', 'female'];
  const data = [];

  for (const ageGroup of ageGroups) {
    for (const gender of genders) {
      const percentage = randomFloat(0.5, 15.0);
      if (percentage > 2.0) {  // 只顯示比較有意義的數據
        data.push({
          ageGroup,
          gender,
          viewsPercentage: percentage
        });
      }
    }
  }

  return data.sort((a, b) => b.viewsPercentage - a.viewsPercentage).slice(0, 10);
};

// 生成地理位置資料
const generateGeography = () => {
  const countries = [
    { code: 'TW', name: '台灣' },
    { code: 'US', name: '美國' },
    { code: 'HK', name: '香港' },
    { code: 'JP', name: '日本' },
    { code: 'SG', name: '新加坡' },
    { code: 'MY', name: '馬來西亞' },
    { code: 'CN', name: '中國' },
    { code: 'CA', name: '加拿大' },
    { code: 'AU', name: '澳洲' },
    { code: 'GB', name: '英國' }
  ];

  return countries.map((country, index) => ({
    country: country.code,
    views: randomInt(100000, 10000) * (10 - index),
    percentage: randomFloat(1.0, 35.0 - index * 3)
  })).sort((a, b) => b.views - a.views);
};

// 生成裝置類型資料
const generateDevices = () => {
  return [
    { deviceType: 'MOBILE', views: 245678, percentage: 53.7 },
    { deviceType: 'DESKTOP', views: 156789, percentage: 34.3 },
    { deviceType: 'TABLET', views: 34567, percentage: 7.6 },
    { deviceType: 'TV', views: 19754, percentage: 4.4 }
  ];
};

// 生成觀看時段資料
const generateViewingHours = () => {
  const data = [];
  for (let day = 0; day <= 6; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // 製造一些峰值時段
      let baseViews = randomInt(100, 500);
      if (hour >= 19 && hour <= 22) {
        baseViews *= 3; // 晚上時段流量較高
      } else if (hour >= 12 && hour <= 14) {
        baseViews *= 2; // 中午時段流量中等
      }

      data.push({
        dayOfWeek: day,
        hour,
        views: baseViews
      });
    }
  }
  return data;
};

// 生成訂閱來源資料
const generateSubscriberSources = () => {
  return mockVideos.slice(0, 5).map((video, index) => ({
    videoId: video.videoId,
    videoTitle: video.title,
    subscribersGained: randomInt(500, 2000) * (5 - index)
  }));
};

// 生成對比資料
const generateComparisonData = (currentValue) => {
  const previous = randomInt(currentValue * 0.7, currentValue * 1.3);
  const yearAgo = randomInt(currentValue * 0.5, currentValue * 1.5);
  const changeFromPrevious = currentValue - previous;
  const changeFromYearAgo = currentValue - yearAgo;

  return {
    current: currentValue,
    previous,
    yearAgo,
    changeFromPrevious,
    changeFromPreviousPercent: previous ? (changeFromPrevious / previous * 100) : 0,
    changeFromYearAgo,
    changeFromYearAgoPercent: yearAgo ? (changeFromYearAgo / yearAgo * 100) : 0
  };
};

// 生成內容類型指標（Shorts vs 一般影片）
const generateContentTypeMetrics = () => {
  return {
    shorts: {
      views: 1530864,
      watchTime: 45678,
      likes: 79245,
      shares: 12345,
      comments: 5678,
      videoCount: 3
    },
    regularVideos: {
      views: 1234567,
      watchTime: 234567,
      likes: 65432,
      shares: 8901,
      comments: 4567,
      videoCount: 9
    }
  };
};

// 生成熱門影片資料（可依不同指標排序）
const generateTopVideos = (metric = 'views', limit = 10) => {
  const videos = mockVideos.map(video => ({
    id: video.videoId,
    title: video.title,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    avgViewPercentage: randomFloat(25, 75),
    shareCount: randomInt(100, 5000),
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnail
  }));

  // 依指標排序
  const sortKey = metric === 'avgViewPercent' ? 'avgViewPercentage' :
                  metric === 'shares' ? 'shareCount' :
                  metric === 'comments' ? 'commentCount' : 'viewCount';

  return videos.sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
};

// 生成熱門 Shorts 資料
const generateTopShorts = (limit = 5) => {
  const shorts = mockVideos.filter(v => v.isShort).map(video => ({
    id: video.videoId,
    title: video.title,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    avgViewPercentage: randomFloat(40, 85),  // Shorts 通常觀看完成率較高
    shareCount: randomInt(500, 10000),  // Shorts 分享數通常較高
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnail
  }));

  return shorts.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
};

// ======== Channel Analytics (關鍵字報表) Mock 資料 ========

// 生成頻道分析聚合資料
const generateChannelAnalyticsAggregate = (keywordGroups, dateRanges) => {
  const rows = keywordGroups.map(group => {
    const dateRangeData = {};

    dateRanges.forEach(range => {
      dateRangeData[range.label] = {
        views: randomInt(50000, 200000),
        estimatedMinutesWatched: randomInt(10000, 50000),
        averageViewDuration: randomInt(180, 600),
        averageViewPercentage: randomFloat(30, 70),
        likes: randomInt(1000, 10000),
        comments: randomInt(100, 1000),
        shares: randomInt(50, 500),
        subscribersGained: randomInt(50, 500),
        videoCount: randomInt(3, 15)
      };
    });

    return {
      name: group.name,
      keyword: group.keyword || group.name,
      videoCount: randomInt(5, 20),
      dateRanges: dateRangeData
    };
  });

  return {
    rows,
    summary: {
      totalKeywordGroups: keywordGroups.length,
      totalDateRanges: dateRanges.length,
      channelCountry: 'TW'
    }
  };
};

// ======== Video Analytics (影片分析) Mock 資料 ========

// 生成影片分析資料
const generateVideoAnalytics = (yearsToFetch = 1) => {
  const videos = mockVideos.slice(0, 8).map(video => ({
    videoId: video.videoId,
    title: video.title,
    description: `這是關於${video.title}的完整說明。本影片深入探討相關主題，提供實用技巧和專業建議。`,
    tags: video.tags,
    publishedAt: video.publishedAt,
    thumbnail: video.thumbnail,
    metrics: {
      views: video.viewCount,
      estimatedMinutesWatched: randomInt(video.viewCount * 2, video.viewCount * 5),
      averageViewDuration: randomInt(180, 480),
      averageViewPercentage: randomFloat(30, 75).toFixed(2),
      likes: video.likeCount,
      comments: video.commentCount,
      shares: randomInt(100, 2000),
      subscribersGained: randomInt(50, 500),
      likeRatio: (video.likeCount / video.viewCount * 100).toFixed(2)
    },
    trafficSources: {
      youtubeSearch: randomInt(20000, 60000),
      googleSearch: randomInt(10000, 30000),
      suggested: randomInt(30000, 80000),
      external: randomInt(5000, 20000),
      other: randomInt(2000, 10000),
      searchPercentage: randomFloat(25, 45).toFixed(2),
      topExternalSources: [
        { name: 'Google 搜尋', views: randomInt(5000, 15000) },
        { name: 'Facebook', views: randomInt(2000, 8000) },
        { name: 'Twitter', views: randomInt(1000, 5000) }
      ],
      externalDetailsLoaded: true
    },
    impressions: {
      impressions: randomInt(100000, 500000),
      clicks: randomInt(10000, 50000),
      ctr: randomFloat(8, 15)
    },
    priorityScore: randomFloat(60, 95),
    updateReasons: [
      '搜尋流量占比較高，優化關鍵字可提升曝光',
      'CTR 表現良好，建議繼續優化縮圖',
      '觀看時長有成長空間，可調整內容結構'
    ]
  }));

  // 依優先級分數排序
  return videos.sort((a, b) => b.priorityScore - a.priorityScore);
};

// 生成關鍵字分析資料
const generateKeywordAnalysis = (videoId) => {
  return {
    currentKeywords: {
      score: randomFloat(60, 85),
      strengths: [
        '包含主要目標關鍵字',
        '標題具有吸引力',
        '標籤使用得當'
      ],
      weaknesses: [
        '缺少長尾關鍵字',
        '說明文字可以更豐富',
        '部分標籤過於廣泛'
      ]
    },
    recommendedKeywords: {
      primary: ['YouTube 優化', 'AI 影片製作', '數據分析'],
      secondary: ['影片 SEO', '頻道成長', 'YouTube 教學'],
      longtail: ['如何優化 YouTube 影片', 'YouTube Analytics 完整教學', '提升影片觀看次數的方法']
    },
    titleSuggestions: [
      '【完整教學】如何用 AI 提升 YouTube 影片表現｜2024 最新策略',
      'YouTube 優化實戰：讓你的影片觀看次數暴增 300%',
      'AI + YouTube Analytics = 爆紅公式？數據分析師親自解密'
    ],
    descriptionTips: [
      '在前 150 字加入主要關鍵字',
      '添加時間戳記提升使用者體驗',
      '包含相關影片連結增加觀看時長',
      '加入社群媒體連結擴大影響力'
    ],
    actionPlan: {
      priority: '高',
      estimatedImpact: '觀看次數預計提升 20-35%',
      steps: [
        '更新標題，加入主要關鍵字',
        '優化說明文字前 150 字',
        '添加 3-5 個長尾關鍵字標籤',
        '製作新版縮圖測試 CTR'
      ]
    },
    metadataHints: {
      titleHooks: [
        '【2024 最新】',
        '完整教學',
        '親測有效',
        '新手必看',
        '實戰分享'
      ],
      descriptionAngles: [
        '解決痛點：你是否也遇到...',
        '提供價值：在這個影片中你會學到...',
        '建立信任：我花了 XX 時間測試...',
        '呼籲行動：記得訂閱頻道獲得更多...'
      ],
      callToActions: [
        '訂閱頻道獲得最新內容',
        '按讚支持創作',
        '留言分享你的想法',
        '分享給需要的朋友'
      ]
    }
  };
};

// ======== API Endpoints Mock 資料 ========

// Dashboard API
export const getMockDashboardData = (startDate, endDate, topVideoMetric = 'views') => {
  return {
    channelStats: generateChannelStats(),
    topVideos: generateTopVideos(topVideoMetric, 10),
    trendData: generateTrendData(),
    monthlyData: generateMonthlyData(),
    trafficSources: generateTrafficSources(),
    externalSources: generateExternalSources(),
    searchTerms: generateSearchTerms(),
    demographics: generateDemographics(),
    geography: generateGeography(),
    devices: generateDevices(),
    viewingHours: generateViewingHours(),
    viewingHoursSource: 'analytics',
    subscriberSources: generateSubscriberSources(),
    avgViewDuration: randomInt(200, 400),
    avgViewPercentage: randomFloat(40, 65),
    viewsComparison: generateComparisonData(456789),
    watchTimeComparison: generateComparisonData(23456),
    subscribersComparison: generateComparisonData(3245),
    contentTypeMetrics: generateContentTypeMetrics(),
    topShorts: generateTopShorts()
  };
};

// Channel Analytics Aggregate API
export const getMockChannelAnalyticsAggregate = (keywordGroups, dateRanges) => {
  return generateChannelAnalyticsAggregate(keywordGroups, dateRanges);
};

// Video Analytics API
export const getMockVideoAnalytics = (yearsToFetch = 1) => {
  const recommendations = generateVideoAnalytics(yearsToFetch);
  return {
    success: true,
    totalVideos: recommendations.length,
    recommendations
  };
};

// Keyword Analysis API
export const getMockKeywordAnalysis = (videoId) => {
  return {
    success: true,
    analysis: generateKeywordAnalysis(videoId)
  };
};

// Video Cache (用於 Dashboard)
export const getMockVideoCache = () => {
  return mockVideos;
};

// 導出 mock 開關設定（可在環境變數中控制）
export const ENABLE_MOCK_DATA = process.env.ENABLE_MOCK_DATA === 'true' ||
                                 process.env.NODE_ENV === 'development';
