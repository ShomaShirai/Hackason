# 事前環境構築ガイド

## 技術スタック概要

本プロジェクトは以下の技術スタックで構築されています：
- フロントエンド: React Router + React 19 (SSR対応)
- バックエンド: Hono (軽量Webフレームワーク) on Cloudflare Workers
- データベース: Cloudflare D1 (SQLite) + Drizzle ORM
- ビデオ通話: Cloudflare Calls (Realtime API)
- 開発環境: TypeScript, Vite, Tailwind CSS
- デプロイ: Cloudflare Workers/Pages

## 事前セットアップ

ハッカソン開始前に以下のツールをインストールしておいてください。

### Mac環境

1. Node.js 20以上をインストール:
   - Homebrewを使う場合: `brew install node`
   - または[nodejs.org](https://nodejs.org)から直接ダウンロード
2. Cursorエディタをインストール:
   - [cursor.com](https://cursor.com)からダウンロード
   - 大学生はGitHub Student Packで無償利用可能
3. Wranglerをインストール: `npm install -g wrangler`
4. インストール確認:
   - `node --version` (v20以上)
   - `npm --version`
   - `wrangler --version`

### Windows環境

1. Node.js 20以上をインストール:
   - [nodejs.org](https://nodejs.org)から最新のLTS版をダウンロード
   - インストーラーを実行（npm同時インストール）
2. Cursorエディタをインストール:
   - [cursor.com](https://cursor.com)からダウンロード
   - 大学生はGitHub Student Packで無償利用可能
3. PowerShellを管理者権限で開き、Wranglerをインストール:
   - `npm install -g wrangler`
4. インストール確認:
   - `node --version` (v20以上)
   - `npm --version`
   - `wrangler --version`

## Cursor無償利用について

大学生の方は大学のメールアドレスでGitHub Student Packに登録することで、Cursorを無償で利用できます。
詳細: https://qiita.com/mattsunkun/items/66386eb047488db928a6
