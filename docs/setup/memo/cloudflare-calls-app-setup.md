# Cloudflare Calls App設定ガイド

## 概要

Cloudflare Calls APIを使用してビデオ通話機能を実装するために必要なApp設定とSecret管理について説明します。

## 1. Cloudflare Calls Appの作成

### 1.1 前提条件

- Cloudflareアカウントが必要
- Calls APIへのアクセス権限が必要（現在はベータ版）
- ダッシュボードからCalls機能が有効化されている

### 1.2 App作成手順

1. **Cloudflareダッシュボードにログイン**
   ```
   https://dash.cloudflare.com/
   ```

2. **Calls セクションに移動**
   - 左側メニューから「Calls」を選択
   - または「R2」の下にある「Calls」をクリック

3. **新しいAppを作成**
   ```
   名前: fd-online-medical-consultation
   説明: ファストドクターオンライン診療システム
   ```

4. **App IDとApp Secretを取得**
   - App ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - App Secret: `sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 2. Secret管理設計

### 2.1 開発環境でのSecret管理

#### .env.local ファイル

```bash
# Cloudflare Calls設定
CF_CALLS_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CF_CALLS_APP_SECRET=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 既存の設定
JWT_SECRET=your-jwt-secret-here
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
```

#### 環境変数の読み込み（開発環境）

```typescript
// workers/app-local-dev.ts
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export interface Env {
  DB: D1Database;
  CF_CALLS_APP_ID: string;
  CF_CALLS_APP_SECRET: string;
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRY: string;
  JWT_REFRESH_TOKEN_EXPIRY: string;
}
```

### 2.2 本番環境でのSecret管理

#### wrangler.jsonc 設定

```json
{
  "name": "fd-qiita-hktn-2025",
  "compatibility_date": "2024-12-16",
  "main": "workers/app.ts",
  
  // 通常の環境変数（公開可能）
  "vars": {
    "CF_CALLS_APP_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "JWT_ACCESS_TOKEN_EXPIRY": "3600",
    "JWT_REFRESH_TOKEN_EXPIRY": "604800"
  },
  
  // シークレット（暗号化保存）
  // これらは wrangler secret put コマンドで設定
  "secrets": [
    "CF_CALLS_APP_SECRET",
    "JWT_SECRET"
  ],
  
  // D1データベース設定
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "medical-consultation-db",
      "database_id": "05db35e6-eb77-436b-850a-f7e4868190f8"
    }
  ]
}
```

#### Secretの設定コマンド

```bash
# JWT Secret設定
npx wrangler secret put JWT_SECRET
# プロンプトで値を入力

# Cloudflare Calls App Secret設定
npx wrangler secret put CF_CALLS_APP_SECRET
# プロンプトで値を入力
```

### 2.3 セキュリティベストプラクティス

#### 1. Secretのローテーション

```typescript
// workers/utils/secret-rotation.ts
export class SecretRotation {
  static async rotateCallsAppSecret(env: Env): Promise<void> {
    // 1. Cloudflare APIで新しいSecretを生成
    // 2. 既存のセッションに影響しないように段階的に移行
    // 3. 古いSecretを無効化
  }
}
```

#### 2. アクセス制御

```typescript
// workers/middleware/calls-auth.ts
export const callsAuthMiddleware = () => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    // 認証済みユーザーのみアクセス可能
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // 患者は自分の予約のみ、医師は担当患者のみ
    const appointmentId = c.req.param('appointmentId');
    if (appointmentId) {
      const hasAccess = await checkAppointmentAccess(
        c.env.DB,
        user,
        appointmentId
      );
      
      if (!hasAccess) {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }
    
    await next();
  };
};
```

#### 3. 環境変数の検証

```typescript
// workers/utils/env-validator.ts
export function validateCallsConfig(env: Env): void {
  const required = [
    'CF_CALLS_APP_ID',
    'CF_CALLS_APP_SECRET',
    'JWT_SECRET'
  ];
  
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  
  // App IDフォーマット検証
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(env.CF_CALLS_APP_ID)) {
    throw new Error('Invalid CF_CALLS_APP_ID format');
  }
  
  // App Secretフォーマット検証
  if (!env.CF_CALLS_APP_SECRET.startsWith('sk_')) {
    throw new Error('Invalid CF_CALLS_APP_SECRET format');
  }
}
```

### 2.4 開発チーム向けSecret共有

#### 1. 1Password/Bitwardenを使用

```yaml
# .1password.yml
cloudflare-calls:
  app_id: op://Development/Cloudflare Calls/app_id
  app_secret: op://Development/Cloudflare Calls/app_secret
```

#### 2. 環境別設定

```bash
# 開発環境
.env.local

# ステージング環境
.env.staging

# 本番環境
# Cloudflare Workersのシークレット機能を使用
```

## 3. Calls App設定

### 3.1 基本設定

```typescript
// workers/config/calls-config.ts
export interface CallsConfig {
  appId: string;
  appSecret: string;
  maxSessionDuration: number; // 秒
  maxParticipants: number;
  recordingEnabled: boolean;
}

export function getCallsConfig(env: Env): CallsConfig {
  return {
    appId: env.CF_CALLS_APP_ID,
    appSecret: env.CF_CALLS_APP_SECRET,
    maxSessionDuration: 3600, // 1時間
    maxParticipants: 4, // 患者、医師、オペレータ、家族
    recordingEnabled: false // ハッカソンでは無効
  };
}
```

### 3.2 セッション設定

```typescript
// workers/realtime/session-config.ts
export interface SessionConfig {
  // セッションID生成
  generateSessionId(): string;
  
  // トラック名生成
  generateTrackName(userType: string, userId: number, trackType: string): string;
  
  // セッション有効期限
  getSessionTTL(): number;
}

export class DefaultSessionConfig implements SessionConfig {
  generateSessionId(): string {
    return `session-${Date.now()}-${crypto.randomUUID()}`;
  }
  
  generateTrackName(userType: string, userId: number, trackType: string): string {
    return `${userType}-${userId}-${trackType}-${Date.now()}`;
  }
  
  getSessionTTL(): number {
    return 3600; // 1時間
  }
}
```

## 4. トラブルシューティング

### 4.1 よくあるエラー

#### App IDが見つからない
```
Error: CF_CALLS_APP_ID is not defined
```
**解決方法**: 環境変数が正しく設定されているか確認

#### 認証エラー
```
Error: Invalid bearer token
```
**解決方法**: App Secretが正しいか、期限切れでないか確認

#### セッション作成エラー
```
Error: Failed to create session
```
**解決方法**: Calls APIの利用制限を確認

### 4.2 デバッグ方法

```typescript
// workers/utils/calls-debug.ts
export function debugCallsRequest(request: Request, response: Response): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('Calls API Request:', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    console.log('Calls API Response:', {
      status: response.status,
      statusText: response.statusText
    });
  }
}
```

## 5. 次のステップ

1. Cloudflareダッシュボードでアプリを作成
2. 環境変数を設定
3. ローカル環境でテスト
4. 本番環境にデプロイ

---
😊（Secret管理の設計ができた）
**エントロピー**: 🟦🟦🟦🟦🟦 (2/5)