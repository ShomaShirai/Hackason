import { useCallback, useEffect, useRef, useState } from 'react';
import { WebRTCManager, type WebRTCCallbacks } from '../services/webrtc-manager';
import { getAuthToken, getAuthTokenStatus } from '../utils/auth';

interface CloudflareRealtimeVideoProps {
  appointmentId: string;
  userType: 'patient' | 'worker';
  onSessionEnd?: () => void;
  onConnectionMetrics?: (metrics: unknown) => void;
}

interface SessionData {
  sessionId: string;
  realtimeSessionId: string;
  token: string;
  status: string;
  isNewSession: boolean;
}

interface MediaControls {
  audio: boolean;
  video: boolean;
}

export function CloudflareRealtimeVideo({
  appointmentId,
  userType,
  onSessionEnd,
  onConnectionMetrics: _onConnectionMetrics
}: CloudflareRealtimeVideoProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [mediaControls, setMediaControls] = useState<MediaControls>({ audio: true, video: true });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // セッション作成または参加
  const initializeSession = useCallback(async () => {
    console.log('🚀 initializeSession開始', { appointmentId });
    setIsLoading(true);
    setError(null);

    try {
      // 1. セッション作成/参加APIを呼び出し
      console.log('📡 API呼び出し開始...');
      const apiBaseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : '';

      // 認証トークンを動的に取得
      const authToken = getAuthToken();
      const tokenStatus = getAuthTokenStatus();

      console.log('🔑 認証トークン:', authToken ? '取得済み' : '未設定');
      console.log('📍 認証状況:', {
        currentPath: tokenStatus.currentPath,
        detectedUserType: tokenStatus.detectedUserType,
        patientToken: tokenStatus.patientToken ? 'あり' : 'なし',
        workerToken: tokenStatus.workerToken ? 'あり' : 'なし'
      });

      const response = await fetch(`${apiBaseUrl}/api/video-sessions/realtime/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || ''}`
        },
        body: JSON.stringify({ appointmentId })
      });

      console.log('📡 APIレスポンス:', response.status);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to create session');
      }

      const responseData = await response.json() as {
        success: boolean;
        session?: { id: string; realtimeSessionId: string; status: string };
        callsSession?: { token: string };
      };
      console.log('✅ セッションデータ取得:', responseData);

      // 新しいAPIレスポンス形式に対応
      const data: SessionData = {
        sessionId: responseData.session?.id || crypto.randomUUID(),
        realtimeSessionId: responseData.session?.realtimeSessionId || crypto.randomUUID(),
        token: responseData.callsSession?.token || 'dummy-token',
        status: responseData.session?.status || 'active',
        isNewSession: true
      };
      setSessionData(data);

      // 2. WebRTCマネージャーを初期化
      // 認証トークンからユーザーIDを取得してユニークなIDを生成
      const currentAuthToken = getAuthToken();
      let actualUserId = 'demo-user';

      if (currentAuthToken) {
        try {
          const payload = JSON.parse(atob(currentAuthToken.split('.')[1]));
          actualUserId = payload.id || payload.sub || 'unknown';
        } catch (error) {
          console.warn('Failed to parse auth token for userId:', error);
        }
      }

      // ユーザータイプとIDを組み合わせて一意のIDを生成
      const userId = `${userType}-${actualUserId}`;
      console.log('👤 生成されたuserID:', userId);

      const webrtcCallbacks: WebRTCCallbacks = {
        onLocalStream: (stream) => {
          console.log('📹 ローカルストリーム取得:', stream.id);
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        },

        onRemoteStream: (stream, userId) => {
          console.log('📺 リモートストリーム受信:', stream.id, userId);
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },

        onConnectionStateChange: (state) => {
          console.log('🔗 接続状態変更:', state);
          setConnectionState(state);

          if (state === 'failed') {
            setError('接続に失敗しました。');
            setShowRetryButton(true);
          } else if (state === 'disconnected') {
            setError('接続が失われました。ネットワークを確認してください。');
            setShowRetryButton(true);
          }
        },

        onIceConnectionStateChange: (state) => {
          console.log('🧊 ICE接続状態変更:', state);
          setIceConnectionState(state);
        },

        onDataChannelOpen: (channel) => {
          console.log('📡 データチャンネル開通:', channel.label);
        },

        onDataChannelMessage: (message) => {
          console.log('📨 データチャンネルメッセージ:', message);
        },

        onError: (error) => {
          console.error('❌ WebRTCエラー:', error);
          setError(error.message);
        },

        onConnectionMetrics: (metrics) => {
          _onConnectionMetrics?.(metrics);
        }
      };

      const manager = new WebRTCManager(
        data.sessionId,
        userId,
        webrtcCallbacks
      );

      webrtcManagerRef.current = manager;

      // WebRTC接続を初期化
      // 患者がOffer作成者（initiator）、医師がAnswer応答者
      const isInitiator = userType === 'patient';
      console.log('🎯 WebRTC初期化開始 - userType:', userType, 'isInitiator:', isInitiator);

      await manager.initialize(data.token, isInitiator);

      // WebRTC役割分担: 患者がOffer、医師/医療従事者がAnswer
      if (userType === 'patient') {
        console.log('🆕 患者セッション - オファー作成');
        setTimeout(() => {
          manager.createOffer();
        }, 1000);
      } else if (userType === 'worker') {
        console.log('👨‍⚕️ 医療従事者セッション - オファー待機');
        // 医療従事者は患者からのオファーを待機してAnswerで応答
      }

    } catch (error) {
      console.error('❌ セッション初期化エラー:', error);

      // 既存セッションエラーの場合はjoin操作を試行
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Session already exists') ||
        errorMessage.includes('User is already in the session')) {

        console.log('🔄 既存セッションエラー検出、join操作を試行...');
        try {
          // join操作のためのAPI呼び出し（同じエンドポイント、異なるパラメータ）
          const apiBaseUrl = typeof window !== 'undefined'
            ? `${window.location.protocol}//${window.location.host}`
            : '';
          const authToken = getAuthToken();

          const joinResponse = await fetch(`${apiBaseUrl}/api/video-sessions/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              appointmentId: appointmentId.toString(),
              action: 'join' // join操作であることを明示
            })
          });

          if (joinResponse.ok) {
            const joinData = await joinResponse.json() as SessionData;
            console.log('✅ join操作成功:', joinData);
            setSessionData(joinData);
            setError(null);
            return; // join成功時は処理終了
          }
        } catch (joinError) {
          console.error('❌ join操作も失敗:', joinError);
        }
      }

      setError(errorMessage);
      setSessionData(null);
    } finally {
      console.log('🏁 初期化プロセス完了');
      setIsLoading(false);
    }
  }, [appointmentId, userType, _onConnectionMetrics]);

  // 音声のオン/オフ切り替え
  const toggleAudio = useCallback(() => {
    if (webrtcManagerRef.current) {
      const newState = !mediaControls.audio;
      webrtcManagerRef.current.toggleAudio(newState);
      setMediaControls(prev => ({ ...prev, audio: newState }));
    }
  }, [mediaControls.audio]);

  // ビデオのオン/オフ切り替え
  const toggleVideo = useCallback(() => {
    if (webrtcManagerRef.current) {
      const newState = !mediaControls.video;
      webrtcManagerRef.current.toggleVideo(newState);
      setMediaControls(prev => ({ ...prev, video: newState }));
    }
  }, [mediaControls.video]);

  // 通話終了
  const endCall = useCallback(async () => {
    // WebRTCマネージャーを切断
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.disconnect();
    }

    // セッション終了APIを呼び出し
    if (sessionData) {
      try {
        const apiBaseUrl = typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.host}`
          : '';

        await fetch(`${apiBaseUrl}/api/video-sessions/${sessionData.sessionId}/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken() || ''}`
          }
        });
      } catch (err) {
        console.error('Failed to end session:', err);
      }
    }

    // コールバックを実行
    onSessionEnd?.();
  }, [sessionData, onSessionEnd]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.disconnect();
      }
    };
  }, []);

  // 初期化
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  return (
    <div className="relative h-full w-full bg-gray-900">
      {/* エラー表示 */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium">{error}</p>
                {error.includes('カメラまたはマイク') && (
                  <p className="text-sm mt-1 opacity-90">
                    ブラウザの設定でカメラとマイクのアクセスを許可してください。
                  </p>
                )}
              </div>
            </div>
            {showRetryButton && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setError(null);
                    setShowRetryButton(false);
                    initializeSession();
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  再接続を試す
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/50">
          <div className="text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            <p className="mt-4">接続中...</p>
          </div>
        </div>
      )}

      {/* ビデオグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 h-full">
        {/* リモートビデオ（メイン） */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            {userType === 'patient' ? '医師' : '患者'}
          </div>
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <p>相手の参加を待っています...</p>
            </div>
          )}
        </div>

        {/* ローカルビデオ */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden md:order-2">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            自分 ({userType === 'patient' ? '患者' : '医師'})
          </div>
        </div>
      </div>

      {/* コントロールバー */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4">
        <div className="flex justify-center items-center gap-4">
          {/* 音声切り替えボタン */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${mediaControls.audio
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            aria-label={mediaControls.audio ? 'ミュート' : 'ミュート解除'}
          >
            {mediaControls.audio ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            )}
          </button>

          {/* ビデオ切り替えボタン */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${mediaControls.video
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            aria-label={mediaControls.video ? 'ビデオオフ' : 'ビデオオン'}
          >
            {mediaControls.video ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            )}
          </button>

          {/* 通話終了ボタン */}
          <button
            onClick={endCall}
            className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            aria-label="通話終了"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>

        {/* 接続状態表示 */}
        <div className="text-center mt-2 text-sm text-gray-400">
          接続状態: {connectionState === 'connected' ? '接続済み' :
            connectionState === 'connecting' ? '接続中...' :
              connectionState === 'failed' ? '接続失敗' : '待機中'}
          {iceConnectionState !== 'connected' && iceConnectionState !== 'completed' && (
            <span className="ml-2">(ICE: {iceConnectionState})</span>
          )}
        </div>

      </div>
    </div>
  );
}
