import React from 'react';
import { BarChart3 } from 'lucide-react';

export function DashboardHeader() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF1D1D] via-[#E30000] to-[#B20000] text-white shadow-[0_20px_60px_rgba(255,0,0,0.25)] p-8 mb-6">
      <div className="absolute -right-10 -top-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -left-12 bottom-0 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/30 text-white flex items-center justify-center shadow-lg shadow-black/20">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70 mb-1">
                YouTube Analytics
              </p>
              <h2 className="text-[32px] font-extrabold leading-tight">頻道數據儀表板</h2>
            </div>
          </div>
          <p className="text-white/80 text-[15px] leading-relaxed max-w-2xl">
            深入了解頻道表現、觀眾互動與成長趨勢，掌握每一次流量波動。
          </p>
        </div>
      </div>
    </div>
  );
}
