/**
 * 簡單的內存任務隊列系統
 * 解決手機端長時間請求被中斷的問題
 */

// 任務狀態
export const TaskStatus = {
  PENDING: 'pending',     // 等待執行
  PROCESSING: 'processing', // 執行中
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed'          // 失敗
};

// 任務存儲（內存版本）
const tasks = new Map();

// 自動清理已完成任務的時間（30分鐘）
const TASK_RETENTION_MS = 30 * 60 * 1000;

/**
 * 創建新任務
 * @param {string} taskType - 任務類型
 * @param {Object} params - 任務參數
 * @returns {string} taskId - 任務 ID
 */
export function createTask(taskType, params) {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  tasks.set(taskId, {
    id: taskId,
    type: taskType,
    status: TaskStatus.PENDING,
    params,
    progress: 0,
    progressMessage: '任務已建立，等待執行...',
    result: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null
  });

  console.log(`[TaskQueue] Created task: ${taskId} (type: ${taskType})`);
  return taskId;
}

/**
 * 獲取任務狀態
 * @param {string} taskId - 任務 ID
 * @returns {Object|null} 任務資訊
 */
export function getTask(taskId) {
  return tasks.get(taskId) || null;
}

/**
 * 更新任務進度
 * @param {string} taskId - 任務 ID
 * @param {number} progress - 進度百分比 (0-100)
 * @param {string} message - 進度訊息
 */
export function updateTaskProgress(taskId, progress, message) {
  const task = tasks.get(taskId);
  if (task) {
    task.progress = progress;
    task.progressMessage = message;
    task.updatedAt = Date.now();
    task.status = TaskStatus.PROCESSING;
    console.log(`[TaskQueue] Task ${taskId}: ${progress}% - ${message}`);
  }
}

/**
 * 標記任務為完成
 * @param {string} taskId - 任務 ID
 * @param {any} result - 任務結果
 */
export function completeTask(taskId, result) {
  const task = tasks.get(taskId);
  if (task) {
    task.status = TaskStatus.COMPLETED;
    task.progress = 100;
    task.progressMessage = '任務已完成';
    task.result = result;
    task.updatedAt = Date.now();
    task.completedAt = Date.now();
    console.log(`[TaskQueue] Task ${taskId} completed successfully`);

    // 設定自動清理
    setTimeout(() => {
      tasks.delete(taskId);
      console.log(`[TaskQueue] Task ${taskId} auto-cleaned after retention period`);
    }, TASK_RETENTION_MS);
  }
}

/**
 * 標記任務為失敗
 * @param {string} taskId - 任務 ID
 * @param {Error|string} error - 錯誤訊息
 */
export function failTask(taskId, error) {
  const task = tasks.get(taskId);
  if (task) {
    task.status = TaskStatus.FAILED;
    task.error = error instanceof Error ? error.message : error;
    task.updatedAt = Date.now();
    task.completedAt = Date.now();
    console.error(`[TaskQueue] Task ${taskId} failed:`, task.error);

    // 設定自動清理
    setTimeout(() => {
      tasks.delete(taskId);
      console.log(`[TaskQueue] Failed task ${taskId} auto-cleaned after retention period`);
    }, TASK_RETENTION_MS);
  }
}

/**
 * 執行任務（異步）
 * @param {string} taskId - 任務 ID
 * @param {Function} executor - 任務執行函數
 */
export async function executeTask(taskId, executor) {
  const task = tasks.get(taskId);
  if (!task) {
    console.error(`[TaskQueue] Task ${taskId} not found`);
    return;
  }

  try {
    task.status = TaskStatus.PROCESSING;
    task.updatedAt = Date.now();
    console.log(`[TaskQueue] Starting task execution: ${taskId}`);

    // 執行任務
    const result = await executor(taskId);

    // 任務完成
    completeTask(taskId, result);
  } catch (error) {
    console.error(`[TaskQueue] Task ${taskId} execution error:`, error);
    failTask(taskId, error);
  }
}

/**
 * 清理所有已完成的任務
 */
export function cleanupCompletedTasks() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [taskId, task] of tasks.entries()) {
    if (
      (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
      task.completedAt &&
      (now - task.completedAt > TASK_RETENTION_MS)
    ) {
      tasks.delete(taskId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[TaskQueue] Cleaned up ${cleanedCount} old tasks`);
  }
}

/**
 * 獲取所有任務（用於調試）
 */
export function getAllTasks() {
  return Array.from(tasks.values());
}

// 定期清理（每10分鐘）
setInterval(cleanupCompletedTasks, 10 * 60 * 1000);
