/**
 * WebRTCシグナリング用Durable Object
 * 各ビデオセッションごとにインスタンスが作成され、
 * 参加者間のシグナリングメッセージを中継する
 */

export interface SignalingMessage {
  type: 'join' | 'offer' | 'answer' | 'ice-candidate' | 'leave' | 'error' | 'participant-update' | 'ping' | 'pong';
  userId: string;
  targetUserId?: string;
  data?: any;
  timestamp?: number;
}

export interface Participant {
  userId: string;
  userType: 'patient' | 'worker';
  role?: 'doctor' | 'operator' | 'admin';
  joinedAt: number;
}

export class SignalingRoom {
  private _state: DurableObjectState;
  private _env: unknown;
  private sessions: Map<WebSocket, Participant> = new Map();
  private participants: Map<string, Participant> = new Map();

  constructor(_state: DurableObjectState, _env: any) {

    this._state = _state;

    this._env = _env;
  }

  // WebSocketリクエストを処理
  async fetch(request: Request): Promise<Response> {
    // WebSocketアップグレードの確認
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // WebSocketペアを作成
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // サーバー側のWebSocketを受け入れ
    server.accept();

    // ユーザー情報の取得（URLパラメータから）
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userType = url.searchParams.get('userType') as 'patient' | 'worker';
    const role = url.searchParams.get('role') as 'doctor' | 'operator' | 'admin' | undefined;

    if (!userId || !userType) {
      server.close(1008, 'Missing user information');
      return new Response(null, { status: 101, webSocket: client });
    }

    // 参加者情報を作成
    const participant: Participant = {
      userId,
      userType,
      role,
      joinedAt: Date.now()
    };

    // セッションとパーティシパントを登録
    this.sessions.set(server, participant);
    this.participants.set(userId, participant);

    // 既存の参加者に新規参加を通知
    this.broadcast({
      type: 'join',
      userId,
      data: {
        participant,
        participants: Array.from(this.participants.values())
      }
    }, server);

    // 新規参加者に現在の参加者リストを送信
    server.send(JSON.stringify({
      type: 'participant-update',
      data: {
        participants: Array.from(this.participants.values())
      }
    }));

    // メッセージハンドラー
    server.addEventListener('message', async (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data as string);
        message.userId = userId; // 送信者IDを確実に設定
        message.timestamp = Date.now();

        await this.handleMessage(message, server);
      } catch (error) {
        console.error('Message handling error:', error);
        server.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // 切断ハンドラー
    server.addEventListener('close', () => {
      const participant = this.sessions.get(server);
      if (participant) {
        this.sessions.delete(server);
        this.participants.delete(participant.userId);

        // 他の参加者に退出を通知
        this.broadcast({
          type: 'leave',
          userId: participant.userId,
          data: {
            participants: Array.from(this.participants.values())
          }
        });
      }
    });

    // エラーハンドラー
    server.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
      const participant = this.sessions.get(server);
      if (participant) {
        this.sessions.delete(server);
        this.participants.delete(participant.userId);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // メッセージ処理
  private async handleMessage(message: SignalingMessage, sender: WebSocket) {
    switch (message.type) {
      case 'join': {
        // 再度の参加メッセージ（WebSocket接続時に既に処理済みだが、エラー回避のため）
        const participant = this.sessions.get(sender);
        if (participant) {
          // 既存の参加者に再参加を通知
          this.broadcast({
            type: 'join',
            userId: participant.userId,
            data: {
              participant,
              participants: Array.from(this.participants.values())
            }
          }, sender);

          // 参加者に現在の参加者リストを送信
          sender.send(JSON.stringify({
            type: 'participant-update',
            data: {
              participants: Array.from(this.participants.values())
            }
          }));
        }
        break;
      }

      case 'ping': {
        // ハートビート/ping メッセージに対してpongを返す
        sender.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // P2P通信のシグナリングメッセージを中継
        if (message.targetUserId) {
          this.sendToUser(message.targetUserId, message);
        } else {
          // ターゲットが指定されていない場合は全員に送信（ブロードキャスト）
          this.broadcast(message, sender);
        }
        break;

      case 'leave': {
        // 明示的な退出処理
        const participant = this.sessions.get(sender);
        if (participant) {
          this.sessions.delete(sender);
          this.participants.delete(participant.userId);

          this.broadcast({
            type: 'leave',
            userId: participant.userId,
            data: {
              participants: Array.from(this.participants.values())
            }
          });
        }
        break;
      }

      default:
        sender.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        }));
    }
  }

  // 特定のユーザーにメッセージを送信
  private sendToUser(targetUserId: string, message: SignalingMessage) {
    for (const [ws, participant] of this.sessions) {
      if (participant.userId === targetUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return;
      }
    }

    // ターゲットユーザーが見つからない場合
    console.warn(`Target user ${targetUserId} not found in session`);
  }

  // 全参加者にブロードキャスト（送信者を除く）
  private broadcast(message: SignalingMessage, excludeWs?: WebSocket) {
    const messageStr = JSON.stringify(message);

    for (const [ws] of this.sessions) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  // 状態の永続化（必要に応じて実装）
  async alarm() {
    // 定期的なクリーンアップやヘルスチェックを実装可能
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30分

    // 長時間接続のない参加者をクリーンアップ
    for (const [userId, participant] of this.participants) {
      if (now - participant.joinedAt > timeout) {
        // WebSocketが生きているか確認
        let isActive = false;
        for (const [ws, p] of this.sessions) {
          if (p.userId === userId && ws.readyState === WebSocket.OPEN) {
            isActive = true;
            break;
          }
        }

        if (!isActive) {
          this.participants.delete(userId);
        }
      }
    }
  }
}
