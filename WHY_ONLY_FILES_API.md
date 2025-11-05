# 為什麼只有 Files API 上傳有問題？

## 問題觀察

✅ **正常運作的功能：**
- 使用 YouTube URL 分析影片（`/api/analyze-video-url`）
- 分析已下載的影片（`/api/analyze-video`）
- 生成文章（`/api/generate-article`）
- 重新分析（`/api/reanalyze-with-existing-file`）

❌ **失敗的功能：**
- Files API 上傳（`ai.files.upload()`）
- Files API 列表（`ai.files.list()`）
- 檢查檔案（`/api/check-file`）

## 技術原因

### 1. 不同的 API Endpoint

`@google/genai` SDK 內部使用兩種不同的 API：

#### A. Generative AI API（正常運作）
```javascript
// 這些方法使用 generativelanguage.googleapis.com
ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [...],
  config: { ... }
})
```

**API Endpoint:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Headers: x-goog-api-key: YOUR_API_KEY
```

**認證方式：** 純粹的 API Key 認證（通過 HTTP Header）

---

#### B. Files API（發生問題）
```javascript
// 這些方法使用 Files API
ai.files.upload({ ... })
ai.files.list()
ai.files.get()
```

**API Endpoint:**
```
POST https://generativelanguage.googleapis.com/v1beta/files
Headers: Authorization: Bearer <OAuth2_Token>
```

**認證方式：** OAuth2 認證（使用 `google-auth-library`）

### 2. google-auth-library 的認證順序

當你呼叫 `ai.files.upload()` 時，`google-auth-library` 會按以下順序尋找憑證：

```
1. 明確傳入的 apiKey 參數 ✅ (理論上)
   → const ai = new GoogleGenAI({ apiKey: '...' })

2. Application Default Credentials (ADC) ⚠️  (實際上優先使用)
   → ~/.config/gcloud/application_default_credentials.json

3. 環境變數
   → GOOGLE_APPLICATION_CREDENTIALS
   → GOOGLE_API_KEY

4. Google Cloud SDK
   → gcloud auth application-default login
```

### 3. 問題根源

**在你的 localhost 環境：**

```bash
# 存在 ADC 檔案，指向專案 542708778979
~/.config/gcloud/application_default_credentials.json
{
  "client_id": "...",
  "client_secret": "...",
  "quota_project_id": "542708778979",  ← 這是錯誤的專案！
  "refresh_token": "...",
  "type": "authorized_user"
}
```

**SDK 行為：**
- ✅ `models.generateContent()` → 使用 HTTP Header 的 `x-goog-api-key`（正確）
- ❌ `files.upload()` → 使用 ADC 的 OAuth2 token（錯誤專案）

### 4. 為什麼正式環境沒問題？

**正式環境（部署伺服器）：**
- ❌ 沒有 `~/.config/gcloud/` 目錄
- ❌ 沒有安裝 Google Cloud SDK
- ❌ 沒有 ADC 檔案
- ✅ SDK 回退使用 `.env.local` 的 `GEMINI_API_KEY`

## 驗證這個理論

執行以下命令確認：

```bash
# 檢查 ADC 內容
cat ~/.config/gcloud/application_default_credentials.json

# 應該會看到 quota_project_id: "542708778979"
```

## 程式碼層面的差異

### 正常的 API 呼叫（server.js:283-297）

```javascript
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    {
      role: 'user',
      parts: [
        { fileData: { fileUri: youtubeUrl } },
        { text: fullPrompt }
      ]
    }
  ]
});
```

**內部流程：**
```
1. SDK 建立 HTTP 請求
2. 加入 Header: x-goog-api-key: YOUR_API_KEY
3. 發送到 generativelanguage.googleapis.com
4. ✅ 成功！使用正確的 API Key
```

### 有問題的 Files API 呼叫（server.js:372-378）

```javascript
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

uploadedFile = await ai.files.upload({
  file: filePath,
  config: {
    mimeType: 'video/mp4',
    displayName: videoId
  },
});
```

**內部流程（在有 ADC 的環境）：**
```
1. SDK 呼叫 google-auth-library
2. google-auth-library 發現 ADC 存在
3. 使用 ADC 的 refresh_token 取得 OAuth2 access_token
4. ❌ 這個 token 屬於專案 542708778979（錯誤的專案）
5. 發送請求到 generativelanguage.googleapis.com
6. ❌ 錯誤：專案 542708778979 沒有啟用 Generative Language API
```

## 解決方案

強制 SDK 不使用 ADC：

```bash
# 方法 1：使用啟動腳本
./start-local.sh

# 方法 2：手動設定環境變數
GOOGLE_APPLICATION_CREDENTIALS="" npm run dev:all

# 方法 3：移除 ADC（如果不需要）
mv ~/.config/gcloud/application_default_credentials.json ~/adc_backup.json
```

## 參考

- [Google Auth Library 認證流程](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Gemini Files API 文件](https://ai.google.dev/api/files)
- [@google/genai SDK 原始碼](https://github.com/google/generative-ai-js)
