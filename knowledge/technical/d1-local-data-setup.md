# Cloudflare D1 ローカルデータ投入手順

## 概要

Cloudflare D1のローカル開発環境にテストデータを投入する手順です。

## 手順

### 1. データベースの初期化

```bash
# DBファイルを削除（完全リセットする場合）
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*

# D1データベースを初期化
npx wrangler d1 execute medical-consultation-db --local --command "SELECT 1"
```

### 2. テーブルの作成

```bash
# SQLファイルからテーブルを作成
npx wrangler d1 execute medical-consultation-db --local --file drizzle/push.sql
```

### 3. テストデータの投入

```bash
# テストデータを投入
npx wrangler d1 execute medical-consultation-db --local --file tmp-script/test-data.sql
```

## テストアカウント

| ロール | メールアドレス | パスワード |
|--------|---------------|------------|
| 患者 | patient@test.com | test1234 |
| 医師 | doctor@test.com | test1234 |
| オペレータ | operator@test.com | test1234 |

## ビデオ通話テスト

テストデータには進行中のビデオセッション（ID: `test-session-001`）が含まれています：

- 患者側URL: http://localhost:5173/patient/consultation/test-session-001
- 医師側URL: http://localhost:5173/worker/doctor/consultation/test-session-001

## トラブルシューティング

### テーブルが存在しないエラー

```bash
# drizzle-kit pushの代わりに、SQLファイルを直接実行
npx wrangler d1 execute medical-consultation-db --local --file drizzle/push.sql
```

### データの確認

```bash
# 患者データの確認
npx wrangler d1 execute medical-consultation-db --local --command "SELECT * FROM patients"

# ビデオセッションの確認
npx wrangler d1 execute medical-consultation-db --local --command "SELECT * FROM video_sessions"
```

## 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体のガイド
- [データベース設計書](../../docs/api/database-design.md)