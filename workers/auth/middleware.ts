import type { Context, Next } from 'hono';
import { verifyAccessToken, extractTokenFromHeader, type JWTPayload, JWT_CONFIG } from './jwt';

export interface AuthenticatedContext extends Context {
  user: JWTPayload;
}

/**
 * JWT認証ミドルウェア
 * APIエンドポイントにアクセスする前にJWTトークンを検証する
 */
export function authMiddleware(_secret?: string) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authorization header with Bearer token is required',
        },
        401
      );
    }

    // デモ用認証バイパス
    if (token === 'demo-token-for-video-test') {
      console.warn('Demo mode: Bypassing authentication');
      c.set('user', {
        id: 1,
        email: 'demo@test.com',
        userType: 'patient' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });
      return await next();
    }

    const payload = await verifyAccessToken(token, JWT_CONFIG.secret);

    if (!payload) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        },
        401
      );
    }

    // トークンから取得したユーザー情報をコンテキストに設定
    c.set('user', payload);

    return await next();
  };
}

/**
 * ロールベース認証ミドルウェア
 * 特定のロールを持つユーザーのみアクセスを許可する
 */
export function roleMiddleware(allowedRoles: ('doctor' | 'operator' | 'admin')[], _secret?: string) {
  return async (c: Context, next: Next) => {
    // まず基本的な認証をチェック
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authorization header with Bearer token is required',
        },
        401
      );
    }

    const payload = await verifyAccessToken(token, JWT_CONFIG.secret);

    if (!payload) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        },
        401
      );
    }

    // ロールをチェック（workerのみロールを持つ）
    if (payload.userType !== 'worker' || !payload.role || !allowedRoles.includes(payload.role)) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        },
        403
      );
    }

    // ユーザー情報をコンテキストに設定
    c.set('user', payload);

    return await next();
  };
}

/**
 * 患者用認証ミドルウェア
 * 患者タイプのみアクセス許可
 */
export function patientAuthMiddleware(_secret?: string) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authorization header with Bearer token is required',
        },
        401
      );
    }

    const payload = await verifyAccessToken(token, JWT_CONFIG.secret);

    if (!payload) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        },
        401
      );
    }

    // 患者タイプをチェック
    if (payload.userType !== 'patient') {
      return c.json(
        {
          error: 'Forbidden',
          message: 'Access denied. Patient access only',
        },
        403
      );
    }

    c.set('user', payload);
    return await next();
  };
}

/**
 * ワーカー用認証ミドルウェア
 * 医療従事者ロール（doctor, operator, admin）のみアクセス許可
 */
export function workerAuthMiddleware(_secret?: string) {
  return roleMiddleware(['doctor', 'operator', 'admin'], JWT_CONFIG.secret);
}

/**
 * 管理者用認証ミドルウェア
 * 管理者ロールのみアクセス許可
 */
export function adminAuthMiddleware(_secret?: string) {
  return roleMiddleware(['admin'], JWT_CONFIG.secret);
}

/**
 * オプション認証ミドルウェア
 * トークンがある場合は検証するが、ない場合でもアクセスを許可
 */
export function optionalAuthMiddleware(secret?: string) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const payload = await verifyAccessToken(token, JWT_CONFIG.secret);
      if (payload) {
        c.set('user', payload);
      }
    }

    return await next();
  };
}

/**
 * 自分自身のリソースのみアクセス許可ミドルウェア
 * 患者が自分の情報のみアクセスできるように制限
 */
export function selfOnlyMiddleware(resourceIdParam: string = 'id', secret?: string) {
  return async (c: Context, next: Next) => {
    // まず基本的な認証をチェック
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authorization header with Bearer token is required',
        },
        401
      );
    }

    const payload = await verifyAccessToken(token, JWT_CONFIG.secret);

    if (!payload) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        },
        401
      );
    }

    // リソースIDを取得
    const resourceId = c.req.param(resourceIdParam);

    // 患者の場合は自分のIDのみアクセス許可
    if (payload.userType === 'patient' && payload.id.toString() !== resourceId) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'Access denied. You can only access your own resources',
        },
        403
      );
    }

    // ワーカーの場合はすべてのリソースにアクセス許可
    c.set('user', payload);

    return await next();
  };
}

/**
 * ヘルパー関数：コンテキストからユーザー情報を取得
 */
export function getUser(c: Context): JWTPayload | null {
  return c.get('user') || null;
}

/**
 * ヘルパー関数：ユーザーが特定のロールを持っているかチェック
 */
export function hasRole(c: Context, role: 'doctor' | 'operator' | 'admin'): boolean {
  const user = getUser(c);
  return user?.userType === 'worker' && user?.role === role;
}

/**
 * ヘルパー関数：ユーザーが特定のロールのいずれかを持っているかチェック
 */
export function hasAnyRole(c: Context, roles: ('doctor' | 'operator' | 'admin')[]): boolean {
  const user = getUser(c);
  return user?.userType === 'worker' && user?.role ? roles.includes(user.role) : false;
}

/**
 * ヘルパー関数：現在のユーザーIDを取得（数値）
 */
export function getCurrentUserId(c: Context): number | null {
  const user = getUser(c);
  return user?.id || null;
}

/**
 * ヘルパー関数：現在のユーザーIDを取得（文字列）
 */
export function getCurrentUserSubId(c: Context): string | null {
  const user = getUser(c);
  return user?.sub || null;
}

/**
 * ヘルパー関数：現在のユーザーが指定されたユーザーIDと一致するかチェック
 */
export function isCurrentUser(c: Context, userId: number | string): boolean {
  const user = getUser(c);
  if (!user) {return false;}

  if (typeof userId === 'number') {
    return user.id === userId;
  } else {
    return user.sub === userId;
  }
}
