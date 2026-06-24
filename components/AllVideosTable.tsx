import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, RefreshCw, Loader2, SlidersHorizontal } from 'lucide-react';
import { youtubeService } from '../services/youtubeService';

declare const gapi: any;

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

// Analytics API 數據比 YT Studio 晚 1~3 天，最晚僅能查到「今天往前 3 天」。
const ANALYTICS_DATA_DELAY_DAYS = 3;
const LIFETIME_START = '2005-01-01'; // 累計模式用很早的起始日，等同「發佈至今」
const BATCH_SIZE = 200; // 每批用 filters 指定的影片 ID 數
const COLS_STORAGE_KEY = 'allVideos.visibleCols';

const getAnalyticsAvailableEndDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ANALYTICS_DATA_DELAY_DAYS);
  return date;
};

const formatDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type QuickRange = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom';

const getQuickRange = (range: QuickRange): { start: string; end: string } => {
  const today = new Date();
  const analyticsEnd = getAnalyticsAvailableEndDate();
  let end = new Date(analyticsEnd);
  let start = new Date(end);
  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 6);
      break;
    case '30d':
      start.setDate(end.getDate() - 29);
      break;
    case '90d':
      start.setDate(end.getDate() - 89);
      break;
    case 'this_month': {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end = endOfMonth > analyticsEnd ? analyticsEnd : endOfMonth;
      break;
    }
    case 'last_month': {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    }
    default:
      start.setDate(end.getDate() - 29);
  }
  return { start: formatDateString(start), end: formatDateString(end) };
};

const parseISO8601Duration = (iso: string): number => {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || '0', 10) * 3600 + parseInt(m[2] || '0', 10) * 60 + parseInt(m[3] || '0', 10);
};

const formatDuration = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds < 0) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatPublishDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const formatNumber = (n: number) => (n ?? 0).toLocaleString('en-US');

// 快取更新時間：ISO(UTC) → 台北時間（UTC+8）字串
const formatCacheTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
};

type Mode = 'period' | 'lifetime';
type ColKey =
  | 'views'
  | 'watchHours'
  | 'avgViewSeconds'
  | 'avgViewPercentage'
  | 'likes'
  | 'dislikes'
  | 'comments'
  | 'shares'
  | 'subsGained'
  | 'subsLost'
  | 'subsNet';
type SortKey = 'publishedAt' | ColKey;
type ColKind = 'num' | 'duration' | 'percent' | 'hours' | 'net';

interface VideoRow {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  watchMinutes: number | null;
  avgViewSeconds: number | null;
  avgViewPercentage: number | null;
  dislikes: number | null;
  shares: number | null;
  subsGained: number | null;
  subsLost: number | null;
}

const COLUMNS: { key: ColKey; label: string; kind: ColKind; default: boolean }[] = [
  { key: 'views', label: '觀看次數', kind: 'num', default: true },
  { key: 'watchHours', label: '觀看時間(小時)', kind: 'hours', default: false },
  { key: 'avgViewSeconds', label: '平均觀看時間', kind: 'duration', default: true },
  { key: 'avgViewPercentage', label: '平均觀看比例', kind: 'percent', default: true },
  { key: 'likes', label: '讚', kind: 'num', default: true },
  { key: 'dislikes', label: '不喜歡', kind: 'num', default: false },
  { key: 'comments', label: '留言', kind: 'num', default: true },
  { key: 'shares', label: '分享', kind: 'num', default: false },
  { key: 'subsGained', label: '訂閱增加', kind: 'num', default: false },
  { key: 'subsLost', label: '訂閱減少', kind: 'num', default: false },
  { key: 'subsNet', label: '淨訂閱', kind: 'net', default: false },
];

// 取某欄的數值（供排序與加總）
const colValue = (r: VideoRow, key: ColKey): number | null => {
  switch (key) {
    case 'views':
      return r.views;
    case 'watchHours':
      return r.watchMinutes; // 以分鐘排序
    case 'avgViewSeconds':
      return r.avgViewSeconds;
    case 'avgViewPercentage':
      return r.avgViewPercentage;
    case 'likes':
      return r.likes;
    case 'dislikes':
      return r.dislikes;
    case 'comments':
      return r.comments;
    case 'shares':
      return r.shares;
    case 'subsGained':
      return r.subsGained;
    case 'subsLost':
      return r.subsLost;
    case 'subsNet':
      return r.subsGained != null && r.subsLost != null ? r.subsGained - r.subsLost : null;
  }
};

