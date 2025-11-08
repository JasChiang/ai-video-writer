# 影片快取系統設定指南

這個系統將你的所有影片標題快取到 GitHub Gist，讓搜尋功能更快速且節省 YouTube API 配額。

## 📋 系統架構

```
1. 每日定期任務
   → 掃描所有影片（playlistItems.list，只要 snippet）
   → 提取 videoId + title
   → 上傳到 GitHub Gist
   → 配額成本：80-160（2000 個影片）

2. 用戶搜尋流程
   → 從 Gist 載入快取（或使用 localStorage）
   → 前端過濾出所有匹配的 videoId
   → videos.list 分批載入詳細資訊（每批 50 個）
   → 配額成本：8 × (匹配影片數 / 50)
```

## 🔧 設定步驟

### 1. 建立 GitHub Personal Access Token

1. 前往 https://github.com/settings/tokens
2. 點擊「Generate new token」→「Generate new token (classic)」
3. 勾選 `gist` 權限
4. 點擊「Generate token」
5. 複製 token（格式：`ghp_xxxxxxxxxxxxxx`）

### 2. 設定環境變數

編輯 `.env.local`：

```bash
GITHUB_GIST_TOKEN=ghp_your_token_here
```

### 3. 初次生成快取

有兩種方式：

#### 方式 A：使用前端 UI（推薦）

1. 登入 YouTube
2. 前往設定頁面
3. 點擊「生成影片快取」按鈕
4. 系統會自動：
   - 掃描所有影片
   - 上傳到 Gist
   - 顯示 Gist ID 和 URL

#### 方式 B：使用 API

```bash
POST http://localhost:3001/api/video-cache/generate
Content-Type: application/json

{
  "accessToken": "your_youtube_oauth_token",
  "channelId": "UCxxxxxxxxx",
  "gistToken": "ghp_xxxxxxxxx",
  "gistId": null  // 第一次設為 null，之後使用回傳的 ID
}
```

回應：

```json
{
  "success": true,
  "totalVideos": 1500,
  "gistId": "abc123...",
  "gistUrl": "https://gist.github.com/username/abc123...",
  "rawUrl": "https://gist.githubusercontent.com/...",
  "updatedAt": "2025-11-08T10:00:00.000Z"
}
```

### 4. 設定 GIST_ID

將回傳的 `gistId` 加到 `.env.local`：

```bash
GITHUB_GIST_ID=abc123...
```

### 5. 設定定期更新（選填）

#### 方式 A：使用 GitHub Actions（推薦）

創建 `.github/workflows/update-video-cache.yml`：

```yaml
name: Update Video Cache

on:
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨 2 點執行
  workflow_dispatch:  # 手動觸發

jobs:
  update-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Update video cache
        env:
          YOUTUBE_ACCESS_TOKEN: ${{ secrets.YOUTUBE_ACCESS_TOKEN }}
          YOUTUBE_CHANNEL_ID: ${{ secrets.YOUTUBE_CHANNEL_ID }}
          GITHUB_GIST_TOKEN: ${{ secrets.GITHUB_GIST_TOKEN }}
          GITHUB_GIST_ID: ${{ secrets.GITHUB_GIST_ID }}
        run: |
          curl -X POST http://localhost:3001/api/video-cache/generate \
            -H "Content-Type: application/json" \
            -d '{
              "accessToken": "'"$YOUTUBE_ACCESS_TOKEN"'",
              "channelId": "'"$YOUTUBE_CHANNEL_ID"'",
              "gistToken": "'"$GITHUB_GIST_TOKEN"'",
              "gistId": "'"$GITHUB_GIST_ID"'"
            }'
```

#### 方式 B：使用 cron job（Linux/Mac）

```bash
# 編輯 crontab
crontab -e

# 新增每日凌晨 2 點執行
0 2 * * * cd /path/to/ai-video-writer && npm run update-cache
```

創建 `scripts/update-cache.js`：

```javascript
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function updateCache() {
  const response = await fetch('http://localhost:3001/api/video-cache/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
      channelId: process.env.YOUTUBE_CHANNEL_ID,
      gistToken: process.env.GITHUB_GIST_TOKEN,
      gistId: process.env.GITHUB_GIST_ID,
    }),
  });

  const result = await response.json();
  console.log('快取更新完成:', result);
}

updateCache().catch(console.error);
```

在 `package.json` 新增腳本：

```json
{
  "scripts": {
    "update-cache": "node scripts/update-cache.js"
  }
}
```

## 📊 配額使用對比

### 傳統方式（每次搜尋都呼叫 playlistItems）

```
假設頻道有 2000 個影片，搜尋 10 次：

2000 個影片 = 40 頁
每次搜尋 = 40 × 14 = 560 配額
搜尋 10 次 = 5600 配額 ❌
```

### 使用 Gist 快取

```
初次生成快取：
2000 個影片 = 40 頁 × 2 配額 = 80 配額（只做一次）

搜尋「神來點蘋」（假設找到 10 個匹配）：
- 載入 Gist：0 配額（從 localStorage 或 Gist）
- 前端過濾：0 配額
- 載入 10 個影片詳情：1 × 8 = 8 配額

搜尋 10 次 = 80 配額 ✅
總計：80 + 80 = 160 配額（節省 97%！）
```

## 🎯 使用方式

### 前端使用快取搜尋

```typescript
import { loadCacheFromGist, searchInCache, loadVideoDetailsBatch } from './services/videoCacheService';

async function searchWithCache(keyword: string) {
  // 1. 載入快取
  const cache = await loadCacheFromGist(GIST_ID);

  // 2. 在快取中搜尋
  const matchedVideos = searchInCache(cache, keyword);
  console.log(`找到 ${matchedVideos.length} 個匹配影片`);

  // 3. 取得所有 videoId
  const videoIds = matchedVideos.map(v => v.videoId);

  // 4. 分批載入詳細資訊（每批 50 個）
  const detailedVideos = await loadVideoDetailsBatch(
    videoIds,
    50,
    (batch, batchIndex, totalBatches) => {
      console.log(`載入第 ${batchIndex}/${totalBatches} 批完成`);
      // 可以在這裡逐步顯示影片
    }
  );

  return detailedVideos;
}
```

## 🔄 快取更新機制

- **localStorage**: 24 小時有效
- **Gist**: 建議每日更新一次
- **手動更新**: 前端提供「刷新快取」按鈕

## 🛠 故障排除

### 問題 1: Gist 上傳失敗

```
錯誤: 401 Unauthorized
解決: 檢查 GITHUB_GIST_TOKEN 是否正確，是否有 gist 權限
```

### 問題 2: 快取載入失敗

```
錯誤: 404 Not Found
解決: 檢查 GITHUB_GIST_ID 是否正確
```

### 問題 3: 私人 Gist 無法載入

```
解決: 確保 GITHUB_GIST_TOKEN 有權限訪問該 Gist
```

## 📝 注意事項

1. **首次生成需要時間**：2000 個影片大約需要 2-3 分鐘
2. **配額限制**：初次生成會用 80-160 配額，請確保配額充足
3. **私人 Gist**：建議使用私人 Gist 保護頻道資訊
4. **定期更新**：建議每日更新一次，確保快取是最新的
5. **localStorage 限制**：大約 5-10 MB，可存 10000+ 個影片標題

## 🎉 完成！

現在你可以：
- ⚡ 即時搜尋所有影片（0 配額）
- 💰 大幅節省 API 配額（節省 97%）
- 📱 支援離線搜尋（localStorage）
- 🔄 自動每日更新快取
