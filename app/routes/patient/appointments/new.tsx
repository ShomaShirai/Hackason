import React, { useEffect, useRef, useState } from "react"
import { useLoaderData } from "react-router"
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

// 25行目付近のインターフェースを以下に置き換え
interface TongueDiagnosisResult {
  // 基本的な舌診結果（既存の構造）
  color?: {
    primary: string;
    secondary: string;
    confidence: number;
  };
  coating?: {
    thickness: string;
    color: string;
    distribution: string;
    confidence: number;
  };
  texture?: {
    moisture: string;
    cracks: string;
    spots: string;
    confidence: number;
  };
  shape?: {
    size: string;
    edges: string;
    tip: string;
    confidence: number;
  };
  overallAssessment?: {
    constitution: string;
    severity: string;
    recommendations: string[];
    confidence: number;
  };
  analysisTimestamp?: string;

  // ✅ 生成AI（TongueDiagnosisService）からのレスポンス構造を追加
  overall_assessment?: string;
  tongue_color?: string;
  tongue_coating?: string;
  tongue_shape?: string;
  moisture_level?: string;
  constitutional_type?: string;
  recommended_treatment?: string;
  dietary_recommendations?: string;
  lifestyle_advice?: string;
  urgency_level?: 'low' | 'medium' | 'high';
  confidence_score?: number;
  analyzed_at?: string;
}

interface DiagnosisResponse {
  success: boolean;
  analysis: TongueDiagnosisResult;
  message: string;
  imageUrl?: string;
  timestamp?: string;
  aiProvider?: string;
  warning?: string;
}


interface ErrorResponse {
  error: string;
  details?: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const getCurrentJstDate = () => {
    const now = new Date()
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    return jstDate.toISOString().split("T")[0]
  }

