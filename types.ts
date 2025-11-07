export interface GeneratedContentType {
  titleA: string;
  titleB: string;
  titleC: string;
  description: string;
  tags: string[];
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  tags: string[];
  categoryId: string;
  privacyStatus?: string; // 'public', 'unlisted', 'private'
  duration?: string; // ISO 8601 duration format (e.g., "PT4M13S")
  viewCount?: string;
  likeCount?: string;
  publishedAt?: string; // ISO 8601 date format
}

export type AppIconName =
  | 'analytics'
  | 'article'
  | 'award'
  | 'bolt'
  | 'bot'
  | 'camera'
  | 'check'
  | 'clipboard'
  | 'clipboardCopy'
  | 'close'
  | 'cloudUpload'
  | 'document'
  | 'download'
  | 'gallery'
  | 'home'
  | 'hourglass'
  | 'idea'
  | 'image'
  | 'info'
  | 'list'
  | 'mapPin'
  | 'notepad'
  | 'paperclip'
  | 'pen'
  | 'refresh'
  | 'rocket'
  | 'search'
  | 'shield'
  | 'sparkles'
  | 'tag'
  | 'target'
  | 'timer'
  | 'traffic'
  | 'trash'
  | 'trophy'
  | 'video'
  | 'wand'
  | 'fileImage';

export interface ProgressMessage {
  icon: AppIconName;
  text: string;
}

export type ProgressCallback = (message: ProgressMessage) => void;

// 文章生成相關型別
export interface Screenshot {
  timestamp_seconds: string; // 格式：mm:ss
  reason_for_screenshot: string;
}

export interface ArticleContent {
  titleA: string;
  titleB: string;
  titleC: string;
  article_text: string;
  seo_description: string;
  screenshots: Screenshot[];
}

export interface ArticleGenerationResult {
  titleA: string;
  titleB: string;
  titleC: string;
  article: string;
  seo_description: string;
  image_urls: string[][]; // 二維陣列，每個時間點有 3 張圖片
  screenshots: Screenshot[];
  needsScreenshots?: boolean; // 標記是否需要截圖（Render 環境）
  videoId?: string; // 影片 ID，用於截圖
}
