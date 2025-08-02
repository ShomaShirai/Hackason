import type { JWTPayload } from '../auth/jwt'

// 環境変数の型定義
export interface Env {
  DB: D1Database
  JWT_SECRET: string
  JWT_ACCESS_TOKEN_EXPIRY: string
  JWT_REFRESH_TOKEN_EXPIRY: string
  CF_CALLS_APP_ID: string
  CF_CALLS_APP_SECRET: string
  TURN_SERVICE_ID?: string
  TURN_SERVICE_TOKEN?: string
  SIGNALING_ROOM: DurableObjectNamespace
}

// Hono型定義の拡張
export type Variables = {
  user: JWTPayload
}
