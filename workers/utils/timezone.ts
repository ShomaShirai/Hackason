/**
 * バックエンド用タイムゾーンユーティリティ
 * データベースはUTCで保存、APIではJST⇔UTC変換
 */

/**
 * JST日時文字列をUTC Dateオブジェクトに変換
 * @param dateStr - 日付文字列 (例: "2024-07-31")
 * @param timeStr - 時刻文字列 (例: "14:30")
 * @returns UTC Date オブジェクト
 */
export function jstToUtc(dateStr: string, timeStr: string): Date {
  // JST時刻として解釈するための文字列を構築
  // 例: "2024-07-31 14:30" → "2024-07-31T14:30:00+09:00"
  const jstDateTimeStr = `${dateStr}T${timeStr}:00+09:00`;
  
  // Date オブジェクトは自動的にUTCに変換される
  return new Date(jstDateTimeStr);
}

/**
 * UTC DateオブジェクトをJST形式の日付文字列に変換
 * @param date - UTC Date オブジェクト
 * @returns JST日付文字列 (例: "2024-07-31")
 */
export function utcToJstDateString(date: Date): string {
  // UTCからJSTへのオフセット（+9時間）を適用
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * UTC DateオブジェクトをJST形式の時刻文字列に変換
 * @param date - UTC Date オブジェクト
 * @returns JST時刻文字列 (例: "14:30")
 */
export function utcToJstTimeString(date: Date): string {
  // UTCからJSTへのオフセット（+9時間）を適用
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * 現在のJST日付を取得
 * @returns JST日付文字列 (例: "2024-07-31")
 */
export function getCurrentJstDate(): string {
  return utcToJstDateString(new Date());
}

/**
 * 日付文字列をJSTの0時0分のUTC Dateオブジェクトに変換
 * @param dateStr - 日付文字列 (例: "2024-07-31")
 * @returns UTC Date オブジェクト（JSTの00:00:00を表す）
 */
export function jstDateToUtc(dateStr: string): Date {
  // JSTの00:00:00として扱う
  return jstToUtc(dateStr, '00:00');
}

/**
 * JSTの開始時刻・終了時刻からUTCのDateオブジェクトを生成
 * @param dateStr - 日付文字列
 * @param hour - 時（0-23）
 * @param minute - 分（0-59）
 * @returns UTC Date オブジェクト
 */
export function createJstDate(dateStr: string, hour: number, minute: number): Date {
  // JST時刻として文字列を構築
  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');
  const jstDateTimeStr = `${dateStr}T${hourStr}:${minuteStr}:00+09:00`;
  
  return new Date(jstDateTimeStr);
}