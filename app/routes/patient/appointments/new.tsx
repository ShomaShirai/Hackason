import type { Route } from "./+types/new"
import { useLoaderData, useNavigation } from "react-router"
import React, { useState, useEffect } from "react"
import { Loading } from "~/components/common/Loading"
import { RequireAuth } from "~/components/auth/RequireAuth"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { getAuthToken } from "../../../utils/auth"

// Web Speech API の型定義
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

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
  const [chatMessages, setChatMessages] = useState<{id: string, text: string, isUser: boolean, timestamp: Date}[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [appointmentType, setAppointmentType] = useState<"initial" | "followup">("initial")

  // クライアントサイドでのスロット取得
  const [slots, setSlots] = useState<DoctorSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  
  // 外部API関連の状態
  const [isExternalAPILoading, setIsExternalAPILoading] = useState(false)
  const [externalAPIError, setExternalAPIError] = useState<string | null>(null)

  // 音声認識関連の状態
  const [isListening, setIsListening] = useState(false)
  const [speechRecognition, setSpeechRecognition] = useState<SpeechRecognition | null>(null)
  const [speechError, setSpeechError] = useState<string | null>(null)

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

  // メッセージ送信機能
  const handleSendMessage = async () => {
    if (!currentInput.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      text: currentInput.trim(),
      isUser: true,
      timestamp: new Date()
    }

    // ユーザーメッセージをチャットに追加
    const newChatMessages = [...chatMessages, userMessage]
    setChatMessages(newChatMessages)
    
    // 主訴フィールドも更新（フォーム送信用）
    setChiefComplaint(newChatMessages.map(msg => `${msg.isUser ? '患者' : 'AI'}: ${msg.text}`).join('\n'))
    
    const messageToSend = currentInput.trim()
    setCurrentInput('')
    
    // DIFY APIに送信
    await handleDIFYAPICall(messageToSend, newChatMessages)
  }

  // DIFY API呼び出し関数
  const handleDIFYAPICall = async (message: string, currentChatMessages: typeof chatMessages) => {
    setIsExternalAPILoading(true)
    setExternalAPIError(null)

    try {
      // DIFY API呼び出し
      const response = await fetch('/api/external/symptom-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken('/patient')}`,
        },
        body: JSON.stringify({
          message: message,
          chatHistory: currentChatMessages,
          patientContext: {
            appointmentType,
            selectedSpecialty
          }
        }),
      })

      if (!response.ok) {
        throw new Error('AI分析に失敗しました')
      }

      const result = await response.json() as {
        comment: string
      }
      
      // AIの応答をチャットに追加
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: result.comment,
        isUser: false,
        timestamp: new Date()
      }
      
      const updatedMessages = [...currentChatMessages, aiMessage]
      setChatMessages(updatedMessages)
      
      // 主訴フィールドも更新
      setChiefComplaint(updatedMessages.map(msg => `${msg.isUser ? '患者' : 'AI'}: ${msg.text}`).join('\n'))
      
    } catch (error) {
      console.error('DIFY API error:', error)
      setExternalAPIError(error instanceof Error ? error.message : 'AI分析中にエラーが発生しました')
      
      // エラーメッセージもチャットに追加
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: 'すみません、現在AIが応答できません。後ほど再試行してください。',
        isUser: false,
        timestamp: new Date()
      }
      const updatedMessages = [...currentChatMessages, errorMessage]
      setChatMessages(updatedMessages)
      setChiefComplaint(updatedMessages.map(msg => `${msg.isUser ? '患者' : 'AI'}: ${msg.text}`).join('\n'))
    } finally {
      setIsExternalAPILoading(false)
    }
  }


  const canSubmit = selectedDoctor && selectedSlot && chiefComplaint.trim()

  // 音声認識の初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ja-JP'
        

        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
          setSpeechError(`音声認識エラー: ${event.error}`)
          setIsListening(false)
        }
        
        recognition.onend = () => {
          setIsListening(false)
        }
        
        // 音声認識の自動停止（5秒間音声がない場合）
        let silenceTimer: NodeJS.Timeout
        recognition.onresult = (event) => {
          // 既存のonresult処理をここに移動
          let finalTranscript = ''
          let interimTranscript = ''
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
            }
          }
          
          if (finalTranscript) {
            // チャット入力フィールドに追加
            setCurrentInput(prev => {
              const currentText = prev.trim()
              return currentText ? `${currentText} ${finalTranscript}` : finalTranscript
            })
          }
          
          // 音声が検出されたらタイマーをリセット
          clearTimeout(silenceTimer)
          silenceTimer = setTimeout(() => {
            if (isListening) {
              stopListening()
            }
          }, 5000) // 5秒間音声がない場合に自動停止
        }
        
        setSpeechRecognition(recognition)
      } else {
        setSpeechError('お使いのブラウザは音声認識をサポートしていません')
      }
    }
  }, [])

  // 音声認識開始
  const startListening = () => {
    if (speechRecognition) {
      setSpeechError(null)
      setIsListening(true)
      speechRecognition.start()
    }
  }

  // 音声認識停止
  const stopListening = () => {
    if (speechRecognition) {
      speechRecognition.stop()
      setIsListening(false)
    }
  }

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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      主訴（チャット形式で症状をお聞かせください）
                    </label>
                  </div>
                  
                  {/* 音声認識エラー表示 */}
                  {speechError && (
                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">{speechError}</p>
                    </div>
                  )}
                  
                  {/* チャット形式の入力 */}
                  <div className="border border-gray-300 rounded-lg">
                    {/* チャットメッセージ表示エリア */}
                    <div className="h-64 overflow-y-auto p-4 bg-gray-50">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                          <p>問診を開始します。症状についてお話しください。</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.isUser ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                  message.isUser
                                    ? "bg-blue-500 text-white"
                                    : "bg-white border border-gray-200 text-gray-800"
                                }`}
                              >
                                <p className="text-sm">{message.text}</p>
                                <p className={`text-xs mt-1 ${
                                  message.isUser ? "text-blue-100" : "text-gray-500"
                                }`}>
                                  {message.timestamp.toLocaleTimeString('ja-JP', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* AI応答中のローディング表示 */}
                      {isExternalAPILoading && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                              <span className="text-sm text-gray-600">AIが応答を作成中...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* メッセージ入力エリア */}
                    <div className="border-t border-gray-300 p-4">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendMessage()
                              }
                            }}
                            placeholder="症状や気になることを入力してください..."
                            className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isExternalAPILoading}
                          />
                          
                          {/* 音声認識ボタン（チャット内） */}
                          <div className="absolute right-2 top-2">
                            {isListening ? (
                              <button
                                type="button"
                                onClick={stopListening}
                                className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                title="音声認識を停止"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={startListening}
                                disabled={!speechRecognition || isExternalAPILoading}
                                className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                title="音声認識を開始"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={!currentInput.trim() || isExternalAPILoading}
                          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          送信
                        </button>
                      </div>
                      
                      {/* 音声認識中のインジケーター */}
                      {isListening && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm text-red-600">音声認識中...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* チャットモード用のエラーメッセージ */}
                  {externalAPIError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">{externalAPIError}</p>
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
