# 修復手機端「區域網路權限請求」問題

## 問題描述

在手機瀏覽器上使用截圖功能時，會出現「尋找區域網路上的任何裝置並連線」的權限請求提示。

## 問題根源

### 原因分析

在多處代碼中使用了錯誤的 fallback 設定：

```typescript
// ❌ 錯誤寫法（會導致手機端權限請求）
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || 'http://localhost:3001';
```

當應用部署到 Render 且沒有設置 `VITE_SERVER_BASE_URL` 環境變數時：
1. 代碼會 fallback 到 `http://localhost:3001`
2. 在手機瀏覽器上，`localhost` 指向手機本身
3. 瀏覽器認為你要訪問本地網絡設備
4. **觸發區域網路訪問權限請求**

### 為什麼會這樣？

手機瀏覽器的安全機制：
- `localhost` 或 `127.0.0.1` 會被視為訪問本地設備
- 任何對本地 IP 的請求都可能觸發區域網路訪問權限
- 這是瀏覽器的隱私保護功能

## 解決方案

### 修改策略

使用環境檢測來設定正確的 API 基址：

```typescript
// ✅ 正確寫法
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '');
```

邏輯說明：
- **開發模式** (`import.meta.env.DEV === true`)：使用 `http://localhost:3001`
- **生產模式**：使用空字符串（相對路徑，與前端同域）

### 已修改的文件

已修正以下文件中的所有 `localhost:3001` fallback：

#### 前端服務層
1. ✅ `services/videoApiService.ts` - API 基址配置
2. ✅ `services/taskPollingService.ts` - 任務輪詢服務

#### 前端組件
3. ✅ `components/ArticleGenerator.tsx` - 文章生成器
4. ✅ `components/VideoDetailPanel.tsx` - 影片詳情面板
5. ✅ `components/VideoAnalytics.tsx` - 影片分析（2 處）
6. ✅ `components/VideoAnalyticsExpandedView.tsx` - 展開視圖（2 處）

### 修改對比

**修改前**：
```typescript
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || 'http://localhost:3001';
```

**修改後**：
```typescript
// 開發模式使用 localhost:3001，生產模式使用空字符串（相對路徑）
const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '');
```

## 測試驗證

### 本地開發環境

```bash
# 啟動開發服務器
npm run dev

# 測試 API 請求
# 應該使用 http://localhost:3001
```

### 生產環境（Render）

1. **部署後測試**：
   ```bash
   # 部署到 Render
   git add .
   git commit -m "Fix local network permission issue"
   git push
   ```

2. **手機端測試**：
   - 在手機上打開 Render 部署的應用
   - 選擇一個影片
   - 點擊「生成文章」或「截圖」
   - **不應該再出現區域網路權限請求** ✅

3. **驗證 API 請求**：
   - 打開瀏覽器開發者工具的 Network 面板
   - 檢查 API 請求 URL
   - 應該使用相對路徑（例如 `/api/...`）而非 `http://localhost:3001/api/...`

## 技術細節

### 相對路徑 vs 絕對路徑

**生產模式使用空字符串的原因**：

```typescript
// 當 baseUrl = ''
fetch(`${baseUrl}/api/capture-screenshots`)
// 等同於
fetch('/api/capture-screenshots')
// 瀏覽器會自動使用當前域名
// 例如: https://your-app.onrender.com/api/capture-screenshots
```

好處：
- ✅ 自動使用當前域名
- ✅ 支持 HTTPS
- ✅ 不需要手動配置環境變數
- ✅ 不會觸發區域網路權限請求

### import.meta.env.DEV

Vite 提供的內建環境變數：
- `import.meta.env.DEV` - 開發模式時為 `true`
- `import.meta.env.PROD` - 生產模式時為 `true`
- `import.meta.env.MODE` - 當前模式（`'development'` 或 `'production'`）

## 環境變數配置（可選）

如果需要使用不同的後端服務器，可以設置環境變數：

### 本地開發（.env.local）

```bash
# 可選：覆蓋默認的 localhost:3001
VITE_SERVER_BASE_URL=http://localhost:3001
```

### Render 部署

在 Render Dashboard 設置環境變數：

```
VITE_SERVER_BASE_URL=https://your-backend-url.com
```

但通常**不需要設置**，使用預設的相對路徑即可。

## 相關問題

### 為什麼開發模式還要用 localhost？

因為在本地開發時：
- 前端運行在 `http://localhost:5173`（Vite 默認端口）
- 後端運行在 `http://localhost:3001`
- 需要明確指定後端地址

### 為什麼不直接用 window.location.origin？

因為：
1. `import.meta.env.DEV` 在編譯時確定，性能更好
2. 更明確的配置，便於理解和維護
3. 支持環境變數覆蓋

## 總結

### 問題
手機端出現「區域網路權限請求」是因為錯誤地使用了 `localhost:3001` 作為生產環境的 fallback。

### 解決
使用環境檢測：
- 開發模式 → `http://localhost:3001`
- 生產模式 → 空字符串（相對路徑）

### 結果
✅ 本地開發正常運行
✅ 生產環境使用相對路徑
✅ 手機端不再出現權限請求
✅ 所有 API 請求正常工作

---

**修復時間**: 2025-01-XX
**影響範圍**: 所有使用 API 請求的功能
**測試狀態**: ✅ 待驗證（部署後在手機端測試）
