/**
 * 無視すべきパスの定義
 * これらのパスへのリクエストはReact Routerに渡さずに404を返す
 */

// 完全一致で無視するパス
export const EXACT_IGNORED_PATHS = [
  // Chrome DevTools関連
  '/.well-known/appspecific/com.chrome.devtools.json',

  // その他のブラウザ拡張関連
  '/favicon.ico',
  '/robots.txt',
];

// プレフィックスで無視するパス
export const PREFIX_IGNORED_PATHS = [
  // ブラウザ拡張やツール関連
  '/_chrome/',
  '/__/',

  // デバッグツール関連
  '/.well-known/devtools/',
];

/**
 * 指定されたパスが無視すべきパスかどうかを判定
 */
export function shouldIgnorePath(path: string): boolean {
  // 完全一致チェック
  if (EXACT_IGNORED_PATHS.includes(path)) {
    return true;
  }

  // プレフィックスチェック
  for (const prefix of PREFIX_IGNORED_PATHS) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}
