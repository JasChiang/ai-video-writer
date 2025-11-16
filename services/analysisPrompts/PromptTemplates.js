/**
 * 新版 Prompt Templates - 基於實際資料結構重新設計
 * 完全基於頻道儀表板和關鍵字報表的實際可用資料
 */

export class PromptTemplates {
  /**
   * 統一入口：根據分析類型生成對應的 Prompt（兼容舊版調用）
   */
  static generatePrompt(data) {
    const { type, dateRange, channelStats, videos, analytics } = data;

    // 準備通用資料結構（兼容層）
    const commonData = {
      dateRange,
      channelStats: {
        totalSubscribers: channelStats?.totalSubscribers || channelStats?.subscriberCount || 0,
        totalViews: channelStats?.totalViews || 0,
        totalVideos: channelStats?.totalVideos || videos?.length || 0,
        viewsInRange: channelStats?.viewsInRange || videos?.reduce((sum, v) => sum + (v.viewCount || 0), 0) || 0,
        watchTimeHours: channelStats?.watchTimeHours || 0,
        subscribersGained: channelStats?.subscribersGained || analytics?.subscribersGained || 0,
        videosInRange: channelStats?.videosInRange || videos?.length || 0,
      },
      topVideos: videos || [],
      bottomVideos: analytics?.bottomVideos || [],
      trendData: analytics?.trendData || [],
      monthlyData: analytics?.monthlyData || [],
      trafficSources: analytics?.trafficSources || [],
      searchTerms: analytics?.searchTerms || [],
      demographics: analytics?.demographics || [],
      geography: analytics?.geography || [],
      devices: analytics?.devices || [],
    };

    // 根據分析類型調用對應方法
    switch (type) {
      case 'comprehensive':
      case 'subscriber-growth':
      case 'content-strategy':
        return this.buildChannelHealthPrompt(commonData);

      case 'view-optimization':
        return this.buildVideoOptimizationPrompt({
          topVideos: videos || [],
          bottomVideos: null,
          channelStats: commonData.channelStats,
        });

      case 'audience-insights':
        return this.buildAudienceInsightsPrompt(commonData);

      case 'traffic-growth':
        return this.buildTrafficGrowthPrompt(commonData);

      default:
        return this.buildChannelHealthPrompt(commonData);
    }
  }

