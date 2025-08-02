import type { ChatMessage, ChatMessageRepository } from '../interfaces'

export class MockChatMessageRepository implements ChatMessageRepository {
  private messages: ChatMessage[]

  constructor(initialData: any[] = []) {
    this.messages = initialData
  }

  async findById(id: number): Promise<ChatMessage | null> {
    return this.messages.find(msg => msg.id === id) || null
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<ChatMessage[]> {
    let result = [...this.messages]
    
    // ソート（新しい順）
    result.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    
    if (options?.offset) {
      result = result.slice(options.offset)
    }
    
    if (options?.limit) {
      result = result.slice(0, options.limit)
    }
    
    return result
  }

  async findByAppointmentId(
    appointmentId: number, 
    options?: { limit?: number; offset?: number }
  ): Promise<ChatMessage[]> {
    let result = this.messages.filter(msg => msg.appointmentId === appointmentId)
    
    // ソート（古い順）
    result.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    
    if (options?.offset) {
      result = result.slice(options.offset)
    }
    
    if (options?.limit) {
      result = result.slice(0, options.limit)
    }
    
    return result
  }

  async create(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: this.messages.length + 1,
      appointmentId: data.appointmentId!,
      patientId: data.patientId || null,
      workerId: data.workerId || null,
      messageType: data.messageType || 'text',
      content: data.content!,
      sentAt: data.sentAt || new Date(),
      readAt: data.readAt || null,
      createdAt: new Date(),
    }
    
    this.messages.push(newMessage)
    return newMessage
  }

  async update(id: number, data: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const index = this.messages.findIndex(msg => msg.id === id)
    if (index === -1) {
      return null
    }
    
    this.messages[index] = { ...this.messages[index], ...data }
    return this.messages[index]
  }

  async delete(id: number): Promise<boolean> {
    const index = this.messages.findIndex(msg => msg.id === id)
    if (index === -1) {
      return false
    }
    
    this.messages.splice(index, 1)
    return true
  }

  async markAsRead(messageId: number, readAt: Date): Promise<ChatMessage | null> {
    const message = await this.findById(messageId)
    if (!message) {
      return null
    }
    
    message.readAt = readAt
    return message
  }

  async countUnreadForUser(_userId: number, userType: 'patient' | 'worker'): Promise<number> {
    return this.messages.filter(msg => {
      // 未読メッセージ
      if (msg.readAt) {return false}
      
      // 自分宛てのメッセージ
      if (userType === 'patient') {
        // 患者の場合、医師からのメッセージが対象
        return msg.workerId !== null && msg.patientId === null
      } else {
        // 医師の場合、患者からのメッセージが対象
        return msg.patientId !== null && msg.workerId === null
      }
    }).length
  }
}