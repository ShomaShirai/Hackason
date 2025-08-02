import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { mockEnv, mockDb } from './setup'

// アプリケーションのインポート（モック化）
// 実際のアプリケーションの構造に合わせて調整が必要
const createApp = () => {
  const app = new Hono()
  
  // ログインエンドポイントの簡易実装
  app.post('/api/auth/login', async (c) => {
    const { email, password, userType } = await c.req.json()
    
    // モックデータから検索
    mockEnv.testEmail = email
    let user = null
    
    if (userType === 'patient') {
      user = mockDb.patients.find(p => p.email === email)
    } else if (userType === 'worker') {
      user = mockDb.workers.find(w => w.email === email)
    }
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // パスワード検証（簡易実装）
    // 実際はbcryptを使うが、テストでは単純比較
    if (password !== 'test1234') {
      return c.json({ error: 'Invalid password' }, 401)
    }
    
    // JWT生成（モック）
    const accessToken = `mock-jwt-${userType}-${user.id}`
    const refreshToken = `mock-refresh-${userType}-${user.id}`
    
    return c.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType,
        role: user.role || undefined,
      },
    })
  })
  
  return app
}

describe('認証API', () => {
  let app: ReturnType<typeof createApp>
  
  beforeEach(() => {
    app = createApp()
  })
  
  describe('患者ログイン', () => {
    it('正常系：正しいメールとパスワードでログイン成功', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'patient@test.com',
          password: 'test1234',
          userType: 'patient',
        }),
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      
      expect(data).toHaveProperty('accessToken')
      expect(data).toHaveProperty('refreshToken')
      expect(data.user).toMatchObject({
        id: 1,
        email: 'patient@test.com',
        name: '山田太郎',
        userType: 'patient',
      })
    })
    
    it('異常系：間違ったパスワードでログイン失敗', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'patient@test.com',
          password: 'wrongpassword',
          userType: 'patient',
        }),
      })
      
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data).toHaveProperty('error', 'Invalid password')
    })
  })
  
  describe('医師ログイン', () => {
    it('正常系：正しいメールとパスワードでログイン成功', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'doctor@test.com',
          password: 'test1234',
          userType: 'worker',
        }),
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      
      expect(data).toHaveProperty('accessToken')
      expect(data).toHaveProperty('refreshToken')
      expect(data.user).toMatchObject({
        id: 1,
        email: 'doctor@test.com',
        name: '田中医師',
        userType: 'worker',
        role: 'doctor',
      })
    })
    
    it('異常系：存在しないメールアドレスでログイン失敗', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'notexist@test.com',
          password: 'test1234',
          userType: 'worker',
        }),
      })
      
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toHaveProperty('error', 'User not found')
    })
  })
})