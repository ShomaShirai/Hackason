import type { Route } from "./+types/$id.questionnaire"
import { useLoaderData, useNavigation, useNavigate } from "react-router"
import { useState, useEffect } from "react"
import { ErrorMessage } from "~/components/common/ErrorMessage"
import { RequireAuth } from "~/components/auth/RequireAuth"
import { get, post } from "~/utils/api-client"
import type { QuestionnaireResponse, QuestionnaireTemplate, ApiError } from "~/types/api"

interface LoaderData {
  questionnaire: QuestionnaireResponse['questionnaire'] | null
  template: QuestionnaireTemplate[]
  appointmentId: number
  error?: string
}


export async function loader({ request, params }: Route.LoaderArgs) {
  const appointmentId = params.id

  try {
    // React Routerのloaderはサーバーサイドで実行されるため、
    // クライアントサイドでデータ取得を行うように変更
    return {
      questionnaire: null,
      template: [],
      appointmentId: parseInt(appointmentId),
      needsClientLoad: true,
    } satisfies LoaderData & { needsClientLoad?: boolean }
  } catch (error) {
    console.error("Error loading questionnaire:", error)
    return {
      questionnaire: null,
      template: [],
      appointmentId: parseInt(appointmentId),
      error: "問診票の取得に失敗しました",
    }
  }
}

export async function action({ request: _request, params }: Route.ActionArgs) {
  const appointmentId = params.id
  const formData = await _request.formData()
  const action = formData.get("_action")

  if (action === "save") {
    const questionId = formData.get("questionId") as string
    const answer = formData.get("answer")

    try {
      const response = await fetch("/api/patient/questionnaire/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("Authorization") || "",
        },
        body: JSON.stringify({
          appointmentId: parseInt(appointmentId),
          questionId,
          answer,
        }),
      })

      if (!response.ok) {
        const error = await response.json() as ApiError
        return { error: error.error || "回答の保存に失敗しました" }
      }

      return { success: true }
    } catch (error) {
      console.error("Error saving answer:", error)
      return { error: "回答の保存に失敗しました" }
    }
  } else if (action === "complete") {
    // 問診完了処理はクライアントサイドで行うため、actionでは何もしない
    return { completionRequested: true }
  }

  return null
}

export default function Questionnaire() {
  const loaderData = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const navigate = useNavigate()

  const [questionnaire, setQuestionnaire] = useState<any>(null)
  const [template, setTemplate] = useState<QuestionnaireTemplate[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showError, setShowError] = useState("")
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const appointmentId = loaderData.appointmentId
  const isSubmitting = navigation.state === "submitting"
  const questions = template
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0

  // クライアントサイドでの問診データ取得
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        const data = await get<QuestionnaireResponse>(`/api/patient/questionnaire/${appointmentId}`)
        setQuestionnaire(data.questionnaire)
        setTemplate(data.template || [])
        setAnswers(data.questionnaire?.answers || {})
        setLoading(false)
      } catch (error: any) {
        console.error("Error loading questionnaire:", error)
        // 認証エラーの場合はログイン画面にリダイレクト
        if (error.statusCode === 401 || error.statusCode === 403) {
          navigate('/patient/login')
          return
        }
        setShowError("問診票の取得に失敗しました")
        setLoading(false)
      }
    }

    fetchQuestionnaire()
  }, [appointmentId, navigate])

  // 完了済みフラグ
  const isCompleted = !!questionnaire?.completedAt

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleNext = async () => {
    const currentQ = questions[currentQuestion]
    const currentAnswer = answers[currentQ.id]

    // 必須チェック
    if (currentQ.required && !currentAnswer) {
      setShowError("この質問は必須です")
      return
    }

    // 回答をサーバーに保存
    try {
      await post("/api/patient/questionnaire/answer", {
        appointmentId,
        questionId: currentQ.id,
        answer: currentAnswer,
      })

      // 保存成功時のみ次の質問に進む
      if (currentQuestion < totalQuestions - 1) {
        setCurrentQuestion(prev => prev + 1)
        setShowError("")
      }
    } catch (error: any) {
      console.error("Error saving answer:", error)
      // 認証エラーの場合はログイン画面にリダイレクト
      if (error.statusCode === 401 || error.statusCode === 403) {
        navigate('/patient/login')
        return
      }
      setShowError(error.error || "回答の保存に失敗しました")
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
      setShowError("")
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    setShowError("")

    try {
      await post("/api/patient/questionnaire/complete", {
        appointmentId,
      })

      // 問診完了後は予約一覧にリダイレクト
      navigate("/patient/appointments")
    } catch (error: any) {
      console.error("Error completing questionnaire:", error)
      // 認証エラーの場合はログイン画面にリダイレクト
      if (error.statusCode === 401 || error.statusCode === 403) {
        navigate('/patient/login')
        return
      }
      setShowError(error.error || "問診票の送信に失敗しました")
      setCompleting(false)
    }
  }


  if (loading) {
    return (
      <RequireAuth userType="patient">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">問診票を読み込み中...</p>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  if (showError) {
    return (
      <RequireAuth userType="patient">
        <div className="max-w-4xl mx-auto p-6">
          <ErrorMessage message={showError} />
        </div>
      </RequireAuth>
    )
  }

  // 問診票がない場合は空の状態で開始
  if (questions.length === 0) {
    return (
      <RequireAuth userType="patient">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">問診票の準備中です</h2>
            <p className="text-gray-600">問診票テンプレートを読み込んでいます。しばらくお待ちください...</p>
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  const currentQ = questions[currentQuestion]
  const currentAnswer = answers[currentQ.id] || ""

  return (
    <RequireAuth userType="patient">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md">
          {/* プログレスバー */}
          <div className="p-6 border-b">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-2xl font-bold">
                事前問診票
                {isCompleted && (
                  <span className="ml-2 text-sm font-normal text-green-600">
                    （登録済み - 編集可能）
                  </span>
                )}
              </h1>
              <span className="text-sm text-gray-600">
                {currentQuestion + 1} / {totalQuestions}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isCompleted ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {showError && <ErrorMessage message={showError} />}

          {/* 質問エリア */}
          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">
                {currentQ.question}
                {currentQ.required && <span className="text-red-500 ml-1">*</span>}
              </h2>

              {/* 回答入力エリア */}
              {currentQ.type === 'text' && (
                <input
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="回答を入力してください"
                />
              )}

              {currentQ.type === 'textarea' && (
                <textarea
                  value={currentAnswer}
                  onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="回答を入力してください"
                />
              )}

              {currentQ.type === 'select' && currentQ.options && (
                <select
                  value={currentAnswer}
                  onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {currentQ.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              {currentQ.type === 'radio' && currentQ.options && (
                <div className="space-y-2">
                  {currentQ.options.map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="radio"
                        value={option}
                        checked={currentAnswer === option}
                        onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                        className="mr-2"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ナビゲーションボタン */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                前へ
              </button>

              {currentQuestion === totalQuestions - 1 ? (
                isCompleted ? (
                  <button
                    type="button"
                    onClick={() => navigate("/patient/appointments")}
                    className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600"
                  >
                    編集を完了
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={completing}
                    className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {completing ? "送信中..." : "問診票を送信"}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600"
                >
                  次へ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 一時保存メッセージ */}
        <p className="mt-4 text-sm text-gray-600 text-center">
          回答は自動的に保存されます
        </p>
      </div>
    </RequireAuth>
  )
}
