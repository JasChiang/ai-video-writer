import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleGenerationResult, ProgressMessage, YouTubeVideo } from '../types';
import * as videoApiService from '../services/videoApiService';
import * as notionClient from '../services/notionClient';
import { Loader } from './Loader';
import { CopyButton } from './CopyButton';
import { TEMPLATE_METADATA } from '../services/prompts/templateMetadata.js';
import { AppIcon, resolveIconName } from './AppIcon';

interface ArticleGeneratorProps {
  video: YouTubeVideo;
  onClose: () => void;
  cachedContent?: ArticleGenerationResult | null;
  onContentUpdate?: (content: ArticleGenerationResult | null) => void;
}

interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  displayName: string;
  sizeBytes: number;
}

type NotionStatus =
  | { type: 'success'; message: string; url?: string }
  | { type: 'error'; message: string; url?: string };

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon?: string;
  targetAudience?: string;
  category?: string;
  platforms?: string[];
  keywords?: string[];
  source?: 'built-in' | 'custom';
}

const getDefaultTemplateOptions = (): TemplateOption[] => {
  return Object.values(TEMPLATE_METADATA as Record<string, any>).map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    targetAudience: template.targetAudience,
    platforms: template.platforms,
    keywords: template.keywords,
    source: 'built-in',
  }));
};

