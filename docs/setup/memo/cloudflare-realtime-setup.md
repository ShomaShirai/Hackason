# Cloudflare Realtime統合ガイド

## 概要

本ドキュメントは、オンライン診療システムにCloudflare Realtimeを統合し、医師-患者間の双方向ビデオ通話を実現するための技術設計書です。

## アーキテクチャ概要

### 現在のアーキテクチャ（Hono + React Router 7）

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Router   │     │    Hono API     │     │ Cloudflare D1   │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Cloudflare Realtime統合後のアーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Router   │     │    Hono API     │     │ Cloudflare D1   │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (Database)    │
│                 │     │                 │     └─────────────────┘
│  + CF Realtime  │     │ + Calls API     │
│      SDK        │     │   Integration   │     ┌─────────────────┐
└─────────────────┘     └─────────────────┘────▶│ Cloudflare      │
         │                                       │ Calls API       │
         └──────────────────────────────────────▶└─────────────────┘
                     WebRTC Connection
```

## 統合設計

### 1. バックエンド統合（Hono）

#### 1.1 Cloudflare Calls APIクライアント

```typescript
// workers/realtime/calls-client.ts
export class CloudflareCallsClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl = 'https://rtc.live.cloudflare.com';

  constructor(env: Env) {
    this.appId = env.CF_CALLS_APP_ID;
    this.appSecret = env.CF_CALLS_APP_SECRET;
  }

  async createSession(sessionId: string): Promise<CallsSession> {
    const response = await fetch(`${this.baseUrl}/apps/${this.appId}/sessions/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    });
    
    return response.json();
  }

  async createTrack(sessionId: string, trackName: string): Promise<CallsTrack> {
    const response = await fetch(`${this.baseUrl}/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        trackName,
        location: 'remote'
      })
    });
    
    return response.json();
  }
}
```

#### 1.2 API エンドポイント実装

```typescript
// workers/app.ts に追加
import { CloudflareCallsClient } from './realtime/calls-client';

