# UIコンポーネント戦略

## 概要

本プロジェクトでは、Amazon Chime SDK以外のUIコンポーネントに**shadcn/ui**を第1選択肢として採用します。これにより、モダンで一貫性のあるデザインシステムを構築し、開発効率を向上させます。

## UIライブラリ選択基準

### shadcn/ui採用理由

1. **コピー&ペースト方式**
   - ライブラリ依存を最小化
   - 必要なコンポーネントのみを導入
   - カスタマイズの自由度が高い

2. **Tailwind CSS + Radix UI基盤**
   - アクセシビリティが標準で組み込み
   - WAI-ARIA準拠
   - キーボードナビゲーション対応

3. **TypeScript完全対応**
   - 型安全性の確保
   - 開発時の補完機能

4. **医療システム向け特徴**
   - プロフェッショナルなデザイン
   - カラーコントラスト配慮
   - フォーカス管理の充実

## コンポーネント使い分け

### shadcn/ui使用コンポーネント

```typescript
// 基本UI要素
- Button, Input, Label, Textarea
- Card, Badge, Avatar
- Dialog, Popover, Tooltip
- Select, Checkbox, RadioGroup
- Table, Pagination
- Tabs, Accordion, Collapsible
- Alert, Toast
- Calendar, DatePicker
- Progress, Skeleton

// フォーム関連
- Form (react-hook-form統合)
- Combobox, Command
- Switch, Slider

// レイアウト
- Separator, Scroll Area
- Navigation Menu
- Sheet (サイドバー)

// データ表示
- Data Table (患者一覧、予約管理等)
- Charts (統計情報表示)
```

### Amazon Chime SDK使用箇所

```typescript
// ビデオ通話専用コンポーネント
- MeetingProvider
- VideoTileGrid
- AudioInputControl, VideoInputControl
- MeetingControls (ミュート、カメラ等)
- ContentShare (画面共有)
```

### カスタムコンポーネント

```typescript
// プロジェクト固有のコンポーネント
-PatientCard(患者情報カード) -
  DoctorStatusIndicator(医師状態表示) -
  TimeSlotGrid(差配ボード用) -
  MedicalRecordForm(カルテ入力フォーム) -
  PrescriptionList(処方薬一覧);
```

## 実装例

