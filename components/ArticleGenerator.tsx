import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleGenerationResult, ProgressMessage, YouTubeVideo } from '../types';
import * as videoApiService from '../services/client/videoApiService';
import * as notionClient from '../services/client/notionClient';
import { Loader } from './Loader';
import { AppIcon } from './AppIcon';
import type { NotionStatus, TemplateOption, UploadedFile } from './article-generator/types';
import { getServerBaseUrl } from '../utils/serverBaseUrl';
import { getDefaultTemplateOptions } from './article-generator/templateOptions';
import { TemplateSelector } from './article-generator/TemplateSelector';
import { ReferenceInputs } from './article-generator/ReferenceInputs';
import { ResultView } from './article-generator/ResultView';
import { NotionPanel } from './article-generator/NotionPanel';

interface ArticleGeneratorProps {
  video: YouTubeVideo;
  onClose: () => void;
  cachedContent?: ArticleGenerationResult | null;
  onContentUpdate?: (content: ArticleGenerationResult | null) => void;
}

export function ArticleGenerator({ video, onClose, cachedContent, onContentUpdate }: ArticleGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingScreenshots, setIsRegeneratingScreenshots] = useState(false);
  const [isCapturingScreenshots, setIsCapturingScreenshots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleGenerationResult | null>(cachedContent || null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return 'default';
    }
    return window.localStorage.getItem('articleTemplateId') || 'default';
  });
  const [screenshotQuality, setScreenshotQuality] = useState<number>(2); // 預設高畫質
  const [loadingStep, setLoadingStep] = useState<ProgressMessage | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [referenceVideos, setReferenceVideos] = useState<string[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionTitleProperty, setNotionTitleProperty] = useState('Name');
  const [rememberNotionSettings, setRememberNotionSettings] = useState(false);
  const [notionPageTitle, setNotionPageTitle] = useState('');
  const [isPublishingToNotion, setIsPublishingToNotion] = useState(false);
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [titlePropertyManuallyEdited, setTitlePropertyManuallyEdited] = useState(false);
  const [includeScreenshotPlan, setIncludeScreenshotPlan] = useState(false);
  const [includeScreenshotImages, setIncludeScreenshotImages] = useState(false);
  const notionOAuthMonitorRef = useRef<number | null>(null);
  const [notionAccessToken, setNotionAccessToken] = useState('');
  const [notionRefreshToken, setNotionRefreshToken] = useState('');
  const [notionWorkspaceName, setNotionWorkspaceName] = useState('');
  const [notionWorkspaceIcon, setNotionWorkspaceIcon] = useState<string | null>(null);
  const [availableNotionDatabases, setAvailableNotionDatabases] = useState<notionClient.NotionDatabase[]>([]);
  const [isFetchingNotionDatabases, setIsFetchingNotionDatabases] = useState(false);
  const [notionHasMoreDatabases, setNotionHasMoreDatabases] = useState(false);
  const [notionDatabaseCursor, setNotionDatabaseCursor] = useState<string | null>(null);
  const [notionDatabaseError, setNotionDatabaseError] = useState<string | null>(null);
  const [isLaunchingNotionOAuth, setIsLaunchingNotionOAuth] = useState(false);
  const [isNotionPanelOpen, setIsNotionPanelOpen] = useState(false);
  const [isFetchingDatabaseInfo, setIsFetchingDatabaseInfo] = useState(false);
  const [fetchedDatabaseInfo, setFetchedDatabaseInfo] = useState<notionClient.NotionDatabaseInfo | null>(null);
  const storedScreenshotPlanPreferenceRef = useRef<boolean | null>(null);
  const storedScreenshotImagesPreferenceRef = useRef<boolean | null>(null);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>(() => getDefaultTemplateOptions());
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const [isTogglingTemplates, setIsTogglingTemplates] = useState(false);
  const [templateFetchError, setTemplateFetchError] = useState<string | null>(null);
  const [templatesStatus, setTemplatesStatus] = useState<{ usingCustomTemplates: boolean; lastLoadedAt: string | null; disabled: boolean }>({
    usingCustomTemplates: false,
    lastLoadedAt: null,
    disabled: false,
  });
  const serverOrigin = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    const base = getServerBaseUrl();
    if (!base || base === '/' || base === './' || base === '../') {
      return window.location.origin;
    }

    try {
      const url = new URL(base);
      return url.origin;
    } catch {
      return window.location.origin;
    }
  }, []);

  const templateLastLoadedLabel = useMemo(() => {
    if (!templatesStatus.lastLoadedAt) {
      return null;
    }
    const parsed = new Date(templatesStatus.lastLoadedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleString();
  }, [templatesStatus.lastLoadedAt]);

  const [manualDatabaseIdInput, setManualDatabaseIdInput] = useState('');

  // 載入快取內容
  useEffect(() => {
    if (cachedContent) {
      setResult(cachedContent);
    }
  }, [cachedContent]);

  const applyDefaultTemplates = useCallback((overrides: Partial<typeof templatesStatus> = {}) => {
    setTemplateOptions(getDefaultTemplateOptions());
    setTemplatesStatus({
      usingCustomTemplates: false,
      lastLoadedAt: null,
      disabled: false,
      ...overrides,
    });
  }, [setTemplateOptions, setTemplatesStatus]);

  const loadTemplates = useCallback(async () => {
    setIsFetchingTemplates(true);
    setTemplateFetchError(null);
    try {
      const response = await fetch(`${getServerBaseUrl()}/api/templates`);
      if (!response.ok) {
        throw new Error('遠端模板載入失敗');
      }
      const data = await response.json();
      if (Array.isArray(data.templates) && data.templates.length > 0) {
        const normalized = (data.templates as TemplateOption[]).map((template) => ({
          ...template,
          source: template.source || (data.usingCustomTemplates ? 'custom' : 'built-in'),
        }));
        setTemplateOptions(normalized);
      } else {
        console.warn('[Templates] API 回傳空模板清單，維持內建模板');
        applyDefaultTemplates();
      }
      setTemplatesStatus({
        usingCustomTemplates: Boolean(data.usingCustomTemplates),
        lastLoadedAt: data.lastLoadedAt || null,
        disabled: Boolean(data.disabled),
      });
    } catch (error) {
      console.error('[Templates] 載入失敗:', error);
      setTemplateFetchError('目前無法下載遠端模板，已暫時使用內建模板。');
      applyDefaultTemplates();
    } finally {
      setIsFetchingTemplates(false);
    }
  }, [applyDefaultTemplates]);

  const handleRefreshTemplates = useCallback(async () => {
    setIsRefreshingTemplates(true);
    setTemplateFetchError(null);
    try {
      const response = await fetch(`${getServerBaseUrl()}/api/templates/refresh`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('遠端模板重新整理失敗');
      }
      await loadTemplates();
    } catch (error) {
      console.error('[Templates] 重新整理失敗:', error);
      setTemplateFetchError('遠端模板重新整理失敗，已維持現有模板。');
    } finally {
      setIsRefreshingTemplates(false);
    }
  }, [loadTemplates]);

  const handleDisableCustomTemplates = useCallback(async () => {
    setIsTogglingTemplates(true);
    try {
      const response = await fetch(`${getServerBaseUrl()}/api/templates/disable`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('停用自訂模板失敗');
      }
      applyDefaultTemplates({ disabled: true });
      setTemplateFetchError(null);
    } catch (error) {
      console.error('[Templates] 停用失敗:', error);
      setTemplateFetchError('無法停用遠端模板，請稍後再試。');
    } finally {
      setIsTogglingTemplates(false);
    }
  }, [applyDefaultTemplates]);

  const handleEnableCustomTemplates = useCallback(async () => {
    setIsTogglingTemplates(true);
    setTemplateFetchError(null);
    try {
      const response = await fetch(`${getServerBaseUrl()}/api/templates/enable`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('啟用自訂模板失敗');
      }
      await loadTemplates();
    } catch (error) {
      console.error('[Templates] 啟用失敗:', error);
      setTemplateFetchError('無法啟用遠端模板，請確認設定後再試。');
    } finally {
      setIsTogglingTemplates(false);
    }
  }, [loadTemplates]);

  useEffect(() => {
    if (templateOptions.length === 0) {
      return;
    }

    if (!templateOptions.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templateOptions[0].id);
    }
  }, [templateOptions, selectedTemplateId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('articleTemplateId', selectedTemplateId);
  }, [selectedTemplateId]);

  const handleDatabaseIdUpdate = useCallback((value: string) => {
    setNotionDatabaseId(value);
    setManualDatabaseIdInput(value);
    setNotionStatus(null);
    setTitlePropertyManuallyEdited(false);
    setFetchedDatabaseInfo(null);
    setNotionDatabaseError(null);
    setNotionTitleProperty(value ? '' : 'Name');
    setIsFetchingDatabaseInfo(false);
  }, []);

  const extractDatabaseId = useCallback((value: string) => {
    if (!value) return '';

    let candidate = value.trim();
    if (!candidate) return '';

    if (/^https?:\/\//i.test(candidate)) {
      try {
        const url = new URL(candidate);
        candidate = url.pathname.split('/').pop() || candidate;
        if (candidate.includes('?')) {
          candidate = candidate.split('?')[0];
        }
      } catch {
        // ignore parsing error
      }
    }

    const match = candidate.match(/[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (match) {
      return match[0];
    }

    return candidate;
  }, []);

  const handleDatabaseInputChange = useCallback((value: string) => {
    setManualDatabaseIdInput(value);
  }, []);

  const handleDatabaseInputBlur = useCallback(() => {
    const normalized = extractDatabaseId(manualDatabaseIdInput);
    handleDatabaseIdUpdate(normalized);
  }, [extractDatabaseId, handleDatabaseIdUpdate, manualDatabaseIdInput]);

  const quickTitleOptions = useMemo(() => {
    if (!result) {
      return [];
    }

    const options = [
      { label: '選項 A', value: result.titleA },
      { label: '選項 B', value: result.titleB },
      { label: '選項 C', value: result.titleC },
      { label: video.isUrlOnly ? '原始網址' : '原始影片標題', value: video.title },
    ];

    return options
      .filter((option) => option.value && option.value.trim().length > 0)
      .filter(
        (option, index, self) =>
          self.findIndex((item) => item.value === option.value) === index
      );
  }, [result, video.title]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawSettings = window.localStorage.getItem('notionSettings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed && typeof parsed === 'object') {
          // Backward compatibility: 舊版會使用 token 欄位儲存整合金鑰
          if (typeof parsed.accessToken === 'string') {
            setNotionAccessToken(parsed.accessToken);
          } else if (typeof parsed.token === 'string') {
            setNotionToken(parsed.token);
          }
          if (typeof parsed.refreshToken === 'string') {
            setNotionRefreshToken(parsed.refreshToken);
          }
          if (typeof parsed.manualToken === 'string') {
            setNotionToken(parsed.manualToken);
          }
          if (typeof parsed.databaseId === 'string') {
            setNotionDatabaseId(parsed.databaseId);
            setManualDatabaseIdInput(parsed.databaseId);
          }
          if (typeof parsed.titleProperty === 'string' && parsed.titleProperty.trim().length > 0) {
            setNotionTitleProperty(parsed.titleProperty);
            setTitlePropertyManuallyEdited(true);
          }
          if (typeof parsed.workspaceName === 'string') {
            setNotionWorkspaceName(parsed.workspaceName);
          }
          if (typeof parsed.workspaceIcon === 'string') {
            setNotionWorkspaceIcon(parsed.workspaceIcon);
          }
          if (typeof parsed.includeScreenshotPlan === 'boolean') {
            setIncludeScreenshotPlan(parsed.includeScreenshotPlan);
            storedScreenshotPlanPreferenceRef.current = parsed.includeScreenshotPlan;
          }
          if (typeof parsed.includeScreenshotImages === 'boolean') {
            setIncludeScreenshotImages(parsed.includeScreenshotImages);
            storedScreenshotImagesPreferenceRef.current = parsed.includeScreenshotImages;
          }
          setRememberNotionSettings(true);
        }
      }
    } catch (err) {
      console.warn('[Notion] 無法載入儲存的設定:', err);
    }
  }, []);

  useEffect(() => {
    if (result) {
      setNotionPageTitle(result.titleA || video.title);
      setNotionStatus(null);

      const hasPlan = Array.isArray(result.screenshots) && result.screenshots.length > 0;
      const storedPlanPref = storedScreenshotPlanPreferenceRef.current;
      if (hasPlan) {
        if (typeof storedPlanPref === 'boolean') {
          setIncludeScreenshotPlan(storedPlanPref && hasPlan);
        } else {
          setIncludeScreenshotPlan(true);
        }
      } else {
        setIncludeScreenshotPlan(false);
      }

      const hasImages =
        Array.isArray(result.image_urls) &&
        result.image_urls.some((group) => Array.isArray(group) && group.some((url) => typeof url === 'string' && url.trim().length > 0));
      const storedImagesPref = storedScreenshotImagesPreferenceRef.current;
      if (hasImages && !result.needsScreenshots) {
        if (typeof storedImagesPref === 'boolean') {
          setIncludeScreenshotImages(storedImagesPref && hasImages);
        } else {
          setIncludeScreenshotImages(true);
        }
      } else {
        setIncludeScreenshotImages(false);
      }

    } else {
      setNotionPageTitle('');
      setNotionStatus(null);
      setIncludeScreenshotPlan(false);
      setIncludeScreenshotImages(false);
    }
  }, [result, video.title]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!rememberNotionSettings) {
      return;
    }

    const payload = {
      accessToken: notionAccessToken || undefined,
      refreshToken: notionRefreshToken || undefined,
      manualToken: notionToken || undefined,
      databaseId: notionDatabaseId || undefined,
      titleProperty: notionTitleProperty || undefined,
      workspaceName: notionWorkspaceName || undefined,
      workspaceIcon: notionWorkspaceIcon || undefined,
      includeScreenshotPlan: includeScreenshotPlan,
      includeScreenshotImages: includeScreenshotImages,
    };

    window.localStorage.setItem('notionSettings', JSON.stringify(payload));
  }, [
    rememberNotionSettings,
    notionAccessToken,
    notionRefreshToken,
    notionToken,
    notionDatabaseId,
    notionTitleProperty,
    notionWorkspaceName,
    notionWorkspaceIcon,
    includeScreenshotPlan,
    includeScreenshotImages,
  ]);

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

        const response = await fetch(`${getServerBaseUrl()}/api/gemini/upload-file`, {
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
      const response = await fetch(`${getServerBaseUrl()}/api/gemini/file/${encodeURIComponent(file.name)}`, {
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

  // 新增 URL
  const handleAddUrl = () => {
    const trimmedUrl = urlInput.trim();

    // 驗證 URL 格式
    if (!trimmedUrl) {
      return;
    }

    try {
      // 檢查是否為有效的 URL
      new URL(trimmedUrl);

      // 檢查是否已存在
      if (referenceUrls.includes(trimmedUrl)) {
        setError('此 URL 已經新增過了');
        return;
      }

      // 檢查數量限制（Gemini URL Context 最多支援 20 個）
      if (referenceUrls.length >= 20) {
        setError('最多只能新增 20 個參考網址');
        return;
      }

      setReferenceUrls(prev => [...prev, trimmedUrl]);
      setUrlInput('');
      setError(null);
    } catch (e) {
      setError('請輸入有效的 URL（需包含 http:// 或 https://）');
    }
  };

  // 移除 URL
  const handleRemoveUrl = (index: number) => {
    setReferenceUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 從 YouTube URL 提取影片 ID
  const extractVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);

      // 處理 youtube.com/watch?v=xxx 格式
      if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      }

      // 處理 youtu.be/xxx 格式
      if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1);
      }

      return null;
    } catch {
      return null;
    }
  };

  // 新增參考影片
  const handleAddVideo = () => {
    const trimmedUrl = videoUrlInput.trim();

    if (!trimmedUrl) {
      return;
    }

    // 提取影片 ID
    const videoId = extractVideoId(trimmedUrl);

    if (!videoId) {
      setError('請輸入有效的 YouTube 影片網址');
      return;
    }

    // 檢查是否為主要影片
    if (videoId === video.id) {
      setError('此影片已經是主要影片，無需重複新增');
      return;
    }

    // 檢查是否已存在
    if (referenceVideos.includes(trimmedUrl)) {
      setError('此影片已經新增過了');
      return;
    }

    // 檢查數量限制（Gemini 2.5 最多支援 10 個影片，扣除主要影片還有 9 個）
    if (referenceVideos.length >= 9) {
      setError('最多只能新增 9 個參考影片（加上主要影片共 10 個）');
      return;
    }

    setReferenceVideos(prev => [...prev, trimmedUrl]);
    setVideoUrlInput('');
    setError(null);
  };

  // 移除參考影片
  const handleRemoveVideo = (index: number) => {
    setReferenceVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setLoadingStep(null);

    try {
      let generateData;

      // 檢查是否為純網址模式（不是 YouTube 影片）
      if (video.isUrlOnly) {
        // 純網址模式：使用 URL Context 工具直接分析網址
        console.log('[Article] Using URL-only mode (URL Context)');
        console.log('[Article] Main URL:', video.title);
        if (uploadedFiles.length > 0) {
          console.log(`[Article] With ${uploadedFiles.length} reference files`);
        }

        // 將主要 URL 加入到參考網址中
        const allUrls = [video.title, ...referenceUrls];
        console.log(`[Article] Total URLs to send to Gemini: ${allUrls.length}`);
        allUrls.forEach((url, index) => {
          console.log(`[Article]   ${index + 1}. ${url}`);
        });

        if (referenceVideos.length > 0) {
          console.log(`[Article] Reference videos: ${referenceVideos.length}`);
          referenceVideos.forEach((videoUrl, index) => {
            console.log(`[Article]   ${index + 1}. ${videoUrl}`);
          });
        }

        generateData = await videoApiService.generateArticleFromUrlOnly(
          video.title,
          customPrompt,
          (step: ProgressMessage) => {
            setLoadingStep(step);
            console.log(`[Progress] ${step.text}`);
          },
          uploadedFiles,
          selectedTemplateId,
          allUrls,
          referenceVideos
        );
      } else {
        // YouTube 影片模式
        const privacyStatus = video.privacyStatus || 'public';

        // 根據隱私狀態選擇不同的策略
        if (privacyStatus === 'public') {
          // 公開影片：使用 YouTube URL 直接分析（異步版本，適合手機端）
          console.log('[Article] Using YouTube URL for public video (async mode)');
          if (uploadedFiles.length > 0) {
            console.log(`[Article] With ${uploadedFiles.length} reference files`);
          }
          generateData = await videoApiService.generateArticleWithYouTubeUrlAsync(
            video.id,
            customPrompt,
            video.title,
            screenshotQuality,
            (step: ProgressMessage) => {
              setLoadingStep(step);
              console.log(`[Progress] ${step.text}`);
            },
            uploadedFiles,
            selectedTemplateId,
            referenceUrls,
            referenceVideos
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
            (step: ProgressMessage) => {
              setLoadingStep(step);
              console.log(`[Progress] ${step.text}`);
            },
            uploadedFiles,
            selectedTemplateId,
            referenceUrls,
            referenceVideos
          );
        }
      }

      console.log('[Article] Article generated successfully');

      const newResult = {
        titleA: generateData.titleA,
        titleB: generateData.titleB,
        titleC: generateData.titleC,
        article: generateData.article,
        seo_description: generateData.seo_description,
        image_urls: generateData.image_urls || [],
        screenshots: generateData.screenshots,
        needsScreenshots: generateData.needsScreenshots,
        videoId: generateData.videoId || video.id
      };

      setResult(newResult);

      // 更新快取
      if (onContentUpdate) {
        onContentUpdate(newResult);
      }

    } catch (err: any) {
      console.error('[Article] Article generation error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
      setLoadingStep(null);
    }
  };

  const handleRegenerateScreenshots = async () => {
    setIsRegeneratingScreenshots(true);
    setError(null);
    setLoadingStep(null);

    try {
      console.log('[Article] Regenerating screenshots...');

      const regeneratedData = await videoApiService.regenerateScreenshots(
        video.id,
        video.title,
        customPrompt,
        screenshotQuality,
        (step: ProgressMessage) => {
          setLoadingStep(step);
          console.log(`[Progress] ${step.text}`);
        },
        selectedTemplateId
      );

      console.log('[Article] Screenshots regenerated successfully');

      // 更新結果，保持其他內容不變，只更新截圖相關資料
      const newResult = {
        titleA: regeneratedData.titleA,
        titleB: regeneratedData.titleB,
        titleC: regeneratedData.titleC,
        article: regeneratedData.article,
        seo_description: regeneratedData.seo_description,
        image_urls: regeneratedData.image_urls,
        screenshots: regeneratedData.screenshots
      };

      setResult(newResult);

      // 更新快取
      if (onContentUpdate) {
        onContentUpdate(newResult);
      }

    } catch (err: any) {
      console.error('[Article] Screenshot regeneration error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsRegeneratingScreenshots(false);
      setLoadingStep(null);
    }
  };

  const handleCaptureScreenshots = async () => {
    if (!result?.videoId || !result?.screenshots) {
      setError('無法執行截圖：缺少必要資訊');
      return;
    }

    setIsCapturingScreenshots(true);
    setError(null);
    setLoadingStep({ icon: 'info', text: '準備截圖...' });

    try {
      console.log('[Article] Capturing screenshots...');

      const response = await fetch(`${getServerBaseUrl()}/api/capture-screenshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: result.videoId,
          screenshots: result.screenshots,
          quality: screenshotQuality,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const serverReason = deriveScreenshotErrorReason(errorData);
        throw new Error(serverReason);
      }

      const data = await response.json();
      console.log('[Article] Screenshots captured successfully');

      // 更新結果，添加截圖 URLs
      const newResult = {
        ...result,
        image_urls: data.image_urls,
        needsScreenshots: false, // 截圖完成，不再需要
      };

      setResult(newResult);

      // 更新快取
      if (onContentUpdate) {
        onContentUpdate(newResult);
      }

      setLoadingStep(null);

    } catch (err: any) {
      console.error('[Article] Screenshot capture error:', err);
      const friendlyMessage = err?.message
        ? `目前 YouTube 截圖功能暫時無法使用，原因：${err.message}。請依建議時間點前後自行手動截圖。`
        : '目前 YouTube 截圖功能暫時無法使用，請依建議時間點前後自行手動截圖。';
      setError(friendlyMessage);
      setLoadingStep(null);
    } finally {
      setIsCapturingScreenshots(false);
    }
  };

  const fetchNotionDatabases = useCallback(
    async ({ startCursor, append }: { startCursor?: string; append?: boolean } = {}) => {
      if (!notionAccessToken) {
        return;
      }

      setIsFetchingNotionDatabases(true);
      setNotionDatabaseError(null);

      try {
        const response = await notionClient.listNotionDatabases(notionAccessToken, {
          startCursor,
          pageSize: 50,
        });

        setAvailableNotionDatabases((prev) =>
          append ? [...prev, ...response.databases] : response.databases
        );
        setNotionHasMoreDatabases(response.hasMore);
        setNotionDatabaseCursor(response.nextCursor ?? null);

        if (!append) {
          const hasCurrent = response.databases.some((db) => db.id === notionDatabaseId);
          if (!hasCurrent) {
            const first = response.databases[0];
            if (first) {
              handleDatabaseIdUpdate(first.id);
            }
          }
        }
      } catch (err: any) {
        console.error('[Notion] 取得資料庫列表錯誤:', err);
        setNotionDatabaseError(err?.message || '取得 Notion 資料庫列表失敗。');
        setNotionStatus({
          type: 'error',
          message: err?.message || '取得 Notion 資料庫列表失敗，請稍後再試。',
        });

        if (err?.message?.includes('重新登入') || err?.message?.includes('權杖')) {
          setNotionAccessToken('');
          setNotionRefreshToken('');
          setNotionWorkspaceName('');
          setNotionWorkspaceIcon(null);
        }
      } finally {
        setIsFetchingNotionDatabases(false);
      }
    },
    [handleDatabaseIdUpdate, notionAccessToken, notionDatabaseId]
  );

  const handleRefreshNotionDatabases = useCallback(() => {
    if (!notionAccessToken) return;
    fetchNotionDatabases({ append: false });
  }, [fetchNotionDatabases, notionAccessToken]);

  const handleLoadMoreNotionDatabases = useCallback(() => {
    if (!notionAccessToken || !notionHasMoreDatabases || !notionDatabaseCursor) return;
    fetchNotionDatabases({ startCursor: notionDatabaseCursor, append: true });
  }, [fetchNotionDatabases, notionAccessToken, notionHasMoreDatabases, notionDatabaseCursor]);

  const fetchNotionDatabaseInfo = useCallback(
    async (databaseId: string) => {
      if (!notionAccessToken || !databaseId) {
        setFetchedDatabaseInfo(null);
        return;
      }

      setIsFetchingDatabaseInfo(true);
      try {
        const info = await notionClient.getNotionDatabaseInfo(notionAccessToken, databaseId);
        setFetchedDatabaseInfo(info);

        if (info.titleProperty && !titlePropertyManuallyEdited) {
          setNotionTitleProperty(info.titleProperty);
        }
      } catch (err: any) {
        console.error('[Notion] 取得資料庫資訊錯誤:', err);
        setFetchedDatabaseInfo(null);
        setNotionStatus({
          type: 'error',
          message: err?.message || '取得 Notion 資料庫資訊失敗，請稍後再試。',
        });
      } finally {
        setIsFetchingDatabaseInfo(false);
      }
    },
    [notionAccessToken, titlePropertyManuallyEdited]
  );

  const handleConnectNotion = useCallback(async () => {
    try {
      setIsLaunchingNotionOAuth(true);
      setNotionStatus(null);
      const clientOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { url } = await notionClient.getNotionAuthUrl(clientOrigin);

      const width = 640;
      const height = 720;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const oauthWindow = window.open(
        url,
        'notion-oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!oauthWindow) {
        setIsLaunchingNotionOAuth(false);
        setNotionStatus({
          type: 'error',
          message: '瀏覽器阻擋了彈出視窗，請允許後再試。',
        });
        return;
      }

      oauthWindow.focus();

      if (notionOAuthMonitorRef.current) {
        window.clearInterval(notionOAuthMonitorRef.current);
        notionOAuthMonitorRef.current = null;
      }

      notionOAuthMonitorRef.current = window.setInterval(() => {
        if (oauthWindow.closed) {
          if (notionOAuthMonitorRef.current) {
            window.clearInterval(notionOAuthMonitorRef.current);
            notionOAuthMonitorRef.current = null;
          }
          setIsLaunchingNotionOAuth(false);
        }
      }, 500);
    } catch (err: any) {
      console.error('[Notion] 啟動 OAuth 流程失敗:', err);
      setIsLaunchingNotionOAuth(false);
      setNotionStatus({
        type: 'error',
        message: err?.message || '無法啟動 Notion 授權流程，請稍後再試。',
      });
    }
  }, []);

  const handleDisconnectNotion = useCallback(() => {
    setNotionAccessToken('');
    setNotionRefreshToken('');
    setNotionWorkspaceName('');
    setNotionWorkspaceIcon(null);
    setAvailableNotionDatabases([]);
    setNotionHasMoreDatabases(false);
    setNotionDatabaseCursor(null);
    setNotionDatabaseError(null);
    setFetchedDatabaseInfo(null);
    setIsFetchingDatabaseInfo(false);
    setTitlePropertyManuallyEdited(false);
    setIncludeScreenshotPlan(false);
    setIncludeScreenshotImages(false);
    storedScreenshotPlanPreferenceRef.current = null;
    storedScreenshotImagesPreferenceRef.current = null;
    setNotionStatus({
      type: 'success',
      message: '已解除與 Notion 的連線。',
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin &&
        event.origin !== serverOrigin
      ) {
        return;
      }

      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      const { type, payload } = event.data as { type?: string; payload?: unknown };
      if (type !== 'notion:oauth:result') {
        return;
      }

      setIsLaunchingNotionOAuth(false);
      if (notionOAuthMonitorRef.current) {
        window.clearInterval(notionOAuthMonitorRef.current);
        notionOAuthMonitorRef.current = null;
      }

      if (!payload || typeof payload !== 'object') {
        setNotionStatus({
          type: 'error',
          message: 'Notion 授權回應格式不正確，請重新嘗試。',
        });
        return;
      }

      const oauthPayload = payload as {
        success?: boolean;
        message?: string;
        data?: notionClient.NotionOAuthPayload;
      };

      if (!oauthPayload.success) {
        setNotionStatus({
          type: 'error',
          message: oauthPayload.message || 'Notion 授權失敗，請重新嘗試。',
        });
        return;
      }

      const data = oauthPayload.data;
      if (!data?.accessToken) {
        setNotionStatus({
          type: 'error',
          message: '未收到 Notion Access Token，請重新授權。',
        });
        return;
      }

      setNotionAccessToken(data.accessToken);
      setNotionRefreshToken(data.refreshToken || '');
      setNotionWorkspaceName(data.workspaceName || '');
      setNotionWorkspaceIcon(data.workspaceIcon || null);
      setNotionToken('');
      setNotionStatus({
        type: 'success',
        message: `已連線到 Notion 工作區：${data.workspaceName || '未命名工作區'}`,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [serverOrigin]);

  useEffect(() => {
    if (!notionAccessToken) {
      setAvailableNotionDatabases([]);
      setNotionHasMoreDatabases(false);
      setNotionDatabaseCursor(null);
      setFetchedDatabaseInfo(null);
      setManualDatabaseIdInput('');
      return;
    }

    fetchNotionDatabases({ append: false });
  }, [fetchNotionDatabases, notionAccessToken]);

  useEffect(() => {
    if (!notionAccessToken || !notionDatabaseId) {
      setFetchedDatabaseInfo(null);
      return;
    }

    fetchNotionDatabaseInfo(notionDatabaseId.trim());
  }, [fetchNotionDatabaseInfo, notionAccessToken, notionDatabaseId]);

  useEffect(() => {
    return () => {
      if (notionOAuthMonitorRef.current) {
        window.clearInterval(notionOAuthMonitorRef.current);
        notionOAuthMonitorRef.current = null;
      }
    };
  }, []);

  const handlePublishToNotion = async () => {
    if (!result) {
      return;
    }

    const pageTitle = notionPageTitle.trim();
    if (!pageTitle) {
      setNotionStatus({
        type: 'error',
        message: '請先輸入 Notion 頁面標題。',
      });
      return;
    }

    const resolvedToken = (notionAccessToken || notionToken).trim();
    if (!resolvedToken) {
      setNotionStatus({
        type: 'error',
        message: '請先登入 Notion 或填寫整合金鑰。',
      });
      return;
    }

    if (!notionDatabaseId.trim()) {
      setNotionStatus({
        type: 'error',
        message: '請先選擇或輸入 Notion 資料庫 ID。',
      });
      return;
    }

    setNotionStatus(null);
  setIsPublishingToNotion(true);

  try {
      const autoTitleProperty = fetchedDatabaseInfo?.titleProperty?.trim();
      const titlePropertyValue = notionTitleProperty.trim() || autoTitleProperty || 'Name';
      if (!notionTitleProperty.trim() && autoTitleProperty) {
        setNotionTitleProperty(autoTitleProperty);
        setTitlePropertyManuallyEdited(false);
      }
      const hasPlan =
        Array.isArray(result.screenshots) && result.screenshots.length > 0 && includeScreenshotPlan;
      const normalizedImageGroups = Array.isArray(result.image_urls)
        ? result.image_urls
            .map((group) =>
              Array.isArray(group)
                ? group
                    .map((url) => (typeof url === 'string' ? url.trim() : ''))
                    .filter((url) => url.length > 0)
                : []
            )
            .filter((group) => group.length > 0)
        : [];
      const hasImages = normalizedImageGroups.length > 0 && includeScreenshotImages;

      // 判斷是否為 URL-only 模式（video.id 以 'url_' 開頭）
      const isUrlOnlyMode = video.id.startsWith('url_');

      const payload: notionClient.NotionPublishPayload = {
        title: pageTitle,
        article: result.article,
        seoDescription: result.seo_description,
        // URL-only 模式：video.title 存儲的是原始 URL
        // YouTube 模式：構建 YouTube URL
        videoUrl: isUrlOnlyMode
          ? video.title
          : `https://www.youtube.com/watch?v=${video.id}`,
        titleProperty: titlePropertyValue,
      };

      payload.databaseId = notionDatabaseId.trim();
      payload.notionToken = resolvedToken;
      if (hasPlan) {
        payload.screenshotPlan = result.screenshots
          .map((item) => ({
            timestamp: typeof item.timestamp_seconds === 'string' ? item.timestamp_seconds : '',
            reason: typeof item.reason_for_screenshot === 'string' ? item.reason_for_screenshot : '',
          }))
          .filter((item) => item.timestamp || item.reason);
      }
      if (hasImages) {
        payload.imageUrls = normalizedImageGroups;
      }

      const response = await notionClient.publishArticleToNotion(payload);

      if (typeof window !== 'undefined') {
        if (rememberNotionSettings) {
          storedScreenshotPlanPreferenceRef.current = includeScreenshotPlan;
          storedScreenshotImagesPreferenceRef.current = includeScreenshotImages;
          window.localStorage.setItem(
            'notionSettings',
            JSON.stringify({
              accessToken: notionAccessToken || undefined,
              refreshToken: notionRefreshToken || undefined,
              manualToken: notionAccessToken ? undefined : notionToken || undefined,
              databaseId: notionDatabaseId,
              titleProperty: titlePropertyValue,
              workspaceName: notionWorkspaceName || undefined,
              workspaceIcon: notionWorkspaceIcon || undefined,
              includeScreenshotPlan: includeScreenshotPlan,
              includeScreenshotImages: includeScreenshotImages,
            }),
          );
        } else {
          window.localStorage.removeItem('notionSettings');
          storedScreenshotPlanPreferenceRef.current = null;
          storedScreenshotImagesPreferenceRef.current = null;
        }
      }

      setNotionStatus({
        type: 'success',
        message: '已成功發佈到 Notion！',
        url: response.url,
      });
    } catch (err: any) {
      console.error('[Notion] 發佈錯誤:', err);
      setNotionStatus({
        type: 'error',
        message: err?.message || 'Notion 發佈失敗，請稍後再試。',
      });
    } finally {
      setIsPublishingToNotion(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 bg-white border border-neutral-200 shadow-sm">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-neutral-900">
                {video.isUrlOnly ? '來源網址' : '影片標題'}
              </h3>
              <p className="text-neutral-600 break-all">{video.title}</p>
              {result && (
                <p className="mt-1 text-xs text-neutral-500">
                  想重新生成文章？調整提示詞或截圖設定後再次執行即可。
                </p>
              )}
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

            <TemplateSelector
              isFetchingTemplates={isFetchingTemplates}
              templateFetchError={templateFetchError}
              templatesStatus={templatesStatus}
              templateLastLoadedLabel={templateLastLoadedLabel}
              isRefreshingTemplates={isRefreshingTemplates}
              isTogglingTemplates={isTogglingTemplates}
              templateOptions={templateOptions}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={setSelectedTemplateId}
              onRefreshTemplates={handleRefreshTemplates}
              onDisableCustomTemplates={handleDisableCustomTemplates}
              onEnableCustomTemplates={handleEnableCustomTemplates}
            />

            {/* 截圖品質設定（僅 YouTube 影片模式顯示）*/}
            {!video.isUrlOnly && (
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
                <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
                  <AppIcon name="idea" size={14} className="text-amber-500" />
                  高畫質適合印刷或高解析度顯示，壓縮適合網頁快速載入
                </p>
              </div>
            )}

            <ReferenceInputs
              isGenerating={isGenerating}
              isUploading={isUploading}
              uploadedFiles={uploadedFiles}
              onDrop={handleDrop}
              onFileUpload={handleFileUpload}
              onRemoveFile={handleRemoveFile}
              referenceUrls={referenceUrls}
              urlInput={urlInput}
              onUrlInputChange={setUrlInput}
              onAddUrl={handleAddUrl}
              onRemoveUrl={handleRemoveUrl}
              referenceVideos={referenceVideos}
              videoUrlInput={videoUrlInput}
              onVideoUrlInputChange={setVideoUrlInput}
              onAddVideo={handleAddVideo}
              onRemoveVideo={handleRemoveVideo}
              extractVideoId={extractVideoId}
            />

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
                  <span className="text-sm inline-flex items-center gap-1 text-neutral-700">
                    <AppIcon name={loadingStep.icon} className="text-red-500" size={16} />
                    {loadingStep.text}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-[48px] text-white font-semibold px-6 rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  <span>{result ? '重新生成中...' : '生成中...'}</span>
                </>
              ) : (
                <span>{result ? '重新生成文章內容' : '開始生成文章'}</span>
              )}
            </button>

            <div className="space-y-2">
              <p className="text-sm text-center text-neutral-600">
                此過程包含：AI 分析影片 → 生成文章內容 → 擷取關鍵畫面
              </p>
              <p className="text-xs text-center text-neutral-400 flex items-center justify-center gap-1">
                <AppIcon name="idea" size={14} className="text-amber-500" />
                完整流程：下載影片（如需要） → Gemini AI 深度分析 → 生成三種標題風格 → 撰寫文章內容 → 規劃截圖時間點 → FFmpeg 擷取關鍵畫面
              </p>
              <p className="text-xs text-center text-neutral-300 flex items-center justify-center gap-1">
                <AppIcon name="timer" size={14} className="text-neutral-400" />
                預計時間：公開影片約 1-2 分鐘，未列出影片首次需下載約 3-8 分鐘（視影片大小而定）
              </p>
            </div>
          </div>

          {result && (
            <ResultView
              result={result}
              video={video}
              loadingStep={loadingStep}
              isCapturingScreenshots={isCapturingScreenshots}
              isRegeneratingScreenshots={isRegeneratingScreenshots}
              onCaptureScreenshots={handleCaptureScreenshots}
              onRegenerateScreenshots={handleRegenerateScreenshots}
            />
          )}
          <div className="mt-6">
            <NotionPanel
              showPublishControls={Boolean(result)}
              result={result}
              notionAccessToken={notionAccessToken}
              notionToken={notionToken}
              notionDatabaseId={notionDatabaseId}
              notionTitleProperty={notionTitleProperty}
              notionPageTitle={notionPageTitle}
              notionStatus={notionStatus}
              notionWorkspaceName={notionWorkspaceName}
              notionWorkspaceIcon={notionWorkspaceIcon}
              availableNotionDatabases={availableNotionDatabases}
              notionHasMoreDatabases={notionHasMoreDatabases}
              notionDatabaseError={notionDatabaseError}
              isFetchingNotionDatabases={isFetchingNotionDatabases}
              isLaunchingNotionOAuth={isLaunchingNotionOAuth}
              isNotionPanelOpen={isNotionPanelOpen}
              isPublishingToNotion={isPublishingToNotion}
              includeScreenshotPlan={includeScreenshotPlan}
              includeScreenshotImages={includeScreenshotImages}
              rememberNotionSettings={rememberNotionSettings}
              manualDatabaseIdInput={manualDatabaseIdInput}
              quickTitleOptions={quickTitleOptions}
              titlePropertyManuallyEdited={titlePropertyManuallyEdited}
              fetchedDatabaseInfo={fetchedDatabaseInfo}
              isFetchingDatabaseInfo={isFetchingDatabaseInfo}
              storedScreenshotPlanPreferenceRef={storedScreenshotPlanPreferenceRef}
              storedScreenshotImagesPreferenceRef={storedScreenshotImagesPreferenceRef}
              onTogglePanel={() => setIsNotionPanelOpen(prev => !prev)}
              onDisconnectNotion={handleDisconnectNotion}
              onRefreshNotionDatabases={handleRefreshNotionDatabases}
              onConnectNotion={handleConnectNotion}
              onLoadMoreNotionDatabases={handleLoadMoreNotionDatabases}
              onDatabaseIdUpdate={handleDatabaseIdUpdate}
              onDatabaseInputChange={handleDatabaseInputChange}
              onDatabaseInputBlur={handleDatabaseInputBlur}
              onNotionPageTitleChange={setNotionPageTitle}
              onNotionTitlePropertyChange={setNotionTitleProperty}
              onTitlePropertyEdited={setTitlePropertyManuallyEdited}
              onNotionTokenChange={setNotionToken}
              onIncludeScreenshotPlanChange={setIncludeScreenshotPlan}
              onIncludeScreenshotImagesChange={setIncludeScreenshotImages}
              onRememberNotionSettingsChange={(checked) => {
                setRememberNotionSettings(checked);
                if (!checked && typeof window !== 'undefined') {
                  window.localStorage.removeItem('notionSettings');
                }
              }}
              onPublishToNotion={handlePublishToNotion}
              onClearNotionStatus={() => setNotionStatus(null)}
            />
          </div>
    </div>
  );
}

function deriveScreenshotErrorReason(data: any): string {
  const candidates = [data?.error, data?.details, data?.hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.toLowerCase());

  if (candidates.some(text => text.includes('ffmpeg'))) {
    return '伺服器尚未安裝 FFmpeg';
  }
  if (candidates.some(text => text.includes('yt-dlp'))) {
    return '伺服器缺少 yt-dlp';
  }
  if (candidates.some(text => text.includes('local environment'))) {
    return '目前執行環境無法下載 YouTube 影片';
  }
  if (candidates.some(text => text.includes('authorization') || text.includes('token'))) {
    return 'YouTube 權杖失效或無法存取影片';
  }
  if (candidates.some(text => text.includes('sign in') || text.includes('bot') || text.includes('cookies'))) {
    return 'YouTube 需要登入驗證';
  }

  return '系統需求尚未就緒';
}
