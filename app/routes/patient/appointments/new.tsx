import React, { useEffect, useRef, useState } from "react"
import { useLoaderData, useNavigation } from "react-router"
import { RequireAuth } from "~/components/auth/RequireAuth"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { Loading } from "~/components/common/Loading"
import { getAuthToken } from "../../../utils/auth"
import type { Route } from "./+types/new"

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

  // カメラ関連の状態を追加
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  // カメラを開く関数 - 強化デバッグ版
  const openCamera = async () => {
    console.log("🎥 カメラ起動を開始...")

    // まず利用可能なメディアデバイスを確認
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      console.log("📷 利用可能なカメラデバイス数:", videoDevices.length)
      console.log("📷 カメラデバイス詳細:", videoDevices)
    } catch (enumError) {
      console.error("❌ デバイス列挙エラー:", enumError)
    }

    // ブラウザがgetUserMediaをサポートしているか確認
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("❌ このブラウザはgetUserMediaをサポートしていません")
      setSlotsError("このブラウザはカメラ機能をサポートしていません。")
      return
    }

    console.log("✅ getUserMedia APIサポート確認済み")

    try {
      // よりシンプルな設定で試行
      console.log("🔄 カメラストリーム取得中...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      console.log("✅ カメラストリーム取得成功:", stream)
      console.log("📹 ビデオトラック数:", stream.getVideoTracks().length)

      if (stream.getVideoTracks().length === 0) {
        console.error("❌ ビデオトラックが見つかりません")
        setSlotsError("カメラのビデオトラックが見つかりませんでした。")
        return
      }

      const videoTrack = stream.getVideoTracks()[0]
      console.log("📊 ビデオトラック設定:", videoTrack.getSettings())

      setCameraStream(stream)
      setIsCameraOpen(true)

      // ビデオ要素への設定を確実に行う
      setTimeout(() => {
        console.log("🖥️ ビデオ要素確認...")

        if (!videoRef.current) {
          console.error("❌ ビデオ要素が見つかりません")
          setSlotsError("ビデオ要素の初期化に失敗しました。")
          return
        }

        console.log("✅ ビデオ要素発見:", videoRef.current)
        console.log("🔗 ストリーム設定中...")

        videoRef.current.srcObject = stream

        // イベントリスナーを追加
        videoRef.current.onloadedmetadata = () => {
          console.log("📊 メタデータ読み込み完了")
          console.log("📐 ビデオサイズ:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight)
        }

        videoRef.current.oncanplay = () => {
          console.log("🎬 再生可能状態")
        }

        videoRef.current.onplay = () => {
          console.log("▶️ 再生開始")
        }

        videoRef.current.onerror = (error) => {
          console.error("❌ ビデオ要素エラー:", error)
        }

        // 再生開始
        videoRef.current.play()
          .then(() => {
            console.log("✅ ビデオ再生開始成功")
          })
          .catch(error => {
            console.error("❌ ビデオ再生失敗:", error)
            console.log("🔄 ユーザー操作後に再試行してください")
          })
      }, 200)

    } catch (error) {
      console.error("❌ カメラアクセス失敗:", error)

      let errorMessage = "カメラにアクセスできませんでした。"

      if (error instanceof Error) {
        console.log("🔍 エラー詳細:")
        console.log("- 名前:", error.name)
        console.log("- メッセージ:", error.message)
        console.log("- スタック:", error.stack)

        switch (error.name) {
          case 'NotAllowedError':
            errorMessage += " カメラの使用許可を与えてください。ブラウザのアドレスバー左側のカメラアイコンをクリックして許可してください。"
            break
          case 'NotFoundError':
            errorMessage += " カメラデバイスが見つかりませんでした。"
            break
          case 'NotReadableError':
            errorMessage += " カメラが他のアプリケーションで使用中です。"
            break
          case 'OverconstrainedError':
            errorMessage += " カメラの設定要求が対応していません。"
            break
          case 'SecurityError':
            errorMessage += " セキュリティエラーです。HTTPSでアクセスしてください。"
            break
          default:
            errorMessage += ` エラー: ${error.message}`
        }
      }

      setSlotsError(errorMessage)
    }
  }

  // カメラを閉じる関数
  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setIsCameraOpen(false)
  }

  // 写真を撮影する関数
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageDataUrl = canvas.toDataURL('image/png')
        setCapturedImage(imageDataUrl)
        closeCamera()
      }
    }
  }

  // 撮影した写真を削除する関数
  const deleteImage = () => {
    setCapturedImage(null)
  }

  // ビデオ要素のロード完了を監視
  const handleVideoLoadedMetadata = () => {
    console.log("📊 ビデオメタデータ読み込み完了")
    if (videoRef.current) {
      const video = videoRef.current
      console.log(`📐 ビデオサイズ: ${video.videoWidth}x${video.videoHeight}`)
      video.play().catch(console.error)
    }
  }

  // コンポーネントがアンマウントされる時にカメラを停止
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoctor || !selectedSlot || !chiefComplaint.trim()) { return }

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
          image: capturedImage, // 撮影した画像を追加
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
                        ${!slot.available
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

                {/* カメラ機能セクション */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    症状の写真（任意・1枚のみ）
                  </label>

                  {!capturedImage && !isCameraOpen && (
                    <button
                      type="button"
                      onClick={openCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      カメラを起動
                    </button>
                  )}

                  {isCameraOpen && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">カメラ映像</p>
                      </div>

                      <div className="relative bg-gray-900 rounded-lg overflow-hidden border-4 border-blue-300 mx-auto" style={{ maxWidth: '500px' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-auto block"
                          style={{
                            minHeight: '300px',
                            backgroundColor: '#1f2937'
                          }}
                        />
                        <canvas
                          ref={canvasRef}
                          className="hidden"
                        />

                        {/* より目立つインジケーター */}
                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {cameraStream ? '🟢 カメラON' : '🔴 カメラOFF'}
                        </div>

                        {cameraStream && (
                          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                            ● 録画中
                          </div>
                        )}

                        {/* 再生ボタン（必要に応じて） */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.play().catch(console.error)
                              }
                            }}
                            className="bg-blue-500 text-white p-4 rounded-full opacity-75 hover:opacity-100"
                          >
                            ▶️
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-center gap-4">
                        <button
                          type="button"
                          onClick={takePhoto}
                          disabled={!cameraStream}
                          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 flex items-center gap-2 font-semibold"
                        >
                          <span className="text-xl">📸</span>
                          写真を撮る
                        </button>
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
                        >
                          キャンセル
                        </button>
                      </div>

                      {/* デバッグ情報 */}
                      <div className="bg-gray-100 p-3 rounded text-xs text-gray-600 space-y-1">
                        <div><strong>状態:</strong> カメラストリーム: {cameraStream ? 'アクティブ' : '待機中'}</div>
                        <div><strong>要素:</strong> ビデオ要素: {videoRef.current ? '存在' : '未初期化'}</div>
                        {videoRef.current && (
                          <div><strong>サイズ:</strong> {videoRef.current.videoWidth || 0}x{videoRef.current.videoHeight || 0}</div>
                        )}
                        <div><strong>時刻:</strong> {new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">撮影した写真</h4>
                      <div className="relative inline-block">
                        <img
                          src={capturedImage}
                          alt="症状写真"
                          className="w-48 h-32 object-cover rounded-lg border shadow-md"
                        />
                        <button
                          type="button"
                          onClick={deleteImage}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteImage()
                            openCamera()
                          }}
                          className="text-sm text-blue-500 hover:text-blue-700 underline"
                        >
                          写真を撮り直す
                        </button>
                      </div>
                    </div>
                  )}
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
                    {capturedImage && (
                      <div className="flex">
                        <dt className="font-medium mr-2">添付写真：</dt>
                        <dd>1枚</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoctor(null)
                      setSelectedSlot(null)
                      setCapturedImage(null)
                      closeCamera()
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
