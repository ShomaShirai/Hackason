import jwt from '@tsndr/cloudflare-worker-jwt';

export interface JWTPayload {
  sub: string; // user ID
  id: number; // numeric user ID (patient.id or worker.id)
  email: string;
  userType: 'patient' | 'worker'; // ユーザータイプ
  role?: 'doctor' | 'operator' | 'admin'; // worker の場合のロール
  exp: number; // expiration time
  iat: number; // issued at
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT設定
 */
export const JWT_CONFIG = {
  secret: 'local_development-for-development', // フォールバック用（実際にはenvironmentから設定）
  accessTokenExpiry: 8 * 60 * 60, // 開発環境用: 8時間（秒）
  refreshTokenExpiry: 60 * 60 * 24 * 7, // 7日間（秒）
  algorithm: 'HS256' as const,
};

/**
 * アクセストークンを生成
 */
export async function generateAccessToken(
  userId: string,
  numericId: number,
  email: string,
  userType: 'patient' | 'worker',
  role?: 'doctor' | 'operator' | 'admin',
  secret?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + JWT_CONFIG.accessTokenExpiry;
  const payload: JWTPayload = {
    sub: userId,
    id: numericId,
    email,
    userType,
    role,
    iat: now,
    exp: expiry,
  };

  // デバッグログ: トークン有効期限の確認
  const expiryHours = Math.floor(JWT_CONFIG.accessTokenExpiry / 3600);
  console.log(`🔑 JWT Access Token 生成: 有効期限 ${expiryHours}時間 (${new Date(expiry * 1000).toLocaleString('ja-JP')}まで)`);

  return await jwt.sign(payload, secret || JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm,
  });
}

/**
 * リフレッシュトークンを生成
 */
export async function generateRefreshToken(
  userId: string,
  numericId: number,
  email: string,
  userType: 'patient' | 'worker',
  role?: 'doctor' | 'operator' | 'admin',
  secret?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    id: numericId,
    email,
    userType,
    role,
    type: 'refresh',
    iat: now,
    exp: now + JWT_CONFIG.refreshTokenExpiry,
  };

  return await jwt.sign(payload, JWT_CONFIG.secret, {
    algorithm: JWT_CONFIG.algorithm,
  });
}

/**
 * トークンペアを生成
 */
export async function generateTokenPair(
  userId: string,
  numericId: number,
  email: string,
  userType: 'patient' | 'worker',
  role?: 'doctor' | 'operator' | 'admin',
  secret?: string
): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, numericId, email, userType, role, secret),
    generateRefreshToken(userId, numericId, email, userType, role, secret),
  ]);

  return {
    accessToken,
    refreshToken,
  };
}

/**
 * アクセストークンを検証
 */
export async function verifyAccessToken(
  token: string,
  _secret?: string
): Promise<JWTPayload | null> {
  try {
    const isValid = await jwt.verify(token, JWT_CONFIG.secret, {
      algorithm: JWT_CONFIG.algorithm,
    });

    if (!isValid) {
      return null;
    }

    const decoded = jwt.decode(token);
    const payload = decoded.payload as JWTPayload;

    // トークンの有効期限をチェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * リフレッシュトークンを検証
 */
export async function verifyRefreshToken(
  token: string,
  secret?: string
): Promise<{ sub: string; id: number; email: string; userType: 'patient' | 'worker'; role?: 'doctor' | 'operator' | 'admin' } | null> {
  try {
    const isValid = await jwt.verify(token, JWT_CONFIG.secret, {
      algorithm: JWT_CONFIG.algorithm,
    });

    if (!isValid) {
      return null;
    }

    const decoded = jwt.decode(token);
    const payload = decoded.payload as JWTPayload & { type?: string };

    // リフレッシュトークンタイプを確認
    if (payload.type !== 'refresh') {
      return null;
    }

    // トークンの有効期限をチェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return {
      sub: payload.sub,
      id: payload.id,
      email: payload.email,
      userType: payload.userType,
      role: payload.role,
    };
  } catch (error) {
    console.error('Refresh token verification error:', error);
    return null;
  }
}

/**
 * Authorizationヘッダーからトークンを抽出
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // "Bearer " を除去
}

/**
 * JWT設定を更新（環境変数対応）
 */
export function updateJWTConfig(secret: string, accessExpiry?: number, refreshExpiry?: number) {
  // JWT_CONFIG.secret = secret;

  // 開発環境の判定（secretに 'local_development' が含まれる場合）
  const isDevelopment = secret.includes('local_development');

  if (isDevelopment) {
    // 開発環境では固定で8時間に設定
    JWT_CONFIG.accessTokenExpiry = 8 * 60 * 60; // 8時間
    console.log('🔧 JWT設定更新: 開発環境モード - アクセストークン有効期限を8時間に設定');
  } else {
    // 本番環境では環境変数の値を使用（デフォルト1時間）
    if (accessExpiry) {
      JWT_CONFIG.accessTokenExpiry = accessExpiry;
    }
  }

  if (refreshExpiry) {
    JWT_CONFIG.refreshTokenExpiry = refreshExpiry;
  }

  console.log(`📝 JWT設定確認: アクセストークン有効期限 ${Math.floor(JWT_CONFIG.accessTokenExpiry / 3600)}時間`);
}
