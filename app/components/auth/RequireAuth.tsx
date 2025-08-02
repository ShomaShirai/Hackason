import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { Loading } from '~/components/common/Loading';

interface RequireAuthProps {
  children: React.ReactNode;
  userType?: 'patient' | 'worker';
  redirectTo?: string;
}

/**
 * 認証が必要なルートを保護するコンポーネント
 */
export function RequireAuth({ 
  children, 
  userType,
  redirectTo = '/login' 
}: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 認証状態を確認中
  if (isLoading) {
    return <Loading fullScreen message="認証状態を確認中..." />;
  }

  // 未認証の場合
  if (!user) {
    // 現在のパスを保存してログイン後にリダイレクト
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // ユーザータイプが指定されていて、一致しない場合
  if (userType && user.userType !== userType) {
    // 適切なダッシュボードにリダイレクト
    const redirectPath = user.userType === 'patient' 
      ? '/patient' 
      : user.role === 'doctor' 
        ? '/worker/doctor/dashboard'
        : user.role === 'operator'
        ? '/worker/operator/dashboard'
        : '/worker/admin/doctors';
    
    return <Navigate to={redirectPath} replace />;
  }

  // 認証済みかつ条件を満たす場合は子要素を表示
  return <>{children}</>;
}

/**
 * 特定のロールが必要なルートを保護するコンポーネント
 */
interface RequireRoleProps {
  children: React.ReactNode;
  roles: Array<'doctor' | 'operator' | 'admin'>;
  redirectTo?: string;
}

export function RequireRole({ 
  children, 
  roles,
  redirectTo = '/worker/login' 
}: RequireRoleProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 認証状態を確認中
  if (isLoading) {
    return <Loading fullScreen message="認証状態を確認中..." />;
  }

  // 未認証の場合
  if (!user) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // 医療従事者でない場合
  if (user.userType !== 'worker') {
    return <Navigate to="/patient" replace />;
  }

  // 必要なロールを持っていない場合
  if (!user.role || !roles.includes(user.role)) {
    // アクセス拒否ページまたはダッシュボードにリダイレクト
    const defaultPath = user.role === 'doctor' 
      ? '/worker/doctor/dashboard'
      : user.role === 'operator'
      ? '/worker/operator/dashboard'
      : '/worker/admin/doctors';
    
    return <Navigate to={defaultPath} replace />;
  }

  // 認証済みかつロール条件を満たす場合は子要素を表示
  return <>{children}</>;
}

/**
 * 患者専用ルートの保護
 */
export function RequirePatient({ children }: { children: React.ReactNode }) {
  return <RequireAuth userType="patient" redirectTo="/patient/login">{children}</RequireAuth>;
}

/**
 * 医療従事者専用ルートの保護
 */
export function RequireWorker({ children }: { children: React.ReactNode }) {
  return <RequireAuth userType="worker" redirectTo="/worker/login">{children}</RequireAuth>;
}

/**
 * 医師専用ルートの保護
 */
export function RequireDoctor({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={['doctor']}>{children}</RequireRole>;
}

/**
 * オペレータ専用ルートの保護
 */
export function RequireOperator({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={['operator']}>{children}</RequireRole>;
}

/**
 * 管理者専用ルートの保護
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={['admin']}>{children}</RequireRole>;
}