// 取得伺服器基礎 URL
// 開發模式使用 localhost:3001，生產模式使用空字符串（相對路徑，與前端同域）
const getServerBaseUrl = () => {
  if (import.meta.env?.VITE_SERVER_BASE_URL) {
    return import.meta.env.VITE_SERVER_BASE_URL;
  }
  return import.meta.env.DEV ? 'http://localhost:3001' : '';
};

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

  const handleDatabaseSelectionChange = useCallback(
    (value: string) => {
      handleDatabaseIdUpdate(value);
    },
    [handleDatabaseIdUpdate]
  );

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
      const payload: notionClient.NotionPublishPayload = {
        title: pageTitle,
        article: result.article,
        seoDescription: result.seo_description,
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
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

  const renderNotionPanel = (showPublishControls: boolean) => {
    const hasConnected = notionAccessToken.trim().length > 0;
    const resolvedToken = (notionAccessToken || notionToken).trim();
    const hasDatabase = notionDatabaseId.trim().length > 0;
    const hasScreenshotPlan =
      !!result && Array.isArray(result.screenshots) && result.screenshots.length > 0;
    const hasScreenshotImages =
      !!result &&
      Array.isArray(result.image_urls) &&
      result.image_urls.some((group) => Array.isArray(group) && group.length > 0) &&
      !result.needsScreenshots;
    const hasTitle = notionPageTitle.trim().length > 0;
    const canPublish =
      showPublishControls &&
      Boolean(result && resolvedToken && hasDatabase && hasTitle && !isPublishingToNotion);
    const publishLabel = isPublishingToNotion
      ? '傳送中...'
      : showPublishControls
        ? '傳送到 Notion'
        : '生成文章後可傳送';

    const renderDatabaseOptionLabel = (db: notionClient.NotionDatabase) => {
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
          onClick={() => setIsNotionPanelOpen(prev => !prev)}
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
                  onClick={handleDisconnectNotion}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800"
                >
                  解除連線
                </button>
                <button
                  type="button"
                  onClick={handleRefreshNotionDatabases}
                  disabled={isFetchingNotionDatabases}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingNotionDatabases ? '更新中...' : '重新整理清單'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectNotion}
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
                  onChange={(e) => {
                    handleDatabaseSelectionChange(e.target.value);
                  }}
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
                    onClick={handleLoadMoreNotionDatabases}
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
              onChange={(e) => {
                handleDatabaseInputChange(e.target.value);
              }}
              onBlur={handleDatabaseInputBlur}
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
                setNotionPageTitle(e.target.value);
                setNotionStatus(null);
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
                      setNotionPageTitle(option.value);
                      setNotionStatus(null);
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
                  setNotionTitleProperty(e.target.value);
                  setNotionStatus(null);
                  setTitlePropertyManuallyEdited(true);
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
                      setNotionTitleProperty(fetchedDatabaseInfo.titleProperty || '');
                      setTitlePropertyManuallyEdited(false);
                      setNotionStatus(null);
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
                    setNotionToken(e.target.value);
                    setNotionStatus(null);
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
                    setIncludeScreenshotPlan(checked);
                    storedScreenshotPlanPreferenceRef.current = checked;
                    if (!hasScreenshotPlan) {
                      setIncludeScreenshotPlan(false);
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
                    setIncludeScreenshotImages(checked);
                    storedScreenshotImagesPreferenceRef.current = checked;
                    if (!hasScreenshotImages) {
                      setIncludeScreenshotImages(false);
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
                setRememberNotionSettings(checked);
                setNotionStatus(null);
                if (!checked && typeof window !== 'undefined') {
                  window.localStorage.removeItem('notionSettings');
                }
              }}
              className="mr-2 h-4 w-4 accent-red-600"
            />
            記住 Notion 設定（僅儲存在本機瀏覽器）
          </label>
          <button
            onClick={handlePublishToNotion}
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

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                文章模板
              </label>
              <p className="mt-1 text-xs text-neutral-500">
                選擇對應的讀者角色或風格，Gemini 會以該模板生成文章架構與語氣。
              </p>
              <div className="mt-2 space-y-1">
                {isFetchingTemplates && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Loader />
                    <span>正在同步遠端模板...</span>
                  </div>
                )}
                {templateFetchError && (
                  <p className="text-xs text-red-600">{templateFetchError}</p>
                )}
                {templatesStatus.disabled ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>目前已停用遠端模板，系統使用內建模板。</span>
                    <button
                      type="button"
                      onClick={handleEnableCustomTemplates}
                      disabled={isTogglingTemplates}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-green-500 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTogglingTemplates ? '啟用中...' : '重新啟用遠端模板'}
                    </button>
                  </div>
                ) : templatesStatus.usingCustomTemplates ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    {templateLastLoadedLabel && <span>最後更新：{templateLastLoadedLabel}</span>}
                    <button
                      type="button"
                      onClick={handleRefreshTemplates}
                      disabled={isRefreshingTemplates}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRefreshingTemplates ? '重新載入中...' : '重新載入遠端模板'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisableCustomTemplates}
                      disabled={isTogglingTemplates}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTogglingTemplates ? '切換中...' : '退出自訂模板'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>目前使用內建模板。</span>
                    <button
                      type="button"
                      onClick={handleEnableCustomTemplates}
                      disabled={isTogglingTemplates}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 font-medium text-neutral-600 transition hover:border-green-500 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTogglingTemplates ? '啟用中...' : '啟用遠端模板'}
                    </button>
                  </div>
                )}
              </div>
              {templateOptions.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {templateOptions.map((template) => {
                    const isSelected = template.id === selectedTemplateId;
                    return (
                      <label
                        key={template.id}
                        className={`relative flex h-full cursor-pointer flex-col rounded-xl border p-4 text-left transition ${
                          isSelected ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-neutral-200 hover:border-red-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="article-template"
                          value={template.id}
                          checked={isSelected}
                          onChange={() => setSelectedTemplateId(template.id)}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xl text-red-600" aria-hidden="true">
                            <AppIcon name={resolveIconName(template.icon)} size={20} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{template.name}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {template.category && (
                                <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                                  {template.category}
                                </span>
                              )}
                              {template.source === 'custom' && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                  自訂模板
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">{template.description}</p>
                        {template.targetAudience && (
                          <p className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
                            <AppIcon name="target" size={14} className="text-red-500" />
                            {template.targetAudience}
                          </p>
                        )}
                        {template.platforms && template.platforms.length > 0 && (
                          <p className="mt-1 text-xs text-neutral-400 flex items-center gap-1">
                            <AppIcon name="mapPin" size={14} className="text-red-500" />
                            {template.platforms.join(' / ')}
                          </p>
                        )}
                        {isSelected && (
                          <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                            已選擇
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">
                  找不到可用的模板設定，系統將使用預設風格。
                </p>
              )}
            </div>

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

            {/* 檔案上傳區域 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-700">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="paperclip" size={16} className="text-red-500" />
                  上傳參考資料（選填）
                </span>
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
                          <AppIcon
                            name={
                              file.mimeType.startsWith('image/') ? 'image' :
                              file.mimeType === 'application/pdf' ? 'document' :
                              file.displayName.endsWith('.md') ? 'notepad' : 'paperclip'
                            }
                            size={18}
                            className="text-red-500"
                          />
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

              <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
                <AppIcon name="idea" size={14} className="text-amber-500" />
                上傳相關文件、圖片或 Markdown 檔案，AI 會參考這些資料來生成更精準的文章內容
              </p>
            </div>

            {/* URL 參考資料區域 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-700">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="globe" size={16} className="text-red-500" />
                  參考網址（選填）
                </span>
              </label>

              {/* URL 輸入框 */}
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  placeholder="輸入網址（需包含 http:// 或 https://）"
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  disabled={isGenerating || referenceUrls.length >= 20}
                />
                <button
                  onClick={handleAddUrl}
                  disabled={isGenerating || !urlInput.trim() || referenceUrls.length >= 20}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  新增
                </button>
              </div>

              {/* 已新增的 URL 列表 */}
              {referenceUrls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-neutral-700">已新增的網址：</p>
                  {referenceUrls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-neutral-600">
                          <AppIcon name="globe" size={18} className="text-red-500" />
                        </span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 truncate underline"
                          title={url}
                        >
                          {url}
                        </a>
                      </div>
                      <button
                        onClick={() => handleRemoveUrl(index)}
                        className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                        disabled={isGenerating}
                        title="移除網址"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
                <AppIcon name="idea" size={14} className="text-amber-500" />
                提供相關網址讓 AI 參考，支援文章、文件、PDF 等（最多 20 個網址）
              </p>
            </div>

            {/* 參考影片區域 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-700">
                <span className="inline-flex items-center gap-1">
                  <AppIcon name="video" size={16} className="text-red-500" />
                  參考影片（選填）
                </span>
              </label>

              {/* 影片 URL 輸入框 */}
              <div className="flex gap-2">
                <input
                  type="url"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVideo();
                    }
                  }}
                  placeholder="輸入 YouTube 影片網址"
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  disabled={isGenerating || referenceVideos.length >= 9}
                />
                <button
                  onClick={handleAddVideo}
                  disabled={isGenerating || !videoUrlInput.trim() || referenceVideos.length >= 9}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  新增
                </button>
              </div>

              {/* 已新增的影片列表 */}
              {referenceVideos.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-neutral-700">已新增的參考影片：</p>
                  {referenceVideos.map((videoUrl, index) => {
                    const videoId = extractVideoId(videoUrl);
                    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {thumbnailUrl && (
                            <img
                              src={thumbnailUrl}
                              alt="影片縮圖"
                              className="w-12 h-9 object-cover rounded"
                            />
                          )}
                          <span className="text-neutral-600">
                            <AppIcon name="video" size={18} className="text-red-500" />
                          </span>
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 truncate underline"
                            title={videoUrl}
                          >
                            {videoUrl}
                          </a>
                        </div>
                        <button
                          onClick={() => handleRemoveVideo(index)}
                          className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                          disabled={isGenerating}
                          title="移除影片"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs mt-2 text-neutral-400 flex items-center gap-1">
                <AppIcon name="idea" size={14} className="text-amber-500" />
                提供額外的 YouTube 影片讓 AI 參考，最多 9 個（加上主要影片共 10 個）
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
              {result.screenshots && result.screenshots.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {result.needsScreenshots ? '截圖時間點規劃' : '關鍵畫面截圖'}
                    </h3>
                    <div className="flex gap-2">
                      {result.needsScreenshots ? (
                        <button
                          onClick={handleCaptureScreenshots}
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
                          onClick={handleRegenerateScreenshots}
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
                        <span className="text-sm inline-flex items-center gap-1">
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
          )}
          <div className="mt-6">
            {renderNotionPanel(Boolean(result))}
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
