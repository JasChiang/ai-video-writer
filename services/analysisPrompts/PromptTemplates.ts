/**
 * Prompt Templates - 為不同分析類型生成專業的 AI 分析提示詞
 * 已根據 YouTube API 限制調整（無 CTR、回訪率等數據）
 */

export type AnalysisType =
  | 'subscriber-growth' // 訂閱成長分析
  | 'view-optimization' // 觀看優化分析
  | 'content-strategy' // 內容策略分析
  | 'audience-insights' // 觀眾洞察分析
  | 'comprehensive'; // 綜合分析

export interface AnalysisPromptData {
  type: AnalysisType;
  dateRange: { startDate: string; endDate: string };
  channelStats: {
    subscriberCount: number;
    totalViews: number;
    totalVideos: number;
  };
  videos: Array<{
    title: string;
    publishedAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    tags?: string[];
  }>;
  analytics?: {
    subscribersGained?: number;
    subscribersLost?: number;
    avgViewDuration?: number;
    avgViewPercentage?: number;
    trafficSources?: any[];
    demographics?: any[];
    geography?: any[];
    devices?: any[];
  };
}

export class PromptTemplates {
  /**
   * 生成分析提示詞（主入口）
   */
  static generatePrompt(data: AnalysisPromptData): string {
    const baseContext = this.buildBaseContext(data);

    switch (data.type) {
      case 'subscriber-growth':
        return this.buildSubscriberGrowthPrompt(baseContext, data);

      case 'view-optimization':
        return this.buildViewOptimizationPrompt(baseContext, data);

      case 'content-strategy':
        return this.buildContentStrategyPrompt(baseContext, data);

      case 'audience-insights':
        return this.buildAudienceInsightsPrompt(baseContext, data);

      case 'comprehensive':
        return this.buildComprehensivePrompt(baseContext, data);

      default:
        throw new Error(`Unknown analysis type: ${data.type}`);
    }
  }

  /**
   * 建立基礎上下文（所有分析共用）
   */
  private static buildBaseContext(data: AnalysisPromptData): string {
    const { dateRange, channelStats, videos } = data;

    const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
    const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);
    const avgViews = videos.length > 0 ? totalViews / videos.length : 0;

