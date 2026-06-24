# 頻道儀錶板時間範圍功能更新

## 📅 更新日期
2025-11-12（觀看時間資料來源已升級為 Analytics API）

## 🎯 更新目標
根據用戶需求，實現以下功能：
1. ❌ 移除總影片數 KPI
2. ✅ 保留觀看次數、訂閱人數
3. ✅ 新增觀看時間（小時）
4. ✅ 所有數據隨時間範圍選擇器變動
5. ✅ 熱門影片列表隨時間範圍變動

## 📊 更新內容

### 1. KPI 指標重新設計

#### 之前（4 個指標）
- 總觀看次數（頻道累計）
- 總訂閱數
- 總影片數
- 平均觀看次數

#### 現在（3 個指標）
- **觀看次數**：時間範圍內的觀看數（優先取自 Analytics API 的真實值）
- **觀看時間**：時間範圍內的真實觀看時長（小時，取自 Analytics API；無法取得時才回退估算）
- **訂閱人數**：頻道總訂閱數

### 2. 時間範圍動態過濾

#### 實現方式
```typescript
// 1. 獲取所有影片（從 Gist 快取）
const allVideos = await fetchFromGistCache();

// 2. 根據發布日期過濾
const videosInRange = allVideos.filter(v => {
  const publishDate = new Date(v.publishedAt);
  return publishDate >= startDate && publishDate <= endDate;
});

// 3. 計算時間範圍內的統計
const totalViews = videosInRange.reduce(
  (sum, v) => sum + v.viewCount, 0
);
```

#### 自動更新機制
```typescript
// 監聽時間範圍變化
useEffect(() => {
  if (channelStats) {
    fetchDashboardData(); // 自動重新獲取數據
  }
}, [timeRange]);
```

### 3. 觀看時間資料來源

觀看時間現在**優先取自 YouTube Analytics API 的真實 `estimatedMinutesWatched`**。
只有在 Analytics API 不可用時，才回退到舊版估算公式。

#### 主要來源：Analytics API（真實值）

`fetchChannelAnalytics()` 以 `channel==MINE` 查詢時間範圍內的頻道級別指標：

```typescript
// metrics 一次取回多項頻道級別數據
const data = await queryYoutubeAnalytics({
  ids: 'channel==MINE',
  startDate: formattedStartDate,
  endDate: formattedEndDate,
  metrics:
    'views,estimatedMinutesWatched,subscribersGained,subscribersLost,' +
    'averageViewDuration,averageViewPercentage',
});

// 取回後直接換算小時，無需估算
const watchTimeMinutes = parseInt(channelRow[1]) || 0;
const watchTimeHours = Math.floor(watchTimeMinutes / 60);
```

此時 `viewingHoursSource` 會被標記為 `'analytics'`，KPI 副標顯示「依據 YouTube Analytics（日粒度）」。

#### 備援來源：Gist 快取估算（fallback）

當 Analytics API 不可用（無權限／呼叫失敗／無資料）時，`fetchDashboardData()` 會回退到
`fetchVideosInRange()`，以下列公式估算觀看時間，並提示這是估算值：

```typescript
// 僅在 Analytics 不可用時使用的估算公式
const avgVideoDurationMinutes = 10;    // 假設平均影片長度 10 分鐘
const avgWatchPercentage = 0.4;        // 假設平均觀看完成率 40%

const watchTimePerView =
  avgVideoDurationMinutes * 60 * avgWatchPercentage;
const totalWatchTimeSeconds =
  viewCount * watchTimePerView;
const watchTimeHours =
  Math.floor(totalWatchTimeSeconds / 3600);
```

此時 `viewingHoursSource` 為 `'cache'`，KPI 副標顯示「依據歷來影片表現（估算）」。

## 🔄 數據流程

