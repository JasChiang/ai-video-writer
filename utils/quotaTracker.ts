type QuotaEvent = {
  action: string;
  units: number;
  timestamp: number;
  details?: Record<string, unknown>;
};

type QuotaSnapshot = {
  totals: Record<string, number>;
  events: QuotaEvent[];
  totalUnits: number;
};

class QuotaTracker {
  private totals = new Map<string, number>();
  private events: QuotaEvent[] = [];

  record(action: string, units: number, details?: Record<string, unknown>) {
    if (!Number.isFinite(units) || units <= 0) {
      return;
    }

    const current = this.totals.get(action) ?? 0;
    this.totals.set(action, current + units);
    this.events.push({
      action,
      units,
      timestamp: Date.now(),
      details,
    });

    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.debug(
        `[YouTube Quota] +${units} units via ${action}`,
        details ? JSON.stringify(details) : ''
      );
    }
  }

  snapshot(): QuotaSnapshot {
    const totalsObject: Record<string, number> = {};
    let totalUnits = 0;

    for (const [action, units] of this.totals.entries()) {
      totalsObject[action] = units;
      totalUnits += units;
    }

    return {
      totals: totalsObject,
      events: [...this.events],
      totalUnits,
    };
  }

  reset() {
    this.totals.clear();
    this.events = [];
  }
}

declare global {
  interface Window {
    __youtubeQuotaTracker?: {
      record: (action: string, units: number, details?: Record<string, unknown>) => void;
      snapshot: () => QuotaSnapshot;
      reset: () => void;
    };
  }
}

const globalTracker =
  (typeof window !== 'undefined' && window.__youtubeQuotaTracker) ||
  (() => {
    const tracker = new QuotaTracker();
    const api = {
      record: tracker.record.bind(tracker),
      snapshot: tracker.snapshot.bind(tracker),
      reset: tracker.reset.bind(tracker),
    };

    if (typeof window !== 'undefined') {
      window.__youtubeQuotaTracker = api;
    }

    return api;
  })();

export function recordQuota(
  action: string,
  units: number,
  details?: Record<string, unknown>
) {
  globalTracker.record(action, units, details);
}

export function getQuotaSnapshot(): QuotaSnapshot {
  return globalTracker.snapshot();
}

export function resetQuotaSnapshot() {
  globalTracker.reset();
}
