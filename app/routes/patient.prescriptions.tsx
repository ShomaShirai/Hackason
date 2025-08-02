import { useState, useEffect } from 'react';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';

interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface PrescriptionItem {
  appointmentId: number;
  scheduledAt: string;
  appointmentStatus: string;
  appointmentType: string;
  doctorId: number | null;
  doctorName: string;
  medications: Medication[];
  medicationCount: number;
  prescribedAt: string;
  updatedAt: string;
}

interface PrescriptionsResponse {
  success: boolean;
  prescriptions: PrescriptionItem[];
  totalCount: number;
}

const PatientPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionItem | null>(null);

  // 患者の認証トークンを取得
  const getAuthToken = () => {
    return localStorage.getItem('patientAccessToken');
  };

  // 処方箋一覧を取得
  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        throw new Error('認証トークンが見つかりません');
      }

      const response = await fetch('/api/patient/prescriptions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: PrescriptionsResponse = await response.json();

      if (data.success) {
        setPrescriptions(data.prescriptions);
      } else {
        throw new Error('処方箋データの取得に失敗しました');
      }
    } catch (err) {
      console.error('処方箋取得エラー:', err);
      setError(err instanceof Error ? err.message : '処方箋の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 特定診察の処方箋詳細を取得
  const fetchPrescriptionDetail = async (appointmentId: number) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('認証トークンが見つかりません');
      }

      const response = await fetch(`/api/patient/prescriptions/medical-records/${appointmentId}/prescriptions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('処方箋詳細:', data);
    } catch (err) {
      console.error('処方箋詳細取得エラー:', err);
    }
  };

  // コンポーネント初期化時に処方箋一覧を取得
  useEffect(() => {
    fetchPrescriptions();
  }, []);

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 診察タイプの日本語変換
  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'initial': return '初診';
      case 'follow_up': return '再診';
      case 'emergency': return '緊急';
      default: return type;
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <Loading />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <ErrorMessage message={error} />
        <button
          onClick={fetchPrescriptions}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          再読み込み
        </button>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">処方箋履歴</h1>
            <p className="text-gray-600">過去の診察で処方されたお薬の履歴を確認できます</p>
          </div>

          {prescriptions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">処方箋がありません</h3>
              <p className="text-gray-500 mb-4">まだ処方箋が作成されていません。</p>
              <a href="/patient/appointments/new" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                診察予約を作成
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {prescriptions.map((prescription) => (
                <div key={prescription.appointmentId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {formatDate(prescription.scheduledAt)} の診察
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {prescription.doctorName}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {getAppointmentTypeLabel(prescription.appointmentType)}
                        </span>
                        <span className="text-gray-500">
                          {prescription.medicationCount}種類の薬剤
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPrescription(prescription);
                        fetchPrescriptionDetail(prescription.appointmentId);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      詳細を見る
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prescription.medications.map((medication) => (
                      <div key={medication.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">{medication.name}</h4>
                        {medication.genericName && medication.genericName !== medication.name && (
                          <p className="text-sm text-gray-600 mb-2">一般名: {medication.genericName}</p>
                        )}
                        <div className="space-y-1 text-sm text-gray-700">
                          <div className="flex justify-between">
                            <span>用量:</span>
                            <span className="font-medium">{medication.dosage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>頻度:</span>
                            <span className="font-medium">{medication.frequency}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>期間:</span>
                            <span className="font-medium">{medication.duration}</span>
                          </div>
                          {medication.instructions && (
                            <div className="mt-2 p-2 bg-yellow-50 border-l-4 border-yellow-400">
                              <p className="text-sm text-yellow-800">{medication.instructions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    処方日時: {formatDate(prescription.prescribedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 詳細モーダル（将来の拡張用） */}
          {selectedPrescription && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-900">処方箋詳細</h2>
                    <button
                      onClick={() => setSelectedPrescription(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">診察情報</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <p><strong>診察日:</strong> {formatDate(selectedPrescription.scheduledAt)}</p>
                      <p><strong>担当医師:</strong> {selectedPrescription.doctorName}</p>
                      <p><strong>診察タイプ:</strong> {getAppointmentTypeLabel(selectedPrescription.appointmentType)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">処方薬一覧</h3>
                    <div className="space-y-3">
                      {selectedPrescription.medications.map((medication) => (
                        <div key={medication.id} className="border border-gray-200 rounded p-3">
                          <h4 className="font-medium text-gray-900">{medication.name}</h4>
                          {medication.genericName && (
                            <p className="text-sm text-gray-600">一般名: {medication.genericName}</p>
                          )}
                          <div className="mt-2 text-sm">
                            <p><strong>用量:</strong> {medication.dosage}</p>
                            <p><strong>頻度:</strong> {medication.frequency}</p>
                            <p><strong>期間:</strong> {medication.duration}</p>
                            {medication.instructions && (
                              <p className="mt-1"><strong>服薬指導:</strong> {medication.instructions}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedPrescription(null)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      閉じる
                    </button>
                    <button
                      onClick={() => {
                        // 印刷機能（将来実装）
                        alert('印刷機能は今後実装予定です');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      印刷
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
};

export default PatientPrescriptions;
