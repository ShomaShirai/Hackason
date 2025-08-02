import type { Route } from "./+types/$id.schedule.edit"
import { useLoaderData, useNavigate, useSubmit } from "react-router"
import React, { useState, useCallback } from "react"
import { Loading } from "~/components/common/Loading"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { RequireAuth } from "~/components/auth/RequireAuth"

interface Doctor {
  id: number
  name: string
  email: string
}

interface Schedule {
  date: string
  startTime: string
  endTime: string
  status: 'available' | 'busy' | 'break' | 'off'
  maxAppointments: number
}

export async function loader({ params }: Route.LoaderArgs) {
  const doctorId = params.id
  const token = localStorage.getItem('authToken')

  if (!token) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // 医師情報を取得
  const doctorsResponse = await fetch('/api/worker/admin/doctors', {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!doctorsResponse.ok) {
    throw new Response('Failed to load doctor', { status: doctorsResponse.status })
  }

  const doctorsData = await doctorsResponse.json() as { doctors: Doctor[] }
  const doctor = doctorsData.doctors.find((d: Doctor) => d.id === parseInt(doctorId))

  if (!doctor) {
    throw new Response('Doctor not found', { status: 404 })
  }

  // 現在の月のスケジュールを取得
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const scheduleResponse = await fetch(
    `/api/worker/admin/doctors/${doctorId}/schedule?date=${currentMonth}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  )

  const scheduleData = scheduleResponse.ok
    ? await scheduleResponse.json() as { schedules: Schedule[] }
    : { schedules: [] }

  return { doctor, currentSchedules: scheduleData.schedules, currentMonth }
}

export async function action({ request, params }: Route.ActionArgs) {
  const doctorId = params.id
  const token = localStorage.getItem('authToken')

  if (!token) {
    return { error: 'Unauthorized' }
  }

  const formData = await request.formData()
  const schedulesJson = formData.get('schedules')

  if (!schedulesJson) {
    return { error: 'スケジュールデータが必要です' }
  }

  const schedules = JSON.parse(schedulesJson as string)

  const response = await fetch(
    `/api/worker/admin/doctors/${doctorId}/schedule`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ schedules })
    }
  )

  if (!response.ok) {
    const data = await response.json() as { error?: string }
    return { error: data.error || 'スケジュールの更新に失敗しました' }
  }

  return { success: true }
}

export default function DoctorScheduleEdit() {
  const { doctor, currentSchedules, currentMonth } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const submit = useSubmit()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // 月が変更されたときに新しいスケジュールテンプレートを生成
  React.useEffect(() => {
    generateMonthSchedules(month)
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const generateMonthSchedules = useCallback((monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const newSchedules: Schedule[] = []

    // 既存のスケジュールをマップに変換
    const existingSchedulesMap = new Map(
      currentSchedules.map((s: any) => [
        new Date(s.scheduleDate).toISOString().split('T')[0],
        {
          startTime: s.startTime.substring(0, 5),
          endTime: s.endTime.substring(0, 5),
          status: s.status,
          maxAppointments: s.maxAppointments
        }
      ])
    )

    // 月の各日についてスケジュールを生成
    for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      const existing = existingSchedulesMap.get(dateStr)

      if (existing) {
        newSchedules.push({
          date: dateStr,
          ...existing
        })
      } else {
        // デフォルトスケジュール（平日は診療可能、週末は休み）
        const dayOfWeek = date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        newSchedules.push({
          date: dateStr,
          startTime: isWeekend ? '00:00' : '09:00',
          endTime: isWeekend ? '00:00' : '17:00',
          status: isWeekend ? 'off' : 'available',
          maxAppointments: isWeekend ? 0 : 10
        })
      }
    }

    setSchedules(newSchedules)
  }, [currentSchedules])

  const updateSchedule = (index: number, field: keyof Schedule, value: any) => {
    const updated = [...schedules]
    updated[index] = { ...updated[index], [field]: value }
    setSchedules(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    // 'off'以外のスケジュールのみ送信
    const activeSchedules = schedules
      .filter(s => s.status !== 'off')
      .map(s => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        maxAppointments: s.maxAppointments
      }))

    const formData = new FormData()
    formData.append('schedules', JSON.stringify(activeSchedules))

    submit(formData, { method: 'post' })

    // 成功したら一覧画面に戻る
    setTimeout(() => {
      navigate('/worker/admin/doctors')
    }, 1000)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    return `${date.getDate()}日（${weekDays[date.getDay()]}）`
  }

  const applyTemplate = (template: 'weekdays' | 'all' | 'none') => {
    const updated = schedules.map(schedule => {
      const date = new Date(schedule.date)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      switch (template) {
        case 'weekdays':
          if (isWeekend) {
            return { ...schedule, status: 'off' as const, startTime: '00:00', endTime: '00:00', maxAppointments: 0 }
          } else {
            return { ...schedule, status: 'available' as const, startTime: '09:00', endTime: '17:00', maxAppointments: 10 }
          }
        case 'all':
          return { ...schedule, status: 'available' as const, startTime: '09:00', endTime: '17:00', maxAppointments: 10 }
        case 'none':
          return { ...schedule, status: 'off' as const, startTime: '00:00', endTime: '00:00', maxAppointments: 0 }
        default:
          return schedule
      }
    })
    setSchedules(updated)
  }

  return (
    <RequireAuth userType="worker">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {doctor.name} 医師のスケジュール編集
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              診療可能な日時を設定してください
            </p>
          </div>

          {error && (
            <ErrorMessage
              message={error}
              type="error"
              onClose={() => setError('')}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 月選択とテンプレート */}
            <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                    対象月
                  </label>
                  <input
                    type="month"
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="mt-1 block rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate('weekdays')}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    平日のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('all')}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    全日
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('none')}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    休診
                  </button>
                </div>
              </div>
            </div>

            {/* スケジュール一覧 */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日付
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      開始時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      終了時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最大予約数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.map((schedule, index) => (
                    <tr key={schedule.date} className={schedule.status === 'off' ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(schedule.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select
                          value={schedule.status}
                          onChange={(e) => updateSchedule(index, 'status', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="available">診療可能</option>
                          <option value="busy">予約済み</option>
                          <option value="break">休憩</option>
                          <option value="off">休診</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => updateSchedule(index, 'startTime', e.target.value)}
                          disabled={schedule.status === 'off'}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => updateSchedule(index, 'endTime', e.target.value)}
                          disabled={schedule.status === 'off'}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={schedule.maxAppointments}
                          onChange={(e) => updateSchedule(index, 'maxAppointments', parseInt(e.target.value))}
                          disabled={schedule.status === 'off'}
                          className="block w-24 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 送信ボタン */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/worker/admin/doctors')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loading size="small" />
                    <span className="ml-2">保存中...</span>
                  </span>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RequireAuth>
  )
}
