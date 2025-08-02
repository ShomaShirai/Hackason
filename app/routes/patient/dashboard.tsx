import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { Loading } from '~/components/common/Loading';
import { ErrorMessage } from '~/components/common/ErrorMessage';
import { Modal } from '~/components/common/Modal';
import { getAuthToken } from '../../utils/auth';

export function meta() {
  return [
    { title: '患者ホーム - オンライン診療システム' },
    { name: 'description', content: '患者向けホーム画面' },
  ];
}

interface Appointment {
  id: number;
  scheduledAt: string;
  status: string;
  chiefComplaint: string;
  appointmentType: string;
  durationMinutes: number;
  doctor: {
    id: number;
    name: string;
    role: string;
  } | null;
  questionnaireCompletedAt?: string | null;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  data: Record<string, any>;
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      if (!token) {
        navigate('/patient/login');
        return;
      }

      try {
        // 今日の予約を取得（JST）
        const now = new Date();
        const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const today = jstDate.toISOString().split('T')[0];
        const appointmentsResponse = await fetch(`/api/patient/appointments?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (appointmentsResponse.ok) {
          const data = await appointmentsResponse.json() as { appointments: Appointment[] };
          // 今日の予約のみフィルタリング
          const todayAppointments = data.appointments.filter(apt =>
            apt.scheduledAt.startsWith(today)
          );
          setAppointments(todayAppointments);
        }

        // 通知を取得
        const notificationsResponse = await fetch('/api/patient/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (notificationsResponse.ok) {
          const data = await notificationsResponse.json() as {
            notifications: Notification[];
            unreadCount: number;
            totalCount: number;
          };
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
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
      assigned: { text: '医師割当済み', color: 'bg-green-100 text-green-800' },
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
      timeZone: 'Asia/Tokyo',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'appointment_reminder' && notification.data.appointmentId) {
      navigate(`/patient/consultation/${notification.data.appointmentId}`);
    } else if (notification.type === 'questionnaire_request' && notification.data.questionnaireUrl) {
      navigate(notification.data.questionnaireUrl);
    }
    setShowNotifications(false);
  };

  if (isLoading) {
    return <Loading fullScreen message="データを読み込み中..." />;
  }

  // 現在進行中の診察を見つける
  const activeAppointment = appointments.find(apt => apt.status === 'in_progress');
  // 次の予約を見つける
  const upcomingAppointments = appointments.filter(apt =>
    apt.status === 'scheduled' || apt.status === 'waiting' || apt.status === 'assigned'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ウェルカムセクション */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            こんにちは、{user?.name || 'ゲスト'}さん
          </h1>
          <p className="mt-1 text-gray-600">
            {new Date().toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </p>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}

        {/* 現在進行中の診察 */}
        {activeAppointment && (
          <div className="mb-6 bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-purple-900">
                  現在診察中です
                </h2>
                <p className="mt-1 text-purple-700">
                  {activeAppointment.doctor?.name || '担当医'} 医師が待っています
                </p>
              </div>
              <Link
                to={`/patient/consultation/${activeAppointment.id}`}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg flex items-center transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                診察室に入る
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：アクションカードと通知 */}
          <div className="lg:col-span-1 space-y-6">
            {/* クイックアクション */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                クイックアクション
              </h2>
              <div className="space-y-3">
                <Link
                  to="/patient/appointments/new"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  新しい予約を作成
                </Link>
                <Link
                  to="/patient/appointments"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-md flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  予約一覧を見る
                </Link>
              </div>
            </div>

            {/* 通知センター */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  通知
                </h2>
                <button
                  onClick={() => setShowNotifications(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              </div>
              {notifications.slice(0, 3).map(notification => (
                <div
                  key={notification.id}
                  className={`mb-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    notification.isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="font-medium text-sm text-gray-900">{notification.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </div>
              ))}
              {notifications.length > 3 && (
                <button
                  onClick={() => setShowNotifications(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  すべての通知を見る ({notifications.length}件)
                </button>
              )}
              {notifications.length === 0 && (
                <p className="text-gray-500 text-sm">新しい通知はありません</p>
              )}
            </div>
          </div>

          {/* 右側：今日の予約 */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                本日の予約
              </h2>
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="font-medium text-gray-900">
                              {formatTime(appointment.scheduledAt)}
                            </p>
                            <span className="ml-3">{getStatusBadge(appointment.status)}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            主訴: {appointment.chiefComplaint || '未記入'}
                          </p>
                          {appointment.doctor && (
                            <p className="mt-1 text-sm text-gray-600">
                              担当医: {appointment.doctor.name}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-400">
                            診察時間: {appointment.durationMinutes}分
                          </p>
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          {appointment.status === 'scheduled' && (
                            <Link
                              to={`/patient/appointments/${appointment.id}/questionnaire`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {appointment.questionnaireCompletedAt ? '事前問診を編集' : '事前問診へ'}
                            </Link>
                          )}
                          <Link
                            to={`/patient/consultation/${appointment.id}`}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                          >
                            診察室へ
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2 text-gray-500">本日の予約はありません</p>
                  <Link
                    to="/patient/appointments/new"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    予約を作成する
                  </Link>
                </div>
              )}
            </div>

            {/* 健康情報サマリー */}
            <div className="mt-6 bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                健康情報
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Link
                  to="/patient/prescriptions"
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">処方箋</p>
                      <p className="text-sm text-gray-500">お薬の履歴</p>
                    </div>
                  </div>
                </Link>
              </div>
              <div className="mt-4">
                <Link
                  to="/patient/messages"
                  className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">メッセージ</p>
                      <p className="text-sm text-gray-500">医師とのチャット</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 通知モーダル */}
      <Modal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        title="すべての通知"
      >
        <div className="max-h-96 overflow-y-auto">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`mb-3 p-3 rounded-lg cursor-pointer transition-colors ${
                notification.isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-blue-50 hover:bg-blue-100'
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <p className="font-medium text-sm text-gray-900">{notification.title}</p>
              <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
              <p className="text-xs text-gray-400 mt-1">
                {formatDateTime(notification.createdAt)}
              </p>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-gray-500 text-center py-8">通知はありません</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
