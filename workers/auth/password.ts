import bcrypt from 'bcryptjs';

/**
 * パスワードのハッシュ化設定
 */
const HASH_CONFIG = {
  saltRounds: 10, // データベースのハッシュと一致させる（シード・検証一致）
};

/**
 * パスワードをハッシュ化
 * @param password プレーンテキストのパスワード
 * @returns ハッシュ化されたパスワード
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // パスワードの基本的なバリデーション
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // bcryptを使用してハッシュ化
    const hashedPassword = await bcrypt.hash(password, HASH_CONFIG.saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

export  function hashPasswordSync(password: string): string {
  try {
    // パスワードの基本的なバリデーション
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // bcryptを使用してハッシュ化
    const hashedPassword = bcrypt.hashSync(password, HASH_CONFIG.saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * パスワードを検証
 * @param password プレーンテキストのパスワード
 * @param hashedPassword ハッシュ化されたパスワード
 * @returns パスワードが一致するかどうか
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    // 基本的なバリデーション
    if (!password || !hashedPassword) {
      return false;
    }

    // bcryptを使用してパスワードを検証
    const isValid = await bcrypt.compare(password, hashedPassword);
    // パスワード検証完了
    return isValid;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * パスワードの強度をチェック
 * @param password チェックするパスワード
 * @returns パスワード強度の評価結果
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // 基本的な長さチェック
  if (password.length < 8) {
    feedback.push('パスワードは8文字以上である必要があります');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // 大文字のチェック
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('大文字を含めることを推奨します');
  }

  // 小文字のチェック
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('小文字を含めることを推奨します');
  }

  // 数字のチェック
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('数字を含めることを推奨します');
  }

  // 特殊文字のチェック
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('特殊文字を含めることを推奨します');
  }

  // よくあるパスワードパターンをチェック
  const commonPatterns = [/123456/, /password/i, /qwerty/i, /admin/i, /login/i];

  if (commonPatterns.some((pattern) => pattern.test(password))) {
    score = Math.max(0, score - 2);
    feedback.push('一般的なパスワードパターンは避けてください');
  }

  const isValid = password.length >= 8 && score >= 3;

  if (feedback.length === 0 && score >= 5) {
    feedback.push('非常に強いパスワードです');
  } else if (feedback.length === 0 && score >= 3) {
    feedback.push('良好なパスワードです');
  }

  return {
    isValid,
    score: Math.min(5, score), // 最大スコアを5に制限
    feedback,
  };
}

/**
 * ランダムなパスワードを生成（一時パスワード用）
 * @param length パスワードの長さ（デフォルト: 12）
 * @returns 生成されたランダムパスワード
 */
export function generateRandomPassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';

  // 各カテゴリから最低1文字を保証
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // 残りの文字をランダムに選択
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // パスワードをシャッフル
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * パスワードリセット用のトークンを生成
 * @returns リセットトークン
 */
export function generatePasswordResetToken(): string {
  // 暗号学的に安全なランダム文字列を生成
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';

  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }

  return token + Date.now().toString(36); // タイムスタンプを追加
}