  const date = url.searchParams.get("date") || getCurrentJstDate()
  const specialty = url.searchParams.get("specialty") || ""

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
      const errorData = await response.json() as ErrorResponse
      return Response.json(
        { error: errorData.error || "予約の作成に失敗しました" },
        { status: response.status }
      )
    }

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

  // 基本状態
  const [selectedDate, setSelectedDate] = useState(date)
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialty)
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [appointmentType, setAppointmentType] = useState<"initial" | "followup">("initial")

  // カメラ関連状態
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 舌診関連状態
  const [tongueAnalysisResult, setTongueAnalysisResult] = useState<TongueDiagnosisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // スロット取得関連状態
  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  // ✅ 不足していた状態変数を追加
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 診療科リスト
  const specialties = [
    { value: "", label: "すべて" },
    { value: "内科", label: "内科" },
    { value: "小児科", label: "小児科" },
    { value: "皮膚科", label: "皮膚科" },
    { value: "耳鼻咽喉科", label: "耳鼻咽喉科" },
  ]
  // スロット取得関数の修正
  const fetchAvailableSlots = async (searchDate: string, searchSpecialty: string) => {
    setIsLoadingSlots(true)
    setSlotsError(null)

    try {
      const token = getAuthToken('/patient')
      if (!token) {
        throw new Error('認証トークンが見つかりません')
      }

      console.log('🔍 スロット検索:', { searchDate, searchSpecialty })

      const response = await fetch(
        `/api/patient/appointments/available-slots?date=${searchDate}&specialty=${searchSpecialty}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse
        throw new Error(errorData.error || "スロット情報の取得に失敗しました")
      }

      const data = await response.json() as {
        availableSlots?: { time: string; available: boolean }[];
        slots?: DoctorSlot[];
      }

      console.log('📊 取得したスロットデータ:', data)

      if (data.slots && data.slots.length > 0) {
        console.log('✅ 正式スロットデータを使用')
        setSlots(data.slots)
      } else if (data.availableSlots && data.availableSlots.length > 0) {
        console.log('🔄 モックデータを変換中...')
        const mockSlots: DoctorSlot[] = [
          {
            doctorId: 1,
            doctorName: "田中医師",
            specialty: searchSpecialty || "内科",
            timeSlots: data.availableSlots.map(slot => {
              // ✅ 正しい時刻計算
              const [hour, minute] = slot.time.split(':').map(Number)
              let endHour = hour
              let endMinute = minute + 30

              // 60分を超えた場合の処理
              if (endMinute >= 60) {
                endHour += 1
                endMinute -= 60
              }

              const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`

              console.log(`⏰ 時刻変換: ${slot.time} → ${endTime}`)

              return {
                startTime: slot.time,
                endTime: endTime, // ✅ 正しい終了時刻
                available: slot.available
              }
            })
          }
        ];
        console.log('✅ モックスロット変換完了:', mockSlots)
        setSlots(mockSlots);
      } else {
        console.log('⚠️ 利用可能なスロットなし')
        setSlots([]);
        setSlotsError('指定された日時に利用可能なスロットがありません。');
      }
    } catch (err: any) {
      console.error("❌ スロット取得エラー:", err)
      setSlotsError(err instanceof Error ? err.message : "スロット情報の取得に失敗しました")
      setSlots([])
    } finally {
      setIsLoadingSlots(false)
    }
  }
  // 280行目付近のperformTongueDiagnosis関数を修正
  const performTongueDiagnosis = async (imageData: string) => {
    console.log('🔍 舌診分析実行中...')
    console.log('📊 送信データ:', {
      imageDataLength: imageData.length,
      imageDataPreview: imageData.substring(0, 50) + '...',
      symptoms: chiefComplaint,
      timestamp: new Date().toISOString()
      // ✅ appointmentIdを完全削除
    })

    setSlotsError('📸 写真撮影完了！生成AIで舌診分析を開始しています...')
    setIsAnalyzing(true)

    try {
      const token = getAuthToken('/patient')
      if (!token) {
        throw new Error('認証トークンが見つかりません')
      }

      console.log('🔐 認証トークン確認:', token.substring(0, 20) + '...')

      // ✅ appointmentIdを完全削除したrequestBody
      const requestBody = {
        imageData: imageData,
        symptoms: chiefComplaint,
        timestamp: new Date().toISOString()
        // appointmentId は削除
      }

      console.log('📤 リクエスト送信開始:', {
        url: '/api/tongue-diagnosis',
        method: 'POST',
        bodySize: JSON.stringify(requestBody).length,
        hasSymptoms: !!chiefComplaint
      })

      const diagnosisResponse = await fetch('/api/tongue-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody)
      })

      console.log('🔍 舌診レスポンス状態:', {
        status: diagnosisResponse.status,
        statusText: diagnosisResponse.statusText
      })

      if (!diagnosisResponse.ok) {
        const errorText = await diagnosisResponse.text()
        console.error('❌ 舌診分析API失敗:', {
          status: diagnosisResponse.status,
          statusText: diagnosisResponse.statusText,
          errorBody: errorText
        })
        throw new Error(`舌診分析に失敗しました: ${diagnosisResponse.status} ${errorText}`)
      }

      const diagnosisData = await diagnosisResponse.json() as DiagnosisResponse
      console.log('✅ 舌診分析データ:', {
        success: diagnosisData.success,
        confidence: diagnosisData.analysis?.confidence_score,
        urgency: diagnosisData.analysis?.urgency_level,
        constitution: diagnosisData.analysis?.constitutional_type,
        aiProvider: diagnosisData.aiProvider || 'unknown'
      })

      if (!diagnosisData.success) {
        throw new Error(`舌診分析エラー: ${diagnosisData.message}`)
      }

      setTongueAnalysisResult(diagnosisData.analysis)
      console.log('✅ 舌診分析完了！結果を保存しました')

      if (diagnosisData.warning) {
        setSlotsError(`⚠️ ${diagnosisData.message}`)
      } else {
        setSlotsError('✅ 生成AIによる舌診分析が完了しました。予約を確定できます。')
      }

    } catch (error) {
      console.error('❌ 舌診分析失敗:', error)
      setSlotsError(`舌診分析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
      setCapturedImage(null)
      setTongueAnalysisResult(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // カメラを開く関数
  const openCamera = async () => {
    console.log("🎥 カメラ起動を開始...")

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("❌ このブラウザはgetUserMediaをサポートしていません")
      setSlotsError("このブラウザはカメラ機能をサポートしていません。")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })

      console.log("✅ カメラストリーム取得成功:", stream)
      setCameraStream(stream)
      setIsCameraOpen(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(console.error)
        }
      }, 200)

    } catch (error) {
      console.error("❌ カメラアクセス失敗:", error)
      let errorMessage = "カメラにアクセスできませんでした。"

      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage += " カメラの使用許可を与えてください。"
            break
          case 'NotFoundError':
            errorMessage += " カメラデバイスが見つかりませんでした。"
            break
          case 'NotReadableError':
            errorMessage += " カメラが他のアプリケーションで使用中です。"
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

  // 写真撮影 + 舌診開始関数
  const takePhoto = async () => {
    console.log('📸 写真撮影開始...')

    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current

      console.log('📐 ビデオサイズ:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        currentTime: video.currentTime,
        paused: video.paused,
        ended: video.ended
      })

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageDataUrl = canvas.toDataURL('image/png')

        console.log('🖼️ 画像データ生成:', {
          dataUrlLength: imageDataUrl.length,
          format: imageDataUrl.substring(0, 30) + '...',
          canvasSize: `${canvas.width}x${canvas.height}`,
          isValidDataUrl: imageDataUrl.startsWith('data:image/')
        })

        setCapturedImage(imageDataUrl)
        closeCamera()

        // 🔥 舌診を即座に開始
        console.log('📸 写真撮影完了 - 舌診分析を開始します')

        try {
          await performTongueDiagnosis(imageDataUrl)
        } catch (error) {
          console.error('❌ takePhoto内での舌診分析エラー:', error)
          setSlotsError(`舌診分析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
        }
      } else {
        console.error('❌ Canvas context取得失敗')
        setSlotsError('画像の処理に失敗しました。もう一度お試しください。')
      }
    } else {
      console.error('❌ Video または Canvas 要素が見つかりません:', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current,
        videoElement: videoRef.current,
        canvasElement: canvasRef.current
      })
      setSlotsError('カメラまたはキャンバス要素が見つかりません。')
    }
  }

  // 撮影した写真を削除する関数
  const deleteImage = () => {
    setCapturedImage(null)
    setTongueAnalysisResult(null)
  }

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



  // 予約作成部分の時刻計算を修正（500行目付近）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true) // ✅ これで setIsSubmitting が利用可能

    try {
      if (!selectedSlot || !selectedDoctor || !appointmentType || !chiefComplaint.trim()) {
        setSlotsError('すべての必須項目を入力してください。')
        return
      }

      // ✅ selectedSlotの終了時刻をそのまま使用（再計算不要）
      const startTime = selectedSlot.startTime
      const endTime = selectedSlot.endTime // ✅ すでに正しく計算済み

      console.log('🔄 予約作成開始...', {
        doctorId: selectedDoctor,
        appointmentDate: selectedDate,
        startTime: startTime,
        endTime: endTime, // ✅ 正しい終了時刻
        appointmentType,
        chiefComplaint: chiefComplaint.substring(0, 50) + '...',
        hasImage: !!capturedImage,
        hasTongueAnalysis: !!tongueAnalysisResult,
        tongueAnalysisConfidence: tongueAnalysisResult?.confidence_score
      })

      const appointmentData = {
        doctorId: selectedDoctor,
        appointmentDate: selectedDate,
        startTime: startTime,
        endTime: endTime, // ✅ 正しい終了時刻
        appointmentType,
        chiefComplaint,
        hasImage: !!capturedImage,
        tongueAnalysis: tongueAnalysisResult,
        imageData: capturedImage
      }

      const response = await fetch('/api/patient/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken('/patient')}`,
        },
        body: JSON.stringify(appointmentData),
      })

      console.log('📋 予約作成レスポンス:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        // ✅ 型安全なエラーハンドリング
        let errorMessage = '予約の作成に失敗しました'
        try {
          const errorData = await response.json() as { error?: string; details?: string }
          console.error('❌ 予約作成失敗:', errorData)
          errorMessage = errorData.error || errorMessage
        } catch {
          // JSON解析に失敗した場合
          const errorText = await response.text()
          console.error('❌ 予約作成失敗（テキスト）:', errorText)
        }
        throw new Error(errorMessage)
      }

      // ✅ 型安全なレスポンスハンドリング
      const result = await response.json() as {
        appointment: {
          id: number;
          patientId: number;
          doctorId: number;
          scheduledAt: string;
          durationMinutes: number;
          status: string;
          appointmentType: string;
          chiefComplaint: string;
          createdAt: string;
          updatedAt: string;
        };
        tongueAnalysisSaved?: boolean;
      }

      console.log('✅ 予約作成成功:', {
        appointmentId: result.appointment.id,
        tongueAnalysisSaved: result.tongueAnalysisSaved
      })

      setSlotsError('✅ 予約が正常に作成されました！リダイレクトしています...')

      // 成功後のリダイレクト
      setTimeout(() => {
        window.location.href = '/patient/appointments'
      }, 2000)

    } catch (error) {
      console.error('❌ 予約作成エラー:', error)
      setSlotsError(`予約の作成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setIsSubmitting(false) // ✅ これで setIsSubmitting が利用可能
    }
  }

  const handleSlotSelect = (doctorId: number, slot: TimeSlot) => {
    if (slot.available) {
      setSelectedDoctor(doctorId)
      setSelectedSlot(slot)
    }
  }

  // 予約ボタンの有効/無効条件（isProcessingを使用）
  const canSubmit = selectedDoctor &&
    selectedSlot &&
    chiefComplaint.trim() &&
    !isSubmitting && // ✅ isProcessing → isSubmitting に変更
    !isAnalyzing &&
    (!capturedImage || tongueAnalysisResult)

  // 初回ロード時にスロットを取得
  useEffect(() => {
    if (needsClientSideLoad && selectedDate) {
      fetchAvailableSlots(selectedDate, selectedSpecialty)
    }
  }, [needsClientSideLoad, selectedDate, selectedSpecialty])

  // コンポーネントがアンマウントされる時にカメラを停止
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

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
                    舌の写真（任意・診断の参考資料として使用されます）
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
                      舌の写真を撮る
                    </button>
                  )}

                  {isCameraOpen && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">舌を画面中央に映して撮影してください</p>
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

                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {cameraStream ? '🟢 カメラON' : '🔴 カメラOFF'}
                        </div>

                        {cameraStream && (
                          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                            ● 録画中
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center gap-4">
                        <button
                          type="button"
                          onClick={takePhoto}
                          disabled={!cameraStream || isAnalyzing}
                          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 flex items-center gap-2 font-semibold"
                        >
                          <span className="text-xl">📸</span>
                          {isAnalyzing ? '分析中...' : '写真を撮る'}
                        </button>
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
                          disabled={isAnalyzing || isSubmitting}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">撮影した舌の写真</h4>
                      <div className="relative inline-block">
                        <img
                          src={capturedImage}
                          alt="舌の写真"
                          className="w-48 h-32 object-cover rounded-lg border shadow-md"
                        />
                        <button
                          type="button"
                          onClick={deleteImage}
                          disabled={isAnalyzing || isSubmitting}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 flex items-center justify-center disabled:bg-gray-400"
                        >
                          ×
                        </button>
                      </div>

                      {/* 舌診分析状態の表示 */}
                      {isAnalyzing ? (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm text-blue-800 font-medium flex items-center">
                            <div className="animate-spin mr-2">⏳</div>
                            舌診分析中です...
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            AI による舌の状態分析を実行しています
                          </div>
                        </div>
                      ) : tongueAnalysisResult ? (
                        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="text-sm text-green-800 font-medium">
                            ✅ 舌診分析完了
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            画像と分析結果は医師の診断参考資料として活用されます
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="text-sm text-red-800 font-medium">
                            ❌ 舌診分析に失敗しました
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            写真を撮り直してください
                          </div>
                        </div>
                      )}

                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteImage()
                            openCamera()
                          }}
                          disabled={isAnalyzing}
                          className="text-sm text-blue-500 hover:text-blue-700 underline disabled:text-gray-400"
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
                        <dt className="font-medium mr-2">舌診：</dt>
                        <dd>
                          {isAnalyzing ? "分析中..." :
                            tongueAnalysisResult ? "分析完了" : "分析失敗"}
                        </dd>
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
                      setTongueAnalysisResult(null)
                      closeCamera()
                    }}
                    disabled={isSubmitting || isAnalyzing} // ✅ isProcessing → isSubmitting
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {isSubmitting // ✅ isProcessing → isSubmitting
                      ? "予約中..."
                      : isAnalyzing
                        ? "舌診分析中..."
                        : (capturedImage && !tongueAnalysisResult)
                          ? "舌診分析が必要です"
                          : "予約確定"}
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
