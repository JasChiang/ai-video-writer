# 🚀 影片快取功能 - 5 分鐘快速設定

## 為什麼要使用快取？

**省錢！省配額！**

- ❌ **不使用快取**：每次搜尋消耗 100 配額
- ✅ **使用快取**：每次搜尋消耗 0 配額

YouTube API 每天只有 10,000 配額，100 次搜尋就用完了！
使用快取後，可以無限次搜尋，完全不消耗配額。

## 📝 設定步驟（本地使用）

### 1️⃣ 取得 GitHub Personal Access Token

1. 前往：https://github.com/settings/tokens
2. 點擊 `Generate new token (classic)`
3. 設定：
   - Note: `YouTube Video Cache`
   - Scopes: 勾選 `gist`
4. 複製 token

### 2️⃣ 設定環境變數

編輯 `.env.local`，加入：

```env
# GitHub Gist（影片快取）
GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_GIST_ID=                    # 第一次執行後會取得
GITHUB_GIST_FILENAME=youtube-videos-cache.json  # 可選
```

### 3️⃣ 首次建立快取

```bash
# 確保伺服器正在運行
npm run dev

# 在另一個終端執行
npm run update-cache
```

**輸出範例**：
```
✅ 快取更新成功！
========================================
📊 總影片數：100
🆔 Gist ID：abc123def456...
🔗 Gist URL：https://gist.github.com/...
📅 更新時間：2024-01-01T02:00:00.000Z
========================================

⚠️  重要提示：
這是首次建立 Gist，請將以下 Gist ID 加入環境變數：

GITHUB_GIST_ID=abc123def456...
```

### 4️⃣ 將 Gist ID 加入環境變數

複製輸出的 Gist ID，更新 `.env.local`：

```env
GITHUB_GIST_ID=abc123def456...
```

### 5️⃣ 重新啟動前端

```bash
# 停止目前的開發伺服器（Ctrl+C）
# 重新啟動
npm run dev
```

## ✅ 驗證設定

1. **測試搜尋**：在文章工作區搜尋影片
2. **檢查 Console**：應該看到 `[ArticleWorkspace] 使用 Gist 快取搜尋`
3. **確認配額**：不應該消耗 YouTube API 配額

## 🤖 設定 GitHub Actions 自動更新（選填）

如果希望每天自動更新快取，參考 [GitHub Actions 設定指南](./GITHUB_ACTIONS_SETUP.md)

## 📊 快取資料結構

每支影片包含：
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "影片標題",
  "tags": ["標籤1", "標籤2", "標籤3"],
  "categoryId": "28",
  "viewCount": 12345,
  "likeCount": 678,
  "commentCount": 90,
  "publishedAt": "2024-01-01T00:00:00Z",
  "thumbnail": "https://i.ytimg.com/vi/...",
  "privacyStatus": "public"
}
```

**注意**：描述（description）為節省空間未包含在快取中，需要時會即時從 YouTube API 抓取。

## 🔄 手動更新快取

隨時可以執行：
```bash
npm run update-cache
```

建議更新頻率：
- 頻繁上傳影片：每天更新
- 偶爾上傳：每週更新
- 使用 GitHub Actions：每天自動更新

## 🐛 常見問題

### Q: 搜尋不到最新的影片？
**A**: 需要手動更新快取：`npm run update-cache`

### Q: 出現 404 錯誤？
**A**: 檢查 `GITHUB_GIST_ID` 和 `GITHUB_GIST_TOKEN` 是否正確

### Q: 私人影片也會被快取嗎？
**A**: 是的！只要你用 OAuth 登入，所有影片（包括私人、未列出）都會被快取

### Q: 快取會過期嗎？
**A**: 不會。快取永久有效，直到你手動更新

### Q: 可以分享 Gist 給別人嗎？
**A**: 不建議。Gist 設為私人比較安全

## 📈 效能對比

| 操作 | 不使用快取 | 使用快取 |
|------|-----------|---------|
| 搜尋 1 次 | 100 配額 | 0 配額 |
| 搜尋 10 次 | 1,000 配額 | 0 配額 |
| 搜尋 100 次 | 10,000 配額（用完！） | 0 配額 |
| 更新快取（含統計資訊） | - | 50-150 配額/天 * |

\* 配額依影片數量而定。3000 支影片約消耗 60-80 配額。

## 🎯 下一步

- ✅ 設定本地快取（你現在在這裡）
- [ ] 設定 [GitHub Actions 自動更新](./GITHUB_ACTIONS_SETUP.md)
- [ ] 了解 [完整快取系統](./video-cache-setup.md)

---

**恭喜！** 🎉 你已經設定好影片快取功能，可以開始無限搜尋了！
