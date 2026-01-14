import React from 'react';
import type { ArticleGenerationResult, ProgressMessage, YouTubeVideo } from '../../types';
import { CopyButton } from '../CopyButton';
import { AppIcon } from '../AppIcon';
import { Loader } from '../Loader';
import { getServerBaseUrl } from '../../utils/serverBaseUrl';

interface ResultViewProps {
  result: ArticleGenerationResult;
  video: YouTubeVideo;
  loadingStep: ProgressMessage | null;
  isCapturingScreenshots: boolean;
  isRegeneratingScreenshots: boolean;
  onCaptureScreenshots: () => void;
  onRegenerateScreenshots: () => void;
}

export function ResultView({
  result,
  video,
  loadingStep,
  isCapturingScreenshots,
  isRegeneratingScreenshots,
  onCaptureScreenshots,
  onRegenerateScreenshots,
}: ResultViewProps) {
  return (
    <div className="space-y-6">
      {result.needsScreenshots ? (
        <div className="px-4 py-3 rounded-lg space-y-1 bg-blue-50 border border-blue-200 text-blue-700">
          <p className="font-semibold flex items-center gap-1">
            <AppIcon name="check" size={16} className="text-blue-600" />
            文章生成成功（部分完成）
          </p>
          <p className="text-sm">
            已規劃 {result.screenshots?.length || 0} 個截圖時間點，可點擊「截圖」按鈕執行截圖（需要本地環境）
          </p>
          <p className="text-xs text-blue-600/80 flex items-start gap-1">
            <AppIcon name="idea" size={14} className="text-blue-500" />
            <span>內容包含：三種標題風格、SEO 描述、完整文章（Markdown 格式）、截圖時間點規劃</span>
          </p>
          <p className="text-xs text-blue-600/80 flex items-start gap-1">
            <AppIcon name="info" size={14} className="text-blue-500" />
            <span>截圖功能需要 FFmpeg 和 yt-dlp，請在本地環境中執行</span>
          </p>
        </div>
      ) : (
        <div className="px-4 py-3 rounded-lg space-y-1 bg-green-50 border border-green-200 text-green-700">
          <p className="font-semibold flex items-center gap-1">
            <AppIcon name="check" size={16} className="text-green-600" />
            文章生成成功
          </p>
          <p className="text-sm">
            已擷取 {result.image_urls.length} 組關鍵畫面（每組 3 張，共 {result.image_urls.reduce((acc, group) => acc + group.length, 0)} 張）
          </p>
          <p className="text-xs text-green-600/80 flex items-start gap-1">
            <AppIcon name="idea" size={14} className="text-green-600" />
            <span>內容包含：三種標題風格、SEO 描述、完整文章（Markdown 格式）、關鍵畫面截圖（可複製使用）</span>
          </p>
        </div>
      )}

      <div>
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-neutral-900">建議標題（三種風格）</h3>
          <p className="text-xs mt-1 text-neutral-500 flex items-start gap-1">
            <AppIcon name="idea" size={14} className="text-amber-500" />
            <span>Gemini AI 根據影片內容生成三種不同風格的標題，可直接複製使用或作為靈感參考</span>
          </p>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg p-4 bg-neutral-50 border border-neutral-200">
            <div className="text-xs mb-1 text-neutral-500">選項 A（結果/價值導向）</div>
            <div className="flex justify-between items-start gap-2 text-neutral-900">
              <p className="flex-1">{result.titleA}</p>
              <CopyButton textToCopy={result.titleA} />
            </div>
          </div>
          <div className="rounded-lg p-4 bg-neutral-50 border border-neutral-200">
            <div className="text-xs mb-1 text-neutral-500">選項 B（情境/痛點導向）</div>
            <div className="flex justify-between items-start gap-2 text-neutral-900">
              <p className="flex-1">{result.titleB}</p>
              <CopyButton textToCopy={result.titleB} />
            </div>
          </div>
          <div className="rounded-lg p-4 bg-neutral-50 border border-neutral-200">
            <div className="text-xs mb-1 text-neutral-500">選項 C（技巧/趨勢導向）</div>
            <div className="flex justify-between items-start gap-2 text-neutral-900">
              <p className="flex-1">{result.titleC}</p>
              <CopyButton textToCopy={result.titleC} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-neutral-900">SEO 描述</h3>
            <CopyButton textToCopy={result.seo_description} />
          </div>
          <p className="text-xs mt-1 text-neutral-500 flex items-start gap-1">
            <AppIcon name="idea" size={14} className="text-amber-500" />
            <span>適合用於部落格文章的 meta description，已調整關鍵字以提升搜尋排名</span>
          </p>
        </div>
        <div className="rounded-lg p-4 bg-neutral-50 border border-neutral-200">
          <p className="text-sm text-neutral-900">{result.seo_description}</p>
        </div>
      </div>

      <div>
        <div className="mb-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-neutral-900">文章內容（Markdown）</h3>
            <CopyButton textToCopy={result.article} />
          </div>
          <p className="text-xs mt-1 text-neutral-500 flex items-start gap-1">
            <AppIcon name="idea" size={14} className="text-amber-500" />
            <span>Gemini AI 根據影片內容撰寫的完整文章，使用 Markdown 格式，可直接複製到部落格或內容管理系統</span>
          </p>
        </div>
        <div className="rounded-lg p-4 max-h-96 overflow-y-auto bg-neutral-50 border border-neutral-200">
          <pre className="whitespace-pre-wrap text-sm font-mono text-neutral-900">
            {result.article}
          </pre>
        </div>
      </div>

      {!video.isUrlOnly && result.screenshots && result.screenshots.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-neutral-900">
              {result.needsScreenshots ? '截圖時間點規劃' : '關鍵畫面截圖'}
            </h3>
            <div className="flex gap-2">
              {result.needsScreenshots ? (
                <button
                  onClick={onCaptureScreenshots}
                  disabled={isCapturingScreenshots}
                  className="w-[120px] h-[40px] text-white font-semibold px-4 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isCapturingScreenshots ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>截圖中...</span>
                    </>
                  ) : (
                    <>
                      <AppIcon name="camera" size={16} className="text-white" />
                      <span>截圖</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onRegenerateScreenshots}
                  disabled={isRegeneratingScreenshots}
                  className="w-[140px] h-[40px] text-white font-semibold px-4 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {isRegeneratingScreenshots ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>重新截圖中...</span>
                    </>
                  ) : (
                    <>
                      <AppIcon name="refresh" size={16} className="text-white" />
                      <span>重新截圖</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {(isRegeneratingScreenshots || isCapturingScreenshots) && loadingStep && (
            <div className="px-4 py-3 rounded-lg mb-4 bg-neutral-100 border border-neutral-200 text-neutral-600">
              <div className="flex items-center gap-3">
                <Loader />
                <span className="text-sm inline-flex items-center gap-1 text-neutral-700">
                  <AppIcon name={loadingStep.icon} className="text-red-500" size={16} />
                  {loadingStep.text}
                </span>
              </div>
            </div>
          )}

          {!isRegeneratingScreenshots && !isCapturingScreenshots && (
            <div className="space-y-1 mb-4">
              {result.needsScreenshots ? (
                <>
                  <p className="text-xs text-blue-600 flex items-start gap-1">
                    <AppIcon name="idea" size={14} className="text-blue-500" />
                    <span>AI 已規劃好截圖時間點，點擊「截圖」按鈕開始擷取畫面</span>
                  </p>
                  <p className="text-xs text-neutral-400 flex items-start gap-1">
                    <AppIcon name="info" size={14} className="text-neutral-500" />
                    <span>截圖功能需要 FFmpeg 和 yt-dlp，僅在本地環境可用</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-neutral-500 flex items-start gap-1">
                    <AppIcon name="idea" size={14} className="text-amber-500" />
                    <span>提示：如果截圖時間點不理想，可使用「重新截圖」功能，讓 Gemini AI 重新分析並選擇更合適的畫面</span>
                  </p>
                  <p className="text-xs text-neutral-400 flex items-start gap-1">
                    <AppIcon name="refresh" size={14} className="text-neutral-500" />
                    <span>重新截圖流程：檢查本地檔案 → 下載影片（如需要） → Gemini AI 重新觀看影片 → 規劃新的截圖時間點 → FFmpeg 擷取畫面（約 1-3 分鐘）</span>
                  </p>
                </>
              )}
            </div>
          )}

          {!result.needsScreenshots && (
            <p className="text-xs mb-3 text-neutral-400 flex items-start gap-1">
              <AppIcon name="camera" size={14} className="text-neutral-500" />
              <span>每個關鍵時間點提供 3 張截圖（當前畫面 ± 2 秒），讓您選擇最佳構圖</span>
            </p>
          )}

          <div className="space-y-6">
            {result.screenshots.map((screenshot, groupIndex) => (
              <div
                key={groupIndex}
                className="rounded-lg p-4 bg-white border border-neutral-200 shadow-sm"
              >
                <div className="mb-3">
                  <p className="text-sm font-semibold text-neutral-700">
                    時間點: {screenshot.timestamp_seconds}
                  </p>
                  <p className="text-sm mt-1 text-neutral-600">
                    {screenshot.reason_for_screenshot}
                  </p>
                </div>

                {result.image_urls &&
                  Array.isArray(result.image_urls[groupIndex]) &&
                  result.image_urls[groupIndex].length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {result.image_urls[groupIndex].map((url, imageIndex) => (
                      <div key={imageIndex} className="relative">
                        <img
                          src={`${getServerBaseUrl()}${url}`}
                          alt={`Screenshot ${groupIndex + 1}-${imageIndex + 1}`}
                          className="w-full h-auto rounded-lg border border-neutral-200 shadow-sm"
                        />
                        <div className="text-xs text-center mt-1 text-neutral-500">
                          {imageIndex === 0 ? '-2s' : imageIndex === 1 ? '當前' : '+2s'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
