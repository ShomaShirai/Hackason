# PatientContext設計パターン

## 概要

診察データの包括的な管理のため、PatientContextパターンを採用します。このパターンにより、フロントエンド・バックエンド共通のデータアクセス方式を実現し、開発者が直感的に必要なデータを取得できます。

## コンテキストパターンの構造

### 基本コンセプト

```typescript
// 共通インターフェース（フロント・バック共通）
interface PatientContext {
  // 基本情報
  patient: Patient;
  currentAppointment: Appointment;

  // 医療データ
  getMedicalHistory(): Promise<MedicalHistory[]>;
  getCurrentSymptoms(): Promise<Symptom[]>;
  getAllergies(): Promise<Allergy[]>;
  getVitalSigns(): Promise<VitalSigns | null>;

  // 診察関連
  getQuestionnaire(): Promise<Questionnaire>;
  getMedicalRecord(): Promise<MedicalRecord | null>;
  getTranscription(): Promise<TranscriptionLine[]>;
  getPrescriptions(): Promise<Prescription[]>;

  // コミュニケーション
  getMessages(): Promise<Message[]>;
  getCompanions(): Promise<Companion[]>;

  // 医師情報
  getAssignedDoctor(): Promise<Doctor | null>;

  // 統計・分析
  getAISummary(): Promise<AISummary | null>;
  getMedicalEntities(): Promise<MedicalEntity[]>;
}
```

## フロントエンド実装（React Context）

### 1. PatientContextProvider

```tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface PatientContextState {
  patient: Patient | null;
  currentAppointment: Appointment | null;
  medicalHistory: MedicalHistory[];
  questionnaire: Questionnaire | null;
  medicalRecord: MedicalRecord | null;
  transcription: TranscriptionLine[];
  companions: Companion[];
  assignedDoctor: Doctor | null;
  aiSummary: AISummary | null;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
}

interface PatientContextActions {
  // データ取得
  getMedicalHistory: () => Promise<MedicalHistory[]>;
  getCurrentSymptoms: () => Promise<Symptom[]>;
  getAllergies: () => Promise<Allergy[]>;
  getVitalSigns: () => Promise<VitalSigns | null>;
  getQuestionnaire: () => Promise<Questionnaire>;
  getMedicalRecord: () => Promise<MedicalRecord | null>;
  getTranscription: () => Promise<TranscriptionLine[]>;
  getPrescriptions: () => Promise<Prescription[]>;
  getMessages: () => Promise<Message[]>;
  getCompanions: () => Promise<Companion[]>;
  getAssignedDoctor: () => Promise<Doctor | null>;
  getAISummary: () => Promise<AISummary | null>;
  getMedicalEntities: () => Promise<MedicalEntity[]>;

  // データ更新
  updateMedicalRecord: (record: Partial<MedicalRecord>) => Promise<void>;
  addTranscriptionLine: (line: TranscriptionLine) => Promise<void>;
  updateQuestionnaire: (answers: QuestionnaireAnswer[]) => Promise<void>;
}

type PatientContextType = PatientContextState & PatientContextActions;

const PatientContext = createContext<PatientContextType | null>(null);

// カスタムフック
export const usePatientContext = (): PatientContextType => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatientContext must be used within PatientContextProvider');
  }
  return context;
};

// コンテキストプロバイダー
export const PatientContextProvider: React.FC<{
  appointmentId: string;
  children: React.ReactNode;
}> = ({ appointmentId, children }) => {
  const [state, dispatch] = useReducer(patientContextReducer, initialState);

  // 初期データ読み込み
  useEffect(() => {
    loadInitialData(appointmentId);
  }, [appointmentId]);

  // データ取得メソッド実装
  const getMedicalHistory = async (): Promise<MedicalHistory[]> => {
    if (state.medicalHistory.length > 0) {
      return state.medicalHistory;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'medicalHistory', loading: true } });

    try {
      const response = await fetch(`/api/patients/${state.patient?.id}/medical-history`);
      const history = await response.json();

      dispatch({ type: 'SET_MEDICAL_HISTORY', payload: history });
      return history;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'medicalHistory', error: error.message } });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'medicalHistory', loading: false } });
    }
  };

  const getCurrentSymptoms = async (): Promise<Symptom[]> => {
    const questionnaire = await getQuestionnaire();
    const medicalRecord = await getMedicalRecord();

    // 問診回答と診察記録から症状を抽出
    const symptoms: Symptom[] = [];

    // 問診から症状抽出
    if (questionnaire?.answers) {
      const symptomAnswers = questionnaire.answers.filter(
        (answer) => answer.question.type === 'symptom'
      );
      symptoms.push(...extractSymptomsFromAnswers(symptomAnswers));
    }

    // カルテから症状抽出
    if (medicalRecord?.subjective) {
      const extractedSymptoms = await extractSymptomsFromText(medicalRecord.subjective);
      symptoms.push(...extractedSymptoms);
    }

    return symptoms;
  };

  const getQuestionnaire = async (): Promise<Questionnaire> => {
    if (state.questionnaire) {
      return state.questionnaire;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'questionnaire', loading: true } });

    try {
      const response = await fetch(`/api/questionnaire/${appointmentId}`);
      const questionnaire = await response.json();

      dispatch({ type: 'SET_QUESTIONNAIRE', payload: questionnaire });
      return questionnaire;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'questionnaire', error: error.message } });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'questionnaire', loading: false } });
    }
  };

  const getAISummary = async (): Promise<AISummary | null> => {
    if (state.aiSummary) {
      return state.aiSummary;
    }

    const medicalRecord = await getMedicalRecord();
    if (!medicalRecord) {
      return null;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'aiSummary', loading: true } });

    try {
      const response = await fetch(`/api/medical-records/${medicalRecord.id}/summary`);
      const summary = await response.json();

      dispatch({ type: 'SET_AI_SUMMARY', payload: summary });
      return summary;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'aiSummary', error: error.message } });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'aiSummary', loading: false } });
    }
  };

  // その他のメソッド実装...

  const contextValue: PatientContextType = {
    ...state,
    getMedicalHistory,
    getCurrentSymptoms,
    getAllergies,
    getVitalSigns,
    getQuestionnaire,
    getMedicalRecord,
    getTranscription,
    getPrescriptions,
    getMessages,
    getCompanions,
    getAssignedDoctor,
    getAISummary,
    getMedicalEntities,
    updateMedicalRecord,
    addTranscriptionLine,
    updateQuestionnaire,
  };

  return <PatientContext.Provider value={contextValue}>{children}</PatientContext.Provider>;
};
```

