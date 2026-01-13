# 測試與驗證

## 可用腳本

- `npm run update-cache`：更新影片快取（呼叫 API）
- `node scripts/test-gist.js`：測試 Gist 讀寫
- `node scripts/test-channel-analytics-with-cache.js`：測試頻道分析搭配快取
- `node scripts/update-cache-tags.js`：更新快取中的 tags

## 手動驗證建議

1. 前端能否正常載入影片清單與快取
2. 頻道分析是否成功產生報告
3. 文章生成是否包含截圖
4. Notion 發佈是否成功
