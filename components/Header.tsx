
import React from 'react';
import { YouTubeIcon } from './Icons';

type ActiveTab = 'videos' | 'analytics';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLogout?: () => void;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
}

export function Header({ isLoggedIn, onLogout, activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="relative z-10 bg-white border-b border-neutral-200 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-red-600" aria-hidden />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <YouTubeIcon />
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 tracking-tight">
              <span className="text-red-600">YouTube</span> <span className="hidden sm:inline">Content Assistant</span><span className="sm:hidden">助理</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {/* 分頁切換按鈕 */}
            {isLoggedIn && onTabChange && (
              <div className="flex gap-2 flex-1 sm:flex-none">
                <button
                  onClick={() => onTabChange('videos')}
                  className={`flex-1 sm:flex-none min-w-[100px] px-3 sm:px-4 py-2 rounded-full font-medium text-sm sm:text-base transition-all border whitespace-nowrap ${
                    activeTab === 'videos'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'bg-neutral-100 border-transparent text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <span className="hidden sm:inline">🎬 影片列表</span>
                  <span className="sm:hidden">🎬 影片</span>
                </button>
                <button
                  onClick={() => onTabChange('analytics')}
                  className={`flex-1 sm:flex-none min-w-[100px] px-3 sm:px-4 py-2 rounded-full font-medium text-sm sm:text-base transition-all border whitespace-nowrap ${
                    activeTab === 'analytics'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'bg-neutral-100 border-transparent text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <span className="hidden sm:inline">📊 影片分析</span>
                  <span className="sm:hidden">📊 分析</span>
                </button>
              </div>
            )}

            {/* 登出按鈕 */}
            {isLoggedIn && onLogout && (
              <button
                onClick={onLogout}
                className="flex-shrink-0 flex items-center justify-center gap-2 min-w-[80px] px-3 sm:px-4 py-2 rounded-full font-medium text-sm sm:text-base border border-red-600 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">登出</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
