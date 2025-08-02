# 開発環境セットアップガイド

## 必要な環境

- Node.js 18.0.0以上
- npm 9.0.0以上
- Git

## クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/your-org/fd-hackathon-2025.git
cd fd-hackathon-2025

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

開発サーバーが起動したら、http://localhost:5173 でアプリケーションにアクセスできます。

## 開発コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（フロントエンド + バックエンド） |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run typecheck` | TypeScript型チェック |
| `npm run lint` | ESLintチェック |
| `npm run lint:fix` | ESLintチェック |
| `npm run format` | Prettierでコードフォーマット |
| `npm run deploy` | Cloudflare Workersへデプロイ |

## VS Code設定

本プロジェクトには`.vscode/`ディレクトリにVS Code設定が含まれています：

- **保存時自動フォーマット**: 有効
- **ESLint自動修正**: 有効
- **推奨拡張機能**: `.vscode/extensions.json`に定義

VS Codeを使用する場合は、推奨拡張機能のインストールを促すポップアップが表示されます。

## Git操作

### コミット前チェックリスト

1. TypeScript型チェック: `npm run typecheck`
2. Lintチェック: `npm run lint`
3. 秘密情報の確認（API_KEY、パスワード等が含まれていないか）
4. 適切なコミットメッセージの作成

### コミットコマンド

```bash
# Cursorの場合
/commit

# 通常のGit
git add .
git commit -m "feat: 機能の説明"
```

## トラブルシューティング

### 型エラーが発生する場合

```bash
# 型定義の再生成
npm run cf-typegen
```

### ESLintエラーが発生する場合

```bash
# 自動修正可能なエラーを修正
npm run lint -- --fix
```

### ポート競合エラー

開発サーバーのポートが使用中の場合：

```bash
# 別のポートで起動
PORT=5174 npm run dev
```

## 関連ドキュメント

- [技術仕様書](./technical-specification.md)
- [環境変数設定](./environment-variables.md)
- [Cloudflareデプロイメント](./cloudflare-deployment.md)
