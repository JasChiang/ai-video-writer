# 專案改進與發展藍圖

本文件記錄了 AI Video Writer 專案在程式碼品質、安全性、可維護性方面的改進，並概述了未來的發展方向。

## ✅ 已完成的程式碼品質改進

以下是專案為提升程式碼品質和開發體驗而實施的關鍵改進：

### 1. 導入 ESLint 和 Prettier

-   **目標**：統一程式碼風格，提升團隊協作效率，並及早發現潛在問題。
-   **實施**：新增 `.eslintrc.json`, `.prettierrc`, `.prettierignore` 配置檔案，並更新 `package.json` 腳本以支援 `lint`, `lint:fix`, `format`, `format:check` 命令。
-   **影響**：確保程式碼風格一致性，減少 Code Review 中的風格爭議，並提高程式碼可讀性。

### 2. 強化 TypeScript 嚴格模式設定

-   **目標**：提升類型安全性，在編譯期間捕捉更多潛在錯誤，減少執行時期錯誤。
-   **實施**：在 `tsconfig.json` 中啟用 `strict: true` 及一系列嚴格類型檢查選項，如 `noImplicitAny`, `strictNullChecks`, `noUnusedLocals` 等。
-   **影響**：大幅提高程式碼的健壯性和可靠性，改善 IDE 的智能提示功能。
-   **後續工作**：持續修復現有程式碼中的類型錯誤，為所有函數加入明確的返回類型，並消除 `any` 類型的使用。

### 3. 修正硬編碼的 API 基址

-   **目標**：提升部署靈活性，支援不同環境（開發、測試、生產）的配置。
-   **實施**：將前端 API 基址從硬編碼改為使用環境變數 `VITE_API_URL`，並新增 `FRONTEND_URL` 和 `PORT` 環境變數。
-   **影響**：無需修改程式碼即可更改 API 端點，使專案更容易部署和管理。

### 4. 建立統一錯誤處理中介軟體

-   **目標**：統一錯誤回應格式，簡化錯誤處理邏輯，提升 API 安全性。
-   **實施**：新增 `middleware/errorHandler.js` (包含 `AppError` 類別、`errorHandler`, `notFoundHandler`, `asyncHandler`) 和 `middleware/validation.js` (包含多種輸入驗證函數)。
-   **影響**：提供一致且清晰的錯誤訊息，有效防止 Command Injection 等安全風險，並簡化開發者的錯誤追蹤和除錯工作。
-   **後續工作**：在 `server.js` 中全面整合這些中介軟體，並將現有驗證邏輯遷移至 `validation.js`。

### 5. 改善 CORS 設定

-   **目標**：提升 API 安全性，防止未授權的跨域請求。
-   **實施**：將 `server.js` 中的 CORS 設定從寬鬆模式 (`app.use(cors())`) 改為限制僅允許指定前端網址的配置。
-   **影響**：符合生產環境的安全標準，確保只有授權的來源可以訪問 API。

## 🚀 專案發展藍圖 (待完成的改進)

以下是專案未來規劃的關鍵改進方向，旨在進一步提升專案的可擴展性、可維護性、和測試覆蓋率：

### 1. 重構 `server.js`

-   **目標**：將龐大的 `server.js` 檔案（目前約 1400 行）拆分為更小、更具模組化的組件，提升程式碼可讀性和可維護性。
-   **建議架構**：
    -   `server/routes/`：存放各功能模組的路由定義。
    -   `server/services/`：存放業務邏輯和外部服務整合（如 `geminiService.js`, `videoService.js`）。
    -   `server/middleware/`：存放中介軟體（`errorHandler.js`, `validation.js`）。
    -   `server/utils/`：存放通用工具函數。
-   **預期效益**：大幅提升程式碼可讀性，便於單元測試，降低維護成本，並支援團隊協作開發。

### 2. 導入測試框架

-   **目標**：建立全面的測試體系，確保程式碼的穩定性和可靠性，並加速開發迭代。
-   **建議工具**：`Jest`, `@testing-library/react`。
-   **優先測試項目**：
    -   **單元測試**：驗證函數和工具函數的正確性。
    -   **API 端點測試**：確保各 API 路由的功能正常。
    -   **React 組件測試**：驗證前端 UI 組件的行為。
-   **目標**：逐步達到 50% 以上的測試覆蓋率。

### 3. 提取重複的 Gemini API 調用邏輯

-   **目標**：減少程式碼重複，提高可重用性和可維護性。
-   **實施**：建立一個專用的 `services/geminiService.js` 模組，封裝所有對 Gemini API 的調用邏輯。
-   **預期效益**：簡化 Gemini API 的使用，使程式碼更清晰，並便於未來模型或參數的調整。

## 📊 改進成效評估 (總結)

| 項目 | 改進前狀態 | 改進後狀態 |
| :--- | :--- | :--- |
| **ESLint/Prettier** | ❌ 無 | ✅ 已設定 |
| **TypeScript 嚴格模式** | ❌ 無 | ✅ 已啟用 |
| **硬編碼問題** | ⚠️ API 基址硬編碼 | ✅ 已修正，使用環境變數 |
| **錯誤處理** | ⚠️ 分散在各處，格式不統一 | ✅ 已建立統一中介軟體 |
| **CORS 設定** | ⚠️ 過於寬鬆 (`cors()`) | ✅ 已限制來源 |
| **程式碼組織** | ⚠️ `server.js` 過於龐大 | 🔄 待重構 |
| **測試覆蓋率** | ❌ 0% | 🔄 待建立 |

---

## 📚 參考資源

-   [ESLint 官方文檔](https://eslint.org/docs/latest/)
-   [Prettier 官方文檔](https://prettier.io/docs/en/)
-   [TypeScript 嚴格模式指南](https://www.typescriptlang.org/tsconfig#strict)
-   [Express 錯誤處理](https://expressjs.com/en/guide/error-handling.html)
-   [CORS 中介軟體](https://expressjs.com/en/resources/middleware/cors.html)

---

*由 [Jas Chiang](https://www.linkedin.com/in/jascty/) 創建，並由 Claude Code 協助實施部分改進。*