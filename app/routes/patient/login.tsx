import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getAuthToken } from '../../utils/auth';

// API レスポンス型定義
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    userType: 'patient' | 'worker';
    role?: string;
  };
  error?: string;
}

export function meta() {
  return [
    { title: '患者ログイン - オンライン診療システム' },
    { name: 'description', content: '患者向けログインページ' },
  ];
}

export default function PatientLogin() {
  const navigate = useNavigate();
  const loginType = 'patient'; // 患者固定
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phoneNumber: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    const token = getAuthToken('/patient');
    if (token) {
      navigate('/patient/dashboard');
    }
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // 現在アクセスしているホストを使用
      const apiBaseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : '';

      const endpoint = isRegisterMode
        ? `${apiBaseUrl}/api/auth/${loginType}/register`
        : `${apiBaseUrl}/api/auth/${loginType}/login`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = (await response.json()) as AuthResponse;

      if (response.ok) {
        // ユーザータイプに応じて異なるキーでトークンを保存
        const tokenKey = loginType === 'patient' ? 'patientAccessToken' : 'workerAccessToken';
        const refreshKey = loginType === 'patient' ? 'patientRefreshToken' : 'workerRefreshToken';
        const userKey = loginType === 'patient' ? 'patientUser' : 'workerUser';

        localStorage.setItem(tokenKey, data.accessToken);
        localStorage.setItem(refreshKey, data.refreshToken);
        localStorage.setItem(userKey, JSON.stringify(data.user));

        // 互換性のために従来のキーも更新（最後にログインしたユーザー）
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('userType', loginType);
        localStorage.setItem('userId', data.user.id.toString());

        setMessage('✅ ' + (isRegisterMode ? '登録成功' : 'ログイン成功'));

        // リダイレクト
        setTimeout(() => {
          navigate('/patient/dashboard');
        }, 1000);
      } else {
        setMessage('❌ ' + (data.error || 'エラーが発生しました'));
      }
    } catch {
      setMessage('❌ 接続エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* ヘッダー */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">患者ログイン</h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRegisterMode ? '患者アカウントを新規作成' : '患者アカウントにログイン'}
          </p>
        </div>


        {/* ログインフォーム */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="space-y-4">
              {/* 新規登録時は名前フィールド表示 */}
              {isRegisterMode && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    お名前
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isRegisterMode}
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="山田太郎"
                  />
                </div>
              )}

              {/* メールアドレス */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="patient@example.com"
                />
              </div>

              {/* パスワード */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  パスワード
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              {/* 新規登録時は電話番号フィールド表示 */}
              {isRegisterMode && (
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    電話番号
                  </label>
                  <input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="090-1234-5678"
                  />
                </div>
              )}
            </div>

            {/* メッセージ表示 */}
            {message && (
              <div className="mt-4 p-3 rounded-md bg-gray-50 text-sm text-center">{message}</div>
            )}

            {/* SubmitButton */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : isRegisterMode ? (
                'アカウント作成'
              ) : (
                'ログイン'
              )}
            </button>
          </div>
        </form>

        {/* 登録/ログイン切り替え */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setMessage('');
              setFormData({ email: '', password: '', name: '', phoneNumber: '' });
            }}
            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
          >
            {isRegisterMode
              ? '既にアカウントをお持ちですか？ ログインはこちら'
              : 'アカウントをお持ちでない方はこちら'}
          </button>
        </div>

        {/* デモ用認証情報 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">🔧 デモ用認証情報</h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <div>
              <strong>患者ログイン:</strong> patient@test.com / test1234
            </div>
          </div>
        </div>

        {/* 医療従事者ログインへのリンク */}
        <div className="text-center">
          <a
            href="/worker/login"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            医療従事者の方はこちら →
          </a>
        </div>
      </div>
    </div>
  );
}
