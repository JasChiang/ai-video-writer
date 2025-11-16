/**
 * 測試 Chart.js 圖表數據解析
 *
 * 驗證 HTML 註釋格式的圖表數據能否正確解析
 */

console.log('='.repeat(80));
console.log('測試：Chart.js 圖表數據解析');
console.log('='.repeat(80));

// 模擬 AI 輸出的 Markdown 內容（包含 Chart.js 圖表）
const testMarkdown = `
## 流量來源分析

根據數據分析，以下是您頻道的流量來源分布：

<!-- CHART:PIE
{
  "title": "流量來源分布",
  "labels": ["推薦流量", "搜尋流量", "外部流量", "直接流量"],
  "values": [45, 30, 15, 10]
}
-->

### 洞察與建議

1. **推薦流量占比最高 (45%)**
   - YouTube 演算法推薦效果良好
   - 繼續優化縮圖和標題以提升點擊率

2. **搜尋流量次之 (30%)**
   - SEO 優化有效
   - 建議持續研究關鍵字策略

## 內容單元效能

以下是各內容單元的觀看數對比：

<!-- CHART:BAR
{
  "title": "內容單元觀看數對比",
  "labels": ["科技評測", "教學系列", "生活 Vlog", "產品開箱"],
  "values": [15000, 12000, 8000, 5000]
}
-->

### 分析結果

科技評測類內容效能最佳，建議增加此類內容的產出。
`;

console.log('\n📋 測試內容:');
console.log('- 包含 2 個圖表（1 個餅圖 + 1 個柱狀圖）');
console.log('- 使用 HTML 註釋格式');
console.log('- 內嵌 JSON 數據');

// 測試圖表解析正則表達式
const chartRegex = /<!--\s*CHART:(PIE|BAR)\s*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?-->/g;

console.log('\n' + '='.repeat(80));
console.log('開始解析...');
console.log('='.repeat(80));

let match;
let chartIndex = 0;
const charts = [];

while ((match = chartRegex.exec(testMarkdown)) !== null) {
  chartIndex++;
  const chartType = match[1];
  const jsonData = match[2].trim();

  console.log(`\n📊 圖表 ${chartIndex}:`);
  console.log(`- 類型: ${chartType}`);
  console.log(`- 原始 JSON:\n${jsonData}`);

  try {
    const data = JSON.parse(jsonData);
    console.log(`- ✅ JSON 解析成功`);
    console.log(`- 標題: ${data.title}`);
    console.log(`- 標籤數量: ${data.labels.length}`);
    console.log(`- 數值數量: ${data.values.length}`);
    console.log(`- 標籤: ${data.labels.join(', ')}`);
    console.log(`- 數值: ${data.values.join(', ')}`);

    // 驗證數據完整性
    if (data.labels.length !== data.values.length) {
      console.log(`- ⚠️ 警告：標籤數量 (${data.labels.length}) 與數值數量 (${data.values.length}) 不匹配`);
    } else {
      console.log(`- ✅ 數據完整性檢查通過`);
    }

    charts.push({
      type: chartType.toLowerCase(),
      ...data,
    });

  } catch (error) {
    console.log(`- ❌ JSON 解析失敗: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('解析結果總結');
console.log('='.repeat(80));

console.log(`\n✅ 成功解析圖表數量: ${charts.length}`);
console.log(`預期數量: 2`);

if (charts.length === 2) {
  console.log('\n🎉 測試通過！');
  console.log('\n解析的圖表:');
  charts.forEach((chart, i) => {
    console.log(`\n${i + 1}. ${chart.title} (${chart.type.toUpperCase()})`);
    console.log(`   - 數據點數: ${chart.values.length}`);
    console.log(`   - 總計: ${chart.values.reduce((a, b) => a + b, 0)}`);
  });

  console.log('\n✅ Chart.js 圖表解析功能驗證完成！');
  console.log('\n下一步測試:');
  console.log('1. 啟動開發伺服器：npm run dev');
  console.log('2. 執行頻道分析');
  console.log('3. 檢查 AI 分析報告中是否顯示圖表');
  console.log('4. 驗證圖表外觀和互動性');

} else {
  console.log('\n❌ 測試失敗');
  console.log(`預期解析 2 個圖表，實際解析 ${charts.length} 個`);
}

console.log('\n' + '='.repeat(80));
console.log('測試完成');
console.log('='.repeat(80));
