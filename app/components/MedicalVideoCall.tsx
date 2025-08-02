import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../utils/auth';
import { CallSettingsModal } from './CallSettingsModal';
import { CloudflareRealtimeVideo } from './CloudflareRealtimeVideo';
import { ConnectionErrorHandler } from './ConnectionErrorHandler';
import { ConnectionQualityMonitor } from './ConnectionQualityMonitor';
import { EnhancedCallControls } from './EnhancedCallControls';
import { MedicalRecordPanel } from './MedicalRecordPanel';
import { PatientInfoPanel } from './PatientInfoPanel';
import { SpeechRecognition } from './SpeechRecognition';
import { DoctorChatPanel } from './chat/DoctorChatPanel';

interface MedicalVideoCallProps {
  appointmentId: string;
  userType: 'patient' | 'worker';
  workerRole?: 'doctor' | 'nurse' | 'operator' | 'admin';
  onSessionEnd?: () => void;
}

export function MedicalVideoCall({
  appointmentId,
  userType,
  workerRole,
  onSessionEnd
}: MedicalVideoCallProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [consultationStartTime] = useState(new Date());
  const [consultationDuration, setConsultationDuration] = useState(0);
  const [connectionMetrics, setConnectionMetrics] = useState<any>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [patientInfo] = useState<{ name: string } | null>(null);
  const [mediaControls, setMediaControls] = useState({
    audio: false, // デフォルトで音声オフ
    video: false,
    screenShare: false
  });
  const [connectionError, setConnectionError] = useState<{
    message: string;
    type: 'network' | 'permission' | 'device' | 'server' | 'unknown';
    timestamp: Date;
    retryCount: number;
  } | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [callSettings, setCallSettings] = useState({
    videoQuality: 'medium' as const,
    audioQuality: 'medium' as const,
    selectedCamera: '',
    selectedMicrophone: '',
    enableEchoCancellation: true,
    enableNoiseReduction: true
  });

  // 音声認識の状態管理（常に有効）
  const [speechRecognitionEnabled, setSpeechRecognitionEnabled] = useState(true);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState({
    isAutoSaving: false,
    lastAutoSaved: null as Date | null
  });
  const [currentTranscript, setCurrentTranscript] = useState(''); // 現在の字幕データ

  const [videoRef, setVideoRef] = useState<{
    toggleAudio: (enabled: boolean) => void;
    toggleVideo: (enabled: boolean) => void;
    endCall: () => void;
  } | null>(null);

  const handleTogglePanel = useCallback(() => {
    setIsPanelCollapsed(prev => !prev);
  }, []);

  const handleSessionEnd = useCallback(() => {
    console.log('🔴 handleSessionEnd called');

    // 即座に親コンポーネントのコールバックを実行（画面遷移を優先）
    console.log('🔴 Calling onSessionEnd callback immediately');
    onSessionEnd?.();

    // 実際の通話終了処理を非同期で実行（バックグラウンド）
    setTimeout(() => {
      if (videoRef) {
        console.log('🔴 Calling videoRef.endCall()');
        videoRef.endCall();
      }
    }, 100);
  }, [onSessionEnd, videoRef]);

  const handleToggleAudio = useCallback(() => {
    const newAudioState = !mediaControls.audio;
    setMediaControls(prev => ({ ...prev, audio: newAudioState }));

    // 実際のメディア制御を実行
    if (videoRef) {
      videoRef.toggleAudio(newAudioState);
    }

    console.log('音声切り替え:', newAudioState);
  }, [mediaControls.audio, videoRef]);

  const handleToggleVideo = useCallback(() => {
    const newVideoState = !mediaControls.video;
    setMediaControls(prev => ({ ...prev, video: newVideoState }));

    // 実際のメディア制御を実行
    if (videoRef) {
      videoRef.toggleVideo(newVideoState);
    }

    console.log('ビデオ切り替え:', newVideoState);
  }, [mediaControls.video, videoRef]);

  // 音声認識の切り替え
  const handleToggleSpeechRecognition = useCallback(() => {
    setSpeechRecognitionEnabled(prev => !prev);
  }, []);

  // 文字起こし結果の処理
  const handleTranscript = useCallback((transcript: string) => {
    setTranscripts(prev => [...prev, transcript]);
    setCurrentTranscript(prev => prev ? `${prev}\n${transcript}` : transcript);
    console.log('🎤 文字起こし結果:', transcript);

    // 医師の場合、音声認識結果をカルテに送信
    if (userType === 'worker' && workerRole === 'doctor') {
      saveTranscriptToMedicalRecord(transcript);
    }
  }, [userType, workerRole]);

  // 音声認識結果をカルテに保存
  const saveTranscriptToMedicalRecord = useCallback(async (transcript: string) => {
    try {
      // 自動保存開始状態を設定
      setAutoSaveStatus(prev => ({ ...prev, isAutoSaving: true }));

      const token = getAuthToken();
      if (!token) {
        console.error('認証トークンがありません');
        return;
      }

      // 既存のカルテを取得
      const response = await fetch(`/api/worker/medical-records/${appointmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          isNew?: boolean;
          record?: {
            id?: number;
            appointmentId: number;
            subjective: string;
            objective: string;
            assessment: string;
            plan: string;
            transcript?: string;
            vitalSigns?: any;
            prescriptions?: any[];
            createdAt?: string;
            updatedAt?: string;
          };
        };
        const existingRecord = data.record;

        // 既存の字幕に新しい字幕を追加
        const currentTranscript = existingRecord?.transcript || '';
        const updatedTranscript = currentTranscript
          ? `${currentTranscript}\n${transcript}`
          : transcript;

        let updateResponse;

        if (existingRecord && existingRecord.id) {
          // 既存のカルテを更新
          updateResponse = await fetch(`/api/worker/medical-records/${existingRecord.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transcript: updatedTranscript,
              // 既存のデータも保持
              subjective: existingRecord.subjective || '',
              objective: existingRecord.objective || '',
              assessment: existingRecord.assessment || '',
              plan: existingRecord.plan || '',
              vitalSigns: existingRecord.vitalSigns || {},
              prescriptions: existingRecord.prescriptions || []
            }),
          });
        } else {
          // 新規カルテを作成
          updateResponse = await fetch('/api/worker/medical-records', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              appointmentId: parseInt(appointmentId),
              transcript: updatedTranscript,
              subjective: '',
              objective: '',
              assessment: '',
              plan: '',
              vitalSigns: {},
              prescriptions: []
            }),
          });
        }

        if (updateResponse.ok) {
          console.log('🎤 音声認識結果をカルテに保存しました:', transcript);
          // 自動保存完了状態を設定
          setAutoSaveStatus({
            isAutoSaving: false,
            lastAutoSaved: new Date()
          });
        } else {
          console.error('🎤 カルテ保存エラー:', updateResponse.status);
          setAutoSaveStatus(prev => ({ ...prev, isAutoSaving: false }));
        }
      } else {
        console.error('🎤 カルテ取得エラー:', response.status);
        setAutoSaveStatus(prev => ({ ...prev, isAutoSaving: false }));
      }
    } catch (error) {
      console.error('🎤 音声認識結果保存エラー:', error);
      setAutoSaveStatus(prev => ({ ...prev, isAutoSaving: false }));
    }
  }, [appointmentId]);

  const handleToggleScreenShare = useCallback(async () => {
    const newScreenShareState = !mediaControls.screenShare;

    try {
      if (newScreenShareState) {
        // 画面共有開始
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        if (screenStream) {
          setMediaControls(prev => ({ ...prev, screenShare: true }));
          console.log('画面共有開始');

          // 画面共有終了時の処理
          screenStream.getTracks().forEach(track => {
            track.onended = () => {
              console.log('画面共有終了');
              setMediaControls(prev => ({ ...prev, screenShare: false }));
            };
          });
        } else {
          console.error('画面共有の開始に失敗しました');
        }
      } else {
        // 画面共有停止
        setMediaControls(prev => ({ ...prev, screenShare: false }));
        console.log('画面共有停止');
      }
    } catch (error) {
      console.error('画面共有切り替えエラー:', error);
    }
  }, [mediaControls.screenShare]);

  const handleSettings = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const handleSettingsSave = useCallback((newSettings: any) => {
    setCallSettings(newSettings);
    console.log('設定を保存:', newSettings);
    // TODO: WebRTCマネージャーに設定を適用
  }, []);

  const handleErrorRetry = useCallback(() => {
    if (connectionError) {
      setConnectionError(prev => prev ? {
        ...prev,
        retryCount: Math.min(prev.retryCount + 1, 3),
        timestamp: new Date()
      } : null);
    }
    setNetworkError(null);
  }, [connectionError]);

  const handleErrorDismiss = useCallback(() => {
    setConnectionError(null);
    setNetworkError(null);
  }, []);

  // 診察時間の更新
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const duration = Math.floor((now.getTime() - consultationStartTime.getTime()) / 1000);
      setConsultationDuration(duration);
    }, 1000);

    return () => clearInterval(timer);
  }, [consultationStartTime]);

  // ネットワーク状態の監視
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    if (networkError) {
      // エラーメッセージからエラータイプを判定
      let errorType: 'network' | 'permission' | 'device' | 'server' | 'unknown' = 'unknown';

      if (networkError.includes('カメラ') || networkError.includes('マイク') || networkError.includes('権限')) {
        errorType = 'permission';
      } else if (networkError.includes('デバイス') || networkError.includes('カメラ') || networkError.includes('マイク')) {
        errorType = 'device';
      } else if (networkError.includes('サーバー') || networkError.includes('API')) {
        errorType = 'server';
      } else if (networkError.includes('ネットワーク') || networkError.includes('接続')) {
        errorType = 'network';
      }

      setConnectionError({
        message: networkError,
        type: errorType,
        timestamp: new Date(),
        retryCount: 0
      });

      reconnectTimer = setTimeout(() => {
        setNetworkError(null);
        setConnectionError(null);
      }, 10000); // 10秒後に自動でクリア
    }

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [networkError]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gray-900 flex">
      {/* メインビデオエリア */}
      <div className={`flex-1 transition-all duration-300 ${userType === 'worker' && workerRole === 'doctor' ? 'mr-0' : ''
        }`}>
        <div className="relative h-full">
          <CloudflareRealtimeVideo
            appointmentId={appointmentId}
            userType={userType}
            onSessionEnd={handleSessionEnd}
            onConnectionMetrics={setConnectionMetrics}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            mediaControls={mediaControls}
            onRef={setVideoRef}
          />

          {/* 接続品質モニター */}
          <div className="absolute top-4 right-4 z-10">
            <ConnectionQualityMonitor
              metrics={connectionMetrics}
              className="max-w-xs"
            />
          </div>

          {/* エラーハンドラー */}
          {connectionError && (
            <div className="absolute top-4 left-4 z-20">
              <ConnectionErrorHandler
                error={connectionError}
                onRetry={handleErrorRetry}
                onDismiss={handleErrorDismiss}
                className="max-w-md"
              />
            </div>
          )}

          {/* 診察時間表示 */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3">
              <div className="text-white text-sm">
                <div className="font-medium">診察時間</div>
                <div className="text-lg font-bold">{formatDuration(consultationDuration)}</div>
              </div>
            </div>
          </div>

          {/* 改良されたコントロールパネル */}
          <div className="absolute bottom-0 left-0 right-0">
            <EnhancedCallControls
              mediaControls={mediaControls}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
              onEndCall={handleSessionEnd}
              onSettings={handleSettings}
              isConnecting={false} // TODO: 接続状態を動的に取得
              connectionState={connectionMetrics?.connectionState || 'connecting'}
            />
          </div>
        </div>
      </div>

      {/* 音声認識パネル（常に高感度表示） */}
      <div className="fixed bottom-20 left-4 right-4 z-50">
        <SpeechRecognition
          isEnabled={speechRecognitionEnabled}
          language="ja-JP"
          onTranscript={handleTranscript}
          className="max-w-md mx-auto"
          maxAlternatives={25}
          continuous={true}
          interimResults={true}
          highSensitivity={true}
          noiseReduction={true}
          adaptiveThreshold={true}
        />
      </div>

      {/* 医師用サイドパネル */}
      {userType === 'worker' && workerRole === 'doctor' && (
        <div className={`w-96 bg-gray-50 border-l border-gray-200 transition-all duration-300 ${isPanelCollapsed ? 'w-12' : 'w-96'
          }`}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* パネルヘッダー */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold text-gray-800 ${isPanelCollapsed ? 'hidden' : ''}`}>
                  診察サポート
                </h3>
                <button
                  onClick={handleTogglePanel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={isPanelCollapsed ? '展開' : '折りたたみ'}
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform ${isPanelCollapsed ? 'rotate-180' : ''
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* パネルコンテンツ */}
            {!isPanelCollapsed && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* 患者情報パネル */}
                  <PatientInfoPanel
                    appointmentId={appointmentId}
                    isCollapsed={false}
                    onToggleCollapse={() => { }}
                  />

                  {/* カルテ記入パネル */}
                  <MedicalRecordPanel
                    appointmentId={appointmentId}
                    isCollapsible={true}
                    defaultExpanded={true}
                    className="mb-4"
                    onAutoSaveStatusChange={(status) => setAutoSaveStatus(status)}
                    externalAutoSaveStatus={autoSaveStatus}
                    externalTranscript={currentTranscript} // 現在の字幕データを渡す
                  />

                  {/* チャットパネル */}
                  <DoctorChatPanel
                    appointmentId={parseInt(appointmentId)}
                    patientName={patientInfo?.name || '患者'}
                    className="w-full"
                    isCollapsible={true}
                    defaultExpanded={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* サポートボタン（患者向け） */}
      {userType === 'patient' && (
        <button
          className="fixed bottom-4 right-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
          onClick={() => {
            // TODO: サポートチャットを開く
            console.info('Opening support chat');
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          サポート
        </button>
      )}

      {/* 設定モーダル */}
      <CallSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSettingsSave}
        currentSettings={callSettings}
      />
    </div>
  );
}
