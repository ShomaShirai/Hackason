# コントリビューションガイド

## 開発環境のセットアップ

1. リポジトリをフォーク
2. ローカルにクローン
3. 依存関係をインストール

```bash
git clone https://github.com/your-username/fd-hackathon-2025.git
cd fd-hackathon-2025
npm install
```

## ブランチ戦略

- `main`: 本番環境
- `develop`: 開発環境
- `feat/*`: 新機能開発
- `fix/*`: バグ修正

## コミット前チェック

```bash
# 型チェック
npm run typecheck

# Lintチェック
npm run lint

# フォーマット
npm run format
```

## プルリクエスト

1. developブランチから新しいブランチを作成
2. 変更を実装
3. テストを追加/更新
4. コミット（コミットメッセージは[コーディング標準](./docs/guides/coding-standards.md)を参照）
5. プルリクエストを作成

## レビュープロセス

- 最低1名のレビューが必要
- CIチェックがすべて通過していること
- コンフリクトが解決されていること

## 質問・相談

Issueを作成してください。