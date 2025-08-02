import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Loading } from '~/components/common/Loading';
import { ErrorMessage } from '~/components/common/ErrorMessage';
import { getWorkerAuthToken } from '../utils/auth';
import { RequireDoctor } from '~/components/auth/RequireAuth';
import { getCurrentJstDate } from '~/utils/timezone';

export function meta() {
  return [
    { title: 'スケジュール登録 - オンライン診療システム' },
    { name: 'description', content: '医師のスケジュール登録・編集' },
  ];
}

interface Schedule {
  id?: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'busy' | 'break' | 'off';
  maxAppointments: number;
}

interface ScheduleFormData {
  date: string;
  startTime: string;
  endTime: string;
  maxAppointments: number;
}

function DoctorScheduleContent() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const todayStr = getCurrentJstDate();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [formData, setFormData] = useState<ScheduleFormData>({
    date: todayStr,
    startTime: '09:00',
    endTime: '17:00',
    maxAppointments: 10,
  });

  // 編集・削除機能用の状態
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = getWorkerAuthToken();
      if (!token) {
        navigate('/worker/login');
        return;
      }

      const response = await fetch(`/api/worker/doctor/schedule?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        navigate('/worker/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('スケジュールの取得に失敗しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, navigate]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getWorkerAuthToken();
      if (!token) {
        navigate('/worker/login');
        return;
      }

      const response = await fetch('/api/worker/doctor/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.status === 401) {
        navigate('/worker/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'スケジュールの登録に失敗しました');
      }

      setSuccess('スケジュールを登録しました');
      await fetchSchedules();

      // フォームをリセット
      setFormData({
        date: selectedDate,
        startTime: '09:00',
        endTime: '17:00',
        maxAppointments: 10,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スケジュールの登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setFormData(prev => ({ ...prev, date: newDate }));
  };

  const formatTimeForDisplay = (time: string) => {
    return time.substring(0, 5); // HH:MM形式に変換
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      available: { text: '診察可能', color: 'bg-green-100 text-green-800' },
      busy: { text: 'ビジー', color: 'bg-red-100 text-red-800' },
      break: { text: '休憩', color: 'bg-yellow-100 text-yellow-800' },
      off: { text: '休診', color: 'bg-gray-100 text-gray-800' },
    };

    const { text, color } = statusMap[status as keyof typeof statusMap] || {
      text: status,
      color: 'bg-gray-100 text-gray-800',
    };

    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{text}</span>;
  };

  // 編集開始
  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      maxAppointments: schedule.maxAppointments,
    });
  };

  // 編集キャンセル
  const handleCancelEdit = () => {
    setEditingSchedule(null);
    setFormData({
      date: selectedDate,
      startTime: '09:00',
      endTime: '17:00',
      maxAppointments: 10,
    });
  };

  // 編集保存
  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) {return;}

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getWorkerAuthToken();
      if (!token) {
        navigate('/worker/login');
        return;
      }

      const response = await fetch(`/api/worker/doctor/schedule/${editingSchedule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.status === 401) {
        navigate('/worker/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'スケジュールの更新に失敗しました');
      }

      setSuccess('スケジュールを更新しました');
      setEditingSchedule(null);
      setFormData({
        date: selectedDate,
        startTime: '09:00',
        endTime: '17:00',
        maxAppointments: 10,
      });

      // スケジュール一覧を再取得
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スケジュールの更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 削除確認
  const handleDeleteSchedule = (schedule: Schedule) => {
    setScheduleToDelete(schedule);
    setShowDeleteModal(true);
  };

  // 削除実行
  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) {return;}

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getWorkerAuthToken();
      if (!token) {
        navigate('/worker/login');
        return;
      }

      const response = await fetch(`/api/worker/doctor/schedule/${scheduleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        navigate('/worker/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'スケジュールの削除に失敗しました');
      }

      setSuccess('スケジュールを削除しました');
      setShowDeleteModal(false);
      setScheduleToDelete(null);

      // スケジュール一覧を再取得
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スケジュールの削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 削除キャンセル
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setScheduleToDelete(null);
  };

  if (isLoading && schedules.length === 0) {
    return <Loading fullScreen message="スケジュールを読み込み中..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            スケジュール登録
          </h1>
          <p className="mt-1 text-gray-600">
            診察可能な時間帯を登録・管理してください
          </p>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* スケジュール登録フォーム */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSchedule ? 'スケジュール編集' : '新規スケジュール登録'}
              </h2>
              {editingSchedule && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700"
                >
                  キャンセル
                </button>
              )}
            </div>

            <form onSubmit={editingSchedule ? handleUpdateSchedule : handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  日付
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
                    開始時刻
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
                    終了時刻
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="maxAppointments" className="block text-sm font-medium text-gray-700">
                  最大予約数
                </label>
                <input
                  type="number"
                  id="maxAppointments"
                  min="1"
                  max="50"
                  value={formData.maxAppointments}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxAppointments: parseInt(e.target.value) }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-md transition-colors"
              >
                {isLoading
                  ? (editingSchedule ? 'スケジュール更新中...' : 'スケジュール登録中...')
                  : (editingSchedule ? 'スケジュールを更新' : 'スケジュールを登録')
                }
              </button>
            </form>
          </div>

          {/* 既存スケジュール一覧 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                登録済みスケジュール
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <Loading message="読み込み中..." />
            ) : schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id || `${schedule.date}-${schedule.startTime}`}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {formatTimeForDisplay(schedule.startTime)} - {formatTimeForDisplay(schedule.endTime)}
                          </span>
                          {getStatusBadge(schedule.status)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          最大予約数: {schedule.maxAppointments}件
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSchedule(schedule)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-gray-500">選択した日付にスケジュールはありません</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 削除確認モーダル */}
      {showDeleteModal && scheduleToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">スケジュール削除確認</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  以下のスケジュールを削除してもよろしいですか？
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="text-sm">
                    <strong>日付:</strong> {scheduleToDelete.date}
                  </p>
                  <p className="text-sm">
                    <strong>時間:</strong> {formatTimeForDisplay(scheduleToDelete.startTime)} - {formatTimeForDisplay(scheduleToDelete.endTime)}
                  </p>
                  <p className="text-sm">
                    <strong>最大予約数:</strong> {scheduleToDelete.maxAppointments}件
                  </p>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  この操作は取り消せません。
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoctorSchedule() {
  return (
    <RequireDoctor>
      <DoctorScheduleContent />
    </RequireDoctor>
  );
}
