import type { QuestionnaireRepository, FindOptions } from '../interfaces'
import type { Questionnaire } from '../../db/schema'

export class MockQuestionnaireRepository implements QuestionnaireRepository {
  private questionnaires: Map<number, any> = new Map()
  private nextId = 1

  constructor(initialData: any[] = []) {
    initialData.forEach(questionnaire => {
      this.questionnaires.set(questionnaire.id, questionnaire)
      if (questionnaire.id >= this.nextId) {
        this.nextId = questionnaire.id + 1
      }
    })
  }

  async findById(id: number) {
    return this.questionnaires.get(id) || null
  }

  async findAll(options?: FindOptions) {
    let results = Array.from(this.questionnaires.values())
    
    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = a[options.orderBy!]
        const bVal = b[options.orderBy!]
        const order = options.orderDirection === 'desc' ? -1 : 1
        return aVal < bVal ? -order : order
      })
    }
    
    if (options?.offset) {
      results = results.slice(options.offset)
    }
    
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }
    
    return results
  }

  async create(data: Partial<Questionnaire>): Promise<Questionnaire> {
    const questionnaire: Questionnaire = {
      id: this.nextId++,
      appointmentId: data.appointmentId!,
      questionsAnswers: data.questionsAnswers!,
      aiSummary: data.aiSummary || null,
      urgencyLevel: data.urgencyLevel || null,
      completedAt: data.completedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.questionnaires.set(questionnaire.id, questionnaire)
    return questionnaire
  }

  async update(id: number, data: Partial<Questionnaire>): Promise<Questionnaire | null> {
    const existing = this.questionnaires.get(id)
    if (!existing) {
      return null
    }
    
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    }
    this.questionnaires.set(id, updated)
    return updated
  }

  async delete(id: number): Promise<boolean> {
    return this.questionnaires.delete(id)
  }

  async findByAppointmentId(appointmentId: number): Promise<Questionnaire | null> {
    return Array.from(this.questionnaires.values())
      .find(q => q.appointmentId === appointmentId) || null
  }

  async updateAnswers(id: number, answers: Record<string, any>): Promise<Questionnaire | null> {
    const existing = this.questionnaires.get(id)
    if (!existing) {
      return null
    }
    
    const currentAnswers = existing.questionsAnswers ? JSON.parse(existing.questionsAnswers as string) : {}
    const updatedAnswers = { ...currentAnswers, ...answers }
    
    return this.update(id, {
      questionsAnswers: JSON.stringify(updatedAnswers)
    })
  }

  async markAsCompleted(id: number): Promise<Questionnaire | null> {
    return this.update(id, {
      completedAt: new Date()
    })
  }
}