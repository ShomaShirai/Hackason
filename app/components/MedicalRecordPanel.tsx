import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../utils/auth';
import PrescriptionSection from './PrescriptionSection';

interface MedicalRecordPanelProps {
  appointmentId: string;
  onClose?: () => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  onAutoSaveStatusChange?: (status: { isAutoSaving: boolean; lastAutoSaved: Date | null }) => void;
  externalAutoSaveStatus?: { isAutoSaving: boolean; lastAutoSaved: Date | null };
  externalTranscript?: string; // 外部からの字幕データ
}

interface MedicalRecordData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  transcript?: string; // 音声認識字幕
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
  isAutoSaving?: boolean; // 自動保存状態
  lastAutoSaved?: Date | null; // 最後の自動保存時刻
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error';
  message: string;
  timestamp: Date;
}

export const MedicalRecordPanel = memo(function MedicalRecordPanel({
  appointmentId,
  onClose,
  isCollapsible = true,
  defaultExpanded = true,
  className = '',
  onAutoSaveStatusChange,
  externalAutoSaveStatus,
  externalTranscript
}: MedicalRecordPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    isAutoSaving: false,
    lastAutoSaved: null
  });

  // トースト通知の状態管理
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);

  const [formData, setFormData] = useState<MedicalRecordData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    transcript: '', // 音声認識字幕
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

  // 自動保存状態を親コンポーネントに通知
  useEffect(() => {
    if (onAutoSaveStatusChange) {
      onAutoSaveStatusChange({
        isAutoSaving: saveStatus.isAutoSaving || false,
        lastAutoSaved: saveStatus.lastAutoSaved || null
      });
    }
  }, [saveStatus.isAutoSaving, saveStatus.lastAutoSaved, onAutoSaveStatusChange]);

  // 外部から自動保存状態を受け取る
  useEffect(() => {
    if (externalAutoSaveStatus) {
      setSaveStatus(prev => ({
        ...prev,
        isAutoSaving: externalAutoSaveStatus.isAutoSaving,
        lastAutoSaved: externalAutoSaveStatus.lastAutoSaved
      }));
    }
  }, [externalAutoSaveStatus]);

  // 外部から字幕データを受け取る
  useEffect(() => {
    if (externalTranscript) {
      setFormData(prev => ({ ...prev, transcript: externalTranscript }));
    }
  }, [externalTranscript]);

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
        const data = await response.json() as {
          record?: {
            id?: number;
            appointmentId: number;
            subjective: string;
            objective: string;
            assessment: string;
            plan: string;
            transcript?: string;
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
            createdAt?: string;
            updatedAt?: string;
          };
        };
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

      const result = await response.json() as {
        success: boolean;
        message?: string;
        record?: {
          id: number;
          appointmentId: number;
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
          transcript?: string;
          vitalSigns?: any;
          prescriptions?: any[];
          createdAt: string;
          updatedAt: string;
        };
      };
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
        [field]: value,
      },
    }));
  };

  // 手動保存機能
  const handleManualSave = useCallback(async () => {
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
        ...formData,
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

      const result = await response.json() as {
        success: boolean;
        message?: string;
        record?: {
          id: number;
          appointmentId: number;
          subjective: string;
          objective: string;
          assessment: string;
          plan: string;
          transcript?: string;
          vitalSigns?: any;
          prescriptions?: any[];
          createdAt: string;
          updatedAt: string;
        };
      };

      if (!existingRecord) {
        setExistingRecord(result.record);
      }

      setSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false
      });

      setError(null);

      // 保存成功のトースト通知を追加
      const successToast: ToastNotification = {
        id: Date.now().toString(),
        type: 'success',
        message: 'カルテを保存しました',
        timestamp: new Date()
      };
      setToastNotifications(prev => [...prev, successToast]);

      // 3秒後にトースト通知を自動削除
      setTimeout(() => {
        setToastNotifications(prev => prev.filter(toast => toast.id !== successToast.id));
      }, 3000);

      console.log('✅ カルテを保存しました');
    } catch (err) {
      console.error('Manual save error:', err);
      setSaveStatus(prev => ({ ...prev, isSaving: false }));
      setError(err instanceof Error ? err.message : '保存に失敗しました');

      // エラーのトースト通知を追加
      const errorToast: ToastNotification = {
        id: Date.now().toString(),
        type: 'error',
        message: err instanceof Error ? err.message : '保存に失敗しました',
        timestamp: new Date()
      };
      setToastNotifications(prev => [...prev, errorToast]);

      // 5秒後にエラートースト通知を自動削除
      setTimeout(() => {
        setToastNotifications(prev => prev.filter(toast => toast.id !== errorToast.id));
      }, 5000);
    }
  }, [appointmentId, existingRecord, formData]);

  // トースト通知を削除する関数
  const removeToast = useCallback((toastId: string) => {
    setToastNotifications(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

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
    if (!date) { return ''; }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) { return '今保存しました'; }
    if (minutes < 60) { return `${minutes}分前に保存`; }
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
      {/* トースト通知 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toastNotifications.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${toast.type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
              }`}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'success' ? (
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className={`text-sm font-medium ${toast.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span className="sr-only">閉じる</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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
            {/* 手動保存ボタン */}
            <button
              onClick={handleManualSave}
              disabled={saveStatus.isSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="カルテを保存"
            >
              {saveStatus.isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  保存
                </div>
              )}
            </button>
            {/* カルテ一覧へのリンクボタン */}
            <a
              href="/worker/doctor/medical-records"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
              title="カルテ一覧を開く"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              一覧
            </a>
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

                {/* 音声認識字幕 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎤 音声認識字幕
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.transcript || ''}
                      onChange={(e) => handleInputChange('transcript', e.target.value)}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50"
                      rows={4}
                      placeholder="音声認識で生成された字幕がここに表示されます..."
                      readOnly={!!externalTranscript} // 外部字幕がある場合は読み取り専用
                    />
                    {/* リアルタイム保存状態インジケーター */}
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      {saveStatus.isAutoSaving && (
                        <div className="flex items-center gap-1 text-blue-600 text-xs">
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>自動保存中...</span>
                        </div>
                      )}
                      {saveStatus.lastAutoSaved && !saveStatus.isAutoSaving && (
                        <div className="text-green-600 text-xs">
                          ✓ 自動保存済み
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">
                      診察中の音声認識結果が自動的に保存されます
                    </p>
                    {saveStatus.lastAutoSaved && (
                      <p className="text-xs text-gray-400">
                        最終更新: {formatLastSaved(saveStatus.lastAutoSaved)}
                      </p>
                    )}
                  </div>
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
