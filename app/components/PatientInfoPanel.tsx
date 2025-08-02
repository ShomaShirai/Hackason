import { useState, useEffect, useCallback } from 'react';
import { get } from '~/utils/api-client';

interface PatientInfo {
  id: string;
  name: string;
  age: number;
  gender: string;
  medicalHistory?: string[];
  currentMedications?: string[];
  allergies?: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
  };
}

interface AppointmentInfo {
  id: string;
  chiefComplaint: string;
  symptoms: string[];
  duration: string;
  severity: string;
  questionnaireCompleted: boolean;
}

interface PatientInfoPanelProps {
  appointmentId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PatientInfoPanel({
  appointmentId,
  isCollapsed = false,
  onToggleCollapse
}: PatientInfoPanelProps) {
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatientInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await get<{
        patient: PatientInfo;
        appointment: AppointmentInfo;
      }>(`/api/worker/appointments/${appointmentId}/details`);

      setPatientInfo(data.patient);
      setAppointmentInfo(data.appointment);
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to load patient information');
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchPatientInfo();
  }, [fetchPatientInfo]);

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        <p className="font-semibold">エラー</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!patientInfo || !appointmentInfo) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-md transition-all duration-300 ${
      isCollapsed ? 'w-12' : 'w-80'
    }`}>
      {/* ヘッダー */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <h3 className={`font-semibold ${isCollapsed ? 'hidden' : 'block'}`}>
          患者情報
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            aria-label={isCollapsed ? '展開' : '折りたたむ'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
              />
            </svg>
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* 基本情報 */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">基本情報</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">氏名:</span> {patientInfo.name}</p>
              <p><span className="text-gray-500">年齢:</span> {patientInfo.age}歳</p>
              <p><span className="text-gray-500">性別:</span> {patientInfo.gender}</p>
            </div>
          </div>

          {/* 主訴 */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">主訴</h4>
            <p className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
              {appointmentInfo.chiefComplaint}
            </p>
          </div>

          {/* 症状 */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">症状</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {appointmentInfo?.symptoms && Array.isArray(appointmentInfo.symptoms)
                ? appointmentInfo.symptoms.map((symptom, index) => (
                    <li key={index}>{symptom}</li>
                  ))
                : <li className="text-gray-500">症状情報なし</li>
              }
            </ul>
            <div className="mt-2 text-sm text-gray-600">
              <p>期間: {appointmentInfo?.duration || '不明'}</p>
              <p>重症度: <span className={`font-semibold ${
                appointmentInfo?.severity === '重度' ? 'text-red-600' :
                appointmentInfo?.severity === '中等度' ? 'text-orange-600' :
                'text-green-600'
              }`}>{appointmentInfo?.severity || '不明'}</span></p>
            </div>
          </div>

          {/* アレルギー */}
          {patientInfo?.allergies && Array.isArray(patientInfo.allergies) && patientInfo.allergies.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">アレルギー</h4>
              <div className="bg-red-50 p-2 rounded border border-red-200">
                <ul className="list-disc list-inside text-sm space-y-1">
                  {patientInfo.allergies.map((allergy, index) => (
                    <li key={index} className="text-red-700">{allergy}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 現在の服薬 */}
          {patientInfo?.currentMedications && Array.isArray(patientInfo.currentMedications) && patientInfo.currentMedications.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">現在の服薬</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {patientInfo.currentMedications.map((med, index) => (
                  <li key={index}>{med}</li>
                ))}
              </ul>
            </div>
          )}

          {/* バイタルサイン */}
          {patientInfo.vitalSigns && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">バイタルサイン</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {patientInfo.vitalSigns.bloodPressure && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500 text-xs">血圧</p>
                    <p className="font-semibold">{patientInfo.vitalSigns.bloodPressure}</p>
                  </div>
                )}
                {patientInfo.vitalSigns.heartRate && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500 text-xs">心拍数</p>
                    <p className="font-semibold">{patientInfo.vitalSigns.heartRate} bpm</p>
                  </div>
                )}
                {patientInfo.vitalSigns.temperature && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500 text-xs">体温</p>
                    <p className="font-semibold">{patientInfo.vitalSigns.temperature}°C</p>
                  </div>
                )}
                {patientInfo.vitalSigns.oxygenSaturation && (
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500 text-xs">SpO2</p>
                    <p className="font-semibold">{patientInfo.vitalSigns.oxygenSaturation}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 問診票完了状態 */}
          <div className="border-t pt-2">
            <p className="text-sm">
              問診票:
              <span className={`ml-2 font-semibold ${
                appointmentInfo.questionnaireCompleted ? 'text-green-600' : 'text-orange-600'
              }`}>
                {appointmentInfo.questionnaireCompleted ? '完了済み' : '未完了'}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
