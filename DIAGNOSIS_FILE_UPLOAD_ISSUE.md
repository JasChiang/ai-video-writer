# 檔案上傳 API 錯誤診斷報告

## 問題描述

在 localhost 使用參考資料上傳功能時，出現 403 錯誤：

```
檔案上傳錯誤: Error: 檔案上傳失敗: {"error":{"code":403,"message":"Generative Language API has not been used in project 542708778979 before or it is disabled..."
```

**核心問題：回傳的專案 ID (542708778979) 與使用者的 API KEY 專案 ID 完全不同。**

**更新情況：**
- ✅ `.env.local` 檔案存在且包含 API Key
- ✅ 影片分析功能正常運作（證明 API Key 有效）
- ❌ 檔案上傳功能使用了錯誤的專案 ID

這表示問題**不是**缺少 `.env.local`，而是 **Files API 使用了不同的認證機制**。

## 根本原因分析（更新版）

### 1. 認證機制分歧

根據用戶回報和程式碼分析：

**正常運作的功能：**
- ✅ `/api/analyze-video-url` - 使用 YouTube URL 分析（呼叫 `models.generateContent`）
- ✅ `/api/analyze-video` - 分析影片（呼叫 `models.generateContent`）

**失敗的功能：**
- ❌ Files API 上傳 - 呼叫 `ai.files.upload()` 或 `ai.files.list()`

這表示：
- `models.generateContent()` **正確使用** `apiKey` 參數
- `files.upload()` / `files.list()` **可能不使用** `apiKey` 參數，而是使用其他認證方式

### 2. @google/genai SDK 的認證機制

`@google/genai` (v1.26.0) 依賴 `google-auth-library`，其認證查找順序：

1. **明確傳入的 `apiKey` 參數** ← 理論上應該使用這個
2. **環境變數**: `GOOGLE_API_KEY`, `API_KEY` 等
3. **Application Default Credentials (ADC)**
   - `~/.config/gcloud/application_default_credentials.json`
   - `GOOGLE_APPLICATION_CREDENTIALS` 環境變數指向的檔案
4. **Google Cloud SDK 使用者憑證**
5. **Compute Engine / GKE 服務帳號**（在 GCP 環境中）

### 3. 可能的 Bug 或設計問題

**假設：** `@google/genai` SDK 的 Files API 相關方法（`files.upload`, `files.list`）在某些情況下可能：
- 忽略傳入的 `apiKey` 參數
- 優先使用 Application Default Credentials (ADC)
- 這可能是 SDK 的 bug 或設計缺陷

### 3. Google Auth Library 憑證查找順序

`@google/genai` SDK (v1.26.0) 依賴 `google-auth-library`，會按以下順序尋找憑證：

1. 建構函數傳入的 `apiKey` 參數
2. 環境變數：`GEMINI_API_KEY`, `GOOGLE_API_KEY`, `API_KEY` 等
3. **Application Default Credentials (ADC)**
4. Google Cloud SDK 的使用者憑證 (`gcloud auth application-default`)
5. Compute Engine/GKE 的服務帳號

**最可能的情況**：系統中存在 ADC 或其他環境變數，指向專案 542708778979（不是使用者預期的專案）。

## 快速診斷

### 方法 1：執行診斷腳本（推薦）

已建立專用診斷腳本 `test_files_api_auth.js`：

```bash
node test_files_api_auth.js
```

這個腳本會：
1. ✅ 檢查 GEMINI_API_KEY 是否正確設定
2. ✅ 檢查是否有衝突的環境變數
3. ✅ 測試 Files API 並顯示使用的專案 ID
4. ✅ 提供具體的診斷結果和建議

### 方法 2：手動檢查

