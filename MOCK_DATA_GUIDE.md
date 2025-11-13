# Mock 資料模式使用指南

此分支已配置完整的 mock 資料系統，讓你能夠在不需要真實 YouTube API 金鑰的情況下展示所有 dashboard 功能。

## 功能特色

✅ **完整的 Dashboard 資料** - 包含所有圖表、統計數據和視覺化元素
✅ **真實的資料結構** - Mock 資料完全符合實際 API 回應格式
✅ **適合截圖展示** - 精心設計的數據呈現最佳視覺效果
✅ **無需 API 金鑰** - 無需設定 YouTube 或 Gemini API 憑證

## 包含的 Mock 資料

### 1. 頻道儀表板 (ChannelDashboard)
- 頻道總體統計（訂閱數、觀看數、觀看時長）
- 熱門影片列表（可依觀看數、分享數、留言數排序）
- 趨勢圖表（過去 30 天）
- 月度數據（過去 12 個月）
- 流量來源分析
- 搜尋關鍵字統計
- 人口統計資料
- 地理位置分佈
- 裝置類型分析
- 觀看時段熱力圖
- 訂閱來源分析
- 環比/同比數據對比
- Shorts vs 一般影片對比
- 熱門 Shorts 列表

### 2. 關鍵字報表 (ChannelAnalytics)
- 多關鍵字組合分析
- 多時間範圍對比
- 完整的影片數據指標

### 3. 影片分析 (VideoAnalytics)
- 影片表現評分
- 流量來源詳細分析
- 關鍵字優化建議
- SEO 改善建議

## 啟動方式

### 方法 1：使用環境變數檔案（推薦）

1. 複製 mock 環境變數檔案：
```bash
cp .env.mock .env.local
```

2. 啟動開發伺服器：
```bash
npm run dev:all
```

3. 開啟瀏覽器訪問：
```
http://localhost:3000
```

### 方法 2：手動設定環境變數

在啟動伺服器前設定環境變數：

**Linux/macOS:**
```bash
export ENABLE_MOCK_DATA=true
npm run dev:all
```

**Windows (PowerShell):**
```powershell
$env:ENABLE_MOCK_DATA="true"
npm run dev:all
```

**Windows (CMD):**
```cmd
set ENABLE_MOCK_DATA=true
npm run dev:all
```

## 使用流程

### 1. 查看頻道儀表板

1. 啟動應用後，前往「頻道分析」分頁
2. 點擊「頻道儀表板」子分頁
3. 所有數據會自動載入，無需登入 YouTube

你將看到：
- 📊 完整的頻道統計卡片
- 📈 互動式趨勢圖表
- 🎥 熱門影片排行榜
- 🌍 地理位置和人口統計
- ⏰ 觀眾觀看時段分析

### 2. 查看關鍵字報表

1. 前往「關鍵字報表」子分頁
2. 添加關鍵字組合（例如：「AI」、「YouTube 優化」）
3. 選擇時間範圍（例如：「過去 7 天」、「本月」）
4. 點擊「獲取數據」
5. 系統會返回 mock 資料並顯示在表格中

### 3. 查看影片分析

1. 前往「影片分析」標籤頁
2. 選擇年份範圍（預設 1 年）
3. 點擊「開始分析」
4. 查看所有影片的表現評分和優化建議

## Mock 資料 API Endpoints

所有以下 API endpoints 在 Mock 模式下都會返回假資料：

- `POST /api/dashboard/data` - 頻道儀表板資料
- `POST /api/analytics/channel` - 影片分析資料
- `POST /api/analytics/keyword-analysis` - 關鍵字分析
- `POST /api/channel-analytics/aggregate` - 頻道分析聚合資料
- `GET /api/video-cache` - 影片快取資料

## 截圖建議

為了獲得最佳的截圖效果：

### 頻道儀表板
1. ✅ 使用「過去 30 天」作為時間範圍（資料最豐富）
2. ✅ 切換不同的熱門影片指標（觀看數、分享數等）來展示不同排序
3. ✅ 展示趨勢圖表的互動功能（滑鼠懸停顯示詳細資料）
4. ✅ 捲動到下方展示完整的統計卡片

### 關鍵字報表
1. ✅ 添加 3-5 個關鍵字組合展示對比效果
2. ✅ 選擇多個時間範圍展示趨勢變化
3. ✅ 選擇多個數據指標展示完整資訊

### 影片分析
1. ✅ 展示優先級評分最高的影片
2. ✅ 點擊展開詳細資料和關鍵字建議
3. ✅ 展示流量來源分析圖表

## 資料特點

- **真實性**：所有數據都模擬真實 YouTube 頻道的合理範圍
- **多樣性**：包含各種類型的影片（教學、分享、Shorts）
- **完整性**：涵蓋所有 dashboard 功能需要的資料欄位
- **美觀性**：數據經過精心設計，呈現最佳視覺效果

## 關閉 Mock 模式

要返回正常模式（使用真實 API）：

1. 修改 `.env.local` 檔案
2. 將 `ENABLE_MOCK_DATA=true` 改為 `ENABLE_MOCK_DATA=false`
3. 設定真實的 API 金鑰
4. 重新啟動伺服器

## 技術細節

### Mock 資料服務位置
- `services/mockDataService.js` - 主要 mock 資料生成服務
- 包含所有資料生成函數和預設影片資料

### 修改過的檔案
- `server.js` - 添加 mock 資料模式檢查和條件分支
- API endpoints 在 mock 模式下直接返回假資料

### 資料生成邏輯
- 使用隨機數生成合理範圍的統計數據
- 預設影片庫包含 12 支不同類型的影片
- 時間序列資料使用實際日期計算確保一致性

## 常見問題

**Q: Mock 模式下需要登入 YouTube 嗎？**
A: 不需要。Mock 模式完全繞過 YouTube OAuth 流程。

**Q: Mock 資料會改變嗎？**
A: 每次刷新頁面或重新獲取資料時，數值會有隨機變化，但保持在合理範圍內。

**Q: 可以自訂 Mock 資料嗎？**
A: 可以。編輯 `services/mockDataService.js` 中的預設值和生成邏輯。

**Q: Mock 模式影響其他功能嗎？**
A: Mock 模式只影響 dashboard 相關的 API。文章生成、中繼資料生成等功能不受影響（但仍需相應的 API 金鑰）。

## 支援

如有任何問題或需要調整 mock 資料，請查看：
- `services/mockDataService.js` - 資料生成邏輯
- `server.js` - API endpoint 實作
- `.env.mock` - 環境變數範例

---

**提示**：此 mock 資料系統專為展示和截圖目的設計。在生產環境中請使用真實的 API 和資料。
