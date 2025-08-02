import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { getAuthToken } from '../utils/auth';

interface PrescriptionMedication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface PrescriptionSectionProps {
  appointmentId: string;
  initialPrescriptions?: any[];
  onPrescriptionsChange?: (prescriptions: PrescriptionMedication[]) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

const PrescriptionSection = memo(function PrescriptionSection({
  appointmentId,
  initialPrescriptions = [],
  onPrescriptionsChange,
  isCollapsed = false,
  onToggleCollapse
}: PrescriptionSectionProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionMedication[]>(initialPrescriptions);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false
  });

  // initialPrescriptionsが変更されたときにstateを更新（IDがない場合は生成）
  useEffect(() => {
    const prescriptionsWithIds = initialPrescriptions.map(prescription => ({
      ...prescription,
      id: prescription.id || `prescription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
    setPrescriptions(prescriptionsWithIds);
  }, [initialPrescriptions]);

  // 処方箋データ変更通知（メモ化）
  const notifyChange = useCallback((newPrescriptions: PrescriptionMedication[]) => {
    setPrescriptions(newPrescriptions);
    onPrescriptionsChange?.(newPrescriptions);
    setSaveStatus(prev => ({ ...prev, hasUnsavedChanges: true }));
  }, [onPrescriptionsChange]);

  // 薬剤追加（メモ化）
  const addPrescription = useCallback(() => {
    const newPrescription: PrescriptionMedication = {
      id: `prescription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      genericName: '',
      dosage: '1錠',
      frequency: '1日3回',
      duration: '7日分',
      instructions: '食後に水と一緒に服用してください'
    };
    const newPrescriptions = [...prescriptions, newPrescription];
    notifyChange(newPrescriptions);
  }, [prescriptions, notifyChange]);

  // 薬剤削除（メモ化）
  const removePrescription = useCallback((index: number) => {
    const newPrescriptions = prescriptions.filter((_, i) => i !== index);
    notifyChange(newPrescriptions);
  }, [prescriptions, notifyChange]);

  // 薬剤更新（メモ化）
  const updatePrescription = useCallback((index: number, field: keyof PrescriptionMedication, value: string) => {
    const newPrescriptions = prescriptions.map((prescription, i) =>
      i === index ? { ...prescription, [field]: value } : prescription
    );
    notifyChange(newPrescriptions);
  }, [prescriptions, notifyChange]);

  // 処方箋即座保存（メモ化）
  const savePrescriptionsNow = useCallback(async () => {
    try {
      setSaveStatus(prev => ({ ...prev, isSaving: true }));

      const token = getAuthToken();
      if (!token) {
        throw new Error('認証エラー');
      }

      // 統合された医療記録APIを使用
      const response = await fetch(`/api/worker/medical-records/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prescriptions: prescriptions.map(p => ({
            name: p.name,
            genericName: p.genericName,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration,
            instructions: p.instructions
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('処方箋の保存に失敗しました');
      }

      setSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false
      });

      console.log('処方箋が正常に保存されました');
    } catch (err) {
      console.error('Prescription save error:', err);
      setSaveStatus(prev => ({ ...prev, isSaving: false }));
    }
  }, [appointmentId, prescriptions]);

  // 保存状態表示（メモ化）
  const saveStatusDisplay = useMemo(() => {
    if (saveStatus.isSaving) {
      return <span className="text-blue-600 text-sm">保存中...</span>;
    }
    if (saveStatus.lastSaved) {
      const timeAgo = Math.floor((Date.now() - saveStatus.lastSaved.getTime()) / 60000);
      return <span className="text-green-600 text-sm">
        {timeAgo === 0 ? '今保存しました' : `${timeAgo}分前に保存`}
      </span>;
    }
    if (saveStatus.hasUnsavedChanges) {
      return <span className="text-orange-600 text-sm">未保存の変更</span>;
    }
    return null;
  }, [saveStatus]);

  // 薬剤アイテムコンポーネント（メモ化）
  const PrescriptionItem = memo(function PrescriptionItem({
    prescription,
    index,
    onUpdate,
    onRemove
  }: {
    prescription: PrescriptionMedication;
    index: number;
    onUpdate: (index: number, field: keyof PrescriptionMedication, value: string) => void;
    onRemove: (index: number) => void;
  }) {
    // ローカル状態で入力値を管理（フォーカス問題回避）
    const [localValues, setLocalValues] = useState({
      name: prescription.name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      instructions: prescription.instructions
    });

    // prescription propsが変更された時にローカル状態を同期
    useEffect(() => {
      setLocalValues({
        name: prescription.name,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        instructions: prescription.instructions
      });
    }, [prescription]);

    // ローカル値変更ハンドラー（即座に反映、状態更新なし）
    const handleLocalChange = (field: keyof typeof localValues, value: string) => {
      setLocalValues(prev => ({ ...prev, [field]: value }));
    };

    // フォーカス離脱時に親コンポーネントに通知（状態更新）
    const handleBlur = (field: keyof typeof localValues) => {
      const value = localValues[field];
      if (value !== prescription[field as keyof PrescriptionMedication]) {
        onUpdate(index, field as keyof PrescriptionMedication, value);
      }
    };

    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-800">処方薬 {index + 1}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            削除
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">薬剤名</label>
            <input
              type="text"
              placeholder="薬剤名を入力"
              value={localValues.name}
              onChange={(e) => handleLocalChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用量</label>
            <input
              type="text"
              placeholder="1錠"
              value={localValues.dosage}
              onChange={(e) => handleLocalChange('dosage', e.target.value)}
              onBlur={() => handleBlur('dosage')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">頻度</label>
            <input
              type="text"
              placeholder="1日3回"
              value={localValues.frequency}
              onChange={(e) => handleLocalChange('frequency', e.target.value)}
              onBlur={() => handleBlur('frequency')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期間</label>
            <input
              type="text"
              placeholder="7日分"
              value={localValues.duration}
              onChange={(e) => handleLocalChange('duration', e.target.value)}
              onBlur={() => handleBlur('duration')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">服薬指導</label>
            <input
              type="text"
              placeholder="食後に水と一緒に服用してください"
              value={localValues.instructions}
              onChange={(e) => handleLocalChange('instructions', e.target.value)}
              onBlur={() => handleBlur('instructions')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        onClick={onToggleCollapse}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h4 className="text-lg font-medium text-gray-900">処方箋</h4>
        <svg
          className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {prescriptions.length}件の処方薬
              </span>
              {saveStatusDisplay}
            </div>
            <div className="flex gap-2">
              <button
                onClick={addPrescription}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                薬剤追加
              </button>
              <button
                onClick={savePrescriptionsNow}
                disabled={saveStatus.isSaving || !saveStatus.hasUnsavedChanges}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                処方箋を保存
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {prescriptions.map((prescription, index) => (
              <PrescriptionItem
                key={prescription.id}
                prescription={prescription}
                index={index}
                onUpdate={updatePrescription}
                onRemove={removePrescription}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default PrescriptionSection;
