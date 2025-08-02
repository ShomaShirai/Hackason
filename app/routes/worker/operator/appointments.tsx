import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '~/contexts/AuthContext'
import { Loading } from '~/components/common/Loading'
import { ErrorMessage } from '~/components/common/ErrorMessage'
import { Modal } from '~/components/common/Modal'

export function meta() {
  return [
    { title: '予約管理 - オンライン診療システム' },
    { name: 'description', content: 'オペレータ向け予約管理画面' },
  ]
}

interface Patient {
  id: number
  name: string
  email: string
  phoneNumber: string | null
}

interface Doctor {
  id: number
  name: string
  role: string
}

interface Appointment {
  id: number
  patientId: number
  assignedWorkerId: number | null
  status: 'scheduled' | 'waiting' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  scheduledAt: string
  durationMinutes: number
  chiefComplaint: string | null
  appointmentType: 'initial' | 'follow_up'
  patient: Patient | null
  doctor: Doctor | null
  createdAt: string
  updatedAt: string
}

interface AppointmentListData {
  appointments: Appointment[]
  pagination: {
    currentPage: number
    totalCount: number
    hasNextPage: boolean
  }
}

export default function OperatorAppointments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('')
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // オペレータまたは管理者のみアクセス可能
  useEffect(() => {
    if (user && user.userType === 'worker' && user.role && !['operator', 'admin'].includes(user.role)) {
      navigate('/worker/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    fetchAppointments()
  }, [selectedDate, statusFilter])

  const fetchAppointments = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      navigate('/worker/login')
      return
    }

    try {
      setIsLoading(true)
      let url = `/api/worker/operator/appointments?date=${selectedDate}`
      if (statusFilter) {
        url += `&status=${statusFilter}`
      }

      const response = await fetch(url, {
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

      const data: AppointmentListData = await response.json()
      setAppointments(data.appointments)
    } catch (err) {
      setError('予約データの取得に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setShowEditModal(true)
  }

  const handleUpdateAppointment = async (updateData: Partial<Appointment>) => {
    if (!editingAppointment) {return}

    const token = localStorage.getItem('authToken')
    try {
      const response = await fetch(`/api/worker/appointments/${editingAppointment.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        throw new Error('予約の更新に失敗しました')
      }

      // 成功したら一覧を再取得
      await fetchAppointments()
      setShowEditModal(false)
      setEditingAppointment(null)
    } catch (err) {
      setError('予約の更新に失敗しました')
      console.error(err)
    }
  }

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!confirm('この予約をキャンセルしますか？')) {return}

    const token = localStorage.getItem('authToken')
    try {
      const response = await fetch(`/api/worker/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('予約のキャンセルに失敗しました')
      }

      // 成功したら一覧を再取得
      await fetchAppointments()
    } catch (err) {
      setError('予約のキャンセルに失敗しました')
      console.error(err)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { label: '予約済み', color: 'bg-blue-100 text-blue-800' },
      waiting: { label: '待機中', color: 'bg-yellow-100 text-yellow-800' },
      assigned: { label: '割当済み', color: 'bg-purple-100 text-purple-800' },
      in_progress: { label: '診察中', color: 'bg-green-100 text-green-800' },
      completed: { label: '完了', color: 'bg-gray-100 text-gray-800' },
      cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return <Loading fullScreen message="予約データを読み込み中..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
            <p className="mt-1 text-gray-600">予約の一覧表示、編集、キャンセルが可能です</p>
          </div>
          <div className="flex space-x-4">
            <Link
              to="/worker/operator/assignment-board"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              医師差配ボード
            </Link>
            <Link
              to="/worker/operator/dashboard"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← ダッシュボード
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
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全て</option>
                <option value="scheduled">予約済み</option>
                <option value="waiting">待機中</option>
                <option value="assigned">割当済み</option>
                <option value="in_progress">診察中</option>
                <option value="completed">完了</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchAppointments}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                更新
              </button>
            </div>
          </div>
        </div>

        {/* 予約一覧テーブル */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              予約一覧 ({appointments.length}件)
            </h2>
          </div>

          {appointments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">該当する予約がありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      予約日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      患者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      医師
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      主訴
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(appointment.scheduledAt)}
                        <div className="text-xs text-gray-500">
                          {appointment.durationMinutes}分
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.patient?.name || '未設定'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.patient?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.doctor?.name || '未割当'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {appointment.chiefComplaint || '記載なし'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(appointment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditAppointment(appointment)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                          disabled={appointment.status === 'completed'}
                        >
                          編集
                        </button>
                        {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                          <button
                            onClick={() => handleCancelAppointment(appointment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            キャンセル
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 編集モーダル */}
      {showEditModal && editingAppointment && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="予約編集"
        >
          <AppointmentEditForm
            appointment={editingAppointment}
            onSave={handleUpdateAppointment}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}

// 予約編集フォームコンポーネント
function AppointmentEditForm({
  appointment,
  onSave,
  onCancel,
}: {
  appointment: Appointment
  onSave: (data: Partial<Appointment>) => void
  onCancel: () => void
}) {
  const [status, setStatus] = useState(appointment.status)
  const [scheduledAt, setScheduledAt] = useState(
    new Date(appointment.scheduledAt).toISOString().slice(0, 16)
  )
  const [chiefComplaint, setChiefComplaint] = useState(appointment.chiefComplaint || '')
  const [durationMinutes, setDurationMinutes] = useState(appointment.durationMinutes)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      status,
      scheduledAt: new Date(scheduledAt).toISOString(),
      chiefComplaint,
      durationMinutes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ステータス
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="scheduled">予約済み</option>
          <option value="waiting">待機中</option>
          <option value="assigned">割当済み</option>
          <option value="in_progress">診察中</option>
          <option value="completed">完了</option>
          <option value="cancelled">キャンセル</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          予約日時
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          診察時間（分）
        </label>
        <input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
          min="15"
          max="120"
          step="15"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          主訴
        </label>
        <textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="患者の主な症状や相談内容"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          保存
        </button>
      </div>
    </form>
  )
}
