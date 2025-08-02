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
  recommendedSpecialty: z.string(),
  urgency: z.enum(['low', 'medium', 'high']),
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
    return analyzeSymptomsMock(symptoms, context)
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
  const prompt = `症状: ${symptoms}`
 
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
    
    // JSON形式の回答を抽出
    const jsonMatch = answer.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        recommendedSpecialty: parsed.recommendedSpecialty || '内科',
        urgency: parsed.urgency || 'low',
        comment: parsed.comment || '症状を詳しく診察する必要があります。'
      }
    }
    
    // JSONが見つからない場合は、テキストから推測
    return parseTextResponse(answer)
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

// モック症状分析関数（フォールバック用）
function analyzeSymptomsMock(symptoms: string, context: any) {
  const lowerSymptoms = symptoms.toLowerCase()
  
  // 症状に基づく推奨診療科の判定
  let recommendedSpecialty = '内科'
  let urgency: 'low' | 'medium' | 'high' = 'low'
  let comment = ''

  if (lowerSymptoms.includes('発熱') || lowerSymptoms.includes('熱')) {
    if (lowerSymptoms.includes('高熱') || lowerSymptoms.includes('40度')) {
      urgency = 'high'
      comment = '高熱のため、早めの受診をお勧めします。'
    } else {
      urgency = 'medium'
      comment = '発熱症状があります。水分補給を十分に行ってください。'
    }
  }

  if (lowerSymptoms.includes('頭痛') || lowerSymptoms.includes('頭が痛い')) {
    if (lowerSymptoms.includes('激しい') || lowerSymptoms.includes('耐えられない')) {
      urgency = 'high'
      comment = '激しい頭痛のため、神経内科または脳神経外科の受診を検討してください。'
      recommendedSpecialty = '神経内科'
    } else {
      urgency = 'medium'
      comment = '頭痛症状があります。安静にして様子を見てください。'
    }
  }

  if (lowerSymptoms.includes('腹痛') || lowerSymptoms.includes('お腹が痛い')) {
    urgency = 'medium'
    comment = '腹痛症状があります。消化器内科の受診をお勧めします。'
    recommendedSpecialty = '消化器内科'
  }

  if (lowerSymptoms.includes('咳') || lowerSymptoms.includes('痰')) {
    urgency = 'medium'
    comment = '呼吸器症状があります。呼吸器内科の受診をお勧めします。'
    recommendedSpecialty = '呼吸器内科'
  }

  if (lowerSymptoms.includes('皮膚') || lowerSymptoms.includes('かゆみ') || lowerSymptoms.includes('湿疹')) {
    urgency = 'low'
    comment = '皮膚症状があります。皮膚科の受診をお勧めします。'
    recommendedSpecialty = '皮膚科'
  }

  if (lowerSymptoms.includes('耳') || lowerSymptoms.includes('鼻') || lowerSymptoms.includes('喉')) {
    urgency = 'low'
    comment = '耳鼻咽喉科の受診をお勧めします。'
    recommendedSpecialty = '耳鼻咽喉科'
  }

  // 緊急症状のチェック
  if (lowerSymptoms.includes('胸痛') || lowerSymptoms.includes('息苦しい') || lowerSymptoms.includes('意識')) {
    urgency = 'high'
    comment = '緊急症状の可能性があります。救急外来または救急車の利用を検討してください。'
    recommendedSpecialty = '救急科'
  }

  return {
    recommendedSpecialty,
    urgency,
    comment: comment || '症状を詳しく診察する必要があります。'
  }
}

export default symptomAnalysisRouter 