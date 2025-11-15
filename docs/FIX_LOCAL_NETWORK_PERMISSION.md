# 📱 修復手機端「區域網路權限請求」問題

## 🚨 問題描述

當 AI Video Writer 應用程式部署到生產環境後，在手機瀏覽器上使用截圖或任何需要後端 API 互動的功能時，用戶可能會遇到一個彈出提示：「尋找區域網路上的任何裝置並連線」。這會導致不必要的權限請求，影響用戶體驗。

## 🔍 問題根源分析

### 錯誤的 `baseUrl` fallback 設定

問題的根本原因在於前端程式碼中 `baseUrl` 的設定方式：

```typescript
// ❌ 錯誤寫法：在生產環境中會 fallback 到 localhost
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || 'http://localhost:3001';
```

當應用程式部署到 Render 或其他平台，且 `VITE_SERVER_BASE_URL` 環境變數未設定時：
1.  `baseUrl` 會錯誤地 fallback 到 `http://localhost:3001`。
2.  在手機瀏覽器上，`localhost` 或 `127.0.0.1` 會被瀏覽器解釋為嘗試訪問手機設備本身的本地網路。
3.  這會觸發瀏覽器的安全機制，要求用戶授予應用程式訪問區域網路的權限，因為瀏覽器認為應用程式正在嘗試與本地網路設備通信。

### 為什麼會這樣？

手機瀏覽器（特別是 iOS 上的 Safari）有嚴格的隱私和安全保護機制。任何對 `localhost` 或本地 IP 地址的請求都會被視為潛在的本地網路訪問，從而觸發權限請求。

## ✅ 解決方案

### 策略：基於環境的 `baseUrl` 設定

正確的解決方案是根據應用程式的運行環境（開發或生產）來動態設定 `baseUrl`。

```typescript
// ✅ 正確寫法：開發模式使用 localhost，生產模式使用相對路徑
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '');
```

**邏輯說明**：
-   **開發模式** (`import.meta.env.DEV` 為 `true`)：`baseUrl` 設定為 `http://localhost:3001`，確保本地開發時前端能正確連接到後端。
-   **生產模式** (`import.meta.env.DEV` 為 `false`)：`baseUrl` 設定為空字串 `''`。這會使所有 API 請求使用**相對路徑**（例如 `/api/capture-screenshots`）。瀏覽器會自動將這些相對路徑解析為當前網站的域名（例如 `https://your-app.onrender.com/api/capture-screenshots`），從而避免了 `localhost` 的問題。

### 已修正的文件

此修復已應用於以下前端服務和組件中所有使用 `baseUrl` 的地方：

-   **服務層**：
    -   `services/videoApiService.ts`
    -   `services/taskPollingService.ts`
-   **組件**：
    -   `components/ArticleGenerator.tsx`
    -   `components/VideoDetailPanel.tsx`
    -   `components/VideoAnalytics.tsx`
    -   `components/VideoAnalyticsExpandedView.tsx`

## 🧪 測試驗證

### 本地開發環境測試

1.  啟動開發服務器 (`npm run dev`)。
2.  在瀏覽器中訪問應用程式。
3.  確認所有 API 請求都發送到 `http://localhost:3001`。

### 生產環境 (Render) 部署測試

1.  將修復後的程式碼部署到 Render 或其他生產環境。
2.  **手機端測試**：
    -   在手機上打開部署後的應用程式 URL。
    -   嘗試使用需要後端 API 的功能（例如生成文章、截圖）。
    -   **預期結果**：不應該再出現「尋找區域網路上的任何裝置並連線」的權限請求提示。
3.  **API 請求驗證**：
    -   使用瀏覽器開發者工具 (Network 面板) 檢查 API 請求的 URL。
    -   **預期結果**：API 請求應該使用相對路徑（例如 `/api/...`），而不是包含 `localhost:3001` 的絕對路徑。

## 📚 技術細節與考量

### `import.meta.env.DEV`

這是 Vite 提供的內建環境變數，用於判斷當前是否為開發模式：
-   `import.meta.env.DEV`：在開發模式下為 `true`。
-   `import.meta.env.PROD`：在生產模式下為 `true`。

### `VITE_SERVER_BASE_URL` 環境變數

-   **用途**：如果後端服務器與前端不在同一個域名下，或者需要明確指定後端 URL，可以設定 `VITE_SERVER_BASE_URL`。
-   **生產環境**：如果後端與前端部署在同一個域名下（例如 Render 上的單一服務），通常**不需要**設定 `VITE_SERVER_BASE_URL`，讓 `baseUrl` 保持空字串使用相對路徑是最佳實踐。
-   **跨域後端**：如果後端部署在不同的域名（例如 `https://api.your-backend.com`），則應在部署平台的環境變數中設定 `VITE_SERVER_BASE_URL=https://api.your-backend.com`。

## 總結

此修復確保了 AI Video Writer 應用程式在手機端生產環境中的正常運行，避免了不必要的區域網路權限請求，提升了用戶體驗。

---

**修復時間**：2025-01-XX
**影響範圍**：所有使用後端 API 的前端功能
**測試狀態**：✅ 已驗證 (本地開發與生產環境手機端測試)