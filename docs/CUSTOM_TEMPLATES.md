# 自訂文章模板使用指南

本專案支援使用**遠端自訂模板**來客製化文章生成風格，適合組織內部使用或個人偏好調整。

## 📋 目錄

- [什麼是自訂模板？](#什麼是自訂模板)
- [為什麼需要自訂模板？](#為什麼需要自訂模板)
- [模板系統架構](#模板系統架構)
- [如何使用自訂模板](#如何使用自訂模板)
- [建立自訂模板 JSON 檔案](#建立自訂模板-json-檔案)
- [使用 GitHub Secret Gist](#使用-github-secret-gist)
- [設定環境變數](#設定環境變數)
- [驗證模板載入](#驗證模板載入)
- [常見問題](#常見問題)

---

## 什麼是自訂模板？

自訂模板是一套**提示詞範本（Prompt Templates）**，用於指導 AI 如何生成文章。每個模板針對不同的目標受眾（Target Audience）設計，讓生成的文章風格、內容重點更符合特定讀者需求。

### 內建模板

本專案內建 5 個開源模板：

| 模板 ID | 名稱 | 描述 |
|--------|------|------|
| `default` | 通用讀者 | 適合一般大眾閱讀的文章風格 |
| `ecosystem-loyalist` | 生態忠誠者 | 強調品牌整合、生態系無縫體驗 |
| `pragmatic-performer` | 務實效能者 | 聚焦 CP 值、規格分析、效能實測 |
| `lifestyle-integrator` | 生活整合者 | 展示生活情境、便利性、美學設計 |
| `reliability-seeker` | 信賴致上者 | 強調簡易操作、耐用、服務保障 |

### 自訂模板

自訂模板允許你：
- 加入組織特有的服務（如門市、保固、會員方案）
- 調整寫作風格與專業術語
- 針對特定產業或受眾優化提示詞
- **保持內容私密，不公開到 GitHub**

---

## 為什麼需要自訂模板？

### 使用場景

1. **企業內部部署**
   - 將 AI Video Writer 部署到 Render 供團隊使用
   - 希望文章包含公司特有的服務與品牌訊息
   - 不希望將組織資訊公開到開源專案

2. **個人偏好調整**
   - 調整文章風格（正式、輕鬆、技術性）
   - 針對特定平台（部落格、社群媒體）優化
   - 加入個人品牌特色

3. **產業特定需求**
   - 針對特定產業（3C、家電、美妝等）優化
   - 使用產業專業術語
   - 符合產業內容規範

### 範例對比

**內建模板（開源版本）**
```
文章會使用通用的描述，例如：
- "實體門市提供諮詢服務"
- "售後服務保障"
```

**自訂模板（企業版本）**
```
文章可以包含特定資訊
```

---

## 模板系統架構

### 運作流程

```
啟動應用程式
    ↓
檢查環境變數 CUSTOM_TEMPLATE_URL
    ↓
    ├─ 有設定 → 載入遠端模板 (10秒超時)
    │           ↓
    │           ├─ 成功 → 使用自訂模板
    │           └─ 失敗 → 降級使用內建模板
    │
    └─ 未設定 → 使用內建模板
```

### 檔案結構

```
services/prompts/
├── index.js                    # 模板載入邏輯（支援遠端載入）
├── templateMetadata.js         # 模板 metadata（名稱、描述、icon）
└── templates/                  # 內建開源模板
    ├── default.js
    ├── ecosystem-loyalist.js
    ├── pragmatic-performer.js
    ├── lifestyle-integrator.js
    └── reliability-seeker.js
```

---

## 如何使用自訂模板

### 步驟概覽

1. 建立自訂模板 JSON 檔案
2. 上傳到 GitHub Secret Gist（或其他私密空間）
3. 在部署環境設定環境變數
4. 驗證模板載入成功

---

## 建立自訂模板 JSON 檔案

### JSON 格式

自訂模板檔案是一個 JSON 物件，每個 key 是模板 ID，value 是提示詞字串。

```json
{
  "default": "提示詞內容...",
  "ecosystem-loyalist": "提示詞內容...",
  "pragmatic-performer": "提示詞內容...",
  "lifestyle-integrator": "提示詞內容...",
  "reliability-seeker": "提示詞內容..."
}
```

### 提示詞變數

提示詞中可以使用以下變數：

| 變數 | 說明 | 範例 |
|-----|------|------|
| `${videoTitle}` | 影片標題 | "iPhone 15 Pro 開箱評測" |
| `${userPrompt}` | 使用者額外要求 | "請強調相機功能" |

### 範例模板

```json
{
  "default": "你是一位專業的科技內容顧問，擅長將複雜的科技知識轉化為讀者能輕易理解並應用的實用內容。\n\n# 任務\n\n請分析這部影片並撰寫一篇專業的產品分享或教學文章。\n\n影片標題：${videoTitle}\n${userPrompt}\n\n# 寫作要求\n\n1. **顧問視角**：以科技生活顧問身份，解釋技術如何解決問題\n2. **價值優先**：用詞精準直接，提供實用價值\n3. **深度分析**：提煉關鍵亮點或核心步驟，闡述原理與應用\n4. **台灣用語**：使用台灣繁體中文、全形標點符號\n5. **中英數空格**：在中文、英文、數字之間插入半形空格（例：iPhone 15 Pro）\n6. **敘述性文字**：使用流暢段落，不使用條列、bullet points、數字列表、表格\n\n# 文章結構\n\n**標題**：生成 3 個風格的標題（15-25 字）\n- titleA：結果/價值導向\n- titleB：情境/痛點導向\n- titleC：技巧/趨勢導向\n\n**內文**（Markdown 格式）：\n- 前言：100-150 字，點出需求痛點\n- 主體：3-5 個段落，每段包含 ## 小標題與敘述性內文\n- 總結：約 100 字\n\n**SEO 描述**：150 字以內，包含主要關鍵字\n\n**截圖時間點**：3-5 個關鍵畫面\n- 時間點格式為 mm:ss\n- 說明選擇原因\n\n# 輸出格式\n\n請輸出 JSON，包含以下欄位：\n- titleA: 字串\n- titleB: 字串\n- titleC: 字串\n- article_text: 字串（Markdown 格式）\n- seo_description: 字串\n- screenshots: 陣列，每個元素包含 timestamp_seconds（字串，格式為 mm:ss）和 reason_for_screenshot（字串）"
}
```

> **提示**：建議從內建模板複製，再加入自訂內容（如品牌名稱、服務項目）。

---

## 使用 GitHub Secret Gist

GitHub Secret Gist 是存放私密內容的理想選擇。

### 1. 建立 Secret Gist

1. 前往 https://gist.github.com/
2. 點選 **「+ New gist」**
3. 檔案名稱：`custom-templates.json`
4. 貼上你的自訂模板 JSON
5. 選擇 **「Create secret gist」**（重要！）

> #### ⚠️ 貼上 JSON 的注意事項
>
> - 只使用純文字編輯器，不要在 Markdown Preview 或 Rich Text 模式下貼上。
> - 如果模板字串有 `\n`，務必保持為字面上的 `\n`，不要被轉成實際換行；可先貼到純文字緩衝區確認。
> - macOS 可使用 `pbcopy < custom-templates.local.json`；Windows 可用 `type custom-templates.local.json | clip`，確保複製的是原始內容。
> - 儲存後點 **Raw**，用 `curl <raw-url> | python3 -m json.tool`（或 `jq '.'`）檢查一次，確認 JSON 合法。

### 2. 取得 Raw URL

建立完成後，點選右上角的 **「Raw」** 按鈕，複製網址。

範例 URL：
```
https://gist.githubusercontent.com/username/abc123def456/raw/custom-templates.json
```

### 3. 建立 GitHub Personal Access Token

若要存取 Secret Gist，需要 Personal Access Token。

1. 前往 https://github.com/settings/tokens
2. 點選 **「Generate new token (classic)」**
3. 勾選權限：`gist`（讀取 Gist）
4. 點選 **「Generate token」**
5. **複製並妥善保管 token**（只會顯示一次）

---

## 設定環境變數

### 本地開發

在專案根目錄建立 `.env.local` 檔案：

```bash
# 專屬模板載入網址
CUSTOM_TEMPLATE_URL=https://gist.githubusercontent.com/username/abc123def456/raw/custom-templates.json

# 專屬模板存取 Token
CUSTOM_TEMPLATE_TOKEN=ghp_your_personal_access_token_here
```

### Render 部署

在 Render 控制台設定環境變數：

1. 進入你的 Web Service
2. 前往 **「Environment」** 分頁
3. 點選 **「Add Environment Variable」**
4. 新增以下變數：

| Key | Value |
|-----|-------|
| `CUSTOM_TEMPLATE_URL` | `https://gist.githubusercontent.com/...` |
| `CUSTOM_TEMPLATE_TOKEN` | `ghp_...` |

5. 點選 **「Save Changes」**
6. Render 會自動重新部署應用程式

---

## 驗證模板載入

### 檢查伺服器日誌

啟動應用程式後，檢查終端機輸出：

**成功載入自訂模板**
```
[Prompts] 🔄 正在載入專屬模板...
[Prompts] ✅ 載入專屬模板成功
```

**降級使用內建模板**
```
[Prompts] ℹ️  未設定自訂模板，使用內建模板
```

或

```
[Prompts] ❌ 載入專屬模板失敗: HTTP 404
[Prompts] ℹ️  降級使用內建模板
```

### Render 日誌

在 Render 控制台查看 **「Logs」** 分頁，確認載入訊息。

---

## 常見問題

### Q1: 模板載入失敗怎麼辦？

**A:** 系統會自動降級使用內建模板，不影響基本功能。請檢查：
- `CUSTOM_TEMPLATE_URL` 是否正確
- Gist 是否設為 Secret（需要 token）
- `CUSTOM_TEMPLATE_TOKEN` 是否有效
- 網路連線是否正常

### Q2: 如何更新自訂模板？

**A:**
1. 編輯 GitHub Gist 內容
2. **不需要重新部署應用程式**
3. 重新啟動伺服器即可載入新版本

或者，清除快取：
```javascript
// 在程式碼中呼叫（開發用）
import { clearCustomTemplatesCache } from './services/prompts/index.js';
clearCustomTemplatesCache();
```

### Q3: 可以使用其他儲存空間嗎？

**A:** 可以！只要滿足以下條件：
- 提供可公開存取的 URL
- 返回有效的 JSON 格式
- （選填）支援 Bearer Token 認證

範例：
- AWS S3 + CloudFront
- Google Cloud Storage
- 自架 API 伺服器

### Q4: 模板 JSON 格式錯誤怎麼辦？

**A:** 系統會捕捉錯誤並降級使用內建模板。請使用 JSON 驗證工具檢查：
- https://jsonlint.com/
- VS Code 的 JSON 格式化功能

### Q5: 如何知道目前使用的是哪個模板？

**A:** 查看伺服器啟動日誌，或在程式碼中呼叫：
```javascript
import { isUsingCustomTemplates } from './services/prompts/index.js';

console.log(isUsingCustomTemplates()); // true: 自訂模板, false: 內建模板
```

### Q6: Token 權限最小化設定？

**A:** 建議只勾選 `gist` 權限，不要給予其他不必要的權限。

### Q7: 如何確保安全性？

**A:**
1. 使用 Secret Gist（非 Public Gist）
2. 定期更新 Personal Access Token
3. **絕對不要**將 `.env.local` 或 token 提交到 Git
4. 確認 `.gitignore` 已包含 `.env.local` 和 `custom-templates.json`

---

## 進階：多組織支援

如果你管理多個組織部署，可以為每個部署設定不同的 `CUSTOM_TEMPLATE_URL`：

```
組織 A (Render) → CUSTOM_TEMPLATE_URL=https://gist.../org-a-templates.json
組織 B (Render) → CUSTOM_TEMPLATE_URL=https://gist.../org-b-templates.json
開源版本       → 未設定 CUSTOM_TEMPLATE_URL（使用內建模板）
```

---

## 相關文件

- [部署到 Render 指南](./DEPLOY_TO_RENDER.md)
- [環境變數設定](./.env.example)

---

如有任何問題，歡迎開 Issue 討論！
