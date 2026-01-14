import React from 'react';
import type { ArticleGenerationResult } from '../../types';
import type { NotionStatus } from './types';
import { AppIcon } from '../AppIcon';
import type { NotionDatabase, NotionDatabaseInfo } from '../../services/client/notionClient';

interface NotionPanelProps {
  showPublishControls: boolean;
  result: ArticleGenerationResult | null;
  notionAccessToken: string;
  notionToken: string;
  notionDatabaseId: string;
  notionTitleProperty: string;
  notionPageTitle: string;
  notionStatus: NotionStatus | null;
  notionWorkspaceName: string;
  notionWorkspaceIcon: string | null;
  availableNotionDatabases: NotionDatabase[];
  notionHasMoreDatabases: boolean;
  notionDatabaseError: string | null;
  isFetchingNotionDatabases: boolean;
  isLaunchingNotionOAuth: boolean;
  isNotionPanelOpen: boolean;
  isPublishingToNotion: boolean;
  includeScreenshotPlan: boolean;
  includeScreenshotImages: boolean;
  rememberNotionSettings: boolean;
  manualDatabaseIdInput: string;
  quickTitleOptions: Array<{ label: string; value: string }>;
  titlePropertyManuallyEdited: boolean;
  fetchedDatabaseInfo: NotionDatabaseInfo | null;
  isFetchingDatabaseInfo: boolean;
  storedScreenshotPlanPreferenceRef: React.MutableRefObject<boolean | null>;
  storedScreenshotImagesPreferenceRef: React.MutableRefObject<boolean | null>;
  onTogglePanel: () => void;
  onDisconnectNotion: () => void;
  onRefreshNotionDatabases: () => void;
  onConnectNotion: () => void;
  onLoadMoreNotionDatabases: () => void;
  onDatabaseIdUpdate: (value: string) => void;
  onDatabaseInputChange: (value: string) => void;
  onDatabaseInputBlur: () => void;
  onNotionPageTitleChange: (value: string) => void;
  onNotionTitlePropertyChange: (value: string) => void;
  onTitlePropertyEdited: (value: boolean) => void;
  onNotionTokenChange: (value: string) => void;
  onIncludeScreenshotPlanChange: (value: boolean) => void;
  onIncludeScreenshotImagesChange: (value: boolean) => void;
  onRememberNotionSettingsChange: (value: boolean) => void;
  onPublishToNotion: () => void;
  onClearNotionStatus: () => void;
}

