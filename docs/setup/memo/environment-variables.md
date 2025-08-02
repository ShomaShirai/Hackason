# 環境変数設定ガイド

## 概要

本プロジェクトでは、セキュリティと環境分離のため、機密情報は環境変数で管理します。

## 設定手順

### 1. .envファイルの作成

プロジェクトルートに `.env` ファイルを作成し、以下の内容をコピーして実際の値を設定してください：

```bash
# 開発環境設定ファイル
# JWT認証設定
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long-please-change-this
JWT_ACCESS_TOKEN_EXPIRY=3600    # 1時間
JWT_REFRESH_TOKEN_EXPIRY=604800 # 7日間

# データベース設定
DATABASE_URL=file:local.db

# 開発環境設定
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# ログ設定
LOG_LEVEL=debug
```

### 2. .gitignoreへの追加

`.gitignore` ファイルに以下を追加（まだ追加されていない場合）：

```
# 環境変数ファイル
.env
.env.local
.env.production
.env.staging

# ローカル開発ファイル
local.db
local.db-*
```

### 3. JWT_SECRETの生成

強固なJWT_SECRETを生成するには：

```bash
# Node.jsを使用した生成方法
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# またはオンラインジェネレーターを使用
# https://generate-secret.vercel.app/32
```

## 環境別設定

### ローカル開発環境

- `.env` ファイルを使用
- `DATABASE_URL=file:local.db` でローカルSQLite使用

### Cloudflare Workers本番環境

Cloudflare Workers環境では、`wrangler.jsonc` で設定：

```jsonc
{
  "vars": {
    "JWT_SECRET": "your-production-jwt-secret",
    "NODE_ENV": "production",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "medical-consultation-db",
      "database_id": "your-actual-d1-database-id",
    },
  ],
}
```

または `wrangler secret put` コマンドで機密情報を設定：

```bash
# JWT_SECRETをCloudflare Workers secretとして設定
wrangler secret put JWT_SECRET

# 他の機密情報も同様に設定
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

## 必須環境変数

### 基本設定

| 変数名         | 説明                                    | 必須 | デフォルト値    |
| -------------- | --------------------------------------- | ---- | --------------- |
| `JWT_SECRET`   | JWT署名用シークレットキー（32文字以上） | ✅   | なし            |
| `DATABASE_URL` | データベース接続URL                     | ✅   | `file:local.db` |
| `NODE_ENV`     | 実行環境（development/production）      | ❌   | `development`   |

### セキュリティ設定

| 変数名                     | 説明                               | 必須 | デフォルト値  |
| -------------------------- | ---------------------------------- | ---- | ------------- |
| `JWT_ACCESS_TOKEN_EXPIRY`  | アクセストークン有効期限（秒）     | ❌   | `3600`        |
| `JWT_REFRESH_TOKEN_EXPIRY` | リフレッシュトークン有効期限（秒） | ❌   | `604800`      |
| `ALLOWED_ORIGINS`          | CORS許可オリジン（カンマ区切り）   | ❌   | localhost設定 |

### 将来の拡張用（オプション）

| 変数名                  | 説明                   | 必須 | 用途           |
| ----------------------- | ---------------------- | ---- | -------------- |
| `OPENAI_API_KEY`        | OpenAI API キー        | ❌   | 音声書き起こし |
| `ANTHROPIC_API_KEY`     | Anthropic API キー     | ❌   | Claude AI      |
| `GEMINI_API_KEY`        | Google Gemini API キー | ❌   | Gemini AI      |
| `AWS_ACCESS_KEY_ID`     | AWS アクセスキー       | ❌   | Chime SDK      |
| `AWS_SECRET_ACCESS_KEY` | AWS シークレットキー   | ❌   | Chime SDK      |

## セキュリティ注意事項

### ❌ やってはいけないこと

- `.env` ファイルをGitにコミットする
- JWT_SECRETを短い文字列にする（最低32文字）
- 本番環境で開発用のシークレットを使用する
- API キーをコード内にハードコードする

### ✅ 推奨事項

- 強固なランダム文字列をJWT_SECRETに使用
- 環境ごとに異なるシークレットを使用
- 定期的にシークレットのローテーションを実施
- Cloudflare Workers secretsで機密情報を管理

## トラブルシューティング

### JWT_SECRETが設定されていない場合

```
Error: JWT_SECRET environment variable is required
```

→ `.env` ファイルに `JWT_SECRET` を設定してください

### データベース接続エラー

```
Error: Database connection failed
```

→ `DATABASE_URL` が正しく設定されているか確認してください

### CORS エラー

```
Access to fetch blocked by CORS policy
```

→ `ALLOWED_ORIGINS` にフロントエンドのURLが含まれているか確認してください
