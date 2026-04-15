# 🛡️ AI Video Writer 專案安全性測試指南

## 概述

本文件提供 AI Video Writer 專案的安全性測試指南，重點關注已實作的防護機制，特別是針對 Command Injection 等常見安全風險的輸入驗證。

---

## 🔒 已實作的安全機制

### 1. YouTube Video ID 嚴格驗證

-   **位置**：`server.js` 中的 `isValidVideoId` 函數。
-   **邏輯**：
    ```javascript
    function isValidVideoId(videoId) {
      if (!videoId || typeof videoId !== 'string') {
        return false;
      }
      // YouTube Video ID 固定為 11 個字元，只允許英文字母、數字、底線和連字號。
      return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    }
    ```
-   **防護機制**：
    -   嚴格限制 `videoId` 必須為 11 個字元。
    -   只允許 `a-zA-Z0-9_-` 這些安全字元。
    -   有效阻擋任何特殊字元（如 `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `{`, `}` 等），防止命令注入。
-   **應用範圍**：此驗證機制已應用於所有處理 `videoId` 的 API 端點，確保所有影片相關操作的安全性。

---

## 🧪 安全性測試方法

以下測試案例旨在驗證 `videoId` 驗證機制是否能有效阻擋惡意輸入。

### 測試環境準備

1.  確保後端服務器正在運行 (`npm run server`)。
2.  使用 `curl`、Postman 或瀏覽器開發者工具發送請求。

### 1. Command Injection 攻擊測試

**目的**：驗證系統能阻擋各種命令注入嘗試。

| 測試案例 | 惡意輸入 `videoId` | 預期結果 (HTTP 狀態碼 & 錯誤訊息) |
| :------- | :----------------- | :-------------------------------- |
| 基本分號注入 | `dQw4w9WgXcQ; rm -rf /` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 管道符號注入 | `dQw4w9WgXcQ | cat /etc/passwd` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 邏輯 AND 注入 | `dQw4w9WgXcQ && echo hacked` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 反引號命令替換 | `dQw4w9WgXcQ`whoami`` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| `$(...)` 命令替換 | `dQw4w9WgXcQ$(whoami)` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 換行符注入 | `dQw4w9WgXcQ\nwhoami` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| URL 編碼注入 | `dQw4w9WgXcQ%0Awhoami` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |

### 2. 路徑遍歷攻擊測試

**目的**：驗證系統能阻擋嘗試存取非授權檔案的路徑遍歷攻擊。

| 測試案例 | 惡意輸入 `videoId` | 預期結果 (HTTP 狀態碼 & 錯誤訊息) |
| :------- | :----------------- | :-------------------------------- |
| 嘗試存取 `/etc/passwd` | `../../../etc/passwd` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |

### 3. 其他特殊字元與無效格式測試

**目的**：驗證系統能阻擋不符合 `videoId` 格式的各種特殊字元和長度異常的輸入。

| 測試案例 | 惡意輸入 `videoId` | 預期結果 (HTTP 狀態碼 & 錯誤訊息) |
| :------- | :----------------- | :-------------------------------- |
| SQL Injection 模式 | `dQw4w9WgXcQ' OR '1'='1` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| XSS 模式 | `dQw4w9WgXcQ<script>alert(1)</script>` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 過長輸入 | `dQw4w9WgXcQEXTRALONG` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 過短輸入 | `short` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 空字串 | `""` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |
| 包含特殊符號 | `dQw4w9WgXcQ@#$!` | `400 Bad Request`, `{"error": "Missing or invalid videoId format"}` |

### 4. 合法輸入測試

**目的**：確保合法且格式正確的 `videoId` 能夠正常處理。

| 測試案例 | 合法輸入 `videoId` | 預期結果 |
| :------- | :----------------- | :------- |
| 標準 YouTube ID | `dQw4w9WgXcQ` | 正常處理 (200 OK 或預期的業務邏輯錯誤，例如影片不存在) |
| 其他合法 ID | `jNQXAC9IVRw`, `9bZkp7q19f0` | 正常處理 |

---

## 🛠️ 自動化測試腳本範例

您可以編寫自動化腳本來執行上述測試。以下是一個使用 `axios` 的 Node.js 腳本範例：

