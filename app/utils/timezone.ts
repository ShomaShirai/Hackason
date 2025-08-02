/**
 * タイムゾーン関連のユーティリティ
 * データベースはUTCで保存、表示時はJSTに変換
 */

const JAPAN_TIMEZONE = 'Asia/Tokyo';

/**
 * JST日時文字列をUTC Dateオブジェクトに変換
 * @param dateStr - 日付文字列 (例: "2024-07-31")
 * @param timeStr - 時刻文字列 (例: "14:30")
 * @returns UTC Date オブジェクト
 */
export function jstToUtc(dateStr: string, timeStr?: string): Date {
  // JST時刻として解釈するための文字列を構築
  const jstDateStr = timeStr ? `${dateStr}T${timeStr}:00` : `${dateStr}T00:00:00`;
  
  // JSTタイムゾーンを明示的に指定して Date を作成
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: JAPAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // 一度JST形式でフォーマットしてからパース（ブラウザ/Node.js互換性のため）
  const tempDate = new Date(jstDateStr);
  const parts = formatter.formatToParts(tempDate);
  
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // JSTオフセット（+9時間）を考慮してUTC時刻を計算
  const utcDate = new Date(Date.UTC(year, month, day, hour - 9, minute, second));
  
  return utcDate;
}

/**
 * UTC DateオブジェクトをJST日付文字列に変換
 * @param date - UTC Date オブジェクト
 * @returns JST日付文字列 (例: "2024-07-31")
 */
export function utcToJstDateString(date: Date | string | null | undefined): string {
  if (!date) {return '';}
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {return '';}
  
  // JSTで年月日を取得
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: JAPAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * UTC DateオブジェクトをJST時刻文字列に変換
 * @param date - UTC Date オブジェクト
 * @returns JST時刻文字列 (例: "14:30")
 */
export function utcToJstTimeString(date: Date | string | null | undefined): string {
  if (!date) {return '';}
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {return '';}
  
  return d.toLocaleTimeString('ja-JP', {
    timeZone: JAPAN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 現在のJST日付を取得
 * @returns JST日付文字列 (例: "2024-07-31")
 */
export function getCurrentJstDate(): string {
  return utcToJstDateString(new Date());
}

/**
 * 日付がJSTで今日かどうかを判定
 * @param date - 判定する日付
 * @returns 今日ならtrue
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = getCurrentJstDate();
  const targetDate = utcToJstDateString(d);
  return today === targetDate;
}

/**
 * タイムゾーン設定を取得（将来的な拡張用）
 */
export function getTimezone(): string {
  return JAPAN_TIMEZONE;
}