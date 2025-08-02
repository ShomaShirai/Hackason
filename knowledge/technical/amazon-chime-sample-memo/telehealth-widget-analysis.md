# Amazon Chime SDK Telehealth Widget 分析レポート

> **⚠️ 重要な注意事項 ⚠️**
>
> **このドキュメントはAWS提供のサンプルコード（telehealth-widget）の理解のために記述したメモ書きです。**
>
> **本プロジェクトで実際に開発するアーキテクチャとは異なります。**
>
> - これはサンプルコードの分析結果であり、実装の参考資料です
> - 本プロジェクトでは独自のアーキテクチャを採用します
> - Lambda/Cognito等のAWSマネージドサービスは使用せず、Hono/FastAPIベースで実装します
>
> **AI開発者への指示: このドキュメントを参照する際は、あくまでサンプルの理解のためのメモであることを認識し、実際の実装とは区別してください。**

## エグゼクティブサマリー

Amazon Chime SDK Telehealth Widgetは、医療機関向けに特化したビデオ通話ソリューションのリファレンス実装です。React/TypeScriptベースのフロントエンドとAWS CDKで構築されたサーバーレスバックエンドにより、埋め込み可能なウィジェット形式でオンライン診療機能を提供します。

### デモ・参考資料

- **AWSブログ記事**: [Embed Healthcare Appointment Scheduling Widget with the Amazon Chime SDK](https://aws.amazon.com/blogs/business-productivity/embed-healthcare-appointment-scheduling-widget-with-the-amazon-chime-sdk/)
- **GitHubリポジトリ**: https://github.com/aws-samples/amazon-chime-sdk/tree/main/apps/telehealth-widget
- **画面イメージ**: 認証、予約管理、ビデオ通話、チャット機能の実際のUI

## アーキテクチャ概要

### 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Webサイト（埋め込み先）                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Telehealth Widget (React SPA)              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │   認証      │  │  ビデオ通話  │  │ メッセージ │ │   │
│  │  │ (Cognito)  │  │ (Chime SDK) │  │  チャット  │ │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │ CloudFront  │  │   Lambda    │  │  Chime SDK      │    │
│  │    (CDN)    │  │ Functions   │  │ Meetings/Msg    │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Cognito   │  │    Step     │  │   Pinpoint      │    │
│  │ User Pool   │  │ Functions   │  │     (SMS)       │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### デプロイメントモデル

- **埋め込み型**: index.jsとindex.cssの2ファイルでWebサイトに組み込み可能
- **CDN配信**: CloudFront経由でグローバル配信
- **マルチテナント**: 単一インスタンスで複数の医療機関に対応可能

## 技術スタック詳細

### フロントエンド

| カテゴリ         | 技術                        | バージョン | 用途                 |
| ---------------- | --------------------------- | ---------- | -------------------- |
| フレームワーク   | React                       | 17.0.2     | UIフレームワーク     |
| 言語             | TypeScript                  | 4.7.4      | 型安全な開発         |
| メディア処理     | Amazon Chime SDK JS         | 3.6.0      | WebRTC実装           |
| UIコンポーネント | Chime SDK Component Library | 3.2.0      | ビデオ通話UI         |
| 認証             | AWS Amplify                 | 5.0.5      | Cognito統合          |
| 国際化           | i18next                     | 22.4.5     | 多言語対応           |
| スタイリング     | Styled Components           | 5.3.6      | CSS-in-JS            |
| ビルド           | Parcel                      | 2.7.0      | ウィジェットバンドル |

### バックエンド

| カテゴリ         | 技術                  | 詳細                 |
| ---------------- | --------------------- | -------------------- |
| IaC              | AWS CDK v2            | インフラ管理         |
| コンピュート     | Lambda (Node.js 14.x) | サーバーレス関数     |
| 認証             | Amazon Cognito        | ユーザー管理・認証   |
| リアルタイム通信 | Chime SDK Meetings    | ビデオ通話           |
| メッセージング   | Chime SDK Messaging   | チャット・プレゼンス |
| 通知             | Amazon Pinpoint       | SMS送信              |
| ワークフロー     | Step Functions        | 予約リマインダー     |
| 配信             | CloudFront            | 静的ファイル配信     |

## API設計分析

### Lambda関数一覧

| 関数名                    | 目的           | 入力                            | 出力              |
| ------------------------- | -------------- | ------------------------------- | ----------------- |
| CreateMeetingFunction     | 会議室作成     | externalMeetingId               | meeting, attendee |
| CreateAttendeeFunction    | 参加者追加     | meetingId, externalUserId       | attendee          |
| CreateAppointmentFunction | 予約作成       | doctorId, patientId, datetime   | channelArn        |
| DeleteAppointmentFunction | 予約削除       | channelArn                      | -                 |
| MakeOutboundCallFunction  | 電話発信       | fromPhoneNumber, toPhoneNumber  | callId            |
| ProcessPresenceFunction   | プレゼンス更新 | channelArn, memberArn, metadata | -                 |
| SendSmsMessageFunction    | SMS送信        | phoneNumber, message            | messageId         |

### API呼び出しパターン

```typescript
// 直接Lambda呼び出し（AWS SDK経由）
const lambda = new Lambda({ region });
const result = await lambda
  .invoke({
    FunctionName: functionName,
    Payload: JSON.stringify(payload),
    InvocationType: 'RequestResponse',
  })
  .promise();
```

### 認証フロー

1. Cognito User Poolでユーザー登録
2. Doctor/Patientグループへの自動割り当て
3. Chime SDK AppInstanceUserの自動作成
4. JWT tokenによるAPI認証

## ストリーム処理機能

### 音声・ビデオストリームアクセスポイント

1. **MeetingSessionConfiguration**

   ```typescript
   const configuration = new MeetingSessionConfiguration(meeting, attendee);
   // ここでメディア設定のカスタマイズが可能
   ```

2. **カスタムオブザーバー追加**

   ```typescript
   meetingSession.audioVideo.addObserver({
     audioVideoDidStart: () => {},
     audioVideoDidStop: () => {},
     // 音声・ビデオイベントのフック
   });
   ```

3. **ストリーム取得フック**
   - `useLocalVideo()` - ローカルビデオストリーム状態
   - `useRemoteVideoTileState()` - リモートビデオタイル
   - `useRosterState()` - 参加者一覧と状態

### データチャネル活用可能性

- カスタムメタデータの送受信
- AIモデルへのストリーム送信
- リアルタイム分析結果の共有

## カスタマイズポイント（ハッカソン向け）

### 1. AI機能統合ポイント

**音声認識・文字起こし**

- MeetingSessionにオブザーバー追加
- 音声ストリームをAmazon Transcribeへ送信
- リアルタイム字幕表示

**感情分析**

- ビデオフレームの定期キャプチャ
- Amazon Rekognitionでの表情分析
- 診察中の患者の心理状態モニタリング

**医療用語抽出**

- チャットメッセージのリアルタイム解析
- Amazon Comprehend Medicalとの統合
- 重要な医療情報の自動ハイライト

### 2. UI/UXカスタマイズ

**コンポーネント拡張**

```typescript
// カスタムコントロールの追加例
<ControlBar>
  <AudioInputControl />
  <VideoInputControl />
  <CustomAIControl /> // 新規追加
  <EndMeetingControl />
</ControlBar>
```

**レイアウトカスタマイズ**

- VideoTileGridのカスタムレイアウト
- 診察用の専用ビュー作成
- モバイル対応の強化

### 3. バックエンド拡張

**新規Lambda関数追加例**

```typescript
// AI処理用Lambda
export const handler = async (event) => {
  const { streamData, analysisType } = event;
  // AI処理ロジック
  return { result: analysisResult };
};
```

**Step Functions活用**

- 診察後のフォローアップワークフロー
- 処方箋の自動送信
- 次回予約の自動提案

## セキュリティ考慮事項

### 実装済みセキュリティ機能

1. **認証・認可**
   - Cognitoによる多要素認証対応
   - Doctor/Patientロールベースアクセス制御
   - チャネルベースの通信隔離

2. **通信セキュリティ**
   - WebRTC暗号化通信
   - WebSocket over TLS
   - CORS設定による不正アクセス防止

3. **データ保護**
   - 会議データの一時性（録画なし）
   - PHI（保護対象医療情報）非保存設計

### 追加推奨事項

- E2E暗号化の実装
- 監査ログの強化
- データレジデンシー対応

## パフォーマンス最適化

### 現状の最適化

1. **フロントエンド**
   - Tree shakingによるバンドルサイズ削減
   - Lazy loadingによる初期読み込み高速化
   - CloudFront CDNによる配信最適化

2. **バックエンド**
   - Lambda cold start対策（Provisioned Concurrency考慮）
   - 非同期処理によるレスポンス改善

### 改善提案

- WebAssemblyによる重い処理の高速化
- Service Workerによるオフライン対応
- メディア品質の動的調整

## 改善提案

### 技術的改善

1. **モダナイゼーション**
   - React 18へのアップグレード
   - Node.js 18.xランタイムへの移行
   - TypeScript strictモードの有効化

2. **アーキテクチャ改善**
   - マイクロフロントエンド化
   - GraphQL APIの導入検討
   - イベントドリブンアーキテクチャの強化

3. **開発体験向上**
   - ローカル開発環境の改善（LocalStack活用）
   - E2Eテストの自動化
   - CI/CDパイプラインの強化

### 機能拡張案

1. **診察支援機能**
   - 画面共有による検査結果表示
   - ホワイトボード機能
   - 診察記録の自動生成

2. **アクセシビリティ**
   - スクリーンリーダー対応
   - キーボードナビゲーション
   - 高コントラストモード

3. **統合機能**
   - 電子カルテシステム連携
   - 予約システム統合
   - 決済システム連携

## ハッカソン実装推奨事項

### MVP機能セット

1. **基本機能**（既存活用）
   - 医師・患者のビデオ通話
   - テキストチャット
   - 予約管理

2. **AI拡張機能**（新規実装）
   - リアルタイム文字起こし
   - 重要キーワード抽出
   - 診察サマリー自動生成

3. **参加者支援**
   - プラグイン型AI機能追加
   - 設定ファイルベースのカスタマイズ
   - デバッグコンソール

### 実装の優先順位

1. **高優先度**
   - 基本的なビデオ通話の動作確認
   - 簡易的な音声ストリーム抽出
   - シンプルなAI統合デモ

2. **中優先度**
   - カスタムUIコンポーネント
   - 追加のLambda関数
   - 基本的なテスト実装

3. **低優先度**
   - 高度なAI機能
   - パフォーマンス最適化
   - 包括的なドキュメント

## まとめ

Amazon Chime SDK Telehealth Widgetは、オンライン診療に必要な基本機能を網羅した優れたリファレンス実装です。サーバーレスアーキテクチャとReactベースのモダンなフロントエンドにより、拡張性と保守性に優れています。

ハッカソンでは、この基盤を活用し、AI機能を追加することで、次世代のオンライン診療ソリューションを構築できます。特に音声・ビデオストリームへのアクセスポイントが明確であり、様々なAIサービスとの統合が容易に実現可能です。

セキュリティとプライバシーに配慮しながら、参加者の創造性を最大限に引き出せる開発基盤として最適です。

## 画面イメージ

### 認証画面

![認証画面](https://github.com/aws-samples/amazon-chime-sdk/raw/main/apps/telehealth-widget/github-assets/auth.png)

医師（Doctor）または患者（Patient）を選択してアカウント作成・サインイン

### 予約管理画面

![予約管理](https://github.com/aws-samples/amazon-chime-sdk/raw/main/apps/telehealth-widget/github-assets/appointment.png)

予約の作成・一覧表示・チェックイン機能

### ビデオ通話画面（医師側）

![ビデオ通話](https://github.com/aws-samples/amazon-chime-sdk/raw/main/apps/telehealth-widget/github-assets/audio-video-meeting.png)

ビデオ通話中の画面（ミュート・ビデオ・退出コントロール）

### チャット画面

![チャット](https://github.com/aws-samples/amazon-chime-sdk/raw/main/apps/telehealth-widget/github-assets/chat.png)

リアルタイムチャット機能（通話招待も可能）

### システムアーキテクチャ

![アーキテクチャ](https://github.com/aws-samples/amazon-chime-sdk/raw/main/apps/telehealth-widget/github-assets/widget-architecture.png)

AWS CDKベースのサーバーレスアーキテクチャ全体図