```
用戶選擇時間範圍（7天/30天/90天／本月／上月）
    ↓
計算 startDate 和 endDate
    ↓
優先：呼叫 YouTube Analytics API（fetchChannelAnalytics / fetchVideoAnalytics）
    ↓
  ┌─ 有 Analytics 資料 ──────────────────────────────┐
  │  使用真實值：                                     │
  │   - 觀看次數（views）                             │
  │   - 觀看時間（estimatedMinutesWatched → 小時）    │
  │   - 訂閱淨增長（subscribersGained - Lost）        │
  │   viewingHoursSource = 'analytics'                │
  └──────────────────────────────────────────────────┘
    ↓（若 Analytics 不可用）
  ┌─ 備援：fetchVideosInRange（Gist 快取，零配額）────┐
  │   - 從快取過濾 publishedAt 落在時間範圍內的影片    │
  │   - 觀看次數（累加 viewCount）                     │
  │   - 觀看時間（10 分鐘 × 40% 估算）                 │
  │   viewingHoursSource = 'cache'                     │
  └──────────────────────────────────────────────────┘
    ↓
更新 KPI 卡片和熱門影片列表
```

## ⚠️ 重要注意事項

### 數據解讀（依資料來源而不同）

儀錶板會依 `viewingHoursSource` 標示目前的資料來源，解讀方式也隨之不同：

1. **Analytics API 來源（`viewingHoursSource = 'analytics'`，主要情境）**
   - 觀看次數／觀看時間是該時間段內**實際產生**的真實數據（日粒度）
   - 觀看時間取自真實 `estimatedMinutesWatched`，非估算
   - 訂閱變化為時間段內淨增長（subscribersGained − subscribersLost）

2. **Gist 快取備援（`viewingHoursSource = 'cache'`，Analytics 不可用時）**
   - 「觀看次數」是**累計數據**：時間範圍內**發布影片**從發布至今的總觀看數，
     而非該時間段內產生的觀看數
   - 觀看時間為估算值（10 分鐘 × 40%）
   - 示例：
     ```
     選擇「過去 30 天」(備援模式):
     - 篩選：2025-10-13 ~ 2025-11-12 發布的影片
     - 統計：這些影片從發布至今的總觀看數
     - 若某影片 2025-10-20 發布、有 10,000 觀看，這 10,000 全數計入
     ```

### 為什麼保留快取備援？

✅ **優點：**
- 零配額成本
- 在無 Analytics 權限或 API 暫時不可用時仍能顯示概況
- 快速評估新影片初期吸引力

❌ **限制：**
- 為「累計」而非真實時間段內觀看數
- 觀看時間是估算值
- 無法呈現特定時間段的真實觀看表現

> 一般情況下會直接使用 Analytics API 的真實數據；只有當 API 無法取得資料時，
> 才會切換到此備援模式，並在 UI 上提示顯示的是估算／累計數據。

## 📁 修改文件列表

### 主要文件
1. **components/ChannelDashboard.tsx**
   - 重新設計 `ChannelStats` 接口
   - 時間範圍選擇器 `QUICK_DATE_PRESETS`：過去 7／30／90 天、本月（`this_month`）、上月（`last_month`）
   - 實現 `fetchChannelAnalytics()`：以 Analytics API 取得真實 `estimatedMinutesWatched` 等指標（主要來源）
   - 實現 `fetchVideosInRange()`：Analytics 不可用時的快取估算備援
   - 以 `viewingHoursSource`（`'analytics' | 'cache' | 'none'`）標示資料來源並切換 KPI 副標
   - 更新 KPI 卡片顯示（3 個指標）
   - 添加 `useEffect` 監聽時間範圍變化

### 文檔
2. **docs/CHANNEL_DASHBOARD.md**
   - 更新核心功能說明
   - 添加時間範圍選擇說明
   - 添加數據解讀提示
   - 更新配額使用說明

3. **docs/DASHBOARD_TIME_RANGE_UPDATE.md**（本文件）
   - 完整記錄此次更新

## 🧪 測試建議

### 1. 功能測試
```bash
# 1. 啟動應用
npm run dev:all

# 2. 訪問頻道儀錶板
# 3. 點擊「刷新數據」
# 4. 切換時間範圍（7天/30天/90天/本月/上月）
# 5. 觀察 KPI 和熱門影片是否變化
```

### 2. 控制台日誌檢查