export function NotionPanel({
  showPublishControls,
  result,
  notionAccessToken,
  notionToken,
  notionDatabaseId,
  notionTitleProperty,
  notionPageTitle,
  notionStatus,
  notionWorkspaceName,
  notionWorkspaceIcon,
  availableNotionDatabases,
  notionHasMoreDatabases,
  notionDatabaseError,
  isFetchingNotionDatabases,
  isLaunchingNotionOAuth,
  isNotionPanelOpen,
  isPublishingToNotion,
  includeScreenshotPlan,
  includeScreenshotImages,
  rememberNotionSettings,
  manualDatabaseIdInput,
  quickTitleOptions,
  titlePropertyManuallyEdited,
  fetchedDatabaseInfo,
  isFetchingDatabaseInfo,
  storedScreenshotPlanPreferenceRef,
  storedScreenshotImagesPreferenceRef,
  onTogglePanel,
  onDisconnectNotion,
  onRefreshNotionDatabases,
  onConnectNotion,
  onLoadMoreNotionDatabases,
  onDatabaseIdUpdate,
  onDatabaseInputChange,
  onDatabaseInputBlur,
  onNotionPageTitleChange,
  onNotionTitlePropertyChange,
  onTitlePropertyEdited,
  onNotionTokenChange,
  onIncludeScreenshotPlanChange,
  onIncludeScreenshotImagesChange,
  onRememberNotionSettingsChange,
  onPublishToNotion,
  onClearNotionStatus,
}: NotionPanelProps) {
  const hasConnected = notionAccessToken.trim().length > 0;
  const resolvedToken = (notionAccessToken || notionToken).trim();
  const hasDatabase = notionDatabaseId.trim().length > 0;
  const hasScreenshotPlan =
    Boolean(result && Array.isArray(result.screenshots) && result.screenshots.length > 0);
  const hasScreenshotImages =
    Boolean(
      result &&
        Array.isArray(result.image_urls) &&
        result.image_urls.some((group) => Array.isArray(group) && group.length > 0) &&
        !result.needsScreenshots
    );
  const hasTitle = notionPageTitle.trim().length > 0;
  const canPublish =
    showPublishControls &&
    Boolean(result && resolvedToken && hasDatabase && hasTitle && !isPublishingToNotion);
  const publishLabel = isPublishingToNotion
    ? '傳送中...'
    : showPublishControls
      ? '傳送到 Notion'
      : '生成文章後可傳送';

  const renderDatabaseOptionLabel = (db: NotionDatabase) => {
    if (db.icon && db.icon.length <= 4) {
      return `${db.icon} ${db.title}`;
    }
    return db.title;
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <button
        type="button"
        aria-expanded={isNotionPanelOpen}
        onClick={onTogglePanel}
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Notion 匯出</h3>
          <p className="text-xs text-neutral-500">
            將生成的文章、SEO 描述與截圖內容同步到指定的 Notion 資料庫
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span>{isNotionPanelOpen ? '收合' : '展開'}</span>
          <svg
            className={`h-4 w-4 transition-transform ${isNotionPanelOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isNotionPanelOpen && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-neutral-500">
                連結 Notion 帳號後，可從授權的資料庫中選擇目標，將生成的文章與 SEO 資訊匯入。
              </p>
              <p className="text-xs text-neutral-400 flex items-start gap-1">
                <AppIcon name="info" size={14} className="text-red-500" />
                <span>登入後請在目標資料庫的 Share 設定中加入此整合，才能寫入內容。</span>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              {hasConnected ? (
                <>
                  <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                    {notionWorkspaceIcon && notionWorkspaceIcon.length <= 4 ? (
                      <span>{notionWorkspaceIcon}</span>
                    ) : null}
                    <span>{notionWorkspaceName || 'Notion 已連線'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onDisconnectNotion}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800"
                  >
                    解除連線
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshNotionDatabases}
                    disabled={isFetchingNotionDatabases}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFetchingNotionDatabases ? '更新中...' : '重新整理清單'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onConnectNotion}
                  disabled={isLaunchingNotionOAuth}
                  className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLaunchingNotionOAuth ? '啟動中...' : '登入 Notion'}
                </button>
              )}
            </div>
          </div>

          {hasConnected ? (
            <div className="mt-4 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs text-green-700">
              <p>已連線工作區：{notionWorkspaceName || '未命名工作區'}</p>
              <p>若清單中沒有看到資料庫，請到 Notion 中開啟該資料庫，並在 Share → Invite 中加入此整合。</p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-neutral-500">
              尚未登入 Notion，可直接輸入整合金鑰與資料庫 ID；或登入後從清單中快速選擇。
            </p>
          )}

          <div className="mt-4 grid gap-4">
            {availableNotionDatabases.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  選擇 Notion 資料庫
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <select
                    value={notionDatabaseId}
                    onChange={(e) => onDatabaseIdUpdate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm sm:w-80"
                  >
                    <option value="">請選擇資料庫</option>
                    {availableNotionDatabases.map((db) => (
                      <option key={db.id} value={db.id}>
                        {renderDatabaseOptionLabel(db)}
                      </option>
                    ))}
                  </select>
                  {notionHasMoreDatabases && (
                    <button
                      type="button"
                      onClick={onLoadMoreNotionDatabases}
                      disabled={isFetchingNotionDatabases}
                      className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      載入更多
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  從授權給此整合的資料庫中快速選擇。若未出現在清單中，可手動輸入資料庫 ID。
                </p>
              </div>
            )}

            {notionDatabaseError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
                {notionDatabaseError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Notion 資料庫 ID
              </label>
              <input
                type="text"
                value={manualDatabaseIdInput}
                onChange={(e) => onDatabaseInputChange(e.target.value)}
                onBlur={onDatabaseInputBlur}
                placeholder="例如：abcd1234efgh5678ijkl9012mnop3456"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              />
              <p className="mt-1 text-xs text-neutral-400">
                開啟資料庫時，網址中長度為 32 的字串。可直接貼上來覆蓋上方選擇。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Notion 頁面標題
              </label>
              <input
                type="text"
                value={notionPageTitle}
                onChange={(e) => {
                  onNotionPageTitleChange(e.target.value);
                  onClearNotionStatus();
                }}
                placeholder="輸入要在 Notion 顯示的標題"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              />
              {quickTitleOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-500">快速套用：</span>
                  {quickTitleOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        onNotionPageTitleChange(option.value);
                        onClearNotionStatus();
                      }}
                      className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-red-500 hover:text-red-600"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  標題欄位名稱
                </label>
                {isFetchingDatabaseInfo && (
                  <p className="mt-1 text-xs text-neutral-500">正在讀取資料庫欄位資訊...</p>
                )}
                {!isFetchingDatabaseInfo && fetchedDatabaseInfo?.titleProperty && !titlePropertyManuallyEdited && (
                  <p className="mt-1 text-xs text-green-600">
                    已自動偵測標題欄位：{fetchedDatabaseInfo.titleProperty}
                  </p>
                )}
                {!isFetchingDatabaseInfo && !fetchedDatabaseInfo?.titleProperty && (
                  <p className="mt-1 text-xs text-amber-600">
                    未偵測到 Title 欄位，請手動輸入資料庫中的標題欄位名稱。
                  </p>
                )}
                <input
                  type="text"
                  value={notionTitleProperty}
                  onChange={(e) => {
                    onNotionTitlePropertyChange(e.target.value);
                    onClearNotionStatus();
                    onTitlePropertyEdited(true);
                  }}
                  placeholder={
                    fetchedDatabaseInfo?.titleProperty
                      ? `例如：${fetchedDatabaseInfo.titleProperty}`
                      : '預設為 Name'
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-neutral-400">
                    Notion 每個資料庫僅允許一個 Title 欄位，若名稱不同請在此處輸入實際欄位名稱。
                  </span>
                  {titlePropertyManuallyEdited && fetchedDatabaseInfo?.titleProperty && (
                    <button
                      type="button"
                      onClick={() => {
                        onNotionTitlePropertyChange(fetchedDatabaseInfo.titleProperty || '');
                        onTitlePropertyEdited(false);
                        onClearNotionStatus();
                      }}
                      className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-red-400 hover:text-red-600"
                    >
                      還原為 {fetchedDatabaseInfo.titleProperty}
                    </button>
                  )}
                </div>
              </div>

              {!hasConnected && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700">
                    Notion 整合金鑰（選填）
                  </label>
                  <input
                    type="password"
                    value={notionToken}
                    onChange={(e) => {
                      onNotionTokenChange(e.target.value);
                      onClearNotionStatus();
                    }}
                    placeholder="secret_xxxxxxxxxxxxxxxxxxxxx"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    若未使用 OAuth，可直接貼上 Internal Integration Secret。
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
              <p className="font-medium text-neutral-800">儲存內容選項</p>
              <div className="mt-3 flex flex-col gap-2">
                <label className={`flex items-center gap-2 ${hasScreenshotPlan ? '' : 'text-neutral-400'}`}>
                  <input
                    type="checkbox"
                    disabled={!hasScreenshotPlan}
                    checked={hasScreenshotPlan ? includeScreenshotPlan : false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onIncludeScreenshotPlanChange(checked);
                      storedScreenshotPlanPreferenceRef.current = checked;
                      if (!hasScreenshotPlan) {
                        onIncludeScreenshotPlanChange(false);
                        storedScreenshotPlanPreferenceRef.current = false;
                      }
                    }}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span>
                    包含截圖時間點規劃
                    {!hasScreenshotPlan && '（無可用資料）'}
                  </span>
                </label>
                <label className={`flex items-center gap-2 ${hasScreenshotImages ? '' : 'text-neutral-400'}`}>
                  <input
                    type="checkbox"
                    disabled={!hasScreenshotImages}
                    checked={hasScreenshotImages ? includeScreenshotImages : false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onIncludeScreenshotImagesChange(checked);
                      storedScreenshotImagesPreferenceRef.current = checked;
                      if (!hasScreenshotImages) {
                        onIncludeScreenshotImagesChange(false);
                        storedScreenshotImagesPreferenceRef.current = false;
                      }
                    }}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span>
                    包含截圖圖像
                    {!hasScreenshotImages && '（尚未完成截圖）'}
                  </span>
                </label>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                需先完成截圖或規劃後才能將資料寫入 Notion。
              </p>
            </div>
          </div>

          {notionStatus && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                notionStatus.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-600'
              }`}
            >
              <p>{notionStatus.message}</p>
              {notionStatus.type === 'success' && notionStatus.url && (
                <p className="mt-1 text-xs">
                  <a
                    className="font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
                    href={notionStatus.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    在 Notion 開啟頁面
                  </a>
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={rememberNotionSettings}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onRememberNotionSettingsChange(checked);
                  onClearNotionStatus();
                }}
                className="mr-2 h-4 w-4 accent-red-600"
              />
              記住 Notion 設定（僅儲存在本機瀏覽器）
            </label>
            <button
              onClick={onPublishToNotion}
              disabled={!canPublish}
              className="h-[40px] w-full rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[200px]"
            >
              {publishLabel}
            </button>
          </div>

          {!showPublishControls && (
            <p className="mt-2 text-xs text-neutral-400">
              生成文章後即可啟用「傳送到 Notion」功能。
            </p>
          )}
        </>
      )}
    </div>
  );
}