### 2. コンテキスト使用例

```tsx
// 診察画面での使用例
const ConsultationScreen: React.FC = () => {
  const {
    patient,
    currentAppointment,
    getMedicalHistory,
    getCurrentSymptoms,
    getAISummary,
    getTranscription,
    addTranscriptionLine,
    loading,
    error,
  } = usePatientContext();

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);

  useEffect(() => {
    const loadConsultationData = async () => {
      try {
        // 並行してデータを取得
        const [symptomsData, summaryData] = await Promise.all([
          getCurrentSymptoms(),
          getAISummary(),
        ]);

        setSymptoms(symptomsData);
        setAiSummary(summaryData);
      } catch (error) {
        console.error('Failed to load consultation data:', error);
      }
    };

    loadConsultationData();
  }, [getCurrentSymptoms, getAISummary]);

  // リアルタイム文字起こし処理
  const handleTranscriptionUpdate = useCallback(
    (transcriptionLine: TranscriptionLine) => {
      addTranscriptionLine(transcriptionLine);
    },
    [addTranscriptionLine]
  );

  return (
    <div className="consultation-screen">
      <Card>
        <CardHeader>
          <CardTitle>{patient?.name}さんの診察</CardTitle>
          <CardDescription>
            {format(new Date(currentAppointment?.scheduledAt), 'yyyy年MM月dd日 HH:mm')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="current-symptoms">
            <TabsList>
              <TabsTrigger value="current-symptoms">現在の症状</TabsTrigger>
              <TabsTrigger value="medical-history">既往歴</TabsTrigger>
              <TabsTrigger value="ai-summary">AIサマリー</TabsTrigger>
            </TabsList>

            <TabsContent value="current-symptoms">
              {loading.symptoms ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <SymptomsList symptoms={symptoms} />
              )}
            </TabsContent>

            <TabsContent value="ai-summary">
              {aiSummary && <AISummaryDisplay summary={aiSummary} />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ビデオ通話・文字起こしコンポーネント */}
      <VideoConsultationComponent onTranscriptionUpdate={handleTranscriptionUpdate} />
    </div>
  );
};
```

## バックエンド実装（Hono + Prisma）

### 1. PatientContextService

