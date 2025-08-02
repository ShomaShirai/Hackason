import type { Route } from "./+types/messages"
import { useLoaderData, useNavigate, useSubmit, useRevalidator } from "react-router"
import React, { useState, useEffect, useRef } from "react"
import { Loading } from "~/components/common/Loading"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { RequireAuth } from "~/components/auth/RequireAuth"
import type { DoctorAppointmentsResponse, ChatMessagesResponse, ApiError } from "~/types/api"
import { getAuthToken } from "../../utils/auth"

interface LoaderData {
  appointment: DoctorAppointmentsResponse['appointments'][0] | null
  messages: ChatMessagesResponse['messages']
}

export async function loader() {
  const token = getAuthToken()
  if (!token) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // 今日の予約を取得（チャット対象）
  const appointmentsResponse = await fetch('/api/patient/appointments/today', {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!appointmentsResponse.ok) {
    throw new Response('Failed to load appointments', { status: appointmentsResponse.status })
  }

  const appointmentsData = await appointmentsResponse.json() as DoctorAppointmentsResponse
  const activeAppointments = appointmentsData.appointments.filter(
    (apt) => ['confirmed', 'in_progress', 'completed'].includes(apt.status)
  )

  // アクティブな予約がない場合
  if (activeAppointments.length === 0) {
    return { appointment: null, messages: [] }
  }

  // 最新のアクティブな予約を選択
  const appointment = activeAppointments[0]

  // その予約のメッセージを取得
  const messagesResponse = await fetch(`/api/chat/appointments/${appointment.id}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!messagesResponse.ok) {
    throw new Response('Failed to load messages', { status: messagesResponse.status })
  }

  const messagesData = await messagesResponse.json() as ChatMessagesResponse

  return {
    appointment,
    messages: messagesData.messages
  } satisfies LoaderData
}

export async function action({ request }: Route.ActionArgs) {
  const token = getAuthToken()
  if (!token) {
    return { error: 'Unauthorized' }
  }

  const formData = await request.formData()
  const appointmentId = formData.get('appointmentId')
  const content = formData.get('content')
  const messageType = formData.get('messageType') || 'text'

  if (!appointmentId || !content) {
    return { error: 'メッセージ内容が必要です' }
  }

  const response = await fetch(`/api/chat/appointments/${appointmentId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ content, messageType })
  })

  if (!response.ok) {
    const data = await response.json() as ApiError
    return { error: data.error || 'メッセージの送信に失敗しました' }
  }

  return { success: true }
}

export default function PatientMessages() {
  const { appointment, messages: initialMessages } = useLoaderData<typeof loader>() as LoaderData
  const navigate = useNavigate()
  const submit = useSubmit()
  const revalidator = useRevalidator()
  const [messages, setMessages] = useState<ChatMessagesResponse['messages']>(initialMessages || [])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // メッセージリストの最下部にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 定期的にメッセージを更新
  useEffect(() => {
    if (!appointment) {return}

    const interval = setInterval(() => {
      revalidator.revalidate()
    }, 5000) // 5秒ごとに更新

    return () => clearInterval(interval)
  }, [appointment, revalidator])

  // メッセージが更新されたら反映
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !appointment || isSending) {return}

    setIsSending(true)
    setError('')

    const formData = new FormData()
    formData.append('appointmentId', appointment.id.toString())
    formData.append('content', newMessage.trim())
    formData.append('messageType', 'text')

    // 楽観的UI更新
    const tempMessage: ChatMessagesResponse['messages'][0] = {
      id: Date.now(),
      appointmentId: appointment.id,
      content: newMessage.trim(),
      messageType: 'text',
      sentAt: new Date().toISOString(),
      readAt: null,
      sender: {
        type: 'patient',
        name: '自分'
      }
    }

    setMessages([...messages, tempMessage])
    setNewMessage('')

    submit(formData, { method: 'post' })

    // 送信後の処理
    setTimeout(() => {
      setIsSending(false)
      revalidator.revalidate()
    }, 500)
  }

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }

    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!appointment) {
    return (
      <RequireAuth userType="patient">
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                現在チャット可能な予約がありません
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                診察予約が確定すると、医師とチャットできるようになります
              </p>
              <button
                onClick={() => navigate('/patient/appointments')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
              >
                予約一覧へ
              </button>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth userType="patient">
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  診察チャット
                </h1>
                <p className="text-sm text-gray-600">
                  {new Date(appointment.scheduledAt).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })} - {appointment.appointmentType === 'initial' ? '初診' : appointment.appointmentType === 'follow_up' ? '再診' : '緊急'}
                </p>
              </div>
              <button
                onClick={() => navigate('/patient')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <ErrorMessage
              message={error}
              type="error"
              onClose={() => setError('')}
            />
          </div>
        )}

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  メッセージがありません。質問や相談事項をお送りください。
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender.type === 'patient' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`max-w-xs lg:max-w-md ${
                      message.sender.type === 'patient'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    } rounded-lg px-4 py-2 shadow`}>
                      {message.sender.type === 'worker' && (
                        <p className="text-xs font-medium mb-1 text-gray-600">
                          医師
                        </p>
                      )}
                      <p className="text-sm break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender.type === 'patient'
                          ? 'text-blue-100'
                          : 'text-gray-500'
                      }`}>
                        {formatDate(message.sentAt)}
                        {message.readAt && ' ✓'}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* 入力エリア */}
        <div className="bg-white border-t">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="メッセージを入力..."
                disabled={isSending}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loading size="small" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </RequireAuth>
  )
}
