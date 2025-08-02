import { useState, useEffect } from 'react';

interface CallSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: CallSettings) => void;
  currentSettings: CallSettings;
}

interface CallSettings {
  videoQuality: 'low' | 'medium' | 'high';
  audioQuality: 'low' | 'medium' | 'high';
  selectedCamera: string;
  selectedMicrophone: string;
  enableEchoCancellation: boolean;
  enableNoiseReduction: boolean;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function CallSettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings
}: CallSettingsModalProps) {
  const [settings, setSettings] = useState<CallSettings>(currentSettings);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      // カメラデバイスの取得
      const videoDevices = await navigator.mediaDevices.enumerateDevices();
      const cameraDevices = videoDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `カメラ ${device.deviceId.slice(0, 8)}`
        }));
      setCameras(cameraDevices);

      // マイクデバイスの取得
      const audioDevices = videoDevices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `マイク ${device.deviceId.slice(0, 8)}`
        }));
      setMicrophones(audioDevices);
    } catch (error) {
      console.error('デバイス取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleTestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: settings.selectedCamera }
      });
      
      // テスト用のビデオ要素を作成
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // 3秒後に停止
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 3000);
      
      alert('カメラテスト完了');
    } catch (error) {
      alert('カメラテストに失敗しました');
    }
  };

  const handleTestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: settings.selectedMicrophone }
      });
      
      // テスト用のオーディオ要素を作成
      const audio = document.createElement('audio');
      audio.srcObject = stream;
      audio.play();
      
      // 3秒後に停止
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 3000);
      
      alert('マイクテスト完了');
    } catch (error) {
      alert('マイクテストに失敗しました');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">通話設定</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600">デバイスを読み込み中...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ビデオ品質設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ビデオ品質
              </label>
              <select
                value={settings.videoQuality}
                onChange={(e) => setSettings(prev => ({ ...prev, videoQuality: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="low">低品質（帯域節約）</option>
                <option value="medium">標準品質</option>
                <option value="high">高品質</option>
              </select>
            </div>

            {/* 音声品質設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                音声品質
              </label>
              <select
                value={settings.audioQuality}
                onChange={(e) => setSettings(prev => ({ ...prev, audioQuality: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="low">低品質（帯域節約）</option>
                <option value="medium">標準品質</option>
                <option value="high">高品質</option>
              </select>
            </div>

            {/* カメラ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カメラ
              </label>
              <div className="flex gap-2">
                <select
                  value={settings.selectedCamera}
                  onChange={(e) => setSettings(prev => ({ ...prev, selectedCamera: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded-md"
                >
                  {cameras.map(camera => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTestCamera}
                  className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  テスト
                </button>
              </div>
            </div>

            {/* マイク選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                マイク
              </label>
              <div className="flex gap-2">
                <select
                  value={settings.selectedMicrophone}
                  onChange={(e) => setSettings(prev => ({ ...prev, selectedMicrophone: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded-md"
                >
                  {microphones.map(mic => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTestMicrophone}
                  className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  テスト
                </button>
              </div>
            </div>

            {/* 音声処理設定 */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableEchoCancellation}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableEchoCancellation: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">エコーキャンセレーション</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableNoiseReduction}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableNoiseReduction: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">ノイズリダクション</span>
              </label>
            </div>

            {/* ボタン */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 