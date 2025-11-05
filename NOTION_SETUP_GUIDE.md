# Notion 整合功能設定指南

## 🎯 功能簡介

此功能允許使用者將 AI 生成的文章直接儲存到自己的 Notion 工作區，方便後續編輯和發布。

**主要特色：**
- ✅ OAuth 2.0 安全授權
- ✅ 自動轉換 Markdown 為 Notion blocks
- ✅ 支援圖片截圖嵌入
- ✅ 自動添加 SEO 描述、YouTube 連結等屬性
- ✅ 只有連接 Notion 的使用者才會看到儲存功能

## 📋 前置需求

1. Notion 帳號
2. 已部署的應用伺服器
3. 可以存取 Notion API

## 🔧 設定步驟

### 步驟 1：建立 Notion Integration

1. 前往 [Notion Integrations](https://www.notion.so/my-integrations)
2. 點擊「New integration」或「+ Create new integration」
3. 填寫基本資訊：
   - **Name**: AI Video Writer（或自訂名稱）
   - **Logo**: 可選
   - **Associated workspace**: 選擇你的工作區

4. 設定 OAuth 配置：
   - 點擊「Public Integration」分頁
   - 開啟「OAuth」功能
   - **Redirect URIs**: 添加以下 URL
     - 本地開發：`http://localhost:3001/api/notion/callback`
     - 生產環境：`https://your-domain.com/api/notion/callback`

5. 設定權限 (Capabilities)：
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content
   - ✅ Read user information

6. 完成後，記下以下資訊：
   - **OAuth client ID**
   - **OAuth client secret**

### 步驟 2：設定環境變數

編輯 `.env.local` 檔案，添加以下設定：

```bash
# Notion OAuth 設定
NOTION_CLIENT_ID=your_oauth_client_id_here
NOTION_CLIENT_SECRET=your_oauth_client_secret_here
NOTION_REDIRECT_URI=http://localhost:3001/api/notion/callback
```

**注意：**
- `NOTION_CLIENT_ID`: 從步驟 1 取得的 OAuth client ID
- `NOTION_CLIENT_SECRET`: 從步驟 1 取得的 OAuth client secret
- `NOTION_REDIRECT_URI`: 必須與 Notion Integration 設定中的 Redirect URI 完全一致

### 步驟 3：安裝依賴套件

所有必要的套件已經安裝完成：
- ✅ `@notionhq/client` - Notion 官方 SDK
- ✅ `cookie-parser` - Cookie 處理中介軟體

### 步驟 4：重啟應用

```bash
# 停止現有的應用
# Ctrl+C

# 重新啟動
npm run dev
```

## 🎨 使用方式

### 對於一般使用者

1. **生成文章**
   - 登入 YouTube 帳號
   - 選擇影片並生成文章

2. **連接 Notion**
   - 在文章生成器頁面，會看到「連接到 Notion」區塊
   - 點擊「連接 Notion」按鈕
   - 在彈出的 Notion 授權頁面中選擇工作區並授權

3. **儲存文章到 Notion**
   - 連接 Notion 後，文章內容區塊會出現「儲存到 Notion」按鈕
   - 點擊按鈕，選擇目標資料庫
   - 點擊「儲存」即可

4. **在 Notion 中查看**
   - 儲存成功後會顯示「在 Notion 中查看」連結
   - 點擊連結即可在 Notion 中打開文章

### 文章在 Notion 中的結構

儲存到 Notion 的文章包含以下內容：

**頁面屬性：**
- **Name**: 文章標題（選項 A）
- **SEO 描述**: 搜尋引擎優化描述
- **YouTube ID**: 影片 ID
- **YouTube 連結**: 完整影片連結
- **原始標題**: YouTube 影片原始標題
- **Tags**: 自動標籤（AI Generated, YouTube）
- **Status**: 預設為「草稿」

**頁面內容：**
- 完整文章內容（Markdown 轉換為 Notion blocks）
- 文章截圖（如果有生成）

## 🔒 安全性說明

### OAuth Token 儲存

- Access token 儲存在 **httpOnly cookies** 中
- 無法被 JavaScript 存取，防止 XSS 攻擊
- Cookie 有效期為 90 天
- 使用者可隨時中斷連接

### 資料傳輸

- 所有請求都透過 HTTPS 加密
- Token 僅在伺服器端處理
- 不會儲存使用者的 Notion 內容

### 權限範圍

- 應用只能存取使用者授權的工作區
- 只能讀取和寫入資料庫
- 無法刪除或修改使用者的其他 Notion 內容

## 📊 API 限制

### Notion API Rate Limits

- **速率限制**: 每秒 3 個請求（per integration）
- **區塊限制**: 一次最多創建 100 個 blocks
- **文字限制**: 每個 block 最多 2000 字元

### 自動處理機制

應用已實作以下機制處理 API 限制：

1. **自動分批處理**: 超過 100 個 blocks 會自動分批創建
2. **速率限制保護**: 批次請求間自動延遲 350ms
3. **文字自動分割**: 超過 2000 字元的段落自動分割
4. **錯誤重試**: 遇到 rate limit 錯誤會自動重試

## 🐛 常見問題

### 1. 無法連接到 Notion

**症狀**: 點擊「連接 Notion」沒有反應或顯示錯誤

**解決方法**:
- 確認 `.env.local` 中的 `NOTION_CLIENT_ID` 和 `NOTION_CLIENT_SECRET` 正確
- 確認 `NOTION_REDIRECT_URI` 與 Notion Integration 設定完全一致
- 檢查瀏覽器控制台是否有錯誤訊息
- 確認應用伺服器正在運行

### 2. 找不到資料庫

**症狀**: 儲存時選單中沒有資料庫

**解決方法**:
- 確保 Notion 工作區中有資料庫（Database）
- 重新授權 Notion 連接
- 檢查 Notion Integration 的權限設定

### 3. 儲存失敗

**症狀**: 點擊儲存後顯示錯誤訊息

**可能原因及解決方法**:
- **Token 過期**: 中斷連接後重新連接
- **資料庫被刪除**: 選擇其他資料庫
- **內容過大**: 文章內容超過限制，嘗試縮短文章
- **Rate limit**: 等待幾秒後重試

### 4. 圖片無法顯示

**症狀**: 在 Notion 中看不到截圖

**解決方法**:
- 確保圖片 URL 是公開存取的
- 檢查應用伺服器的圖片服務是否正常
- 確認 `.env.local` 中的 `VITE_SERVER_BASE_URL` 設定正確

### 5. 中文字元顯示異常

**症狀**: 儲存後中文字變成亂碼

**解決方法**:
- 這通常不會發生，因為 Notion API 支援 UTF-8
- 如果發生，請回報 issue 並提供範例文章

## 🔄 取消連接

使用者可以隨時中斷與 Notion 的連接：

1. 在文章生成器頁面找到已連接的 Notion 帳戶資訊
2. 點擊「中斷連接」按鈕
3. 確認後即可中斷連接

**注意**: 中斷連接後：
- Cookie 中的 access token 會被清除
- 已儲存到 Notion 的文章不受影響
- 可以隨時重新連接

## 📝 開發說明

### 後端架構

**檔案結構**:
```
routes/
  └─ notionRoutes.js          # API 路由定義
services/
  └─ notionService.js         # Notion API 服務封裝
server.js                     # 主伺服器（已註冊 Notion 路由）
```

**API 端點**:
- `GET  /api/notion/auth-url` - 取得 OAuth 授權 URL
- `GET  /api/notion/callback` - OAuth 回調處理
- `GET  /api/notion/status` - 檢查連接狀態
- `GET  /api/notion/databases` - 取得資料庫列表
- `POST /api/notion/save-article` - 儲存文章
- `POST /api/notion/disconnect` - 中斷連接

### 前端架構

**檔案結構**:
```
contexts/
  └─ NotionContext.tsx        # React Context（全域狀態管理）
components/
  ├─ NotionConnect.tsx        # 連接 UI 元件
  └─ NotionSaveButton.tsx     # 儲存按鈕元件
```

**整合位置**:
- `index.tsx`: 使用 `NotionProvider` 包裝整個應用
- `ArticleGenerator.tsx`: 添加 `NotionConnect` 和 `NotionSaveButton`

### 資料流程

```
使用者點擊「連接 Notion」
  ↓
前端呼叫 /api/notion/auth-url
  ↓
導向 Notion OAuth 授權頁面
  ↓
使用者授權後導向 /api/notion/callback
  ↓
伺服器交換 access token 並儲存在 cookie
  ↓
導向回應用，前端檢測到連接成功
  ↓
使用者生成文章後點擊「儲存到 Notion」
  ↓
前端呼叫 /api/notion/databases 取得資料庫列表
  ↓
使用者選擇資料庫後點擊儲存
  ↓
前端呼叫 /api/notion/save-article
  ↓
後端將 Markdown 轉換為 Notion blocks 並創建頁面
  ↓
回傳頁面 URL 給前端顯示
```

## 🚀 進階設定

### 自訂頁面屬性

如果需要自訂儲存到 Notion 的頁面屬性，可以修改 `services/notionService.js` 中的 `buildPageProperties` 方法。

### 自訂 Markdown 轉換

如果需要支援更多 Markdown 語法，可以修改 `services/notionService.js` 中的 `convertMarkdownToBlocks` 方法。

### 自訂錯誤處理

可以在 `routes/notionRoutes.js` 中添加更詳細的錯誤處理邏輯。

## 📚 相關文件

- [Notion API 文件](https://developers.notion.com/)
- [Notion API 限制說明](./NOTION_API_LIMITS.md)
- [Notion 整合架構](./NOTION_INTEGRATION_PLAN.md)
- [條件顯示邏輯](./NOTION_CONDITIONAL_DISPLAY.md)

## 🤝 技術支援

如果遇到問題，請：
1. 檢查伺服器日誌（console 輸出）
2. 檢查瀏覽器控制台錯誤訊息
3. 確認所有環境變數設定正確
4. 參考常見問題章節

## 🎉 完成

恭喜！你已經完成 Notion 整合功能的設定。現在使用者可以：
- ✅ 連接自己的 Notion 工作區
- ✅ 將 AI 生成的文章儲存到 Notion
- ✅ 在 Notion 中編輯和發布文章
- ✅ 隨時中斷連接

享受更流暢的內容創作流程！
