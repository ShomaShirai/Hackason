/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers環境変数の型定義
 */
export interface Env {
  // データベース
  DB: D1Database;

  // JWT認証
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRY?: string;
  JWT_REFRESH_TOKEN_EXPIRY?: string;

  // Durable Objects
  SIGNALING_ROOM: DurableObjectNamespace;

  // Static Assets
  ASSETS: Fetcher;

  // 環境設定
  NODE_ENV?: string;
  ALLOWED_ORIGINS?: string;

  // AI API (将来の拡張用)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;

  // AWS (Amazon Chime SDK用)
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;

  // Cloudflare Calls API
  CF_CALLS_APP_ID?: string;
  CF_CALLS_APP_SECRET?: string;
  
  // Cloudflare TURN Service (Orange)
  TURN_SERVICE_ID?: string;
  TURN_SERVICE_TOKEN?: string;

  // ログ設定
  LOG_LEVEL?: string;
}

/**
 * 環境変数のデフォルト値
 */
export const ENV_DEFAULTS = {
  JWT_ACCESS_TOKEN_EXPIRY: '3600', // 1時間
  JWT_REFRESH_TOKEN_EXPIRY: '604800', // 7日間
  NODE_ENV: 'development',
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
  AWS_REGION: 'ap-northeast-1',
  LOG_LEVEL: 'info',
} as const;

/**
 * 環境変数を安全に取得するヘルパー関数
 */
export function getEnvVar(env: Env, key: keyof Env, defaultValue?: string): string {
  const value = env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value.toString();
}

/**
 * JWT設定を環境変数から取得
 */
export function getJWTConfig(env: Env) {
  return {
    secret: getEnvVar(env, 'JWT_SECRET'),
    accessTokenExpiry: parseInt(
      getEnvVar(env, 'JWT_ACCESS_TOKEN_EXPIRY', ENV_DEFAULTS.JWT_ACCESS_TOKEN_EXPIRY)
    ),
    refreshTokenExpiry: parseInt(
      getEnvVar(env, 'JWT_REFRESH_TOKEN_EXPIRY', ENV_DEFAULTS.JWT_REFRESH_TOKEN_EXPIRY)
    ),
  };
}

/**
 * CORS設定を環境変数から取得
 */
export function getCORSConfig(env: Env) {
  const allowedOrigins = getEnvVar(env, 'ALLOWED_ORIGINS', ENV_DEFAULTS.ALLOWED_ORIGINS);
  return {
    origins: allowedOrigins.split(',').map((origin) => origin.trim()),
  };
}

/**
 * データベース設定を環境変数から取得
 */
export function getDatabaseConfig(env: Env) {
  return {
    database: env.DB,
  };
}

/**
 * 環境変数の検証
 */
export function validateEnvironment(env: Env): void {
  const requiredVars: (keyof Env)[] = ['JWT_SECRET'];

  for (const varName of requiredVars) {
    if (!env[varName]) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
  }

  // JWT_SECRETの強度チェック
  const jwtSecret = env.JWT_SECRET;
  if (jwtSecret.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters long for security');
  }

  // 開発環境での警告
  const nodeEnv = getEnvVar(env, 'NODE_ENV', ENV_DEFAULTS.NODE_ENV);
  if (nodeEnv === 'development' && jwtSecret.includes('development')) {
    console.warn('WARNING: Using development JWT_SECRET. Change it for production!');
  }
}

/**
 * ログレベルを環境変数から取得
 */
export function getLogLevel(env: Env): 'debug' | 'info' | 'warn' | 'error' {
  const level = getEnvVar(env, 'LOG_LEVEL', ENV_DEFAULTS.LOG_LEVEL).toLowerCase();

  if (['debug', 'info', 'warn', 'error'].includes(level)) {
    return level as 'debug' | 'info' | 'warn' | 'error';
  }

  return 'info'; // デフォルト
}
