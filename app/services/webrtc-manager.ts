/**
 * WebRTC接続管理クラス
 * P2P接続の確立、メディアストリーム管理、シグナリング処理を統合
 */

import { RealtimeSignalingService } from './realtime-signaling';
import type { SignalingCallbacks } from './realtime-signaling';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  videoConstraints?: MediaTrackConstraints;
  audioConstraints?: MediaTrackConstraints;
}

export interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream, userId: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onDataChannelOpen?: (channel: RTCDataChannel) => void;
  onDataChannelMessage?: (message: string) => void;
  onError?: (error: Error) => void;
  onConnectionMetrics?: (metrics: ConnectionMetrics) => void;
}

export interface ConnectionMetrics {
  timestamp: number;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  packetLossRate: number;
  jitter: number;
  rtt: number;
  bytesSent: number;
  bytesReceived: number;
  videoCodec?: string;
  audioCodec?: string;
  candidateType?: string;
  localCandidateProtocol?: string;
  remoteCandidateProtocol?: string;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private signalingService: RealtimeSignalingService | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private config: WebRTCConfig = {
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10 // ICE候補を増やして接続安定性向上
  };

  private callbacks: WebRTCCallbacks;
  private sessionId: string;
  private userId: string;
  private isInitiator = false;

  // 再接続関連のプロパティ
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;

  // ハートビート関連のプロパティ
  private heartbeatInterval: number | null = null;
  private lastHeartbeatResponse = Date.now();
  private readonly heartbeatIntervalMs = 5000;
  private readonly heartbeatTimeoutMs = 30000; // 15秒→30秒に延長

  constructor(sessionId: string, userId: string, callbacks: WebRTCCallbacks, config?: Partial<WebRTCConfig>) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.callbacks = callbacks;

    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * WebRTC接続を初期化
   */
  async initialize(token: string, isInitiator: boolean = false): Promise<void> {
    this.isInitiator = isInitiator;

    // TURN認証情報を取得
    await this.fetchTurnCredentials();

    // メディアストリームを取得
    await this.setupLocalStream();

    // RTCPeerConnectionを作成
    this.createPeerConnection();

    // シグナリングサービスを初期化
    await this.setupSignaling(token);

    // 発信者の場合はデータチャンネルを作成
    if (isInitiator) {
      this.createDataChannel();
    }
  }

  /**
   * TURN認証情報を取得
   */
  private async fetchTurnCredentials(): Promise<void> {
    console.log('[TURN] Fetching credentials...');

    try {
      const response = await fetch('/api/turn-credentials');
      console.log('[TURN] API response status:', response.status);

      if (response.ok) {
        const data = await response.json() as {
          iceServers?: RTCIceServer[];
        };
        console.log('[TURN] API response data:', data);

        if (data.iceServers && data.iceServers.length > 0) {
          // 既存のSTUNサーバーと結合
          this.config.iceServers = [
            ...this.config.iceServers.filter(server =>
              server.urls.toString().includes('stun:')
            ),
            ...data.iceServers
          ];
          console.log('[TURN] Using', this.config.iceServers.length, 'ICE servers total');
        }
      } else {
        console.warn('[TURN] Failed to fetch TURN credentials:', response.status);
      }
    } catch (error) {
      console.error('[TURN] Fetch error:', error);
      // TURNが取得できなくてもSTUNで続行
    }
  }