  /**
   * 頻道健康診斷（基於頻道儀表板資料）
   */
  static buildChannelHealthPrompt(data) {
    const {
      channelStats,      // { totalSubscribers, totalViews, totalVideos, viewsInRange, watchTimeHours, subscribersGained, videosInRange }
      topVideos,         // 熱門影片列表
      bottomVideos,      // 低效影片列表
      trendData,         // 趨勢資料
      monthlyData,       // 月度資料
      trafficSources,    // 流量來源
      searchTerms,       // 搜尋詞
      demographics,      // 人口統計
      geography,         // 地理分布
      devices,           // 設備類型
      dateRange,         // { startDate, endDate }
    } = data;

    // 計算內容效率
    const contentEfficiency = (channelStats.totalSubscribers / channelStats.totalVideos).toFixed(1);

    // 計算平均觀看時長（分鐘/觀看）
    const avgWatchMinutes = channelStats.viewsInRange > 0
      ? ((channelStats.watchTimeHours * 60) / channelStats.viewsInRange).toFixed(1)
      : 0;

    return `**你是 YouTube 頻道的首席策略顧問 (Chief Strategy Advisor)**

**你的任務：** 基於頻道的實際營運資料，提供全面的健康診斷和改善策略。

**核心分析框架：內容效率 × 觀眾黏性 × 流量健康度**

## 可用資料摘要

**頻道基本指標：**
- 總訂閱者：${channelStats.totalSubscribers.toLocaleString()} 人
- 總觀看數：${channelStats.totalViews.toLocaleString()} 次
- 總影片數：${channelStats.totalVideos} 支
- 內容效率：${contentEfficiency} 訂閱/影片 ${contentEfficiency < 20 ? '(警告：低於健康線)' : contentEfficiency < 50 ? '(需改進)' : contentEfficiency < 100 ? '(良好)' : '(優秀)'}

**分析期間 (${dateRange.startDate} ~ ${dateRange.endDate})：**
- 觀看數：${channelStats.viewsInRange.toLocaleString()} 次
- 觀看時長：${channelStats.watchTimeHours.toLocaleString()} 小時
- 平均觀看時長：${avgWatchMinutes} 分鐘/次
- 新增訂閱：${channelStats.subscribersGained} 人
- 發布影片：${channelStats.videosInRange} 支

**時段內熱門影片 Top ${Math.min(topVideos.length, 50)}：**
（重要說明：以下為「${dateRange.startDate} ~ ${dateRange.endDate}」期間內**表現最佳**的 ${Math.min(topVideos.length, 50)} 支影片，**並非期間內上傳的影片**。這些影片可能在此期間之前就已發布，只是在此期間表現特別好。此期間**實際上傳的影片數**為 ${channelStats.videosInRange} 支，頻道總共有 ${channelStats.totalVideos} 支影片）

${topVideos.length > 0 ? topVideos.slice(0, 50).map((v, i) => `${i + 1}. ${v.title || '未命名'}
   - 發布日期：${v.publishedAt ? new Date(v.publishedAt).toLocaleDateString('zh-TW') : '未知'}
   - 觀看：${(v.viewCount || 0).toLocaleString()} | 讚：${(v.likeCount || 0).toLocaleString()} | 留言：${(v.commentCount || 0).toLocaleString()}
   - 互動率：${v.viewCount > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount * 100).toFixed(2) : '0.00'}%`).join('\n\n') : '（暫無影片資料）'}

${bottomVideos && bottomVideos.length > 0 ? `**時段內低效影片 Bottom ${bottomVideos.length}：**
（以下為此時段內表現最差的 ${bottomVideos.length} 支影片，用於對比分析。同樣地，這些影片不一定是期間內上傳）

${bottomVideos.map((v, i) => `${i + 1}. ${v.title || '未命名'}
   - 發布日期：${v.publishedAt ? new Date(v.publishedAt).toLocaleDateString('zh-TW') : '未知'}
   - 觀看：${(v.viewCount || 0).toLocaleString()} | 讚：${(v.likeCount || 0).toLocaleString()} | 留言：${(v.commentCount || 0).toLocaleString()}
   - 互動率：${v.viewCount > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount * 100).toFixed(2) : '0.00'}%`).join('\n\n')}` : ''}

**流量來源分布：**
${trafficSources.length > 0 ? trafficSources.map(s => `- ${s.source || '未知'}: ${(s.views || 0).toLocaleString()} 次 (${(s.percentage || 0).toFixed(1)}%)`).join('\n') : '（暫無流量來源資料）'}

**搜尋關鍵詞 Top 10：**
${searchTerms.length > 0 ? searchTerms.slice(0, 10).map((t, i) => `${i + 1}. "${t.term || '未知'}" - ${(t.views || 0).toLocaleString()} 次觀看`).join('\n') : '（暫無搜尋詞資料）'}

**觀眾人口統計：**
${demographics.length > 0 ? demographics.map(d => `- ${d.ageGroup || '未知'} ${d.gender || ''}: ${(d.viewsPercentage || 0).toFixed(1)}%`).join('\n') : '（暫無人口統計資料）'}

**地理分布 Top 5：**
${geography.length > 0 ? geography.slice(0, 5).map((g, i) => `${i + 1}. ${g.country || '未知'}: ${(g.views || 0).toLocaleString()} 次 (${(g.percentage || 0).toFixed(1)}%)`).join('\n') : '（暫無地理分布資料）'}

**設備類型：**
${devices.length > 0 ? devices.map(d => `- ${d.deviceType || '未知'}: ${(d.views || 0).toLocaleString()} 次 (${(d.percentage || 0).toFixed(1)}%)`).join('\n') : '（暫無設備資料）'}

---

## 你的分析任務

### 1. 頻道健康度總體診斷

**評估以下指標並打分（0-100）：**
- 內容效率健康度（訂閱/影片比）
- 觀眾留存健康度（平均觀看時長）
- 流量結構健康度（流量來源分布）
- 增長勢能健康度（訂閱增長趨勢）

**輸出格式：**
| 健康指標 | 評分 | 狀態 | 診斷 |
|---------|------|------|------|
| 內容效率 | XX/100 | 優秀/良好/需改進/危險 | 簡述原因 |
| 觀眾留存 | XX/100 | ... | ... |
| 流量結構 | XX/100 | ... | ... |
| 增長勢能 | XX/100 | ... | ... |

### 2. 流量來源分析與優化建議

**分析要點：**
- 推薦流量（Suggested/Browse）占比是否健康（目標 >40%）？
- 搜尋流量占比如何？是否過度依賴？
- 外部流量占比是否過高（警戒線 >50%）？
- 最有價值的搜尋關鍵詞是什麼？

**提供：**
- 流量結構診斷
- 3 個具體優化策略（優先級排序）

### 3. 高效 vs 低效影片對比分析

${bottomVideos && bottomVideos.length > 0 ? `**對比分析要點：**
- 比較 Top 10 與 Bottom 10 影片的差異
- 標題模式差異（數字、問句、關鍵字使用）
- 主題類型差異（哪些主題表現好/差）
- 互動率差異（為何有些影片互動低）
- **發布日期分析（重要）：**
  - 區分「期間內上傳的新片」vs「期間前上傳的舊片」
  - 新片 vs 舊片的表現差異（舊片是否有長尾效應？）
  - 是否有舊片突然爆紅？原因可能是什麼？
  - Top 50 中有多少是新片、多少是舊片？

**輸出：**
1. 表格對比高效與低效影片的關鍵差異（包含發布日期欄位）
2. 找出 3-5 個明確的成功因素
3. 識別 3-5 個應避免的失敗模式
4. 新片 vs 舊片表現分析` : `**分析 Top 影片的共同特徵：**
- 標題模式（是否使用數字、問句、實用型關鍵字）
- 主題類型（評測、教學、娛樂等）
- 互動率高低（找出互動磁鐵影片）
- **發布日期分析：**
  - 區分「期間內上傳的新片」vs「期間前上傳的舊片」
  - 新片 vs 舊片的表現差異
  - 是否有舊片長尾效應？

**輸出：**
表格展示 Top 3 影片的詳細分析 + 成功因素提煉（包含發布日期）`}

### 4. 觀眾洞察與內容定位

**基於人口統計、地理、設備資料，回答：**
- 核心觀眾畫像是什麼？（年齡、性別、地理位置）
- 觀看設備分布反映什麼資訊？
- 內容定位是否匹配觀眾特徵？
- 有哪些未被滿足的觀眾需求？

### 5. 關鍵改善策略（優先級排序）

**立即執行（本月內）：**
1. [具體策略]
2. [具體策略]
3. [具體策略]

**短期優化（3 個月內）：**
1. [具體策略]
2. [具體策略]

**長期戰略（6-12 個月）：**
1. [具體戰略方向]
2. [具體戰略方向]

---

## 輸出要求

1. **使用 Markdown 表格**展示所有對比資料
2. **使用 Mermaid 圖表**：
   - 流量來源餅圖或條形圖
   - 健康度雷達圖（如可行）
3. **每個建議必須包含**：
   - 具體執行步驟
   - 預期成效（量化）
   - 執行難度（低/中/高）

4. **撰寫規範：**
   - 使用台灣繁體中文
   - 中英文、數字之間加半形空格
   - 避免空泛建議，必須具體可執行
   - 優先級明確（什麼先做、什麼後做）

5. **字數限制：**
   - **完整報告必須控制在 3000 個中文字以內**
   - 保持內容精煉，優先呈現最重要的洞察和建議

**開始分析。**`;
  }

  /**
   * 內容單元效能分析（基於關鍵字報表資料）
   */
  static buildContentUnitPrompt(data) {
    const { keywordGroups, dateColumns, analyticsData, selectedMetrics } = data;

    // 建立資料表格
    let dataTable = `\n**內容單元效能資料：**\n\n`;
    dataTable += `| 單元名稱 | ${dateColumns.map(col => col.label).join(' | ')} |\n`;
    dataTable += `|${'-'.repeat(15)}|${dateColumns.map(() => '-'.repeat(20)).join('|')}|\n`;

    keywordGroups.forEach((group) => {
      const row = [group.name];
      dateColumns.forEach((col) => {
        const cellData = analyticsData[group.id]?.[col.id];
        if (cellData && !cellData.error) {
          const metrics = selectedMetrics.map(metric => {
            const value = cellData[metric];
            if (value !== undefined && value !== null) {
              return `${metric}: ${value.toLocaleString()}`;
            }
            return null;
          }).filter(Boolean).join(', ');
          row.push(metrics || '無資料');
        } else {
          row.push(cellData?.error || '無資料');
        }
      });
      dataTable += `| ${row.join(' | ')} |\n`;
    });

    // 計算總體統計
    let totalStats = {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalVideos: 0,
      unitCount: keywordGroups.length,
      dateRangeCount: dateColumns.length,
    };

    keywordGroups.forEach(group => {
      dateColumns.forEach(col => {
        const cellData = analyticsData[group.id]?.[col.id];
        if (cellData && !cellData.error) {
          totalStats.totalViews += cellData.views || 0;
          totalStats.totalLikes += cellData.likes || 0;
          totalStats.totalComments += cellData.comments || 0;
          totalStats.totalVideos += cellData.videoCount || 0;
        }
      });
    });

    return `**你是 YouTube 內容策略分析師 (Content Strategy Analyst)**

**你的任務：** 分析不同內容單元的效能表現，識別明星單元與低效單元，提供資源配置建議。

## 可用資料摘要

**分析維度：**
- 內容單元數量：${totalStats.unitCount} 個
- 時間維度數量：${totalStats.dateRangeCount} 個
- 總觀看數：${totalStats.totalViews.toLocaleString()} 次
- 總互動數：${(totalStats.totalLikes + totalStats.totalComments).toLocaleString()} 次
- 總影片數：${totalStats.totalVideos} 支
- 平均互動率：${totalStats.totalViews > 0 ? ((totalStats.totalLikes + totalStats.totalComments) / totalStats.totalViews * 100).toFixed(2) : 0}%

${dataTable}

**選中的分析指標：**
${selectedMetrics.map(m => `- ${m}`).join('\n')}

---

## 你的分析任務

### 1. 內容單元效能對比

**創建對比表格，包含：**
- 單元名稱
- 平均觀看數
- 平均互動率
- 影片數量
- 效能評級（A/B/C/D）
- 單元定位（明星/潛力/流量/低效）

### 2. 四象限分類

**將所有單元分類到四象限：**

使用 Mermaid quadrantChart 或 ASCII 圖表展示：

高互動 ↑
     |  潛力單元     |  明星單元     |
     |  (低觀看高互動) |  (高觀看高互動) |
─────┼──────────────┼──────────────┤→ 高觀看
     |  低效單元     |  流量單元     |
     |  (低觀看低互動) |  (高觀看低互動) |
低互動 ↓

**說明每個象限的含義和策略：**
- 明星單元：核心資產，加倍投入
- 潛力單元：SEO 優化，提升曝光
- 流量單元：改善內容品質
- 低效單元：停止或重新包裝

### 3. 時間序列趨勢分析

**對比不同時間維度的資料，識別：**
- 增長中的單元（新時期 > 舊時期）
- 衰退中的單元（新時期 < 舊時期）
- 穩定的單元（變化不大）

**使用 ASCII 圖表或表格展示趨勢**

### 4. 資源配置建議

**基於分析結果，提供：**

**加倍投入（明星單元）：**
- 具體單元名稱
- 建議動作（發展系列化、增加頻率等）
- 預期成效

**SEO 優化（潛力單元）：**
- 具體單元名稱
- 優化建議（標題、標籤、關鍵字）
- 預期成效

**停止或轉型（低效單元）：**
- 具體單元名稱
- 建議動作（停止、重新包裝、合併）
- 資源轉移計劃

### 5. 關鍵行動計劃

**立即執行（本週內）：**
1. [具體動作]
2. [具體動作]
3. [具體動作]

**短期優化（1 個月內）：**
1. [具體動作]
2. [具體動作]

**中期布局（3 個月內）：**
1. [具體目標 + 預期成效]
2. [具體目標 + 預期成效]

---

## 輸出要求

1. **必須使用 Markdown 表格**展示單元對比資料
2. **必須使用視覺化圖表**展示四象限分類
3. **每個建議必須包含**：
   - 具體單元名稱
   - 具體執行步驟
   - 量化的預期成效
4. **優先級明確**（用編號 1, 2, 3 排序）

5. **字數限制：**
   - **完整報告必須控制在 3000 個中文字以內**
   - 保持內容精煉，優先呈現最重要的洞察和建議

**開始分析。**`;
  }

  /**
   * 流量增長分析（基於流量來源和搜尋詞資料）
   */
  static buildTrafficGrowthPrompt(data) {
    const { trafficSources, searchTerms, topVideos, channelStats, dateRange } = data;

    return `**你是 YouTube 流量增長專家 (Traffic Growth Expert)**

**你的任務：** 分析流量來源結構，識別增長機會，提供流量優化策略。

## 可用資料

**流量來源分布：**
${trafficSources.map(s => `- ${s.source}: ${s.views.toLocaleString()} 次 (${s.percentage.toFixed(1)}%)`).join('\n')}

**熱門搜尋關鍵詞：**
${searchTerms.slice(0, 20).map((t, i) => `${i + 1}. "${t.term}" - ${t.views.toLocaleString()} 次`).join('\n')}

**頻道基本資訊：**
- 分析期間：${dateRange.startDate} ~ ${dateRange.endDate}
- 總觀看數：${channelStats.viewsInRange.toLocaleString()} 次
- 新增訂閱：${channelStats.subscribersGained} 人

---

## 你的分析任務

### 1. 流量結構健康度診斷

**評估指標：**
- 推薦流量占比（健康標準：>40%）
- 搜尋流量占比（健康標準：30-40%）
- 外部流量占比（警戒線：<30%）
- 頻道頁流量占比

**提供：**
- 健康度評分（0-100）
- 診斷結論
- 主要問題

### 2. 搜尋 SEO 機會分析

**分析熱門搜尋詞：**
- 識別高價值關鍵詞（觀看數高）
- 找出長尾關鍵詞機會
- 分析關鍵詞主題分布
- 發現內容缺口

**提供：**
- Top 10 最有價值關鍵詞
- 5 個長尾關鍵詞機會
- 3 個建議的新內容主題

### 3. 流量增長策略

**基於流量結構，提供：**

**如果推薦流量不足：**
- 如何提升觀看時長
- 如何優化縮圖和標題
- 如何建立系列化內容

**如果搜尋流量不足：**
- SEO 優化策略
- 關鍵字研究建議
- 標題和描述優化

**如果過度依賴外部流量：**
- 如何轉化為內部流量
- 如何提升頻道黏性
- 如何優化首頁和播放清單

### 4. 關鍵行動計劃

**立即執行：**
1. [具體策略]
2. [具體策略]

**短期目標（1-3 個月）：**
1. [目標 + 量化指標]
2. [目標 + 量化指標]

---

## 輸出要求

1. 使用 Mermaid 餅圖或條形圖展示流量分布
2. 使用表格展示關鍵詞分析
3. 每個策略必須包含執行步驟和預期成效

4. **字數限制：**
   - **完整報告必須控制在 3000 個中文字以內**
   - 保持內容精煉，優先呈現最重要的洞察和建議

**開始分析。**`;
  }

  /**
   * 觀眾洞察分析（基於人口統計、地理、設備資料）
   */
  static buildAudienceInsightsPrompt(data) {
    const { demographics, geography, devices, channelStats, topVideos } = data;

    return `**你是 YouTube 觀眾洞察專家 (Audience Insights Expert)**

**你的任務：** 深入分析觀眾特徵，提供精準內容定位建議。

## 可用資料

**人口統計：**
${demographics.map(d => `- ${d.ageGroup} ${d.gender}: ${d.viewsPercentage.toFixed(1)}%`).join('\n')}

**地理分布：**
${geography.map((g, i) => `${i + 1}. ${g.country}: ${g.views.toLocaleString()} 次 (${g.percentage.toFixed(1)}%)`).join('\n')}

**設備類型：**
${devices.map(d => `- ${d.deviceType}: ${d.views.toLocaleString()} 次 (${d.percentage.toFixed(1)}%)`).join('\n')}

---

## 你的分析任務

### 1. 核心觀眾畫像

**基於資料，描繪：**
- 主要年齡層
- 性別分布
- 地理位置
- 觀看設備偏好

**輸出：**
核心觀眾畫像描述 + 次要觀眾群體

### 2. 內容定位建議

**基於觀眾特徵，回答：**
- 當前內容是否匹配觀眾？
- 應該製作什麼類型的內容？
- 內容深度應該如何調整？
- 發布時間應該如何優化？

### 3. 設備優化建議

**基於設備分布，提供：**
- 縮圖設計建議
- 影片長度建議
- 內容呈現方式建議

### 4. 地理擴展機會

**分析地理資料，回答：**
- 是否有潛力市場未開發？
- 是否需要多語言字幕？
- 內容主題是否需要本地化？

---

## 輸出要求

1. 使用表格展示觀眾分布資料
2. 使用 Mermaid 圖表展示觀眾畫像
3. 提供 3-5 個具體的內容定位建議

4. **字數限制：**
   - **完整報告必須控制在 3000 個中文字以內**
   - 保持內容精煉，優先呈現最重要的洞察和建議

**開始分析。**`;
  }

  /**
   * 影片效能優化（基於熱門影片資料）
   */
  static buildVideoOptimizationPrompt(data) {
    const { topVideos, bottomVideos, channelStats } = data;

    return `**你是 YouTube 影片優化專家 (Video Optimization Expert)**

**你的任務：** 分析高效與低效影片，提供影片優化策略。

## 可用資料

**高效影片 Top 10：**
${topVideos.slice(0, 10).map((v, i) => `${i + 1}. ${v.title}
   - 觀看：${v.viewCount.toLocaleString()} | 讚：${v.likeCount.toLocaleString()} | 留言：${v.commentCount.toLocaleString()}
   - 互動率：${((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(2)}%
   - 發布日期：${v.publishedAt}`).join('\n\n')}

${bottomVideos ? `**低效影片 Bottom 10：**
${bottomVideos.slice(0, 10).map((v, i) => `${i + 1}. ${v.title}
   - 觀看：${v.viewCount.toLocaleString()} | 讚：${v.likeCount.toLocaleString()} | 留言：${v.commentCount.toLocaleString()}
   - 互動率：${((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(2)}%`).join('\n\n')}` : ''}

---

## 你的分析任務

### 1. 高效影片成功因素

**分析 Top 10 影片的共同特徵：**
- 標題模式（數字、問句、實用型）
- 主題類型
- 發布時間模式
- 互動率高低

**輸出：**
成功因素提煉 + 可複製的模式

### 2. 低效影片診斷

**分析 Bottom 10 影片的問題：**
- 標題是否吸引人？
- 主題是否符合觀眾期待？
- 發布時間是否合適？
- SEO 是否優化？

**輸出：**
問題診斷 + 改善建議

### 3. 優化策略

**提供具體優化建議：**
- 標題優化模板（3 個範例）
- 縮圖優化建議
- 標籤和關鍵字策略
- 發布時間優化

---

## 輸出要求

1. 使用表格對比高效與低效影片
2. 提供可直接使用的標題模板
3. 每個建議必須具體可執行

4. **字數限制：**
   - **完整報告必須控制在 3000 個中文字以內**
   - 保持內容精煉，優先呈現最重要的洞察和建議

**開始分析。**`;
  }
}
