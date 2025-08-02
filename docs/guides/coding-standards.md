# コーディング標準

## TypeScript

### 基本設定

- **strictモード**: 有効（全てのstrict系オプションを有効化）
- **noUnusedLocals**: true（未使用変数のエラー）
- **noUnusedParameters**: true（未使用パラメータのエラー）

### 型定義のベストプラクティス

```typescript
// ✅ Good: 明示的な型定義
interface UserProfile {
  id: number;
  email: string;
  name: string;
}

// ❌ Bad: any型の使用
const user: any = { id: 1, email: 'test@example.com' };

// ✅ Good: unknownを使用してから型ガード
const data: unknown = await response.json();
if (isUserProfile(data)) {
  // dataはUserProfile型として扱える
}
```

### インポート/エクスポート

```typescript
// ✅ Good: 型のみのインポートは type を使用
import type { UserProfile } from './types';

// ✅ Good: 名前付きエクスポート
export function getUserProfile(): UserProfile {
  // ...
}

// ❌ Bad: デフォルトエクスポート（特別な理由がない限り避ける）
export default function getUserProfile() {
  // ...
}
```

## React

### コンポーネント定義

```typescript
// ✅ Good: 関数コンポーネント + 型定義
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
  return (
    <button onClick={onClick} className={`btn-${variant}`}>
      {children}
    </button>
  );
}
```

### Hooks使用規則

```typescript
// ✅ Good: カスタムフックは use プレフィックス
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return { user, login, logout };
}

// ✅ Good: 依存配列を明示
useEffect(() => {
  fetchData();
}, [userId]); // 依存関係を明確に
```

## API設計

### RESTful設計原則

```typescript
// ✅ Good: RESTfulなエンドポイント
api.get('/api/patients/:id', patientAuthMiddleware(), getPatient);
api.post('/api/appointments', patientAuthMiddleware(), createAppointment);
api.put('/api/appointments/:id', patientAuthMiddleware(), updateAppointment);
api.delete('/api/appointments/:id', patientAuthMiddleware(), cancelAppointment);

// ❌ Bad: 動詞を含むエンドポイント
api.post('/api/getPatient', ...);
api.post('/api/deleteAppointment', ...);
```

### レスポンス形式

```typescript
// ✅ Good: 一貫性のあるレスポンス形式
// 成功時
{
  "data": { /* 実際のデータ */ },
  "status": "success"
}

// エラー時
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "status": "error"
}
```

## エラーハンドリング

### Try-Catch使用

```typescript
// ✅ Good: 適切なエラーハンドリング
try {
  const result = await riskyOperation();
  return c.json({ data: result });
} catch (error) {
  console.error('Operation failed:', error);
  return c.json({ error: 'Internal server error' }, 500);
}

// ❌ Bad: エラーを握りつぶす
try {
  const result = await riskyOperation();
  return result;
} catch {
  // 何もしない
}
```

## コメント規則

```typescript
/**
 * ユーザープロフィールを取得する
 * @param userId - ユーザーID
 * @returns ユーザープロフィール情報
 * @throws {NotFoundError} ユーザーが見つからない場合
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  // 実装
}

// ✅ Good: なぜそうするのかを説明
// Cloudflare Workersではグローバルスコープでsetintervalは使えないため削除

// ❌ Bad: コードをそのまま日本語にしただけ
// userIdをチェックする
if (userId) {
  // ...
}
```

## Git コミットメッセージ

### フォーマット

```
<type>: <subject>

<body>

<footer>
```

### タイプ

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更（空白、フォーマット等）
- `refactor`: バグ修正や機能追加を伴わないコード変更
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 例

```
feat: JWT認証システムの実装

- JWTトークンの生成・検証機能を追加
- 認証ミドルウェアを実装
- パスワードハッシュ化にbcryptjsを使用

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## セキュリティ

### 必須対応事項

1. **入力検証**: 全ての外部入力をZodで検証
2. **SQLインジェクション対策**: Drizzle ORMのプリペアドステートメント使用
3. **XSS対策**: Reactの自動エスケープに依存
4. **CSRF対策**: SameSite Cookieの使用
5. **秘密情報管理**: 環境変数で管理、ハードコード禁止

### 禁止事項

- 実患者データの使用
- パスワードの平文保存
- console.logでの機密情報出力
- evalの使用
- dangerouslySetInnerHTMLの安易な使用