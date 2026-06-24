# 頻道儀錶板 - 時間範圍動態分析

## 概述

頻道儀錶板採用**分層數據獲取策略**，並支援**時間範圍動態過濾**，讓你查看不同時間段內的頻道與影片表現。

觀看相關數據（觀看次數、觀看時間、熱門影片）**以 YouTube Analytics API 為主要來源**，可取得「該時間段內實際產生」的真實數據；當 Analytics API 無法使用時，會自動退回 Gist 快取方案（顯示時間範圍內發布影片的累計數據）。頻道總體統計（訂閱數、總觀看數）則由 YouTube Data API 提供。

## 核心功能

### ⏰ 時間範圍選擇

快速範圍（`QUICK_DATE_PRESETS`，定義於 `components/ChannelDashboard.tsx`）：

- **過去 7 天**（`7d`）
- **過去 30 天**（`30d`，預設值）
- **過去 90 天**（`90d`）
- **本月**（`this_month`）：當月 1 號到可用的最近一天
- **上月**（`last_month`）：上個月 1 號到月底

也可自訂起訖日期。

> **資料延遲說明：** YouTube Analytics API 的數據比 YouTube Studio 約晚 1 天，實務上最晚僅能查到「今天往前 3 天」。程式以常數 `ANALYTICS_DATA_DELAY_DAYS = 3` 計算各範圍的可用結束日（`getAnalyticsAvailableEndDate`），因此快速範圍的結束日通常不是「今天」。

### 📊 動態 KPI 指標

所有指標會根據選擇的時間範圍自動更新：

1. **觀看次數**（`viewsInRange`）：時間範圍內產生的觀看數（Analytics API）
2. **觀看時間**（`watchTimeHours`）：時間範圍內的觀看時長，來自 Analytics 的 `estimatedMinutesWatched` 換算為小時
3. **時間範圍內影片數**（`videosInRange`）：由 Gist 快取計算（範圍內發布、且 `privacyStatus = public` 的影片數）
4. **總訂閱數 / 總觀看數**：頻道整體統計（YouTube Data API），其中總訂閱數會調整為「期間結束日」的值
5. **淨訂閱增長 / 平均觀看時長 / 平均觀看百分比**：來自 Analytics API

### 🏆 熱門影片列表

- 來自 Analytics API 的影片級別查詢（`dimensions=video`，依觀看數排序，取前 50）
- 影片標題／描述由 YouTube Data API 與 Gist 快取補齊
- 排序指標可切換：觀看次數、平均觀看百分比、分享次數、留言次數

## 觀看數據來源標記（viewingHoursSource）

儀錶板以狀態 `viewingHoursSource: 'analytics' | 'cache' | 'none'` 標記目前觀看數據的來源，並影響 UI 文案：

| 來源值 | 意義 | 副標題文案 |
| --- | --- | --- |
| `analytics` | 來自 YouTube Analytics API（真實時間段數據） | 「依據 YouTube Analytics（日粒度）」 |
| `cache` | 退回 Gist 快取估算 | 「依據歷來影片表現（估算）」 |
| `none` | 無數據 | 「依據觀眾實際上線時間」 |

## 重要說明

⚠️ **數據解讀提示：**

- 當來源為 **`analytics`** 時，「觀看次數」「觀看時間」是該時間段內**實際產生**的數據。
- 當退回 **`cache`** 時，顯示的是「時間範圍內**發布**影片」的累計數據（從發布至今的所有觀看數），而非該時間段內產生的觀看；此時介面會提示需在 Google Cloud Console 啟用 YouTube Analytics API。
- 「時間範圍內影片數」一律由 Gist 快取依發布日計算，與觀看數據來源無關。

## 數據獲取策略

### 策略 1：頻道總體資料（OAuth + YouTube Data API）

**適用範圍：**

- 頻道訂閱數（`subscriberCount`）
- 頻道總觀看次數（`viewCount`）
- 頻道總影片數（`videoCount`）

**實現方式：**

```typescript
// YouTube Data API channels.list
GET https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true
```

**程式碼位置：** `fetchChannelStats`（`components/ChannelDashboard.tsx`）

**備註：** 總訂閱數會調整為「期間結束日」的值，而非當前即時值——優先用 Analytics 取得截至該日的累積訂閱數（`fetchTotalSubscribersAtDate`），失敗時再以「期間結束日後的訂閱變化」回推（`fetchSubscribersAfterEndDate`）。

---

### 策略 2：觀看數據（主要來源：YouTube Analytics API）

所有 Analytics 查詢都透過 `queryYoutubeAnalytics` 經 `gapi.client.request` 呼叫，自動帶上 OAuth 認證；401 時會登出並提示重新登入。