```javascript
// test-security.js
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api'; // 後端 API 基礎 URL

const maliciousTests = [
  { name: '基本分號注入', videoId: 'dQw4w9WgXcQ; rm -rf /' },
  { name: '管道符號注入', videoId: 'dQw4w9WgXcQ | whoami' },
  { name: '邏輯 AND 注入', videoId: 'dQw4w9WgXcQ && calc' },
  { name: '反引號命令替換', videoId: 'dQw4w9WgXcQ`whoami`' },
  { name: '`$(...)` 命令替換', videoId: 'dQw4w9WgXcQ$(whoami)' },
  { name: '路徑遍歷', videoId: '../../../etc/passwd' },
  { name: '空字元注入', videoId: 'dQw4w9WgXcQ\x00' },
  { name: '換行符注入', videoId: 'dQw4w9WgXcQ\nwhoami' },
  { name: 'SQL Injection 模式', videoId: "dQw4w9WgXcQ' OR '1'='1" },
  { name: 'XSS 模式', videoId: 'dQw4w9WgXcQ<script>alert(1)</script>' },
  { name: '過長輸入', videoId: 'dQw4w9WgXcQEXTRALONG' },
  { name: '過短輸入', videoId: 'short' },
  { name: '空字串', videoId: '' },
  { name: '包含特殊符號', videoId: 'dQw4w9WgXcQ@#$%' },
];

async function runSecurityTests() {
  console.log('🔒 開始安全性測試...\n');

  let passed = 0;
  let failed = 0;

  for (const test of maliciousTests) {
    try {
      // 假設所有 API 端點都需要accessToken，這裡使用一個 dummy token
      await axios.post(`${API_BASE}/download-video`, {
        videoId: test.videoId,
        accessToken: 'dummy_token'
      });

      console.log(`❌ FAILED: ${test.name}`);
      console.log(`   預期: 400 錯誤, 實際: 200 OK (或非 400 錯誤)\n`);
      failed++;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`✅ PASSED: ${test.name}`);
        console.log(`   正確阻擋，錯誤訊息: "${error.response.data.error}"\n`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   發生意外錯誤: ${error.message}\n`);
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
    console.log('\n⚠️  有些測試失敗，請檢查安全機制。');
  }
}

// 執行測試
runSecurityTests().catch(console.error);
```

**執行步驟**：

1.  安裝 `axios`：`npm install axios`
2.  確保後端服務器正在運行 (`npm run server`)。
3.  在另一個終端機中執行測試腳本：`node test-security.js`

---

## ⚠️ 已知限制與建議的額外安全措施

### 1. 其他輸入欄位驗證

-   **限制**：目前主要針對 `videoId` 進行嚴格驗證。其他輸入欄位（如 `prompt`, `videoTitle` 等）的驗證相對寬鬆。
-   **建議**：雖然這些欄位通常不會直接用於執行系統命令，但仍建議對其加入長度限制和特殊字元過濾，以防止潛在的應用層攻擊（如過長的輸入導致服務拒絕）。

### 2. 速率限制 (Rate Limiting)

-   **限制**：目前專案**沒有**實施 API 請求頻率限制。
-   **建議**：導入 `express-rate-limit` 等中介軟體，對所有 API 端點實施速率限制，以防止 API 濫用和 DDoS 攻擊。
-   **參考**：請參考 [AI Video Writer 專案安全政策與最佳實踐](./SECURITY.md) 中的相關建議。

### 3. OAuth Token 後端驗證

-   **限制**：目前 OAuth `accessToken` 主要在前端進行驗證。後端應對收到的 `accessToken` 進行有效性驗證，以確保請求的合法性。
-   **建議**：在後端實作驗證機制，例如向 YouTube API 發送一個輕量級請求來驗證 `accessToken` 的有效性。

### 4. 使用參數化命令

-   **限制**：目前部分後端邏輯可能使用字串拼接來建構外部命令（例如 `yt-dlp`）。
-   **建議**：改用 `child_process.spawn` 並將參數作為陣列傳遞，而不是使用 `child_process.exec` 或字串拼接，這能更有效地防止命令注入。

### 5. Helmet.js

-   **建議**：導入 `helmet` 中介軟體，自動設定多種安全相關的 HTTP Headers，例如 `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` 等，以增強應用程式的整體安全性。

---

## 📝 測試紀錄範本

| 測試編號 | 測試項目 | 輸入值 | 預期結果 | 實際結果 | 狀態 | 測試日期 |
| :------- | :------- | :----- | :------- | :------- | :--- | :------- |
| 1        | Command Injection (分號) | `dQw4w9WgXcQ; rm -rf /` | 400 錯誤 | 400 錯誤 | ✅   | YYYY-MM-DD |
| 2        | Pipe Injection | `dQw4w9WgXcQ \| whoami` | 400 錯誤 | 400 錯誤 | ✅   | YYYY-MM-DD |
| ...      | ...      | ...    | ...      | ...      | ...  | ...      |

---

## 📞 回報安全問題

如果您在 AI Video Writer 專案中發現任何安全漏洞，請**不要公開發布**。請參考 [AI Video Writer 專案安全政策與最佳實踐](./SECURITY.md) 中的「回報安全問題」章節，透過指定管道進行回報。

---

<div align="center">

**🔒 安全測試是持續的過程**

</div>