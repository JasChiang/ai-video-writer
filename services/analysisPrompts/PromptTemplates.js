/**
 * 新版 Prompt Templates - 基于实际数据结构重新设计
 * 完全基于频道仪表板和关键字报表的实际可用数据
 */

export class NewPromptTemplates {
  /**
   * 频道健康诊断（基于频道仪表板数据）
   */
  static buildChannelHealthPrompt(data) {
    const {
      channelStats,      // { totalSubscribers, totalViews, totalVideos, viewsInRange, watchTimeHours, subscribersGained, videosInRange }
      topVideos,         // 热门影片列表
      trendData,         // 趋势数据
      monthlyData,       // 月度数据
      trafficSources,    // 流量来源
      searchTerms,       // 搜索词
      demographics,      // 人口统计
      geography,         // 地理分布
      devices,           // 设备类型
      dateRange,         // { startDate, endDate }
    } = data;

    // 计算内容效率
    const contentEfficiency = (channelStats.totalSubscribers / channelStats.totalVideos).toFixed(1);

    // 计算平均观看时长（分钟/观看）
    const avgWatchMinutes = channelStats.viewsInRange > 0
      ? ((channelStats.watchTimeHours * 60) / channelStats.viewsInRange).toFixed(1)
      : 0;

    return `**你是 YouTube 频道的首席策略顾问 (Chief Strategy Advisor)**

**你的任务：** 基于频道的实际运营数据，提供全面的健康诊断和改善策略。

**核心分析框架：内容效率 × 观众粘性 × 流量健康度**

## 可用数据摘要

**频道基本指标：**
- 总订阅者：${channelStats.totalSubscribers.toLocaleString()} 人
- 总观看数：${channelStats.totalViews.toLocaleString()} 次
- 总影片数：${channelStats.totalVideos} 支
- 内容效率：${contentEfficiency} 订阅/影片 ${contentEfficiency < 20 ? '(警告：低于健康线)' : contentEfficiency < 50 ? '(需改进)' : contentEfficiency < 100 ? '(良好)' : '(优秀)'}

**分析期间 (${dateRange.startDate} ~ ${dateRange.endDate})：**
- 观看数：${channelStats.viewsInRange.toLocaleString()} 次
- 观看时长：${channelStats.watchTimeHours.toLocaleString()} 小时
- 平均观看时长：${avgWatchMinutes} 分钟/次
- 新增订阅：${channelStats.subscribersGained} 人
- 发布影片：${channelStats.videosInRange} 支

**热门影片 Top 10：**
${topVideos.slice(0, 10).map((v, i) => `${i + 1}. ${v.title}
   - 观看：${v.viewCount.toLocaleString()} | 赞：${v.likeCount.toLocaleString()} | 评论：${v.commentCount.toLocaleString()}
   - 互动率：${((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(2)}%`).join('\n\n')}

**流量来源分布：**
${trafficSources.map(s => `- ${s.source}: ${s.views.toLocaleString()} 次 (${s.percentage.toFixed(1)}%)`).join('\n')}

**搜索关键词 Top 10：**
${searchTerms.slice(0, 10).map((t, i) => `${i + 1}. "${t.term}" - ${t.views.toLocaleString()} 次观看`).join('\n')}

**观众人口统计：**
${demographics.map(d => `- ${d.ageGroup} ${d.gender}: ${d.viewsPercentage.toFixed(1)}%`).join('\n')}

**地理分布 Top 5：**
${geography.slice(0, 5).map((g, i) => `${i + 1}. ${g.country}: ${g.views.toLocaleString()} 次 (${g.percentage.toFixed(1)}%)`).join('\n')}

**设备类型：**
${devices.map(d => `- ${d.deviceType}: ${d.views.toLocaleString()} 次 (${d.percentage.toFixed(1)}%)`).join('\n')}

---

## 你的分析任务

### 1. 频道健康度总体诊断

**评估以下指标并打分（0-100）：**
- 内容效率健康度（订阅/影片比）
- 观众留存健康度（平均观看时长）
- 流量结构健康度（流量来源分布）
- 增长势能健康度（订阅增长趋势）

**输出格式：**
| 健康指标 | 评分 | 状态 | 诊断 |
|---------|------|------|------|
| 内容效率 | XX/100 | 优秀/良好/需改进/危险 | 简述原因 |
| 观众留存 | XX/100 | ... | ... |
| 流量结构 | XX/100 | ... | ... |
| 增长势能 | XX/100 | ... | ... |

### 2. 流量来源分析与优化建议

**分析要点：**
- 推荐流量（Suggested/Browse）占比是否健康（目标 >40%）？
- 搜索流量占比如何？是否过度依赖？
- 外部流量占比是否过高（警戒线 >50%）？
- 最有价值的搜索关键词是什么？

**提供：**
- 流量结构诊断
- 3 个具体优化策略（优先级排序）

### 3. 热门影片成功因素分析

**分析 Top 10 影片的共同特征：**
- 标题模式（是否使用数字、问句、实用型关键字）
- 主题类型（评测、教学、娱乐等）
- 互动率高低（找出互动磁铁影片）
- 发布时间模式

**输出：**
表格展示 Top 3 影片的详细分析 + 成功因素提炼

### 4. 观众洞察与内容定位

**基于人口统计、地理、设备数据，回答：**
- 核心观众画像是什么？（年龄、性别、地理位置）
- 观看设备分布反映什么信息？
- 内容定位是否匹配观众特征？
- 有哪些未被满足的观众需求？

### 5. 关键改善策略（优先级排序）

**立即执行（本月内）：**
1. [具体策略]
2. [具体策略]
3. [具体策略]

**短期优化（3 个月内）：**
1. [具体策略]
2. [具体策略]

**长期战略（6-12 个月）：**
1. [具体战略方向]
2. [具体战略方向]

---

## 输出要求

1. **使用 Markdown 表格**展示所有对比数据
2. **使用 Mermaid 图表**：
   - 流量来源饼图或条形图
   - 健康度雷达图（如可行）
3. **每个建议必须包含**：
   - 具体执行步骤
   - 预期成效（量化）
   - 执行难度（低/中/高）

4. **撰写规范：**
   - 使用台湾繁体中文
   - 中英文、数字之间加半形空格
   - 避免空泛建议，必须具体可执行
   - 优先级明确（什么先做、什么后做）

**开始分析。**`;
  }

  /**
   * 内容单元效能分析（基于关键字报表数据）
   */
  static buildContentUnitPrompt(data) {
    const { keywordGroups, dateColumns, analyticsData, selectedMetrics } = data;

    // 建立数据表格
    let dataTable = `\n**内容单元效能数据：**\n\n`;
    dataTable += `| 单元名称 | ${dateColumns.map(col => col.label).join(' | ')} |\n`;
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
          row.push(metrics || '无数据');
        } else {
          row.push(cellData?.error || '无数据');
        }
      });
      dataTable += `| ${row.join(' | ')} |\n`;
    });

    // 计算总体统计
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

    return `**你是 YouTube 内容策略分析师 (Content Strategy Analyst)**

**你的任务：** 分析不同内容单元的效能表现，识别明星单元与低效单元，提供资源配置建议。

## 可用数据摘要

**分析维度：**
- 内容单元数量：${totalStats.unitCount} 个
- 时间维度数量：${totalStats.dateRangeCount} 个
- 总观看数：${totalStats.totalViews.toLocaleString()} 次
- 总互动数：${(totalStats.totalLikes + totalStats.totalComments).toLocaleString()} 次
- 总影片数：${totalStats.totalVideos} 支
- 平均互动率：${totalStats.totalViews > 0 ? ((totalStats.totalLikes + totalStats.totalComments) / totalStats.totalViews * 100).toFixed(2) : 0}%

${dataTable}

**选中的分析指标：**
${selectedMetrics.map(m => `- ${m}`).join('\n')}

---

## 你的分析任务

### 1. 内容单元效能对比

**创建对比表格，包含：**
- 单元名称
- 平均观看数
- 平均互动率
- 影片数量
- 效能评级（A/B/C/D）
- 单元定位（明星/潜力/流量/低效）

### 2. 四象限分类

**将所有单元分类到四象限：**

使用 Mermaid quadrantChart 或 ASCII 图表展示：

```
高互动 ↑
     |  潜力单元     |  明星单元     |
     |  (低观看高互动) |  (高观看高互动) |
