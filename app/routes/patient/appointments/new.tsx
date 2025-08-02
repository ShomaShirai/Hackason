import type { Route } from "./+types/new"
import { useLoaderData, useNavigation } from "react-router"
import React, { useState, useEffect } from "react"
import { Loading } from "~/components/common/Loading"
import { RequireAuth } from "~/components/auth/RequireAuth"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { getAuthToken } from "../../../utils/auth"

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface DoctorSlot {
  doctorId: number
  doctorName: string
  specialty: string
  timeSlots: TimeSlot[]
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  // JSTで現在日付を取得
  const getCurrentJstDate = () => {
    const now = new Date()
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    return jstDate.toISOString().split("T")[0]
  }
  
  const date = url.searchParams.get("date") || getCurrentJstDate()
  const specialty = url.searchParams.get("specialty") || ""

  // サーバーサイドでは初期データのみ返し、クライアントサイドでAPIを呼び出す
  return { slots: [], date, specialty, needsClientSideLoad: true }
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 })
  }

  const formData = await request.formData()
  const doctorId = parseInt(formData.get("doctorId") as string)
  const appointmentDate = formData.get("appointmentDate") as string
  const startTime = formData.get("startTime") as string
  const endTime = formData.get("endTime") as string
  const appointmentType = formData.get("appointmentType") as string
  const chiefComplaint = formData.get("chiefComplaint") as string

  try {
    // サーバーサイドでは、リクエストから認証情報を転送
    const authHeader = request.headers.get("Authorization")
    const cookie = request.headers.get("Cookie")

    const response = await fetch("http://localhost:8787/api/patient/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader || "",
        Cookie: cookie || "",
      },
      body: JSON.stringify({
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        appointmentType,
        chiefComplaint,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json() as any
      return Response.json(
        { error: errorData.error || "予約の作成に失敗しました" },
        { status: response.status }
      )
    }

    await response.json() // レスポンスを消費
    return Response.redirect("/patient/appointments?created=true")
  } catch (err: any) {
    console.error("Error creating appointment:", err)
    return Response.json(
      { error: "予約の作成中にエラーが発生しました" },
      { status: 500 }
    )
  }
}

