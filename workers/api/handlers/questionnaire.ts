import { Hono } from 'hono'
import type { Env } from '../../app'
import { authMiddleware } from '../../auth/middleware'
import type { JWTPayload } from '../../auth/jwt'
import { DrizzleRepositoryFactory } from '../../repositories'
import { initializeDatabase } from '../../app'

type Variables = { user: JWTPayload }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// 問診票テンプレート取得関数
function getQuestionnaireTemplate(appointmentType: string) {
  const basicQuestions = [
    {
      id: 'symptoms',
      type: 'textarea',
      question: '現在の症状を詳しくお教えください',
      required: true,
    },
    {
      id: 'symptom_duration',
      type: 'select',
      question: '症状はいつからありますか？',
      options: ['今日', '昨日', '2-3日前', '1週間前', '1ヶ月以上前'],
      required: true,
    },
    {
      id: 'allergies',
      type: 'textarea',
      question: 'アレルギーはありますか？',
      required: false,
    },
    {
      id: 'medications',
      type: 'textarea',
      question: '現在服用中のお薬はありますか？',
      required: false,
    },
    {
      id: 'medical_history',
      type: 'textarea',
      question: '過去の病歴について教えてください',
      required: false,
    },
  ]

  if (appointmentType === 'followup') {
    basicQuestions.unshift({
      id: 'previous_treatment',
      type: 'textarea',
      question: '前回の診察後の経過はいかがでしたか？',
      required: true,
    })
  }

  return basicQuestions
}

// 問診票取得
app.get('/:appointmentId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    const appointmentId = parseInt(c.req.param('appointmentId'))
    const db = initializeDatabase(c.env)

    if (!db) {
      return c.json({ error: 'Database not available' }, 500)
    }

    // 患者のみアクセス可能
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()
    const questionnaireRepo = factory.createQuestionnaireRepository()

    // 予約情報を取得
    const appointment = await appointmentRepo.findById(appointmentId)
    if (!appointment || appointment.patientId !== user.id) {
      return c.json({ error: 'Appointment not found' }, 404)
    }

    // 問診票を取得
    const questionnaire = await questionnaireRepo.findByAppointmentId(appointmentId)

    if (questionnaire) {
      console.log('🔍 DEBUG: 既存問診票発見、templateも含めて返します', {
        appointmentType: appointment.appointmentType,
        templateLength: getQuestionnaireTemplate(appointment.appointmentType || 'general').length
      })

      const response = {
        questionnaire: {
          id: questionnaire.id,
          appointmentId: questionnaire.appointmentId,
          answers: JSON.parse(questionnaire.questionsAnswers as string || '{}'),
          completedAt: questionnaire.completedAt,
          createdAt: questionnaire.createdAt,
          updatedAt: questionnaire.updatedAt,
        },
        template: getQuestionnaireTemplate(appointment.appointmentType || 'general'),
      }

      console.log('🔍 DEBUG: レスポンス準備完了', { hasTemplate: !!response.template, templateLength: response.template?.length })
      return c.json(response)
    }

    // 問診票が存在しない場合、新規作成用のテンプレートを返す
    return c.json({
      questionnaire: {
        appointmentId,
        answers: {},
        completedAt: null,
      },
      template: getQuestionnaireTemplate(appointment.appointmentType || 'general'),
    })
  } catch (error) {
    console.error('Error fetching questionnaire:', error)
    return c.json({ error: 'Failed to fetch questionnaire' }, 500)
  }
})

// 問診票回答保存
app.post('/answer', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    const body = await c.req.json()
    const { appointmentId, questionId, answer } = body

    if (!appointmentId || !questionId || answer === undefined) {
      return c.json({ error: '必須フィールドが不足しています' }, 400)
    }

    const db = initializeDatabase(c.env)
    if (!db) {
      return c.json({ error: 'Database not available' }, 500)
    }

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()
    const questionnaireRepo = factory.createQuestionnaireRepository()

    // 予約の所有者確認
    const appointment = await appointmentRepo.findById(appointmentId)
    if (!appointment || appointment.patientId !== user.id) {
      return c.json({ error: 'Appointment not found' }, 404)
    }

    // 既存の問診票を取得または新規作成
    let questionnaire = await questionnaireRepo.findByAppointmentId(appointmentId)

    if (questionnaire) {
      // 既存の回答を更新
      const currentAnswers = JSON.parse(questionnaire.questionsAnswers as string || '{}')
      currentAnswers[questionId] = answer
      await questionnaireRepo.update(questionnaire.id, {
        questionsAnswers: JSON.stringify(currentAnswers)
      })
    } else {
      // 新規作成
      questionnaire = await questionnaireRepo.create({
        appointmentId,
        questionsAnswers: JSON.stringify({ [questionId]: answer }),
      })
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error saving questionnaire answer:', error)
    return c.json({ error: 'Failed to save answer' }, 500)
  }
})

// 問診票完了
app.post('/complete', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    const body = await c.req.json()
    const { appointmentId } = body

    if (!appointmentId) {
      return c.json({ error: 'appointmentIdが必要です' }, 400)
    }

    const db = initializeDatabase(c.env)
    if (!db) {
      return c.json({ error: 'Database not available' }, 500)
    }

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()
    const questionnaireRepo = factory.createQuestionnaireRepository()

    // 予約の所有者確認
    const appointment = await appointmentRepo.findById(appointmentId)
    if (!appointment || appointment.patientId !== user.id) {
      return c.json({ error: 'Appointment not found' }, 404)
    }

    // 問診票を取得
    const questionnaire = await questionnaireRepo.findByAppointmentId(appointmentId)
    if (!questionnaire) {
      return c.json({ error: 'Questionnaire not found' }, 404)
    }

    // 完了に更新
    const result = await questionnaireRepo.markAsCompleted(questionnaire.id)

    return c.json({
      success: true,
      questionnaire: {
        id: result!.id,
        appointmentId: result!.appointmentId,
        completedAt: result!.completedAt,
      },
    })
  } catch (error) {
    console.error('Error completing questionnaire:', error)
    return c.json({ error: 'Failed to complete questionnaire' }, 500)
  }
})

export default app
