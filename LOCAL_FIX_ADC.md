# 在 localhost 修復 ADC 衝突的方法

## 問題說明

- ✅ 正式環境：Files API 正常（沒有 ADC）
- ❌ localhost：Files API 使用錯誤的專案 ID 542708778979（來自 ADC）

## 解決方案（選一個執行）

### 方案 1：移除/重命名 ADC 檔案（推薦，永久生效）

如果你不需要 ADC 給其他專案使用：

```bash
# 備份 ADC 檔案
mv ~/.config/gcloud/application_default_credentials.json ~/adc_backup.json

# 重啟伺服器
npm run server
```

**優點：** 一勞永逸，之後不需要任何特殊操作
**缺點：** 如果其他專案需要 ADC，需要手動還原

---

### 方案 2：啟動時禁用 ADC（推薦，每次啟動）

修改 `package.json`，在啟動腳本中清空 ADC 路徑：

```json
{
  "scripts": {
    "dev": "vite",
    "server": "GOOGLE_APPLICATION_CREDENTIALS=\"\" node server.js",
    "dev:all": "concurrently \"npm run dev\" \"GOOGLE_APPLICATION_CREDENTIALS=\\\"\\\" npm run server\""
  }
}
```

**Linux/Mac 版本：**
```bash
# 直接在終端執行
GOOGLE_APPLICATION_CREDENTIALS="" npm run server

# 或前後端一起啟動
GOOGLE_APPLICATION_CREDENTIALS="" npm run dev:all
```

**Windows PowerShell 版本：**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS=""; npm run server
```

**Windows CMD 版本：**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=
npm run server
```

**優點：** 不影響其他專案使用 ADC
**缺點：** 每次啟動需要記得加環境變數（但可以寫在 package.json）

---

### 方案 3：使用 .env.local 覆蓋（最簡單）

在 `.env.local` 中明確指定：

```bash
# .env.local
GEMINI_API_KEY=your_api_key_here
YOUTUBE_CLIENT_ID=your_client_id_here

# 明確禁用 ADC
GOOGLE_APPLICATION_CREDENTIALS=
```

然後確保 `server.js` 在最開頭載入環境變數：

```javascript
// server.js 第 1-2 行
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // 必須在任何其他 import 之前

import express from 'express';
// ... 其他 imports
```

**優點：** 最簡單，只需修改一個檔案
**缺點：** 可能不會完全禁用 ADC（取決於 google-auth-library 的實作）

---

### 方案 4：建立專案專用的啟動腳本（推薦給團隊開發）

建立 `start-local.sh`：

```bash
#!/bin/bash

# 禁用 ADC
export GOOGLE_APPLICATION_CREDENTIALS=""

# 確保使用 .env.local
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found! Please create it from .env.example"
    exit 1
fi

echo "✅ Starting server with .env.local (ADC disabled)"
npm run dev:all
```

使用方式：

```bash
# 給腳本執行權限（只需執行一次）
chmod +x start-local.sh

# 之後每次啟動用這個
./start-local.sh
```

**優點：** 團隊成員都能用，避免每個人都遇到 ADC 問題
**缺點：** 需要額外維護一個腳本檔案

---

## 驗證修復是否成功

修復後，測試 Files API：

```bash
# 啟動伺服器
npm run server

# 在另一個終端測試
node test_files_api_auth.js
```

應該會看到：
```
✅ Files API 列表功能正常！使用的是正確的專案。
```

---

## 推薦方案總結

### 個人開發
→ **方案 1**（移除 ADC）或 **方案 2**（修改 package.json）

### 團隊開發
→ **方案 4**（啟動腳本）+ 在 README 說明

### 快速測試
→ **方案 2** 的終端命令版本：
```bash
GOOGLE_APPLICATION_CREDENTIALS="" npm run dev:all
```

---

## 如果需要恢復 ADC

移除 ADC 後，如果其他專案需要：

```bash
# 恢復備份
mv ~/adc_backup.json ~/.config/gcloud/application_default_credentials.json

# 或重新登入
gcloud auth application-default login
```
