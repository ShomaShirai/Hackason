import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { getAuthToken, getCurrentUser, AUTH_TOKEN_KEYS } from '../utils/auth';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  userType: 'patient' | 'worker';
  role?: 'doctor' | 'operator' | 'admin';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, userType: 'patient' | 'worker') => Promise<{
    success: boolean;
    user?: AuthUser;
    error?: string;
  }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // パスに基づいてユーザータイプを決定
      const isPatientPath = location.pathname.startsWith('/patient');
      const isWorkerPath = location.pathname.startsWith('/worker');

      // 適切なトークンとユーザーデータを取得
      const token = getAuthToken(location.pathname);
      const userData = getCurrentUser(location.pathname);

      // ユーザータイプの決定
      let userType: 'patient' | 'worker' | null = null;
      if (isPatientPath) {
        userType = 'patient';
      } else if (isWorkerPath) {
        userType = 'worker';
      } else {
        // デフォルトは最後にログインしたユーザー
        userType = localStorage.getItem(AUTH_TOKEN_KEYS.USER_TYPE) as 'patient' | 'worker' | null;
      }

      if (!token || !userType) {
        setIsLoading(false);
        return;
      }

      try {
        const endpoint = userType === 'patient' ? '/api/patient/profile' : '/api/worker/profile';
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const profileData = await response.json() as any;
          setUser({
            ...profileData,
            userType,
          });
        } else if (userData) {
          // プロファイル取得に失敗しても、保存されたユーザーデータを使用
          setUser({
            ...userData,
            userType,
          });
        } else {
          // Token無効、クリア
          if (isPatientPath) {
            localStorage.removeItem('patientAccessToken');
            localStorage.removeItem('patientUser');
          } else if (isWorkerPath) {
            localStorage.removeItem('workerAccessToken');
            localStorage.removeItem('workerUser');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // エラーが発生しても、保存されたユーザーデータがあれば使用
        if (userData) {
          setUser({
            ...userData,
            userType,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  const login = async (email: string, password: string, userType: 'patient' | 'worker') => {
    try {
      const endpoint = userType === 'patient' ? '/api/auth/patient/login' : '/api/auth/worker/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json() as any;

      if (response.ok && data.accessToken) {
        // ユーザータイプに応じて異なるキーでトークンを保存
        const tokenKey = userType === 'patient' ? 'patientAccessToken' : 'workerAccessToken';
        const userKey = userType === 'patient' ? 'patientUser' : 'workerUser';

        localStorage.setItem(tokenKey, data.accessToken);
        localStorage.setItem(userKey, JSON.stringify(data.user));

        // 互換性のために従来のキーも更新
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('userType', userType);

        const user: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          userType,
          role: data.user.role,
        };

        setUser(user);
        return { success: true, user };
      } else {
        return { success: false, error: data.error || 'ログインに失敗しました' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'ログイン処理中にエラーが発生しました' };
    }
  };

  const logout = () => {
    // 現在のパスに基づいて適切なトークンをクリア
    const isPatientPath = location.pathname.startsWith('/patient');
    const isWorkerPath = location.pathname.startsWith('/worker');

    if (isPatientPath) {
      localStorage.removeItem('patientAccessToken');
      localStorage.removeItem('patientRefreshToken');
      localStorage.removeItem('patientUser');
    } else if (isWorkerPath) {
      localStorage.removeItem('workerAccessToken');
      localStorage.removeItem('workerRefreshToken');
      localStorage.removeItem('workerUser');
    }

    // 互換性のためのキーもクリア（現在のユーザータイプのみ）
    if (user?.userType === 'patient' && isPatientPath) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
    } else if (user?.userType === 'worker' && isWorkerPath) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
    }

    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
