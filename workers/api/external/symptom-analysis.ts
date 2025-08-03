import { Hono } from 'hono'
import { z } from 'zod'

const symptomAnalysisRouter = new Hono()

// チャットメッセージの型定義
const ChatMessage = z.object({
  id: z.string(),
  text: z.string(),
  isUser: z.boolean(),
  timestamp: z.string().transform(str => new Date(str))
})

// リクエストスキーマ
const SymptomAnalysisRequest = z.object({
  message: z.string().min(1, 'メッセージを入力してください'),
  chatHistory: z.array(ChatMessage).optional().default([]),
  patientContext: z.object({
    appointmentType: z.enum(['initial', 'followup']),
    selectedSpecialty: z.string()
  })
}).or(z.object({
  // 従来形式の症状入力もサポート（後方互換性）
  symptoms: z.string().min(1, '症状を入力してください'),
  patientContext: z.object({
    appointmentType: z.enum(['initial', 'followup']),
    selectedSpecialty: z.string()
  })
}))

// レスポンススキーマ
const SymptomAnalysisResponse = z.object({
  comment: z.string()
})

symptomAnalysisRouter.post('/', async (c) => {
  try {
    // リクエストボディの検証
    const body = await c.req.json()
    const validatedData = SymptomAnalysisRequest.parse(body)

    // チャット形式か従来形式かを判定
    let message: string
    let chatHistory: any[] = []
    
    if ('message' in validatedData) {
      // チャット形式
      message = validatedData.message
      chatHistory = validatedData.chatHistory || []
    } else {
      // 従来形式
      message = validatedData.symptoms
    }

    // 外部AI API呼び出し（Dify API）
    const aiResponse = await callExternalAI(message, validatedData.patientContext, chatHistory, c.env)

    // レスポンスの検証
    const validatedResponse = SymptomAnalysisResponse.parse(aiResponse)

    return c.json(validatedResponse)
  } catch (error) {
    console.error('Symptom analysis error:', error)
    
    if (error instanceof z.ZodError) {
      return c.json({ error: 'リクエストデータが不正です' }, 400)
    }

    return c.json({ error: 'AI分析に失敗しました' }, 500)
  }
})

// 外部AI API呼び出し関数
async function callExternalAI(message: string, context: any, chatHistory: any[], env: any) {
  try {
    // Dify API呼び出し
    const difyResponse = await callDifyAPI(message, context, chatHistory, env)
    return parseDifyResponse(difyResponse)
  } catch (error) {
    console.error('Dify API error:', error)
    // フォールバック: モック分析を使用
    console.log('Falling back to mock analysis')
    return {
      comment: 'ご質問ありがとうございます。詳しい症状をお聞かせください。発症時期、痛みの程度、その他の症状についても教えてください。'
    }
  }
}

// Dify API呼び出し関数
async function callDifyAPI(message: string, context: any, chatHistory: any[], env: any) {
  const difyBaseUrl = env.DIFY_BASE_URL || 'https://api.dify.ai/v1'
  const difyApiKey = env.DIFY_API_KEY

  if (!difyApiKey) {
    throw new Error('DIFY_API_KEY is not configured')
  }

  // Dify Chat API エンドポイント
  const chatEndpoint = `${difyBaseUrl}/chat-messages`
  
  // チャット履歴を考慮したコンテキスト作成
  let contextualMessage = message
  if (chatHistory.length > 0) {
    const historyText = chatHistory.map(msg => 
      `${msg.isUser ? '患者' : 'AI'}: ${msg.text}`
    ).join('\n')
    contextualMessage = `過去の会話:\n${historyText}\n\n現在の質問: ${message}`
  }
  
  // 医療問診用のコンテキスト情報を追加
  const systemContext = `診療科: ${context.selectedSpecialty || '未選択'}, 診察種別: ${context.appointmentType === 'initial' ? '初診' : '再診'}`
  const fullPrompt = `${systemContext}\n\n${contextualMessage}`
 
  const response = await fetch(chatEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${difyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        specialty: context.selectedSpecialty || '',
        appointment_type: context.appointmentType || 'initial'
      },
      query: fullPrompt,
      response_mode: 'blocking',
      user: 'patient',
      conversation_id: '', // 新しい会話として扱う
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Dify API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

// Dify APIレスポンスを解析
function parseDifyResponse(difyResponse: any) {
  try {
    // Difyのレスポンスから回答テキストを取得
    const answer = difyResponse.answer || difyResponse.message || ''
    console.log('DIFYのレスポンス', answer)
    
    return {
      comment: answer || '症状を詳しく診察する必要があります。'
    }
  } catch (error) {
    console.error('Failed to parse Dify response:', error)
    return {
      comment: '応答がうまく受け取れませんでした。もう一度お試しください。'
    }
  }
}

export default symptomAnalysisRouter