// ビデオセッション作成
app.post('/api/video-sessions/create', authMiddleware(), async (c) => {
  const { appointmentId } = await c.req.json();
  const user = c.get('user');
  const db = c.env.DB as D1Database;
  
  // 予約の検証
  const appointment = await db.prepare(
    'SELECT * FROM appointments WHERE id = ?'
  ).bind(appointmentId).first();
  
  if (!appointment) {
    return c.json({ error: 'Appointment not found' }, 404);
  }
  
  // Cloudflare Callsセッション作成
  const callsClient = new CloudflareCallsClient(c.env);
  const sessionId = crypto.randomUUID();
  const session = await callsClient.createSession(sessionId);
  
  // データベースに保存
  await db.prepare(
    `INSERT INTO video_sessions 
     (id, appointment_id, realtime_session_id, status, created_at) 
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    appointmentId,
    sessionId,
    'active',
    new Date().toISOString()
  ).run();
  
  return c.json({
    sessionId,
    appId: c.env.CF_CALLS_APP_ID,
    token: session.token
  });
});

// トラック作成（音声・ビデオ）
app.post('/api/video-sessions/:sessionId/tracks', authMiddleware(), async (c) => {
  const { sessionId } = c.req.param();
  const { trackType } = await c.req.json(); // 'audio' | 'video'
  const user = c.get('user');
  
  const callsClient = new CloudflareCallsClient(c.env);
  const trackName = `${user.userType}-${user.id}-${trackType}`;
  
  const track = await callsClient.createTrack(sessionId, trackName);
  
  return c.json({
    trackId: track.trackId,
    trackName,
    location: track.location
  });
});
```

### 2. フロントエンド統合（React）

#### 2.1 Cloudflare Realtime SDKコンポーネント

```tsx
// app/components/CloudflareRealtimeVideo.tsx
import { useEffect, useRef, useState } from 'react';
import { CloudflareStream } from '@cloudflare/stream-react';

interface CloudflareRealtimeVideoProps {
  appointmentId: string;
  userType: 'patient' | 'worker';
  onSessionEnd?: () => void;
}

export function CloudflareRealtimeVideo({ 
  appointmentId, 
  userType,
  onSessionEnd 
}: CloudflareRealtimeVideoProps) {
  const [session, setSession] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanupSession();
    };
  }, [appointmentId]);

  const initializeSession = async () => {
    try {
      // 1. セッション作成
      const response = await fetch('/api/video-sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId })
      });
      
      const sessionData = await response.json();
      
      // 2. WebRTC接続初期化
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' }
        ]
      });
      
      // 3. ローカルメディア取得
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // 4. トラック追加
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // 5. リモートストリーム処理
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };
      
      setSession({ pc, sessionData });
      
    } catch (error) {
      console.error('Failed to initialize session:', error);
    }
  };

  const cleanupSession = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (session?.pc) {
      session.pc.close();
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const endCall = async () => {
    cleanupSession();
    
    if (session?.sessionData?.sessionId) {
      await fetch(`/api/video-sessions/${session.sessionData.sessionId}/end`, {
        method: 'POST'
      });
    }
    
    onSessionEnd?.();
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div className="relative">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full bg-gray-900 rounded-lg"
        />
        <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded">
          自分 ({userType === 'patient' ? '患者' : '医師'})
        </div>
      </div>
      
      <div className="relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full bg-gray-900 rounded-lg"
        />
        <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-1 rounded">
          {userType === 'patient' ? '医師' : '患者'}
        </div>
      </div>
      
      <div className="col-span-2 flex justify-center gap-4 mt-4">
        <button
          onClick={toggleAudio}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          音声 ON/OFF
        </button>
        <button
          onClick={toggleVideo}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ビデオ ON/OFF
        </button>
        <button
          onClick={endCall}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          通話終了
        </button>
      </div>
    </div>
  );
}
```

#### 2.2 既存VideoCallComponentの置き換え

```tsx
// app/components/VideoCallComponent.tsx を更新
import { CloudflareRealtimeVideo } from './CloudflareRealtimeVideo';

export function VideoCallComponent({ appointmentId, userType }: VideoCallProps) {
  return (
    <CloudflareRealtimeVideo 
      appointmentId={appointmentId}
      userType={userType}
      onSessionEnd={() => {
        // 通話終了後の処理
        window.location.href = userType === 'patient' 
          ? '/patient/dashboard' 
          : '/worker/dashboard';
      }}
    />
  );
}
```

### 3. 環境変数設定

#### 3.1 開発環境（.env.local）

```bash
# Cloudflare Calls設定
CF_CALLS_APP_ID=your_app_id_here
CF_CALLS_APP_SECRET=your_app_secret_here
```

#### 3.2 本番環境（wrangler.jsonc）

```json
{
  "vars": {
    "CF_CALLS_APP_ID": "your_app_id_here"
  },
  "secrets": [
    "CF_CALLS_APP_SECRET"
  ]
}
```

### 4. セキュリティ設計

#### 4.1 認証・認可

- JWTトークンによる認証必須
- 患者は自分の予約のみアクセス可能
- 医師は担当患者の予約にアクセス可能
- オペレータは全ての通話に参加可能（サポート用）

#### 4.2 データ保護

- セッションIDはUUID v4で生成
- トークンは一時的なものを使用
- 通話終了時にセッション情報をクリーンアップ

### 5. 実装フェーズ

1. **Phase 1**: Cloudflare Calls App作成と基本API実装
2. **Phase 2**: フロントエンドSDK統合と基本通話機能
3. **Phase 3**: 医療用途カスタマイズ（UI/UX、権限制御）
4. **Phase 4**: 音声ストリーム抽出機能追加
5. **Phase 5**: テストと最適化

## 次のステップ

1. Cloudflare DashboardでCalls Appを作成
2. App IDとSecretを取得して環境変数に設定
3. バックエンドAPIの実装
4. フロントエンドコンポーネントの実装
5. 統合テスト

---
😊（統合設計がまとまった）
**エントロピー**: 🟦🟦🟦🟦🟦 (2/5)