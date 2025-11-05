/**
 * 任務輪詢服務
 * 用於處理異步任務的狀態查詢和結果獲取
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface TaskStatus {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  progressMessage: string;
  result: any | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PollingOptions {
  interval?: number; // 輪詢間隔（毫秒），預設 2000ms
  timeout?: number;  // 超時時間（毫秒），預設 10分鐘
  onProgress?: (progress: number, message: string) => void; // 進度回調
}

/**
 * 查詢單個任務的狀態
 * @param taskId - 任務 ID
 * @returns 任務狀態
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Task not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to get task status');
  }

  return await response.json();
}

/**
 * 輪詢任務直到完成
 * @param taskId - 任務 ID
 * @param options - 輪詢選項
 * @returns 任務結果
 */
export async function pollTaskUntilComplete<T = any>(
  taskId: string,
  options: PollingOptions = {}
): Promise<T> {
  const {
    interval = 2000,
    timeout = 10 * 60 * 1000, // 預設 10 分鐘
    onProgress
  } = options;

  const startTime = Date.now();
  let lastProgress = -1;

  while (true) {
    // 檢查超時
    if (Date.now() - startTime > timeout) {
      throw new Error('Task polling timeout');
    }

    try {
      const status = await getTaskStatus(taskId);

      // 更新進度（只有當進度變化時才回調）
      if (onProgress && status.progress !== lastProgress) {
        onProgress(status.progress, status.progressMessage);
        lastProgress = status.progress;
      }

      // 檢查任務狀態
      if (status.status === 'completed') {
        console.log(`[TaskPolling] Task ${taskId} completed successfully`);
        return status.result;
      }

      if (status.status === 'failed') {
        console.error(`[TaskPolling] Task ${taskId} failed:`, status.error);
        throw new Error(status.error || 'Task failed');
      }

      // 任務還在進行中，等待後繼續輪詢
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      // 如果是 404 錯誤，說明任務可能已經被清理
      if (error instanceof Error && error.message === 'Task not found') {
        throw new Error('Task not found or has been cleaned up');
      }
      // 其他錯誤，重新拋出
      throw error;
    }
  }
}

/**
 * 取消任務
 * @param taskId - 任務 ID
 */
export async function cancelTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/task/${taskId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel task');
  }

  console.log(`[TaskPolling] Task ${taskId} cancelled`);
}

/**
 * 使用異步任務模式執行操作
 * @param createTaskFn - 創建任務的函數，返回 taskId
 * @param options - 輪詢選項
 * @returns 任務結果
 */
export async function executeAsyncTask<T = any>(
  createTaskFn: () => Promise<{ taskId: string }>,
  options: PollingOptions = {}
): Promise<T> {
  // 創建任務
  const { taskId } = await createTaskFn();
  console.log(`[TaskPolling] Task created: ${taskId}`);

  // 輪詢直到完成
  try {
    return await pollTaskUntilComplete<T>(taskId, options);
  } catch (error) {
    console.error(`[TaskPolling] Task ${taskId} error:`, error);
    throw error;
  }
}
