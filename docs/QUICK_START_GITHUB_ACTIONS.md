# GitHub Actions 快速開始 - 5 分鐘設定指南

## 🚀 快速設定（5 個步驟）

### 1️⃣ 建立 GitHub Token（1 分鐘）

前往 https://github.com/settings/tokens → Generate new token (classic)
- 勾選 `gist`
- 複製 token：`ghp_xxxxxx...`

### 2️⃣ 取得 YouTube 資訊（1 分鐘）

**Channel ID**：
```
前往 youtube.com → 你的頻道 → 從 URL 複製
https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx
                                ↑↑↑ 這就是 Channel ID
```

**Access Token**：
```javascript
// 在應用程式登入後，在瀏覽器開發者工具執行：
localStorage.getItem('youtubeContentAssistant.oauthToken')
// 複製整個 token
```

### 3️⃣ 首次生成 Gist（2 分鐘）

在 `.env.local` 設定：
```bash
YOUTUBE_ACCESS_TOKEN=你的token
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx
GITHUB_GIST_TOKEN=ghp_xxxxxx...
```

執行：
```bash
npm run server     # 終端 1
npm run update-cache  # 終端 2
```

**複製輸出的 Gist ID**：`abc123...`

### 4️⃣ 設定 GitHub Secrets（1 分鐘）

前往 GitHub repo → Settings → Secrets → New secret

新增 4 個 secrets：
```
YOUTUBE_ACCESS_TOKEN
YOUTUBE_CHANNEL_ID
GITHUB_GIST_TOKEN
GITHUB_GIST_ID
```

### 5️⃣ 推送並測試（30 秒）

```bash
git add .
git commit -m "Add auto cache update"
git push
```

前往 GitHub → Actions → Run workflow → 測試執行

---

## ✅ 完成！

現在系統會每天自動更新快取！

**執行時間**：每天台灣時間凌晨 2 點
**手動執行**：GitHub → Actions → Run workflow
**查看結果**：Actions 頁面查看執行記錄

---

## 🔧 常見問題

**Q: Token 會過期嗎？**
A: 會，建議每 1-3 個月更新一次 `YOUTUBE_ACCESS_TOKEN`

**Q: 如何修改執行時間？**
A: 編輯 `.github/workflows/update-video-cache.yml` 中的 cron 設定

**Q: 為什麼沒有自動執行？**
A: GitHub Actions 有延遲（最多 15 分鐘），或手動觸發測試

**Q: 如何查看 Gist？**
A: https://gist.github.com/你的用戶名/你的gist_id

---

## 📚 詳細文檔

完整設定指南：[github-actions-setup.md](./github-actions-setup.md)
