# 医師差配ボード画面仕様書

## 概要

オペレータが医師と患者のマッチングを視覚的に管理するためのTrelloライクなカンバンボード画面です。ドラッグ&ドロップで直感的に患者を医師の時間枠に割り当てることができます。

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────────┐
│  医師差配ボード                      2025/01/27（月）    [< >]  │
├────────────────────────────────────────────────────────────────┤
│  待機患者 (8)     │ 田中医師(内科) │ 鈴木医師(皮膚科) │ 佐藤医師(内科) │
│                   │   🟢 診察可    │   🟡 診察中      │   🔴 離席中    │
├───────────────────┼────────────────┼─────────────────┼────────────────┤
│                   │  10:00-10:30   │  10:00-10:30    │  10:00-10:30   │
│ ┌───────────┐    │ ┌────────────┐ │  ┌────────────┐ │                │
│ │👤 山田太郎  │    │ │👤 高橋花子   │ │  │👤 渡辺次郎  │ │                │
│ │ 🏥 内科    │    │ │ 🏥 内科      │ │  │ 🏥 皮膚科   │ │                │
│ │ ⏱ 15分待ち │    │ │ ✅ 診察中    │ │  │ 🕐 診察中   │ │                │
│ │ 📝 頭痛    │    │ └────────────┘ │  └────────────┘ │                │
│ └───────────┘    ├────────────────┼─────────────────┼────────────────┤
│                   │  10:30-11:00   │  10:30-11:00    │  10:30-11:00   │
│ ┌───────────┐    │                │  ┌────────────┐ │                │
│ │👤 伊藤美咲  │    │                │  │👤 中村健一  │ │                │
│ │ 🏥 皮膚科  │    │                │  │ 🏥 皮膚科   │ │                │
│ │ ⏱ 30分待ち │    │                │  │ 📅 予約済   │ │                │
│ │ 📝 発疹    │    │                │  └────────────┘ │                │
│ └───────────┘    ├────────────────┼─────────────────┼────────────────┤
│                   │  11:00-11:30   │  11:00-11:30    │  11:00-11:30   │
│ ┌───────────┐    │ ┌ ─ ─ ─ ─ ─ ┐ │                │                │
│ │👤 木村一郎  │    │ │ 空き時間   │ │                │                │
│ │ 🏥 内科    │    │ └ ─ ─ ─ ─ ─ ┘ │                │                │
│ │ ⏱ 45分待ち │    ├────────────────┼─────────────────┼────────────────┤
│ │ 🚨 長時間  │    │  11:30-12:00   │  11:30-12:00    │  11:30-12:00   │
│ └───────────┘    │                │                │                │
│                   │                │                │                │
│ [もっと見る...]   │                │                │                │
└───────────────────┴────────────────┴─────────────────┴────────────────┘

凡例: 🟢 オンライン | 🟡 診察中 | 🔴 離席/オフライン | 🚨 要注意
```

## 機能仕様

### 1. ドラッグ&ドロップ機能

#### 基本動作

- 待機患者カードを医師の時間枠にドラッグして割り当て
- 既に割り当てられた患者を別の医師/時間枠に移動
- ドラッグ中は配置可能な枠がハイライト表示

#### 制約条件

- 医師の専門分野と患者の症状カテゴリがマッチする場合のみ配置可能
- 既に診察中/完了の枠には配置不可
- オフライン医師の枠には配置不可

### 2. 待機患者リスト

#### 表示内容

```typescript
interface WaitingPatient {
  id: number;
  name: string;
  category: string; // 診療科
  waitingTime: number; // 待ち時間（分）
  priority: 'normal' | 'urgent' | 'emergency';
  chiefComplaint: string; // 主訴
  hasCompanion: boolean; // 同伴者有無
}
```

#### ソート機能

- 待ち時間順（デフォルト）
- 優先度順
- 診療科別

#### フィルタ機能

- 診療科でフィルタ
- 優先度でフィルタ
- 同伴者有無でフィルタ

### 3. 医師カラム

#### ヘッダー情報

```typescript
interface DoctorColumn {
  doctorId: number;
  name: string;
  specialty: string;
  status: 'online' | 'in_consultation' | 'offline';
  currentPatient?: {
    name: string;
    remainingTime: number;
  };
  todayStats: {
    totalPatients: number;
    averageTime: number;
  };
}
```

#### タイムスロット

```typescript
interface TimeSlot {
  startTime: string; // "10:00"
  endTime: string; // "10:30"
  status: 'available' | 'occupied' | 'blocked';
  appointment?: {
    patientId: number;
    patientName: string;
    status: 'scheduled' | 'in_progress' | 'completed';
    actualStartTime?: string;
  };
}
```

### 4. リアルタイム更新

#### WebSocket通信

```typescript
// 差配情報の更新
ws.send({
  type: 'assignment_update',
  data: {
    appointmentId: 123,
    doctorId: 456,
    timeSlot: '10:00-10:30',
    operatorId: 789,
  },
});

// リアルタイム状態更新の受信
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'doctor_status_changed':
      updateDoctorStatus(data);
      break;
    case 'patient_added':
      addWaitingPatient(data);
      break;
    case 'consultation_started':
      updateTimeSlot(data);
      break;
  }
};
```

### 5. 操作機能

#### コンテキストメニュー（右クリック）

- 患者詳細表示
- 優先度変更
- 診察キャンセル
- 医師への連絡

#### 一括操作

- 複数患者の選択
- 一括差配
- 自動最適配置提案

## React実装例

### メインコンポーネント

```tsx
import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface DoctorAssignmentBoardProps {
  date: Date;
}

