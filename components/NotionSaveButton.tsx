import React, { useState, useEffect } from 'react';
import { useNotion } from '../contexts/NotionContext';

interface NotionSaveButtonProps {
  articleData: {
    selectedTitle: string;
    article: string;
    seoDescription?: string;
    videoId?: string;
    videoTitle?: string;
    imageUrls?: string[][];
  };
  onSaveSuccess?: (pageUrl: string) => void;
}

export default function NotionSaveButton({ articleData, onSaveSuccess }: NotionSaveButtonProps) {
  const { isConnected, databases, fetchDatabases, saveArticle } = useNotion();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  // 載入資料庫列表
  useEffect(() => {
    if (isOpen && databases.length === 0) {
      fetchDatabases().catch(err => {
        console.error('[Notion] Failed to fetch databases:', err);
        setError('無法載入資料庫列表');
      });
    }
  }, [isOpen]);

  // 如果未連接 Notion，不顯示按鈕
  if (!isConnected) {
    return null;
  }

  // 檢查必要欄位
  const canSave = articleData.selectedTitle && articleData.article;

  const handleSave = async () => {
    if (!selectedDatabaseId) {
      setError('請選擇一個資料庫');
      return;
    }

    if (!canSave) {
      setError('文章資料不完整');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessUrl(null);

      const result = await saveArticle(selectedDatabaseId, articleData);

      if (result.success && result.url) {
        setSuccessUrl(result.url);
        if (onSaveSuccess) {
          onSaveSuccess(result.url);
        }

        // 3 秒後自動關閉
        setTimeout(() => {
          setIsOpen(false);
          setSuccessUrl(null);
        }, 3000);
      } else {
        setError(result.error || '儲存失敗');
      }
    } catch (err: any) {
      console.error('[Notion] Save error:', err);
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* 儲存到 Notion 按鈕 */}
      <button
        onClick={() => setIsOpen(true)}
        disabled={!canSave}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-neutral-900 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={canSave ? '儲存到 Notion' : '請先生成文章'}
      >
        <svg
          className="w-4 h-4 mr-2"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" />
        </svg>
        儲存到 Notion
      </button>

      {/* 模態視窗 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            {/* 標題 */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">
                儲存到 Notion
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 內容 */}
            <div className="p-6 space-y-4">
              {/* 成功訊息 */}
              {successUrl && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-1">
                        儲存成功！
                      </p>
                      <a
                        href={successUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 hover:text-green-800 underline"
                      >
                        在 Notion 中查看
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* 錯誤訊息 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                </div>
              )}

              {/* 資料庫選擇 */}
              {!successUrl && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      選擇 Notion 資料庫
                    </label>
                    <select
                      value={selectedDatabaseId}
                      onChange={(e) => setSelectedDatabaseId(e.target.value)}
                      disabled={isSaving || databases.length === 0}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {databases.length === 0 ? '載入中...' : '請選擇資料庫'}
                      </option>
                      {databases.map((db) => (
                        <option key={db.id} value={db.id}>
                          {db.icon?.emoji ? `${db.icon.emoji} ` : ''}
                          {db.title || 'Untitled'}
                        </option>
                      ))}
                    </select>
                    {databases.length === 0 && (
                      <p className="mt-2 text-sm text-neutral-500">
                        找不到資料庫？請確保你的 Notion 工作區中有資料庫，並且已授權給此應用。
                      </p>
                    )}
                  </div>

                  {/* 文章預覽 */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <h4 className="text-sm font-medium text-neutral-900 mb-2">
                      文章預覽
                    </h4>
                    <p className="text-sm text-neutral-700 font-medium mb-1">
                      {articleData.selectedTitle}
                    </p>
                    {articleData.seoDescription && (
                      <p className="text-xs text-neutral-500 line-clamp-2">
                        {articleData.seoDescription}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 按鈕 */}
            {!successUrl && (
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selectedDatabaseId || isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      儲存中...
                    </span>
                  ) : (
                    '儲存'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
