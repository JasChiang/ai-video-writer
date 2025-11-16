/**
 * 任務管理器
 * 用於處理異步任務的創建、狀態更新和結果存儲
 */

import { v4 as uuidv4 } from 'uuid';

class TaskManager {
  constructor() {
    this.tasks = new Map();
    // 自動清理完成/失敗的任務（30分鐘後）
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 創建新任務
   * @param {string} type - 任務類型
   * @returns {string} 任務ID
   */
  createTask(type) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      type,
      status: 'pending',
      progress: 0,
      progressMessage: '任務已創建',
      result: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    console.log(`[TaskManager] Task created: ${taskId} (type: ${type})`);
    return taskId;
  }

  /**
   * 更新任務進度
   * @param {string} taskId - 任務ID
   * @param {number} progress - 進度 (0-100)
   * @param {string} message - 進度訊息
   */
  updateProgress(taskId, progress, message) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[TaskManager] Task not found: ${taskId}`);
      return;
    }

    task.progress = progress;
    task.progressMessage = message;
    task.updatedAt = Date.now();
    console.log(`[TaskManager] Task ${taskId} progress: ${progress}% - ${message}`);
  }

  /**
   * 標記任務為處理中
   * @param {string} taskId - 任務ID
   */
  markProcessing(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[TaskManager] Task not found: ${taskId}`);
      return;
    }

    task.status = 'processing';
    task.updatedAt = Date.now();
    console.log(`[TaskManager] Task ${taskId} is now processing`);
  }

  /**
   * 標記任務完成並存儲結果
   * @param {string} taskId - 任務ID
   * @param {any} result - 任務結果
   */
  completeTask(taskId, result) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[TaskManager] Task not found: ${taskId}`);
      return;
    }

    task.status = 'completed';
    task.progress = 100;
    task.progressMessage = '任務完成';
    task.result = result;
    task.updatedAt = Date.now();
    console.log(`[TaskManager] Task ${taskId} completed successfully`);
  }

  /**
   * 標記任務失敗
   * @param {string} taskId - 任務ID
   * @param {string} error - 錯誤訊息
   */
  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[TaskManager] Task not found: ${taskId}`);
      return;
    }

    task.status = 'failed';
    task.error = error;
    task.updatedAt = Date.now();
    console.error(`[TaskManager] Task ${taskId} failed:`, error);
  }

  /**
   * 獲取任務狀態
   * @param {string} taskId - 任務ID
   * @returns {object|null} 任務狀態
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 刪除任務
   * @param {string} taskId - 任務ID
   */
  deleteTask(taskId) {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      console.log(`[TaskManager] Task ${taskId} deleted`);
    }
    return deleted;
  }

  /**
   * 清理超過30分鐘的已完成/失敗任務
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30分鐘
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        now - task.updatedAt > maxAge
      ) {
        this.tasks.delete(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TaskManager] Cleaned up ${cleaned} old tasks`);
    }
  }

  /**
   * 執行異步任務
   * @param {string} type - 任務類型
   * @param {Function} taskFunction - 任務執行函數
   * @returns {string} 任務ID
   */
  async executeTask(type, taskFunction) {
    const taskId = this.createTask(type);

    // 異步執行任務
    setImmediate(async () => {
      try {
        this.markProcessing(taskId);
        const result = await taskFunction(taskId, this);
        this.completeTask(taskId, result);
      } catch (error) {
        this.failTask(taskId, error.message || error.toString());
      }
    });

    return taskId;
  }
}

// 創建單例實例
const taskManager = new TaskManager();

export default taskManager;
