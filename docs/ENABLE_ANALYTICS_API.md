# 啟用 YouTube Analytics API 指南

## 🎯 為什麼需要 Analytics API？

頻道儀錶板需要 YouTube Analytics API 來獲取**時間範圍內真實產生的觀看數據**，而不是累計數據。

### 有 Analytics API
- ✅ 顯示「過去 7 天內產生的觀看數」
- ✅ 顯示「過去 30 天內的真實觀看時長」
- ✅ 熱門影片基於時間範圍內的觀看數排序

### 沒有 Analytics API（備援模式）
- ⚠️ 顯示「過去 7 天發布影片的累計觀看數」
- ⚠️ 觀看時長基於估算
- ⚠️ 熱門影片基於總累計觀看數排序

---

## 📋 啟用步驟

### 1. 前往 Google Cloud Console

訪問：https://console.cloud.google.com/

### 2. 選擇你的項目

確保選擇了與 YouTube OAuth Client ID 相同的項目。

### 3. 啟用 YouTube Analytics API

1. 在左側選單點擊「API 和服務」→「資料庫」
2. 搜尋「YouTube Analytics API」
3. 點擊進入
4. 點擊「啟用」按鈕

### 4. 驗證權限

確保 OAuth 同意畫面包含以下 scope：

```
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/yt-analytics.readonly
```

#### 檢查步驟：
1. 「API 和服務」→「OAuth 同意畫面」
2. 點擊「編輯應用程式」
3. 在「Scopes」部分，確認已添加：
   - YouTube Data API v3 - `youtube.readonly`
   - **YouTube Analytics API - `yt-analytics.readonly`** ← 確保有這個

### 5. 重新授權

由於添加了新的 scope，需要重新授權：

1. 清除瀏覽器 localStorage：
   ```javascript
   // 在瀏覽器控制台執行
   localStorage.removeItem('youtubeContentAssistant.oauthToken');
   ```

2. 刷新頁面並重新登入 YouTube 帳號

3. 授權時會看到新的權限請求：
   - 「查看您的 YouTube Analytics 報告」

---

## ✅ 驗證是否成功

### 方法 1: 查看控制台日誌

打開瀏覽器開發者工具，刷新儀錶板，查看日誌：

**成功：**
```
[Dashboard] 📊 嘗試從 YouTube Analytics API 獲取時間範圍內數據...
[Dashboard] ✅ Analytics API 數據獲取成功
[Dashboard] ✅ 使用 Analytics API 數據
[Dashboard] 📊 Analytics 統計: {totalViews: 12345, watchTimeHours: 678, ...}
```

**失敗（備援模式）：**
```
[Dashboard] 📊 嘗試從 YouTube Analytics API 獲取時間範圍內數據...
[Dashboard] ⚠️ Analytics API 不可用，回退到 Gist 快取方案
[Dashboard] ℹ️ 回退到 Gist 快取方案
```

### 方法 2: 查看數據來源說明

儀錶板上方會顯示：

**成功：**
```
✅ 這是真實的時間段內數據，非累計數據
```

**失敗：**
```
⚠️ YouTube Analytics API 不可用。
顯示的是時間範圍內發布影片的累計數據...
```

### 方法 3: 查看 KPI 卡片提示

**成功：**
- 觀看次數：「時間範圍內實際產生的觀看數」
- 觀看時間：「時間範圍內實際觀看時長」

**失敗：**
- 觀看次數：「時間範圍內發布影片的累計數（備援模式）」
- 觀看時間：「估算值（基於平均觀看時長）」

---

## 🔧 常見問題

### Q1: 為什麼啟用後還是顯示備援模式？

**可能原因：**

1. **未重新授權**
   - 解決：清除 localStorage 並重新登入

2. **Scope 未正確設定**
   - 解決：檢查 OAuth 同意畫面的 Scopes
   - 確保包含 `yt-analytics.readonly`

3. **頻道沒有 Analytics 數據**
   - 解決：確保頻道已加入 YouTube 合作夥伴計畫
   - 或者頻道有足夠的歷史數據

### Q2: Analytics API 的配額成本是多少？

每次查詢約 **1-2 單位**：
- `youtube.channels.list`（頻道統計）: 1 單位
- `youtubeanalytics.reports.query`（Analytics 報告）: 1 單位
- **總計**: 2-3 單位

相比備援模式（1 單位），多消耗 1-2 單位，但獲得真實數據。

### Q3: 如何檢查 API 配額使用？

訪問：
https://console.cloud.google.com/apis/api/youtubeanalytics.googleapis.com/quotas

查看「Queries per day」配額使用情況。

---

## 📊 數據對比示例

### 場景：查看「過去 7 天」的數據

#### 有 Analytics API
```
時間範圍：2025-11-06 ~ 2025-11-12

影片 A（2025-11-08 發布）：
- 2025-11-08 產生 100 觀看
- 2025-11-09 產生 50 觀看
- 2025-11-10 產生 30 觀看
→ 儀錶板顯示：180 觀看（時間範圍內產生）

影片 B（2025-10-01 發布，總計 10,000 觀看）：
- 2025-11-06 ~ 2025-11-12 產生 200 觀看
→ 儀錶板顯示：200 觀看（時間範圍內產生）

總計：380 觀看
```

#### 沒有 Analytics API（備援）
```
時間範圍：2025-11-06 ~ 2025-11-12
（篩選這段時間內發布的影片）

影片 A（2025-11-08 發布）：
- 從發布至今累計 180 觀看
→ 儀錶板顯示：180 觀看（累計）

影片 B（2025-10-01 發布）：
- 不在時間範圍內發布，不計入

總計：180 觀看
```

### 結論

- **Analytics API**: 顯示所有影片在該時間段的觀看數（更準確）
- **備援模式**: 只顯示該時間段發布影片的累計觀看數（不準確）

---

## 🚀 API 請求示例

如果你想了解技術實現，以下是 API 請求示例：

```bash
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &startDate=2025-11-06
  &endDate=2025-11-12
  &metrics=views,estimatedMinutesWatched,subscribersGained
  &dimensions=video
  &sort=-views
  &maxResults=50

Authorization: Bearer YOUR_ACCESS_TOKEN
```

**返回格式：**
```json
{
  "kind": "youtubeAnalytics#resultTable",
  "columnHeaders": [
    {"name": "video", "columnType": "DIMENSION", "dataType": "STRING"},
    {"name": "views", "columnType": "METRIC", "dataType": "INTEGER"},
    {"name": "estimatedMinutesWatched", "columnType": "METRIC", "dataType": "INTEGER"},
    {"name": "subscribersGained", "columnType": "METRIC", "dataType": "INTEGER"}
  ],
  "rows": [
    ["VIDEO_ID_1", 1500, 3000, 50],
    ["VIDEO_ID_2", 1200, 2400, 30],
    ...
  ]
}
```

---

## 📚 相關資源

- [YouTube Analytics API 文檔](https://developers.google.com/youtube/analytics)
- [API 查詢參數說明](https://developers.google.com/youtube/analytics/v2/reports)
- [配額管理指南](https://developers.google.com/youtube/v3/guides/quota_and_compliance)
- [OAuth Scopes 參考](https://developers.google.com/identity/protocols/oauth2/scopes#youtube)

---

## 💡 總結

啟用 Analytics API 後，你將獲得：
- ✅ 真實的時間段內觀看數據
- ✅ 準確的觀看時長
- ✅ 更有價值的數據分析

如果暫時無法啟用，備援模式仍然可以：
- ⚠️ 查看新發布影片的表現
- ⚠️ 評估內容初期吸引力
- ⚠️ 零額外配額成本