**2A. 頻道級別數據** — `fetchChannelAnalytics`

```typescript
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage
```

回傳單行數據，依序解析為觀看次數、觀看分鐘數（÷60 換算小時）、新增/取消訂閱（取淨值）、平均觀看時長（秒）、平均觀看百分比。

**2B. 影片級別數據（熱門影片）** — `fetchVideoAnalytics`

```typescript
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &startDate=YYYY-MM-DD
  &endDate=YYYY-MM-DD
  &metrics=views,averageViewPercentage,comments,likes,shares
  &dimensions=video
  &sort=-views
  &maxResults=50
```

取得排序後的影片 ID 與指標後，由 `fetchTopVideosFromAnalytics` 補上標題、描述與縮圖（YouTube Data API + Gist 快取）。

**其他衍生查詢** 也走相同的 Analytics API，例如：流量來源（`fetchTrafficSourcesData`）、環比/同比對比（`fetchComparisonData`）、人口統計（`fetchDemographicsData`）、裝置類型（`fetchDeviceData`）、訂閱來源（`fetchSubscriberSourcesData`）、Shorts vs 一般影片（`fetchContentTypeMetrics`，使用 `dimensions=creatorContentType`）、熱門 Shorts / 一般影片排行、日趨勢（`fetchTrendData`）等。

---

### 策略 3：影片等級資料（Gist 快取，作為 fallback 與補充）

Gist 快取扮演兩個角色：

1. **補充**：提供影片標題、縮圖、發布日期等 metadata，用來補齊 Analytics 回傳的影片清單，並計算「時間範圍內影片數」。
2. **Fallback**：當 `fetchChannelAnalytics` 回傳空 rows（Analytics API 不可用）時，`fetchVideosInRange` 改用快取顯示「時間範圍內發布影片」的累計數據，此時 `viewingHoursSource` 為 `cache` 或 `none`。

**實現方式：**

```typescript
// 從 Gist 快取讀取（前端呼叫後端 API）
GET /api/video-cache/search?query=&maxResults=10000
```

前端以 `ensureVideoCache` 載入一次並快取於記憶體（`videoCacheRef`），供整個刷新流程共用。

**Gist 快取數據結構：**

```javascript
{
  videoId: string,          // 影片 ID（注意不是 id）
  title: string,            // 標題
  thumbnail: string,        // 縮圖 URL（注意不是 thumbnailUrl）
  publishedAt: string,      // 發布日期
  viewCount: number,        // 觀看數
  likeCount: number,        // 讚數
  commentCount: number,     // 評論數
  tags: string[],           // 標籤
  categoryId: string,       // 分類 ID
  privacyStatus: string     // 隱私狀態
}
```

**Fallback 觀看時間估算（僅 `cache` 來源）：** 真實觀看時長需 Analytics API；fallback 時 `fetchVideosInRange` 以「平均影片長度 10 分鐘、平均觀看百分比 40%」粗估，僅供參考。

**字段映射說明：**

```typescript
// Gist 快取 → 儀錶板顯示
videoId      → id
thumbnail    → thumbnailUrl
viewCount    → viewCount
likeCount    → likeCount
commentCount → commentCount
```

**限制：**

- 快取需定期更新（執行 `npm run update-cache`），數據新鮮度取決於更新頻率。
- 字段名與 YouTube API 不完全一致，需要映射。

---

## 使用流程

### 1. 前置設定

```bash
# 1. 設定環境變數（.env.local）
GITHUB_GIST_ID=your_gist_id
GITHUB_GIST_TOKEN=your_github_token
YOUTUBE_CLIENT_ID=your_youtube_client_id

# 2. 生成影片快取
npm run update-cache

# 3. 啟動應用
npm run dev:all
```

> **權限提醒：** 觀看數據以 YouTube Analytics API 為主，需在 Google Cloud Console 啟用 **YouTube Analytics API**，且 OAuth 授權範圍需包含 Analytics 唯讀權限。若未啟用或未授權，儀錶板會自動退回 Gist 快取方案並提示。

### 2. 使用儀錶板

1. 進入「頻道分析」頁面
2. 點擊「頻道儀錶板」分頁
3. 登入 YouTube 帳號（如果尚未登入）
4. 選擇時間範圍並刷新數據
5. 查看頻道統計與熱門影片

---

## 數據流程

