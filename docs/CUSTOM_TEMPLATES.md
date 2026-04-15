# 🎨 自訂文章模板使用指南

本文件將詳細說明 AI Video Writer 如何支援使用**遠端自訂模板**來客製化文章生成風格。這項功能特別適合組織內部部署或個人根據特定需求調整內容風格。

## 💡 什麼是自訂模板？

自訂模板是一組**提示詞範本 (Prompt Templates)**，用於指導 AI (Google Gemini) 如何生成文章。每個模板可以針對不同的目標受眾、寫作風格或內容重點進行設計，確保生成的文章更符合您的特定需求。

### 內建模板

專案內建了多個開源模板，例如：`通用讀者`、`生態忠誠者`、`務實效能者`、`生活整合者`、`信賴致上者`。這些模板提供了多樣化的寫作風格和內容側重點。

### 自訂模板的優勢

自訂模板讓您能夠：
-   **整合組織特色**：在文章中加入公司特有的服務、品牌訊息或產品資訊。
-   **調整寫作風格**：根據您的品牌語氣或個人偏好，調整文章的正式程度、輕鬆度或技術性。
-   **優化特定產業內容**：針對特定產業（如 3C、美妝、金融）優化提示詞，使用專業術語，並符合產業內容規範。
-   **保持內容私密**：將您的專屬提示詞儲存在私密空間，不公開到開源專案。

## ⚙️ 模板系統架構

### 運作流程

應用程式啟動時，會檢查 `CUSTOM_TEMPLATE_URL` 環境變數：

1.  **`CUSTOM_TEMPLATE_URL` 已設定**：
    -   應用程式會嘗試從該 URL 載入遠端模板（設有 10 秒超時）。
    -   **成功**：使用自訂模板進行文章生成。
    -   **失敗**：降級使用內建模板，並在日誌中記錄錯誤。
2.  **`CUSTOM_TEMPLATE_URL` 未設定**：
    -   直接使用專案內建的開源模板。

### 檔案結構

模板相關的程式碼位於 `services/prompts/` 目錄：
-   `index.js`：負責模板的載入邏輯，支援遠端載入和快取。
-   `templateMetadata.js`：定義內建模板的元數據（名稱、描述、圖標）。
-   `templates/`：存放所有內建的開源提示詞檔案。

## 📝 如何建立與使用自訂模板

### 步驟 1：建立自訂模板 JSON 檔案

自訂模板檔案是一個 JSON 物件，其中每個 Key 代表一個模板 ID，Value 則是該模板的提示詞字串。

```json
{
  "default": "你是一位專業的科技內容顧問，擅長將複雜的科技知識轉化為讀者能輕易理解並應用的實用內容。\n\n# 任務\n\n請分析這部影片並撰寫一篇專業的產品分享或教學文章。\n\n影片標題：${videoTitle}\n${userPrompt}\n\n# 寫作要求\n\n1. **顧問視角**：以科技生活顧問身份，解釋技術如何解決問題\n2. **價值優先**：用詞精準直接，提供實用價值\n3. **深度分析**：提煉關鍵亮點或核心步驟，闡述原理與應用\n4. **台灣用語**：使用台灣繁體中文、全形標點符號\n5. **中英數空格**：在中文、英文、數字之間插入半形空格（例：iPhone 15 Pro）\n6. **敘述性文字**：使用流暢段落，不使用條列、bullet points、數字列表、表格\n\n# 文章結構\n\n**標題**：生成 3 個風格的標題（15-25 字）\n- titleA：結果/價值導向\n- titleB：情境/痛點導向\n- titleC：技巧/趨勢導向\n\n**內文**（Markdown 格式）：\n- 前言：100-150 字，點出需求痛點\n- 主體：3-5 個段落，每段包含 ## 小標題與敘述性內文\n- 總結：約 100 字\n\n**SEO 描述**：150 字以內，包含主要關鍵字\n\n**截圖時間點**：3-5 個關鍵畫面\n- 時間點格式為 mm:ss\n- 說明選擇原因\n\n# 輸出格式\n\n請輸出 JSON，包含以下欄位：\n- titleA: 字串\n- titleB: 字串\n- titleC: 字串\n- article_text: 字串（Markdown 格式）\n- seo_description: 字串\n- screenshots: 陣列，每個元素包含 timestamp_seconds（字串，格式為 mm:ss）和 reason_for_screenshot（字串）"
}
```

**提示詞變數**：
您可以在提示詞中使用以下變數，應用程式會自動替換為實際值：
-   `${videoTitle}`：影片的標題。
-   `${userPrompt}`：用戶在前端輸入的額外提示。

**建議**：您可以從專案內建的模板 (`services/prompts/templates/`) 複製一份作為起點，然後根據您的需求進行修改。

### 步驟 2：託管您的模板 (使用 GitHub Secret Gist)

GitHub Secret Gist 是託管私密模板內容的理想選擇。

