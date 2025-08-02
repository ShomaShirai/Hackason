# Cloudflare Orange Meets 分析レポート

## 概要

Cloudflare Orange MeetsはCloudflare Calls APIを使用したWebRTCビデオ通話デモアプリケーションです。エンドツーエンド暗号化（E2EE）とOpenAI Realtime API統合が特徴的です。

## アーキテクチャ

### 技術スタック

- **フロントエンド**: Remix (React フレームワーク)
- **バックエンド**: Cloudflare Workers + Durable Objects
- **データベース**: Cloudflare D1 (SQLite)
- **リアルタイム通信**: Cloudflare Calls API + PartySocket
- **E2EE**: MLS (Message Layer Security) プロトコル
- **ビルドツール**: Wrangler

### 主要コンポーネント

#### 1. Cloudflare Calls統合 (`app/utils/openai.server.ts`)

```typescript
export async function CallsNewSession(
  appID: string,
  appToken: string,
  apiExtraParams?: string,
  meetingId?: string,
  thirdparty = false
): Promise<CallsSession>
```

- Cloudflare Calls APIの`/sessions/new`エンドポイントを使用
- Bearer Token認証（`CALLS_APP_SECRET`）
- セッションIDを取得してCallsSessionオブジェクトを返す

#### 2. Durable Object (`app/durableObjects/ChatRoom.server.ts`)

- ルームの状態管理
- WebSocketメッセージのハンドリング
- ユーザーの入退室管理
- AI機能の有効化/無効化

#### 3. WebRTC統合 (`app/hooks/usePeerConnection.tsx`)

- MediaStream管理
- PeerConnection確立
- ICE候補の処理
- Track管理（audio/video）

### API統合パターン

#### セッション作成フロー

1. クライアントがルームに参加
2. ChatRoom Durable ObjectがCallsNewSessionを呼び出し
3. Cloudflare Calls APIからセッションIDを取得
4. クライアントにセッション情報を返却
5. WebRTC接続を確立

#### トラック管理

```typescript
const openAiTracksResponse = await openAiSession.NewTracks({
  tracks: [{
    location: 'local',
    trackName: 'ai-generated-voice',
    bidirectionalMediaStream: true,
    kind: 'audio',
  }],
})
```

### 環境変数

必須:
- `CALLS_APP_ID`: Cloudflare Calls App ID
- `CALLS_APP_SECRET`: Cloudflare Calls App Secret

オプション:
- `MAX_WEBCAM_BITRATE`: 最大ビットレート（デフォルト: 1200000）
- `MAX_WEBCAM_FRAMERATE`: 最大フレームレート（デフォルト: 24）
- `MAX_WEBCAM_QUALITY_LEVEL`: 最大解像度（デフォルト: 1080）

### 医療用途への適用可能性

#### 利点
1. **エンドツーエンド暗号化**: MLSプロトコルによる高度なセキュリティ
2. **Cloudflare統一環境**: Workers, D1, Durable Objects, Calls APIの統合
3. **グローバルインフラ**: Cloudflareの335+拠点での低遅延
4. **AI統合**: OpenAI Realtime APIとの連携実績

#### カスタマイズポイント
1. **認証システム**: JWT認証の追加（医師/患者ロール）
2. **UI/UX**: 医療用途向けレイアウト（患者情報表示など）
3. **録画機能**: 診察記録用の録画機能追加
4. **音声ストリーム**: AI音声認識用のストリーム抽出

### 実装の要点

#### 1. Cloudflare Calls API エンドポイント
```
https://rtc.live.cloudflare.com/apps/{APP_ID}
```

#### 2. 必要な権限
- `/sessions/new`: 新規セッション作成
- `/sessions/{sessionId}/tracks/new`: トラック追加
- `/sessions/{sessionId}/tracks/close`: トラック削除
- `/sessions/{sessionId}/renegotiate`: 再ネゴシエーション

#### 3. WebRTC実装パターン
- PartySocketによるシグナリングサーバー
- Durable Objectsによる状態管理
- Cloudflare CallsによるSFU（Selective Forwarding Unit）

## 次のステップ

1. Cloudflare Calls APIの詳細仕様理解
2. 医療用途向けのセキュリティ要件定義
3. 患者-医師ロールベースアクセス制御の設計
4. 音声ストリーム抽出機能の実装方針策定