/**
 * 將 ISO 8601 duration 格式轉換為可讀的時長
 * 例如：PT4M13S -> "4:13", PT1H2M3S -> "1:02:03"
 */
export function formatDuration(duration?: string): string {
  if (!duration) return '0:00';

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 將數字格式化為易讀的格式
 * 例如：1234567 -> "123 萬", 1234 -> "1,234"
 */
export function formatViewCount(count?: string): string {
  if (!count) return '0';

  const num = parseInt(count, 10);
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)} 億`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)} 萬`;
  }
  return num.toLocaleString('zh-TW');
}

/**
 * 將 ISO 8601 日期格式化為絕對日期
 * 例如：2024-01-15T10:30:00Z -> "2024/01/15"
 */
export function formatPublishedDate(dateString?: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 根據隱私狀態返回對應的標籤文字和顏色
 */
export function getPrivacyStatusBadge(status?: string): { text: string; color: string; bgColor: string } {
  switch (status) {
    case 'public':
      return { text: '公開', color: '#16A34A', bgColor: 'rgba(34, 197, 94, 0.1)' };
    case 'unlisted':
      return { text: '未列出', color: '#CA8A04', bgColor: 'rgba(234, 179, 8, 0.1)' };
    case 'private':
      return { text: '私人', color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.1)' };
    default:
      return { text: '未知', color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' };
  }
}