1.  **建立 Secret Gist**：
    -   前往 [Gist GitHub](https://gist.github.com/)。
    -   點擊 **「+ New gist」**。
    -   **檔案名稱**：輸入 `custom-templates.json`。
    -   **內容**：貼上您在步驟 1 中建立的自訂模板 JSON 內容。
    -   **選擇「Create secret gist」** (非常重要，確保您的模板內容不會公開)。
    > **貼上 JSON 的注意事項**：請確保貼上的是純文字 JSON，避免因格式問題導致解析失敗。如果模板字串中包含換行符號 (`\n`)，請確保它們是字面上的 `\n`，而不是實際的換行。
2.  **取得 Raw URL**：
    -   Gist 建立完成後，點擊右上角的 **「Raw」** 按鈕。
    -   複製瀏覽器網址列中的 URL (格式：`https://gist.githubusercontent.com/username/abc123def456/raw/custom-templates.json`)。

3.  **建立 GitHub Personal Access Token (PAT)**：
    -   若要讓應用程式能夠存取您的 Secret Gist，您需要一個具有 `gist` 權限的 PAT。
    -   前往 [GitHub Personal Access Tokens](https://github.com/settings/tokens)。
    -   點擊 **「Generate new token (classic)」**。
    -   **Note**: 輸入 `Custom Template Access`。
    -   **Select scopes**: 勾選 `gist` (讀取 Gist)。
    -   點擊 **「Generate token」**。
    -   **⚠️ 重要**：立即複製顯示的 token (格式：`ghp_xxxxxxxxxxxxxx`)，因為離開頁面後將無法再次查看。

### 步驟 3：設定環境變數

將模板的 URL 和存取 Token 設定為應用程式的環境變數。

#### 本地開發環境 (`.env.local`)

在專案根目錄下的 `.env.local` 檔案中，新增以下變數：

```env
# 自訂模板設定
CUSTOM_TEMPLATE_URL="YOUR_GIST_RAW_URL_HERE"
CUSTOM_TEMPLATE_TOKEN="YOUR_GITHUB_PAT_HERE"
```
將 `YOUR_GIST_RAW_URL_HERE` 替換為您在步驟 2 中取得的 Gist Raw URL，`YOUR_GITHUB_PAT_HERE` 替換為您的 GitHub PAT。

#### 部署環境 (例如 Render)

如果您部署到 Render 等平台，請在該平台的環境變數設定中新增這些變數。

1.  進入您的 Render Web Service。
2.  前往 **「Environment」** 分頁。
3.  點擊 **「Add Environment Variable」**，新增 `CUSTOM_TEMPLATE_URL` 和 `CUSTOM_TEMPLATE_TOKEN`。
4.  儲存並重新部署服務。

### 步驟 4：驗證模板載入

啟動應用程式後，檢查伺服器日誌以確認自訂模板是否成功載入。

-   **成功載入**：
    ```
    [Prompts] 🔄 正在載入專屬模板...
    [Prompts] ✅ 載入專屬模板成功
    ```
-   **降級使用內建模板** (例如 `CUSTOM_TEMPLATE_URL` 未設定或載入失敗)：
    ```
    [Prompts] ℹ️  未設定自訂模板，使用內建模板
    ```
    或
    ```
    [Prompts] ❌ 載入專屬模板失敗: HTTP 404
    [Prompts] ℹ️  降級使用內建模板
    ```

## 🛠️ 常見問題與故障排除

### Q1: 模板載入失敗怎麼辦？

**A:** 系統會自動降級使用內建模板，不影響基本功能。請檢查：
-   `CUSTOM_TEMPLATE_URL` 環境變數是否正確設定，且 URL 是 Gist 的 **Raw URL**。
-   Gist 是否設為 **Secret Gist** (如果是 Public Gist 則不需要 `CUSTOM_TEMPLATE_TOKEN`)。
-   `CUSTOM_TEMPLATE_TOKEN` 環境變數是否正確設定，且 PAT 具有 `gist` 權限。
-   網路連線是否正常。
-   Gist 中的 JSON 格式是否合法 (可使用 [JSONLint](https://jsonlint.com/) 驗證)。

### Q2: 如何更新自訂模板？

**A:**
1.  直接編輯 GitHub Gist 的內容。
2.  **不需要重新部署應用程式**。
3.  重新啟動伺服器即可載入新版本的模板。
4.  在開發模式下，您也可以在程式碼中呼叫 `clearCustomTemplatesCache()` 來強制清除快取並重新載入。

### Q3: 可以使用 GitHub Gist 以外的儲存空間嗎？

**A:** 可以。只要該儲存空間滿足以下條件：
-   提供一個可公開存取的 URL。
-   返回有效的 JSON 格式內容。
-   (選填) 支援 Bearer Token 等認證方式。
常見的替代方案包括 AWS S3、Google Cloud Storage 或自架 API 伺服器。

### Q4: 模板 JSON 格式錯誤怎麼辦？

**A:** 系統會捕捉錯誤並降級使用內建模板。請使用 JSON 驗證工具檢查：
-   https://jsonlint.com/
-   VS Code 的 JSON 格式化功能

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
1.  **使用 Secret Gist**：確保您的模板內容不會公開。
2.  **最小權限 PAT**：GitHub PAT 只給予 `gist` 權限。
3.  **切勿提交敏感資訊**：絕對不要將 `.env.local` 或任何包含 token 的檔案提交到 Git。
4.  **定期更新 PAT**：建議定期更新您的 GitHub PAT。

--- 

## 📚 相關文件

-   [部署到 Render 指南](./DEPLOY_TO_RENDER.md)
-   [環境變數設定範例](../.env.example)

--- 

如有任何問題，歡迎開 Issue 討論！