const DoctorAssignmentBoard: React.FC<DoctorAssignmentBoardProps> = ({ date }) => {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [doctors, setDoctors] = useState<DoctorColumn[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[][]>([]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="assignment-board">
        <BoardHeader date={date} />
        <div className="board-content">
          <WaitingPatientsList patients={waitingPatients} onPatientDrop={handlePatientDrop} />
          <div className="doctors-grid">
            {doctors.map((doctor, index) => (
              <DoctorColumn
                key={doctor.doctorId}
                doctor={doctor}
                timeSlots={timeSlots[index]}
                onSlotDrop={handleSlotDrop}
              />
            ))}
          </div>
        </div>
      </div>
    </DndProvider>
  );
};
```

### 患者カードコンポーネント

```tsx
import { useDrag } from 'react-dnd';

interface PatientCardProps {
  patient: WaitingPatient;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'patient',
    item: { patient },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`patient-card ${isDragging ? 'dragging' : ''} 
                  ${patient.priority === 'urgent' ? 'urgent' : ''}`}
    >
      <div className="patient-header">
        <span className="patient-name">👤 {patient.name}</span>
        {patient.hasCompanion && <span className="companion-icon">👥</span>}
      </div>
      <div className="patient-info">
        <span className="category">🏥 {patient.category}</span>
        <span className="waiting-time">⏱ {patient.waitingTime}分待ち</span>
      </div>
      <div className="chief-complaint">📝 {patient.chiefComplaint}</div>
      {patient.priority === 'urgent' && <div className="alert">🚨 長時間待機</div>}
    </div>
  );
};
```

### タイムスロットコンポーネント

```tsx
import { useDrop } from 'react-dnd';

interface TimeSlotProps {
  slot: TimeSlot;
  doctorId: number;
  doctorSpecialty: string;
  onDrop: (patient: WaitingPatient, slotTime: string) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ slot, doctorId, doctorSpecialty, onDrop }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'patient',
    canDrop: (item: { patient: WaitingPatient }) => {
      // 専門分野のマッチングチェック
      return canAssignPatient(item.patient, doctorSpecialty, slot);
    },
    drop: (item: { patient: WaitingPatient }) => {
      onDrop(item.patient, slot.startTime);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const getSlotClassName = () => {
    let className = 'time-slot';
    if (slot.status === 'occupied') className += ' occupied';
    if (slot.status === 'blocked') className += ' blocked';
    if (isOver && canDrop) className += ' drop-target';
    if (isOver && !canDrop) className += ' drop-forbidden';
    return className;
  };

  return (
    <div ref={drop} className={getSlotClassName()}>
      <div className="slot-time">
        {slot.startTime}-{slot.endTime}
      </div>
      {slot.appointment ? (
        <PatientCard
          patient={{
            id: slot.appointment.patientId,
            name: slot.appointment.patientName,
            // ... other patient data
          }}
        />
      ) : (
        <div className="empty-slot">{slot.status === 'available' ? '空き時間' : 'ブロック'}</div>
      )}
    </div>
  );
};
```

## スタイル定義（CSS）

```scss
.assignment-board {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;

  .board-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .waiting-patients-list {
    width: 300px;
    background: white;
    border-right: 1px solid #ddd;
    overflow-y: auto;
    padding: 16px;

    .patient-card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: move;
      transition: all 0.2s;

      &:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      &.dragging {
        opacity: 0.5;
      }

      &.urgent {
        border-color: #ff6b6b;
        background: #fff5f5;
      }
    }
  }

  .doctors-grid {
    flex: 1;
    display: flex;
    overflow-x: auto;
    padding: 16px;
    gap: 16px;

    .doctor-column {
      min-width: 280px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      .doctor-header {
        padding: 16px;
        border-bottom: 1px solid #eee;

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;

          &.online {
            background: #51cf66;
          }
          &.in-consultation {
            background: #ffd43b;
          }
          &.offline {
            background: #ff6b6b;
          }
        }
      }

      .time-slots {
        padding: 8px;

        .time-slot {
          min-height: 120px;
          border: 2px dashed #ddd;
          border-radius: 8px;
          margin-bottom: 8px;
          padding: 8px;
          transition: all 0.2s;

          &.drop-target {
            border-color: #51cf66;
            background: #f0f9ff;
          }

          &.drop-forbidden {
            border-color: #ff6b6b;
            background: #fff5f5;
          }

          &.occupied {
            border-style: solid;
            border-color: #94d3ac;
          }

          &.blocked {
            background: #f8f9fa;
            border-color: #adb5bd;
          }
        }
      }
    }
  }
}
```

## API連携

### 差配登録API

```typescript
// 患者を医師の時間枠に割り当て
POST /api/admin/assign-doctor
{
  "appointmentId": 123,
  "doctorId": 456,
  "timeSlot": "10:00-10:30",
  "reason": "専門分野マッチング"
}

// レスポンス
{
  "success": true,
  "assignment": {
    "id": 789,
    "appointmentId": 123,
    "doctorId": 456,
    "scheduledAt": "2025-01-27T10:00:00Z"
  }
}
```

### リアルタイムデータ取得

```typescript
// 差配ボードの初期データ取得
GET /api/admin/assignment-board?date=2025-01-27

// レスポンス
{
  "waitingPatients": [...],
  "doctors": [...],
  "assignments": [...],
  "timeSlots": [...]
}
```

## アクセシビリティ考慮

- キーボード操作対応（矢印キーで選択、Enterで配置）
- スクリーンリーダー対応（ARIA属性）
- 色覚異常対応（色だけでなくアイコンでも状態表示）

## パフォーマンス最適化

- 仮想スクロールで大量の患者リスト対応
- WebSocketで差分更新
- React.memoで不要な再レンダリング防止

## エラーハンドリング

- ドロップ失敗時のフィードバック
- ネットワークエラー時の再試行
- 競合発生時の解決（楽観的UI更新 + サーバー同期）
