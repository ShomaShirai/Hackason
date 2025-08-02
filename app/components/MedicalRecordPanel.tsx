import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { getAuthToken } from '../utils/auth';
import PrescriptionSection from './PrescriptionSection';

interface MedicalRecordPanelProps {
  appointmentId: string;
  onClose?: () => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
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

interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export const MedicalRecordPanel = memo(function MedicalRecordPanel({
  appointmentId,
  onClose,
  isCollapsible = true,
  defaultExpanded = true,
  className = ''
}: MedicalRecordPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false
  });

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

  // 処方箋データ（分離管理）
  const [prescriptions, setPrescriptions] = useState<PrescriptionMedication[]>([]);

  // 自動保存用のdebounce
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [collapsedSections, setCollapsedSections] = useState({
    soap: false,
    vitals: false,
    prescriptions: false
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
          const recordData = {
            subjective: data.record.subjective || '',
            objective: data.record.objective || '',
            assessment: data.record.assessment || '',
            plan: data.record.plan || '',
            vitalSigns: data.record.vitalSigns || formData.vitalSigns,
            prescriptions: data.record.prescriptions || [],
          };
          setFormData(recordData);

          // 分離された処方箋stateにも設定
          const existingPrescriptions = data.record.prescriptions || [];
          setPrescriptions(existingPrescriptions);

          setSaveStatus(prev => ({ ...prev, lastSaved: new Date() }));
        }
      } else if (response.status !== 404) {
        setError('カルテの取得に失敗しました');
      }
    } catch (err) {
      console.error('Error fetching medical record:', err);
      setError('カルテの取得中にエラーが発生しました');
    }
  };

  // 自動保存機能
  const autoSave = useCallback(async (data: MedicalRecordData) => {
    try {
      setSaveStatus(prev => ({ ...prev, isSaving: true }));

      const token = getAuthToken();
      if (!token) {
        throw new Error('認証エラー');
      }

      const url = existingRecord
        ? `/api/worker/medical-records/${existingRecord.id}`
        : '/api/worker/medical-records';

      const method = existingRecord ? 'PUT' : 'POST';

      const requestBody = {
        appointmentId: parseInt(appointmentId),
        ...data,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('保存に失敗しました');
      }

      const result = await response.json();
      if (!existingRecord) {
        setExistingRecord(result.record);
      }

      setSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false
      });

      setError(null);
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveStatus(prev => ({ ...prev, isSaving: false }));
      // 自動保存のエラーは表示しない（UX考慮）
    }
  }, [appointmentId, existingRecord]);

  // フォームデータ変更時の自動保存
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setSaveStatus(prev => ({ ...prev, hasUnsavedChanges: true }));

    debounceRef.current = setTimeout(() => {
      autoSave(formData);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [formData, autoSave]);

  const handleInputChange = (field: keyof MedicalRecordData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVitalSignChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      vitalSigns: {
        ...prev.vitalSigns,
        [field]: value
      }
    }));
  };

  // 処方箋データ変更ハンドラー（メモ化）
  const handlePrescriptionsChange = useCallback((newPrescriptions: PrescriptionMedication[]) => {
    setPrescriptions(newPrescriptions);
    // formDataからは処方箋を除外
    setFormData(prev => ({
      ...prev,
      prescriptions: newPrescriptions
    }));
  }, []);



  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) {return '';}
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {return '今保存しました';}
    if (minutes < 60) {return `${minutes}分前に保存`;}
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isExpanded && isCollapsible) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">カルテ記入</h3>
            <div className="flex items-center gap-2">
              {saveStatus.hasUnsavedChanges && (
                <span className="text-xs text-orange-500">未保存の変更</span>
              )}
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-800">
              カルテ記入 {existingRecord ? '(編集)' : '(新規)'}
            </h3>
            {saveStatus.isSaving && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">保存中...</span>
              </div>
            )}
            {!saveStatus.isSaving && saveStatus.lastSaved && (
              <span className="text-xs text-gray-500">
                {formatLastSaved(saveStatus.lastSaved)}
              </span>
            )}
            {saveStatus.hasUnsavedChanges && !saveStatus.isSaving && (
              <span className="text-xs text-orange-500">未保存の変更</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCollapsible && (
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="折りたたむ"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="閉じる"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-6">
          {/* SOAP形式の入力フィールド */}
          <div>
            <button
              onClick={() => toggleSection('soap')}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <h4 className="text-lg font-semibold text-gray-800">SOAP記録</h4>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${collapsedSections.soap ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {!collapsedSections.soap && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    S: 主観的所見 (Subjective)
                  </label>
                  <textarea
                    value={formData.subjective}
                    onChange={(e) => handleInputChange('subjective', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="患者の主訴、症状の経過など..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    O: 客観的所見 (Objective)
                  </label>
                  <textarea
                    value={formData.objective}
                    onChange={(e) => handleInputChange('objective', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="身体所見、検査結果など..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    A: 評価 (Assessment)
                  </label>
                  <textarea
                    value={formData.assessment}
                    onChange={(e) => handleInputChange('assessment', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="診断、鑑別診断など..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    P: 計画 (Plan)
                  </label>
                  <textarea
                    value={formData.plan}
                    onChange={(e) => handleInputChange('plan', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="治療方針、処方、フォローアップなど..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* バイタルサイン */}
          <div>
            <button
              onClick={() => toggleSection('vitals')}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <h4 className="text-lg font-semibold text-gray-800">バイタルサイン</h4>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${collapsedSections.vitals ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {!collapsedSections.vitals && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    体温 (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vitalSigns?.temperature || ''}
                    onChange={(e) => handleVitalSignChange('temperature', parseFloat(e.target.value) || undefined)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="36.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    脈拍 (bpm)
                  </label>
                  <input
                    type="number"
                    value={formData.vitalSigns?.pulse || ''}
                    onChange={(e) => handleVitalSignChange('pulse', parseInt(e.target.value) || undefined)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    血圧 (mmHg)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.vitalSigns?.bloodPressure?.systolic || ''}
                      onChange={(e) => handleVitalSignChange('bloodPressure', {
                        ...formData.vitalSigns?.bloodPressure,
                        systolic: parseInt(e.target.value) || 0
                      })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="120"
                    />
                    <span className="flex items-center text-gray-500">/</span>
                    <input
                      type="number"
                      value={formData.vitalSigns?.bloodPressure?.diastolic || ''}
                      onChange={(e) => handleVitalSignChange('bloodPressure', {
                        ...formData.vitalSigns?.bloodPressure,
                        diastolic: parseInt(e.target.value) || 0
                      })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="80"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    呼吸数 (回/分)
                  </label>
                  <input
                    type="number"
                    value={formData.vitalSigns?.respiratoryRate || ''}
                    onChange={(e) => handleVitalSignChange('respiratoryRate', parseInt(e.target.value) || undefined)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="16"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    酸素飽和度 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.vitalSigns?.oxygenSaturation || ''}
                    onChange={(e) => handleVitalSignChange('oxygenSaturation', parseInt(e.target.value) || undefined)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="98"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 処方箋セクション（最適化済み独立コンポーネント） */}
          <PrescriptionSection
            appointmentId={appointmentId}
            initialPrescriptions={prescriptions}
            onPrescriptionsChange={handlePrescriptionsChange}
            isCollapsed={collapsedSections.prescriptions}
            onToggleCollapse={() => toggleSection('prescriptions')}
          />
        </div>
      </div>
    </div>
  );
});
