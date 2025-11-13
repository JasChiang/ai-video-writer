# 頻道儀錶板 - 時間範圍動態分析

## 概述

頻道儀錶板採用**混合數據獲取策略**，並支援**時間範圍動態過濾**，讓你可以查看不同時間段內發布影片的表現。

## 核心功能

### ⏰ 時間範圍選擇
- **過去 7 天**：查看最近一週發布的影片表現
- **過去 30 天**：查看最近一個月發布的影片表現
- **過去 90 天**：查看最近三個月發布的影片表現

### 📊 動態 KPI 指標
所有指標會根據選擇的時間範圍自動更新：
1. **觀看次數**：時間範圍內發布影片的總觀看數
2. **觀看時間**：基於觀看次數估算的觀看時長（小時）
3. **訂閱人數**：頻道總訂閱數（不受時間範圍影響）

### 🏆 熱門影片列表
- 顯示時間範圍內發布的影片
- 按總觀看數排序（Top 10）
- 自動隨時間範圍變動

## 重要說明

⚠️ **數據解讀提示：**
- 「觀看次數」和「觀看時間」是指**時間範圍內發布影片**的累計數據
- **不是**該時間段內產生的觀看數
- 例如：選擇「過去 30 天」，顯示的是最近 30 天發布的影片，從發布至今的所有觀看數

💡 **為什麼這樣設計：**
- 真實的「時間段內觀看數」需要 YouTube Analytics API（需要額外申請權限）
- 目前方案零配額成本，適合快速查看新發布影片的初期表現
- 可以評估新內容的吸引力和初期表現

## 數據獲取策略

### 策略 1: 頻道等級資料（使用 OAuth + YouTube Data API）

**適用範圍：**
- 頻道訂閱數 (subscriberCount)
- 頻道總觀看次數 (viewCount)

**實現方式：**
```typescript
// 使用 YouTube Data API channels.list
GET https://www.googleapis.com/youtube/v3/channels
  ?part=statistics
  &mine=true
```

**配額成本：** 1 單位

**優點：**
- 即時數據
- 官方 API，數據準確
- 僅需 1 單位配額（非常低）

**程式碼位置：** `components/ChannelDashboard.tsx:83`

**注意：** 雖然 API 也會返回 `videoCount`，但我們不使用它，而是從快取計算，確保數據一致性。

---

### 策略 2: 影片等級資料（使用 Gist 快取）

**適用範圍：**
- 影片總數（從快取計算）
- 熱門影片列表（Top 10）
- 影片標題、觀看數、讚數、評論數
- 影片縮圖（使用快取中的 `thumbnail` 字段）
- 發布日期

**實現方式：**
```typescript
// 從 Gist 快取讀取
GET /api/video-cache/search
  ?query=
  &maxResults=10000
```

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

**配額成本：** 0 單位（零配額！）

**優點：**
- 零配額成本
- 可獲取大量影片數據（支持 10000+）
- 支援快速排序和篩選
- 包含評論數（commentCount）
- 縮圖 URL 直接可用（format: `https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg`）

**限制：**
- 需要定期更新快取（執行 `npm run update-cache`）
- 數據更新頻率取決於快取更新頻率
- 字段名與 YouTube API 不完全一致（需要映射）

**程式碼位置：** `components/ChannelDashboard.tsx:149`

**字段映射說明：**
```typescript
// Gist 快取 → 儀錶板顯示
videoId      → id
thumbnail    → thumbnailUrl
viewCount    → viewCount
likeCount    → likeCount
commentCount → commentCount
```

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

### 2. 使用儀錶板

1. 訪問「頻道分析」頁面
2. 點擊「頻道儀錶板」分頁
3. 登入 YouTube 帳號（如果尚未登入）
4. 點擊「刷新數據」按鈕
5. 查看頻道統計和熱門影片

### 3. 配額使用情況

每次刷新儀錶板：
- **頻道統計**：1 單位（YouTube API）
- **熱門影片**：0 單位（Gist 快取）
- **總計**：1 單位

對比傳統方式（獲取 100 支影片詳情）：
- 傳統方式：~10 單位
- 優化方式：1 單位
- **節省 90% 配額！**

---

