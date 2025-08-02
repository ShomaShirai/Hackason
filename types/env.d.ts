/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />

// Vite環境変数の型定義
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_ENABLE_MOCK: string;
  // その他のVITE_プレフィックス環境変数
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Cloudflare Workers環境変数の型定義
export interface Env {
  DB: D1Database;
  // JWT設定
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRY: string;
  JWT_REFRESH_TOKEN_EXPIRY: string;
  // Cloudflare Calls設定
  CF_CALLS_APP_ID: string;
  CF_CALLS_APP_SECRET: string;
}