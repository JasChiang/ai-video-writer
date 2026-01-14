import React from 'react';
import { BarChart3 } from 'lucide-react';

interface DataSourceInfoProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function DataSourceInfo({ isOpen, onToggle }: DataSourceInfoProps) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-[#FFF5F5] transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#FF3B30]" />
          <strong className="text-[13px] text-[#0F0F0F] font-semibold">數據來源說明</strong>
        </div>
        <svg
          className={`w-5 h-5 text-[#606060] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 bg-white border-t border-[#E5E5E5]">
          <ul className="space-y-2 text-sm text-[#030303] pt-4">
            <li className="flex gap-2">
              <span className="text-[#606060]">•</span>
              <span><strong className="font-medium">時區</strong>：所有數據使用<strong className="font-medium">台灣時間（UTC+8）</strong>，與 YouTube Studio 後台一致</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#606060]">•</span>
              <span><strong className="font-medium">觀看次數 & 觀看時間</strong>：所選時間範圍內<strong className="font-medium">實際產生</strong>的觀看數據（YouTube Analytics API，配額：1-2 單位）</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#606060]">•</span>
              <span><strong className="font-medium">新增訂閱數</strong>：時間範圍內淨增長（新增訂閱 - 取消訂閱）</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#606060]">•</span>
              <span><strong className="font-medium">熱門影片</strong>：基於時間範圍內的觀看次數排序（Analytics API + Gist 快取）</span>
            </li>
            <li className="text-[#0F9D58] font-medium mt-2 flex gap-2">
              <span>✓</span>
              <span>這是真實的時間段內數據，非累計數據</span>
            </li>
            <li className="text-xs text-[#606060] mt-2 flex gap-2">
              <span className="text-[#909090]">•</span>
              <span>如果 Analytics API 不可用，會自動回退到 Gist 快取方案（顯示發布影片的累計數據）</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
