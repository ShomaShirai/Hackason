import { useCallback, useEffect, useRef, useState } from 'react';
import { WebRTCManager, type WebRTCCallbacks } from '../services/webrtc-manager';
import { getAuthToken, getAuthTokenStatus } from '../utils/auth';

interface CloudflareRealtimeVideoProps {
  appointmentId: string;
  userType: 'patient' | 'worker';
  onSessionEnd?: () => void;
  onConnectionMetrics?: (metrics: unknown) => void;
  onToggleAudio?: (enabled: boolean) => void;
  onToggleVideo?: (enabled: boolean) => void;
  mediaControls?: MediaControls;
  onRef?: (ref: { toggleAudio: (enabled: boolean) => void; toggleVideo: (enabled: boolean) => void; endCall: () => void } | null) => void;
}

interface AppointmentDetails {
  appointment: {
    id: number;
    patient: {
      id: number;
      name: string;
    };
    doctor: {
      id: number;
      name: string;
    } | null;
  };
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
  onConnectionMetrics: _onConnectionMetrics,
  onToggleAudio,
  onToggleVideo,
  mediaControls: externalMediaControls,
  onRef
}: CloudflareRealtimeVideoProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [appointmentDetails, setAppointmentDetails] = useState<AppointmentDetails | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
  const [mediaControls, setMediaControls] = useState<MediaControls>({ audio: false, video: false });
  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // メディア制御機能
  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      setMediaControls(prev => ({ ...prev, audio: enabled }));
      onToggleAudio?.(enabled);
      console.log('音声切り替え:', enabled);
    }
  }, [localStream, onToggleAudio]);

  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      setMediaControls(prev => ({ ...prev, video: enabled }));
      onToggleVideo?.(enabled);
      console.log('ビデオ切り替え:', enabled);
    }
  }, [localStream, onToggleVideo]);

  // 外部からのメディア制御を監視
  useEffect(() => {
    if (externalMediaControls) {
      if (externalMediaControls.audio !== mediaControls.audio) {
        toggleAudio(externalMediaControls.audio);
      }
      if (externalMediaControls.video !== mediaControls.video) {
        toggleVideo(externalMediaControls.video);
      }
    }
  }, [externalMediaControls, mediaControls.audio, mediaControls.video, toggleAudio, toggleVideo]);

  // refを親コンポーネントに渡す
  useEffect(() => {
    onRef?.({
      toggleAudio,
      toggleVideo,
      endCall: () => {
        // endCall関数が定義されるまで一時的に空の関数を提供
        console.warn('endCall not yet available');
      }
    });
  }, [toggleAudio, toggleVideo, onRef]);

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
          setLocalStreamState(stream);
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

  // endCall関数が定義された後にrefを更新
  useEffect(() => {
    onRef?.({
      toggleAudio,
      toggleVideo,
      endCall
    });
  }, [toggleAudio, toggleVideo, endCall, onRef]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.disconnect();
      }
    };
  }, []);

  // 予約情報を取得
  const fetchAppointmentDetails = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`/api/appointments/${appointmentId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAppointmentDetails(data);
      } else {
        console.error('Failed to fetch appointment details');
      }
    } catch (error) {
      console.error('Error fetching appointment details:', error);
    }
  }, [appointmentId]);

  // 初期化
  useEffect(() => {
    fetchAppointmentDetails();
    initializeSession();
  }, [fetchAppointmentDetails, initializeSession]);

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
          {/* カメラオフ時の患者名表示 */}
          {!mediaControls.video && appointmentDetails && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="text-4xl text-white font-bold mb-2">
                  {userType === 'patient'
                    ? appointmentDetails.appointment.patient.name
                    : appointmentDetails.appointment.doctor?.name || '医師'
                  }
                </div>
                <div className="text-gray-300 text-lg">
                  {userType === 'patient' ? '患者' : '医師'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* コントロールバーは親コンポーネントで管理 */}
    </div>
  );
}
