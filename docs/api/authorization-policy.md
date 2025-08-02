# 認可ポリシー定義書

## 概要

本書は、オンライン診療システムにおける認可（Authorization）ポリシーを定義します。ハッカソンの本質的な開発に集中できるよう、実装を簡易化しながらも基本的なセキュリティを確保する設計としています。

## 1. 基本方針

### 1.1 ハッカソン向け簡易実装

- **本番環境**: 所属組織、担当関係、時間制限など厳格なアクセス制御が必要
- **ハッカソン版**: シンプルなロールベースアクセス制御（RBAC）で実装
- **拡張性**: 将来的な詳細な権限管理への拡張を考慮した設計

### 1.2 アクセス制御の原則

1. **最小権限の原則**: 必要最小限の権限のみ付与
2. **ロールベース**: ユーザーの役割に基づいた権限管理
3. **データスコープ**: 患者は自分のデータのみ、Workerは全データアクセス可

## 2. ロールと権限

### 2.1 ロール定義

```typescript
enum UserRole {
  PATIENT = 'patient', // 患者
  DOCTOR = 'doctor', // 医師
  OPERATOR = 'operator', // オペレータ
  ADMIN = 'admin', // 管理者
}

// Worker = doctor | operator | admin
type WorkerRole = Exclude<UserRole, 'patient'>;
```

### 2.2 基本権限マトリックス

| リソース               | 患者 (Patient)         | 医師 (Doctor)  | オペレータ (Operator) | 管理者 (Admin) |
| ---------------------- | ---------------------- | -------------- | --------------------- | -------------- |
| **自分のプロフィール** | R/W                    | R/W            | R/W                   | R/W            |
| **他患者情報**         | ❌                     | R              | R                     | R/W            |
| **自分の予約**         | R/W                    | -              | -                     | -              |
| **全予約**             | ❌                     | R/W            | R/W                   | R/W            |
| **自分の診察記録**     | R                      | -              | -                     | -              |
| **全診察記録**         | ❌                     | R/W            | R                     | R/W            |
| **自分の問診票**       | R/W                    | -              | -                     | -              |
| **全問診票**           | ❌                     | R              | R                     | R/W            |
| **処方箋（自分）**     | R                      | -              | -                     | -              |
| **処方箋（全体）**     | ❌                     | R/W            | R                     | R/W            |
| **ビデオ通話**         | 参加（自分の診察のみ） | 参加（全診察） | 参加（全診察）        | 参加（全診察） |
| **チャット（自分）**   | R/W                    | -              | -                     | -              |
| **チャット（全体）**   | ❌                     | R/W            | R/W                   | R/W            |
| **Worker情報**         | R（担当医のみ）        | R              | R                     | R/W            |
| **システム設定**       | ❌                     | ❌             | ❌                    | R/W            |

- R: 読み取り、W: 書き込み、❌: アクセス不可

## 3. データアクセスルール

### 3.1 患者（Patient）のアクセスルール

```typescript
// 患者は自分のIDに関連するデータのみアクセス可能
const patientAccessRule = {
  patients: {
    read: (userId: number, resourceId: number) => userId === resourceId,
    write: (userId: number, resourceId: number) => userId === resourceId,
  },
  appointments: {
    read: (userId: number, appointment: Appointment) => appointment.patientId === userId,
    write: (userId: number, appointment: Appointment) => appointment.patientId === userId,
  },
  medicalRecords: {
    read: (userId: number, record: MedicalRecord) => {
      // 診察記録は関連する予約の患者IDで判定
      return record.appointment.patientId === userId;
    },
    write: false, // 患者は診察記録を編集不可
  },
  // 以下同様のパターン
};
```

### 3.2 Worker共通のアクセスルール

```typescript
// Workerは基本的に全データにアクセス可能
const workerAccessRule = {
  patients: {
    read: true, // 全患者情報を閲覧可能
    write: (role: WorkerRole) => role === 'admin', // 管理者のみ編集可
  },
  appointments: {
    read: true, // 全予約を閲覧可能
    write: true, // 全Workerが予約を管理可能
  },
  medicalRecords: {
    read: true,
    write: (role: WorkerRole) => role === 'doctor' || role === 'admin',
  },
  // 以下同様
};
```

