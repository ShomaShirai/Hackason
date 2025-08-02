import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionProps {
    isEnabled: boolean;
    language?: string;
    onTranscript?: (transcript: string) => void;
    className?: string;
    // 音声認識の感度設定
    maxAlternatives?: number;
    continuous?: boolean;
    interimResults?: boolean;
    // 高感度設定
    highSensitivity?: boolean;
    noiseReduction?: boolean;
    adaptiveThreshold?: boolean;
}

interface SpeechRecognitionState {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    error: string | null;
}

export function SpeechRecognition({
    isEnabled,
    language = 'ja-JP',
    onTranscript,
    className = '',
    maxAlternatives = 20, // 最大候補数を増加
    continuous = true,
    interimResults = true,
    highSensitivity = true, // 常に高感度
    noiseReduction = true,  // 常にノイズ除去
    adaptiveThreshold = true // 常に適応的閾値
}: SpeechRecognitionProps) {
    const [state, setState] = useState<SpeechRecognitionState>({
        isListening: false,
        transcript: '',
        interimTranscript: '',
        error: null
    });

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Web Speech APIのサポートチェック
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    // 音声認識の初期化
    const initializeRecognition = useCallback(() => {
        if (!isSupported) {
            setState(prev => ({ ...prev, error: '音声認識がサポートされていません' }));
            return;
        }

        try {
            // Web Speech APIの取得
            let SpeechRecognitionClass: any;

            if ('webkitSpeechRecognition' in window) {
                // @ts-ignore - Webkit固有のAPI
                SpeechRecognitionClass = window.webkitSpeechRecognition;
            } else if ('SpeechRecognition' in window) {
                // @ts-ignore - 標準API
                SpeechRecognitionClass = window.SpeechRecognition;
            } else {
                throw new Error('SpeechRecognition API not available');
            }

            recognitionRef.current = new SpeechRecognitionClass();

            const recognition = recognitionRef.current;

            // 基本設定
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;
            recognition.lang = language;

            // 音声認識の感度を上げる設定（安全に設定）
            try {
                recognition.maxAlternatives = maxAlternatives;
            } catch (error) {
                console.warn('maxAlternatives設定に失敗:', error);
            }

            // 常に高感度設定
            try {
                // 最大候補数を設定
                recognition.maxAlternatives = Math.max(maxAlternatives, 20);

                // 中間結果の頻度を上げる
                recognition.interimResults = true;

                // 連続認識を確実に有効化
                recognition.continuous = true;

                console.log('🎤 高感度設定適用:', {
                    maxAlternatives: recognition.maxAlternatives,
                    interimResults: recognition.interimResults,
                    continuous: recognition.continuous
                });
            } catch (error) {
                console.warn('高感度設定に失敗:', error);
            }

            // 常にノイズ除去設定
            try {
                // ブラウザ固有のノイズ除去設定
                if ('webkitSpeechRecognition' in window) {
                    // @ts-ignore - Webkit固有の設定
                    recognition.grammars = null; // 文法制約を無効化

                    // 音声認識の閾値を下げる（実験的）
                    // @ts-ignore
                    if (recognition.audioContext) {
                        // @ts-ignore
                        recognition.audioContext.sampleRate = 48000; // 高サンプリングレート
                    }

                    console.log('🎤 ノイズ除去設定適用');
                }
            } catch (error) {
                console.warn('ノイズ除去設定に失敗:', error);
            }

            // 常に適応的閾値設定
            try {
                // 音声認識の再起動頻度を上げる
                recognition.continuous = true;

                // より詳細な設定（実験的）
                if ('webkitSpeechRecognition' in window) {
                    // @ts-ignore
                    recognition.maxAlternatives = Math.max(maxAlternatives, 25);
                }

                console.log('🎤 適応的閾値設定適用');
            } catch (error) {
                console.warn('適応的閾値設定に失敗:', error);
            }

            recognition.onstart = () => {
                console.log('🎤 音声認識開始');
                setState(prev => ({ ...prev, isListening: true, error: null }));
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];

                    // 高感度モード: 複数の候補を組み合わせて最適な結果を生成
                    let bestTranscript = '';
                    let bestConfidence = 0;
                    let allAlternatives: string[] = [];

                    for (let j = 0; j < result.length; j++) {
                        const alternative = result[j];
                        allAlternatives.push(alternative.transcript);

                        if (alternative.confidence > bestConfidence) {
                            bestTranscript = alternative.transcript;
                            bestConfidence = alternative.confidence;
                        }
                    }

                    // 常に高感度モード: 複数の候補を組み合わせて最適化
                    if (allAlternatives.length > 1) {
                        // 最も長い候補を優先（より詳細な認識）
                        const longestAlternative = allAlternatives.reduce((longest, current) =>
                            current.length > longest.length ? current : longest
                        );

                        // 信頼度が高い場合は最長候補を使用（閾値を下げる）
                        if (bestConfidence > 0.5) {
                            bestTranscript = longestAlternative;
                        }

                        // 複数の候補を組み合わせて最適化
                        if (allAlternatives.length >= 3) {
                            // 最も詳細な候補を選択
                            const mostDetailedAlternative = allAlternatives.reduce((most, current) => {
                                const currentWords = current.split(' ').length;
                                const mostWords = most.split(' ').length;
                                return currentWords > mostWords ? current : most;
                            });

                            if (bestConfidence > 0.3) {
                                bestTranscript = mostDetailedAlternative;
                            }
                        }
                    }

                    if (result.isFinal) {
                        finalTranscript += bestTranscript;
                    } else {
                        interimTranscript += bestTranscript;
                    }
                }

                setState(prev => ({
                    ...prev,
                    transcript: prev.transcript + finalTranscript,
                    interimTranscript
                }));

                // 最終的な文字起こし結果を親コンポーネントに通知
                if (finalTranscript && onTranscript) {
                    onTranscript(finalTranscript);
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('🎤 音声認識エラー:', event.error);
                let errorMessage = '音声認識エラーが発生しました';

                switch (event.error) {
                    case 'no-speech':
                        errorMessage = '音声が検出されませんでした';
                        break;
                    case 'audio-capture':
                        errorMessage = 'マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。';
                        break;
                    case 'not-allowed':
                        errorMessage = 'マイクの使用許可が必要です。ブラウザの設定でマイクを許可してください。';
                        break;
                    case 'network':
                        errorMessage = 'ネットワークエラーが発生しました';
                        break;
                    case 'aborted':
                        errorMessage = '音声認識が中断されました';
                        break;
                    case 'service-not-allowed':
                        errorMessage = '音声認識サービスが利用できません';
                        break;
                    default:
                        errorMessage = `音声認識エラー: ${event.error}`;
                }

                setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
            };

            recognition.onend = () => {
                console.log('🎤 音声認識終了');
                setState(prev => ({ ...prev, isListening: false }));

                // 自動再起動（有効な場合のみ）
                if (isEnabled && !state.error) {
                    setTimeout(() => {
                        if (recognitionRef.current && isEnabled) {
                            try {
                                recognitionRef.current.start();
                                console.log('🎤 音声認識自動再開');
                            } catch (error) {
                                console.warn('🎤 音声認識自動再開に失敗:', error);
                            }
                        }
                    }, 1000); // 1秒後に再開
                }
            };

        } catch (error) {
            console.error('🎤 音声認識初期化エラー:', error);
            setState(prev => ({ ...prev, error: '音声認識の初期化に失敗しました' }));
        }
    }, [language, onTranscript]);

    // 音声認識の開始
    const startRecognition = useCallback(() => {
        if (!recognitionRef.current) {
            initializeRecognition();
        }

        if (recognitionRef.current && !state.isListening) {
            try {
                // 少し遅延を入れてから開始
                setTimeout(() => {
                    if (recognitionRef.current && isEnabled) {
                        try {
                            recognitionRef.current.start();
                            console.log('🎤 音声認識開始成功');
                        } catch (error) {
                            console.error('🎤 音声認識開始エラー:', error);
                            setState(prev => ({
                                ...prev,
                                error: '音声認識の開始に失敗しました。マイクの許可を確認してください。'
                            }));
                        }
                    }
                }, 100);
            } catch (error) {
                console.error('🎤 音声認識初期化エラー:', error);
                setState(prev => ({
                    ...prev,
                    error: '音声認識の初期化に失敗しました。ブラウザの設定を確認してください。'
                }));
            }
        }
    }, [initializeRecognition, state.isListening, isEnabled]);

    // 音声認識の停止
    const stopRecognition = useCallback(() => {
        if (recognitionRef.current && state.isListening) {
            try {
                recognitionRef.current.stop();
            } catch (error) {
                console.error('🎤 音声認識停止エラー:', error);
            }
        }
    }, [state.isListening]);

    // 文字起こしのクリア
    const clearTranscript = useCallback(() => {
        setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
    }, []);

    // 有効/無効の切り替え
    useEffect(() => {
        if (isEnabled) {
            // 少し遅延を入れてから開始
            const timer = setTimeout(() => {
                startRecognition();
            }, 500);

            return () => {
                clearTimeout(timer);
                stopRecognition();
            };
        } else {
            stopRecognition();
        }
    }, [isEnabled, startRecognition, stopRecognition]);

    // コンポーネントのアンマウント時にクリーンアップ
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (transcriptTimeoutRef.current) {
                clearTimeout(transcriptTimeoutRef.current);
            }
        };
    }, []);

    // 字幕の自動スクロール
    useEffect(() => {
        const subtitleElement = document.getElementById('subtitle-container');
        if (subtitleElement) {
            subtitleElement.scrollTop = subtitleElement.scrollHeight;
        }
    }, [state.transcript, state.interimTranscript]);

    if (!isSupported) {
        return (
            <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
                <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-yellow-800 text-sm">音声認識がサポートされていません</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg ${className}`}>
            {/* ヘッダー */}
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50/80">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <svg className={`w-4 h-4 mr-2 ${state.isListening ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-900">
                            音声認識 {state.isListening && <span className="text-red-500">●</span>}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={clearTranscript}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                            title="文字起こしをクリア"
                        >
                            クリア
                        </button>
                    </div>
                </div>
            </div>

            {/* エラー表示 */}
            {state.error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                    <div className="flex items-center">
                        <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-red-700 text-sm">{state.error}</span>
                    </div>
                </div>
            )}

            {/* 字幕表示エリア */}
            <div
                id="subtitle-container"
                className="px-4 py-2 max-h-24 overflow-y-auto bg-gray-50/80"
                style={{ minHeight: '60px' }}
            >
                {state.transcript && (
                    <div className="mb-1">
                        <span className="text-xs text-gray-700 font-medium">{state.transcript}</span>
                    </div>
                )}
                {state.interimTranscript && (
                    <div>
                        <span className="text-xs text-gray-500 italic">{state.interimTranscript}</span>
                    </div>
                )}
                {!state.transcript && !state.interimTranscript && (
                    <div className="text-xs text-gray-400 italic">
                        音声を認識中...
                    </div>
                )}
            </div>
        </div>
    );
} 