```bash
# 1. 檢查環境變數
env | grep -i "API_KEY\|GOOGLE_APPLICATION\|GCLOUD_PROJECT"

# 2. 檢查 Google Cloud SDK 設定
gcloud config list 2>&1 || echo "gcloud not installed"

# 3. 檢查 ADC 檔案
ls -la ~/.config/gcloud/application_default_credentials.json 2>&1 || echo "No ADC file"
cat ~/.config/gcloud/application_default_credentials.json 2>&1 | grep project_id || echo "No project_id in ADC"

# 4. 檢查 .env.local
cat .env.local | grep GEMINI_API_KEY
```

## 解決方案（更新版）

### 方案 1：移除或修正 Application Default Credentials（最可能的解決方案）

```bash
# 檢查 ADC 檔案
cat ~/.config/gcloud/application_default_credentials.json 2>&1

# 如果檔案存在且指向錯誤的專案 (542708778979)，移除它：
mv ~/.config/gcloud/application_default_credentials.json ~/.config/gcloud/application_default_credentials.json.backup

# 或者重新設定為正確的專案
gcloud auth application-default login --project=your_correct_project_id
```

**重要：** 移除 ADC 後，SDK 應該會正確使用傳入的 `apiKey` 參數。

### 方案 2：明確清除環境變數

有些環境變數可能會覆蓋 API Key：

```bash
# 清除可能衝突的環境變數
unset GOOGLE_API_KEY
unset API_KEY
unset GOOGLE_APPLICATION_CREDENTIALS
unset GCLOUD_PROJECT
unset GCP_PROJECT
unset GOOGLE_CLOUD_PROJECT

# 然後重新啟動伺服器
npm run server
```

### 方案 3：強制使用環境變數（臨時 workaround）

如果以上方案都無效，可以嘗試在啟動伺服器時明確指定：

```bash
# 暫時清除 ADC 路徑
GOOGLE_APPLICATION_CREDENTIALS="" GEMINI_API_KEY=your_key npm run server
```

### 方案 4：更新 SDK 版本

這可能是 `@google/genai` 的已知 bug。嘗試更新到最新版本：

```bash
npm update @google/genai
npm list @google/genai  # 確認版本
```

### 方案 5：使用 REST API 替代 SDK（最終方案）

如果 SDK 問題無法解決，可以考慮直接使用 Gemini Files API 的 REST endpoint，手動傳遞 API Key：

```javascript
// 替代 ai.files.upload()
const uploadResponse = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
  method: 'POST',
  headers: {
    'x-goog-api-key': process.env.GEMINI_API_KEY,
    'X-Goog-Upload-Protocol': 'resumable',
    // ... 其他 headers
  },
  // ... body
});
```

參考：[Files API REST 文件](https://ai.google.dev/api/files)

## 驗證修復

修復後，啟動伺服器應該顯示：

```
✅ Gemini API Key loaded successfully
Server running on http://localhost:3001
```

然後測試檔案上傳功能，不應再出現 403 錯誤。

## 預防措施

### 1. 改進 API 金鑰驗證（建議的程式碼修改）

在 `server.js` 中加入更詳細的驗證：

```javascript
// 在第 29 行之後加入
console.log('✅ Gemini API Key loaded successfully');
console.log(`   API Key prefix: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);

// 可選：驗證 API Key 格式
if (!process.env.GEMINI_API_KEY.startsWith('AIza')) {
  console.warn('⚠️  WARNING: API Key format looks unusual. Expected to start with "AIza"');
}
```

### 2. 加入 .env.local 範本檢查

```javascript
// 在啟動時檢查 .env.local 是否存在
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!fs.existsSync(path.join(__dirname, '.env.local'))) {
  console.warn('⚠️  WARNING: .env.local file not found!');
  console.warn('   API Key is being loaded from system environment variables.');
  console.warn('   Consider creating .env.local from .env.example');
}
```

## 相關檔案

- `server.js` (第 22-29 行, 339 行) - API 金鑰初始化
- `.env.example` - 環境變數範例
- `package.json` - @google/genai v1.26.0

## 參考文件

- [Google Cloud ADC 文件](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Gemini API 文件](https://ai.google.dev/gemini-api/docs)
- [@google/genai SDK](https://www.npmjs.com/package/@google/genai)
