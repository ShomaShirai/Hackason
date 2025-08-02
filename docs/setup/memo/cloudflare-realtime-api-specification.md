# Cloudflare Realtime API 仕様書

## 概要

Cloudflare Realtime（旧Calls）は、WebRTCベースのリアルタイム通信インフラストラクチャです。SFU（Selective Forwarding Unit）として機能し、グローバルネットワーク上でビデオ・音声・データの通信を実現します。

## API基本情報

### ベースURL
```
https://rtc.live.cloudflare.com/apps/{APP_ID}
```

### 認証
- Bearer Token認証を使用
- ヘッダー: `Authorization: Bearer {APP_SECRET}`

### 必要な認証情報
1. **APP_ID**: Cloudflare Dashboardで作成したアプリケーションID
2. **APP_SECRET**: アプリケーションのシークレットトークン

## 主要APIエンドポイント

### 1. セッション管理

#### セッション作成
```
POST /sessions/new
```

リクエストボディ:
```json
{
  "sessionDescription": {
    "type": "offer",
    "sdp": "v=0..."
  }
}
```

レスポンス:
```json
{
  "sessionId": "unique-session-id",
  "sessionDescription": {
    "type": "answer",
    "sdp": "v=0..."
  }
}
```

#### 再ネゴシエーション
```
POST /sessions/{sessionId}/renegotiate
```

### 2. トラック管理

#### トラック追加
```
POST /sessions/{sessionId}/tracks/new
```

リクエストボディ:
```json
{
  "tracks": [
    {
      "location": "local",
      "trackName": "audio-track-1",
      "kind": "audio",
      "bidirectionalMediaStream": true
    }
  ],
  "sessionDescription": {
    "type": "offer",
    "sdp": "v=0..."
  }
}
```

レスポンス:
```json
{
  "tracks": [
    {
      "trackName": "audio-track-1",
      "mid": "0",
      "errorCode": null,
      "errorDescription": null
    }
  ],
  "sessionDescription": {
    "type": "answer",
    "sdp": "v=0..."
  }
}
```

#### トラッククローズ
```
POST /sessions/{sessionId}/tracks/close
```

リクエストボディ:
```json
{
  "tracks": [
    {
      "mid": "0"
    }
  ]
}
```

## WebRTC統合パターン

### 基本的な接続フロー

1. **セッション作成**
   - クライアントがWebRTC PeerConnectionを作成
   - Offerを生成し、`/sessions/new`エンドポイントに送信
   - Cloudflareからanswerを受け取り、PeerConnectionに設定

2. **ICE候補の処理**
   - Cloudflare TURNサーバーを使用
   - STUN: `stun.cloudflare.com:3478`
   - TURN: `turn.cloudflare.com:3478`

3. **メディアストリーム管理**
   - `getUserMedia()`でローカルストリームを取得
   - トラックをPeerConnectionに追加
   - `/tracks/new`でCloudflare側にトラック情報を登録

## 実装例（Orange Meetsベース）

### CallsSessionクラス
```typescript
export class CallsSession {
  sessionId: string
  headers: any
  endpoint: string
  
  constructor(sessionId: string, headers: any, endpoint: string) {
    this.sessionId = sessionId
    this.headers = headers
    this.endpoint = endpoint
  }
  
  async NewTracks(body: any): Promise<NewTracksResponse> {
    const url = `${this.endpoint}/sessions/${this.sessionId}/tracks/new`
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    return response.json()
  }
}
```

### セッション作成関数
```typescript
export async function CallsNewSession(
  appID: string,
  appToken: string
): Promise<CallsSession> {
  const headers = {
    Authorization: `Bearer ${appToken}`,
    'Content-Type': 'application/json',
  }
  
  const endpoint = `https://rtc.live.cloudflare.com/apps/${appID}`
  const response = await fetch(`${endpoint}/sessions/new`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  
  const sessionResponse = await response.json()
  return new CallsSession(sessionResponse.sessionId, headers, endpoint)
}
```

## 重要な考慮事項

### セキュリティ
- APP_SECRETは必ずサーバーサイドで管理
- クライアントサイドには露出させない
- CORS設定に注意

### パフォーマンス
- Cloudflareのグローバルネットワークを活用
- 最寄りのエッジロケーションに自動接続
- Anycastルーティングで低遅延を実現

### 制限事項
- セッションあたりの同時接続数
- 帯域幅の制限
- パケットレートの制限

## 医療用途への適用

### 必要な追加実装
1. **認証連携**: JWTトークンとの統合
2. **ロール管理**: 患者/医師の権限制御
3. **録画機能**: 診察記録用の録画API
4. **暗号化**: エンドツーエンド暗号化（MLS）
5. **監査ログ**: アクセスログとセッション履歴

### 推奨アーキテクチャ
- Cloudflare Workers: バックエンドAPI
- Durable Objects: セッション状態管理
- D1: ユーザー情報・セッション履歴
- R2: 録画ファイルストレージ