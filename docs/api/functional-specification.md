# 機能仕様書

## 概要

本書は、オンライン診療システムの主要機能について、技術的な実装仕様を定義します。

## 1. ビデオ通話機能

### 1.1 概要

Amazon Chime SDKを使用したWebRTCベースのリアルタイムビデオ通話機能。医師と患者間の安全で高品質な映像・音声通信を実現します。

### 1.2 技術アーキテクチャ

```
┌──────────────┐     WebRTC      ┌──────────────┐
│   患者端末    │ <-------------> │   医師端末    │
│ (ブラウザ)    │                 │ (ブラウザ)    │
└──────────────┘                 └──────────────┘
       ↓                                 ↓
       └─────────┐         ┌─────────────┘
                 ↓         ↓
           ┌─────────────────────┐
           │  Amazon Chime SDK   │
           │   Media Server      │
           └─────────────────────┘
                     ↓
           ┌─────────────────────┐
           │   Backend API       │
           │  (Hono/FastAPI)     │
           └─────────────────────┘
```

### 1.3 機能要件

#### 基本機能

- **映像通信**: 最大1080p HD画質、30fps
- **音声通信**: エコーキャンセレーション、ノイズリダクション対応
- **画面共有**: 医師側から資料・検査結果の共有
- **録画機能**: 診察記録用（患者同意必須）
- **品質調整**: ネットワーク状況に応じた自動品質調整

#### セッション管理

- **会議室作成**: 予約IDに紐づく一意のセッション
- **参加者管理**: 医師・患者・同伴者の入退室制御
- **セキュリティ**: エンドツーエンド暗号化
- **タイムアウト**: 30分無操作で自動終了

### 1.4 実装仕様

#### フロントエンド実装

```typescript
// ビデオ通話コンポーネント
interface VideoCallProps {
  appointmentId: string;
  userRole: 'doctor' | 'patient' | 'companion';
}

// Chime SDK初期化
const initializeChimeSDK = async (meetingInfo: MeetingInfo) => {
  const logger = new ConsoleLogger('ChimeSDK', LogLevel.INFO);
  const deviceController = new DefaultDeviceController(logger);

  const configuration = new MeetingSessionConfiguration(meetingInfo.meeting, meetingInfo.attendee);

  const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);

  return meetingSession;
};

// 音声・映像デバイス設定
const setupDevices = async (meetingSession: MeetingSession) => {
  const audioInputDevices = await meetingSession.audioVideo.listAudioInputDevices();
  const videoInputDevices = await meetingSession.audioVideo.listVideoInputDevices();

  // デフォルトデバイスを選択
  await meetingSession.audioVideo.chooseAudioInputDevice(audioInputDevices[0].deviceId);
  await meetingSession.audioVideo.chooseVideoInputDevice(videoInputDevices[0].deviceId);
};

// ストリーム処理用オブザーバー
class AudioVideoObserver implements AudioVideoObserver {
  audioVideoDidStart(): void {
    console.log('セッション開始');
  }

  audioVideoDidStop(sessionStatus: MeetingSessionStatus): void {
    console.log('セッション終了:', sessionStatus);
  }

  videoTileDidUpdate(tileState: VideoTileState): void {
    // ビデオタイル更新時の処理
    if (tileState.localTile) {
      // ローカルビデオの表示
    } else {
      // リモートビデオの表示
    }
  }
}
```

#### バックエンド実装

```typescript
// Hono実装例
app.post('/api/meetings/create', async (c) => {
  const { appointmentId } = await c.req.json();

  // Chime SDK Meeting作成
  const chimeClient = new ChimeSDKMeetingsClient({ region: 'ap-northeast-1' });

  const createMeetingResponse = await chimeClient.send(
    new CreateMeetingCommand({
      ClientRequestToken: `appointment-${appointmentId}`,
      ExternalMeetingId: appointmentId,
      MediaRegion: 'ap-northeast-1',
      MeetingFeatures: {
        Audio: {
          EchoReduction: 'AVAILABLE',
        },
      },
    })
  );

  // 参加者追加
  const createAttendeeResponse = await chimeClient.send(
    new CreateAttendeeCommand({
      MeetingId: createMeetingResponse.Meeting.MeetingId,
      ExternalUserId: userId,
    })
  );

  return c.json({
    meeting: createMeetingResponse.Meeting,
    attendee: createAttendeeResponse.Attendee,
  });
});
```

### 1.5 エラーハンドリング

| エラーコード      | 説明                        | 対処法             |
| ----------------- | --------------------------- | ------------------ |
| DEVICE_NOT_FOUND  | カメラ/マイクが見つからない | デバイス許可を確認 |
| MEETING_FULL      | 会議室が満員                | 参加者数制限確認   |
| NETWORK_ERROR     | ネットワークエラー          | 接続を再試行       |
| PERMISSION_DENIED | 権限がない                  | ユーザー権限確認   |

### 1.6 パフォーマンス要件

- **接続時間**: 3秒以内
- **遅延**: 200ms未満
- **パケットロス耐性**: 5%まで許容
- **同時接続数**: 最大4名（医師、患者、同伴者2名）

## 2. チャット機能

### 2.1 概要

診察中のテキストコミュニケーションおよび、診察前後のメッセージ交換機能。

### 2.2 機能要件

- **リアルタイムメッセージ**: WebSocket使用
- **メッセージ履歴**: 診察記録として保存
- **ファイル共有**: 画像・PDF送信（最大10MB）
- **既読管理**: 送信・既読状態の表示
- **絵文字対応**: 基本的な絵文字セット

