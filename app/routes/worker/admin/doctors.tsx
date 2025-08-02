import { useLoaderData, Link } from "react-router"
import { useState, useEffect } from "react"
import { Loading } from "~/components/common/Loading"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { RequireAuth } from "~/components/auth/RequireAuth"
import type { Worker } from "~/types/api"

interface Schedule {
  id: number
  scheduleDate: string
  startTime: string
  endTime: string
  status: string
  maxAppointments: number
}

interface LoaderData {
  doctors: Worker[]
}

export async function loader() {
  const token = localStorage.getItem('authToken')
  if (!token) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const response = await fetch('/api/worker/admin/doctors', {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!response.ok) {
    throw new Response('Failed to load doctors', { status: response.status })
  }

  const data = await response.json() as { doctors: Worker[] }
  return { doctors: data.doctors } satisfies LoaderData
}

export default function AdminDoctors() {
  const { doctors } = useLoaderData<typeof loader>() as LoaderData
  const [selectedDoctor, setSelectedDoctor] = useState<Worker | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedDoctor) {
      loadSchedule(selectedDoctor.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, scheduleMonth])

  const loadSchedule = async (doctorId: number) => {
    setIsLoadingSchedule(true)
    setError('')
    const token = localStorage.getItem('authToken')

    try {
      const response = await fetch(
        `/api/worker/admin/doctors/${doctorId}/schedule?date=${scheduleMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.ok) {
        const data = await response.json() as { schedules: Schedule[] }
        setSchedules(data.schedules || [])
      } else {
        setError('スケジュールの取得に失敗しました')
      }
    } catch {
      setError('スケジュールの取得中にエラーが発生しました')
    } finally {
      setIsLoadingSchedule(false)
    }
  }

  const toggleDoctorStatus = async (doctor: Worker) => {
    const token = localStorage.getItem('authToken')

    try {
      const response = await fetch(
        `/api/worker/admin/doctors/${doctor.id}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ isActive: !doctor.isActive })
        }
      )

      if (response.ok) {
        // ページをリロードして最新のデータを取得
        window.location.reload()
      } else {
        setError('ステータスの更新に失敗しました')
      }
    } catch {
      setError('ステータスの更新中にエラーが発生しました')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (time: string) => {
    return time.substring(0, 5) // HH:MM形式
  }

  return (
    <RequireAuth userType="worker">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">医師管理</h1>
            <p className="mt-1 text-sm text-gray-600">
              医師の情報とスケジュールを管理します
            </p>
          </div>

          {error && (
            <ErrorMessage
              message={error}
              type="error"
              onClose={() => setError('')}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 医師一覧 */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b">
                  <h2 className="text-lg font-medium text-gray-900">医師一覧</h2>
                </div>
                <ul className="divide-y divide-gray-200">
                  {doctors.map((doctor) => (
                    <li
                      key={doctor.id}
                      className={`px-4 py-4 hover:bg-gray-50 cursor-pointer ${
                        selectedDoctor?.id === doctor.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedDoctor(doctor)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {doctor.name}
                          </p>
                          <p className="text-sm text-gray-500">{doctor.email}</p>
                          {doctor.medicalLicenseNumber && (
                            <p className="text-xs text-gray-400">
                              医師免許: {doctor.medicalLicenseNumber}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            doctor.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {doctor.isActive ? '有効' : '無効'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 医師詳細・スケジュール */}
            <div className="lg:col-span-2">
              {selectedDoctor ? (
                <div className="space-y-6">
                  {/* 医師詳細 */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:px-6 border-b">
                      <h2 className="text-lg font-medium text-gray-900">
                        医師詳細
                      </h2>
                    </div>
                    <div className="px-4 py-5 sm:px-6">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            氏名
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {selectedDoctor.name}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            メールアドレス
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {selectedDoctor.email}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            電話番号
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {selectedDoctor.phoneNumber || '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            医師免許番号
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {selectedDoctor.medicalLicenseNumber || '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            登録日
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            -
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">
                            ステータス
                          </dt>
                          <dd className="mt-1">
                            <button
                              onClick={() => toggleDoctorStatus(selectedDoctor)}
                              className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                                selectedDoctor.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {selectedDoctor.isActive ? '有効' : '無効'}
                            </button>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* スケジュール */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:px-6 border-b">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">
                          スケジュール
                        </h2>
                        <div className="flex items-center space-x-4">
                          <input
                            type="month"
                            value={scheduleMonth}
                            onChange={(e) => setScheduleMonth(e.target.value)}
                            className="block rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                          <Link
                            to={`/worker/admin/doctors/${selectedDoctor.id}/schedule/edit`}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                          >
                            編集
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-5 sm:px-6">
                      {isLoadingSchedule ? (
                        <div className="text-center py-8">
                          <Loading size="medium" />
                        </div>
                      ) : schedules.length > 0 ? (
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                          <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  日付
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  時間
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  ステータス
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  最大予約数
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {schedules.map((schedule) => (
                                <tr key={schedule.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(schedule.scheduleDate)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                      schedule.status === 'available'
                                        ? 'bg-green-100 text-green-800'
                                        : schedule.status === 'busy'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {schedule.status === 'available' ? '利用可能' :
                                       schedule.status === 'busy' ? '予約済み' :
                                       schedule.status === 'break' ? '休憩' : 'オフ'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {schedule.maxAppointments}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">
                          この月のスケジュールは登録されていません
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-12 text-center">
                    <p className="text-gray-500">
                      医師を選択してください
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  )
}