const formatColValue = (kind: ColKind, v: number | null): string => {
  if (v == null) return '—';
  switch (kind) {
    case 'duration':
      return formatDuration(v);
    case 'percent':
      return `${v.toFixed(1)}%`;
    case 'hours':
      return formatNumber(Math.round(v / 60)); // 分鐘 → 小時
    case 'net':
      return (v > 0 ? '+' : '') + formatNumber(v);
    default:
      return formatNumber(v);
  }
};

interface Props {
  accessToken: string;
  channelId: string;
}

const loadVisibleCols = (): Set<ColKey> => {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as ColKey[];
      const valid = COLUMNS.map((c) => c.key);
      const filtered = arr.filter((k) => valid.includes(k));
      if (filtered.length) return new Set(filtered);
    }
  } catch {
    /* ignore */
  }
  return new Set(COLUMNS.filter((c) => c.default).map((c) => c.key));
};

export function AllVideosTable({ accessToken }: Props) {
  const [mode, setMode] = useState<Mode>('period');
  const [quickRange, setQuickRange] = useState<QuickRange>('30d');
  const initial = getQuickRange('30d');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(loadVisibleCols);
  const [showColPicker, setShowColPicker] = useState(false);

  const cacheRef = useRef<Record<string, any> | null>(null);

  const queryAnalytics = async (params: Record<string, string>) => {
    const response = await gapi.client.request({
      path: 'https://youtubeanalytics.googleapis.com/v2/reports',
      method: 'GET',
      params,
    });
    return response.result;
  };

  const loadCache = async (): Promise<Record<string, any>> => {
    if (cacheRef.current) return cacheRef.current;
    const res = await fetch(`${API_BASE_URL}/video-cache/search?query=&maxResults=10000`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('無法載入影片快取（請先執行快取更新）');
    const data = await res.json();
    setCacheUpdatedAt(data.cacheUpdatedAt || null);
    const map: Record<string, any> = {};
    (data.videos || []).forEach((v: any) => {
      const id = v.videoId || v.id;
      if (id) map[id] = v;
    });
    cacheRef.current = map;
    return map;
  };

  // 用 filters=video==<ids> 分批查 Analytics（平行 + 進度回報）。
  // 此「指定影片」報表支援所有指標、不受 200 上限。
  const fetchAnalyticsAll = async (
    start: string,
    end: string,
    videoIds: string[],
    onProgress: (done: number, total: number) => void
  ): Promise<Record<string, any[]>> => {
    const batches: string[][] = [];
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) batches.push(videoIds.slice(i, i + BATCH_SIZE));
    const byId: Record<string, any[]> = {};
    let done = 0;
    onProgress(0, batches.length);
    const CONCURRENCY = 5; // 每波最多 5 批，避免一次打太多撞速率限制
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const wave = batches.slice(i, i + CONCURRENCY);
      await Promise.all(
        wave.map(async (batch) => {
          try {
            const result = await queryAnalytics({
              ids: 'channel==MINE',
              startDate: start,
              endDate: end,
              // 欄位順序：[video, views, estimatedMinutesWatched, averageViewDuration,
              //   averageViewPercentage, likes, dislikes, comments, shares,
              //   subscribersGained, subscribersLost]
              metrics:
                'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained,subscribersLost',
              dimensions: 'video',
              filters: `video==${batch.join(',')}`,
              maxResults: String(BATCH_SIZE),
            });
            (result?.rows || []).forEach((r: any[]) => {
              byId[r[0]] = r;
            });
          } catch (e) {
            // 單批失敗不影響其他批（該批影片以 0/— 顯示）
            console.warn('[AllVideos] 批次查詢失敗:', e);
          }
          done++;
          onProgress(done, batches.length);
        })
      );
    }
    return byId;
  };

  const buildRows = async () => {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      cacheRef.current = null; // 每次「取得數據」重抓快取，避免顯示舊資料
      const cache = await loadCache();
      const allVideos = Object.values(cache);
      const ids = allVideos.map((v: any) => v.videoId || v.id).filter(Boolean);

      // 累計模式：用很早的起始日（發佈至今）；期間模式：用選的日期範圍
      const [start, end] =
        mode === 'lifetime' ? [LIFETIME_START, maxSelectableDate] : [startDate, endDate];

      const analyticsById = await fetchAnalyticsAll(start, end, ids, (d, t) => setProgress({ done: d, total: t }));

      const fromCacheCounts = mode === 'lifetime'; // 累計模式觀看/讚/留言用快取的權威總數
      const result: VideoRow[] = allVideos.map((v: any) => {
        const id = v.videoId || v.id;
        const a = analyticsById[id];
        return {
          videoId: id,
          title: v.title || id,
          thumbnail: v.thumbnail || v.thumbnailUrl || '',
          publishedAt: v.publishedAt || '',
          durationSeconds: parseISO8601Duration(v.duration || ''),
          views: fromCacheCounts ? v.viewCount || 0 : a ? parseInt(a[1]) || 0 : 0,
          likes: fromCacheCounts ? v.likeCount || 0 : a ? parseInt(a[5]) || 0 : 0,
          comments: fromCacheCounts ? v.commentCount || 0 : a ? parseInt(a[7]) || 0 : 0,
          watchMinutes: a ? parseInt(a[2]) || 0 : null,
          avgViewSeconds: a ? Math.round(parseFloat(a[3]) || 0) : null,
          avgViewPercentage: a ? parseFloat(a[4]) || 0 : null,
          dislikes: a ? parseInt(a[6]) || 0 : null,
          shares: a ? parseInt(a[8]) || 0 : null,
          subsGained: a ? parseInt(a[9]) || 0 : null,
          subsLost: a ? parseInt(a[10]) || 0 : null,
        };
      });
      setRows(result);
      setLoadedOnce(true);
    } catch (err: any) {
      console.error('[AllVideos] 載入失敗:', err);
      if (err?.result?.error?.code === 401) {
        setError('YouTube 驗證過期，請重新登入後再試。');
      } else {
        const apiMsg = err?.result?.error?.message || err?.message;
        setError(apiMsg ? `載入失敗：${apiMsg}` : '載入失敗，請稍後再試。');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range !== 'custom') {
      const r = getQuickRange(range);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  // 不自動載入：僅在使用者按「取得數據」時才查詢

  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const cols = useMemo(() => COLUMNS.filter((c) => visibleCols.has(c.key)), [visibleCols]);

  // 排序
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === 'publishedAt') {
        av = new Date(a.publishedAt).getTime() || 0;
        bv = new Date(b.publishedAt).getTime() || 0;
      } else {
        av = colValue(a, sortKey) ?? -1;
        bv = colValue(b, sortKey) ?? -1;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sortedRows.filter((r) => r.title.toLowerCase().includes(q)) : sortedRows;
  }, [sortedRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, mode]);

  // 總計：一般欄位加總；平均觀看時間/比例以觀看數加權
  const totals = useMemo(() => {
    const sums: Partial<Record<ColKey, number>> = {};
    let wViews = 0;
    let wDur = 0;
    let wPct = 0;
    filteredRows.forEach((r) => {
      COLUMNS.forEach((c) => {
        if (c.kind === 'duration' || c.kind === 'percent') return;
        const v = colValue(r, c.key);
        if (v == null) return;
        sums[c.key] = (sums[c.key] || 0) + v;
      });
      if (r.avgViewSeconds != null && r.avgViewPercentage != null && r.views > 0) {
        wViews += r.views;
        wDur += r.avgViewSeconds * r.views;
        wPct += r.avgViewPercentage * r.views;
      }
    });
    return {
      count: filteredRows.length,
      sums,
      avgViewSeconds: wViews > 0 ? Math.round(wDur / wViews) : null,
      avgViewPercentage: wViews > 0 ? wPct / wViews : null,
    };
  }, [filteredRows]);

  const colTotal = (c: { key: ColKey; kind: ColKind }): string => {
    if (c.kind === 'duration') return totals.avgViewSeconds != null ? formatDuration(totals.avgViewSeconds) : '—';
    if (c.kind === 'percent') return totals.avgViewPercentage != null ? `${totals.avgViewPercentage.toFixed(1)}%` : '—';
    return formatColValue(c.kind, totals.sums[c.key] ?? 0);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className="px-3 py-3 font-semibold text-[#606060] cursor-pointer select-none hover:text-[#0F0F0F] whitespace-nowrap text-right"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k &&
          (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)}
      </span>
    </th>
  );

  const isPeriod = mode === 'period';
  const colCount = 2 + cols.length; // 內容 + 發布日期 + 指標欄

  // 日期鎖定：不可選超過「可查詢日」（今天 −3 天）
  const analyticsAvailableDate = getAnalyticsAvailableEndDate();
  const maxSelectableDate = formatDateString(analyticsAvailableDate);
  const _today = new Date();
  const startOfCurrentMonth = new Date(_today.getFullYear(), _today.getMonth(), 1);
  const endOfLastMonth = new Date(_today.getFullYear(), _today.getMonth(), 0);
  const isQuickDisabled = (r: QuickRange) => {
    if (r === 'this_month') return analyticsAvailableDate < startOfCurrentMonth;
    if (r === 'last_month') return analyticsAvailableDate < endOfLastMonth;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* 快取說明 */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] rounded-xl px-4 py-2.5 text-sm">
        ℹ️ 影片清單來自<strong>每日更新的快取</strong>
        {cacheUpdatedAt && `（更新於 ${formatCacheTime(cacheUpdatedAt)}，台灣時間）`}
        ，當天剛上傳的影片可能尚未出現。
      </div>

      {/* 控制列 */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#0F0F0F] mr-1">數據模式</span>
          <button
            onClick={() => setMode('period')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isPeriod ? 'bg-[#FF0000] text-white' : 'bg-[#F5F5F5] text-[#606060] hover:bg-[#FFF5F5]'
            }`}
          >
            期間數據
          </button>
          <button
            onClick={() => setMode('lifetime')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !isPeriod ? 'bg-[#FF0000] text-white' : 'bg-[#F5F5F5] text-[#606060] hover:bg-[#FFF5F5]'
            }`}
          >
            發佈至今累計
          </button>
          <span className="text-xs text-[#909090] ml-1">
            {isPeriod ? '所選期間內產生的數據（對齊 YouTube Studio）' : '影片發佈至今的累計數據'}
          </span>
        </div>

        {isPeriod && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#0F0F0F] mr-1">日期範圍</span>
            {([
              ['7d', '過去 7 天'],
              ['30d', '過去 30 天'],
              ['90d', '過去 90 天'],
              ['this_month', '本月'],
              ['last_month', '上月'],
            ] as [QuickRange, string][]).map(([key, label]) => {
              const disabled = isQuickDisabled(key);
              return (
                <button
                  key={key}
                  onClick={() => !disabled && applyQuickRange(key)}
                  disabled={disabled}
                  title={disabled ? '此區間尚無可查詢的數據（受 API 資料延遲限制）' : ''}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    disabled
                      ? 'bg-[#F5F5F5] text-[#C5C5C5] cursor-not-allowed'
                      : quickRange === key
                        ? 'bg-[#0F0F0F] text-white'
                        : 'bg-[#F5F5F5] text-[#606060] hover:bg-[#E5E5E5]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <input
              type="date"
              value={startDate}
              max={maxSelectableDate}
              onChange={(e) => {
                setQuickRange('custom');
                setStartDate(e.target.value);
              }}
              className="px-2 py-1.5 rounded-lg border border-[#E5E5E5] text-sm"
            />
            <span className="text-[#909090]">~</span>
            <input
              type="date"
              value={endDate}
              max={maxSelectableDate}
              onChange={(e) => {
                setQuickRange('custom');
                setEndDate(e.target.value);
              }}
              className="px-2 py-1.5 rounded-lg border border-[#E5E5E5] text-sm"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={buildRows}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF0000] text-white text-sm font-semibold hover:bg-[#CC0000] disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? '載入中…' : '取得數據'}
          </button>
          {isPeriod && (
            <span className="text-xs text-[#909090]">
              資料延遲：Analytics 比 YouTube Studio 晚 1~3 天，最晚可查到 {maxSelectableDate}
            </span>
          )}
        </div>

        {/* 抓取進度條 */}
        {loading && progress.total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0000] transition-all duration-200"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-[#909090]">
              查詢 Analytics 中… {progress.done}/{progress.total} 批
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#FFF5F5] border border-[#FFD5D5] text-[#CC0000] rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0F0F0] flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#606060]">
            共 <strong className="text-[#0F0F0F]">{formatNumber(totals.count)}</strong> 支影片
            {search.trim() && '（符合搜尋）'}
            {isPeriod && !search.trim() && '（含期間 0 觀看者）'}
          </span>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!loadedOnce}
              placeholder={loadedOnce ? '搜尋標題…' : '先按「取得數據」載入'}
              title={loadedOnce ? '' : '請先按「取得數據」載入影片清單，再進行搜尋'}
              className="px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-sm w-48 disabled:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:text-[#B0B0B0]"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-[#E5E5E5] text-sm bg-white"
              title="每頁筆數"
            >
              <option value={50}>每頁 50</option>
              <option value={100}>每頁 100</option>
              <option value={200}>每頁 200</option>
            </select>
            {/* 欄位勾選器 */}
            <div className="relative">
              <button
                onClick={() => setShowColPicker((s) => !s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-sm text-[#606060] hover:bg-[#F5F5F5]"
              >
                <SlidersHorizontal className="w-4 h-4" />
                欄位
              </button>
              {showColPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)} />
                  <div className="absolute right-0 mt-1 z-20 w-44 bg-white border border-[#E5E5E5] rounded-xl shadow-lg p-2">
                    {COLUMNS.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F5F5F5] cursor-pointer text-sm text-[#0F0F0F]"
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols.has(c.key)}
                          onChange={() => toggleCol(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0] text-left">
                <th className="px-3 py-3 font-semibold text-[#606060]">內容</th>
                <SortHeader k="publishedAt" label="發布日期" />
                {cols.map((c) => (
                  <SortHeader key={c.key} k={c.key} label={c.label} />
                ))}
              </tr>
            </thead>
            <tbody>
              {loadedOnce && rows.length > 0 && (
                <tr className="border-b border-[#F0F0F0] bg-[#FBFBFB] font-semibold">
                  <td className="px-3 py-3 text-[#0F0F0F]">總計</td>
                  <td className="px-3 py-3 text-[#909090]">—</td>
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-right text-[#0F0F0F]">
                      {colTotal(c)}
                    </td>
                  ))}
                </tr>
              )}

              {pageRows.map((r) => (
                <tr key={r.videoId} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                  <td className="px-3 py-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${r.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 group"
                    >
                      <div className="relative flex-shrink-0">
                        {r.thumbnail ? (
                          <img
                            src={r.thumbnail}
                            alt=""
                            loading="lazy"
                            className="w-24 h-[54px] object-cover rounded-md bg-[#F0F0F0]"
                          />
                        ) : (
                          <div className="w-24 h-[54px] rounded-md bg-[#F0F0F0]" />
                        )}
                        {r.durationSeconds > 0 && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                            {formatDuration(r.durationSeconds)}
                          </span>
                        )}
                      </div>
                      <span className="text-[#0F0F0F] group-hover:text-[#FF0000] line-clamp-2 max-w-[320px]">
                        {r.title}
                      </span>
                    </a>
                  </td>
                  <td className="px-3 py-2 text-[#606060] whitespace-nowrap">{formatPublishDate(r.publishedAt)}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right text-[#606060]">
                      {formatColValue(c.kind, colValue(r, c.key))}
                    </td>
                  ))}
                </tr>
              ))}

              {!loadedOnce && !loading && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-10 text-center text-[#909090]">
                    按上方「取得數據」開始載入影片清單。
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-10 text-center text-[#909090]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {progress.total > 0 ? `查詢 Analytics 中… ${progress.done}/${progress.total} 批` : '載入快取中…'}
                    </span>
                  </td>
                </tr>
              )}

              {loadedOnce && rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-10 text-center text-[#909090]">
                    沒有影片資料。請確認已執行影片快取更新（`npm run update-cache`）。
                  </td>
                </tr>
              )}

              {loadedOnce && rows.length > 0 && filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-10 text-center text-[#909090]">
                    沒有符合「{search}」的影片。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > pageSize && (
          <div className="px-4 py-3 border-t border-[#F0F0F0] flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-[#F5F5F5] text-[#606060] disabled:opacity-40 hover:bg-[#E5E5E5]"
            >
              上一頁
            </button>
            <span className="text-[#606060]">
              第 {page} / {totalPages} 頁
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-[#F5F5F5] text-[#606060] disabled:opacity-40 hover:bg-[#E5E5E5]"
            >
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
