# 頻道儀錶板時間範圍功能更新

## 📅 更新日期
2025-11-12

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
- **觀看次數**：時間範圍內發布影片的總觀看數
- **觀看時間**：基於觀看次數估算（小時）
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

### 3. 觀看時間估算

由於沒有 YouTube Analytics API 權限，使用以下公式估算：

```typescript
// 假設
const avgVideoDurationMinutes = 10;    // 平均影片長度 10 分鐘
const avgWatchPercentage = 0.4;        // 平均觀看完成率 40%

// 計算
const watchTimePerView =
  avgVideoDurationMinutes * 60 * avgWatchPercentage;

const totalWatchTimeSeconds =
  viewCount * watchTimePerView;

const watchTimeHours =
  Math.floor(totalWatchTimeSeconds / 3600);
```

## 🔄 數據流程

```
用戶選擇時間範圍（7天/30天/90天）
    ↓
計算 startDate 和 endDate
    ↓
從 Gist 快取獲取所有影片（零配額）
    ↓
根據 publishedAt 過濾時間範圍內的影片
    ↓
計算統計數據：
  - 觀看次數（累加所有影片的 viewCount）
  - 觀看時間（基於觀看次數估算）
  - 影片數（時間範圍內發布的影片數量）
    ↓
更新 KPI 卡片和熱門影片列表
```

## ⚠️ 重要注意事項

### 數據解讀
1. **「觀看次數」是累計數據**
   - 顯示時間範圍內**發布影片**的總觀看數
   - 包含從發布至今的所有觀看
   - **不是**該時間段內產生的觀看數

2. **示例說明**
   ```
   選擇「過去 30 天」:
   - 篩選：2025-10-13 ~ 2025-11-12 發布的影片
   - 統計：這些影片從發布至今的總觀看數
   - 如果某影片 2025-10-20 發布，有 10,000 觀看
   - 這 10,000 觀看包含在統計中
   ```

3. **真實時間段數據**
   - 需要 YouTube Analytics API
   - 可查詢「2025-10-13 ~ 2025-11-12 期間產生的觀看數」
   - 需要額外申請 API 權限

### 為什麼這樣設計？

✅ **優點：**
- 零配額成本
- 快速查看新內容表現
- 評估新影片初期吸引力
- 無需額外 API 權限

❌ **限制：**
- 不是真實時間段內觀看數
- 觀看時間是估算值
- 無法查詢特定時間段的真實觀看表現

## 📁 修改文件列表

### 主要文件
1. **components/ChannelDashboard.tsx**
   - 重新設計 `ChannelStats` 接口
   - 實現 `getDateRange()` 函數
   - 實現 `fetchVideosInRange()` 函數
   - 更新 KPI 卡片顯示（3 個指標）
   - 添加 `useEffect` 監聽時間範圍變化
   - 更新數據來源說明

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
# 4. 切換時間範圍（7天/30天/90天）
# 5. 觀察 KPI 和熱門影片是否變化
```

### 2. 控制台日誌檢查
```
[Dashboard] 📅 時間範圍: xx/xx/xxxx - xx/xx/xxxx
[Dashboard] ✅ 從快取載入 1234 支影片
[Dashboard] 📊 時間範圍內發布的影片: 56 支
[Dashboard] 📈 時間範圍內統計: {
  videosInRange: 56,
  totalViews: 123456,
  watchTimeHours: 4567
}
[Dashboard] 🏆 時間範圍內熱門影片: 10 支
```

### 3. 數據驗證
- [ ] 切換時間範圍後，觀看次數應該變化
- [ ] 切換時間範圍後，熱門影片列表應該變化
- [ ] 訂閱人數不應隨時間範圍變化
- [ ] 觀看時間應該與觀看次數成正比

## 🚀 未來擴展

### YouTube Analytics API 整合
如果獲得 Analytics API 權限，可以實現：

```typescript
// 獲取真實時間段內觀看數
const analyticsData = await fetchYouTubeAnalytics({
  startDate: '2025-10-13',
  endDate: '2025-11-12',
  metrics: 'views,estimatedMinutesWatched,subscribersGained',
  dimensions: 'day'
});

// 更新 KPI
setChannelStats({
  viewsInRange: analyticsData.views,        // 真實時間段觀看數
  watchTimeHours: analyticsData.watchTime,  // 真實觀看時長
  subscribersGained: analyticsData.subs,    // 時間段內新增訂閱
});
```

**配額成本：** 約 1-2 單位

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

3. **數據估算**
   - 在缺乏真實數據時使用合理假設
   - 清楚標註估算值
   - 提供改進路徑（Analytics API）

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

此次更新成功實現了時間範圍動態過濾功能，讓用戶可以：
- 查看不同時間段發布影片的表現
- 評估新內容的初期吸引力
- 零配額成本查看數據

雖然目前無法獲取真實時間段內的觀看數據，但通過合理的設計和清晰的說明，提供了一個實用且高效的解決方案。
