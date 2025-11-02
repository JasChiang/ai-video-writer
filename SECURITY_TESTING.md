# 安全性測試指南

## 概述

本專案已實作輸入驗證機制，防止 Command Injection 等安全風險。本文件說明如何測試這些安全機制。

---

## 🔒 已實作的安全機制

### 1. YouTube Video ID 驗證

**位置**：`server.js:54-60`

```javascript
function isValidVideoId(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }
  // YouTube Video ID 固定為 11 個字元
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}
```

**防護機制**：
- 嚴格限制為 11 個字元
- 只允許英文字母、數字、底線和連字號
- 阻擋任何特殊字元（如 `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `{`, `}` 等）

**應用範圍**：所有 9 個 API 端點都有使用此驗證
- `/api/download-video` (line 72)
- `/api/analyze-video-url` (line 172)
- `/api/analyze-video` (line 238)
- `/api/reanalyze-with-existing-file` (line 411)
- `/api/generate-article-url` (line 486)
- `/api/generate-article` (line 666)
- `/api/regenerate-article` (line 912)
- `/api/regenerate-screenshots` (line 1021)
- `/api/check-file/:videoId` (line 1164)

---

## 🧪 安全性測試方法

### 測試 1：基本 Command Injection 攻擊

**目的**：驗證系統能阻擋基本的命令注入攻擊

**測試方法**：

```bash
# 使用 curl 或 Postman 發送惡意請求
curl -X POST http://localhost:3001/api/download-video \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "dQw4w9WgXcQ; rm -rf /",
    "accessToken": "your_token"
  }'
```

**預期結果**：
```json
{
  "error": "Missing or invalid videoId format"
}
```

**狀態碼**：`400 Bad Request`

---

### 測試 2：管道符號注入

**惡意輸入**：
```json
{
  "videoId": "dQw4w9WgXcQ | cat /etc/passwd"
}
```

**預期結果**：被阻擋（400 錯誤）

---

### 測試 3：反引號命令替換

**惡意輸入**：
```json
{
  "videoId": "dQw4w9WgXcQ`whoami`"
}
```

**預期結果**：被阻擋（400 錯誤）

---

### 測試 4：路徑遍歷攻擊

**惡意輸入**：
```json
{
  "videoId": "../../../etc/passwd"
}
```

**預期結果**：被阻擋（400 錯誤）

---

### 測試 5：特殊字元注入

**測試各種特殊字元**：

```javascript
const maliciousInputs = [
  'dQw4w9WgXcQ; echo hacked',
  'dQw4w9WgXcQ && echo hacked',
  'dQw4w9WgXcQ || echo hacked',
  'dQw4w9WgXcQ$(whoami)',
  'dQw4w9WgXcQ\nwhoami',
  'dQw4w9WgXcQ\r\nwhoami',
  'dQw4w9WgXcQ&calc',
  'dQw4w9WgXcQ%0Awhoami',
  'dQw4w9WgXcQ%00whoami',
  'dQw4w9WgXcQ<!---->',
  'dQw4w9WgXcQ<script>',
  "dQw4w9WgXcQ' OR '1'='1",
  'dQw4w9WgXcQ" OR "1"="1'
];
```

**預期結果**：全部被阻擋（400 錯誤）

---

### 測試 6：長度驗證

**測試過長的輸入**：

```json
{
  "videoId": "dQw4w9WgXcQEXTRA"
}
```

**測試過短的輸入**：

```json
{
  "videoId": "short"
}
```

**預期結果**：兩者都被阻擋（400 錯誤）

---

### 測試 7：合法輸入測試

**確保合法輸入可以正常運作**：

```json
{
  "videoId": "dQw4w9WgXcQ"
}
```

**其他合法範例**：
- `jNQXAC9IVRw`（YouTube 常見影片）
- `9bZkp7q19f0`（PSY - Gangnam Style）
- `kJQP7kiw5Fk`（Luis Fonsi - Despacito）

**預期結果**：正常處理（200 成功或正常錯誤訊息）

---

## 🛠️ 自動化測試腳本

創建 `test-security.js` 檔案：

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

const maliciousTests = [
  { name: 'Command Injection with semicolon', videoId: 'dQw4w9WgXcQ; rm -rf /' },
  { name: 'Command Injection with pipe', videoId: 'dQw4w9WgXcQ | whoami' },
  { name: 'Command Injection with AND', videoId: 'dQw4w9WgXcQ && calc' },
  { name: 'Command Injection with backticks', videoId: 'dQw4w9WgXcQ`whoami`' },
  { name: 'Command Injection with $(...)', videoId: 'dQw4w9WgXcQ$(whoami)' },
  { name: 'Path Traversal', videoId: '../../../etc/passwd' },
  { name: 'Null byte injection', videoId: 'dQw4w9WgXcQ\x00' },
  { name: 'Newline injection', videoId: 'dQw4w9WgXcQ\nwhoami' },
  { name: 'SQL Injection attempt', videoId: "dQw4w9WgXcQ' OR '1'='1" },
  { name: 'XSS attempt', videoId: 'dQw4w9WgXcQ<script>alert(1)</script>' },
  { name: 'Too long', videoId: 'dQw4w9WgXcQEXTRALONG' },
  { name: 'Too short', videoId: 'short' },
  { name: 'Empty string', videoId: '' },
  { name: 'Special characters', videoId: 'dQw4w9WgXcQ@#$%' },
];

async function testSecurity() {
  console.log('🔒 開始安全性測試...\n');

  let passed = 0;
  let failed = 0;

  for (const test of maliciousTests) {
    try {
      const response = await axios.post(`${API_BASE}/download-video`, {
        videoId: test.videoId,
        accessToken: 'dummy_token'
      });

      console.log(`❌ FAILED: ${test.name}`);
      console.log(`   Expected: 400 error, Got: ${response.status}\n`);
      failed++;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`✅ PASSED: ${test.name}`);
        console.log(`   Correctly blocked with: ${error.response.data.error}\n`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Unexpected error: ${error.message}\n`);
        failed++;
      }
    }
  }

  console.log('\n========== 測試結果 ==========');
  console.log(`✅ 通過: ${passed}/${maliciousTests.length}`);
  console.log(`❌ 失敗: ${failed}/${maliciousTests.length}`);

  if (failed === 0) {
    console.log('\n🎉 所有安全測試都通過！');
  } else {
    console.log('\n⚠️  有些測試失敗，請檢查安全機制');
  }
}

