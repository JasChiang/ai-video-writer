/**
 * Keyword Analysis Prompt Service
 * 提供 Gemini AI 關鍵字分析的 prompt
 */

/**
 * 生成關鍵字分析的 prompt
 * @param {Object} videoData - 影片資料
 * @param {string} videoData.title - 影片標題
 * @param {string} videoData.description - 影片說明
 * @param {Array<string>} videoData.tags - 影片標籤
 * @param {Object} videoData.analytics - 分析數據
 * @returns {string} 完整的 prompt
 */
export function generateKeywordAnalysisPrompt(videoData) {
  const { title, description, tags = [], analytics = {} } = videoData;
  const { searchPercentage = '0', youtubeSearch = 0, googleSearch = 0 } = analytics.trafficSources || {};

  return `你是一位專業的 YouTube SEO 顧問，擅長關鍵字優化與搜尋引擎優化策略。

請分析以下影片的關鍵字使用情況，並提供優化建議：

## 影片資訊

**標題**: ${title}

**說明**:
${description || '（無說明）'}

**現有標籤**: ${tags.length > 0 ? tags.join(', ') : '（無標籤）'}

## 流量數據

- **總搜尋流量佔比**: ${searchPercentage}%
- **YouTube 搜尋**: ${youtubeSearch} 次
- **Google 搜尋**: ${googleSearch} 次

## 任務要求

請提供以下分析結果，使用 **JSON 格式** 輸出：

\`\`\`json
{
  "currentKeywords": {
    "score": 0-100,
    "strengths": ["優點1", "優點2"],
    "weaknesses": ["缺點1", "缺點2"]
  },
  "recommendedKeywords": {
    "primary": ["核心關鍵字1", "核心關鍵字2", "核心關鍵字3"],
    "secondary": ["次要關鍵字1", "次要關鍵字2", "次要關鍵字3"],
    "longtail": ["長尾關鍵字1", "長尾關鍵字2", "長尾關鍵字3"]
  },
  "titleSuggestions": [
    "建議標題選項1",
    "建議標題選項2",
    "建議標題選項3"
  ],
  "descriptionTips": [
    "說明優化建議1",
    "說明優化建議2",
    "說明優化建議3"
  ],
  "actionPlan": {
    "priority": "high|medium|low",
    "estimatedImpact": "提升搜尋流量 X%",
    "steps": [
      "步驟1：更新標題，加入核心關鍵字",
      "步驟2：優化說明的前三行",
      "步驟3：新增 5-8 個相關標籤"
    ]
  }
}
\`\`\`

## 分析重點

1. **關鍵字評分 (0-100)**:
   - 考量關鍵字的相關性、競爭度、搜尋量
   - 評估關鍵字在標題、說明、標籤中的分佈

2. **優勢與弱點**:
   - 指出目前做得好的地方（如：關鍵字佈局、相關性）
   - 點出需要改進的地方（如：缺少核心關鍵字、標籤過少）

3. **建議關鍵字**:
   - **primary**: 3-5 個高搜尋量、高相關性的核心關鍵字
   - **secondary**: 3-5 個中等搜尋量的補充關鍵字
   - **longtail**: 3-5 個長尾關鍵字（問句形式、特定場景）

4. **標題建議**:
   - 提供 3 個優化後的標題選項
   - 每個標題需包含核心關鍵字，並保持吸引力

5. **說明優化提示**:
   - 針對影片說明的前三行、中段、結尾給出具體建議
   - 建議加入的關鍵字位置

6. **行動計畫**:
   - **priority**: 根據流量數據判斷優先級（搜尋流量低 = 高優先）
   - **estimatedImpact**: 預估優化後的流量提升幅度
   - **steps**: 3-5 個具體可執行的步驟

請確保輸出為**有效的 JSON 格式**，不要包含其他文字說明。`;
}
