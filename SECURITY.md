# 🔒 Security Policy / 資安政策

> **Last Updated**: 2025-01-05
>
> 本文件說明 AI Video Writer 的資安政策、已知風險、最佳實踐，以及在開發、部署、使用時應該注意的資安事項。

---

## 📋 目錄

- [安全概覽](#安全概覽)
- [環境變數安全](#環境變數安全)
- [GitHub 上傳前檢查](#github-上傳前檢查)
- [Docker 部署安全](#docker-部署安全)
- [應用程式使用安全](#應用程式使用安全)
- [已知安全措施](#已知安全措施)
- [潛在風險與緩解](#潛在風險與緩解)
- [生產環境建議](#生產環境建議)
- [回報安全問題](#回報安全問題)

---

## 安全概覽

### 資料流向

```
使用者瀏覽器
    ↓ (僅 OAuth Token，不含 API Key)
前端 (React)
    ↓ (API 請求)
後端 (Express) ← 使用 GEMINI_API_KEY
    ↓ (API 請求)
Google APIs (Gemini, YouTube)
```

### 核心原則

1. **🔐 API Key 隔離**：敏感 API Key 僅存在於後端
2. **🚫 不信任輸入**：所有使用者輸入都需驗證
3. **📝 最小權限原則**：只請求必要的 API 權限
4. **🗑️ 定期清理**：自動刪除暫存檔案
5. **📊 透明記錄**：記錄關鍵操作（但不記錄敏感資訊）

---

## 環境變數安全

### ✅ 正確做法

**開發環境**：
```bash
# .env.local（已加入 .gitignore）
GEMINI_API_KEY=AIzaSy... # ✅ 僅在後端使用
YOUTUBE_CLIENT_ID=123...apps.googleusercontent.com # ✅ 可在前端使用（OAuth 標準）
FRONTEND_URL=http://localhost:3000
```

**生產環境**：
使用平台環境變數設定，**不要使用 .env 檔案**

| 部署平台 | 設定位置 |
|---------|---------|
| Render | Dashboard → Environment Variables |
| Vercel | Settings → Environment Variables |
| Railway | Variables → New Variable |
| Heroku | Settings → Config Vars |
| AWS | Systems Manager → Parameter Store |

### ❌ 錯誤做法

```javascript
// ❌ 絕對不要這樣做！
const GEMINI_API_KEY = "AIzaSyBZEgG6tydjmy..."; // Hard-coded API key

// ❌ 不要在前端使用
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); // 前端程式碼

// ❌ 不要提交到 Git
git add .env.local # 錯誤！
```

### 檢查環境變數是否安全

**檢查前端 build 結果**：
```bash
npm run build
grep -r "AIzaSy" dist/  # 應該找不到任何結果
grep -r "GEMINI_API_KEY" dist/  # 應該找不到任何結果
```

**檢查 Git 歷史記錄**：
```bash
# 檢查是否曾經提交過 .env.local
git log --all --full-history -- .env.local

# 檢查是否有 API Key 在歷史記錄中
git log -p | grep -i "AIzaSy"
```

如果發現問題，請參考 [清理 Git 歷史](#清理-git-歷史)。

---

## GitHub 上傳前檢查

### 上傳前安全檢查清單

```bash
# 1. 確認 .gitignore 包含敏感檔案
cat .gitignore | grep -E "\.env|temp_videos|temp_files|\.local"

# 2. 檢查是否有敏感檔案被追蹤
git status

# 3. 檢查 staged 的檔案
git diff --cached --name-only

# 4. 搜尋程式碼中的 API Key pattern
grep -r "AIzaSy[a-zA-Z0-9_-]{33}" . --exclude-dir=node_modules --exclude-dir=dist

# 5. 檢查是否有真實的 API Key
grep -r "secret_" . --exclude-dir=node_modules --exclude-dir=.git
```

### ✅ .gitignore 必須包含

```gitignore
# 環境變數
.env
.env.local
.env.*.local

# 暫存檔案
temp_videos/
temp_files/
*.mp4
*.webm

# 截圖
public/images/
*.jpg
*.png

# API Key 記錄檔（如果有）
*.key
*_credentials.json
```

### 清理 Git 歷史

如果不小心提交了 API Key：

```bash
# ⚠️ 警告：這會改寫 Git 歷史，需要 force push

# 1. 安裝 BFG Repo-Cleaner（推薦）
# 下載：https://rtyley.github.io/bfg-repo-cleaner/

# 2. 移除敏感檔案
bfg --delete-files .env.local

# 3. 清理 reflog
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Force push（如果已經 push 到 remote）
git push --force --all

# 5. 立即更換被洩漏的 API Key！
```

### GitHub Secret Scanning

GitHub 會自動掃描 public repositories 中的 API Keys。如果偵測到：

1. 你會收到郵件通知
2. **立即撤銷該 API Key**
3. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 刪除舊金鑰
4. 建立新的 API Key
5. 更新本地的 `.env.local`

---

## Docker 部署安全

### Dockerfile 安全實踐

**✅ 正確做法**：

```dockerfile
# 使用官方 Node.js image
FROM node:20-slim

# 不要安裝不必要的套件
RUN apt-get update && apt-get install -y \
    ffmpeg \
    yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# 使用非 root 使用者
RUN useradd -m -u 1000 appuser
USER appuser

# 不要複製 .env 檔案到 image
COPY --chown=appuser:appuser package*.json ./
RUN npm ci --only=production

COPY --chown=appuser:appuser . .

# 環境變數在執行時注入
ENV NODE_ENV=production
```

**❌ 錯誤做法**：

```dockerfile
# ❌ 不要這樣做
COPY .env.local .  # 錯誤：將敏感資訊打包進 image
ENV GEMINI_API_KEY=AIzaSy...  # 錯誤：Hard-coded API key
RUN echo "API_KEY=xxx" > .env  # 錯誤：在 layer 中留下痕跡
```

### Docker Compose 安全

**✅ 正確做法**：

```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}  # 從 host 環境變數注入
      - YOUTUBE_CLIENT_ID=${YOUTUBE_CLIENT_ID}
    env_file:
      - .env.local  # 僅在本地開發使用，不要提交
```

### .dockerignore 檢查

確認 `.dockerignore` 包含：

```dockerignore
# 環境檔案
.env
.env.local
.env.*.local

# 暫存檔案
temp_videos/
temp_files/
public/images/

# 開發檔案
node_modules/
npm-debug.log*
.git/

# 敏感文件
*.key
*_credentials.json
```

### Docker Image 安全掃描

```bash
# 使用 Docker scan（需登入 Docker Hub）
docker scan ai-video-writer:latest

# 使用 Trivy（推薦）
trivy image ai-video-writer:latest

# 使用 Snyk
snyk container test ai-video-writer:latest
```

### Docker 執行時安全

```bash
# ✅ 最佳實踐
docker run \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \  # 執行時注入
  --read-only \                         # 唯讀檔案系統
  --tmpfs /tmp \                        # 暫存目錄
  --security-opt=no-new-privileges \    # 禁止提權
  --cap-drop=ALL \                      # 移除所有 capabilities
  ai-video-writer

# ❌ 不安全
docker run --privileged ai-video-writer  # 給予過多權限
```

---

## 應用程式使用安全

### 輸入驗證

**videoId 驗證**（已實施）：

```javascript
// server.js 中的驗證邏輯
function isValidVideoId(videoId) {
  // 嚴格限制為 11 字元，只允許 [a-zA-Z0-9_-]
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

// 阻擋 Command Injection
const dangerousChars = [';', '|', '&', '$', '`', '(', ')', '<', '>'];
if (dangerousChars.some(char => videoId.includes(char))) {
  return res.status(400).json({ error: 'Invalid video ID format' });
}
```

**測試輸入驗證**：

```bash
# 測試 Command Injection
curl -X POST http://localhost:3001/api/gemini/analyze-url \
  -H "Content-Type: application/json" \
  -d '{"videoId": "abc123; rm -rf /", "userPrompt": "test"}'
# 預期：400 Bad Request

# 測試 SQL Injection pattern（雖然本專案不使用資料庫）
curl -X POST http://localhost:3001/api/gemini/analyze-url \
  -H "Content-Type: application/json" \
  -d '{"videoId": "abc' OR '1'='1", "userPrompt": "test"}'
# 預期：400 Bad Request
```

### CORS 設定

**server.js 中的 CORS 設定**：

```javascript
// ✅ 限制特定 origin
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ❌ 不要這樣做（生產環境）
app.use(cors());  // 允許所有 origin
```

### Rate Limiting（建議實施）

目前專案**尚未實施** rate limiting，建議加入：

```javascript
// 安裝：npm install express-rate-limit
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 最多 100 次請求
  message: '請求過於頻繁，請稍後再試',
});

app.use('/api/', limiter);
```

### 檔案上傳安全

**已實施的安全措施**：

1. **檔案類型檢查**（multer）：
```javascript
const upload = multer({
  dest: 'temp_files/',
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown',
      'audio/mpeg', 'audio/wav', 'audio/flac'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案類型'));
    }
  }
});
```

2. **自動清理**：上傳後立即刪除暫存檔案
3. **隔離儲存**：使用獨立的 `temp_files/` 目錄

### 日誌安全

**⚠️ 目前問題**：server.js 有 249 個 `console.log`

**建議改善**：

```javascript
// 使用環境變數控制日誌等級
const DEBUG = process.env.NODE_ENV !== 'production';

// 不要記錄敏感資訊
console.log('User logged in:', email);  // ✅ OK
console.log('API Key:', apiKey);  // ❌ 絕對不要
console.log('Access Token:', token);  // ❌ 絕對不要

// 生產環境使用專業的 logger
// 推薦：winston, pino, bunyan
```

---

## 已知安全措施

### ✅ 已實施

- [x] **前後端分離**：API Key 僅在後端使用
- [x] **環境變數隔離**：`.env.local` 已加入 `.gitignore`
- [x] **輸入驗證**：videoId 有嚴格格式檢查
- [x] **CORS 限制**：僅允許指定的前端 origin
- [x] **OAuth 2.0**：使用標準 OAuth 流程
- [x] **檔案類型檢查**：限制上傳檔案類型
- [x] **自動清理**：定期刪除暫存檔案
- [x] **.dockerignore**：阻止敏感檔案進入 image
- [x] **依賴管理**：使用 package-lock.json 鎖定版本

### 📝 建議加入

- [ ] **Rate Limiting**：防止 API 濫用
- [ ] **Request Timeout**：防止長時間佔用資源
- [ ] **Helmet.js**：設定安全 HTTP headers
- [ ] **日誌管理**：使用專業 logger，避免洩漏敏感資訊
- [ ] **錯誤處理**：不要在錯誤訊息中洩漏系統資訊
- [ ] **HTTPS Only**：生產環境強制 HTTPS
- [ ] **CSP**：Content Security Policy headers
- [ ] **依賴掃描**：定期執行 `npm audit`

---

## 潛在風險與緩解

### 🔴 高風險

| 風險 | 影響 | 緩解措施 | 狀態 |
|-----|------|---------|-----|
| API Key 洩漏 | 未授權使用 API，產生費用 | 環境變數隔離 + .gitignore | ✅ 已實施 |
| Command Injection | 伺服器被入侵 | 嚴格輸入驗證 | ✅ 已實施 |
| CORS 配置錯誤 | XSS 攻擊 | 限制 origin | ✅ 已實施 |

### 🟡 中風險

| 風險 | 影響 | 緩解措施 | 狀態 |
|-----|------|---------|-----|
| Rate Limiting 缺失 | DDoS 攻擊，API 配額耗盡 | 實施 rate limiting | ⏳ 建議實施 |
| 日誌洩漏敏感資訊 | 資訊洩漏 | 使用專業 logger | ⏳ 建議實施 |
| 依賴套件漏洞 | 各種安全問題 | 定期 npm audit | ⏳ 建議實施 |

### 🟢 低風險

| 風險 | 影響 | 緩解措施 | 狀態 |
|-----|------|---------|-----|
| 暫存檔案佔用空間 | 磁碟空間不足 | 自動清理機制 | ✅ 已實施 |
| HTTP 連線（開發環境） | 中間人攻擊 | 生產環境使用 HTTPS | ⏳ 需部署時實施 |

---

## 生產環境建議

### 部署前檢查清單

#### 環境設定
- [ ] 所有環境變數都設定在部署平台（不使用 .env 檔案）
- [ ] `FRONTEND_URL` 設定為實際的前端網址
- [ ] `NODE_ENV` 設定為 `production`
- [ ] 關閉不必要的 debug log

#### 網路安全
- [ ] 啟用 HTTPS（必須）
- [ ] 設定 CORS 為實際的前端網址
- [ ] 實施 Rate Limiting
- [ ] 設定 Request Timeout

#### API 安全
- [ ] 在 Google Cloud Console 設定 API Key 限制：
  - HTTP referrer 或 IP 位址限制
  - 僅允許特定 API（Gemini, YouTube）
- [ ] OAuth Client ID 的授權網址更新為生產網址
- [ ] 設定 API 配額警示

#### 監控與日誌
- [ ] 設定錯誤監控（如 Sentry）
- [ ] 設定效能監控（如 New Relic, Datadog）
- [ ] 定期檢查日誌，確保沒有敏感資訊

#### Docker（如果使用）
- [ ] 使用非 root 使用者執行
- [ ] 啟用 read-only 檔案系統
- [ ] 限制 container capabilities
- [ ] 定期更新 base image

### 定期維護

**每月**：
```bash
# 檢查依賴套件漏洞
npm audit

# 更新依賴套件
npm update

# 掃描 Docker image
docker scan ai-video-writer:latest
```

**每季**：
- 更換 API Keys
- 檢查 Google Cloud 的 API 使用情況
- 審查存取日誌
- 更新文件

**每年**：
- 完整安全審計
- 更新所有依賴到最新穩定版本
- 檢視並更新安全政策

---

## 回報安全問題

如果你發現安全漏洞，請**不要**公開發布！

### 回報方式

1. **Email**：直接聯繫專案維護者（見 README）
2. **GitHub Security Advisory**：
   - 前往 repository → Security → Report a vulnerability
3. **提供資訊**：
   - 漏洞描述
   - 重現步驟
   - 影響範圍
   - 建議修復方案（如有）

### 回應時程

- **24 小時內**：確認收到回報
- **7 天內**：評估嚴重程度並制定修復計畫
- **30 天內**：發布修復（視嚴重程度調整）

---

## 參考資源

### 官方文件
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)

### 工具
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk](https://snyk.io/)
- [Trivy](https://github.com/aquasecurity/trivy)
- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)

---

<div align="center">

**🔒 Security is Everyone's Responsibility**

最後更新：2025-01-05

</div>
