'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface User {
  id: number;
  email: string;
  userType: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // ローカルストレージからユーザー情報を取得
    const authToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');

    if (!authToken || !userData) {
      // 未ログインの場合はログインページへ
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <Button onClick={handleLogout} variant="outline">
            ログアウト
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ようこそ！</CardTitle>
            <CardDescription>オンライン診療システムへログインしました</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <span className="font-semibold">ユーザーID:</span> {user.id}
              </p>
              <p>
                <span className="font-semibold">メールアドレス:</span> {user.email}
              </p>
              <p>
                <span className="font-semibold">ユーザータイプ:</span> {user.userType}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>診察予約</CardTitle>
              <CardDescription>新規予約の作成</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">予約する</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>予約履歴</CardTitle>
              <CardDescription>過去の診察履歴</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                履歴を見る
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ビデオ通話</CardTitle>
              <CardDescription>オンライン診察開始</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                通話を開始
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