```
用戶點擊「刷新數據」
    ↓
1. 檢查 OAuth Token（youtubeService.getAccessToken）
    ↓
2. [時間範圍內影片數] → Gist 快取 → countPublicUploadsInRange
    ↓
3. [頻道總體統計] → YouTube Data API → fetchChannelStats
    ↓
4. [觀看數據] → YouTube Analytics API
      ├─ fetchChannelAnalytics（頻道級別）
      └─ fetchVideoAnalytics（影片級別 / 熱門影片）
    ↓
5a. 若 Analytics 有資料 → viewingHoursSource = 'analytics'
      → 顯示真實時間段數據，並抓取流量來源/對比/人口/裝置等衍生數據
    ↓
5b. 若 Analytics 無資料 → fetchVideosInRange（Gist 快取 fallback）
      → viewingHoursSource = 'cache' / 'none'，顯示「發布影片累計數據」並提示
```

---

## 程式碼結構

### 主要文件

1. **components/ChannelDashboard.tsx**
   - 儀錶板主組件、數據獲取邏輯與 UI 渲染
   - Analytics 查詢：`queryYoutubeAnalytics`、`fetchChannelAnalytics`、`fetchVideoAnalytics` 等
   - Fallback：`fetchVideosInRange`、`ensureVideoCache`
   - 頻道統計：`fetchChannelStats`
   - 時間範圍：`QUICK_DATE_PRESETS`、`getQuickDateRange`、`getAnalyticsAvailableEndDate`

2. **components/ChannelAnalytics.tsx**
   - 頻道分析頁面，整合儀錶板與報表功能、分頁切換

3. **server.js**
   - API 路由定義
   - `GET /api/video-cache/search` 端點（呼叫 `loadFromGist` + `searchVideosFromCache` 讀取 Gist 快取）

4. **services/videoCacheService.js**
   - Gist 快取服務、影片搜尋與過濾

---

## 最佳實踐

### 1. 定期更新快取

快取主要供影片 metadata 補齊與 fallback 使用，建議每天更新一次：

```bash
# 手動更新
npm run update-cache

# 或設定 cron job（Linux/Mac）
0 0 * * * cd /path/to/project && npm run update-cache
```

### 2. 監控配額使用

- YouTube Data API 配額：[Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)
- 觀看數據刷新會額外使用 YouTube Analytics API 的查詢配額，刷新一次會發出多個 Analytics 查詢（頻道級別、影片級別、流量來源、對比、人口、裝置等），請留意總用量。

### 3. 錯誤處理

如果看到「YouTube Analytics API 不可用」或退回快取的提示：

```bash
# 1. 確認 Google Cloud Console 已啟用 YouTube Analytics API
# 2. 確認 OAuth 授權範圍包含 Analytics 唯讀權限，必要時重新登入
# 3. 重新整理頁面
```

如果看到「缺少 GITHUB_GIST_ID 環境變數」：

```bash
# 1. 檢查環境變數
cat .env.local | grep GITHUB_GIST_ID

# 2. 生成快取
npm run update-cache

# 3. 重新整理頁面
```

---

## 常見問題

### Q：觀看次數是「該時間段產生」還是「期間發布影片的累計」？

**A：** 視來源而定。`viewingHoursSource = 'analytics'` 時是該時間段內實際產生的數據；退回 `cache` 時則是「時間範圍內發布影片」的累計觀看數。介面會以副標題與提示文案標示。

### Q：為什麼結束日不是「今天」？

**A：** YouTube Analytics 數據有延遲，程式以 `ANALYTICS_DATA_DELAY_DAYS = 3` 計算可用的最近結束日，因此快速範圍的結束日通常是今天往前 3 天。

### Q：頻道統計（訂閱數、總觀看數）會快取嗎？

**A：** 不會，每次都從 YouTube Data API 即時獲取；其中總訂閱數會調整為「期間結束日」的值。

### Q：熱門影片數據從哪裡來？

**A：** 主要來自 Analytics API（影片級別查詢），標題/縮圖/描述由 YouTube Data API 與 Gist 快取補齊；Analytics 不可用時改由快取依觀看數排序。

---

## 更新日誌

### 2026-06-24

- 文件重寫，使其與現行實作一致。
- 觀看數據改以 **YouTube Analytics API 為主要來源**，Gist 快取退為 fallback／metadata 補充。
- 時間範圍新增「本月／上月」，並說明 Analytics 3 天資料延遲。
- 新增 `viewingHoursSource`（`analytics` / `cache` / `none`）來源標記說明。
- 移除已不適用的「零配額」「不需 Analytics 權限」等敘述。

### 2025-11-12

- 實現分層數據獲取策略（頻道統計用 YouTube Data API、影片用 Gist 快取）。
- 添加數據來源說明與完整錯誤處理。
