# App Directory Structure

## 概要
このディレクトリは、React Router 7を使用したフロントエンドアプリケーションのメインディレクトリです。

## ディレクトリ構造

```
app/
├── components/           # 再利用可能なUIコンポーネント
│   ├── auth/            # 認証関連コンポーネント
│   ├── chat/            # チャット機能コンポーネント
│   ├── common/          # 共通UIコンポーネント
│   ├── operator/        # オペレーター用コンポーネント
│   ├── CloudflareRealtimeVideo.tsx    # Cloudflare Realtime Video統合
│   ├── MedicalRecordModal.tsx         # 診察記録モーダル
│   ├── MedicalRecordPanel.tsx         # 診察記録パネル
│   ├── MedicalVideoCall.tsx           # 医療ビデオ通話
│   ├── PatientInfoPanel.tsx           # 患者情報パネル
│   ├── PrescriptionSection.tsx        # 処方箋セクション
│   └── VideoCallComponent.tsx         # ビデオ通話コンポーネント
├── contexts/            # React Context
├── hooks/               # カスタムReact Hooks
├── routes/              # ページルート
│   ├── patient/         # 患者向けページ
│   │   └── appointments/
│   │       └── new.tsx  # 新規予約作成ページ
│   ├── worker/          # 医療従事者向けページ
│   ├── home.tsx         # ホームページ
│   ├── patient.prescriptions.tsx  # 患者処方箋ページ
│   ├── patient.tsx      # 患者ページ
│   ├── test-medical-record.tsx    # 診察記録テストページ
│   └── worker.doctor.schedule.tsx # 医師スケジュールページ
├── services/            # APIサービス層
├── types/               # TypeScript型定義
├── utils/               # ユーティリティ関数
├── welcome/             # ウェルカムページ
├── app.css              # グローバルCSS
├── entry.server.tsx     # サーバーエントリーポイント
├── root.tsx             # ルートレイアウト
└── routes.ts            # ルート定義

```

## 主要コンポーネント

### 認証関連
- `components/auth/` - ログイン、認証状態管理

### 医療機能
- `MedicalVideoCall.tsx` - Amazon Chime SDK統合のビデオ通話
- `MedicalRecordModal.tsx` - 診察記録の作成・編集
- `PrescriptionSection.tsx` - 処方箋管理

### 共通UI
- `components/common/` - Loading、ErrorMessage等の共通コンポーネント

## ルーティング構造

### 患者向け
- `/patient/appointments/new` - 新規予約作成
- `/patient/prescriptions` - 処方箋確認

### 医療従事者向け
- `/worker/doctor/schedule` - 医師スケジュール管理

## 技術スタック

- **React 19** - UIライブラリ
- **React Router 7** - ルーティング
- **Tailwind CSS** - スタイリング
- **TypeScript** - 型安全性

## 主要機能

1. **認証システム** - JWTベースの患者・医療従事者認証
2. **予約管理** - オンライン予約システム
3. **ビデオ通話** - Cloudflare Realtime Video統合
4. **診察記録** - 電子カルテ機能
5. **処方箋管理** - デジタル処方箋

## 開発ガイドライン

### コンポーネント作成
- 機能別にディレクトリを分ける
- TypeScript型定義を必ず作成
- エラーハンドリングを実装

### ルーティング
- 患者・医療従事者で明確に分離
- 認証が必要なページは`RequireAuth`で保護

### スタイリング
- Tailwind CSSを使用
- レスポンシブデザインを考慮
- アクセシビリティに配慮 