export default function NewAppointment() {
  const { date, specialty, needsClientSideLoad } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [selectedDate, setSelectedDate] = useState(date)
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialty)
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [appointmentType, setAppointmentType] = useState<"initial" | "followup">("initial")

  // クライアントサイドでのスロット取得
  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  const isSubmitting = navigation.state === "submitting"

  // 診療科リスト（実際はAPIから取得）
  const specialties = [
    { value: "", label: "すべて" },
    { value: "内科", label: "内科" },
    { value: "小児科", label: "小児科" },
    { value: "皮膚科", label: "皮膚科" },
    { value: "耳鼻咽喉科", label: "耳鼻咽喉科" },
  ]

  // クライアントサイドでのスロット取得関数
  const fetchAvailableSlots = async (searchDate: string, searchSpecialty: string) => {
    setIsLoadingSlots(true)
    setSlotsError(null)

    try {
      const token = getAuthToken('/patient')
      if (!token) {
        throw new Error('認証トークンが見つかりません')
      }

      const response = await fetch(
        `/api/patient/appointments/available-slots?date=${searchDate}&specialty=${searchSpecialty}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("スロット情報の取得に失敗しました")
      }

             const data = await response.json() as any
       setSlots(data.slots || [])
         } catch (err: any) {
       console.error("Error loading available slots:", err)
       setSlotsError(err instanceof Error ? err.message : "スロット情報の取得に失敗しました")
      setSlots([])
    } finally {
      setIsLoadingSlots(false)
    }
  }

  // 初回ロード時にスロットを取得
  useEffect(() => {
    if (needsClientSideLoad && selectedDate) {
      fetchAvailableSlots(selectedDate, selectedSpecialty)
    }
  }, [needsClientSideLoad, selectedDate, selectedSpecialty])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
    setSelectedDoctor(null)
    setSelectedSlot(null)
  }

  const handleSpecialtyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSpecialty(e.target.value)
    setSelectedDoctor(null)
    setSelectedSlot(null)
  }

  const handleSearchSlots = () => {
    fetchAvailableSlots(selectedDate, selectedSpecialty)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoctor || !selectedSlot || !chiefComplaint.trim()) {return}

    setSlotsError(null)

    try {
      const token = getAuthToken('/patient')
      if (!token) {
        throw new Error('認証トークンが見つかりません')
      }

      const response = await fetch('/api/patient/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          appointmentType,
          chiefComplaint,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json() as any
        throw new Error(errorData.error || '予約の作成に失敗しました')
      }

      // 成功時は予約一覧ページにリダイレクト
      window.location.href = '/patient/appointments?created=true'
    } catch (err: any) {
      console.error('Error creating appointment:', err)
      setSlotsError(err.message || '予約の作成中にエラーが発生しました')
    }
  }

  const handleSlotSelect = (doctorId: number, slot: TimeSlot) => {
    if (slot.available) {
      setSelectedDoctor(doctorId)
      setSelectedSlot(slot)
    }
  }

  const canSubmit = selectedDoctor && selectedSlot && chiefComplaint.trim()

  return (
    <RequireAuth>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">新規予約</h1>

        {slotsError && <ErrorMessage message={slotsError} />}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">予約日時を選択</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                診察希望日
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={(() => {
                  const now = new Date()
                  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
                  return jstDate.toISOString().split("T")[0]
                })()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                診療科
              </label>
              <select
                id="specialty"
                value={selectedSpecialty}
                onChange={handleSpecialtyChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {specialties.map((spec) => (
                  <option key={spec.value} value={spec.value}>
                    {spec.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

            <button
            type="button"
            onClick={handleSearchSlots}
            disabled={isLoadingSlots}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            >
            {isLoadingSlots ? "検索中..." : "空き時間を検索"}
            </button>
        </div>

        {isLoadingSlots ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            {slots.map((doctorSlot: DoctorSlot) => (
              <div key={doctorSlot.doctorId} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-2">
                  {doctorSlot.doctorName} 医師
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    （{doctorSlot.specialty}）
                  </span>
                </h3>

                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  {doctorSlot.timeSlots.map((slot) => (
                    <button
                      key={`${doctorSlot.doctorId}-${slot.startTime}`}
                      onClick={() => handleSlotSelect(doctorSlot.doctorId, slot)}
                      disabled={!slot.available}
                      className={`
                        p-2 text-sm rounded-md transition-colors
                        ${
                          !slot.available
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : selectedDoctor === doctorSlot.doctorId &&
                              selectedSlot?.startTime === slot.startTime
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                        }
                      `}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedDoctor && selectedSlot && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">予約内容の入力</h2>

            <form onSubmit={handleSubmit}>
              <input type="hidden" name="doctorId" value={selectedDoctor} />
              <input type="hidden" name="appointmentDate" value={selectedDate} />
              <input type="hidden" name="startTime" value={selectedSlot.startTime} />
              <input type="hidden" name="endTime" value={selectedSlot.endTime} />

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    診察種別
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="appointmentType"
                        value="initial"
                        checked={appointmentType === "initial"}
                        onChange={(e) => setAppointmentType(e.target.value as "initial")}
                        className="mr-2"
                      />
                      初診
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="appointmentType"
                        value="followup"
                        checked={appointmentType === "followup"}
                        onChange={(e) => setAppointmentType(e.target.value as "followup")}
                        className="mr-2"
                      />
                      再診
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="chiefComplaint" className="block text-sm font-medium text-gray-700 mb-1">
                    主訴（症状をお聞かせください）
                  </label>
                  <textarea
                    id="chiefComplaint"
                    name="chiefComplaint"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={4}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例：3日前から発熱と頭痛があります"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium mb-2">予約内容確認</h3>
                  <dl className="text-sm space-y-1">
                    <div className="flex">
                      <dt className="font-medium mr-2">日時：</dt>
                      <dd>{selectedDate} {selectedSlot.startTime}〜{selectedSlot.endTime}</dd>
                    </div>
                    <div className="flex">
                      <dt className="font-medium mr-2">医師：</dt>
                      <dd>{slots.find((s: DoctorSlot) => s.doctorId === selectedDoctor)?.doctorName}</dd>
                    </div>
                    <div className="flex">
                      <dt className="font-medium mr-2">診察種別：</dt>
                      <dd>{appointmentType === "initial" ? "初診" : "再診"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoctor(null)
                      setSelectedSlot(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {isSubmitting ? "予約中..." : "予約確定"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </RequireAuth>
  )
}
