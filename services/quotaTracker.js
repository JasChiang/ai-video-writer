const trackerKey = Symbol.for('youtubeQuotaTracker.server');

function getTracker() {
  if (!globalThis[trackerKey]) {
    const state = {
      totals: new Map(),
      events: [],
    };

    globalThis[trackerKey] = {
      record(action, units, details = {}) {
        if (!Number.isFinite(units) || units <= 0) return;
        const current = state.totals.get(action) ?? 0;
        state.totals.set(action, current + units);
        state.events.push({
          action,
          units,
          timestamp: Date.now(),
          details,
        });
        if (process.env.NODE_ENV !== 'production') {
          console.debug(
            `[YouTube Quota][server] +${units} units via ${action}`,
            Object.keys(details).length ? details : ''
          );
        }
      },
      snapshot() {
        const totalsObj = {};
        let totalUnits = 0;
        for (const [action, units] of state.totals.entries()) {
          totalsObj[action] = units;
          totalUnits += units;
        }
        return {
          totals: totalsObj,
          events: [...state.events],
          totalUnits,
        };
      },
      reset() {
        state.totals.clear();
        state.events = [];
      },
    };
  }

  return globalThis[trackerKey];
}

export function recordQuota(action, units, details) {
  getTracker().record(action, units, details);
}

export function getQuotaSnapshot() {
  return getTracker().snapshot();
}

export function resetQuotaSnapshot() {
  getTracker().reset();
}
