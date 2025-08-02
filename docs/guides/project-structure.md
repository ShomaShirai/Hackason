# プロジェクト構造

## ディレクトリ構成

```
fd-hackathon-2025/
├── app/                      # React Router フロントエンド
│   ├── routes/              # ページコンポーネント
│   ├── entry.server.tsx     # サーバーエントリーポイント
│   └── root.tsx            # ルートレイアウト
│
├── workers/                 # Hono バックエンド
│   ├── app.ts              # メインアプリケーション
│   ├── app-mock.ts         # モックAPI版
│   ├── auth/               # 認証関連
│   │   ├── jwt.ts         # JWT処理
│   │   ├── middleware.ts  # 認証ミドルウェア
│   │   ├── password.ts    # パスワード処理
│   │   └── session.ts     # セッション管理
│   └── db/                 # データベース
│       ├── schema.ts      # Drizzle ORMスキーマ
│       └── schemas.ts     # Zodスキーマ定義
│
├── types/                   # 型定義ファイル
│   ├── global.d.ts         # グローバル型定義
│   └── env.d.ts           # 環境変数型定義
│
├── docs/                    # ドキュメント
│   ├── api/               # API仕様書
│   ├── frontend/          # フロントエンド仕様
│   ├── setup/             # セットアップガイド
│   └── guides/            # 開発ガイド
│
├── .vscode/                # VS Code設定
│   ├── settings.json      # エディタ設定
│   ├── extensions.json    # 推奨拡張機能
│   ├── launch.json        # デバッグ設定
│   └── tasks.json         # タスク定義
│
└── work/                   # 作業管理
    └── taskfile/          # タスクファイル

```

## 主要ファイル

### 設定ファイル

| ファイル | 説明 |
|---------|------|
| `tsconfig.json` | TypeScript基本設定 |
| `tsconfig.cloudflare.json` | Cloudflare Workers用設定 |
| `tsconfig.node.json` | Node.js環境用設定 |
| `eslint.config.js` | ESLint設定 |
| `.prettierrc.json` | Prettier設定 |
| `wrangler.jsonc` | Cloudflare Workers設定 |
| `drizzle.config.ts` | Drizzle ORM設定 |
| `vite.config.ts` | Viteビルド設定 |
| `react-router.config.ts` | React Router設定 |

### エントリーポイント

| ファイル | 説明 |
|---------|------|
| `workers/app.ts` | バックエンドのメインファイル |
| `app/root.tsx` | フロントエンドのルートコンポーネント |
| `app/routes.ts` | ルート定義 |

## アーキテクチャ概要

### バックエンド (Hono)

- **フレームワーク**: Hono 4.8
- **実行環境**: Cloudflare Workers
- **データベース**: Drizzle ORM + D1 (SQLite)
- **認証**: JWT (HS256)

### フロントエンド (React Router)

- **フレームワーク**: React 19 + React Router 7
- **ビルドツール**: Vite 6
- **スタイリング**: Tailwind CSS
- **型チェック**: TypeScript 5.7

## 開発フロー

1. **ルート追加**
   - `app/routes/`に新しいファイルを作成
   - ファイル名がURLパスになる（例：`login.tsx` → `/login`）

2. **API追加**
   - `workers/app.ts`に新しいエンドポイントを定義
   - `/api/*`のパスで定義

3. **データベース変更**
   - `workers/db/schema.ts`を編集
   - `npm run db:generate`でマイグレーション生成
   - `npm run db:migrate`で適用

## 命名規則

- **ファイル名**: kebab-case（例：`user-profile.tsx`）
- **コンポーネント**: PascalCase（例：`UserProfile`）
- **関数**: camelCase（例：`getUserProfile`）
- **定数**: UPPER_SNAKE_CASE（例：`MAX_RETRY_COUNT`）
- **型定義**: PascalCase（例：`UserProfile`）

## セキュリティ考慮事項

- 秘密情報（API_KEY、パスワード等）はコミットしない
- 環境変数は`.env.local`で管理（`.gitignore`に含まれる）
- 患者情報は実データを使用しない（ダミーデータのみ）