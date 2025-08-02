import { Hono } from 'hono'
import type { Env } from '../../app'
import { authMiddleware } from '../../auth/middleware'
import type { JWTPayload } from '../../auth/jwt'
import { DrizzleRepositoryFactory } from '../../repositories'
import { initializeDatabase } from '../../app'

type Variables = { user: JWTPayload }

const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

// 予約に関連するメッセージ取得
chat.get('/appointments/:appointmentId/messages', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  const appointmentId = parseInt(c.req.param('appointmentId'))
  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const appointmentRepo = factory.createAppointmentRepository()
  const chatRepo = factory.createChatMessageRepository()
  const patientRepo = factory.createPatientRepository()
  const workerRepo = factory.createWorkerRepository()

  // 予約の存在確認と権限チェック
  const appointment = await appointmentRepo.findById(appointmentId)
  if (!appointment) {
    return c.json({ error: '予約が見つかりません' }, 404)
  }

  // 患者の場合は自分の予約のみアクセス可
  if (user.userType === 'patient' && appointment.patientId !== user.id) {
    return c.json({ error: 'この予約のメッセージにアクセスする権限がありません' }, 403)
  }

  // 医師の場合は担当予約のみアクセス可（ハッカソン版では全医師アクセス可）
  // 本番では appointment.workerId === user.id のチェックが必要

  // メッセージ取得
  const messages = await chatRepo.findByAppointmentId(appointmentId, { limit, offset })

  // 送信者情報を付与
  const messagesWithSender = await Promise.all(
    messages.map(async (msg) => {
      if (msg.patientId) {
        const patient = await patientRepo.findById(msg.patientId)
        return {
          ...msg,
          sender: {
            type: 'patient' as const,
            id: msg.patientId,
            name: patient?.name || '患者'
          }
        }
      } else if (msg.workerId) {
        const worker = await workerRepo.findById(msg.workerId)
        return {
          ...msg,
          sender: {
            type: 'worker' as const,
            id: msg.workerId,
            name: worker?.name || '医師',
            role: worker?.role
          }
        }
      }
      return {
        ...msg,
        sender: { type: 'system' as const }
      }
    })
  )

  return c.json({ 
    messages: messagesWithSender,
    hasMore: messages.length === limit
  })
})

// メッセージ送信
chat.post('/appointments/:appointmentId/messages', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  const appointmentId = parseInt(c.req.param('appointmentId'))
  const body = await c.req.json()
  const { content, messageType = 'text' } = body

  if (!content) {
    return c.json({ error: 'メッセージ内容が必要です' }, 400)
  }

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const appointmentRepo = factory.createAppointmentRepository()
  const chatRepo = factory.createChatMessageRepository()

  // 予約の存在確認と権限チェック
  const appointment = await appointmentRepo.findById(appointmentId)
  if (!appointment) {
    return c.json({ error: '予約が見つかりません' }, 404)
  }

  // 権限チェック（ハッカソン版では簡易化）
  if (user.userType === 'patient' && appointment.patientId !== user.id) {
    return c.json({ error: 'この予約にメッセージを送信する権限がありません' }, 403)
  }

  // メッセージ作成
  const message = await chatRepo.create({
    appointmentId,
    patientId: user.userType === 'patient' ? user.id : null,
    workerId: user.userType === 'worker' ? user.id : null,
    messageType,
    content,
    sentAt: new Date()
  })

  // 送信者情報を付与して返す
  const senderInfo = user.userType === 'patient' 
    ? { type: 'patient' as const, id: user.id, name: '患者' }
    : { type: 'worker' as const, id: user.id, name: '医師', role: user.role }

  return c.json({
    message: {
      ...message,
      sender: senderInfo
    }
  }, 201)
})

// メッセージを既読にする
chat.put('/messages/:messageId/read', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  const messageId = parseInt(c.req.param('messageId'))

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const chatRepo = factory.createChatMessageRepository()

  // メッセージの存在確認
  const message = await chatRepo.findById(messageId)
  if (!message) {
    return c.json({ error: 'メッセージが見つかりません' }, 404)
  }

  // 既読にできるのは自分宛てのメッセージのみ
  if (user.userType === 'patient') {
    // 患者は医師からのメッセージを既読にできる
    if (message.patientId !== null) {
      return c.json({ error: 'このメッセージを既読にする権限がありません' }, 403)
    }
  } else {
    // 医師は患者からのメッセージを既読にできる
    if (message.workerId !== null) {
      return c.json({ error: 'このメッセージを既読にする権限がありません' }, 403)
    }
  }

  // 既読時刻を更新
  const readAt = new Date()
  await chatRepo.markAsRead(messageId, readAt)

  return c.json({ 
    success: true,
    readAt: readAt.toISOString()
  })
})

// 未読メッセージ数取得
chat.get('/unread-count', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const chatRepo = factory.createChatMessageRepository()

  const unreadCount = await chatRepo.countUnreadForUser(user.id, user.userType)

  return c.json({ unreadCount })
})

export default chat