```typescript
// services/PatientContextService.ts
import { PrismaClient } from '@prisma/client';

export class PatientContextService {
  constructor(private prisma: PrismaClient) {}

  async createContext(appointmentId: number): Promise<PatientContext> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        questionnaire: true,
        medicalRecord: true,
        meeting: {
          include: {
            transcriptions: true,
          },
        },
        companions: {
          include: {
            companion: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    return new PatientContextImpl(this.prisma, appointment);
  }
}

class PatientContextImpl implements PatientContext {
  constructor(
    private prisma: PrismaClient,
    private appointment: AppointmentWithIncludes
  ) {}

  get patient(): Patient {
    return this.appointment.patient;
  }

  get currentAppointment(): Appointment {
    return this.appointment;
  }

  async getMedicalHistory(): Promise<MedicalHistory[]> {
    const records = await this.prisma.medicalRecord.findMany({
      where: {
        patientId: this.patient.id,
        NOT: { id: this.appointment.medicalRecord?.id },
      },
      include: {
        appointment: true,
        doctor: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records.map((record) => ({
      id: record.id,
      date: record.createdAt,
      doctor: record.doctor.name,
      diagnosis: record.assessment,
      treatment: record.plan,
      subjective: record.subjective,
      objective: record.objective,
    }));
  }

  async getCurrentSymptoms(): Promise<Symptom[]> {
    const symptoms: Symptom[] = [];

    // 問診から症状抽出
    if (this.appointment.questionnaire) {
      const questionnaireSymptoms = await this.extractSymptomsFromQuestionnaire(
        this.appointment.questionnaire
      );
      symptoms.push(...questionnaireSymptoms);
    }

    // カルテから症状抽出
    if (this.appointment.medicalRecord?.subjective) {
      const recordSymptoms = await this.extractSymptomsFromText(
        this.appointment.medicalRecord.subjective
      );
      symptoms.push(...recordSymptoms);
    }

    // 重複除去
    return this.deduplicateSymptoms(symptoms);
  }

  async getAllergies(): Promise<Allergy[]> {
    const patient = await this.prisma.user.findUnique({
      where: { id: this.patient.id },
    });

    if (!patient?.allergies) {
      return [];
    }

    // アレルギー情報をパース（JSON形式で保存されている場合）
    try {
      return JSON.parse(patient.allergies);
    } catch {
      // テキスト形式の場合は分割
      return patient.allergies.split(',').map((allergy) => ({
        name: allergy.trim(),
        severity: 'unknown' as const,
      }));
    }
  }

  async getVitalSigns(): Promise<VitalSigns | null> {
    const record = this.appointment.medicalRecord;
    if (!record?.vitalSigns) {
      return null;
    }

    return record.vitalSigns as VitalSigns;
  }

  async getQuestionnaire(): Promise<Questionnaire> {
    if (!this.appointment.questionnaire) {
      throw new Error('Questionnaire not found for this appointment');
    }

    return {
      id: this.appointment.questionnaire.id,
      questions: this.appointment.questionnaire.questions as Question[],
      answers: this.appointment.questionnaire.answers as QuestionnaireAnswer[],
      status: this.appointment.questionnaire.status,
      completedAt: this.appointment.questionnaire.completedAt,
    };
  }

  async getMedicalRecord(): Promise<MedicalRecord | null> {
    if (!this.appointment.medicalRecord) {
      return null;
    }

    const record = this.appointment.medicalRecord;
    return {
      id: record.id,
      appointmentId: record.appointmentId,
      patientId: record.patientId,
      doctorId: record.doctorId,
      subjective: record.subjective,
      objective: record.objective,
      assessment: record.assessment,
      plan: record.plan,
      vitalSigns: record.vitalSigns as VitalSigns,
      aiSummary: record.aiSummary as AISummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async getTranscription(): Promise<TranscriptionLine[]> {
    if (!this.appointment.meeting) {
      return [];
    }

    return this.appointment.meeting.transcriptions.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      content: t.content,
      timestamp: t.timestampSeconds,
      aiEntities: t.aiEntities as MedicalEntity[],
    }));
  }

  async getAISummary(): Promise<AISummary | null> {
    const record = await this.getMedicalRecord();
    if (!record?.aiSummary) {
      return null;
    }

    return record.aiSummary;
  }

  async getMedicalEntities(): Promise<MedicalEntity[]> {
    const transcription = await this.getTranscription();
    const entities: MedicalEntity[] = [];

    for (const line of transcription) {
      if (line.aiEntities) {
        entities.push(...line.aiEntities);
      }
    }

    return this.deduplicateEntities(entities);
  }

  // ヘルパーメソッド
  private async extractSymptomsFromQuestionnaire(questionnaire: any): Promise<Symptom[]> {
    const answers = questionnaire.answers as QuestionnaireAnswer[];
    const symptoms: Symptom[] = [];

    for (const answer of answers) {
      if (answer.question.category === 'symptom') {
        symptoms.push({
          name: answer.value,
          severity: answer.severity || 'mild',
          duration: answer.duration,
          location: answer.location,
        });
      }
    }

    return symptoms;
  }

  private async extractSymptomsFromText(text: string): Promise<Symptom[]> {
    // AI/NLP サービスを使用して症状を抽出
    // この例では簡単な実装
    const symptomKeywords = ['痛み', '熱', '咳', '頭痛', '腹痛', '発熱', 'だるさ'];
    const symptoms: Symptom[] = [];

    for (const keyword of symptomKeywords) {
      if (text.includes(keyword)) {
        symptoms.push({
          name: keyword,
          severity: 'unknown',
          extractedFrom: 'medicalRecord',
        });
      }
    }

    return symptoms;
  }

  private deduplicateSymptoms(symptoms: Symptom[]): Symptom[] {
    const unique = new Map<string, Symptom>();

    for (const symptom of symptoms) {
      const key = symptom.name.toLowerCase();
      if (!unique.has(key) || symptom.severity !== 'unknown') {
        unique.set(key, symptom);
      }
    }

    return Array.from(unique.values());
  }

  private deduplicateEntities(entities: MedicalEntity[]): MedicalEntity[] {
    const unique = new Map<string, MedicalEntity>();

    for (const entity of entities) {
      const key = `${entity.type}-${entity.value.toLowerCase()}`;
      if (!unique.has(key) || entity.confidence > (unique.get(key)?.confidence || 0)) {
        unique.set(key, entity);
      }
    }

    return Array.from(unique.values());
  }
}
```

