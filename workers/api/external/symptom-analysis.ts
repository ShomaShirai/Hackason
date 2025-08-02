import { Hono } from 'hono'
import { z } from 'zod'

const symptomAnalysisRouter = new Hono()

// リクエストスキーマ
const SymptomAnalysisRequest = z.object({
  symptoms: z.string().min(1, '症状を入力してください'),
  patientContext: z.object({
    appointmentType: z.enum(['initial', 'followup']),
    selectedSpecialty: z.string()
  })
})

// レスポンススキーマ
const SymptomAnalysisResponse = z.object({
  comment: z.string()
})

symptomAnalysisRouter.post('/', async (c) => {
  try {
    // リクエストボディの検証
    const body = await c.req.json()
    const validatedData = SymptomAnalysisRequest.parse(body)

    // 外部AI API呼び出し（Dify API）
    const aiResponse = await callExternalAI(validatedData.symptoms, validatedData.patientContext, c.env)

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
async function callExternalAI(symptoms: string, context: any, env: any) {
  try {
    // Dify API呼び出し
    const difyResponse = await callDifyAPI(symptoms, context, env)
    return parseDifyResponse(difyResponse)
  } catch (error) {
    console.error('Dify API error:', error)
    // フォールバック: モック分析を使用
    console.log('Falling back to mock analysis')
  }
}

// Dify API呼び出し関数
async function callDifyAPI(symptoms: string, context: any, env: any) {
  const difyBaseUrl = env.DIFY_BASE_URL || 'https://api.dify.ai/v1'
  const difyApiKey = env.DIFY_API_KEY

  if (!difyApiKey) {
    throw new Error('DIFY_API_KEY is not configured')
  }

  // Dify Chat API エンドポイント
  const chatEndpoint = `${difyBaseUrl}/chat-messages`
  
  // 医療症状分析用のプロンプト
  const prompt = `${symptoms}`
 
  const response = await fetch(chatEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${difyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query: prompt,
      response_mode: 'blocking',
      user: 'patient'
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
    // フォールバック: テキストから推測
    const answer = difyResponse.answer || difyResponse.message || ''
    return parseTextResponse(answer)
  }
}

// テキストレスポンスから情報を抽出
function parseTextResponse(text: string) {
  const lowerText = text.toLowerCase()
  
  // 診療科の推測
  let recommendedSpecialty = '内科'
  if (lowerText.includes('皮膚') || lowerText.includes('かゆみ') || lowerText.includes('湿疹')) {
    recommendedSpecialty = '皮膚科'
  } else if (lowerText.includes('耳') || lowerText.includes('鼻') || lowerText.includes('喉')) {
    recommendedSpecialty = '耳鼻咽喉科'
  } else if (lowerText.includes('心臓') || lowerText.includes('循環器')) {
    recommendedSpecialty = '循環器内科'
  } else if (lowerText.includes('消化器') || lowerText.includes('胃') || lowerText.includes('腸')) {
    recommendedSpecialty = '消化器内科'
  } else if (lowerText.includes('呼吸器') || lowerText.includes('肺')) {
    recommendedSpecialty = '呼吸器内科'
  } else if (lowerText.includes('神経') || lowerText.includes('脳')) {
    recommendedSpecialty = '神経内科'
  } else if (lowerText.includes('救急')) {
    recommendedSpecialty = '救急科'
  }
  
  // 緊急度の推測
  let urgency: 'low' | 'medium' | 'high' = 'low'
  if (lowerText.includes('緊急') || lowerText.includes('救急') || lowerText.includes('すぐに')) {
    urgency = 'high'
  } else if (lowerText.includes('早め') || lowerText.includes('推奨') || lowerText.includes('受診')) {
    urgency = 'medium'
  }
  
  return {
    recommendedSpecialty,
    urgency,
    comment: text || '症状を詳しく診察する必要があります。'
  }
}

export default symptomAnalysisRouter 