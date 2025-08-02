import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { useAuth } from '~/contexts/AuthContext'
import { Loading } from '~/components/common/Loading'
import { ErrorMessage } from '~/components/common/ErrorMessage'
import { DraggablePatientCard } from '~/components/operator/DraggablePatientCard'
import { TimeSlot } from '~/components/operator/TimeSlot'

export function meta() {
  return [
    { title: '医師差配ボード - オンライン診療システム' },
    { name: 'description', content: '医師への患者割り当て管理' },
  ]
}

interface Doctor {
  id: number
  name: string
  specialties: string[]
  isActive: boolean
}

interface WaitingPatient {
  appointmentId: number
  patient: {
    id: number
    name: string
    age: number
  }
  chiefComplaint: string
  appointmentType: string
  priority: string
  requestedAt: string
}

interface Assignment {
  appointmentId: number
  patientName: string
  chiefComplaint: string
  status: string
  duration: number
}

interface AssignmentBoardData {
  date: string
  doctors: Doctor[]
  waitingPatients: WaitingPatient[]
  assignments: Record<number, Record<string, Assignment>>
  timeSlots: string[]
}

export default function AssignmentBoard() {
  useAuth() // 認証チェック
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [boardData, setBoardData] = useState<AssignmentBoardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedPatient, setDraggedPatient] = useState<WaitingPatient | null>(null)

  // URLパラメータから患者IDを取得
  const highlightPatientId = searchParams.get('patient')

  useEffect(() => {
    const fetchBoardData = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        navigate('/worker/login')
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch(`/api/worker/operator/assignment-board?date=${selectedDate}`, {
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

        const data = await response.json() as AssignmentBoardData
        setBoardData(data)
      } catch (err) {
        setError('差配ボードデータの取得に失敗しました')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBoardData()
  }, [navigate, selectedDate])

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate.toISOString().split('T')[0])
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    if (active.data.current) {
      setDraggedPatient(active.data.current as WaitingPatient)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDraggedPatient(null)

    if (!over || !active.data.current) {return}

    const patient = active.data.current as WaitingPatient
    const dropData = over.data.current as { doctorId: number; time: string }

    if (!dropData?.doctorId || !dropData?.time) {return}

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/worker/operator/assign-doctor', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId: patient.appointmentId,
          doctorId: dropData.doctorId,
          timeSlot: dropData.time,
          date: selectedDate,
        }),
      })

      if (!response.ok) {
        throw new Error('割り当てに失敗しました')
      }

      // 成功したら画面を更新
      const newBoardData = { ...boardData! }

      // 待機リストから削除
      newBoardData.waitingPatients = newBoardData.waitingPatients.filter(
        p => p.appointmentId !== patient.appointmentId
      )

      // 割り当てに追加
      if (!newBoardData.assignments[dropData.doctorId]) {
        newBoardData.assignments[dropData.doctorId] = {}
      }

      newBoardData.assignments[dropData.doctorId][dropData.time] = {
        appointmentId: patient.appointmentId,
        patientName: patient.patient.name,
        chiefComplaint: patient.chiefComplaint,
        status: 'assigned',
        duration: 30,
      }

      setBoardData(newBoardData)
    } catch (err) {
      setError('患者の割り当てに失敗しました')
      console.error(err)
    }
  }

  if (isLoading) {
    return <Loading fullScreen message="データを読み込み中..." />
  }

  if (!boardData) {
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
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-full mx-auto px-4 py-8">
          {/* ヘッダー */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">医師差配ボード</h1>
              <p className="mt-1 text-gray-600">患者を医師の時間枠にドラッグ&ドロップして割り当て</p>
            </div>
            <Link
              to="/worker/operator/dashboard"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>

          {error && (
            <ErrorMessage
              message={error}
              type="error"
              onClose={() => setError('')}
            />
          )}

          {/* 日付ナビゲーション */}
          <div className="mb-6 flex items-center justify-center space-x-4">
            <button
              onClick={() => handleDateChange(-1)}
              className="p-2 rounded-md hover:bg-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold">
              {new Date(selectedDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </h2>
            <button
              onClick={() => handleDateChange(1)}
              className="p-2 rounded-md hover:bg-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* 待機患者リスト */}
            <div className="col-span-2 bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-4">待機患者</h3>
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {boardData.waitingPatients.length > 0 ? (
                  boardData.waitingPatients.map((patient) => (
                    <div
                      key={patient.appointmentId}
                      className={`${
                        highlightPatientId === patient.appointmentId.toString()
                          ? 'ring-2 ring-blue-500 rounded-lg'
                          : ''
                      }`}
                    >
                      <DraggablePatientCard
                        patient={{
                          ...patient,
                          waitingTime: Math.floor(
                            (new Date().getTime() - new Date(patient.requestedAt).getTime()) / 1000 / 60
                          ),
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    待機中の患者はいません
                  </p>
                )}
              </div>
            </div>

            {/* 医師タイムテーブル */}
            <div className="col-span-10 bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 bg-white p-3 text-left text-sm font-semibold text-gray-900">
                      時間
                    </th>
                    {boardData.doctors.map((doctor) => (
                      <th key={doctor.id} className="p-3 text-center min-w-[150px]">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{doctor.name}</p>
                          <p className="text-xs text-gray-600">
                            {doctor.specialties.join(', ')}
                          </p>
                          <span
                            className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                              doctor.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {doctor.isActive ? 'オンライン' : 'オフライン'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {boardData.timeSlots.map((time) => (
                    <tr key={time} className="border-b">
                      <td className="sticky left-0 bg-gray-50 p-3 text-sm font-medium text-gray-700">
                        {time}
                      </td>
                      {boardData.doctors.map((doctor) => (
                        <td key={`${doctor.id}-${time}`} className="p-2">
                          <TimeSlot
                            doctorId={doctor.id}
                            time={time}
                            assignment={boardData.assignments[doctor.id]?.[time]}
                            isOver={activeId === `slot-${doctor.id}-${time}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <DragOverlay>
        {draggedPatient && (
          <DraggablePatientCard
            patient={draggedPatient}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
