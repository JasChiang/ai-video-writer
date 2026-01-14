import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

interface QuickDatePreset {
  value: string;
  label: string;
}

interface FilterBarProps {
  quickDatePresets: QuickDatePreset[];
  startDate: string;
  endDate: string;
  maxSelectableDate: string;
  isLoading: boolean;
  getQuickDateRange: (value: string) => { start: string; end: string };
  isQuickPresetDisabled: (value: string) => boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
}

export function FilterBar({
  quickDatePresets,
  startDate,
  endDate,
  maxSelectableDate,
  isLoading,
  getQuickDateRange,
  isQuickPresetDisabled,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="sticky top-0 z-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 backdrop-blur-xl bg-white/80 border-y border-gray-200/50 shadow-sm transition-all duration-300 mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {quickDatePresets.map((item) => {
            const range = getQuickDateRange(item.value);
            const isActive = startDate === range.start && endDate === range.end;
            const disabled = isQuickPresetDisabled(item.value);
            const showActive = isActive && !disabled;

            return (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onStartDateChange(range.start);
                  onEndDateChange(range.end);
                }}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-full border transition-all duration-200 ${disabled
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : showActive
                    ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                aria-disabled={disabled}
                title={
                  disabled
                    ? '尚未完整結算該月份的數據，暫時無法使用'
                    : undefined
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-gray-200 text-[#0F0F0F] shadow-sm hover:border-gray-300 transition-colors">
              <Calendar className="w-4 h-4 text-red-500" />
              <input
                type="date"
                value={startDate}
                max={maxSelectableDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-transparent focus:outline-none text-[13px] font-semibold w-32"
              />
              <span className="text-gray-400 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                max={maxSelectableDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="bg-transparent focus:outline-none text-[13px] font-semibold w-32"
              />
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white px-6 py-2.5 text-[13px] font-bold shadow-lg shadow-gray-200 transition-all duration-200 hover:bg-black hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:scale-100"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                載入中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                刷新
              </>
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-right mt-2 leading-tight">
        API 最晚僅提供到 {maxSelectableDate}（比 YouTube Studio 晚 1 天）
      </p>
    </div>
  );
}
