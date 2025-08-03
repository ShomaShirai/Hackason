import { useCallback, useState } from 'react';

interface MediaControls {
  audio: boolean;
  video: boolean;
  screenShare: boolean;
}

interface EnhancedCallControlsProps {
  mediaControls: MediaControls;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onSettings: () => void;
  isConnecting: boolean;
  connectionState: string;
  className?: string;
}

export function EnhancedCallControls({
  mediaControls,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onSettings,
  isConnecting,
  connectionState,
  className = ''
}: EnhancedCallControlsProps) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleButtonClick = useCallback((action: () => void, tooltip: string) => {
    action();
    setShowTooltip(tooltip);
    setTimeout(() => setShowTooltip(null), 2000);
  }, []);

  const handleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        // 画面共有開始
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        // 画面共有ストリームを処理
        console.log('画面共有開始:', stream);
        setIsScreenSharing(true);
        onToggleScreenShare();

        // ストリーム終了時の処理
        stream.getTracks().forEach(track => {
          track.onended = () => {
            console.log('画面共有終了');
            setIsScreenSharing(false);
            onToggleScreenShare();
          };
        });
      } else {
        // 画面共有停止
        setIsScreenSharing(false);
        onToggleScreenShare();
      }
    } catch (error) {
      console.error('画面共有エラー:', error);
      alert('画面共有を開始できませんでした。');
    }
  }, [isScreenSharing, onToggleScreenShare]);

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'connected': return '接続済み';
      case 'connecting': return '接続中...';
      case 'failed': return '接続失敗';
      default: return '待機中';
    }
  };

  return (
    <div className={`bg-black/80 backdrop-blur-sm p-4 rounded-t-lg relative z-10 ${className}`}>
      {/* 接続状態インジケーター */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()} animate-pulse`}></div>
          <span className="text-sm text-gray-300">{getConnectionStatusText()}</span>
        </div>
      </div>

      {/* メインコントロール */}
      <div className="flex justify-center items-center gap-4 relative">
        {/* 音声切り替えボタン */}
        <div className="relative z-20">
          <button
            onClick={() => handleButtonClick(onToggleAudio, mediaControls.audio ? 'ミュート' : 'ミュート解除')}
            disabled={isConnecting}
            className={`p-4 rounded-full transition-all duration-200 ${mediaControls.audio
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            aria-label={mediaControls.audio ? 'ミュート' : 'ミュート解除'}
          >
            {mediaControls.audio ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            )}
          </button>
          {showTooltip === (mediaControls.audio ? 'ミュート' : 'ミュート解除') && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              {mediaControls.audio ? 'ミュート' : 'ミュート解除'}
            </div>
          )}
        </div>

        {/* ビデオ切り替えボタン */}
        <div className="relative z-20">
          <button
            onClick={() => handleButtonClick(onToggleVideo, mediaControls.video ? 'ビデオオフ' : 'ビデオオン')}
            disabled={isConnecting}
            className={`p-4 rounded-full transition-all duration-200 ${mediaControls.video
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
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
          {showTooltip === (mediaControls.video ? 'ビデオオフ' : 'ビデオオン') && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              {mediaControls.video ? 'ビデオオフ' : 'ビデオオン'}
            </div>
          )}
        </div>

        {/* 画面共有 */}
        <div className="relative z-20">
          <button
            onClick={() => handleButtonClick(handleScreenShare, isScreenSharing ? '画面共有停止' : '画面共有')}
            disabled={isConnecting}
            className={`p-4 rounded-full transition-all duration-200 ${isScreenSharing
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            aria-label={isScreenSharing ? '画面共有停止' : '画面共有'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
          {showTooltip === (isScreenSharing ? '画面共有停止' : '画面共有') && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              {isScreenSharing ? '画面共有停止' : '画面共有'}
            </div>
          )}
        </div>



        {/* 設定 */}
        <div className="relative z-20">
          <button
            onClick={() => handleButtonClick(onSettings, '設定')}
            disabled={isConnecting}
            className="p-4 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all duration-200 hover:scale-105"
            aria-label="設定"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showTooltip === '設定' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              設定
            </div>
          )}
        </div>

        {/* 通話終了 */}
        <div className="relative z-20">
          <button
            onClick={() => handleButtonClick(onEndCall, '通話終了')}
            disabled={isConnecting}
            className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 hover:scale-105"
            aria-label="通話終了"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
          {showTooltip === '通話終了' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              通話終了
            </div>
          )}
        </div>
      </div>

      {/* 接続中のローディング */}
      {isConnecting && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-300">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            接続中...
          </div>
        </div>
      )}
    </div>
  );
} 