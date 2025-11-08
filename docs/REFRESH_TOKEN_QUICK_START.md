# Refresh Token 快速設定（3 分鐘）

## 🚀 最快的方法：從已登入的應用程式取得

### 步驟 1：啟動並登入（30 秒）

```bash
npm run dev:all
```

這會同時啟動前端（3000）和後端（3001）

開啟瀏覽器 http://localhost:3000 並登入 YouTube

**端口說明**：
- 前端 UI：http://localhost:3000
- 後端 API：http://localhost:3001

### 步驟 2：取得 Refresh Token（30 秒）

按 `F12` 開啟開發者工具，在 Console 執行：

```javascript
const tokenData = JSON.parse(localStorage.getItem('youtubeContentAssistant.oauthToken'));
copy(tokenData.token.refresh_token);
console.log('✅ Refresh Token 已複製！');
console.log('格式範例:', tokenData.token.refresh_token.substring(0, 20) + '...');
```

Refresh Token 已複製到剪貼簿！
- 格式：`1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 步驟 3：取得 Client Secret（1 分鐘）

1. 前往 https://console.cloud.google.com/apis/credentials
2. 找到你的 OAuth 2.0 Client ID（就是你的 `YOUTUBE_CLIENT_ID`）
3. 點擊進入，複製 `Client Secret`
   - 格式：`GOCSPX-xxxxxxxxxxxxxxxxxxxxx`

### 步驟 4：設定環境變數（30 秒）

在 `.env.local` 新增或修改：

```bash
# YouTube Refresh Token（新增這 2 行）
YOUTUBE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx

# 其他已有的設定
YOUTUBE_CLIENT_ID=xxxxx.apps.googleusercontent.com
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx
GITHUB_GIST_TOKEN=ghp_xxxxxxxxxxxxxx
GITHUB_GIST_ID=abc123...（如果已有）
```

### 步驟 5：測試（30 秒）

```bash
npm run update-cache
```

成功的話會看到：
```
🔄 使用 refresh token 取得 access token...
✅ Access token 取得成功（有效期限: 3599 秒）
```

---

## 🎯 設定 GitHub Secrets（用於 GitHub Actions）

前往 GitHub repo → Settings → Secrets → Actions

新增或更新以下 secrets（GitHub 不接受 `GITHUB_` 前綴，因此使用 `VIDEO_CACHE_*`，workflow 會映射成對應的 `GITHUB_GIST_*` 環境變數）：

```
YOUTUBE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CLIENT_ID=xxxxx.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx
VIDEO_CACHE_GIST_TOKEN=ghp_xxxxxxxxxxxxxx
VIDEO_CACHE_GIST_ID=abc123...
VIDEO_CACHE_GIST_FILENAME=youtube-videos-cache.json (選填)
```

---

## ✅ 完成！

現在你的系統：
- ✅ Token 永久有效，不會過期
- ✅ GitHub Actions 每天自動更新快取
- ✅ 完全無需人工介入

---

## 📍 去哪取得？

**Refresh Token**：
→ 從已登入的應用程式取得（最簡單）
→ 詳細步驟：[GET_REFRESH_TOKEN.md](./GET_REFRESH_TOKEN.md)

**Client Secret**：
→ Google Cloud Console：https://console.cloud.google.com/apis/credentials
→ 找到你的 OAuth Client → 查看詳情 → 複製 Client Secret

**Client ID**（你已經有）：
→ 就是你的 `.env.local` 中的 `YOUTUBE_CLIENT_ID`

---

## 🛠 故障排除

**Q: 找不到 Client Secret？**
A: Google Cloud Console → APIs & Services → Credentials → 點擊你的 OAuth 2.0 Client

**Q: Refresh Token 無效？**
A: 重新登入應用程式，再次從 localStorage 取得新的 token

**Q: GitHub Actions 失敗？**
A: 檢查 Secrets 是否都設定正確，名稱是否有拼錯

---

## 📚 詳細文檔

- [完整取得指南](./GET_REFRESH_TOKEN.md) - 3 種取得方法
- [GitHub Actions 設定](./github-actions-setup.md) - 完整設定指南
- [快速開始](./QUICK_START_GITHUB_ACTIONS.md) - 5 分鐘設定
