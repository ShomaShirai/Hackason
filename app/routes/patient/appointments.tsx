import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { Loading } from '~/components/common/Loading';
import { ErrorMessage } from '~/components/common/ErrorMessage';
import { get } from '~/utils/api-client';
import { formatDateTime } from '~/utils/date';
import type { PatientAppointmentsResponse } from '~/types/api';

export function meta() {
  return [
    { title: '予約一覧 - オンライン診療システム' },
    { name: 'description', content: '患者の予約一覧' },
  ];
}

const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'scheduled', label: '予約済み' },
  { value: 'waiting', label: '待機中' },
  { value: 'assigned', label: '医師割当済み' },
  { value: 'in_progress', label: '診察中' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
];

export default function PatientAppointments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [appointmentsData, setAppointmentsData] = useState<PatientAppointmentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const currentPage = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';

  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      setError('');

      try {
        const params: Record<string, any> = {
          page: currentPage,
          limit: 20,
        };
        if (statusFilter) {
          params.status = statusFilter;
        }

        const data = await get<PatientAppointmentsResponse>('/api/patient/appointments', params);
        setAppointmentsData(data);
      } catch (err: any) {
        // 認証エラーの場合はログイン画面にリダイレクト
        if (err.statusCode === 401 || err.statusCode === 403) {
          navigate('/patient/login');
          return;
        }
        setError('予約情報の取得に失敗しました');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, [currentPage, statusFilter, navigate]);

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    params.set('page', '1'); // フィルタ変更時はページをリセット
    setSearchParams(params);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  };

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


  const formatDuration = (startedAt: string | null, endedAt: string | null) => {
    if (!startedAt || !endedAt) {
      return null;
    }
    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes}分`;
  };

  if (isLoading) {
    return <Loading fullScreen message="予約情報を読み込み中..." />;
  }

  const appointments = appointmentsData?.appointments || [];
  const pagination = appointmentsData?.pagination || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">予約一覧</h1>
              <p className="mt-1 text-gray-600">
                {user?.name}さんの予約履歴
              </p>
            </div>
            <Link
              to="/patient/appointments/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              新しい予約を作成
            </Link>
          </div>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}

        {/* フィルター */}
        <div className="mb-6 bg-white shadow rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">
              ステータスで絞り込み:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {pagination && (
              <span className="text-sm text-gray-500">
                全{pagination.totalCount}件中 {appointments.length}件を表示
              </span>
            )}
          </div>
        </div>

        {/* 予約リスト */}
        {appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-lg font-medium text-gray-900">
                        {formatDateTime(appointment.scheduledAt)}
                      </span>
                      <span className="ml-3">{getStatusBadge(appointment.status)}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">主訴:</span> {appointment.chiefComplaint || '未記入'}
                      </div>
                      <div>
                        <span className="font-medium">診察種別:</span> {
                          appointment.appointmentType === 'initial' ? '初診' :
                          appointment.appointmentType === 'follow_up' ? '再診' : '緊急'
                        }
                      </div>
                      {appointment.doctor && (
                        <div>
                          <span className="font-medium">担当医:</span> {appointment.doctor.name}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">予定時間:</span> {appointment.durationMinutes}分
                      </div>
                      {appointment.status === 'completed' && appointment.startedAt && appointment.endedAt && (
                        <div>
                          <span className="font-medium">実際の診察時間:</span> {formatDuration(appointment.startedAt.toString(), appointment.endedAt.toString())}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col space-y-2">
                    {(appointment.status === 'scheduled' || appointment.status === 'completed') && (
                      <Link
                        to={`/patient/appointments/${appointment.id}/questionnaire`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {appointment.questionnaireCompletedAt ? '事前問診を編集' : '事前問診へ'}
                      </Link>
                    )}
                    <Link
                      to={`/patient/consultation/${appointment.id}`}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors text-center"
                    >
                      診察室へ
                    </Link>
                    {appointment.status === 'completed' && (
                      <Link
                        to={`/patient/prescriptions/${appointment.id}`}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        処方箋を見る
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-12 text-center">
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {statusFilter ? 'このステータスの予約はありません' : '予約がありません'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              新しい予約を作成して、診察を受けましょう。
            </p>
            <Link
              to="/patient/appointments/new"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              予約を作成する
            </Link>
          </div>
        )}

        {/* ページネーション */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                  pagination.hasPreviousPage
                    ? 'text-gray-500 hover:bg-gray-50'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
              >
                <span className="sr-only">前へ</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* ページ番号 */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, Math.min(currentPage - 2 + i, pagination.totalPages - 4)) + i;
                if (pageNumber > pagination.totalPages) {
                  return null;
                }

                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pageNumber === currentPage
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              }).filter(Boolean)}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                  pagination.hasNextPage
                    ? 'text-gray-500 hover:bg-gray-50'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
              >
                <span className="sr-only">次へ</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>
        )}
      </main>
    </div>
  );
}
