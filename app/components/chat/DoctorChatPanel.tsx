import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Loading } from '~/components/common/Loading'
import { ErrorMessage } from '~/components/common/ErrorMessage'

interface Message {
  id: number
  content: string
  messageType: 'text' | 'image' | 'file' | 'system'
  sentAt: string
  readAt: string | null
  sender: {
    type: 'patient' | 'worker' | 'system'
    id?: number
    name?: string
    role?: 'doctor' | 'operator' | 'admin'
  }
}

interface DoctorChatPanelProps {
  appointmentId: number
  patientName: string
  className?: string
  isCollapsible?: boolean
  defaultExpanded?: boolean
}

export function DoctorChatPanel({
  appointmentId,
  patientName,
  className = '',
  isCollapsible = true,
  defaultExpanded = true
}: DoctorChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // メッセージリストの最下部にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // メッセージを取得
  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {return}

    try {
      const response = await fetch(`/api/chat/appointments/${appointmentId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json() as { messages: Message[] }
        setMessages(data.messages)
        setError('')
      } else {
        setError('メッセージの取得に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 定期的にメッセージを更新
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages()
    }, 5000) // 5秒ごとに更新

    return () => clearInterval(interval)
  }, [fetchMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) {return}

    setIsSending(true)
    setError('')

    const token = localStorage.getItem('authToken')
    if (!token) {return}

    // 楽観的UI更新
    const tempMessage: Message = {
      id: Date.now(),
      content: newMessage.trim(),
      messageType: 'text',
      sentAt: new Date().toISOString(),
      readAt: null,
      sender: {
        type: 'worker',
        name: '自分',
        role: 'doctor'
      }
    }

    setMessages([...messages, tempMessage])
    setNewMessage('')

    try {
      const response = await fetch(`/api/chat/appointments/${appointmentId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          messageType: 'text'
        })
      })

      if (!response.ok) {
        setError('メッセージの送信に失敗しました')
        // 失敗したら楽観的更新を元に戻す
        setMessages(messages)
      } else {
        // 成功したら最新のメッセージを取得
        await fetchMessages()
      }
    } catch {
      setError('通信エラーが発生しました')
      setMessages(messages)
    } finally {
      setIsSending(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <Loading size="medium" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white shadow rounded-lg ${className}`}>
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {patientName}さんとのチャット
          </h3>
          {isCollapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {error && (
            <div className="px-4 py-2">
              <ErrorMessage
                message={error}
                type="error"
                onClose={() => setError('')}
              />
            </div>
          )}

          {/* メッセージエリア */}
          <div className="h-96 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  メッセージがありません
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender.type === 'worker' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`max-w-xs ${
                      message.sender.type === 'worker'
                        ? 'bg-blue-600 text-white'
                        : message.sender.type === 'system'
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-gray-100 text-gray-900'
                    } rounded-lg px-3 py-2`}>
                      {message.sender.type === 'patient' && (
                        <p className="text-xs font-medium mb-1 text-gray-600">
                          {message.sender.name}
                        </p>
                      )}
                      <p className="text-sm break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender.type === 'worker'
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

          {/* 入力エリア */}
          <div className="border-t border-gray-200 px-4 py-3">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="メッセージを入力..."
                disabled={isSending}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loading size="small" />
                ) : (
                  '送信'
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
