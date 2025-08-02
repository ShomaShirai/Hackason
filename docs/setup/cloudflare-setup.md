# Cloudflare セットアップガイド

このガイドでは、Cloudflareアカウントの作成から本プロジェクトのデプロイまでの手順を説明します。

## 📋 前提条件

- Node.js 18以上がインストールされていること
- npmまたはyarnが使用可能であること
- Gitの基本的な知識があること

## 🚀 セットアップ手順

### 1. Cloudflareアカウントの作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up)にアクセス
2. メールアドレスとパスワードを入力してアカウントを作成
3. メールアドレスの確認を完了
4. 無料プランを選択（Workersは無料枠で十分開発可能）

### 2. Wrangler CLIのインストールと認証

```bash
# Wrangler CLIのインストール（プロジェクトに既にインストール済みの場合はスキップ）
npm install -g wrangler

# バージョン確認
wrangler --version

# Cloudflareアカウントでログイン
wrangler login
```

ブラウザが開き、Cloudflareへのログインを求められます。ログイン後、CLIの認証が完了します。

### 3. D1データベースの作成

```bash
# D1データベースを作成
wrangler d1 create medical-consultation-db

# 出力例:
# ✅ Successfully created DB 'medical-consultation-db' in region APAC
# Created your database using D1's new storage backend. The new storage backend is not yet recommended for production workloads, but backs up your data via point-in-time restore.
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "medical-consultation-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**重要**: 出力された`database_id`をメモしてください。次のステップで使用します。

### 4. プロジェクトの設定

```bash
# プロジェクトのルートディレクトリで実行
cp wrangler.example.jsonc wrangler.jsonc
```

`wrangler.jsonc`を編集して、以下の項目を設定します：

```jsonc
{
  "name": "your-cloudflare-project-name",  // プロジェクト名（英数字とハイフンのみ）
  // ...
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "medical-consultation-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  // 上記でメモしたID
    }
  ],
  // ...
}
```

### 5. 環境変数とシークレットの設定

#### ローカル開発用の環境変数

`wrangler.jsonc`の`vars`セクションに開発用の値を設定：

```jsonc
"vars": {
  "JWT_SECRET": "your-very-long-and-secure-secret-key-at-least-32-characters",
  "JWT_ACCESS_TOKEN_EXPIRY": "3600",
  "JWT_REFRESH_TOKEN_EXPIRY": "604800"
}
```

#### 本番環境用のシークレット

本番環境では、機密情報は環境変数ではなくシークレットとして設定します：

```bash
# JWT秘密鍵の設定
echo "your-production-secret-key" | wrangler secret put JWT_SECRET

# その他の必要なシークレットがある場合も同様に設定
```

### 6. データベースのセットアップ

```bash
# データベーススキーマの適用
npx drizzle-kit push

# 初期データの投入（開発環境）
npm run seed:local

# 本番環境へのマイグレーション適用
npx wrangler d1 migrations apply medical-consultation-db
```

### 7. デプロイ

```bash
# 開発環境でのテスト
npm run dev

# 本番環境へのデプロイ
npm run deploy

# または
wrangler deploy
```

デプロイが成功すると、以下のような出力が表示されます：

```
Uploaded your-cloudflare-project-name (X.XX sec)
Published your-cloudflare-project-name (X.XX sec)
  https://your-cloudflare-project-name.your-subdomain.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 🔍 デプロイの確認

1. 表示されたURLにアクセスして、アプリケーションが正常に動作することを確認
2. [Cloudflare Dashboard](https://dash.cloudflare.com)でWorkerの状態を確認
3. ログは`wrangler tail`コマンドでリアルタイムに確認可能

```bash
# リアルタイムログの確認
wrangler tail
```

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. D1データベースの接続エラー

```
Error: D1_ERROR: no such table: users
```

**解決方法**:
```bash
# マイグレーションの再実行
npx wrangler d1 migrations apply medical-consultation-db --local
```

#### 2. 認証エラー

```
Error: Authentication required
```

**解決方法**:
```bash
# 再ログイン
wrangler logout
wrangler login
```

#### 3. デプロイエラー

```
Error: Script startup exceeded CPU time limit
```

**解決方法**:
- ビルドサイズの確認: `npm run build`
- 不要な依存関係の削除
- [互換性フラグ](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)の確認

### 4. 環境変数が反映されない

**解決方法**:
```bash
# ローカル開発環境の場合
npm run dev -- --clear-cache

# 本番環境の場合
wrangler secret list  # シークレットの確認
```

## 📚 参考リンク

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Wrangler CLI ドキュメント](https://developers.cloudflare.com/workers/wrangler/)
- [D1 データベースドキュメント](https://developers.cloudflare.com/d1/)
- [Workers 料金プラン](https://developers.cloudflare.com/workers/platform/pricing/)

## 🆘 サポート

問題が解決しない場合は、以下のリソースを参照してください：

1. [Cloudflare Community](https://community.cloudflare.com/)
2. [プロジェクトのIssues](https://github.com/your-repo/issues)
3. ハッカソンのSlackチャンネル（参加者に別途共有）

---

最終更新日: 2025-08-01