    return `
**頻道數據概覽**
- 分析期間：${dateRange.startDate} ~ ${dateRange.endDate}
- 總訂閱者數：${channelStats.subscriberCount.toLocaleString()}
- 頻道總觀看次數：${channelStats.totalViews.toLocaleString()}
- 頻道總影片數：${channelStats.totalVideos}

**分析期間表現**
- 分析影片數：${videos.length}
- 總觀看次數：${totalViews.toLocaleString()}
- 總按讚數：${totalLikes.toLocaleString()}
- 平均每部影片觀看次數：${Math.round(avgViews).toLocaleString()}

**影片清單：**
${videos
  .map(
    (v, idx) => `${idx + 1}. **${v.title}** (${v.publishedAt.split('T')[0]})
   - 觀看：${v.viewCount.toLocaleString()} | 按讚：${v.likeCount.toLocaleString()} | 留言：${v.commentCount}
   - 標籤：${v.tags?.join(', ') || '無'}`
  )
  .join('\n\n')}
`;
  }

  /**
   * 訂閱成長分析提示詞
   */
  private static buildSubscriberGrowthPrompt(
    baseContext: string,
    data: AnalysisPromptData
  ): string {
    return `**分析角色：** YouTube 頻道訂閱成長專家

**核心目標：** 分析並提供具體建議，幫助頻道提升訂閱人數

${baseContext}

**訂閱數據：**
${data.analytics?.subscribersGained ? `- 期間新增訂閱者：${data.analytics.subscribersGained.toLocaleString()}` : ''}
${data.analytics?.subscribersLost ? `- 期間流失訂閱者：${data.analytics.subscribersLost.toLocaleString()}` : ''}
${
  data.analytics?.subscribersGained && data.analytics?.subscribersLost
    ? `- 淨增訂閱者：${(data.analytics.subscribersGained - data.analytics.subscribersLost).toLocaleString()}`
    : ''
}

**⚠️ 數據說明：**
- API 提供的 subscribersGained 數據在影片層級時，僅包含在該影片觀看頁面獲得的訂閱
- 頻道層級的數據則包含所有來源（影片頁面、頻道頁面、YouTube 首頁等）
- 以下分析基於可用數據進行推論

**分析任務：**

## 1. 訂閱轉化分析
- 計算訂閱轉化率：新增訂閱數 / 總觀看次數
- 識別訂閱轉化率高的影片（高互動 + 高訂閱轉化）
- 分析訂閱轉化與影片特徵的關聯（主題、長度、發布時間等）

## 2. 訂閱磁鐵影片識別
- 找出帶來最多訂閱的影片（基於觀看頁面數據）
- 分析這些影片的共同特徵：
  * 內容主題和類型
  * 標題和標籤特徵
  * 觀看表現（觀看時長、完成率）
  * 互動表現（按讚率、留言率）

## 3. 訂閱流失風險評估
- 分析訂閱流失數據
- 識別可能導致退訂的因素：
  * 內容主題偏移
  * 發片頻率變化
  * 內容品質波動

## 4. 訂閱成長策略建議
- 基於高轉化影片的特徵，提供內容製作建議
- 建議如何在影片中優化訂閱 CTA（行動呼籲）
- 提供系列化內容策略以提高訂閱轉化

**輸出格式：**

## 📈 訂閱轉化現況
（分析當前訂閱轉化率、淨增長趨勢）

## 🎯 高轉化影片特徵
（列出訂閱磁鐵影片的共同點和成功因素）

## ⚠️ 訂閱流失風險
（識別可能導致退訂的因素和內容風險）

## 🚀 訂閱成長行動方案
（5 個具體可執行的策略，包含內容、CTA、發片節奏等建議）

**格式要求：**
- 使用台灣繁體中文
- 提供具體數據支持
- 每個建議都有明確執行步驟
`;
  }

  /**
   * 觀看優化分析提示詞（已移除 CTR，改為流量來源和標題分析）
   */
  private static buildViewOptimizationPrompt(
    baseContext: string,
    data: AnalysisPromptData
  ): string {
    return `**分析角色：** YouTube 演算法優化專家

**核心目標：** 分析並提供具體建議，幫助頻道提升觀看次數

${baseContext}

**觀看表現數據：**
${data.analytics?.avgViewDuration ? `- 平均觀看時長：${Math.round(data.analytics.avgViewDuration)} 秒` : ''}
${data.analytics?.avgViewPercentage ? `- 平均觀看百分比：${data.analytics.avgViewPercentage.toFixed(1)}%` : ''}

**流量來源分佈：**
${
  data.analytics?.trafficSources
    ? data.analytics.trafficSources
        .map(
          (source: any) =>
            `- ${source.sourceType}: ${source.views.toLocaleString()} 次觀看 (${source.percentage.toFixed(1)}%)`
        )
        .join('\n')
    : '未提供流量來源數據'
}

**⚠️ 數據限制說明：**
- YouTube API 不提供縮圖曝光數和曝光點擊率（CTR）數據
- 以下分析基於觀看表現、流量來源、互動數據進行優化建議

**分析任務：**

## 1. 標題與內容吸引力分析
- 分析高觀看影片的標題特徵（長度、關鍵字、情感詞彙、數字使用）
- 識別哪些標題模式帶來更多觀看
- 提供標題優化建議（基於表現數據）

## 2. 觀看時長與完成率優化
- 分析平均觀看百分比和觀看時長
- 識別觀眾留存高的影片特徵
- 提供內容結構優化建議（開場、節奏、長度）

## 3. 流量來源優化
- 分析主要流量來源（YouTube 搜尋、推薦、外部、直接等）
- 識別哪些內容類型在不同流量來源表現更好
- 提供針對不同流量來源的優化策略：
  * 搜尋流量：SEO 優化（標題、描述、標籤）
  * 推薦流量：演算法適配（觀看時長、互動率）
  * 外部流量：社群媒體分享策略

## 4. 發布時間優化
- 基於影片發布時間和表現數據，分析最佳發布時段
- 考慮目標觀眾的活躍時間

## 5. 互動率與演算法推薦
- 分析按讚率、留言率、分享率與觀看次數的關聯
- 提供提升互動的策略以獲得更多演算法推薦

**輸出格式：**

## 📊 當前觀看表現分析
（觀看次數、觀看時長、流量來源分佈）

## 🎬 高觀看影片成功因素
（標題特徵、內容結構、流量來源優勢）

## 🔍 優化機會點
（可以改善的具體環節：標題、內容、SEO、互動）

## 🚀 觀看次數提升方案
（5-7 個具體策略：
  1. 標題優化模板和範例
  2. 內容結構改善建議
  3. SEO 優化要點
  4. 流量來源多元化策略
  5. 最佳發布時間建議
  6. 互動率提升技巧
  7. 演算法推薦適配要點
）

**格式要求：**
- 使用台灣繁體中文
- 提供可量化的目標（例如：觀看時長提升 20%）
- 每個建議都有具體實施步驟和範例
`;
  }

  /**
   * 內容策略分析提示詞
   */
  private static buildContentStrategyPrompt(
    baseContext: string,
    data: AnalysisPromptData
  ): string {
    return `**分析角色：** 內容策略顧問

**核心目標：** 分析內容主題分佈，提供長期內容策略建議

${baseContext}

**分析任務：**

## 1. 內容主題分析
- 根據標題和標籤，識別主要內容主題
- 計算各主題的影片數量和平均表現
- 識別最成功和最需要改進的主題

## 2. 內容缺口識別
- 分析頻道還缺少哪些相關主題
- 識別觀眾可能感興趣但尚未覆蓋的話題
- 提供新主題建議

## 3. 系列化內容機會
- 識別適合發展成系列的主題
- 提供系列化內容的規劃建議
- 估計系列內容的潛在影響

## 4. 競品內容分析
- 基於頻道定位，建議可參考的競品方向
- 識別差異化機會

**輸出格式：**

## 🎯 內容主題分佈分析
（各主題的數量和表現）

## 💡 內容缺口與機會
（還可以製作哪些內容）

## 📺 系列化內容規劃
（適合發展成系列的主題）

## 🚀 內容策略建議
（3-5 個長期內容發展方向）

**格式要求：**
- 使用台灣繁體中文
- 提供具體的主題建議，而非籠統的方向
- 每個建議都要有預期效果評估
`;
  }

  /**
   * 觀眾洞察分析提示詞（已移除回訪率和活躍度）
   */
  private static buildAudienceInsightsPrompt(
    baseContext: string,
    data: AnalysisPromptData
  ): string {
    return `**分析角色：** 觀眾洞察分析師

**核心目標：** 深入了解觀眾特徵和行為，提供精準的內容定位建議

${baseContext}

**觀眾特徵數據：**
${
  data.analytics?.demographics
    ? `\n**年齡與性別分佈：**\n${JSON.stringify(data.analytics.demographics, null, 2)}`
    : ''
}

${
  data.analytics?.geography
    ? `\n**地理分佈：**\n${JSON.stringify(data.analytics.geography, null, 2)}`
    : ''
}

${
  data.analytics?.devices
    ? `\n**設備使用分佈：**\n${JSON.stringify(data.analytics.devices, null, 2)}`
    : ''
}

${
  data.analytics?.trafficSources
    ? `\n**流量來源：**\n${JSON.stringify(data.analytics.trafficSources, null, 2)}`
    : ''
}

**⚠️ 數據限制說明：**
- YouTube API 不提供觀眾回訪率和訂閱者活躍度的直接指標
- 以下分析基於人口統計、設備、流量來源、互動數據進行洞察

**分析任務：**

## 1. 核心觀眾畫像
- 分析年齡、性別分佈，識別核心觀眾群體
- 分析地理分佈，識別主要市場和潛力市場
- 提供針對核心觀眾的內容定位建議

## 2. 觀眾行為模式
- 分析設備使用偏好（手機、電腦、平板、電視、遊戲機）
- 基於設備類型調整內容格式建議（Shorts vs 長影片）
- 分析流量來源，了解觀眾如何發現內容

## 3. 互動模式分析
- 分析留言、分享、按讚的模式
- 識別引發高互動的內容特徵
- 評估不同觀眾群體的互動偏好

## 4. 內容偏好洞察
- 基於不同觀眾群體的觀看表現，識別內容偏好
- 分析不同主題在不同觀眾群體中的表現差異
- 提供針對性的內容建議

## 5. 觀眾黏性提升策略
- 雖然無法直接獲取回訪率數據，但可以通過以下方式間接評估和提升：
  * 系列化內容策略（鼓勵觀眾持續關注）
  * 固定發片時間（建立觀看習慣）
  * 社群互動（在留言區建立連結）
  * 播放列表優化（增加連續觀看）

**輸出格式：**

## 👥 核心觀眾畫像
（描述主要觀眾群體：年齡、性別、地理位置、設備偏好）

## 📱 觀眾行為洞察
（觀眾如何發現和觀看內容、設備使用模式、流量來源分析）

## 💬 互動模式分析
（觀眾如何與內容互動、高互動內容特徵、互動偏好差異）

## 🎯 內容定位建議
（針對核心觀眾群體的內容主題、格式、風格建議）

## 🚀 觀眾黏性提升策略
（5 個具體建議：
  1. 系列化內容規劃
  2. 固定發片節奏
  3. 社群互動策略
  4. 播放列表優化
  5. 觀眾參與機制（問答、投票、挑戰等）
）

**格式要求：**
- 使用台灣繁體中文
- 基於數據提供洞察，明確標註推論部分
- 每個建議都要針對具體的觀眾群體
`;
  }

  /**
   * 綜合分析提示詞（原有的增長飛輪模型）
   */
  private static buildComprehensivePrompt(
    baseContext: string,
    data: AnalysisPromptData
  ): string {
    return `**分析角色：** YouTube 頻道的首席內容策略官

**核心框架：** 基於「增長飛輪」模型，以「總觀看時長」為北極星指標

${baseContext}

**分析任務：**

## 1. 頻道健康度總覽
- 飛輪狀態：分析頻道總體的「總觀看次數」和「訂閱者增長」趨勢
- 內容產出節奏：評估發片頻率是否穩定

## 2. 內容主題分析
- 主題識別：根據影片標題和標籤，找出頻道的主要內容主題或系列
- 表現對比：比較不同主題在觀看次數、互動率的平均表現

## 3. 策略診斷
- 識別「內容磁鐵」：找出訂閱磁鐵和觀看磁鐵
- 識別低效內容：找出高產量、低效率的主題
- 策略評估：評估內容的主題定位和系列化特徵

**輸出格式：**

## 📊 頻道總體診斷
（描述當前增長狀況、內容產出節奏）

## 🎯 內容主題分析
（分析主要內容主題的表現）

## 💡 資源配置建議
（建議如何重新分配製作資源）

## 🚀 關鍵行動項目
（3-5 個具體、可執行的優化建議）

**格式要求：**
- 使用台灣繁體中文
- 中文、英文、數字之間加上半形空格
`;
  }
}
