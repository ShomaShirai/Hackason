/**
 * Cloudflare Realtime シグナリングサービス
 * WebRTC接続のためのシグナリング処理を管理
 */

export type SignalingEventType =
  | 'join'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'leave'
  | 'error'
  | 'participant-update'
  | 'ping'
  | 'pong';

export interface SignalingMessage {
  type: SignalingEventType;
  userId: string;
  targetUserId?: string;
  data?: any;
  timestamp?: number;
}

export interface SignalingCallbacks {
  onOffer?: (_offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (_answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (_candidate: RTCIceCandidate) => void;
  onParticipantJoined?: (_participantId: string) => void;
  onParticipantLeft?: (_participantId: string) => void;
  onParticipantUpdate?: (_participants: any[]) => void;
  onError?: (_error: Error) => void;
  onConnectionStateChange?: (_state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class RealtimeSignalingService {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private userId: string;
  private callbacks: SignalingCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(sessionId: string, userId: string, callbacks: SignalingCallbacks) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  /**
   * シグナリングサーバーに接続
   */
  async connect(token: string): Promise<void> {
    console.log('🌐 シグナリング接続開始 - sessionId:', this.sessionId, 'userId:', this.userId);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = window.location.hostname === 'localhost' ? `:${window.location.port}` : '';
    // 一時的にシンプルなWebSocket実装を使用
    const url = `${protocol}//${window.location.hostname}${port}/api/ws/simple/${this.sessionId}?userId=${this.userId}&token=${token}`;

    console.log('🔗 WebSocket接続URL:', url);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected - SessionId:', this.sessionId);
          this.callbacks?.onConnectionStateChange?.('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.callbacks.onError?.(new Error('WebSocket connection error'));
          this.callbacks.onConnectionStateChange?.('error');
        };

        this.ws.onclose = () => {
          console.info('WebSocket disconnected');
          this.callbacks.onConnectionStateChange?.('disconnected');
          this.stopHeartbeat();
          this.attemptReconnect(token);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * WebSocket URLを構築
   */
  private buildWebSocketUrl(token: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // シンプルなWebSocketエンドポイントを使用（デモ用）
    return `${protocol}//${host}/api/ws/simple/${this.sessionId}?userId=${this.userId}&token=${token}`;
  }

  /**
   * メッセージを処理
   */
  private handleMessage(data: string): void {
    try {
      const message: SignalingMessage = JSON.parse(data);

      // 自分のメッセージは無視（joinとleave以外）
      if (message.userId === this.userId && message.type !== 'join' && message.type !== 'leave') {
        return;
      }

      switch (message.type) {
        case 'offer':
          this.callbacks.onOffer?.(message.data);
          break;

        case 'answer':
          this.callbacks.onAnswer?.(message.data);
          break;

        case 'ice-candidate':
          this.callbacks.onIceCandidate?.(new RTCIceCandidate(message.data));
          break;

        case 'join':
          if (message.data?.participant) {
            this.callbacks.onParticipantJoined?.(message.userId);
          }
          break;

        case 'leave':
          this.callbacks.onParticipantLeft?.(message.userId);
          break;

        case 'participant-update':
          if (message.data?.participants) {
            this.callbacks.onParticipantUpdate?.(message.data.participants);
          }
          break;

        case 'error':
          this.callbacks.onError?.(new Error(message.data?.message || 'Unknown error'));
          break;

        case 'ping':
          // Heartbeat - respond with pong
          this.sendMessage({
            type: 'pong',
            userId: this.userId,
            timestamp: Date.now()
          });
          break;

        case 'pong':
          // Heartbeat response - just log it
          console.log('Received heartbeat pong');
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * オファーを送信
   */
  async sendOffer(offer: RTCSessionDescriptionInit, targetUserId?: string): Promise<void> {
    await this.sendMessage({
      type: 'offer',
      userId: this.userId,
      targetUserId,
      data: offer
    });
  }

  /**
   * アンサーを送信
   */
  async sendAnswer(answer: RTCSessionDescriptionInit, targetUserId?: string): Promise<void> {
    await this.sendMessage({
      type: 'answer',
      userId: this.userId,
      targetUserId,
      data: answer
    });
  }

  /**
   * ICE候補を送信
   */
  async sendIceCandidate(candidate: RTCIceCandidate, targetUserId?: string): Promise<void> {
    await this.sendMessage({
      type: 'ice-candidate',
      userId: this.userId,
      targetUserId,
      data: candidate.toJSON()
    });
  }

  /**
   * メッセージを送信
   */
  private async sendMessage(message: SignalingMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 再接続を試行
   */
  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.callbacks.onError?.(new Error('Failed to reconnect to signaling server'));
      return;
    }

    this.reconnectAttempts++;
    this.callbacks.onConnectionStateChange?.('connecting');

    setTimeout(() => {
      console.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect(token).catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30秒ごと
  }

  /**
   * ハートビートを停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 接続を切断
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 接続状態を取得
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
