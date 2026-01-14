import { Router } from 'express';
import * as taskQueue from '../services/server/taskQueue.js';

export function createTasksRouter() {
  const router = Router();

  /**
   * 獲取任務狀態
   * GET /api/task/:taskId
   */
  router.get('/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = taskQueue.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  });

  /**
   * 刪除任務
   * DELETE /api/task/:taskId
   */
  router.delete('/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = taskQueue.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // taskQueue 會自動清理已完成的任務，不需要手動刪除
    res.json({
      success: true,
      message: 'Tasks are automatically cleaned up after completion. No manual deletion needed.',
    });
  });

  return router;
}