正常情況（使用 Analytics API 真實數據）：
```
[Dashboard] 🚀 嘗試使用 YouTube Analytics API...
[Dashboard] 📊 從 Analytics API 獲取頻道級別數據...
[Dashboard] ✅ 使用 Analytics API 數據
[Dashboard] 📊 頻道統計 (Analytics API): {
  views: 123456,
  watchTimeHours: 4567,
  subscribersNet: 89,
  ...
}
```

備援情況（Analytics 不可用，回退快取估算）：
```
[Dashboard] ⚠️ Analytics API 不可用: ...
[Dashboard] ℹ️  回退到 Gist 快取方案
[Dashboard] 🎬 從 Gist 快取獲取影片資料（備援方案）...
[Dashboard] ✅ 從快取載入 1234 支影片
[Dashboard] 📊 時間範圍內發布的影片: 56 支
[Dashboard] 📈 時間範圍內統計: {
  videosInRange: 56,
  totalViews: 123456,
  watchTimeHours: 4567
}
```

### 3. 數據驗證
- [ ] 切換時間範圍後，觀看次數應該變化
- [ ] 切換時間範圍後，熱門影片列表應該變化
- [ ] 訂閱人數不應隨時間範圍變化
- [ ] 觀看時間應該與觀看次數成正比

## ✅ 已實作：YouTube Analytics API 整合

> 過去本節列為「未來擴展」。此整合**現已完成並作為主要資料來源**。

儀錶板載入時會優先呼叫 Analytics API 取得時間段內的真實數據：

```typescript
// fetchChannelAnalytics()：取得真實時間段內觀看數與觀看時長
const channelAnalytics = await fetchChannelAnalytics(startDate, endDate, token);

if (channelAnalytics?.rows?.length > 0) {
  const channelRow = channelAnalytics.rows[0];
  const views = parseInt(channelRow[0]) || 0;                 // 真實時間段觀看數
  const watchTimeHours = Math.floor((parseInt(channelRow[1]) || 0) / 60); // 真實觀看時長
  const subscribersNet = subscribersGained - subscribersLost;            // 淨增訂閱

  setChannelStats((prev) => ({
    ...prev,
    viewsInRange: views,
    watchTimeHours,
    subscribersGained: subscribersNet,
  }));
}
```

只有當 Analytics 無法取得資料時，才回退到上述「Gist 快取估算」備援。

**配額成本：** 每次 Analytics 查詢約 1-2 單位

## 📚 相關資源

- [YouTube Data API 文檔](https://developers.google.com/youtube/v3/docs)
- [YouTube Analytics API 文檔](https://developers.google.com/youtube/analytics)
- [配額計算器](https://developers.google.com/youtube/v3/determine_quota_cost)

## 🎓 學習要點

1. **時間範圍過濾**
   - 使用 `Date` 對象處理日期
   - `filter()` 方法過濾數組
   - `publishedAt` 字段格式處理

2. **React Hooks**
   - `useEffect` 監聽狀態變化
   - 依賴數組正確使用
   - 避免無限循環

3. **資料來源優先序與備援**
   - 優先使用 Analytics API 的真實數據
   - 在真實數據不可用時退回合理估算，並清楚標註為估算值
   - 以 `viewingHoursSource` 在 UI 上標示目前來源

## ✅ 驗收標準

- [x] 移除總影片數 KPI
- [x] 保留觀看次數和訂閱人數
- [x] 新增觀看時間（小時）
- [x] KPI 隨時間範圍選擇器變動
- [x] 熱門影片列表隨時間範圍變動
- [x] 清楚說明數據含義
- [x] 構建成功，無錯誤
- [x] 文檔完整

## 🏁 總結

此次更新成功實現了時間範圍動態過濾功能，並整合 YouTube Analytics API 作為主要資料來源，讓用戶可以：
- 查看不同時間段（含本月／上月）內的真實觀看表現
- 取得真實的觀看時間與淨增訂閱
- 在 Analytics 不可用時，仍以零配額的快取估算提供概況

觀看時間以 Analytics API 的真實 `estimatedMinutesWatched` 為主，估算公式僅作為備援，
並透過 `viewingHoursSource` 清楚標示目前的資料來源。
