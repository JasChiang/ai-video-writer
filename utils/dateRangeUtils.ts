/**
 * 日期範圍工具函數
 * 支援相對日期（去年、今年、上個月等）和絕對日期（2024、202410 等）
 * 使用 GMT+8 時區（台北時區）
 */

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysPerMonth[month - 1];
}

/**
 * 獲取 GMT+8 時區的當前日期
 */
function getTodayGMT8(): Date {
  // 獲取 GMT+8 時區的當前時間
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt8Time = new Date(utc + (3600000 * 8));
  return gmt8Time;
}

export type RelativeDateType =
  | 'last7days'      // 過去 7 天
  | 'last30days'     // 過去 30 天
  | 'thisYear'       // 今年
  | 'lastYear'       // 去年
  | 'thisMonth'      // 本月
  | 'lastMonth'      // 上個月（最後一次有完整數據的月份）
  | 'twoMonthsAgo'   // 上上個月
  | 'lastMonthLastYear'; // 去年上個月

/**
 * 獲取上個月（最後一次有完整數據的月份）
 * 如果當月已經結束（今天是下個月），則返回上個月
 * 如果當月還未結束，則返回上上個月
 * 使用 GMT+8 時區
 */
function getLastCompleteMonth(): Date {
  const today = getTodayGMT8();
  const currentDay = today.getDate();

  // 如果今天是當月的最後一天，檢查明天是否是下個月
  const tomorrow = new Date(today);
  tomorrow.setDate(currentDay + 1);

  if (tomorrow.getMonth() !== today.getMonth()) {
    // 今天是當月最後一天，上個月已有完整數據
    return new Date(today.getFullYear(), today.getMonth() - 1, 1);
  } else {
    // 當月還未結束，返回上上個月
    return new Date(today.getFullYear(), today.getMonth() - 2, 1);
  }
}

/**
 * 獲取相對日期範圍（使用 GMT+8 時區）
 */
export function getRelativeDateRange(type: RelativeDateType): DateRange {
  const today = getTodayGMT8();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11

  switch (type) {
    case 'last7days': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      return {
        startDate: formatDate(startDate),
        endDate: formatDate(today)
      };
    }

    case 'last30days': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      return {
        startDate: formatDate(startDate),
        endDate: formatDate(today)
      };
    }

    case 'thisYear': {
      return {
        startDate: `${year}-01-01`,
        endDate: formatDate(today)
      };
    }

    case 'lastYear': {
      return {
        startDate: `${year - 1}-01-01`,
        endDate: `${year - 1}-12-31`
      };
    }

    case 'thisMonth': {
      return {
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        endDate: formatDate(today)
      };
    }

    case 'lastMonth': {
      const lastMonth = getLastCompleteMonth();
      const lastMonthYear = lastMonth.getFullYear();
      const lastMonthNum = lastMonth.getMonth(); // 0-11
      const lastDayOfMonth = new Date(lastMonthYear, lastMonthNum + 1, 0).getDate();

      return {
        startDate: `${lastMonthYear}-${String(lastMonthNum + 1).padStart(2, '0')}-01`,
        endDate: `${lastMonthYear}-${String(lastMonthNum + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      };
    }

    case 'twoMonthsAgo': {
      const twoMonthsAgo = new Date(year, month - 2, 1);
      const twoMonthsAgoYear = twoMonthsAgo.getFullYear();
      const twoMonthsAgoMonth = twoMonthsAgo.getMonth();
      const lastDayOfMonth = new Date(twoMonthsAgoYear, twoMonthsAgoMonth + 1, 0).getDate();

      return {
        startDate: `${twoMonthsAgoYear}-${String(twoMonthsAgoMonth + 1).padStart(2, '0')}-01`,
        endDate: `${twoMonthsAgoYear}-${String(twoMonthsAgoMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      };
    }

    case 'lastMonthLastYear': {
      const lastMonth = getLastCompleteMonth();
      const lastMonthNum = lastMonth.getMonth();
      const lastYearYear = year - 1;
      const lastDayOfMonth = new Date(lastYearYear, lastMonthNum + 1, 0).getDate();

      return {
        startDate: `${lastYearYear}-${String(lastMonthNum + 1).padStart(2, '0')}-01`,
        endDate: `${lastYearYear}-${String(lastMonthNum + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      };
    }

    default:
      throw new Error(`Unknown relative date type: ${type}`);
  }
}

/**
 * 解析絕對日期字符串
 * 支援格式：
 * - YYYY (2024) - 整年
 * - YYYYMM (202410) - 整月
 * - YYYY-MM (2024-10) - 整月
 */
export function parseAbsoluteDateRange(dateStr: string): DateRange | null {
  // 移除空格
  dateStr = dateStr.trim();

  // YYYY 格式
  if (/^\d{4}$/.test(dateStr)) {
    const year = parseInt(dateStr, 10);
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };
  }

  // YYYYMM 格式
  if (/^\d{6}$/.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);

    if (month < 1 || month > 12) {
      return null;
    }

    const lastDay = getDaysInMonth(year, month);
    return {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    };
  }

  // YYYY-MM 格式
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [yearStr, monthStr] = dateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (month < 1 || month > 12) {
      return null;
    }

    const lastDay = getDaysInMonth(year, month);
    return {
      startDate: `${year}-${monthStr}-01`,
      endDate: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
    };
  }

  return null;
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 獲取相對日期的顯示名稱
 */
export function getRelativeDateLabel(type: RelativeDateType): string {
  const labels: Record<RelativeDateType, string> = {
    last7days: '過去 7 天',
    last30days: '過去 30 天',
    thisYear: '今年',
    lastYear: '去年',
    thisMonth: '本月',
    lastMonth: '上個月',
    twoMonthsAgo: '上上個月',
    lastMonthLastYear: '去年上個月'
  };

  return labels[type];
}

/**
 * 解析日期配置（可以是相對日期或絕對日期）
 */
export function parseDateConfig(config: string): DateRange | null {
  // 檢查是否是相對日期
  if (isRelativeDateType(config)) {
    return getRelativeDateRange(config as RelativeDateType);
  }

  // 嘗試解析為絕對日期
  return parseAbsoluteDateRange(config);
}

/**
 * 檢查字符串是否是相對日期類型
 */
function isRelativeDateType(str: string): boolean {
  const types: RelativeDateType[] = [
    'last7days', 'last30days', 'thisYear', 'lastYear',
    'thisMonth', 'lastMonth', 'twoMonthsAgo', 'lastMonthLastYear'
  ];
  return types.includes(str as RelativeDateType);
}

/**
 * 獲取日期範圍的顯示標籤
 */
export function getDateRangeLabel(config: string): string {
  // 如果是相對日期，返回相對日期標籤
  if (isRelativeDateType(config)) {
    return getRelativeDateLabel(config as RelativeDateType);
  }

  // 如果是絕對日期，返回格式化的標籤
  if (/^\d{4}$/.test(config)) {
    return `${config} 年`;
  }

  if (/^\d{6}$/.test(config)) {
    const year = config.slice(0, 4);
    const month = config.slice(4, 6);
    return `${year}/${month}`;
  }

  if (/^\d{4}-\d{2}$/.test(config)) {
    return config.replace('-', '/');
  }

  return config;
}