// 執行測試
testSecurity().catch(console.error);
```

**執行測試**：

```bash
# 先安裝 axios（如果還沒安裝）
npm install axios

# 確保伺服器正在運行
npm run server

# 在另一個終端執行測試
node test-security.js
```

---

## 📊 測試檢查清單

- [ ] 測試 1：基本命令注入（`;`, `&&`, `||`）
- [ ] 測試 2：管道符號注入（`|`）
- [ ] 測試 3：反引號命令替換（`` ` ``）
- [ ] 測試 4：路徑遍歷（`../`）
- [ ] 測試 5：特殊字元（`$`, `(`, `)`, `{`, `}`, `<`, `>`）
- [ ] 測試 6：長度驗證（過長/過短）
- [ ] 測試 7：合法輸入正常運作
- [ ] 測試 8：空值或 null 輸入
- [ ] 測試 9：Unicode 特殊字元
- [ ] 測試 10：URL 編碼攻擊（`%0A`, `%00`）

---

## 🔍 手動檢查方法

### 使用 Postman

1. 安裝 Postman 或使用 Postman Web
2. 創建新的 POST 請求到 `http://localhost:3001/api/download-video`
3. 在 Body 中選擇 `raw` 和 `JSON`
4. 輸入測試資料：

```json
{
  "videoId": "dQw4w9WgXcQ; rm -rf /",
  "accessToken": "test_token"
}
```

5. 發送請求
6. 檢查回應是否為 400 錯誤

### 使用瀏覽器開發者工具

1. 開啟專案前端（http://localhost:3000）
2. 打開開發者工具（F12）
3. 切換到 Console 分頁
4. 執行測試：

```javascript
fetch('http://localhost:3001/api/download-video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoId: 'dQw4w9WgXcQ; whoami',
    accessToken: 'test'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

預期結果：`{error: "Missing or invalid videoId format"}`

---

## ⚠️ 已知限制

1. **其他輸入欄位**：目前主要保護 `videoId`，但 `prompt` 和 `videoTitle` 等欄位沒有嚴格驗證
   - 這些欄位不會用於執行系統命令，風險較低
   - 但仍建議未來加入長度限制和特殊字元過濾

2. **DDoS 保護**：目前沒有請求頻率限制
   - 建議加入 rate limiting 中介軟體（如 `express-rate-limit`）

3. **認證機制**：OAuth token 未在後端驗證
   - 僅在前端驗證，後端應該也要驗證 token 有效性

---

## 🛡️ 建議的額外安全措施

### 1. 加入 Rate Limiting

```bash
npm install express-rate-limit
```

在 `server.js` 中加入：

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制 100 個請求
  message: '請求過於頻繁，請稍後再試'
});

app.use('/api/', limiter);
```

### 2. 加入請求大小限制

在 `server.js` 中已有設定：
```javascript
app.use(express.json({ limit: '10mb' }));
```

### 3. 加入 Helmet 安全標頭

```bash
npm install helmet
```

```javascript
import helmet from 'helmet';
app.use(helmet());
```

### 4. 使用參數化命令而非字串拼接

目前使用字串拼接建構命令。更安全的做法是使用 `spawn` 而非 `exec`：

```javascript
import { spawn } from 'child_process';

// 不安全（目前做法）
const command = `yt-dlp "${videoUrl}"`;
await execAsync(command);

// 更安全（建議改用）
spawn('yt-dlp', [videoUrl, '-o', outputPath]);
```

---

## 📝 測試紀錄範本

| 測試編號 | 測試項目 | 輸入值 | 預期結果 | 實際結果 | 狀態 | 測試日期 |
|---------|---------|--------|---------|---------|------|---------|
| 1 | Command Injection | `dQw4w9WgXcQ; rm -rf /` | 400 錯誤 | 400 錯誤 | ✅ | 2025-11-02 |
| 2 | Pipe Injection | `dQw4w9WgXcQ \| whoami` | 400 錯誤 | 400 錯誤 | ✅ | 2025-11-02 |
| ... | ... | ... | ... | ... | ... | ... |

---

## 📞 回報安全問題

如果發現任何安全漏洞，請：

1. **不要**公開披露漏洞
2. 透過 GitHub Issues（私人模式）或直接聯繫作者
3. 提供詳細的重現步驟
4. 包含 PoC（Proof of Concept）程式碼

---

**Created by [@jaschiang](https://www.linkedin.com/in/jascty/)**

最後更新：2025-11-02
