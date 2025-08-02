import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/auth';

interface MedicalRecordModalProps {
  appointmentId: string;
  onClose: () => void;
}

interface MedicalRecordData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vitalSigns?: {
    temperature?: number;
    bloodPressure?: {
      systolic: number;
      diastolic: number;
    };
    pulse?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  prescriptions?: PrescriptionMedication[];
}

interface PrescriptionMedication {
  id?: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export function MedicalRecordModal({ appointmentId, onClose }: MedicalRecordModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRecord, setExistingRecord] = useState<any>(null);

  const [formData, setFormData] = useState<MedicalRecordData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    vitalSigns: {
      temperature: undefined,
      bloodPressure: {
        systolic: 0,
        diastolic: 0,
      },
      pulse: undefined,
      respiratoryRate: undefined,
      oxygenSaturation: undefined,
    },
    prescriptions: []
  });

  // 既存のカルテデータを取得
  useEffect(() => {
    fetchExistingRecord();
  }, [appointmentId]);

  const fetchExistingRecord = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('認証エラー: ログインしてください');
        return;
      }

      const response = await fetch(`/api/worker/medical-records/${appointmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExistingRecord(data.record);

        // 既存データがある場合はフォームに設定
        if (data.record) {
          setFormData({
            subjective: data.record.subjective || '',
            objective: data.record.objective || '',
            assessment: data.record.assessment || '',
            plan: data.record.plan || '',
            vitalSigns: data.record.vitalSigns || formData.vitalSigns,
            prescriptions: data.record.prescriptions || [],
          });
        }
      } else if (response.status !== 404) {
        // 404以外のエラーの場合のみエラーメッセージを表示
        setError('カルテの取得に失敗しました');
      }
    } catch (err) {
      console.error('Error fetching medical record:', err);
      setError('カルテの取得中にエラーが発生しました');
    }
  };

  // 処方箋管理関数
  const addPrescription = () => {
    const newPrescription: PrescriptionMedication = {
      id: Date.now().toString(),
      name: '',
      genericName: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
    };
    setFormData({
      ...formData,
      prescriptions: [...(formData.prescriptions || []), newPrescription],
    });
  };

  const removePrescription = (index: number) => {
    const newPrescriptions = formData.prescriptions?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      prescriptions: newPrescriptions,
    });
  };

  const updatePrescription = (index: number, field: keyof PrescriptionMedication, value: string) => {
    const newPrescriptions = [...(formData.prescriptions || [])];
    newPrescriptions[index] = {
      ...newPrescriptions[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      prescriptions: newPrescriptions,
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        setError('認証エラー: ログインしてください');
        return;
      }

      // バイタルサインのデータを整形
      const vitalSignsData = {
        temperature: formData.vitalSigns?.temperature || null,
        bloodPressure: formData.vitalSigns?.bloodPressure?.systolic && formData.vitalSigns?.bloodPressure?.diastolic
          ? {
              systolic: formData.vitalSigns.bloodPressure.systolic,
              diastolic: formData.vitalSigns.bloodPressure.diastolic,
            }
          : null,
        pulse: formData.vitalSigns?.pulse || null,
        respiratoryRate: formData.vitalSigns?.respiratoryRate || null,
        oxygenSaturation: formData.vitalSigns?.oxygenSaturation || null,
      };

      const requestData = {
        appointmentId: parseInt(appointmentId),
        subjective: formData.subjective,
        objective: formData.objective,
        assessment: formData.assessment,
        plan: formData.plan,
        vitalSigns: JSON.stringify(vitalSignsData),
      };

      // 既存レコードがある場合は更新、ない場合は新規作成
      const url = existingRecord
        ? `/api/worker/medical-records/${existingRecord.id}`
        : '/api/worker/medical-records';

      const method = existingRecord ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'カルテの保存に失敗しました');
      }

      // 成功したらモーダルを閉じる
      onClose();
    } catch (err) {
      console.error('Error saving medical record:', err);
      setError(err instanceof Error ? err.message : 'カルテの保存中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            カルテ記入 {existingRecord ? '(編集)' : '(新規)'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* SOAP形式の入力フィールド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                S: 主観的所見 (Subjective)
              </label>
              <textarea
                value={formData.subjective}
                onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="患者の主訴、症状の経過など..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                O: 客観的所見 (Objective)
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="身体所見、検査結果など..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                A: 評価 (Assessment)
              </label>
              <textarea
                value={formData.assessment}
                onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="診断、鑑別診断など..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                P: 計画 (Plan)
              </label>
              <textarea
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="治療方針、処方、フォローアップなど..."
              />
            </div>
          </div>

          {/* バイタルサイン */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">バイタルサイン</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  体温 (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.vitalSigns?.temperature || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitalSigns: {
                      ...formData.vitalSigns,
                      temperature: e.target.value ? parseFloat(e.target.value) : undefined,
                    }
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="36.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  血圧 (mmHg)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.vitalSigns?.bloodPressure?.systolic || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitalSigns: {
                        ...formData.vitalSigns,
                        bloodPressure: {
                          ...formData.vitalSigns?.bloodPressure,
                          systolic: e.target.value ? parseInt(e.target.value) : 0,
                        } as any,
                      }
                    })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="120"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    value={formData.vitalSigns?.bloodPressure?.diastolic || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      vitalSigns: {
                        ...formData.vitalSigns,
                        bloodPressure: {
                          ...formData.vitalSigns?.bloodPressure,
                          diastolic: e.target.value ? parseInt(e.target.value) : 0,
                        } as any,
                      }
                    })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="80"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  脈拍 (回/分)
                </label>
                <input
                  type="number"
                  value={formData.vitalSigns?.pulse || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitalSigns: {
                      ...formData.vitalSigns,
                      pulse: e.target.value ? parseInt(e.target.value) : undefined,
                    }
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="70"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  呼吸数 (回/分)
                </label>
                <input
                  type="number"
                  value={formData.vitalSigns?.respiratoryRate || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitalSigns: {
                      ...formData.vitalSigns,
                      respiratoryRate: e.target.value ? parseInt(e.target.value) : undefined,
                    }
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="16"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={formData.vitalSigns?.oxygenSaturation || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    vitalSigns: {
                      ...formData.vitalSigns,
                      oxygenSaturation: e.target.value ? parseInt(e.target.value) : undefined,
                    }
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="98"
                />
              </div>
            </div>
          </div>

          {/* 処方箋セクション */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">処方箋</h3>
              <button
                type="button"
                onClick={addPrescription}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                薬剤追加
              </button>
            </div>

            {formData.prescriptions && formData.prescriptions.length > 0 ? (
              <div className="space-y-4">
                {formData.prescriptions.map((prescription, index) => (
                  <div key={prescription.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-700">薬剤 {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removePrescription(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          薬剤名 *
                        </label>
                        <input
                          type="text"
                          value={prescription.name}
                          onChange={(e) => updatePrescription(index, 'name', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="アセトアミノフェン錠"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          一般名
                        </label>
                        <input
                          type="text"
                          value={prescription.genericName || ''}
                          onChange={(e) => updatePrescription(index, 'genericName', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="acetaminophen"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          用量 *
                        </label>
                        <input
                          type="text"
                          value={prescription.dosage}
                          onChange={(e) => updatePrescription(index, 'dosage', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="500mg"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          用法 *
                        </label>
                        <input
                          type="text"
                          value={prescription.frequency}
                          onChange={(e) => updatePrescription(index, 'frequency', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1日3回毎食後"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          日数 *
                        </label>
                        <input
                          type="text"
                          value={prescription.duration}
                          onChange={(e) => updatePrescription(index, 'duration', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="7日分"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          服薬指導
                        </label>
                        <input
                          type="text"
                          value={prescription.instructions}
                          onChange={(e) => updatePrescription(index, 'instructions', e.target.value)}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="食後に水と一緒に服用してください"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                <p>処方薬がありません</p>
                <p className="text-sm mt-1">「薬剤追加」ボタンで処方薬を追加してください</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400"
            >
              {loading ? '保存中...' : existingRecord ? '更新' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
