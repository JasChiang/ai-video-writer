import type { ComponentType } from 'react';
import {
  TrendingUp,
  Target,
  Lightbulb,
  Search,
  BarChart3,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  Activity,
  Zap,
  List,
} from 'lucide-react';

export const sectionIcons: Record<string, ComponentType<{ className?: string }>> = {
  // 频道分析相关
  頻道總體診斷: Activity,
  增長飛輪: TrendingUp,
  健康狀況: Activity,
  內容支柱: BarChart3,
  資源配置: Target,
  內容磁鐵: Zap,
  低效內容: TrendingDown,
  卡點診斷: AlertTriangle,
  行動項目: CheckCircle,
  最終建議: Lightbulb,
  頻道定位: Target,

  // 关键字分析相关
  單元總結: List,
  流量獲取: TrendingUp,
  觀眾留存: Users,
  訂閱轉換: Target,
  時間序列: TrendingUp,
  'YouTube SEO': Search,
  'SEO 優化': Search,
  系列化內容: List,

  // 状态相关
  訂閱磁鐵: Zap,
  潛力單元: Lightbulb,
  流量單元: TrendingUp,
  低效單元: TrendingDown,
  內容黑洞: XCircle,

  // 通用
  診斷: Search,
  分析: BarChart3,
  建議: Lightbulb,
  策略: Target,
  優化: TrendingUp,
  警訊: AlertTriangle,
};

export const statusStyles: Record<string, { bg: string; text: string; icon: ComponentType }> = {
  加速期: { bg: 'bg-green-100', text: 'text-green-700', icon: TrendingUp },
  平台期: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
  衰退期: { bg: 'bg-red-100', text: 'text-red-700', icon: TrendingDown },
  停滯期: { bg: 'bg-gray-100', text: 'text-gray-700', icon: XCircle },
  訂閱磁鐵: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Zap },
  潛力支柱: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Lightbulb },
  內容黑洞: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  低效單元: { bg: 'bg-orange-100', text: 'text-orange-700', icon: TrendingDown },
};
