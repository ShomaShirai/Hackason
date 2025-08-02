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

    // 外部AI API呼び出し（例：Hugging Face）
    const aiResponse = await callExternalAI(validatedData.symptoms, validatedData.patientContext)

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
async function callExternalAI(symptoms: string, context: any) {
  
  // デモ用のモックレスポンス
  const mockAnalysis = analyzeSymptomsMock(symptoms, context)
  
  // 実際のAPI呼び出し例（コメントアウト）
  /*
  const response = await fetch('https://api-inference.huggingface.co/models/medical-ai-model', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.HUGGING_FACE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: symptoms,
      parameters: {
        max_length: 200,
        temperature: 0.7,
      }
    })
  })

  if (!response.ok) {
    throw new Error('External AI API call failed')
  }

  const result = await response.json()
  return parseAIResponse(result)
  */

  return mockAnalysis
}

export default symptomAnalysisRouter 