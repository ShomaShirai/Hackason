# オンライン診療プラットフォーム開発基盤

ファストドクター主催「オンライン診療AI活用ハッカソン」の開発基盤プロジェクトです。

## 🚀 クイックスタート

```bash
# 依存関係のインストール
npm install

# Cloudflare設定ファイルのセットアップ
cp wrangler.example.jsonc wrangler.jsonc
# wrangler.jsonc内の以下の項目を編集:
# - name: your-cloudflare-project-name を自分のプロジェクト名に変更
# - database_id: D1データベースIDを設定（wrangler d1 createで作成後に取得）
# - JWT_SECRET: 安全な秘密鍵を設定

# データベースセットアップ
npx drizzle-kit push
npm run seed:local
```

### 開発サーバーの起動

**推奨構成（2ターミナル）:**

```bash
# ターミナル1: 開発サーバー
npm run dev
# → http://localhost:8787（フロントエンド・バックエンド統合）

# ターミナル2: ビルド監視
npm run watch-build
# → 修正が約10秒でhot-reload
```

**シンプル開始:**

```bash
# 開発サーバーのみ起動
npm run dev
# → http://localhost:8787
```

### 🔑 デモ認証情報

- **患者**: `patient@test.com` / `test1234`
- **医師**: `doctor@test.com` / `test1234`

### 🧪 テスト実行

```bash
# 全てのテストを実行
npm test

# 特定のテストファイルのみ実行
npm test auth.test.ts
npm test video-sessions.test.ts

# ウォッチモードで実行（ファイル変更時に自動再実行）
npm test -- --watch
```

#### テストの追加方法

1. `workers/__tests__/` ディレクトリに新しいテストファイルを作成（例: `new-feature.test.ts`）
2. `describe` と `it` を使ってテストを記述
3. `npm test` でテストを実行

詳細なテスト実装例は `workers/__tests__/` ディレクトリ内のファイルを参照してください。

## 📚 ドキュメント

### 開発者向け

- [🔧 開発環境セットアップガイド](./docs/setup/development-guide.md)
- [📁 プロジェクト構造](./docs/guides/project-structure.md)
- [📝 コーディング標準](./docs/guides/coding-standards.md)
- [🌐 Cloudflareデプロイメント](./docs/setup/cloudflare-deployment.md)

### API仕様

- [📡 API仕様書](./docs/api/api-specification.md)
- [🗺️ データベース設計](./docs/api/database-design.md)
- [🔐 認可ポリシー](./docs/api/authorization-policy.md)

### フロントエンド

- [🖥️ 画面仕様書](./docs/frontend/screen-specifications.md)
- [🎨 UIコンポーネント戦略](./docs/frontend/ui-component-strategy.md)

## 🔧 技術スタック

### バックエンド
- **Hono** - 軽量高速Webフレームワーク
- **Cloudflare Workers** - エッジコンピューティング
- **Drizzle ORM** - TypeScriptファーストORM
- **JWT** - 認証システム

### フロントエンド
- **React 19** - UIライブラリ
- **React Router 7** - ルーティング
- **Tailwind CSS** - スタイリング
- **Vite** - ビルドツール

### 開発ツール
- **TypeScript 5.7** - 型安全性
- **ESLint** - コード品質
- **Prettier** - コードフォーマット

## 💼 ハッカソン情報

- **対象**: 高校生〜大学院生
- **テーマ**: AIを活用したオンライン診療ソリューション
- **必須技術**: Amazon Chime SDK、Cursor IDE、Git/GitHub

## 🎯 主な機能

- 患者・医療従事者ログイン
- 予約管理システム
- 問診票機能
- ビデオ通話（Amazon Chime SDK統合予定）
- チャット機能
- 診察記録管理

## 🔒 セキュリティ

- JWTベース認証
- パスワードハッシュ化（bcryptjs）
- ロールベースアクセス制御
- 実患者データ使用禁止

## 🤝 コントリビュート

1. このリポジトリをフォーク
2. 新しいブランチを作成
3. 変更を加えてプルリクエストを作成

詳細は[CONTRIBUTING.md](./CONTRIBUTING.md)を参照してください。

## 📝 ライセンス

MIT License
