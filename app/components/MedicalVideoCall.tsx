import { useState, useCallback, useEffect } from 'react';
import { CloudflareRealtimeVideo } from './CloudflareRealtimeVideo';
import { PatientInfoPanel } from './PatientInfoPanel';
import { DoctorChatPanel } from './chat/DoctorChatPanel';
import { MedicalRecordPanel } from './MedicalRecordPanel';

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

  const handleTogglePanel = useCallback(() => {
    setIsPanelCollapsed(prev => !prev);
  }, []);

  const handleSessionEnd = useCallback(() => {
    onSessionEnd?.();
  }, [onSessionEnd]);

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
      reconnectTimer = setTimeout(() => {
        setNetworkError(null);
      }, 5000);
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
      <div className={`flex-1 transition-all duration-300 ${
        userType === 'worker' && workerRole === 'doctor' ? 'mr-0' : ''
      }`}>
        <div className="relative h-full">
          <CloudflareRealtimeVideo
            appointmentId={appointmentId}
            userType={userType}
            onSessionEnd={handleSessionEnd}
            onConnectionMetrics={setConnectionMetrics}
          />

          {/* コントロールパネル */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
              <div className="flex items-center justify-between">
                {/* 診察時間 */}
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    診察時間: {formatDuration(consultationDuration)}
                  </div>

                  {/* 接続品質インジケーター */}
                  {connectionMetrics && (
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        connectionMetrics.quality === 'good' ? 'bg-green-500' :
                        connectionMetrics.quality === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm text-gray-600">
                        {connectionMetrics.quality === 'good' ? '良好' :
                         connectionMetrics.quality === 'fair' ? '普通' : '不安定'}
                      </span>
                    </div>
                  )}

                  {/* ネットワークエラー表示 */}
                  {networkError && (
                    <div className="text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {networkError}
                    </div>
                  )}
                </div>

                {/* コントロールボタン */}
                <div className="flex items-center gap-2">
                  {/* 通話終了ボタン */}
                  <button
                    onClick={handleSessionEnd}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    通話終了
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 医師用サイドパネル */}
      {userType === 'worker' && workerRole === 'doctor' && (
        <div className={`w-96 bg-gray-50 border-l border-gray-200 transition-all duration-300 ${
          isPanelCollapsed ? 'w-12' : 'w-96'
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
                    className={`w-5 h-5 text-gray-600 transition-transform ${
                      isPanelCollapsed ? 'rotate-180' : ''
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
                    onToggleCollapse={() => {}}
                  />

                  {/* カルテ記入パネル */}
                  <MedicalRecordPanel
                    appointmentId={appointmentId}
                    isCollapsible={true}
                    defaultExpanded={true}
                    className="mb-4"
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
    </div>
  );
}
