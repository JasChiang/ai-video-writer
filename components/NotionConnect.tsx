import React, { useState } from 'react';
import { useNotion } from '../contexts/NotionContext';

export default function NotionConnect() {
  const { isConnected, user, isLoading, disconnect } = useNotion();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // 獲取 Notion OAuth URL
  const handleConnect = async () => {
    try {
      const response = await fetch('/api/notion/auth-url', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.authUrl) {
        // 導向到 Notion OAuth 授權頁面
        window.location.href = data.authUrl;
      } else {
        alert('無法取得授權 URL，請稍後再試');
      }
    } catch (error) {
      console.error('[Notion] Get auth URL error:', error);
      alert('連接失敗，請稍後再試');
    }
  };

  // 斷開連接
  const handleDisconnect = async () => {
    if (!confirm('確定要中斷與 Notion 的連接嗎？')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await disconnect();
    } catch (error) {
      console.error('[Notion] Disconnect error:', error);
      alert('中斷連接失敗，請稍後再試');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-neutral-500">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm">檢查連接狀態...</span>
      </div>
    );
  }

  if (isConnected && user) {
    return (
      <div className="flex items-center space-x-4 p-4 bg-white border border-neutral-200 rounded-lg">
        {/* 用戶頭像和資訊 */}
        <div className="flex items-center space-x-3 flex-1">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
              <span className="text-neutral-600 font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-neutral-900 truncate">
                {user.name}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                已連接
              </span>
            </div>
            {user.workspace && (
              <p className="text-sm text-neutral-500 truncate">
                {user.workspace}
              </p>
            )}
          </div>
        </div>

        {/* 斷開連接按鈕 */}
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDisconnecting ? '中斷中...' : '中斷連接'}
        </button>
      </div>
    );
  }

  // 未連接狀態
  return (
    <div className="p-6 bg-white border border-neutral-200 rounded-lg">
      <div className="flex items-start space-x-4">
        {/* Notion Logo */}
        <div className="flex-shrink-0">
          <svg
            className="w-12 h-12"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z"
              fill="#fff"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z"
              fill="#000"
            />
          </svg>
        </div>

        {/* 說明文字 */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            連接到 Notion
          </h3>
          <p className="text-sm text-neutral-600 mb-4">
            將生成的文章自動儲存到你的 Notion 工作區，方便後續編輯和發布。
          </p>

          <button
            onClick={handleConnect}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              viewBox="0 0 100 100"
              fill="currentColor"
            >
              <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" />
            </svg>
            連接 Notion
          </button>
        </div>
      </div>
    </div>
  );
}
