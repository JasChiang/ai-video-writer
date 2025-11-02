
import React from 'react';
import { YouTubeIcon } from './Icons';

interface HeaderProps {
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

export function Header({ isLoggedIn, onLogout }: HeaderProps) {
  return (
    <header className="backdrop-blur-sm relative z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', borderBottom: '1px solid #00B4D8' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <YouTubeIcon />
            <h1 className="text-2xl font-bold text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #0077B6, #00B4D8)' }}>
              YouTube Content Assistant
            </h1>
          </div>

          {isLoggedIn && onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'rgba(202, 240, 248, 0.5)',
                border: '1px solid #90E0EF',
                color: '#0077B6'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              登出
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

