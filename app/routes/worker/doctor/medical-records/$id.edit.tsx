import { useNavigate, useParams } from 'react-router';
import { Form, useNavigation } from 'react-router';
import React, { useState, useEffect } from 'react';
import { Header } from '~/components/common/Header';
import { Loading } from '~/components/common/Loading';
import { getWorkerAuthToken } from '~/utils/auth';

export default function MedicalRecordEdit() {
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const [loaderData, setLoaderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedicalRecord = async () => {
      if (!appointmentId) {
        setError('診察IDが無効です');
        setLoading(false);
        return;
      }

      const token = getWorkerAuthToken();
      if (!token) {
        navigate('/worker/login');
        return;
      }

      try {
        const response = await fetch(`/api/worker/medical-records/${appointmentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('カルテが見つかりません');
          }
          throw new Error('カルテの取得に失敗しました');
        }

        const data: any = await response.json();
        setLoaderData({
          appointmentId,
          medicalRecord: data.medicalRecord,
          appointment: data.appointment,
          patient: data.patient,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalRecord();
  }, [appointmentId, navigate]);

  const { medicalRecord, appointment, patient } = loaderData || {};
  const [formData, setFormData] = useState({
    chiefComplaint: '',
    symptoms: '',
    objectiveFindings: '',
    assessment: '',
    plan: '',
    notes: '',
  });

  useEffect(() => {
    if (medicalRecord) {
      setFormData({
        chiefComplaint: medicalRecord.chiefComplaint || '',
        symptoms: medicalRecord.symptoms || '',
        objectiveFindings: medicalRecord.objectiveFindings || '',
        assessment: medicalRecord.assessment || '',
        plan: medicalRecord.plan || '',
        notes: medicalRecord.notes || '',
      });
    }
  }, [medicalRecord]);

  const isSubmitting = navigation.state === 'submitting';

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getWorkerAuthToken();
    if (!token) {
      navigate('/worker/login');
      return;
    }

    const medicalRecordData = { ...formData };

    try {
      const url = medicalRecord?.id
        ? `/api/worker/medical-records/${medicalRecord.id}`
        : `/api/worker/medical-records`;

      const response = await fetch(url, {
        method: medicalRecord?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          medicalRecord?.id
            ? medicalRecordData
            : { ...medicalRecordData, appointmentId: Number(appointmentId) }
        ),
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        setError(errorData.message || 'カルテの保存に失敗しました');
        return;
      }

      navigate(`/worker/doctor/dashboard?saved=true`);
    } catch (_err) {
      setError('カルテの保存中にエラーが発生しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">エラー</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">カルテ入力</h1>
          <p className="text-gray-600 mt-1">
            予約ID: {appointmentId} | 患者: {patient?.name} 様
          </p>
        </div>

        <Form method="post" className="space-y-6" onSubmit={handleSubmit}>
          {medicalRecord && (
            <input type="hidden" name="medicalRecordId" value={medicalRecord.id} />
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">患者基本情報</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">氏名:</span>
                <span className="ml-2 font-medium">{patient?.name}</span>
              </div>
              <div>
                <span className="text-gray-600">年齢:</span>
                <span className="ml-2 font-medium">{patient?.age}歳</span>
              </div>
              <div>
                <span className="text-gray-600">性別:</span>
                <span className="ml-2 font-medium">{patient?.gender === 'male' ? '男性' : '女性'}</span>
              </div>
              <div>
                <span className="text-gray-600">診察日時:</span>
                <span className="ml-2 font-medium">
                  {appointment && new Date(appointment.appointmentTime).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SOAP形式カルテ</h2>

            <div className="space-y-4">
              {/* S: 主観的所見 */}
              <div>
                <label htmlFor="chiefComplaint" className="block text-sm font-medium text-gray-700 mb-1">
                  主訴（Chief Complaint）
                </label>
                <input
                  id="chiefComplaint"
                  name="chiefComplaint"
                  type="text"
                  value={formData.chiefComplaint}
                  onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 頭痛、発熱、咳"
                />
              </div>

              <div>
                <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700 mb-1">
                  S: 主観的所見（Subjective）
                </label>
                <textarea
                  id="symptoms"
                  name="symptoms"
                  rows={3}
                  value={formData.symptoms}
                  onChange={(e) => handleInputChange('symptoms', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="患者の症状、訴え、病歴など"
                />
              </div>

              {/* O: 客観的所見 */}
              <div>
                <label htmlFor="objectiveFindings" className="block text-sm font-medium text-gray-700 mb-1">
                  O: 客観的所見（Objective）
                </label>
                <textarea
                  id="objectiveFindings"
                  name="objectiveFindings"
                  rows={3}
                  value={formData.objectiveFindings}
                  onChange={(e) => handleInputChange('objectiveFindings', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="検査結果、身体所見、バイタルサインなど"
                />
              </div>

              {/* A: 評価 */}
              <div>
                <label htmlFor="assessment" className="block text-sm font-medium text-gray-700 mb-1">
                  A: 評価（Assessment）
                </label>
                <textarea
                  id="assessment"
                  name="assessment"
                  rows={3}
                  value={formData.assessment}
                  onChange={(e) => handleInputChange('assessment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="診断、病態の評価、鑑別診断など"
                />
              </div>

              {/* P: 計画 */}
              <div>
                <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
                  P: 計画（Plan）
                </label>
                <textarea
                  id="plan"
                  name="plan"
                  rows={3}
                  value={formData.plan}
                  onChange={(e) => handleInputChange('plan', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="治療計画、処方、フォローアップなど"
                />
              </div>

              {/* 備考 */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  備考・申し送り事項
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="次回診察時の注意点など"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中...' : 'カルテを保存'}
            </button>
          </div>
        </Form>

        {navigation.state === 'loading' && <Loading />}
      </div>
    </div>
  )
}
