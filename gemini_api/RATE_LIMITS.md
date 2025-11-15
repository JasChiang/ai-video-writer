# 🚦 Gemini API 速率限制與配額管理

本文件說明 Google Gemini API 的速率限制 (Rate Limits) 機制，以及這些限制對 AI Video Writer 專案的影響和應對策略。了解速率限制對於確保應用程式的穩定運行和用戶體驗至關重要。

## 💡 什麼是速率限制？

速率限制是 Google Gemini API 用來規範您在特定時間範圍內可以發出請求數量的機制。這些限制有助於維護公平使用、防止濫用，並確保所有用戶的系統性能。

速率限制通常從以下三個維度衡量：

-   **每分鐘請求數 (RPM - Requests Per Minute)**
-   **每分鐘 Token 數 (TPM - Tokens Per Minute)**
-   **每日請求數 (RPD - Requests Per Day)**

您的使用量會針對每個限制進行評估，超出任何一個限制都會觸發速率限制錯誤。速率限制是針對每個專案而非每個 API 金鑰。每日配額 (RPD) 會在太平洋時間午夜重置。

## 📊 免費方案 (Free Tier) 的主要限制

AI Video Writer 專案在初始階段通常會使用 Gemini API 的免費方案。以下是與專案主要使用的 `gemini-2.5-flash` 模型相關的免費方案限制：

| 模型 | RPM (每分鐘請求數) | TPM (每分鐘 Token 數) | RPD (每日請求數) |
| :--- | :----------------- | :-------------------- | :--------------- |
| `Gemini 2.5 Flash` | 10 | 250,000 | 250 |

> **注意**：實驗性 (Experimental) 和預覽 (Preview) 模型的速率限制通常更為嚴格。

## 🚀 AI Video Writer 的應對策略

為了在速率限制下確保應用程式的穩定運行和良好的用戶體驗，AI Video Writer 採取了以下策略：

1.  **非同步任務隊列**：對於長時間運行的任務（如文章生成），應用程式會將其轉換為後端非同步任務，並使用輪詢機制查詢進度。這有助於分散請求，避免單次操作因前端超時而失敗。
2.  **錯誤處理與重試**：當遇到速率限制錯誤 (HTTP 429 Too Many Requests) 時，應用程式會實施指數退避 (Exponential Backoff) 機制進行重試，以增加請求成功的機會。
3.  **用戶通知**：在前端，當任務因速率限制而延遲或失敗時，會向用戶提供清晰的通知，建議稍後重試或考慮升級 API 方案。
4.  **快取機制**：對於 YouTube 影片列表的搜尋，專案採用了 Gist 快取機制，大幅減少了對 YouTube Data API 的直接呼叫，從而間接降低了整體 API 使用量，避免因頻繁呼叫而觸發相關 API 的速率限制。

## 📈 升級使用方案

如果您的應用程式使用量增加，超出了免費方案的限制，您可以考慮升級到更高的使用方案 (Tier 1, Tier 2, Tier 3)。升級通常與您的 Google Cloud 總消費額掛鉤。

### 如何升級

1.  **啟用 Cloud Billing**：首先，您必須為您的 Google Cloud 專案啟用 Cloud Billing。
2.  **符合資格**：當您的專案符合下一層級的資格（通常基於 Google Cloud 服務的累積消費額）時，您將有機會升級。
3.  **請求升級**：前往 [AI Studio 的 API 金鑰頁面](https://aistudio.google.com/app/apikey)，找到您的專案並點擊「升級」選項。

## ⚠️ 重要注意事項

-   **速率限制非保證**：Google 不保證特定的速率限制，實際容量可能會有所不同。
-   **監控使用量**：建議定期在 [AI Studio](https://aistudio.google.com/usage?timeRange=last-28-days&tab=rate-limit) 或 Google Cloud Console 中監控您的 API 使用量。
-   **請求增加限制**：如果您需要更高的速率限制，可以透過 Google 提供的表單提交請求。

---

## 📚 相關文件

-   [Google Gemini 官方速率限制文件](https://ai.google.dev/gemini-api/docs/rate-limits)
-   [Gemini 模型概覽](./GEMINI_MODELS.md)
-   [AI Video Writer 異步任務系統](./ASYNC_TASK_SOLUTION.md)
