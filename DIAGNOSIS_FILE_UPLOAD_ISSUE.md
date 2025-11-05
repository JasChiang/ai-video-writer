# 檔案上傳 API 錯誤診斷報告

## 問題描述

在 localhost 使用參考資料上傳功能時，出現 403 錯誤：

```
檔案上傳錯誤: Error: 檔案上傳失敗: {"error":{"code":403,"message":"Generative Language API has not been used in project 542708778979 before or it is disabled..."
```

**核心問題：回傳的專案 ID (542708778979) 與使用者的 API KEY 專案 ID 完全不同。**

## 根本原因分析

### 1. API 金鑰來源問題

根據程式碼分析 (server.js:22-27, 339)：

```javascript
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY is not set in .env.local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

程式會從 `process.env.GEMINI_API_KEY` 取得 API 金鑰。然而，目前專案中：
- ❌ `.env.local` 檔案**不存在**
- ✅ 只有 `.env.example` 範例檔案存在

### 2. 為何伺服器能啟動？

儘管 `.env.local` 不存在，伺服器仍能執行的可能原因：

1. **系統環境變數中已設定 `GEMINI_API_KEY`**
2. **使用了錯誤的 API 金鑰**（來自其他專案或測試環境）
3. **Google Auth Library 的自動憑證偵測**機制找到了其他憑證來源

### 3. Google Auth Library 憑證查找順序

`@google/genai` SDK (v1.26.0) 依賴 `google-auth-library`，會按以下順序尋找憑證：

1. 建構函數傳入的 `apiKey` 參數
2. 環境變數：`GEMINI_API_KEY`, `GOOGLE_API_KEY`, `API_KEY` 等
3. **Application Default Credentials (ADC)**
4. Google Cloud SDK 的使用者憑證 (`gcloud auth application-default`)
5. Compute Engine/GKE 的服務帳號

**最可能的情況**：系統中存在 ADC 或其他環境變數，指向專案 542708778979（不是使用者預期的專案）。

## 診斷步驟

執行以下命令檢查實際使用的 API 金鑰來源：

```bash
# 1. 檢查 .env.local 是否存在
ls -la .env.local

# 2. 檢查環境變數
echo "GEMINI_API_KEY: $GEMINI_API_KEY"
echo "GOOGLE_API_KEY: $GOOGLE_API_KEY"
env | grep -i "API_KEY\|GOOGLE"

# 3. 檢查 Google Cloud SDK 預設憑證
gcloud config list
gcloud auth application-default print-access-token 2>&1 || echo "No ADC found"

# 4. 檢查 ADC 檔案位置
ls -la ~/.config/gcloud/application_default_credentials.json 2>&1 || echo "No ADC file"
```

## 解決方案

### 方案 1：建立正確的 `.env.local` 檔案（推薦）

```bash
# 1. 複製範例檔案
cp .env.example .env.local

# 2. 編輯 .env.local，填入正確的 API 金鑰
# GEMINI_API_KEY=your_correct_api_key_here
```

確保使用的 API 金鑰來自正確的 GCP 專案，且該專案已啟用 Generative Language API：
https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview

### 方案 2：清除衝突的環境變數

如果系統環境變數中存在錯誤的 API 金鑰：

```bash
# 取消設定環境變數
unset GEMINI_API_KEY
unset GOOGLE_API_KEY

# 或在執行時明確指定
GEMINI_API_KEY=your_correct_key npm run server
```

### 方案 3：移除 Application Default Credentials（如果存在且錯誤）

```bash
# 移除 ADC
rm ~/.config/gcloud/application_default_credentials.json

# 重新設定為正確的專案
gcloud auth application-default login --project=your_correct_project_id
```

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