### 2.3 実装仕様

```typescript
// WebSocket接続
const connectChat = (channelId: string) => {
  const ws = new WebSocket(`wss://api.example.com/ws/chat/${channelId}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    // メッセージ表示処理
  };

  return ws;
};

// メッセージ送信
const sendMessage = (ws: WebSocket, content: string) => {
  ws.send(
    JSON.stringify({
      type: 'message',
      content,
      timestamp: new Date().toISOString(),
    })
  );
};
```

## 3. 音声ストリーム抽出機能

### 3.1 概要

診察中の音声をリアルタイムで抽出し、文字起こしやAI解析に利用する機能。

### 3.2 技術アーキテクチャ

```
音声ストリーム → AudioWorklet → WebSocket → AI処理サーバー
                                     ↓
                              文字起こし・解析結果
```

### 3.3 機能要件

- **リアルタイム抽出**: 100ms以下の遅延
- **音声フォーマット**: PCM 16bit, 16kHz
- **話者分離**: 医師・患者の音声を識別
- **プライバシー保護**: 一時保存のみ、診察終了後自動削除

### 3.4 実装仕様

```typescript
// 音声ストリーム処理
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (input.length > 0) {
      const audioData = this.convertToPCM16(input[0]);
      this.port.postMessage({ audioData });
    }
    return true;
  }

  convertToPCM16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }
}

// メインスレッドでの処理
const setupAudioExtraction = async (stream: MediaStream) => {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);

  await audioContext.audioWorklet.addModule('audio-processor.js');
  const audioProcessor = new AudioWorkletNode(audioContext, 'audio-processor');

  audioProcessor.port.onmessage = (event) => {
    // WebSocket経由でサーバーに送信
    sendAudioData(event.data.audioData);
  };

  source.connect(audioProcessor);
  audioProcessor.connect(audioContext.destination);
};
```

### 3.5 AI連携仕様

```typescript
// 音声認識結果の受信
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'transcription':
      // リアルタイム文字起こし
      updateTranscription(data.text, data.speaker);
      break;

    case 'medical_entity':
      // 医療用語抽出
      highlightMedicalTerms(data.entities);
      break;

    case 'summary':
      // 診察サマリー
      displaySummary(data.summary);
      break;
  }
};
```

## 4. 認証・セキュリティ機能

### 4.1 概要

医療情報を扱うシステムとして、堅牢な認証とセキュリティを実装。

### 4.2 認証方式

#### 患者認証

- **メールアドレス + パスワード**
- **2段階認証（オプション）**: SMS/TOTP
- **生体認証**: TouchID/FaceID対応

#### 医療従事者認証

- **職員ID + パスワード**
- **2段階認証（必須）**: TOTP
- **IPアドレス制限**: 医療機関からのアクセスのみ

### 4.3 セキュリティ要件

- **通信暗号化**: TLS 1.3以上
- **データ暗号化**: AES-256-GCM
- **トークン管理**: JWT（有効期限15分）+ リフレッシュトークン
- **セッション管理**: Redis使用、30分タイムアウト
- **監査ログ**: 全アクセスログ記録

### 4.4 実装仕様

```typescript
// JWT認証ミドルウェア
const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyJWT(token);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// パスワードハッシュ化
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

// ログイン処理
app.post('/api/auth/login', async (c) => {
  const { email, password, userType } = await c.req.json();

  // ユーザー検証
  const user = await findUserByEmail(email, userType);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // トークン生成
  const accessToken = await generateJWT({
    userId: user.id,
    userType,
    exp: Date.now() + 15 * 60 * 1000, // 15分
  });

  const refreshToken = await generateRefreshToken(user.id);

  return c.json({ accessToken, refreshToken });
});
```

### 4.5 アクセス制御

```typescript
// ロールベースアクセス制御
const rbacMiddleware = (requiredRole: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!requiredRole.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
  };
};

// 使用例
app.get(
  '/api/admin/dashboard',
  authMiddleware,
  rbacMiddleware(['admin', 'operator']),
  getDashboardHandler
);
```

## 5. 非機能要件

### 5.1 可用性

- **稼働率**: 99.5%以上
- **計画停止**: 月1回、深夜2時間以内
- **障害復旧**: RTO 30分、RPO 5分

### 5.2 拡張性

- **同時接続数**: 1000セッション
- **水平スケーリング**: Kubernetes対応
- **負荷分散**: ALB使用

### 5.3 保守性

- **ログ収集**: CloudWatch Logs
- **メトリクス**: CloudWatch Metrics
- **トレーシング**: AWS X-Ray
- **エラー監視**: Sentry

## 6. 開発者向けガイドライン

### 6.1 コーディング規約

- TypeScript strict mode使用
- ESLint + Prettier適用
- 単体テストカバレッジ80%以上

### 6.2 Git運用

- feature/[チケット番号]-[機能名]でブランチ作成
- コミットメッセージはConventional Commits準拠
- PRには必ずレビュアー2名以上

### 6.3 デプロイメント

- CI/CD: GitHub Actions
- ステージング環境でのE2Eテスト必須
- Blue/Greenデプロイメント

## まとめ

本機能仕様書は、オンライン診療システムの中核機能について定義しました。各機能は医療現場での使用を想定し、セキュリティとプライバシー保護を最優先に設計されています。
