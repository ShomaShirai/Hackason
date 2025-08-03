import { useState } from 'react';

interface ConnectionError {
    message: string;
    type: 'network' | 'permission' | 'device' | 'server' | 'unknown';
    timestamp: Date;
    retryCount: number;
}

interface ConnectionErrorHandlerProps {
    error: ConnectionError | null;
    onRetry: () => void;
    onDismiss: () => void;
    className?: string;
}

export function ConnectionErrorHandler({
    error,
    onRetry,
    onDismiss,
    className = ''
}: ConnectionErrorHandlerProps) {
    const [showDetails, setShowDetails] = useState(false);

    if (!error) {return null;}

    const getErrorIcon = (type: string) => {
        switch (type) {
            case 'network': return '🌐';
            case 'permission': return '🔒';
            case 'device': return '📹';
            case 'server': return '🖥️';
            default: return '⚠️';
        }
    };

    const getErrorColor = (type: string) => {
        switch (type) {
            case 'network': return 'bg-orange-500';
            case 'permission': return 'bg-yellow-500';
            case 'device': return 'bg-blue-500';
            case 'server': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getErrorTitle = (type: string) => {
        switch (type) {
            case 'network': return 'ネットワークエラー';
            case 'permission': return '権限エラー';
            case 'device': return 'デバイスエラー';
            case 'server': return 'サーバーエラー';
            default: return 'エラー';
        }
    };

    const getErrorSuggestions = (type: string) => {
        switch (type) {
            case 'network':
                return [
                    'インターネット接続を確認してください',
                    'Wi-Fiまたは有線接続を試してください',
                    'ファイアウォール設定を確認してください'
                ];
            case 'permission':
                return [
                    'ブラウザの設定でカメラとマイクのアクセスを許可してください',
                    'URLバーのカメラアイコンをクリックして許可してください',
                    'ブラウザを再起動してください'
                ];
            case 'device':
                return [
                    'カメラとマイクが正常に接続されているか確認してください',
                    '他のアプリケーションでカメラを使用していないか確認してください',
                    'デバイスを再起動してください'
                ];
            case 'server':
                return [
                    'しばらく時間をおいてから再試行してください',
                    'ページを再読み込みしてください',
                    'サポートにお問い合わせください'
                ];
            default:
                return [
                    'ページを再読み込みしてください',
                    'ブラウザを再起動してください'
                ];
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className={`bg-red-500/90 backdrop-blur-sm rounded-lg p-4 shadow-lg ${className}`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${getErrorColor(error.type)}`}>
                    <span className="text-white text-lg">{getErrorIcon(error.type)}</span>
                </div>

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-white">
                            {getErrorTitle(error.type)}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-red-100">
                                {formatTime(error.timestamp)}
                            </span>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="text-red-100 hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <p className="text-red-100 mb-3">{error.message}</p>

                    {showDetails && (
                        <div className="mb-3 p-3 bg-red-600/50 rounded">
                            <h4 className="text-sm font-medium text-red-100 mb-2">解決方法:</h4>
                            <ul className="text-xs text-red-100 space-y-1">
                                {getErrorSuggestions(error.type).map((suggestion, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        <span className="text-red-200">•</span>
                                        <span>{suggestion}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                        >
                            再試行 ({error.retryCount}/3)
                        </button>
                        <button
                            onClick={onDismiss}
                            className="px-4 py-2 text-red-100 hover:text-white transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 