
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <YouTubeIcon />
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              <span className="text-red-600">YouTube</span> Content Assistant
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* 分頁切換按鈕 */}
            {isLoggedIn && onTabChange && (
              <div className="flex gap-2">
                <button
                  onClick={() => onTabChange('videos')}
                  className={`px-4 py-2 rounded-full font-medium transition-all border ${
                    activeTab === 'videos'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'bg-neutral-100 border-transparent text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  🎬 影片列表
                </button>
                <button
                  onClick={() => onTabChange('analytics')}
                  className={`px-4 py-2 rounded-full font-medium transition-all border ${
                    activeTab === 'analytics'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'bg-neutral-100 border-transparent text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  📊 影片分析
                </button>
              </div>
            )}

            {/* 登出按鈕 */}
            {isLoggedIn && onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-medium border border-red-600 text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                登出
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