### 医師差配ボードでのshadcn/ui活用

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 患者カードコンポーネント
const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  return (
    <Card className="w-full cursor-move hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-sm">{patient.name}</CardTitle>
          </div>
          {patient.hasCompanion && (
            <Badge variant="secondary" className="text-xs">
              同伴者
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <Badge variant="outline">{patient.category}</Badge>
          <p className="text-xs text-muted-foreground">⏱ {patient.waitingTime}分待機</p>
          <p className="text-xs">{patient.chiefComplaint}</p>
          {patient.priority === 'urgent' && (
            <Alert className="mt-2">
              <AlertDescription className="text-xs">🚨 長時間待機中</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// 医師カラムコンポーネント
const DoctorColumn: React.FC<DoctorColumnProps> = ({ doctor, timeSlots }) => {
  return (
    <Card className="min-w-[280px]">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(doctor.status)}`} />
          <CardTitle className="text-base">{doctor.name}</CardTitle>
        </div>
        <Badge variant="outline">{doctor.specialty}</Badge>
        <div className="text-sm text-muted-foreground">
          本日: {doctor.todayStats.totalPatients}件 | 平均: {doctor.todayStats.averageTime}分
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {timeSlots.map((slot, index) => (
              <TimeSlotComponent key={index} slot={slot} doctorId={doctor.doctorId} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
```

### ログイン画面でのshadcn/ui活用

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const LoginForm: React.FC = () => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">オンライン診療システム</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>パスワード</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ユーザータイプ</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="patient" id="patient" />
                        <Label htmlFor="patient">患者として</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="doctor" id="doctor" />
                        <Label htmlFor="doctor">医師として</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              ログイン
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
```

### カルテ確認画面でのshadcn/ui活用

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const MedicalRecordView: React.FC<MedicalRecordProps> = ({ record }) => {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>診察記録</CardTitle>
              <p className="text-muted-foreground">
                {format(new Date(record.date), 'yyyy年MM月dd日 HH:mm')}
              </p>
            </div>
            <Badge variant="outline">{record.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="soap" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="soap">SOAP記録</TabsTrigger>
              <TabsTrigger value="transcription">会話記録</TabsTrigger>
              <TabsTrigger value="prescription">処方</TabsTrigger>
              <TabsTrigger value="ai-summary">AIサマリー</TabsTrigger>
            </TabsList>

            <TabsContent value="soap" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">主観的所見 (S)</h4>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm">{record.subjective}</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2">客観的所見 (O)</h4>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm">{record.objective}</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2">評価 (A)</h4>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm">{record.assessment}</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2">計画 (P)</h4>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm">{record.plan}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transcription">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {record.transcription.map((line, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline">{line.speaker}</Badge>
                          <span className="text-xs text-muted-foreground">{line.timestamp}</span>
                        </div>
                        <p className="text-sm">{line.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
```

## セットアップ手順

### 1. shadcn/ui初期化

```bash
# Next.js + TypeScript + Tailwind CSS環境
npx create-next-app@latest online-medical --typescript --tailwind --eslint

# shadcn/ui初期化
npx shadcn-ui@latest init

# 基本コンポーネントのインストール
npx shadcn-ui@latest add button input label card badge avatar
npx shadcn-ui@latest add dialog popover tooltip select form
npx shadcn-ui@latest add table tabs alert scroll-area
```

### 2. tailwind.config.js設定

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // 医療システム用カラーパレット
        medical: {
          primary: 'hsl(var(--medical-primary))',
          secondary: 'hsl(var(--medical-secondary))',
          accent: 'hsl(var(--medical-accent))',
          emergency: 'hsl(var(--medical-emergency))',
          success: 'hsl(var(--medical-success))',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### 3. カスタムCSS変数

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* 医療システム用カラー */
    --medical-primary: 210 40% 20%;
    --medical-secondary: 210 20% 50%;
    --medical-accent: 210 100% 95%;
    --medical-emergency: 0 84% 60%;
    --medical-success: 142 76% 36%;

    /* 待機時間による色分け */
    --wait-normal: 142 76% 36%;
    --wait-warning: 45 93% 47%;
    --wait-urgent: 0 84% 60%;
  }
}

@layer components {
  .patient-card-urgent {
    @apply border-medical-emergency bg-red-50;
  }

  .doctor-status-online {
    @apply bg-medical-success;
  }

  .doctor-status-consultation {
    @apply bg-yellow-500;
  }

  .doctor-status-offline {
    @apply bg-medical-emergency;
  }
}
```

## アクセシビリティ考慮

### キーボードナビゲーション

```tsx
// ドラッグ&ドロップのキーボード代替操作
const KeyboardAssignment: React.FC = () => {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        // 選択/配置実行
        break;
      case 'Escape':
        // 操作キャンセル
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // フォーカス移動
        break;
    }
  };

  return (
    <div role="grid" aria-label="医師差配ボード" onKeyDown={handleKeyDown}>
      {/* グリッド内容 */}
    </div>
  );
};
```

### スクリーンリーダー対応

```tsx
// ARIA属性の適切な設定
<Card
  role="article"
  aria-labelledby={`patient-${patient.id}`}
  aria-describedby={`patient-details-${patient.id}`}
>
  <CardHeader>
    <CardTitle id={`patient-${patient.id}`}>{patient.name}</CardTitle>
  </CardHeader>
  <CardContent id={`patient-details-${patient.id}`}>
    <p aria-label={`診療科: ${patient.category}`}>{patient.category}</p>
    <p aria-label={`待ち時間: ${patient.waitingTime}分`}>{patient.waitingTime}分待機</p>
  </CardContent>
</Card>
```

## レスポンシブデザイン

```tsx
// Tailwind CSSのレスポンシブクラスを活用
const ResponsiveLayout: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      {/* モバイル: 縦積み、デスクトップ: 横並び */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* 待機患者リスト */}
        <div className="w-full lg:w-1/4">
          <Card className="h-full">{/* 内容 */}</Card>
        </div>

        {/* 医師差配エリア */}
        <div className="w-full lg:w-3/4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 医師カラム */}
          </div>
        </div>
      </div>
    </div>
  );
};
```

## パフォーマンス最適化

### 遅延読み込み

```tsx
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// 重いコンポーネントの遅延読み込み
const AssignmentBoard = lazy(() => import('./AssignmentBoard'));

const DashboardPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AssignmentBoard />
    </Suspense>
  );
};
```

## まとめ

shadcn/uiを採用することで：

1. **一貫したデザインシステム**の構築
2. **アクセシビリティ標準**の自動確保
3. **TypeScript完全対応**による型安全性
4. **カスタマイズ性**と**保守性**の両立
5. **医療システム**に適したプロフェッショナルなUI

Amazon Chime SDKとの組み合わせにより、ビデオ通話機能と一般的なUIコンポーネントを適切に分離し、メンテナンスしやすいアーキテクチャを実現します。
