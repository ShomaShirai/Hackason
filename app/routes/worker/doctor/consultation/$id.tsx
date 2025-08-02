import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MedicalVideoCall } from '../../../../components/MedicalVideoCall';

export default function DoctorConsultation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 診察室の初期化処理
    const initializeConsultation = async () => {
      try {
        // 診察IDの妥当性チェック
        if (!id || isNaN(Number(id))) {
          throw new Error('無効な診察IDです');
        }

        // 認証チェック（必要に応じて）
        // TODO: 実際の認証チェックを実装

        setIsLoading(false);
      } catch (err) {
        console.error('診察室初期化エラー:', err);
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        setIsLoading(false);
      }
    };

    initializeConsultation();
  }, [id]);

  const handleSessionEnd = () => {
    console.log('🔴 Doctor consultation handleSessionEnd called');
    console.log('🔴 Navigating to /worker/doctor/dashboard');
    // セッション終了後、医師ダッシュボードに戻る
    // navigate('/worker/doctor/dashboard'); // React Routerのナビゲーション
    window.location.href = '/worker/doctor/dashboard'; // 強制的な画面遷移
  };

  const handleError = (errorMessage: string) => {
    console.error('MedicalVideoCall エラー:', errorMessage);
    setError(errorMessage);
  };

  // ローディング表示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">診察室を準備中...</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <h2 className="text-xl font-semibold mb-2">診察室エラー</h2>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => window.location.href = '/worker/doctor/dashboard'}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">エラー</h2>
          <p className="text-gray-600">診察IDが無効です</p>
          <button
            onClick={() => window.location.href = '/worker/doctor/dashboard'}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <MedicalVideoCall
        appointmentId={id}
        userType="worker"
        workerRole="doctor"
        onSessionEnd={handleSessionEnd}
      />
    </div>
  );
}
