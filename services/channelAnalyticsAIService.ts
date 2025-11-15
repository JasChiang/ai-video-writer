/**
 * Channel Analytics AI Service
 * 使用 Gemini AI 分析頻道表現數據
 */

export interface ChannelAnalysisRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  channelId: string;
  videos: Array<{
    videoId: string;
    title: string;
    publishedAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    tags?: string[];
  }>;
  channelStats: {
    totalViews: number;
    subscriberCount: number;
    totalVideos: number;
  };
}

export interface ChannelAnalysisResult {
  success: boolean;
  analysis?: string; // Markdown 格式的分析結果
  error?: string;
  timestamp?: string;
}

/**
 * 使用 Gemini AI 分析頻道表現
 * @param request 分析請求參數
 * @returns 分析結果
 */
export async function analyzeChannelPerformance(
  request: ChannelAnalysisRequest
): Promise<ChannelAnalysisResult> {
  try {
    console.log('[Channel Analytics AI] 開始分析頻道表現...');
    console.log(`  日期範圍: ${request.startDate} ~ ${request.endDate}`);
    console.log(`  影片數量: ${request.videos.length}`);

    const response = await fetch('/api/analyze-channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '分析請求失敗');
    }

    const result: ChannelAnalysisResult = await response.json();
    console.log('[Channel Analytics AI] ✅ 分析完成');

    return result;
  } catch (error) {
    console.error('[Channel Analytics AI] ❌ 分析失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
    };
  }
}

/**
 * 建立分析提示詞（使用使用者提供的模板）
 * @param request 分析請求
 * @returns 完整的提示詞
 */
export function buildAnalysisPrompt(request: ChannelAnalysisRequest): string {
  const { startDate, endDate, videos, channelStats } = request;

  // 計算基本統計數據
  const totalViewsInPeriod = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const totalLikesInPeriod = videos.reduce((sum, v) => sum + v.likeCount, 0);
  const avgViewsPerVideo = videos.length > 0 ? totalViewsInPeriod / videos.length : 0;

  // 使用使用者提供的分析框架
  const prompt = `**分析角色：** 你是 YouTube 頻道的首席內容策略官。

**核心框架：** 你的分析必須基於「增長飛輪」模型，以「總觀看時長」為北極星指標。你的目標是找出並強化頻道的「內容效率」(Content Efficiency)。

**輸入數據：**
1.  **分析目標：** 頻道整體表現
2.  **日期範圍：** ${startDate} 至 ${endDate}
3.  **頻道統計：**
    *   總訂閱者數: ${channelStats.subscriberCount.toLocaleString()}
    *   頻道總觀看次數: ${channelStats.totalViews.toLocaleString()}
    *   頻道總影片數: ${channelStats.totalVideos}
4.  **分析期間數據：**
    *   分析影片數量: ${videos.length}（僅包含表現最好的前 ${videos.length} 支影片）
    *   頻道實際總影片數: ${channelStats.totalVideos}
    *   總觀看次數（前 ${videos.length} 支）: ${totalViewsInPeriod.toLocaleString()}
    *   總按讚數（前 ${videos.length} 支）: ${totalLikesInPeriod.toLocaleString()}
    *   平均每部影片觀看次數: ${Math.round(avgViewsPerVideo).toLocaleString()}

**⚠️ 重要說明：**
- 以下列出的影片僅為此期間內**表現最好的前 ${videos.length} 支影片**
- 頻道實際總影片數為 ${channelStats.totalVideos} 支
- 請在分析時考量這是「頂尖表現影片」的樣本，而非全部影片

**影片詳細列表（前 ${videos.length} 名）：**
${videos.map(v => `- **${v.title}** (${v.publishedAt.split('T')[0]})
  - 觀看: ${v.viewCount.toLocaleString()}, 按讚: ${v.likeCount.toLocaleString()}, 留言: ${v.commentCount}
  - 標籤: ${v.tags?.join(', ') || '無'}`).join('\n\n')}

---

**分析任務 (Analysis Tasks)：**

**1. 頻道健康度總覽：**
*   **飛輪狀態：** 分析頻道總體的「總觀看次數」和「訂閱者增長」趨勢。飛輪是在加速、維持還是減速？
*   **內容產出節奏：** 評估在此期間的發片頻率是否穩定。

**2. 內容主題分析：**
*   **主題識別：** 根據影片標題和標籤，找出頻道的主要內容主題或系列。
*   **表現對比：** 比較不同主題在觀看次數、互動率（按讚、留言）的平均表現。

**3. 策略診斷：**
*   **識別「內容磁鐵」：** 找出哪些影片或主題是：
    *   **「訂閱磁鐵」：** 擁有最高的按讚數和留言互動（推測能吸引訂閱）。
    *   **「觀看磁鐵」：** 擁有最高的觀看次數。
*   **識別低效內容：** 哪些主題表現出「高產量、低效率」的特徵（即影片數量多，但觀看和互動均偏低）？
*   **策略評估：** 表現最好的內容，是否具有明確的主題定位和系列化特徵？

**輸出報告 (Output Report)：**

請以 Markdown 格式輸出，包含以下章節：

## 📊 頻道總體診斷
（描述當前增長狀況、內容產出節奏）

## 🎯 內容主題分析
（根據影片標題和標籤，分析主要內容主題的表現）

## 💡 資源配置建議
（根據數據洞察，建議如何重新分配製作資源）

## 🚀 關鍵行動項目
（列出 3-5 個具體、可執行的優化建議）

---

**格式要求：**
- 中文、英文、數字之間必須加上半形空格（例如：「YouTube 頻道有 1000 位訂閱者」）
- 使用台灣用語和習慣（例如：使用「影片」而非「視頻」、「訂閱者」而非「粉絲」）

請基於以上數據進行深度分析，提供具體、可執行的策略建議。`;

  return prompt;
}
