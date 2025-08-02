import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '~/contexts/AuthContext'
import { Loading } from '~/components/common/Loading'
import { ErrorMessage } from '~/components/common/ErrorMessage'

export function meta() {
  return [
    { title: 'オペレータダッシュボード - オンライン診療システム' },
    { name: 'description', content: 'オペレータ向け管理ダッシュボード' },
  ]
}

interface DoctorStatus {
  id: number
  name: string
  email: string
  role: string
  isActive: boolean
  status: 'available' | 'busy' | 'offline'
  currentPatientCount: number
}

interface WaitingPatient {
  id: number
  patient: {
    id: number
    name: string
    age: number
  }
  chiefComplaint: string
  appointmentType: string
  scheduledAt: string
  waitingTime: number
  priority: string
}

interface Alert {
  type: string
  severity: string
  message: string
  patientId?: number
  appointmentId?: number
}

interface DashboardData {
  statistics: {
    waitingPatients: number
    inProgressConsultations: number
    availableDoctors: number
    totalDoctors: number
  }
  doctors: DoctorStatus[]
  waitingPatients: WaitingPatient[]
  alerts: Alert[]
  hourlyStats: Array<{
    hour: number
    appointments: number
    avgWaitTime: number
  }>
}

interface RealtimeStatus {
  timestamp: string
  status: {
    waitingCount: number
    averageWaitTime: number
    longestWaitTime: number
    activeConsultations: number
    completedToday: number
  }
  recentEvents: Array<{
    id: number
    type: string
    patientName: string
    doctorId: number | null
    timestamp: string
    message: string
  }>
  criticalAlerts: Array<{
    type: string
    message: string
    severity: string
  }>
}

export default function OperatorDashboard() {
  useAuth() // 認証チェック
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // ダッシュボードデータの取得
  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        navigate('/worker/login')
        return
      }

      try {
        const response = await fetch('/api/worker/operator/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          if (response.status === 403) {
            setError('オペレータ権限が必要です')
            navigate('/worker/dashboard')
            return
          }
          throw new Error('データの取得に失敗しました')
        }

        const data = await response.json() as DashboardData
        setDashboardData(data)
      } catch (err) {
        setError('ダッシュボードデータの取得に失敗しました')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [navigate])

  // リアルタイムステータスの取得（定期的に更新）
  useEffect(() => {
    const fetchRealtimeStatus = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {return}

      try {
        const response = await fetch('/api/worker/operator/realtime-status', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json() as RealtimeStatus
          setRealtimeStatus(data)
        }
      } catch (err) {
        console.error('Failed to fetch realtime status:', err)
      }
    }

    fetchRealtimeStatus()
    const interval = setInterval(fetchRealtimeStatus, 30000) // 30秒ごとに更新

    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    const statusMap = {
      available: { text: '待機中', color: 'bg-green-100 text-green-800' },
      busy: { text: '診察中', color: 'bg-red-100 text-red-800' },
      offline: { text: 'オフライン', color: 'bg-gray-100 text-gray-800' },
    }

    const { text, color } = statusMap[status as keyof typeof statusMap] || {
      text: status,
      color: 'bg-gray-100 text-gray-800',
    }

    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{text}</span>
  }

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      high: { text: '高', color: 'bg-red-100 text-red-800' },
      medium: { text: '中', color: 'bg-yellow-100 text-yellow-800' },
      normal: { text: '通常', color: 'bg-blue-100 text-blue-800' },
    }

    const { text, color } = priorityMap[priority as keyof typeof priorityMap] || {
      text: priority,
      color: 'bg-gray-100 text-gray-800',
    }

    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{text}</span>
  }

  if (isLoading) {
    return <Loading fullScreen message="データを読み込み中..." />
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">データの取得に失敗しました</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              オペレータダッシュボード
            </h1>
            <p className="mt-1 text-gray-600">
              リアルタイム診療状況管理
            </p>
          </div>
          <Link
            to="/worker/operator/assignment-board"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            医師差配ボードへ
          </Link>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}

        {/* アラート表示 */}
        {dashboardData.alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {dashboardData.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  alert.severity === 'high'
                    ? 'bg-red-50 border-l-4 border-red-400'
                    : 'bg-yellow-50 border-l-4 border-yellow-400'
                }`}
              >
                <p className={`text-sm ${
                  alert.severity === 'high' ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  ⚠️ {alert.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">待機患者数</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.statistics.waitingPatients}名
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">診察中</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.statistics.inProgressConsultations}件
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">待機医師</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {dashboardData.statistics.availableDoctors}/{dashboardData.statistics.totalDoctors}名
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">本日完了</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {realtimeStatus?.status.completedToday || 0}件
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 医師稼働状況 */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">医師稼働状況</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {dashboardData.doctors.map((doctor) => (
                  <div key={doctor.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doctor.name}</p>
                        <p className="text-xs text-gray-500">{doctor.email}</p>
                      </div>
                      {getStatusBadge(doctor.status)}
                    </div>
                    {doctor.status === 'busy' && (
                      <p className="mt-1 text-xs text-gray-600">
                        診察中: {doctor.currentPatientCount}名
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 待機患者リスト */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">待機患者一覧</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {dashboardData.waitingPatients.length > 0 ? (
                  dashboardData.waitingPatients.map((patient) => (
                    <div key={patient.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {patient.patient.name}様（{patient.patient.age}歳）
                            </p>
                            <span className="ml-2">{getPriorityBadge(patient.priority)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            主訴: {patient.chiefComplaint}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {patient.appointmentType === 'initial' ? '初診' : '再診'} |
                            待機時間: {patient.waitingTime}分
                          </p>
                        </div>
                        <button
                          onClick={() => navigate(`/worker/operator/assignment-board?patient=${patient.id}`)}
                          className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          差配
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">待機中の患者はいません</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* リアルタイムイベント */}
        {realtimeStatus && (
          <div className="mt-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">最近のイベント</h2>
                <p className="text-xs text-gray-500 mt-1">
                  最終更新: {new Date(realtimeStatus.timestamp).toLocaleTimeString('ja-JP')}
                </p>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {realtimeStatus.recentEvents.map((event) => (
                  <div key={event.id} className="p-4">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        event.type === 'waiting' ? 'bg-yellow-400' :
                        event.type === 'in_progress' ? 'bg-purple-400' : 'bg-green-400'
                      }`} />
                      <p className="text-sm text-gray-900">{event.message}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.timestamp).toLocaleTimeString('ja-JP')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
