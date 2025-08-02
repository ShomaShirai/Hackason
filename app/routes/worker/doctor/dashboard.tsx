import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { Loading } from '~/components/common/Loading';
import { ErrorMessage } from '~/components/common/ErrorMessage';

export function meta() {
  return [
    { title: '医師ダッシュボード - オンライン診療システム' },
    { name: 'description', content: '医師向けダッシュボード' },
  ];
}

interface Appointment {
  id: number;
  scheduledAt: string;
  status: string;
  chiefComplaint: string;
  appointmentType: string;
  durationMinutes: number;
  patient: {
    id: number;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
}

interface Statistics {
  today: {
    totalAppointments: number;
    completedAppointments: number;
    upcomingAppointments: number;
    averageConsultationTime: number;
    totalConsultationTime: number;
  };
  thisWeek: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    averageConsultationTime: number;
  };
  thisMonth: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    averageConsultationTime: number;
    totalRevenue: number;
  };
  patientSatisfaction: {
    averageRating: number;
    totalReviews: number;
    distribution: Record<string, number>;
  };
  commonChiefComplaints: Array<{ complaint: string; count: number }>;
  appointmentTypes: {
    initial: number;
    follow_up: number;
    emergency: number;
  };
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/worker/login');
        return;
      }

      try {
        // 今日の予約を取得
        const today = new Date().toISOString().split('T')[0];
        const appointmentsResponse = await fetch(`/api/worker/doctor/appointments?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (appointmentsResponse.ok) {
          const data = await appointmentsResponse.json() as { appointments: Appointment[] };
          // 今日の予約のみフィルタリング
          const todayAppointments = data.appointments.filter(apt =>
            apt.scheduledAt.startsWith(today)
          );
          setAppointments(todayAppointments);
          // 次の予約を取得
          const now = new Date();
          const futureAppointments = todayAppointments.filter(apt =>
            new Date(apt.scheduledAt) > now
          );
          setNextAppointment(futureAppointments.length > 0 ? futureAppointments[0] : null);
        }

        // 統計情報を取得
        const statsResponse = await fetch('/api/worker/doctor/statistics', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statsResponse.ok) {
          const data = await statsResponse.json() as Statistics;
          setStatistics(data);
        }
      } catch (err) {
        setError('データの取得に失敗しました');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <Loading fullScreen message="データを読み込み中..." />;
  }

  const activeAppointments = appointments.filter(apt =>
    ['scheduled', 'waiting', 'assigned', 'completed'].includes(apt.status)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            医師ダッシュボード
          </h1>
          <p className="mt-1 text-gray-600">
            {user?.name || 'ドクター'}さん、お疲れ様です
          </p>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}

        {/* 次の予約カード */}
        {nextAppointment && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-blue-900">
                  次の診察予定
                </h2>
                <p className="mt-1 text-blue-700">
                  {formatTime(nextAppointment.scheduledAt)} - {nextAppointment.patient.name}様
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  主訴: {nextAppointment.chiefComplaint || '未記入'}
                </p>
              </div>
              <Link
                to={`/worker/doctor/consultation/${nextAppointment.id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                診察を開始
              </Link>
            </div>
          </div>
        )}

        {/* 統計サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">本日の予約 (サンプル)</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics?.today.totalAppointments || 8}件
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">完了した診察 (サンプル)</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics?.today.completedAppointments || 3}件
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">平均診察時間 (サンプル)</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics?.today.averageConsultationTime || 25}分
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">患者評価 (サンプル)</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statistics?.patientSatisfaction.averageRating || 4.8}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 本日の予約リスト */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">本日の診察予定</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {activeAppointments.length > 0 ? (
                  activeAppointments.map((appointment) => (
                    <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {formatTime(appointment.scheduledAt)}
                            </p>
                            <span className="ml-3">{getStatusBadge(appointment.status)}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-900 font-medium">
                            {appointment.patient.name}様
                          </p>
                          <p className="text-sm text-gray-600">
                            主訴: {appointment.chiefComplaint || '未記入'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {appointment.appointmentType === 'initial' ? '初診' :
                             appointment.appointmentType === 'follow_up' ? '再診' : '緊急'}
                            ・{appointment.durationMinutes}分
                          </p>
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          {appointment.status === 'waiting' || appointment.status === 'assigned' ? (
                            <Link
                              to={`/worker/doctor/consultation/${appointment.id}`}
                              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                            >
                              診察開始
                            </Link>
                          ) : appointment.status === 'completed' ? (
                            <Link
                              to={`/worker/doctor/medical-records/${appointment.id}/edit`}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                            >
                              カルテ入力
                            </Link>
                          ) : (
                            <Link
                              to={`/patient/${appointment.patient.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              患者情報
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-2 text-gray-500">本日の予約はすべて完了しました</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* サイドパネル */}
          <div className="space-y-6">
            {/* クイックアクション */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                クイックアクション
              </h3>
              <div className="space-y-3">
                <Link
                  to="/worker/doctor/schedule"
                  className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-3 px-4 rounded-md flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  スケジュール登録
                </Link>
                <Link
                  to="/worker/doctor/patients"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-md flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  患者一覧
                </Link>
              </div>
            </div>

            {/* よくある主訴 */}
            {statistics && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  よくある主訴 (サンプル)
                </h3>
                <div className="space-y-2">
                  {(statistics.commonChiefComplaints.length > 0 ? statistics.commonChiefComplaints : [
                    { complaint: '風邪の症状', count: 28 },
                    { complaint: '頭痛', count: 22 },
                    { complaint: '腹痛', count: 18 },
                    { complaint: '発熱', count: 15 },
                    { complaint: 'アレルギー症状', count: 12 },
                  ]).slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.complaint}</span>
                      <span className="text-sm font-medium text-gray-900">{item.count}件</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 今月の実績 */}
            {statistics && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  今月の実績 (サンプル)
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">診察件数</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {statistics.thisMonth.completedAppointments || 115}件
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">診察収入</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      ¥{(statistics.thisMonth.totalRevenue || 384000).toLocaleString()}
                    </p>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">初診</span>
                      <span className="font-medium">{statistics.appointmentTypes.initial || 45}件</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">再診</span>
                      <span className="font-medium">{statistics.appointmentTypes.follow_up || 68}件</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">緊急</span>
                      <span className="font-medium">{statistics.appointmentTypes.emergency || 15}件</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