## 配額優化對比

### 傳統方式（未優化）

```
1. 獲取頻道統計: 1 單位
2. 獲取影片列表: 2 單位 (playlistItems.list)
3. 獲取影片詳情: 8 單位 (videos.list, 100 影片)
總計: 11 單位
```

### 優化方式（當前實現）

```
1. 獲取頻道統計: 1 單位 (YouTube API)
2. 獲取影片列表: 0 單位 (Gist 快取)
總計: 1 單位
節省: 90.9%
```

---

## 程式碼結構

### 主要文件

1. **components/ChannelDashboard.tsx**
   - 儀錶板主組件
   - 實現數據獲取邏輯
   - UI 渲染

2. **components/ChannelAnalytics.tsx**
   - 頻道分析頁面
   - 整合儀錶板和報表功能
   - 分頁切換

3. **server.js**
   - API 路由定義
   - `/api/video-cache/search` 端點
   - 支援 Gist 快取讀取

4. **services/videoCacheService.js**
   - Gist 快取服務
   - 影片搜尋和過濾

---

## 最佳實踐

### 1. 定期更新快取

建議每天更新一次影片快取：

```bash
# 手動更新
npm run update-cache

# 或設定 cron job（Linux/Mac）
0 0 * * * cd /path/to/project && npm run update-cache
```

### 2. 監控配額使用

訪問 [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas) 監控配額使用情況。

### 3. 錯誤處理

如果看到錯誤訊息「未設定 Gist 快取」：

```bash
# 1. 檢查環境變數
cat .env.local | grep GITHUB_GIST_ID

# 2. 生成快取
npm run update-cache

# 3. 重新整理頁面
```

---

## 進階功能（未來擴展）

### YouTube Analytics API 整合

如果需要更詳細的數據分析（如趨勢圖表），可以整合 YouTube Analytics API：

```typescript
// 獲取觀看次數趨勢
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &startDate=2024-01-01
  &endDate=2024-01-31
  &metrics=views,subscribersGained
  &dimensions=day
```

**配額成本：** 每次查詢約 1-2 單位

---

## 常見問題

### Q: 為什麼熱門影片數據不是即時的？

**A:** 熱門影片使用 Gist 快取，數據更新頻率取決於 `npm run update-cache` 的執行頻率。建議每天更新一次。

### Q: 可以手動刷新熱門影片數據嗎？

**A:** 可以。執行 `npm run update-cache` 後，重新整理儀錶板即可看到最新數據。

### Q: 頻道統計數據會快取嗎？

**A:** 不會。頻道統計（訂閱數、總觀看數）每次都從 YouTube API 即時獲取，確保數據最新。

### Q: 配額用完了怎麼辦？

**A:** YouTube Data API 每天有 10,000 單位配額。使用優化策略後，每次刷新僅需 1 單位，可以刷新 10,000 次。如果仍然不夠，可以：
1. 申請配額增加
2. 使用服務帳號分散配額
3. 延長快取更新週期

---

## 技術細節

### 數據流程圖

```
用戶點擊「刷新數據」
    ↓
1. 檢查 OAuth Token
    ↓
2a. [頻道統計] → YouTube API → 1 單位
    ↓
2b. [熱門影片] → Gist 快取 → 0 單位
    ↓
3. 合併數據並顯示
```

### API 調用順序

```javascript
// 1. 獲取頻道統計（1 單位）
fetchChannelStats(token)
  → YouTube Data API: channels.list

// 2. 獲取熱門影片（0 單位）
fetchTopVideos()
  → Backend API: /api/video-cache/search
  → Gist Cache: loadFromGist()
  → 排序並取前 10 名
```

---

## 貢獻

如果您有任何改進建議或發現問題，請：

1. 提交 Issue
2. 發起 Pull Request
3. 聯繫開發團隊

---

## 授權

MIT License

---

## 更新日誌

### 2025-11-12
- ✅ 實現混合數據獲取策略
- ✅ 頻道統計使用 YouTube API（1 單位）
- ✅ 熱門影片使用 Gist 快取（0 單位）
- ✅ 節省 90% 配額使用
- ✅ 添加數據來源說明
- ✅ 完整錯誤處理和日誌記錄
