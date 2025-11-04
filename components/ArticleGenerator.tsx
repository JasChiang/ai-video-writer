import React, { useState } from 'react';
import type { ArticleGenerationResult, YouTubeVideo } from '../types';
import * as videoApiService from '../services/videoApiService';
import { Loader } from './Loader';
import { CopyButton } from './CopyButton';

interface ArticleGeneratorProps {
  video: YouTubeVideo;
  onClose: () => void;
}

interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  displayName: string;
  sizeBytes: number;
}

export function ArticleGenerator({ video, onClose }: ArticleGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingScreenshots, setIsRegeneratingScreenshots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleGenerationResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [screenshotQuality, setScreenshotQuality] = useState<number>(2); // 預設高畫質
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 處理檔案上傳
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        // 檢查檔案大小（限制 100MB）
        if (file.size > 100 * 1024 * 1024) {
          throw new Error(`檔案 ${file.name} 超過 100MB 限制`);
        }

        console.log(`[Upload] 上傳檔案: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://localhost:3001/api/gemini/upload-file', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '檔案上傳失敗');
        }

        const data: UploadedFile = await response.json();
        console.log(`[Upload] ✅ 檔案上傳成功:`, data);

        setUploadedFiles(prev => [...prev, data]);
      }
    } catch (err: any) {
      console.error('[Upload] 檔案上傳錯誤:', err);
      setError(err.message || '檔案上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  // 處理拖放上傳
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  };

  // 移除檔案
  const handleRemoveFile = async (index: number) => {
    const file = uploadedFiles[index];

    try {
      // 從 Gemini Files API 刪除
      const response = await fetch(`http://localhost:3001/api/gemini/file/${encodeURIComponent(file.name)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        console.error('刪除檔案失敗');
      }
    } catch (err) {
      console.error('刪除檔案錯誤:', err);
    }

    // 從列表中移除
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setLoadingStep('');

    try {
      const privacyStatus = video.privacyStatus || 'public';
      let generateData;

      // 根據隱私狀態選擇不同的策略
      if (privacyStatus === 'public') {
        // 公開影片：使用 YouTube URL 直接分析
        console.log('[Article] Using YouTube URL for public video');
        if (uploadedFiles.length > 0) {
          console.log(`[Article] With ${uploadedFiles.length} reference files`);
        }
        generateData = await videoApiService.generateArticleWithYouTubeUrl(
          video.id,
          customPrompt,
          video.title,
          screenshotQuality,
          (step: string) => {
            setLoadingStep(step);
            console.log(`[Progress] ${step}`);
          },
          uploadedFiles
        );
      } else {
        // 非公開影片：先下載再分析
        console.log('[Article] Using download mode for unlisted/private video');
        if (uploadedFiles.length > 0) {
          console.log(`[Article] With ${uploadedFiles.length} reference files`);
        }
        generateData = await videoApiService.generateArticleWithDownload(
          video.id,
          customPrompt,
          video.title,
          screenshotQuality,
          (step: string) => {
            setLoadingStep(step);
            console.log(`[Progress] ${step}`);
          },
          uploadedFiles
        );
      }

      console.log('[Article] Article generated successfully');

      setResult({
        titleA: generateData.titleA,
        titleB: generateData.titleB,
        titleC: generateData.titleC,
        article: generateData.article,
        seo_description: generateData.seo_description,
        image_urls: generateData.image_urls,
        screenshots: generateData.screenshots
      });

    } catch (err: any) {
      console.error('[Article] Article generation error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  const handleRegenerateScreenshots = async () => {
    setIsRegeneratingScreenshots(true);
    setError(null);
    setLoadingStep('');

    try {
      console.log('[Article] Regenerating screenshots...');

      const regeneratedData = await videoApiService.regenerateScreenshots(
        video.id,
        video.title,
        customPrompt,
        screenshotQuality,
        (step: string) => {
          setLoadingStep(step);
          console.log(`[Progress] ${step}`);
        }
      );

      console.log('[Article] Screenshots regenerated successfully');

      // 更新結果，保持其他內容不變，只更新截圖相關資料
      setResult({
        titleA: regeneratedData.titleA,
        titleB: regeneratedData.titleB,
        titleC: regeneratedData.titleC,
        article: regeneratedData.article,
        seo_description: regeneratedData.seo_description,
        image_urls: regeneratedData.image_urls,
        screenshots: regeneratedData.screenshots
      });

    } catch (err: any) {
      console.error('[Article] Screenshot regeneration error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsRegeneratingScreenshots(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="rounded-2xl p-6 bg-white border border-neutral-200 shadow-sm">
          {!result && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-neutral-900">影片標題</h3>
                <p className="text-neutral-600">{video.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700">
                  自訂提示詞（選填）
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="例如：請特別著重技術細節..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none shadow-sm"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700">
                  截圖品質
                </label>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer text-neutral-600">
                    <input
                      type="radio"
                      name="quality"
                      value="2"
                      checked={screenshotQuality === 2}
                      onChange={() => setScreenshotQuality(2)}
                      className="mr-2 accent-red-600"
                    />
                    <span>高畫質（預設）- 檔案較大，畫質最佳</span>
                  </label>
                  <label className="flex items-center cursor-pointer text-neutral-600">
                    <input
                      type="radio"
                      name="quality"
                      value="20"
                      checked={screenshotQuality === 20}
                      onChange={() => setScreenshotQuality(20)}
                      className="mr-2 accent-red-600"
                    />
                    <span>壓縮 - 檔案較小，適合網頁載入</span>
                  </label>
                </div>
                <p className="text-xs mt-2 text-neutral-400">
                  💡 高畫質適合印刷或高解析度顯示，壓縮適合網頁快速載入
                </p>
              </div>

              {/* 檔案上傳區域 */}
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700">
                  📎 上傳參考資料（選填）
                </label>

                {/* 檔案拖放區域 */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-500 hover:bg-neutral-50 transition"
                >
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,.pdf,.txt,.csv,.md"
                    disabled={isUploading || isGenerating}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-neutral-600">
                      <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2">
                        拖放檔案到這裡，或點擊選擇檔案
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        支援：圖片（JPG, PNG, GIF, WEBP）、PDF、Markdown、文字檔（最大 100MB）
                      </p>
                    </div>
                  </label>
                </div>

                {/* 上傳進度提示 */}
                {isUploading && (
                  <div className="mt-3 flex items-center gap-2 text-neutral-600">
                    <Loader />
                    <span className="text-sm">正在上傳檔案...</span>
                  </div>
                )}

                {/* 已上傳檔案列表 */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-neutral-700">已上傳的檔案：</p>
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-neutral-600">
                            {file.mimeType.startsWith('image/') ? '🖼️' :
                             file.mimeType === 'application/pdf' ? '📄' :
                             file.displayName.endsWith('.md') ? '📝' : '📎'}
                          </span>
                          <span className="text-sm text-neutral-700 truncate">
                            {file.displayName}
                          </span>
                          <span className="text-xs text-neutral-500">
                            ({(file.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                          disabled={isUploading || isGenerating}
                          title="移除檔案"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs mt-2 text-neutral-400">
                  💡 上傳相關文件、圖片或 Markdown 檔案，AI 會參考這些資料來生成更精準的文章內容
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600">
                  <p className="font-semibold">錯誤</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {isGenerating && loadingStep && (
                <div className="px-4 py-3 rounded-lg mb-4 bg-neutral-100 border border-neutral-200 text-neutral-600">
                  <div className="flex items-center gap-3">
                    <Loader />
                    <span className="text-sm">{loadingStep}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full text-white font-semibold py-3 px-6 rounded-full transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 hover:scale-[1.01]"
              >
                {isGenerating ? (
                  <>
                    <Loader />
                    <span>生成中...</span>
                  </>
                ) : (
                  '開始生成文章'
                )}
              </button>

              <div className="space-y-2">
                <p className="text-sm text-center text-neutral-600">
                  此過程包含：AI 分析影片 → 生成文章內容 → 擷取關鍵畫面
                </p>
                <p className="text-xs text-center text-neutral-400">
                  💡 完整流程：下載影片（如需要） → Gemini AI 深度分析 → 生成三種標題風格 → 撰寫文章內容 → 規劃截圖時間點 → FFmpeg 擷取關鍵畫面
                </p>
                <p className="text-xs text-center text-neutral-300">
                  ⏱️ 預計時間：公開影片約 1-2 分鐘，未列出影片首次需下載約 3-8 分鐘（視影片大小而定）
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="px-4 py-3 rounded-lg space-y-1 bg-green-50 border border-green-200 text-green-700">
                <p className="font-semibold">✓ 文章生成成功</p>
                <p className="text-sm">
                  已擷取 {result.image_urls.length} 組關鍵畫面（每組 3 張，共 {result.image_urls.reduce((acc, group) => acc + group.length, 0)} 張）
                </p>
                <p className="text-xs text-green-600/80">
                  💡 內容包含：三種標題風格、SEO 描述、完整文章（Markdown 格式）、關鍵畫面截圖（可複製使用）
                </p>
              </div>

              <div>
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-neutral-900">建議標題（三種風格）</h3>
                  <p className="text-xs mt-1 text-neutral-500">
                    💡 Gemini AI 根據影片內容生成三種不同風格的標題，可直接複製使用或作為靈感參考
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
                  <p className="text-xs mt-1 text-neutral-500">
                    💡 適合用於部落格文章的 meta description，已調整關鍵字以提升搜尋排名
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
                  <p className="text-xs mt-1 text-neutral-500">
                    💡 Gemini AI 根據影片內容撰寫的完整文章，使用 Markdown 格式，可直接複製到部落格或內容管理系統
                  </p>
                </div>
                <div className="rounded-lg p-4 max-h-96 overflow-y-auto bg-neutral-50 border border-neutral-200">
                  <pre className="whitespace-pre-wrap text-sm font-mono text-neutral-900">
                    {result.article}
                  </pre>
                </div>
              </div>

              {result.image_urls.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-neutral-900">關鍵畫面截圖</h3>
                    <button
                      onClick={handleRegenerateScreenshots}
                      disabled={isRegeneratingScreenshots}
                      className="text-white font-semibold py-2 px-4 rounded-full transition-transform flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 hover:scale-[1.01]"
                    >
                      {isRegeneratingScreenshots ? (
                        <>
                          <Loader />
                          <span>重新截圖中...</span>
                        </>
                      ) : (
                        '🔄 重新截圖'
                      )}
                    </button>
                  </div>

                  {isRegeneratingScreenshots && loadingStep && (
                    <div className="px-4 py-3 rounded-lg mb-4 bg-neutral-100 border border-neutral-200 text-neutral-600">
                      <div className="flex items-center gap-3">
                        <Loader />
                        <span className="text-sm">{loadingStep}</span>
                      </div>
                    </div>
                  )}

                  {!isRegeneratingScreenshots && (
                    <div className="space-y-1 mb-4">
                      <p className="text-xs text-neutral-500">
                        💡 提示：如果截圖時間點不理想，可使用「重新截圖」功能，讓 Gemini AI 重新分析並選擇更合適的畫面
                      </p>
                      <p className="text-xs text-neutral-400">
                        🔄 重新截圖流程：檢查本地檔案 → 下載影片（如需要） → Gemini AI 重新觀看影片 → 規劃新的截圖時間點 → FFmpeg 擷取畫面（約 1-3 分鐘）
                      </p>
                    </div>
                  )}

                  <p className="text-xs mb-3 text-neutral-400">
                    📸 每個關鍵時間點提供 3 張截圖（當前畫面 ± 2 秒），讓您選擇最佳構圖
                  </p>

                  <div className="space-y-6">
                    {result.image_urls.map((screenshotGroup, groupIndex) => (
                      <div
                        key={groupIndex}
                        className="rounded-lg p-4 bg-white border border-neutral-200 shadow-sm"
                      >
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-neutral-700">
                            時間點: {result.screenshots[groupIndex]?.timestamp_seconds}
                          </p>
                          <p className="text-sm mt-1 text-neutral-600">
                            {result.screenshots[groupIndex]?.reason_for_screenshot}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {screenshotGroup.map((url, imageIndex) => (
                            <div key={imageIndex} className="relative">
                              <img
                                src={`http://localhost:3001${url}`}
                                alt={`Screenshot ${groupIndex + 1}-${imageIndex + 1}`}
                                className="w-full h-auto rounded-lg border border-neutral-200 shadow-sm"
                              />
                              <div className="text-xs text-center mt-1 text-neutral-500">
                                {imageIndex === 0 ? '-2s' : imageIndex === 1 ? '當前' : '+2s'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
    </div>
  );
}
