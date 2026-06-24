import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, RefreshCw, Loader2 } from 'lucide-react';
import { youtubeService } from '../services/youtubeService';

declare const gapi: any;

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

// 與 ChannelDashboard 一致：Analytics API 數據比 YT Studio 晚 1~3 天，
// 實際最晚僅能查到「今天往前 3 天」。
const ANALYTICS_DATA_DELAY_DAYS = 3;

const getAnalyticsAvailableEndDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ANALYTICS_DATA_DELAY_DAYS);
  return date;
};

// 本地時區格式化，避免 UTC 偏移把日期算錯一天
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

// ISO 8601（PT1H2M3S）→ 秒
const parseISO8601Duration = (iso: string): number => {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
};

// 秒 → M:SS 或 H:MM:SS
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

type Mode = 'period' | 'lifetime';

interface VideoRow {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  avgViewSeconds: number | null; // 期間限定
  avgViewPercentage: number | null; // 期間限定
}

type SortKey = 'publishedAt' | 'views' | 'avgViewSeconds' | 'avgViewPercentage' | 'likes' | 'comments';

interface Props {
  accessToken: string;
  channelId: string;
}

const PAGE_SIZE = 50;

export function AllVideosTable({ accessToken, channelId }: Props) {
  const [mode, setMode] = useState<Mode>('period');
  const [quickRange, setQuickRange] = useState<QuickRange>('30d');
  const initial = getQuickRange('30d');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const cacheRef = useRef<Record<string, any> | null>(null);

  // gapi Analytics 查詢（與 ChannelDashboard 相同呼叫方式，token 由 youtubeService 全域設定）
  const queryAnalytics = async (params: Record<string, string>) => {
    const response = await gapi.client.request({
      path: 'https://youtubeanalytics.googleapis.com/v2/reports',
      method: 'GET',
      params,
    });
    return response.result;
  };

  // 載入全部影片快取（含發布日期、長度）
  const loadCache = async (): Promise<Record<string, any>> => {
    if (cacheRef.current) return cacheRef.current;
    const res = await fetch(`${API_BASE_URL}/video-cache/search?query=&maxResults=10000`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('無法載入影片快取（請先執行快取更新）');
    const data = await res.json();
    const map: Record<string, any> = {};
    (data.videos || []).forEach((v: any) => {
      const id = v.videoId || v.id;
      if (id) map[id] = v;
    });
    cacheRef.current = map;
    return map;
  };

  // 期間模式：分頁抓全部影片的 Analytics 數據
  const fetchAnalyticsAll = async (start: string, end: string): Promise<Record<string, any[]>> => {
    const byId: Record<string, any[]> = {};
    const pageSize = 200;
    let startIndex = 1;
    for (let p = 0; p < 50; p++) {
      const result = await queryAnalytics({
        ids: 'channel==MINE',
        startDate: start,
        endDate: end,
        // 已知可用的 video 報表組合（多加 averageViewDuration 會被 API 判為不支援的查詢）
        // 欄位順序：[video, views, averageViewPercentage, comments, likes, shares]
        metrics: 'views,averageViewPercentage,comments,likes,shares',
        dimensions: 'video',
        sort: '-views',
        maxResults: String(pageSize),
        startIndex: String(startIndex),
      });
      const rows: any[][] = result?.rows || [];
      rows.forEach((r) => {
        byId[r[0]] = r;
      });
      if (rows.length < pageSize) break;
      startIndex += pageSize;
    }
    return byId;
  };

  const buildRows = async () => {
    setLoading(true);
    setError(null);
    try {
      cacheRef.current = null; // 每次「取得數據」重抓快取，避免後端快取更新後顯示舊資料
      const cache = await loadCache();
      const allVideos = Object.values(cache);

      if (mode === 'lifetime') {
        // 發佈至今累計：直接用快取的總計（0 配額）
        const result: VideoRow[] = allVideos.map((v: any) => ({
          videoId: v.videoId || v.id,
          title: v.title || v.videoId,
          thumbnail: v.thumbnail || v.thumbnailUrl || '',
          publishedAt: v.publishedAt || '',
          durationSeconds: parseISO8601Duration(v.duration || ''),
          views: v.viewCount || 0,
          likes: v.likeCount || 0,
          comments: v.commentCount || 0,
          avgViewSeconds: null,
          avgViewPercentage: null,
        }));
        setRows(result);
      } else {
        // 期間模式：全部影片為底，疊上 Analytics 期間數據（無數據者顯示 0）
        const analyticsById = await fetchAnalyticsAll(startDate, endDate);
        const result: VideoRow[] = allVideos.map((v: any) => {
          const id = v.videoId || v.id;
          const a = analyticsById[id];
          const durationSeconds = parseISO8601Duration(v.duration || '');
          // 欄位順序：[video, views, averageViewPercentage, comments, likes, shares]
          const avgViewPercentage = a ? parseFloat(a[2]) || 0 : null;
          // 平均觀看時間 = 平均觀看比例 × 影片長度（API 不直接給此組合，改用快取長度推算）
          const avgViewSeconds =
            avgViewPercentage != null && durationSeconds > 0
              ? Math.round((avgViewPercentage / 100) * durationSeconds)
              : null;
          return {
            videoId: id,
            title: v.title || id,
            thumbnail: v.thumbnail || v.thumbnailUrl || '',
            publishedAt: v.publishedAt || '',
            durationSeconds,
            views: a ? parseInt(a[1]) || 0 : 0,
            avgViewSeconds,
            avgViewPercentage,
            likes: a ? parseInt(a[4]) || 0 : 0,
            comments: a ? parseInt(a[3]) || 0 : 0,
          };
        });
        setRows(result);
      }
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

  // 切換快速範圍
  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range !== 'custom') {
      const r = getQuickRange(range);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  // 不自動載入：僅在使用者按「取得數據」時才查詢（避免大頻道一切分頁就跑重查詢）

  // 排序後的列
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === 'publishedAt') {
        av = new Date(a.publishedAt).getTime() || 0;
        bv = new Date(b.publishedAt).getTime() || 0;
      } else {
        av = (a[sortKey] as number | null) ?? -1;
        bv = (b[sortKey] as number | null) ?? -1;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  // 總計（avg 欄位以觀看數加權平均，近似 YT Studio 總計列）
  const totals = useMemo(() => {
    let views = 0;
    let likes = 0;
    let comments = 0;
    let wDur = 0;
    let wPct = 0;
    let wViews = 0;
    rows.forEach((r) => {
      views += r.views;
      likes += r.likes;
      comments += r.comments;
      if (r.avgViewSeconds != null && r.avgViewPercentage != null && r.views > 0) {
        wDur += r.avgViewSeconds * r.views;
        wPct += r.avgViewPercentage * r.views;
        wViews += r.views;
      }
    });
    return {
      count: rows.length,
      views,
      likes,
      comments,
      avgViewSeconds: wViews > 0 ? Math.round(wDur / wViews) : null,
      avgViewPercentage: wViews > 0 ? wPct / wViews : null,
    };
  }, [rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortHeader = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-3 font-semibold text-[#606060] cursor-pointer select-none hover:text-[#0F0F0F] whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k &&
          (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)}
      </span>
    </th>
  );

  const isPeriod = mode === 'period';

  // 日期鎖定：不可選超過「可查詢日」（今天 −3 天），與原儀表板一致
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
      {/* 控制列：模式 + 日期 */}
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
            {isPeriod ? '觀看/觀看時間/比例為所選期間內產生（對齊 YouTube Studio）' : '觀看/按讚/留言為影片累計總數，0 配額'}
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
              資料延遲：Analytics 比 YouTube Studio 晚 1~3 天，最晚可查到 {formatDateString(getAnalyticsAvailableEndDate())}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-[#FFF5F5] border border-[#FFD5D5] text-[#CC0000] rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* 表格 */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0F0F0] flex items-center justify-between">
          <span className="text-sm text-[#606060]">
            共 <strong className="text-[#0F0F0F]">{formatNumber(totals.count)}</strong> 支影片
            {isPeriod && '（含期間 0 觀看者）'}
          </span>
          <span className="text-xs text-[#909090]">點欄位標題可排序</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0] text-left">
                <th className="px-3 py-3 font-semibold text-[#606060]">內容</th>
                <SortHeader k="publishedAt" label="發布日期" />
                <SortHeader k="views" label="觀看次數" className="text-right" />
                {isPeriod && <SortHeader k="avgViewSeconds" label="平均觀看時間" className="text-right" />}
                {isPeriod && <SortHeader k="avgViewPercentage" label="平均觀看比例" className="text-right" />}
                <SortHeader k="likes" label="按讚" className="text-right" />
                <SortHeader k="comments" label="留言" className="text-right" />
              </tr>
            </thead>
            <tbody>
              {/* 總計列 */}
              {loadedOnce && rows.length > 0 && (
                <tr className="border-b border-[#F0F0F0] bg-[#FBFBFB] font-semibold">
                  <td className="px-3 py-3 text-[#0F0F0F]">總計</td>
                  <td className="px-3 py-3 text-[#909090]">—</td>
                  <td className="px-3 py-3 text-right text-[#0F0F0F]">{formatNumber(totals.views)}</td>
                  {isPeriod && (
                    <td className="px-3 py-3 text-right text-[#0F0F0F]">
                      {totals.avgViewSeconds != null ? formatDuration(totals.avgViewSeconds) : '—'}
                    </td>
                  )}
                  {isPeriod && (
                    <td className="px-3 py-3 text-right text-[#0F0F0F]">
                      {totals.avgViewPercentage != null ? `${totals.avgViewPercentage.toFixed(1)}%` : '—'}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right text-[#0F0F0F]">{formatNumber(totals.likes)}</td>
                  <td className="px-3 py-3 text-right text-[#0F0F0F]">{formatNumber(totals.comments)}</td>
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
                          <img src={r.thumbnail} alt="" loading="lazy" className="w-24 h-[54px] object-cover rounded-md bg-[#F0F0F0]" />
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
                  <td className="px-3 py-2 text-right text-[#0F0F0F]">{formatNumber(r.views)}</td>
                  {isPeriod && (
                    <td className="px-3 py-2 text-right text-[#606060]">
                      {r.avgViewSeconds != null ? formatDuration(r.avgViewSeconds) : '—'}
                    </td>
                  )}
                  {isPeriod && (
                    <td className="px-3 py-2 text-right text-[#606060]">
                      {r.avgViewPercentage != null ? `${r.avgViewPercentage.toFixed(1)}%` : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-[#606060]">{formatNumber(r.likes)}</td>
                  <td className="px-3 py-2 text-right text-[#606060]">{formatNumber(r.comments)}</td>
                </tr>
              ))}

              {!loadedOnce && !loading && (
                <tr>
                  <td colSpan={isPeriod ? 7 : 5} className="px-3 py-10 text-center text-[#909090]">
                    按上方「取得數據」開始載入影片清單。
                  </td>
                </tr>
              )}

              {loadedOnce && rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={isPeriod ? 7 : 5} className="px-3 py-10 text-center text-[#909090]">
                    沒有影片資料。請確認已執行影片快取更新（`npm run update-cache`）。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁 */}
        {sortedRows.length > PAGE_SIZE && (
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
