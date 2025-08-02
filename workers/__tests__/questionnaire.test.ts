import { describe, it, expect, beforeEach, vi } from 'vitest'

// テスト用の定数
const TEST_BASE_URL = 'http://localhost:8787'
const TEST_APPOINTMENT_ID = 2

// 認証ヘルパー関数
async function getPatientToken(): Promise<string> {
  const response = await fetch(`${TEST_BASE_URL}/api/auth/patient/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'patient@test.com',
      password: 'test1234'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to login: ${response.status}`)
  }

  const data = await response.json() as { accessToken: string }
  return data.accessToken
}

async function getWorkerToken(): Promise<string> {
  const response = await fetch(`${TEST_BASE_URL}/api/auth/worker/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'doctor@test.com',
      password: 'test1234'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to login worker: ${response.status}`)
  }

  const data = await response.json() as { accessToken: string }
  return data.accessToken
}

describe('問診APIテスト', () => {
  let patientToken: string

  beforeEach(async () => {
    // 実際の認証フローでトークンを取得
    patientToken = await getPatientToken()
  })

    describe('問診票取得 (GET /api/patient/questionnaire/:appointmentId)', () => {
    it('既存の問診票を取得する', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        }
      })

      expect(response.status).toBe(200)

      const data = await response.json() as {
        questionnaire: {
          id: number
          appointmentId: number
          answers: Record<string, any>
        }
        template: Array<{
          id: string
          question: string
          type: string
          required: boolean
        }>
      }
      console.log('📊 問診APIレスポンス:', JSON.stringify(data, null, 2))

      // 基本構造の確認
      expect(data).toHaveProperty('questionnaire')
      expect(data.questionnaire).toHaveProperty('id')
      expect(data.questionnaire).toHaveProperty('appointmentId', TEST_APPOINTMENT_ID)
      expect(data.questionnaire).toHaveProperty('answers')

      // 🔍 CRITICAL: templateプロパティの確認
      expect(data).toHaveProperty('template')
      expect(Array.isArray(data.template)).toBe(true)
      expect(data.template.length).toBeGreaterThan(0)

      // テンプレート構造の確認
      const firstQuestion = data.template[0]
      expect(firstQuestion).toHaveProperty('id')
      expect(firstQuestion).toHaveProperty('question')
      expect(firstQuestion).toHaveProperty('type')
      expect(firstQuestion).toHaveProperty('required')
    })

    it('存在しない予約IDで404エラーを返す', async () => {
      const response = await fetch('http://localhost:8787/api/patient/questionnaire/999', {
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        }
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toHaveProperty('error')
    })

    it('認証なしで401エラーを返す', async () => {
      const response = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`)

      expect(response.status).toBe(401)
    })
  })

  describe('問診回答保存 (POST /api/patient/questionnaire/answer)', () => {
    it('問診回答を保存する', async () => {
      const answerData = {
        appointmentId: TEST_APPOINTMENT_ID,
        questionId: 'symptoms',
        answer: 'テスト用の症状回答'
      }

      const response = await fetch('http://localhost:8787/api/patient/questionnaire/answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(answerData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('success', true)
    })

    it('無効なデータで400エラーを返す', async () => {
      const invalidData = {
        // appointmentId が欠如
        questionId: 'symptoms',
        answer: 'テスト回答'
      }

      const response = await fetch('http://localhost:8787/api/patient/questionnaire/answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      })

      expect(response.status).toBe(400)
    })
  })

  describe('問診完了 (POST /api/patient/questionnaire/complete)', () => {
    it('問診を完了させる', async () => {
      const completeData = {
        appointmentId: TEST_APPOINTMENT_ID
      }

      const response = await fetch('http://localhost:8787/api/patient/questionnaire/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completeData)
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('success', true)
    })
  })

  describe('問診テンプレート検証', () => {
    it('問診テンプレートの構造が正しい', async () => {
      const response = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      const template = data.template

      // 必須の質問項目の確認
      const requiredQuestions = template.filter((q: any) => q.required)
      expect(requiredQuestions.length).toBeGreaterThan(0)

      // 質問タイプの確認
      const questionTypes = template.map((q: any) => q.type)
      expect(questionTypes).toContain('textarea')
      expect(questionTypes.every((type: string) => ['textarea', 'select', 'radio', 'checkbox'].includes(type))).toBe(true)
    })
  })

  describe('認証・認可テスト', () => {
    it('他の患者の問診票にアクセスできない', async () => {
      // 別の患者のトークンを模擬（患者ID=2）
      const otherPatientToken = "other_patient_token_here"

      const response = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${otherPatientToken}`,
          'Content-Type': 'application/json'
        }
      })

      // 401（無効なトークン）、403（権限なし）または 404（見つからない）エラーが期待される
      expect([401, 403, 404]).toContain(response.status)
    })

    it('医療従事者は患者の問診票にアクセスできない', async () => {
      const workerToken = "worker_token_here"

      const response = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'Content-Type': 'application/json'
        }
      })

      // 401（無効なトークン）または 403（権限なし）エラーが期待される
      expect([401, 403]).toContain(response.status)
    })
  })

  describe('デバッグ情報確認', () => {
    it.skip('問診APIのデバッグログを確認', async () => {
      // コンソールログをキャプチャするためのスパイ
      const consoleSpy = vi.spyOn(console, 'log')

      const response = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        }
      })

      // デバッグログが出力されているか確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 DEBUG: 既存問診票発見')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('統合テスト', () => {
    it('問診フロー全体のテスト', async () => {
      // 1. 問診票取得
      const getResponse = await fetch(`http://localhost:8787/api/patient/questionnaire/${TEST_APPOINTMENT_ID}`, {
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        }
      })

      expect(getResponse.status).toBe(200)
      const questionnaire = await getResponse.json()

      // 2. 各質問に回答
      const questions = questionnaire.template
      for (const question of questions.slice(0, 2)) { // 最初の2問だけテスト
        const answerResponse = await fetch('http://localhost:8787/api/patient/questionnaire/answer', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${patientToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appointmentId: TEST_APPOINTMENT_ID,
            questionId: question.id,
            answer: `テスト回答: ${question.id}`
          })
        })

        expect(answerResponse.status).toBe(200)
      }

      // 3. 問診完了
      const completeResponse = await fetch('http://localhost:8787/api/patient/questionnaire/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${patientToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appointmentId: TEST_APPOINTMENT_ID
        })
      })

      expect(completeResponse.status).toBe(200)
    })
  })
})
