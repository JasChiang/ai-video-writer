import { Router } from 'express';
import {
  getQuotaSnapshot as getServerQuotaSnapshot,
  resetQuotaSnapshot as resetServerQuotaSnapshot,
} from '../services/server/quotaTracker.js';

export function createQuotaRouter() {
  const router = Router();

  // Quota debugging endpoints
  router.get('/server', (_req, res) => {
    try {
      const snapshot = getServerQuotaSnapshot();
      res.json(snapshot);
    } catch (error) {
      console.error('[Quota] Failed to fetch server quota snapshot:', error);
      res.status(500).json({
        error: 'FAILED_TO_FETCH_SERVER_QUOTA',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.post('/server/reset', (_req, res) => {
    try {
      resetServerQuotaSnapshot();
      res.json({ success: true });
    } catch (error) {
      console.error('[Quota] Failed to reset server quota snapshot:', error);
      res.status(500).json({
        error: 'FAILED_TO_RESET_SERVER_QUOTA',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
