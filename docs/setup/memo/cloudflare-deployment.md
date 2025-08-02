# Cloudflare Workers デプロイガイド

## 事前準備

### 1. Cloudflareアカウント設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com)にログイン
2. Workers & Pages > Overview に移動
3. 初回の場合、Workersプランを選択（無料プランでOK）

### 2. API Token作成

1. [API Tokens](https://dash.cloudflare.com/profile/api-tokens)に移動
2. "Create Token"をクリック
3. "Create Custom Token"を選択
4. 以下の権限を設定：
   - Account > Cloudflare Workers Scripts: Edit
   - Account > Account Settings: Read
   - Zone > Workers Routes: Edit（該当する場合）

### 3. ローカル環境でのトークン設定

```bash
# 環境変数として設定
export CLOUDFLARE_API_TOKEN="your-api-token-here"

# または、wranglerコマンドでログイン
wrangler login
```

## D1データベースのセットアップ

### 1. D1データベース作成

```bash
# データベース作成
wrangler d1 create medical-consultation-db

# 出力される database_id をメモしておく
```

### 2. wrangler.jsonc更新

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "medical-consultation-db",
    "database_id": "実際のdatabase_idをここに入力", // <-- 更新
    "migrations_dir": "./drizzle"
  }
],
```

### 3. マイグレーション実行

```bash
# ローカルでマイグレーションファイル生成
npm run drizzle:generate

# リモートD1にマイグレーション適用
wrangler d1 migrations apply medical-consultation-db
```

## シークレット設定

```bash
# JWT_SECRET設定（本番環境用の強力なランダム文字列を使用）
wrangler secret put JWT_SECRET
# プロンプトが表示されたら、安全な秘密鍵を入力
```

## デプロイ実行

### 1. 型定義生成

```bash
npm run cf-typegen
```

### 2. ビルド＆デプロイ

```bash
# 本番デプロイ
npm run deploy

# または手動実行
npm run build
wrangler deploy
```

### 3. デプロイ確認

デプロイ後、以下のURLでアプリケーションにアクセス可能：

- `https://react-router-hono-fullstack-template.<your-subdomain>.workers.dev`

## トラブルシューティング

### よくあるエラーと対処法

1. **認証エラー**

   ```
   Authentication error
   ```

   - `CLOUDFLARE_API_TOKEN`が正しく設定されているか確認
   - `wrangler login`でブラウザ経由でログイン

2. **D1データベースエラー**

   ```
   D1_ERROR: no such table
   ```

   - マイグレーションが実行されているか確認
   - `wrangler d1 migrations list medical-consultation-db`で状態確認

3. **ビルドエラー**

   ```
   Build failed
   ```

   - `npm run typecheck`でTypeScriptエラーがないか確認
   - `node_modules`削除して`npm install`を再実行

## 環境別設定

### 開発環境

```bash
# ローカル開発（SQLite使用）
npm run dev
```

### ステージング環境

```bash
# ステージング用wrangler設定作成
cp wrangler.jsonc wrangler.staging.jsonc
# wrangler.staging.jsonc を編集

# ステージングデプロイ
wrangler deploy --config wrangler.staging.jsonc
```

### 本番環境

```bash
# 本番デプロイ（確認プロンプト付き）
wrangler deploy --env production
```

## セキュリティ考慮事項

1. **JWT_SECRET**
   - 必ず強力なランダム文字列を使用（最低32文字以上推奨）
   - 定期的に更新（3ヶ月ごと推奨）

2. **CORS設定**
   - 本番環境では適切なオリジンのみ許可するよう設定
   - `workers/app.ts`のCORS設定を環境に応じて調整

3. **Rate Limiting**
   - Cloudflare Workers Rate Limitingルールを設定
   - 特に認証エンドポイントには必須

## 監視・ログ

### Cloudflare Analytics

1. Workers & Pages > アプリケーション選択 > Analytics
2. リクエスト数、エラー率、レスポンス時間を確認

### リアルタイムログ

```bash
# ライブログ表示
wrangler tail
```

### Sentry統合（オプション）

エラートラッキングのため、Sentry統合を推奨：

1. Sentryプロジェクト作成
2. DSNを`wrangler secret put SENTRY_DSN`で設定
3. エラーハンドリングコードに統合

## 次のステップ

1. カスタムドメイン設定
2. Cloudflare Pagesとの統合
3. CI/CDパイプライン構築（GitHub Actions）
4. パフォーマンスチューニング
