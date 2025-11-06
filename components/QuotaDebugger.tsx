import React, { useEffect, useState, useCallback } from 'react';
import { getQuotaSnapshot, resetQuotaSnapshot } from '../utils/quotaTracker';

interface ServerQuotaSnapshot {
  totals: Record<string, number>;
  events: {
    action: string;
    units: number;
    timestamp: number;
    details?: Record<string, unknown>;
  }[];
  totalUnits: number;
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export function QuotaDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [clientSnapshot, setClientSnapshot] = useState(() => getQuotaSnapshot());
  const [serverSnapshot, setServerSnapshot] = useState<ServerQuotaSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchServerSnapshot = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      const res = await fetch(`${baseUrl}/api/quota/server`);
      if (!res.ok) {
        throw new Error(`Server quota fetch failed (${res.status})`);
      }
      const data = await res.json();
      setServerSnapshot(data);
    } catch (err: any) {
      console.error('Failed to load server quota snapshot:', err);
      setError(err.message ?? '取得伺服器配額資訊失敗');
    } finally {
      setIsFetching(false);
    }
  }, []);

  const refreshSnapshots = useCallback(() => {
    setClientSnapshot(getQuotaSnapshot());
    fetchServerSnapshot();
  }, [fetchServerSnapshot]);

  const handleReset = useCallback(async () => {
    resetQuotaSnapshot();
    setClientSnapshot(getQuotaSnapshot());
    try {
      const baseUrl = import.meta.env?.VITE_SERVER_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      await fetch(`${baseUrl}/api/quota/server/reset`, { method: 'POST' });
      await fetchServerSnapshot();
    } catch (err: any) {
      console.error('Failed to reset server quota snapshot:', err);
      setError(err.message ?? '無法重設伺服器配額統計');
    }
  }, [fetchServerSnapshot]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;
      if (ctrlOrMeta && event.shiftKey && event.code === 'KeyQ') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
  useEffect(() => {
    if (isOpen) {
      refreshSnapshots();
    }
  }, [isOpen, refreshSnapshots]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[900] inline-flex h-12 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        title="檢視 YouTube API 配額使用"
      >
        配額
      </button>
      {!isOpen ? null : (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[85vh] w-[min(960px,90vw)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">YouTube API 配額偵測面板</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshSnapshots}
              disabled={isFetching}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? '載入中…' : '重新整理'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-600 transition hover:bg-red-100"
            >
              重置統計
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              關閉
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 px-5 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <section className="flex flex-col rounded-xl border border-neutral-200">
            <header className="border-b border-neutral-200 bg-neutral-100/60 px-4 py-2 text-sm font-semibold text-neutral-700">
              前端（瀏覽器）統計
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <div className="rounded-lg bg-neutral-50 px-3 py-2">
                <span className="font-semibold text-neutral-900">總配額：</span>
                <span className="text-red-600">{clientSnapshot.totalUnits}</span> 單位
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">依動作統計</h3>
                <ul className="space-y-1">
                  {Object.entries(clientSnapshot.totals).map(([action, units]) => (
                    <li key={action} className="flex justify-between rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-neutral-100">
                      <span className="font-mono text-xs text-neutral-500">{action}</span>
                      <span className="font-semibold text-neutral-800">{units}</span>
                    </li>
                  ))}
                  {Object.keys(clientSnapshot.totals).length === 0 && (
                    <li className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-500">尚未有紀錄</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">事件紀錄</h3>
                <div className="space-y-2">
                  {clientSnapshot.events.slice(-20).reverse().map((event, index) => {
                    const detail = event.details as Record<string, any> | undefined;
                    return (
                      <div key={`${event.timestamp}-${index}`} className="rounded-lg border border-neutral-100 px-3 py-2 text-xs">
                        <div className="flex justify-between text-neutral-600">
                          <span className="font-semibold text-neutral-800">{event.action}</span>
                          <span className="text-red-600">+{event.units}</span>
                        </div>
                        <div className="mt-1 text-neutral-500">{formatTimestamp(event.timestamp)}</div>
                        {detail && (detail.trigger || detail.caller || detail.apiSource || detail.context) && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-neutral-500">
                            {detail.trigger && <span>觸發：{detail.trigger}</span>}
                            {detail.caller && <span>來源：{detail.caller}</span>}
                            {detail.apiSource && <span>API：{detail.apiSource}</span>}
                            {detail.context && <span>情境：{detail.context}</span>}
                          </div>
                        )}
                        {event.details && (
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-100">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {clientSnapshot.events.length === 0 && (
                    <div className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-500">尚未有事件</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-neutral-200">
            <header className="border-b border-neutral-200 bg-neutral-100/60 px-4 py-2 text-sm font-semibold text-neutral-700">
              後端（伺服器）統計
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <div className="rounded-lg bg-neutral-50 px-3 py-2">
                <span className="font-semibold text-neutral-900">總配額：</span>
                <span className="text-red-600">{serverSnapshot?.totalUnits ?? 0}</span> 單位
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">依動作統計</h3>
                <ul className="space-y-1">
                  {serverSnapshot && Object.entries(serverSnapshot.totals).map(([action, units]) => (
                    <li key={action} className="flex justify-between rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-neutral-100">
                      <span className="font-mono text-xs text-neutral-500">{action}</span>
                      <span className="font-semibold text-neutral-800">{units}</span>
                    </li>
                  ))}
                  {(!serverSnapshot || Object.keys(serverSnapshot.totals).length === 0) && (
                    <li className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-500">尚未有紀錄</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">最新事件</h3>
                <div className="space-y-2">
                  {serverSnapshot?.events?.slice(-20).reverse().map((event, index) => {
                    const detail = event.details as Record<string, any> | undefined;
                    return (
                      <div key={`${event.timestamp}-${index}`} className="rounded-lg border border-neutral-100 px-3 py-2 text-xs">
                        <div className="flex justify-between text-neutral-600">
                          <span className="font-semibold text-neutral-800">{event.action}</span>
                          <span className="text-red-600">+{event.units}</span>
                        </div>
                        <div className="mt-1 text-neutral-500">{formatTimestamp(event.timestamp)}</div>
                        {detail && (detail.trigger || detail.caller || detail.apiSource || detail.context) && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-neutral-500">
                            {detail.trigger && <span>觸發：{detail.trigger}</span>}
                            {detail.caller && <span>來源：{detail.caller}</span>}
                            {detail.apiSource && <span>API：{detail.apiSource}</span>}
                            {detail.context && <span>情境：{detail.context}</span>}
                          </div>
                        )}
                        {event.details && (
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-100">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {(!serverSnapshot || serverSnapshot.events.length === 0) && (
                    <div className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-500">尚未有事件</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
      )}
    </>
  );
}
