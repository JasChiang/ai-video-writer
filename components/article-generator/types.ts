export interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  displayName: string;
  sizeBytes: number;
}

export type NotionStatus =
  | { type: 'success'; message: string; url?: string }
  | { type: 'error'; message: string; url?: string };

export interface TemplateOption {
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
