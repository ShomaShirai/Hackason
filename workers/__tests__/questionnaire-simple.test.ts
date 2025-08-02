import { describe, it, expect } from 'vitest'

describe('問診API基本テスト', () => {
  const BASE_URL = 'http://localhost:8787'
  const APPOINTMENT_ID = 2

  it('患者ログインでトークンを取得', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@test.com',
        password: 'test1234'
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json() as { accessToken: string }
    expect(data.accessToken).toBeDefined()
    console.log('✅ 患者ログイン成功、トークン取得完了')
  })

  it('問診APIレスポンス構造を確認', async () => {
    // 1. まず患者ログイン
    const loginResponse = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@test.com',
        password: 'test1234'
      })
    })

    const { accessToken } = await loginResponse.json() as { accessToken: string }

    // 2. 問診API呼び出し
    const response = await fetch(`${BASE_URL}/api/patient/questionnaire/${APPOINTMENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    console.log('📊 問診APIレスポンス:', JSON.stringify(data, null, 2))

    // 基本構造確認
    expect(data).toHaveProperty('questionnaire')

    // 🔍 CRITICAL: templateプロパティの存在確認
    console.log('🔍 template存在チェック:', !!data.template)
    console.log('🔍 templateの型:', typeof data.template)
    console.log('🔍 templateの内容:', data.template)

    if (data.template) {
      expect(Array.isArray(data.template)).toBe(true)
      expect(data.template.length).toBeGreaterThan(0)
      console.log('✅ templateプロパティが正常に存在')
    } else {
      console.log('❌ templateプロパティが存在しません')
      console.log('📋 問診票データ:', data.questionnaire)
    }
  })

  it('問診APIのデバッグログ確認', async () => {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@test.com',
        password: 'test1234'
      })
    })

    const { accessToken } = await loginResponse.json() as { accessToken: string }

    // APIコールを実行（サーバーログでデバッグ情報を確認）
    const response = await fetch(`${BASE_URL}/api/patient/questionnaire/${APPOINTMENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('🔍 APIレスポンスステータス:', response.status)
    console.log('🔍 APIレスポンスヘッダー:', Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const data = await response.json()
      console.log('🔍 レスポンスキー:', Object.keys(data))
    }
  })
})
