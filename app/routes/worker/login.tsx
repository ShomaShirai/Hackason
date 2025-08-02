import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { ButtonLoading } from '~/components/common/Loading';
import { ErrorMessage } from '~/components/common/ErrorMessage';

export default function WorkerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password, 'worker');
      if (result.success && result.user) {
        // ロールに応じてリダイレクト
        switch (result.user.role) {
          case 'doctor':
            navigate('/worker/doctor/dashboard');
            break;
          case 'operator':
            navigate('/worker/operator/dashboard');
            break;
          case 'admin':
            navigate('/worker/admin/doctors');
            break;
          default:
            navigate('/worker/dashboard');
        }
      } else {
        setError(result.error || 'ログインに失敗しました');
      }
    } catch {
      setError('ログイン処理中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            医療従事者ログイン
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            医師・オペレータ・管理者の方はこちらからログインしてください
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <ErrorMessage
              message={error}
              type="error"
              onClose={() => setError('')}
            />
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <ButtonLoading />
                  <span className="ml-2">ログイン中...</span>
                </>
              ) : (
                'ログイン'
              )}
            </button>
          </div>

          <div className="text-center space-y-2">
            <div>
              <Link
                to="/patient/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                患者としてログインする
              </Link>
            </div>
            <div>
              <Link
                to="/"
                className="font-medium text-gray-600 hover:text-gray-500"
              >
                トップページに戻る
              </Link>
            </div>
          </div>
        </form>

        {/* デモ用ログイン情報 */}
        <div className="mt-8 p-4 bg-yellow-50 rounded-md">
          <p className="text-sm text-yellow-800 font-medium mb-2">
            デモ用ログイン情報
          </p>
          <div className="text-sm text-yellow-700 space-y-1">
            <p><span className="font-medium">医師:</span> doctor@test.com / test1234</p>
            <p><span className="font-medium">オペレータ:</span> operator@test.com / test1234</p>
            <p><span className="font-medium">管理者:</span> admin@test.com / test1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