─────┼──────────────┼──────────────┤→ 高观看
     |  低效单元     |  流量单元     |
     |  (低观看低互动) |  (高观看低互动) |
低互动 ↓
```

**说明每个象限的含义和策略：**
- 明星单元：核心资产，加倍投入
- 潜力单元：SEO 优化，提升曝光
- 流量单元：改善内容品质
- 低效单元：停止或重新包装

### 3. 时间序列趋势分析

**对比不同时间维度的数据，识别：**
- 增长中的单元（新时期 > 旧时期）
- 衰退中的单元（新时期 < 旧时期）
- 稳定的单元（变化不大）

**使用 ASCII 图表或表格展示趋势**

### 4. 资源配置建议

**基于分析结果，提供：**

**加倍投入（明星单元）：**
- 具体单元名称
- 建议动作（发展系列化、增加频率等）
- 预期成效

**SEO 优化（潜力单元）：**
- 具体单元名称
- 优化建议（标题、标签、关键字）
- 预期成效

**停止或转型（低效单元）：**
- 具体单元名称
- 建议动作（停止、重新包装、合并）
- 资源转移计划

### 5. 关键行动计划

**立即执行（本周内）：**
1. [具体动作]
2. [具体动作]
3. [具体动作]

**短期优化（1 个月内）：**
1. [具体动作]
2. [具体动作]

**中期布局（3 个月内）：**
1. [具体目标 + 预期成效]
2. [具体目标 + 预期成效]

---

## 输出要求

1. **必须使用 Markdown 表格**展示单元对比数据
2. **必须使用视觉化图表**展示四象限分类
3. **每个建议必须包含**：
   - 具体单元名称
   - 具体执行步骤
   - 量化的预期成效
4. **优先级明确**（用编号 1, 2, 3 排序）

**开始分析。**`;
  }

  /**
   * 流量增长分析（基于流量来源和搜索词数据）
   */
  static buildTrafficGrowthPrompt(data) {
    const { trafficSources, searchTerms, topVideos, channelStats, dateRange } = data;

    return `**你是 YouTube 流量增长专家 (Traffic Growth Expert)**

**你的任务：** 分析流量来源结构，识别增长机会，提供流量优化策略。

## 可用数据

**流量来源分布：**
${trafficSources.map(s => `- ${s.source}: ${s.views.toLocaleString()} 次 (${s.percentage.toFixed(1)}%)`).join('\n')}

**热门搜索关键词：**
${searchTerms.slice(0, 20).map((t, i) => `${i + 1}. "${t.term}" - ${t.views.toLocaleString()} 次`).join('\n')}

**频道基本信息：**
- 分析期间：${dateRange.startDate} ~ ${dateRange.endDate}
- 总观看数：${channelStats.viewsInRange.toLocaleString()} 次
- 新增订阅：${channelStats.subscribersGained} 人

---

## 你的分析任务

### 1. 流量结构健康度诊断

**评估指标：**
- 推荐流量占比（健康标准：>40%）
- 搜索流量占比（健康标准：30-40%）
- 外部流量占比（警戒线：<30%）
- 频道页流量占比

**提供：**
- 健康度评分（0-100）
- 诊断结论
- 主要问题

### 2. 搜索 SEO 机会分析

**分析热门搜索词：**
- 识别高价值关键词（观看数高）
- 找出长尾关键词机会
- 分析关键词主题分布
- 发现内容缺口

**提供：**
- Top 10 最有价值关键词
- 5 个长尾关键词机会
- 3 个建议的新内容主题

### 3. 流量增长策略

**基于流量结构，提供：**

**如果推荐流量不足：**
- 如何提升观看时长
- 如何优化缩略图和标题
- 如何建立系列化内容

**如果搜索流量不足：**
- SEO 优化策略
- 关键字研究建议
- 标题和描述优化

**如果过度依赖外部流量：**
- 如何转化为内部流量
- 如何提升频道粘性
- 如何优化首页和播放列表

### 4. 关键行动计划

**立即执行：**
1. [具体策略]
2. [具体策略]

**短期目标（1-3 个月）：**
1. [目标 + 量化指标]
2. [目标 + 量化指标]

---

## 输出要求

1. 使用 Mermaid 饼图或条形图展示流量分布
2. 使用表格展示关键词分析
3. 每个策略必须包含执行步骤和预期成效

**开始分析。**`;
  }

  /**
   * 观众洞察分析（基于人口统计、地理、设备数据）
   */
  static buildAudienceInsightsPrompt(data) {
    const { demographics, geography, devices, channelStats, topVideos } = data;

    return `**你是 YouTube 观众洞察专家 (Audience Insights Expert)**

**你的任务：** 深入分析观众特征，提供精准内容定位建议。

## 可用数据

**人口统计：**
${demographics.map(d => `- ${d.ageGroup} ${d.gender}: ${d.viewsPercentage.toFixed(1)}%`).join('\n')}

**地理分布：**
${geography.map((g, i) => `${i + 1}. ${g.country}: ${g.views.toLocaleString()} 次 (${g.percentage.toFixed(1)}%)`).join('\n')}

**设备类型：**
${devices.map(d => `- ${d.deviceType}: ${d.views.toLocaleString()} 次 (${d.percentage.toFixed(1)}%)`).join('\n')}

---

## 你的分析任务

### 1. 核心观众画像

**基于数据，描绘：**
- 主要年龄层
- 性别分布
- 地理位置
- 观看设备偏好

**输出：**
核心观众画像描述 + 次要观众群体

### 2. 内容定位建议

**基于观众特征，回答：**
- 当前内容是否匹配观众？
- 应该制作什么类型的内容？
- 内容深度应该如何调整？
- 发布时间应该如何优化？

### 3. 设备优化建议

**基于设备分布，提供：**
- 缩略图设计建议
- 影片长度建议
- 内容呈现方式建议

### 4. 地理扩展机会

**分析地理数据，回答：**
- 是否有潜力市场未开发？
- 是否需要多语言字幕？
- 内容主题是否需要本地化？

---

## 输出要求

1. 使用表格展示观众分布数据
2. 使用 Mermaid 图表展示观众画像
3. 提供 3-5 个具体的内容定位建议

**开始分析。**`;
  }

  /**
   * 影片效能优化（基于热门影片数据）
   */
  static buildVideoOptimizationPrompt(data) {
    const { topVideos, bottomVideos, channelStats } = data;

    return `**你是 YouTube 影片优化专家 (Video Optimization Expert)**

**你的任务：** 分析高效与低效影片，提供影片优化策略。

## 可用数据

**高效影片 Top 10：**
${topVideos.slice(0, 10).map((v, i) => `${i + 1}. ${v.title}
   - 观看：${v.viewCount.toLocaleString()} | 赞：${v.likeCount.toLocaleString()} | 评论：${v.commentCount.toLocaleString()}
   - 互动率：${((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(2)}%
   - 发布日期：${v.publishedAt}`).join('\n\n')}

${bottomVideos ? `**低效影片 Bottom 10：**
${bottomVideos.slice(0, 10).map((v, i) => `${i + 1}. ${v.title}
   - 观看：${v.viewCount.toLocaleString()} | 赞：${v.likeCount.toLocaleString()} | 评论：${v.commentCount.toLocaleString()}
   - 互动率：${((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(2)}%`).join('\n\n')}` : ''}

---

## 你的分析任务

### 1. 高效影片成功因素

**分析 Top 10 影片的共同特征：**
- 标题模式（数字、问句、实用型）
- 主题类型
- 发布时间模式
- 互动率高低

**输出：**
成功因素提炼 + 可复制的模式

### 2. 低效影片诊断

**分析 Bottom 10 影片的问题：**
- 标题是否吸引人？
- 主题是否符合观众期待？
- 发布时间是否合适？
- SEO 是否优化？

**输出：**
问题诊断 + 改善建议

### 3. 优化策略

**提供具体优化建议：**
- 标题优化模板（3 个范例）
- 缩略图优化建议
- 标签和关键字策略
- 发布时间优化

---

## 输出要求

1. 使用表格对比高效与低效影片
2. 提供可直接使用的标题模板
3. 每个建议必须具体可执行

**开始分析。**`;
  }
}

export default NewPromptTemplates;
