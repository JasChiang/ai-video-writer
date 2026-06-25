import type { ArticleGenerationResult, YouTubeVideo } from '../types';

export interface ArticleDraft {
  id: string;
  savedAt: string;
  video: Pick<YouTubeVideo, 'id' | 'title' | 'isUrlOnly'>;
  templateId: string;
  colorTheme: string;
  customPrompt: string;
  referenceUrls: string[];
  referenceVideos: string[];
  result: ArticleGenerationResult;
}

const MAX_DRAFTS = 20;
const DRAFTS_KEY_PREFIX = 'cockpit_drafts';
const USER_SUB_KEY = 'cockpit_user_sub';

function getDraftKey(): string {
  try {
    const sub = sessionStorage.getItem(USER_SUB_KEY);
    return sub ? `${DRAFTS_KEY_PREFIX}_${sub}` : DRAFTS_KEY_PREFIX;
  } catch {
    return DRAFTS_KEY_PREFIX;
  }
}

/** Call once after Google login with the access token to namespace drafts by account. */
export async function initUserSub(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  try {
    if (sessionStorage.getItem(USER_SUB_KEY)) return;
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const info = await res.json();
    if (info.sub) sessionStorage.setItem(USER_SUB_KEY, info.sub);
  } catch {}
}

export function loadDrafts(): ArticleDraft[] {
  try {
    const raw = localStorage.getItem(getDraftKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraft(
  video: Pick<YouTubeVideo, 'id' | 'title' | 'isUrlOnly'>,
  result: ArticleGenerationResult,
  templateId: string,
  colorTheme: string,
  customPrompt: string,
  referenceUrls: string[] = [],
  referenceVideos: string[] = []
): ArticleDraft {
  const drafts = loadDrafts();
  const id = `${video.id}_${Date.now()}`;
  const newDraft: ArticleDraft = {
    id,
    savedAt: new Date().toISOString(),
    video,
    templateId,
    colorTheme,
    customPrompt,
    referenceUrls,
    referenceVideos,
    result,
  };

  // Replace existing draft for the same video (one draft per video)
  const filtered = drafts.filter((d) => d.video.id !== video.id);
  filtered.unshift(newDraft);
  const trimmed = filtered.slice(0, MAX_DRAFTS);

  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(trimmed));
  } catch {
    // localStorage full — keep newest half and retry
    const half = trimmed.slice(0, Math.floor(MAX_DRAFTS / 2));
    try { localStorage.setItem(getDraftKey(), JSON.stringify(half)); } catch {}
  }

  return newDraft;
}

export function deleteDraft(id: string): void {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(drafts));
  } catch {}
}
