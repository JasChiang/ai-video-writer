
import React from 'react';
import { YouTubeIcon } from './Icons';
import { AppIcon } from './AppIcon';

type ActiveTab = 'videos' | 'analytics' | 'articles';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLogout?: () => void;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
}

export function Header({ isLoggedIn, onLogout, activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-600 via-red-500 to-red-600" aria-hidden />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <YouTubeIcon />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                <span className="text-red-600">YouTube</span>{' '}
                <span className="hidden sm:inline">Content Assistant</span>
                <span className="sm:hidden">內容助理</span>
              </h1>
              <p className="text-xs text-neutral-500 sm:text-sm">
                連結頻道、管理影片、快速生成 SEO 與行銷素材
              </p>
            </div>
          </div>

          {isLoggedIn && onLogout && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-red-600 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">登出</span>
                <span className="sm:hidden">離開</span>
              </button>
            </div>
          )}
        </div>

        {isLoggedIn && onTabChange && (
          <nav
            className="mt-3"
            aria-label="主要導覽"
          >
            <div className="flex gap-2 overflow-x-auto rounded-full border border-neutral-200 bg-neutral-50 p-1 text-sm text-neutral-700 shadow-inner sm:text-base">
              {([
                { key: 'videos', label: '影片內容', icon: 'video' },
                { key: 'articles', label: '文章生成', icon: 'article' },
                { key: 'analytics', label: '數據洞察', icon: 'analytics' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 font-semibold transition ${
                    activeTab === tab.key
                      ? 'bg-white text-red-600 shadow'
                      : 'hover:bg-white hover:text-neutral-900'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <AppIcon name={tab.icon} size={16} className="text-red-600" />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
