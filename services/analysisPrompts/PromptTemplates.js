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
      channelStats,
      topVideos = [],
      bottomVideos = [],
      trafficSources = [],
      searchTerms = [],
      demographics = [],
      geography = [],
      devices = [],
      dateRange,
    } = data;

    const contentEfficiency = channelStats.totalVideos > 0
      ? (channelStats.totalSubscribers / channelStats.totalVideos).toFixed(1)
      : '0.0';
    const avgWatchMinutes = channelStats.viewsInRange > 0
      ? ((channelStats.watchTimeHours * 60) / channelStats.viewsInRange).toFixed(1)
      : '0.0';

    const topVideoSummary = topVideos.map((video, index) => {
      const published = video.publishedAt ? video.publishedAt.split('T')[0] : '未知日期';
      return `${index + 1}. ${video.title || '未命名'}（${published}） - 觀看 ${Number(video.viewCount || 0).toLocaleString()}、讚 ${Number(video.likeCount || 0).toLocaleString()}、留言 ${Number(video.commentCount || 0).toLocaleString()}`;
    }).join('\n') || '（目前沒有熱門樣本）';

    const bottomVideoSummary = bottomVideos.slice(0, 10).map((video, index) => {
      const published = video.publishedAt ? video.publishedAt.split('T')[0] : '未知日期';
      return `${index + 1}. ${video.title || '未命名'}（${published}） - 觀看 ${Number(video.viewCount || 0).toLocaleString()}、讚 ${Number(video.likeCount || 0).toLocaleString()}、留言 ${Number(video.commentCount || 0).toLocaleString()}`;
    }).join('\n') || '（未提供低效影片資料）';

    const trafficSummary = trafficSources.length > 0
      ? trafficSources.map(source => `- ${source.source || '未知'}：${(source.views || 0).toLocaleString()} 次 (${(source.percentage || 0).toFixed(1)}%)`).join('\n')
      : '（未提供流量來源資料）';

    const searchSummary = searchTerms.slice(0, 15).map((term, index) => `${index + 1}. "${term.term || '未知'}" - ${(term.views || 0).toLocaleString()} 次`).join('\n') || '（未提供搜尋需求資料）';

    const geographySummary = geography.slice(0, 10).map(item => `- ${item.country || '未知'}：${(item.views || 0).toLocaleString()} 次 (${(item.percentage || 0).toFixed(1)}%)`).join('\n') || '（未提供地理分佈資料）';

    const deviceSummary = devices.length > 0
      ? devices.map(device => `- ${device.deviceType || '未知'}：${(device.views || 0).toLocaleString()} 次 (${(device.percentage || 0).toFixed(1)}%)`).join('\n')
      : '（未提供設備資料）';

    return `## 角色設定
你是一名 **YouTube 綜合診斷顧問**。你的任務是以使用者指定的期間資料為主，針對頻道「優勢、弱點、風險、機會」進行單一份綜合分析。只能引用頻道儀表板提供的數據與樣本影片，並且必須審視影片發布日期，以區分期間內新片與舊片長尾的貢獻。

## 可用資料
- 總訂閱者：${channelStats.totalSubscribers.toLocaleString()} 人（此為 ${dateRange.endDate} 期末的訂閱總數）
- 總觀看數：${channelStats.totalViews.toLocaleString()} 次
- 總影片數：${channelStats.totalVideos} 支
- 內容效率（訂閱 / 影片）：${contentEfficiency}
- 期間：${dateRange.startDate} ~ ${dateRange.endDate}
- 期間觀看數：${channelStats.viewsInRange.toLocaleString()} 次
- 期間觀看時數：${channelStats.watchTimeHours.toLocaleString()} 小時
- 平均觀看時長：${avgWatchMinutes} 分鐘 / 次
- 期間新增訂閱：${channelStats.subscribersGained} 人
- 期間實際上架影片：${channelStats.videosInRange} 支

**熱門影片樣本（依觀看排序）**
${topVideoSummary}

**低速影片樣本**
${bottomVideoSummary}

**流量來源概況**
${trafficSummary}

**搜尋字詞重點**
${searchSummary}

**觀眾地理 / 裝置**
${geographySummary}

${deviceSummary}

若系統有提供 trendData、monthlyData、demographics、devices 等欄位，可在分析中引用，但不得引入外部資料。
⚠️ 注意：以上 Top ${topVideos.length} 支影片僅代表「此期間表現最佳的樣本」，不等於期間內上傳的影片數量；請在分析時明確區分「期間內新片（${channelStats.videosInRange} 支）」與「舊片長尾」。報告中禁止把 Top 樣本數寫成上傳數，且必須明確說明新片與舊片在觀看與訂閱上的貢獻。

## 輸出格式
生成一份「單一綜合分析報告」，以 Markdown H2/H3 結構撰寫，內容必須控制在 3000 個中文字以內（約 6000 byte），使用台灣繁體中文並確保中英文與數字之間加半形空格。建議章節如下：

1. **期間表現快照**
   - 概述期間內的主要指標（觀看、觀看時長、訂閱變化、內容效率），明確指出表現好壞並引用具體數據。

2. **內容與觀眾雙向診斷**
   - 從熱門 / 低速影片樣本、流量來源、搜尋字詞、地理與裝置等面向，說明哪些題材、受眾或觸達方式表現優秀，哪些存在問題。
   - 必須拆解「期間上傳新片」與「舊片長尾」的貢獻：請引用 ${channelStats.videosInRange} 支新片的表現、Top 樣本中的舊片比例、舊片帶來的觀看 / 訂閱，避免將樣本數當成上傳數。

3. **優勢 / 弱點 / 風險 / 機會**
   - 條列至少各 2 點，並以資料佐證。例如：哪類影片帶來最多觀看、哪個觀眾族群未被滿足、哪個流量來源正在下滑等。

4. **行動建議與量化目標**
   - 依優先順序列出 3~5 項具體措施，每項包含：針對的指標或族群、建議動作、預期量化成效或觀察指標、時間範圍。
   - 若需要使用圖表，僅允許 HTML 註解格式的 Chart.js 柱狀圖（\`<!-- CHART:BAR {...} -->\`），不得使用其他格式或 Mermaid。
   - \`labels\` 與 \`values\` 必須為等長陣列，且 \`values\` 只能包含數字，禁止使用 \`data\`、\`items\` 等其他欄位。
   - 若需呈現比較或列表資訊，請使用標準 Markdown 表格。

### 其他規則
- 引述數據時必須標示來源（例如：Top 影片樣本、trafficSources、monthlyData）。
- 僅能分析提供的資料，不得猜測未提供的資訊。
- 報告需兼顧優缺點、風險與機會，避免只有好話或壞話。
- 再次提醒：提到 Top 樣本時需註明它們只是樣本，所有「期間上傳」的描述一律使用 ${channelStats.videosInRange} 的數值。

請依上述要求輸出綜合分析。`;
  }

  /**
   * 內容單元效能分析（基於關鍵字報表資料）
   */
  static buildContentUnitPrompt(data) {
    const { keywordGroups, dateColumns, analyticsData, selectedMetrics } = data;

    let dataTable = `
**內容單元效能矩陣：**

`;
    dataTable += `| 單元名稱 | ${dateColumns.map(col => col.label).join(' | ')} |
`;
    dataTable += `|${'-'.repeat(15)}|${dateColumns.map(() => '-'.repeat(20)).join('|')}|
`;

    keywordGroups.forEach(group => {
      const row = [group.name];
      dateColumns.forEach(col => {
        const cell = analyticsData[group.id]?.[col.id];
        if (cell && !cell.error) {
          const metrics = selectedMetrics.map(metric => {
            const value = cell[metric];
            return value !== undefined && value !== null ? `${metric}: ${value.toLocaleString()}` : null;
          }).filter(Boolean).join(', ');
          row.push(metrics || '無資料');
        } else {
          row.push(cell?.error || '無資料');
        }
      });
      dataTable += `| ${row.join(' | ')} |
`;
    });

    const totalStats = {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalVideos: 0,
      unitCount: keywordGroups.length,
      dateRangeCount: dateColumns.length,
    };

    keywordGroups.forEach(group => {
      dateColumns.forEach(col => {
        const cell = analyticsData[group.id]?.[col.id];
        if (cell && !cell.error) {
          totalStats.totalViews += cell.views || 0;
          totalStats.totalLikes += cell.likes || 0;
          totalStats.totalComments += cell.comments || 0;
          totalStats.totalVideos += cell.videoCount || 0;
        }
      });
    });

    return `## 角色設定
你是 **YouTube Content Operating Partner**，需把關鍵字報表轉譯成「內容單元 Scorecard + 資源配置」。產出內容會直接顯示在報表 AI 區域，請保持專業、精煉。

## Data Snapshot
- 內容單元數：${totalStats.unitCount} 個
- 觀察時段數：${totalStats.dateRangeCount} 組
- 總觀看數：${totalStats.totalViews.toLocaleString()} 次
- 總互動（讚+留言）：${(totalStats.totalLikes + totalStats.totalComments).toLocaleString()} 次
- 涉及影片：${totalStats.totalVideos} 支
- 平均互動率：${totalStats.totalViews > 0 ? ((totalStats.totalLikes + totalStats.totalComments) / totalStats.totalViews * 100).toFixed(2) : '0.00'}%

${dataTable}

**本次要追蹤的指標**
${selectedMetrics.map(metric => `- ${metric}`).join('\n')}

## 任務拆解（章節標題必須與下列名稱一致）

1. **Unit Scorecard**
   - 建立 Markdown 表格，欄位至少包含：單元、近期期觀看均值、近期期互動率、影片數、主 KPI、評級（S/A/B/C）。
   - 在表格中直接標註定位（明星 / 潛力 / 流量 / 低效）。

2. **Momentum Radar**
   - 針對不同日期列，比較每個單元是「上升 / 下滑 / 持平」，可使用 ▲ ▼ ＝，或用 \`<!-- CHART:BAR ... -->\` 簡化視覺化。
   - 說明造成變化的假設（題材熱度、競品、發片頻率等）。

3. **Quadrant Brief**
   - 以文字或表格呈現「高觀看×高互動」四象限，列出落在各象限的單元與策略建議。
   - 不使用 Mermaid，若要圖表請用 Markdown 表格或 HTML 註解格式。

4. **Resource Plan**
   - 分為「加碼投資 / SEO 優化 / 減少投入」三大類，每類至少列 2 個單元，格式：單元 | 主要動作 | 預期成效。

5. **Action Sprint**
   - 列出未來 2 週的 3~5 個行動，包含負責單元、指標與檢查點。

## 呈現規則
- 章節用 H2/H3（例如 ## 1. Unit Scorecard）。
- 數字加單位與千分位，並標示對應時間段。
- 若需圖表，僅允許 HTML 註解語法：
  \`<!-- CHART:BAR {"title":"單元觀看趨勢","labels":["上月","本月"],"values":[3200,5100]} -->\`
- 禁用 Mermaid、flowchart 等語法。
- 報告長度控制在 1800~2600 個中文字，重點在策略與行動。

立即根據資料輸出報告。`;
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

1. **使用 Markdown 表格**展示所有資料
2. **圖表使用規則（可選）**：
   - ✅ **僅允許 Chart.js 柱狀圖**展示數據，禁止使用餅圖或其他格式。
   - ⚠️ **必須完全按照以下語法輸出**（`labels`、`values` 為等長陣列，`values` 只能是數字）：

   ${'<'}!-- CHART:BAR
   {
     "title": "流量來源分布",
     "labels": ["推薦流量", "搜尋流量", "外部流量", "直接流量"],
     "values": [45, 30, 15, 10]
   }
   --${'>'}

   - ❌ 不可輸出 `data`、`items` 等其他欄位，也不可使用 Mermaid。
   - 📋 **優先使用表格**：如果不確定語法，請改用 Markdown 表格。
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

1. **圖表使用規則（可選）**：
   - ✅ **僅允許 Chart.js 柱狀圖**展示觀眾分布或比較，禁止餅圖或其他格式。
   - ⚠️ **必須使用以下語法**（`labels` 與 `values` 為等長陣列，`values` 僅能是數字）：

   ${'<'}!-- CHART:BAR
   {
     "title": "觀眾年齡分布",
     "labels": ["25-34歲", "18-24歲", "35-44歲", "45-54歲", "其他"],
     "values": [40, 30, 20, 8, 2]
   }
   --${'>'}

   - ❌ 不可輸出 `data`、`items` 等其他欄位，也不可使用 Mermaid。
   - 📋 **優先使用表格**：如果不確定語法，請用表格

2. 提供 3-5 個具體的內容定位建議

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