  /**
   * ローカルメディアストリームをセットアップ
   */
  private async setupLocalStream(): Promise<void> {
    try {
      // 医療用途に最適化した設定
      const constraints: MediaStreamConstraints = {
        video: this.config.videoConstraints || {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }, // 安定性重視
          facingMode: 'user',
          // ビデオ品質の最適化
          aspectRatio: { ideal: 16/9 },
          // resizeMode: 'crop-and-scale' // MediaTrackConstraintsには存在しない
        },
        audio: this.config.audioConstraints || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // 医療用途向け音声品質設定
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 1 }, // モノラルで帯域節約
          // latency: { ideal: 0.05 }, // MediaTrackConstraintsには存在しない
          // volume: { ideal: 1.0 } // MediaTrackConstraintsには存在しない
        }
      };

      console.log('[Media] Requesting user media with constraints:', constraints);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 取得したトラックの設定を確認
      this.localStream.getTracks().forEach(track => {
        const settings = track.getSettings();
        console.log(`[Media] ${track.kind} track settings:`, settings);
      });

      this.callbacks.onLocalStream?.(this.localStream);

    } catch (error) {
      console.error('Failed to get user media:', error);
      this.callbacks.onError?.(new Error('カメラまたはマイクへのアクセスが拒否されました'));
      throw error;
    }
  }

  /**
   * RTCPeerConnectionを作成
   */
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // ローカルストリームのトラックを追加
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // イベントハンドラーを設定
    this.setupPeerConnectionEventHandlers();
  }

  /**
   * PeerConnectionのイベントハンドラーを設定
   */
  private setupPeerConnectionEventHandlers(): void {
    if (!this.peerConnection) {return;}

    // ICE候補が生成されたとき
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // 候補を収集
        this.iceCandidates.push(event.candidate);
        console.log('[ICE] Candidate collected:', {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          priority: event.candidate.priority,
          address: event.candidate.address
        });

        // 候補収集タイムアウトを設定（最初の候補から1秒後に送信）
        if (!this.iceCandidateGatheringTimeout) {
          this.iceCandidateGatheringTimeout = window.setTimeout(() => {
            this.sendCollectedCandidates();
          }, 1000);
        }
      } else {
        // 候補収集完了
        console.log('[ICE] Gathering complete');
        this.sendCollectedCandidates();
      }
    };

    // ICE収集状態の変化を監視
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[ICE] Gathering state:', this.peerConnection!.iceGatheringState);
      if (this.peerConnection!.iceGatheringState === 'complete') {
        this.sendCollectedCandidates();
      }
    };

    // リモートストリームを受信したとき
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStreams.set('remote', remoteStream);
        this.callbacks.onRemoteStream?.(remoteStream, 'remote');
      }
    };

    // 接続状態が変化したとき
    this.peerConnection.onconnectionstatechange = () => {
      // 安全なnullチェック
      if (!this.peerConnection) {
        console.warn('PeerConnection is null during connectionstatechange');
        return;
      }

      const state = this.peerConnection.connectionState;
      console.log('Connection state:', state);
      this.callbacks.onConnectionStateChange?.(state);

      // 接続が確立されたら品質監視とハートビートを開始
      if (state === 'connected') {
        this.reconnectAttempts = 0; // リセット成功時にカウンタをリセット
        this.startQualityMonitoring();
        this.startHeartbeat();
      } else if (state === 'disconnected' || state === 'failed') {
        this.stopQualityMonitoring();
        this.stopHeartbeat();
        // 自動再接続を試行（デバウンス付き）
        if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            if (!this.isReconnecting) {
              this.handleDisconnection();
            }
          }, 1000); // 1秒遅延で重複実行を防止
        }
      } else if (state === 'closed') {
        this.stopQualityMonitoring();
        this.stopHeartbeat();
      }
    };

    // ICE接続状態が変化したとき
    this.peerConnection.oniceconnectionstatechange = () => {
      // 安全なnullチェック
      if (!this.peerConnection) {
        console.warn('PeerConnection is null during iceconnectionstatechange');
        return;
      }

      const state = this.peerConnection.iceConnectionState;
      console.log('ICE connection state:', state);
      this.callbacks.onIceConnectionStateChange?.(state);
    };

    // データチャンネルを受信したとき
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannelHandlers(channel);
    };
  }

  /**
   * シグナリングサービスをセットアップ
   */
  private async setupSignaling(token: string): Promise<void> {
    console.log('🎯 シグナリングセットアップ開始 - sessionId:', this.sessionId, 'userId:', this.userId);

    const signalingCallbacks: SignalingCallbacks = {
      onOffer: async (offer) => {
        if (!this.isInitiator) {
          await this.handleOffer(offer);
        }
      },

      onAnswer: async (answer) => {
        if (this.isInitiator) {
          await this.handleAnswer(answer);
        }
      },

      onIceCandidate: async (candidate) => {
        await this.handleIceCandidate(candidate);
      },

      onParticipantJoined: (participantId) => {
        console.log('Participant joined:', participantId);
        if (this.isInitiator) {
          // 新しい参加者に対してオファーを送信
          this.createOffer();
        }
      },

      onParticipantLeft: (participantId) => {
        console.log('Participant left:', participantId);
        // リモートストリームをクリーンアップ
        const remoteStream = this.remoteStreams.get(participantId);
        if (remoteStream) {
          remoteStream.getTracks().forEach(track => track.stop());
          this.remoteStreams.delete(participantId);
        }
      },

      onError: (error) => {
        console.error('Signaling error:', error);
        this.callbacks.onError?.(error);
      },

      onConnectionStateChange: (state) => {
        console.log('Signaling connection state:', state);
      }
    };

    this.signalingService = new RealtimeSignalingService(
      this.sessionId,
      this.userId,
      signalingCallbacks
    );

    // WebSocket URLを更新して接続
    await this.signalingService.connect(token);
  }

  /**
   * データチャンネルを作成
   */
  private createDataChannel(): void {
    if (!this.peerConnection) {return;}

    this.dataChannel = this.peerConnection.createDataChannel('medical-data', {
      ordered: true
    });

    this.setupDataChannelHandlers(this.dataChannel);
  }


  /**
   * オファーを作成して送信
   */
  async createOffer(): Promise<void> {
    console.log('🔥 createOffer開始 - peerConnection:', !!this.peerConnection, 'signalingService:', !!this.signalingService);

    if (!this.peerConnection || !this.signalingService) {
      throw new Error('Connection not initialized');
    }

    try {
      console.log('📤 WebRTCオファー作成中...');
      const offer = await this.peerConnection.createOffer();
      console.log('✅ オファー作成成功:', offer);

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ ローカルデスクリプション設定完了');

      // this.savedOffer = offer; // 再接続時のために保存（将来的に使用予定）
      console.log('📡 シグナリング経由でオファー送信中...');
      await this.signalingService.sendOffer(offer);
      console.log('✅ オファー送信完了！');
    } catch (error) {
      console.error('❌ Failed to create offer:', error);
      this.callbacks.onError?.(new Error('オファーの作成に失敗しました'));
    }
  }

  /**
   * オファーを処理してアンサーを送信
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    console.log('🎯 Offer受信開始 - peerConnection:', !!this.peerConnection, 'signalingService:', !!this.signalingService);
    console.log('📥 受信したOffer:', offer);

    if (!this.peerConnection || !this.signalingService) {
      throw new Error('Connection not initialized');
    }

    try {
      console.log('📝 リモートデスクリプション設定中...');
      await this.peerConnection.setRemoteDescription(offer);
      console.log('✅ リモートデスクリプション設定完了');

      console.log('📤 Answer作成中...');
      const answer = await this.peerConnection.createAnswer();
      console.log('✅ Answer作成成功:', answer);

      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ ローカルデスクリプション設定完了');

      console.log('📡 シグナリング経由でAnswer送信中...');
      await this.signalingService.sendAnswer(answer);
      console.log('🎉 Answer送信完了！');
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      this.callbacks.onError?.(new Error('オファーの処理に失敗しました'));
    }
  }

  /**
   * アンサーを処理
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      // this.savedAnswer = answer; // 再接続時のために保存（将来的に使用予定）
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.callbacks.onError?.(new Error('アンサーの処理に失敗しました'));
    }
  }

  /**
   * ICE候補を処理
   */
  private async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  /**
   * データチャンネルでメッセージを送信
   */
  sendDataChannelMessage(message: string): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
    } else {
      console.warn('Data channel is not open');
    }
  }

  /**
   * ビデオのミュート/アンミュート
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * 音声のミュート/アンミュート
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * 接続を切断
   */
  disconnect(): void {
    // データチャンネルを閉じる
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // ローカルストリームを停止
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // リモートストリームを停止
    this.remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.remoteStreams.clear();

    // PeerConnectionを閉じる
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // シグナリングサービスを切断
    if (this.signalingService) {
      this.signalingService.disconnect();
      this.signalingService = null;
    }
  }

  /**
   * 現在の接続状態を取得
   */
  get connectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * ICE接続状態を取得
   */
  get iceConnectionState(): RTCIceConnectionState | null {
    return this.peerConnection?.iceConnectionState || null;
  }

  /**
   * ビデオ品質を調整
   */
  async adjustVideoQuality(quality: 'high' | 'medium' | 'low'): Promise<void> {
    if (!this.localStream || !this.peerConnection) {return;}

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) {return;}

    // 品質プリセット
    const qualitySettings = {
      high: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
      medium: { width: 640, height: 480, frameRate: 24, bitrate: 1000000 },
      low: { width: 320, height: 240, frameRate: 15, bitrate: 300000 }
    };

    const settings = qualitySettings[quality];

    // トラックに制約を適用
    try {
      await videoTrack.applyConstraints({
        width: { ideal: settings.width },
        height: { ideal: settings.height },
        frameRate: { ideal: settings.frameRate }
      });

      // 送信パラメータを調整
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find(sender => sender.track?.kind === 'video');

      if (videoSender) {
        const params = videoSender.getParameters();
        if (params.encodings && params.encodings[0]) {
          params.encodings[0].maxBitrate = settings.bitrate;
          await videoSender.setParameters(params);
        }
      }

      console.log(`[Media] Video quality adjusted to ${quality}:`, settings);
    } catch (error) {
      console.error('[Media] Failed to adjust video quality:', error);
    }
  }

  /**
   * 詳細な接続メトリクスを収集
   */
  async collectConnectionMetrics(): Promise<ConnectionMetrics | null> {
    if (!this.peerConnection) {return null;}

    const stats = await this.peerConnection.getStats();
    const metrics: ConnectionMetrics = {
      timestamp: Date.now(),
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState,
      signalingState: this.peerConnection.signalingState,
      packetLossRate: 0,
      jitter: 0,
      rtt: 0,
      bytesSent: 0,
      bytesReceived: 0
    };

    let packetsLost = 0;
    let packetsReceived = 0;

    stats.forEach((report) => {
      // インバウンドRTPストリーム統計
      if (report.type === 'inbound-rtp') {
        if (report.mediaType === 'video') {
          packetsLost += report.packetsLost || 0;
          packetsReceived += report.packetsReceived || 0;
          metrics.jitter = report.jitter || 0;
          metrics.videoCodec = report.codecId;
        } else if (report.mediaType === 'audio') {
          metrics.audioCodec = report.codecId;
        }
        metrics.bytesReceived += report.bytesReceived || 0;
      }

      // アウトバウンドRTPストリーム統計
      if (report.type === 'outbound-rtp') {
        metrics.bytesSent += report.bytesSent || 0;
      }

      // ICE候補ペア統計
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        metrics.rtt = report.currentRoundTripTime || 0;

        // 候補タイプと使用プロトコルを取得
        if (report.localCandidateId && report.remoteCandidateId) {
          stats.forEach((candidateReport) => {
            if (candidateReport.type === 'local-candidate' && candidateReport.id === report.localCandidateId) {
              metrics.candidateType = candidateReport.candidateType;
              metrics.localCandidateProtocol = candidateReport.protocol;
            }
            if (candidateReport.type === 'remote-candidate' && candidateReport.id === report.remoteCandidateId) {
              metrics.remoteCandidateProtocol = candidateReport.protocol;
            }
          });
        }
      }
    });

    metrics.packetLossRate = packetsReceived > 0 ? packetsLost / packetsReceived : 0;

    return metrics;
  }

  /**
   * 接続統計情報を取得して品質を自動調整
   */
  async monitorConnectionQuality(): Promise<void> {
    const metrics = await this.collectConnectionMetrics();
    if (!metrics) {return;}

    // メトリクスをコールバックで通知
    this.callbacks.onConnectionMetrics?.(metrics);

    // 品質を自動調整
    if (metrics.packetLossRate > 0.05 || metrics.rtt > 300) {
      await this.adjustVideoQuality('low');
    } else if (metrics.packetLossRate > 0.02 || metrics.rtt > 150) {
      await this.adjustVideoQuality('medium');
    } else {
      await this.adjustVideoQuality('high');
    }

    // 接続状態の詳細ログ
    console.log('[Connection] Metrics:', {
      state: `${metrics.connectionState}/${metrics.iceConnectionState}`,
      packetLossRate: `${(metrics.packetLossRate * 100).toFixed(2)}%`,
      rtt: `${metrics.rtt.toFixed(0)}ms`,
      jitter: `${metrics.jitter.toFixed(3)}s`,
      candidateType: metrics.candidateType || 'unknown',
      protocol: `${metrics.localCandidateProtocol}/${metrics.remoteCandidateProtocol}`,
      dataTransfer: {
        sent: `${(metrics.bytesSent / 1024).toFixed(0)}KB`,
        received: `${(metrics.bytesReceived / 1024).toFixed(0)}KB`
      }
    });
  }

  /**
   * 定期的な品質監視を開始
   */
  startQualityMonitoring(intervalMs: number = 5000): void {
    this.stopQualityMonitoring();

    this.qualityMonitorInterval = window.setInterval(() => {
      this.monitorConnectionQuality();
    }, intervalMs);
  }

  /**
   * 品質監視を停止
   */
  stopQualityMonitoring(): void {
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
      this.qualityMonitorInterval = null;
    }
  }

  private qualityMonitorInterval: number | null = null;
  private iceCandidates: RTCIceCandidate[] = [];
  private iceCandidateGatheringTimeout: number | null = null;
  // 再接続時のためにSDPを保存（将来的に使用予定）
  // private savedOffer: RTCSessionDescriptionInit | null = null;
  // private savedAnswer: RTCSessionDescriptionInit | null = null;

  /**
   * 収集したICE候補を優先度順に送信
   */
  private sendCollectedCandidates(): void {
    if (this.iceCandidateGatheringTimeout) {
      clearTimeout(this.iceCandidateGatheringTimeout);
      this.iceCandidateGatheringTimeout = null;
    }

    if (this.iceCandidates.length === 0) {return;}

    // 候補を優先度でソート（高い優先度が先）
    const sortedCandidates = [...this.iceCandidates].sort((a, b) => {
      // 候補タイプの優先順位: host > srflx > relay
      const typeOrder = { host: 3, srflx: 2, relay: 1 };
      const aTypeScore = typeOrder[a.type as keyof typeof typeOrder] || 0;
      const bTypeScore = typeOrder[b.type as keyof typeof typeOrder] || 0;

      if (aTypeScore !== bTypeScore) {
        return bTypeScore - aTypeScore;
      }

      // 同じタイプの場合は優先度で比較
      return (b.priority || 0) - (a.priority || 0);
    });

    console.log('[ICE] Sending candidates in priority order:',
      sortedCandidates.map(c => ({ type: c.type, protocol: c.protocol, priority: c.priority }))
    );

    // 優先度順に候補を送信
    sortedCandidates.forEach((candidate, index) => {
      setTimeout(() => {
        this.signalingService?.sendIceCandidate(candidate);
      }, index * 50); // 50ms間隔で送信
    });

    // 送信済みの候補をクリア
    this.iceCandidates = [];
  }

  /**
   * 接続切断時の処理
   */
  private handleDisconnection(): void {
    if (this.isReconnecting) {return;}

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`[Reconnect] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    this.callbacks.onError?.(new Error(`接続が切断されました。再接続を試行中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`));

    // 既存の接続をクリーンアップ（メディアストリームは保持）
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // 再接続タイムアウトを設定（エクスポネンシャルバックオフ）
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    this.reconnectTimeout = window.setTimeout(() => {
      this.attemptReconnection();
    }, backoffMs);
  }

  /**
   * 再接続を試行
   */
  private async attemptReconnection(): Promise<void> {
    try {
      console.log('[Reconnect] Starting reconnection process');

      // PeerConnectionを再作成
      this.createPeerConnection();

      // 再接続フラグをリセット
      this.isReconnecting = false;

      // 初期接続と同様にオファーを作成
      if (this.isInitiator) {
        await this.createOffer();
      }

      console.log('[Reconnect] Reconnection initiated successfully');
    } catch (error) {
      console.error('[Reconnect] Failed to reconnect:', error);
      this.isReconnecting = false;

      // 最大試行回数に達した場合はエラーを通知
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.callbacks.onError?.(new Error('再接続の最大試行回数に達しました。接続を確認してください。'));
      } else {
        // 次の再接続を試行
        this.handleDisconnection();
      }
    }
  }

  /**
   * ハートビートを開始
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeatResponse = Date.now();

    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
      this.checkHeartbeatTimeout();
    }, this.heartbeatIntervalMs);

    console.log('[Heartbeat] Started with interval:', this.heartbeatIntervalMs);
  }

  /**
   * ハートビートを停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Heartbeat] Stopped');
    }
  }

  /**
   * ハートビートを送信
   */
  private sendHeartbeat(): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const heartbeatMessage = JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      });
      this.dataChannel.send(heartbeatMessage);
      console.log('[Heartbeat] Sent');
    }
  }

  /**
   * ハートビートタイムアウトをチェック
   */
  private checkHeartbeatTimeout(): void {
    const now = Date.now();
    const timeSinceLastResponse = now - this.lastHeartbeatResponse;

    if (timeSinceLastResponse > this.heartbeatTimeoutMs) {
      console.warn('[Heartbeat] Timeout detected, connection may be lost');
      // 接続が失われた可能性があるため、PeerConnectionの状態を確認
      if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
        // 接続は「connected」だがハートビートが応答しない場合
        // 強制的に再接続を試行
        this.callbacks.onError?.(new Error('接続が応答しません。再接続を試行します。'));
        this.handleDisconnection();
      }
    }
  }

  /**
   * データチャンネルのハンドラーを設定（ハートビート応答処理を追加）
   */
  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened');
      this.dataChannel = channel;
      this.callbacks.onDataChannelOpen?.(channel);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'heartbeat') {
          // ハートビートを受信したら応答
          this.lastHeartbeatResponse = Date.now();
          console.log('[Heartbeat] Received');

          // ハートビート応答を送信
          const response = JSON.stringify({
            type: 'heartbeat-response',
            timestamp: Date.now()
          });
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(response);
          }
        } else if (message.type === 'heartbeat-response') {
          // ハートビート応答を受信
          this.lastHeartbeatResponse = Date.now();
          console.log('[Heartbeat] Response received');
        } else {
          // その他のメッセージは通常通り処理
          this.callbacks.onDataChannelMessage?.(event.data);
        }
      } catch (error) {
        // JSONでない場合は通常のメッセージとして処理
        this.callbacks.onDataChannelMessage?.(event.data);
      }
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };
  }

  /**
   * 接続をクリーンアップ
   */
  cleanup(): void {
    // 再接続タイマーをクリア
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // ハートビートを停止
    this.stopHeartbeat();

    // 品質監視を停止
    this.stopQualityMonitoring();

    // ローカルストリームを停止
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // リモートストリームを停止
    this.remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.remoteStreams.clear();

    // PeerConnectionを閉じる
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // シグナリングサービスを切断
    if (this.signalingService) {
      this.signalingService.disconnect();
      this.signalingService = null;
    }
  }

  /**
   * 手動で再接続を試行
   */
  async reconnect(): Promise<void> {
    this.reconnectAttempts = 0;
    this.handleDisconnection();
  }
}
