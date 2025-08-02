import React, { useState, useEffect } from 'react';
import { getAuthToken, AUTH_TOKEN_KEYS } from '../../utils/auth';

export function meta() {
  return [
    { title: '医療従事者ダッシュボード - オンライン診療システム' },
    { name: 'description', content: '医療従事者向けダッシュボード' },
  ];
}

interface Worker {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  scheduledAt: string;
  status: string;
  chiefComplaint: string;
  appointmentType: string;
  patientName?: string;
}

export default function WorkerDashboard() {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitingPatients, setWaitingPatients] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      const userType = localStorage.getItem(AUTH_TOKEN_KEYS.USER_TYPE);

      if (!token || userType !== 'worker') {
        window.location.href = '/login';
        return;
      }

      try {
        // 医療従事者プロフィール取得
        const profileResponse = await fetch('/api/worker/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (profileResponse.ok) {
          const profileData = (await profileResponse.json()) as Worker;
          setWorker(profileData);
        }

        // 今日の予約一覧取得
        const appointmentsResponse = await fetch('/api/worker/appointments/today', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (appointmentsResponse.ok) {
          const appointmentsData = (await appointmentsResponse.json()) as Appointment[];
          setAppointments(appointmentsData);
        }

        // 待機中患者一覧取得
        const waitingResponse = await fetch('/api/worker/appointments/waiting', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (waitingResponse.ok) {
          const waitingData = (await waitingResponse.json()) as Appointment[];
          setWaitingPatients(waitingData);
        }
      } catch (err) {
        setError('データの取得に失敗しました');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userType');
    window.location.href = '/login';
  };

  const handleStartConsultation = async (appointmentId: number) => {
    const token = getAuthToken();

    try {
      const response = await fetch(`/api/worker/appointments/${appointmentId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        // 状態を更新して診察開始
        window.alert('診察を開始します。ビデオ通話画面に移動します。');
        // ここでビデオ通話システムに移動
      }
    } catch {
      setError('診察開始に失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      scheduled: { text: '予約済み', color: 'bg-blue-100 text-blue-800' },
      waiting: { text: '待機中', color: 'bg-yellow-100 text-yellow-800' },
      assigned: { text: '割当済み', color: 'bg-green-100 text-green-800' },
      in_progress: { text: '診察中', color: 'bg-purple-100 text-purple-800' },
      completed: { text: '完了', color: 'bg-gray-100 text-gray-800' },
      cancelled: { text: 'キャンセル', color: 'bg-red-100 text-red-800' },
    };

    const { text, color } = statusMap[status as keyof typeof statusMap] || {
      text: status,
      color: 'bg-gray-100 text-gray-800',
    };

    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{text}</span>;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">医療従事者ダッシュボード</h1>
                <p className="text-sm text-gray-500">
                  {worker ? `${worker.name}先生（${worker.role}）` : 'オンライン診療システム'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{waitingPatients.length}</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">待機中患者</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {waitingPatients.length}名
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{appointments.length}</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">今日の予約</dt>
                    <dd className="text-lg font-medium text-gray-900">{appointments.length}件</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {appointments.filter((apt) => apt.status === 'completed').length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">完了診察</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {appointments.filter((apt) => apt.status === 'completed').length}件
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {appointments.filter((apt) => apt.status === 'in_progress').length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">診察中</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {appointments.filter((apt) => apt.status === 'in_progress').length}件
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 待機中患者一覧 */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                🚨 待機中患者一覧
                {waitingPatients.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {waitingPatients.length}名
                  </span>
                )}
              </h3>
              {waitingPatients.length > 0 ? (
                <div className="space-y-4">
                  {waitingPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="border border-yellow-200 bg-yellow-50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            患者ID: {patient.patientId}{' '}
                            {patient.patientName && `(${patient.patientName})`}
                          </p>
                          <p className="text-sm text-gray-600">
                            予約時間: {formatDateTime(patient.scheduledAt)}
                          </p>
                          <p className="text-sm text-gray-600">主訴: {patient.chiefComplaint}</p>
                        </div>
                        {getStatusBadge(patient.status)}
                      </div>
                      <button
                        onClick={() => handleStartConsultation(patient.id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        🩺 診察開始
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">待機中の患者はいません</p>
                </div>
              )}
            </div>
          </div>

          {/* 今日のスケジュール */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                📅 今日のスケジュール
              </h3>
              {appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments
                    .sort(
                      (a, b) =>
                        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
                    )
                    .map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatTime(appointment.scheduledAt)} - 患者ID: {appointment.patientId}
                          </p>
                          <p className="text-sm text-gray-600">{appointment.chiefComplaint}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(appointment.status)}
                          {appointment.status === 'in_progress' && (
                            <button className="mt-1 block text-purple-600 hover:text-purple-800 text-sm font-medium">
                              診察画面へ
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">今日の予約はありません</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="mt-6 bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              ⚡ クイックアクション
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                📊 診察統計を確認
              </button>
              <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                📋 患者一覧を表示
              </button>
              <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                ⚙️ 設定変更
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