## 4. ビデオ通話の参加権限

### 4.1 基本ルール

- **患者**: 自分の診察のビデオ通話のみ参加可能
- **医師**: すべての診察のビデオ通話に参加可能（担当外でも可）
- **オペレータ**: すべての診察のビデオ通話に参加可能（サポート目的）
- **管理者**: すべての診察のビデオ通話に参加可能

### 4.2 実装例

```typescript
interface VideoSessionAccess {
  canJoin(user: User, appointment: Appointment): boolean;
  canViewRecording(user: User, appointment: Appointment): boolean;
}

class VideoSessionAccessControl implements VideoSessionAccess {
  canJoin(user: User, appointment: Appointment): boolean {
    if (user.role === 'patient') {
      return appointment.patientId === user.id;
    }
    // Worker（医師・オペレータ・管理者）は全て参加可能
    return ['doctor', 'operator', 'admin'].includes(user.role);
  }

  canViewRecording(user: User, appointment: Appointment): boolean {
    // 録画視聴も同じルール
    return this.canJoin(user, appointment);
  }
}
```

## 5. 実装ガイドライン

### 5.1 ミドルウェア実装

```typescript
// Hono用の認可ミドルウェア例
const authorize = (requiredRole?: UserRole | UserRole[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user'); // 認証済みユーザー

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // ロールチェック
    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(user.role)) {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }

    // リソースレベルのチェックは各エンドポイントで実装
    await next();
  };
};

// 使用例
app.get('/api/patients/:id', authorize(), async (c) => {
  const user = c.get('user');
  const patientId = parseInt(c.req.param('id'));

  // 患者は自分の情報のみアクセス可能
  if (user.role === 'patient' && user.id !== patientId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // データ取得処理
});
```

### 5.2 フロントエンド実装

```typescript
// React Context での権限管理
interface AuthContext {
  user: User | null;
  can: (action: string, resource?: any) => boolean;
}

const useAuth = () => {
  const { user } = useContext(AuthContext);

  const can = (action: string, resource?: any) => {
    if (!user) return false;

    // シンプルな権限チェック
    switch (action) {
      case 'viewAllPatients':
        return user.role !== 'patient';

      case 'editMedicalRecord':
        return user.role === 'doctor' || user.role === 'admin';

      case 'joinVideoCall':
        if (user.role === 'patient' && resource) {
          return resource.patientId === user.id;
        }
        return user.role !== 'patient';

      default:
        return false;
    }
  };

  return { user, can };
};
```

## 6. セキュリティ考慮事項

### 6.1 実装時の注意点

1. **SQLインジェクション対策**: Drizzle ORMのクエリビルダーを使用
2. **権限昇格の防止**: ロール変更は管理者のみ
3. **セッション管理**: JWT有効期限とリフレッシュトークン
4. **監査ログ**: 重要な操作は記録（ハッカソンでは簡易実装）

### 6.2 ハッカソン向け簡略化

- 細かい権限設定は省略（例：診療科別アクセス制限）
- 時間ベースの制限は実装しない（例：診察時間外のアクセス制限）
- 組織・部門による制限は実装しない

## 7. 拡張ポイント

ハッカソン参加者が拡張可能な箇所：

1. **家族アクセス機能**
   - 患者の家族がビデオ通話に参加
   - 家族による問診票代理入力

2. **詳細な権限管理**
   - 診療科別のアクセス制限
   - 時間帯によるアクセス制限
   - データの機密レベル設定

3. **承認ワークフロー**
   - 処方箋の承認フロー
   - 診察記録の上級医確認

## まとめ

本認可ポリシーは、ハッカソンの開発効率を重視しつつ、基本的なセキュリティを確保する設計としています。患者は自分の情報のみ、Workerは必要に応じて全情報にアクセスできるシンプルな構造により、参加者は本質的な機能開発に集中できます。