### 2. Honoルートでの使用例

```typescript
// routes/consultation.ts
import { Hono } from 'hono';
import { PatientContextService } from '../services/PatientContextService';

const consultation = new Hono();

consultation.get('/api/consultation/:appointmentId', async (c) => {
  const appointmentId = parseInt(c.req.param('appointmentId'));
  const contextService = new PatientContextService(c.env.prisma);

  try {
    const patientContext = await contextService.createContext(appointmentId);

    // 並行してデータを取得
    const [medicalHistory, currentSymptoms, allergies, questionnaire, transcription, aiSummary] =
      await Promise.all([
        patientContext.getMedicalHistory(),
        patientContext.getCurrentSymptoms(),
        patientContext.getAllergies(),
        patientContext.getQuestionnaire(),
        patientContext.getTranscription(),
        patientContext.getAISummary(),
      ]);

    return c.json({
      patient: patientContext.patient,
      appointment: patientContext.currentAppointment,
      medicalHistory,
      currentSymptoms,
      allergies,
      questionnaire,
      transcription,
      aiSummary,
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

consultation.get('/api/consultation/:appointmentId/symptoms', async (c) => {
  const appointmentId = parseInt(c.req.param('appointmentId'));
  const contextService = new PatientContextService(c.env.prisma);

  try {
    const patientContext = await contextService.createContext(appointmentId);
    const symptoms = await patientContext.getCurrentSymptoms();

    return c.json({ symptoms });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default consultation;
```

## 共通型定義

```typescript
// types/PatientContext.ts
export interface Patient {
  id: number;
  name: string;
  email: string;
  phone?: string;
  birthDate?: Date;
  gender?: 'male' | 'female' | 'other';
  bloodType?: 'A' | 'B' | 'O' | 'AB';
  medicalHistory?: string;
  allergies?: string;
}

export interface Symptom {
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  duration?: string;
  location?: string;
  extractedFrom?: 'questionnaire' | 'medicalRecord' | 'transcription';
}

export interface Allergy {
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  reaction?: string;
}

export interface VitalSigns {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  measuredAt?: Date;
}

export interface MedicalEntity {
  type: 'symptom' | 'diagnosis' | 'medication' | 'procedure';
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

export interface AISummary {
  chiefComplaint: string;
  keyFindings: string[];
  diagnosisSuggestion: string;
  treatmentPlan: string;
  followUp: string;
  medicalEntities: MedicalEntity[];
  confidence: number;
  generatedAt: Date;
}

export interface TranscriptionLine {
  id: number;
  speaker: string;
  content: string;
  timestamp: number;
  aiEntities?: MedicalEntity[];
}
```

## 利点とメリット

### 1. 統一されたデータアクセス

- フロント・バック共通のインターフェース
- 一貫したエラーハンドリング
- 型安全性の確保

### 2. パフォーマンス最適化

- 必要なデータのみの取得
- 自動キャッシュ機能
- 並行データ取得

### 3. 開発者体験の向上

- 直感的なAPI設計
- コードの再利用性
- テストしやすい構造

### 4. 拡張性

- 新しいデータソースの追加が容易
- AIサービス統合のシンプル化
- リアルタイムデータ対応

このPatientContextパターンにより、診察データへの包括的かつ効率的なアクセスが可能になり、開発効率と保守性が大幅に向上します。
