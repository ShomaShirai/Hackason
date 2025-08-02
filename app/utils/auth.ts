/**
 * 認証トークンのローカルストレージキー定数
 */
export const AUTH_TOKEN_KEYS = {
  PATIENT: 'patientAccessToken',
  WORKER: 'workerAccessToken',
  PATIENT_USER: 'patientUser',
  WORKER_USER: 'workerUser',
  USER_TYPE: 'userType'
} as const;

/**
 * 現在のパスに基づいて適切な認証トークンを取得
 */
export function getAuthToken(pathname?: string): string | null {
  const currentPath = pathname || window.location.pathname;

  if (currentPath.startsWith('/patient')) {
    return localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT);
  } else if (currentPath.startsWith('/worker')) {
    return localStorage.getItem(AUTH_TOKEN_KEYS.WORKER);
  }

  // デフォルトは最後にログインしたユーザータイプに基づいて判定
  const userType = localStorage.getItem(AUTH_TOKEN_KEYS.USER_TYPE) as 'patient' | 'worker' | null;
  if (userType === 'patient') {
    return localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT);
  } else if (userType === 'worker') {
    return localStorage.getItem(AUTH_TOKEN_KEYS.WORKER);
  }

  return null;
}

/**
 * ワーカー（医療従事者）の認証トークンを取得
 */
export function getWorkerAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEYS.WORKER);
}

/**
 * 患者の認証トークンを取得
 */
export function getPatientAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT);
}

/**
 * 認証トークンの存在確認（デバッグ用）
 */
export function getAuthTokenStatus(): {
  patientToken: boolean;
  workerToken: boolean;
  currentPath: string;
  detectedUserType: 'patient' | 'worker' | 'unknown';
} {
  const currentPath = window.location.pathname;
  let detectedUserType: 'patient' | 'worker' | 'unknown' = 'unknown';

  if (currentPath.startsWith('/patient')) {
    detectedUserType = 'patient';
  } else if (currentPath.startsWith('/worker')) {
    detectedUserType = 'worker';
  }

  return {
    patientToken: !!localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT),
    workerToken: !!localStorage.getItem(AUTH_TOKEN_KEYS.WORKER),
    currentPath,
    detectedUserType
  };
}

/**
 * 現在のパスに基づいて適切なユーザー情報を取得
 */
export function getCurrentUser(pathname?: string): any | null {
  const currentPath = pathname || window.location.pathname;

  if (currentPath.startsWith('/patient')) {
    const userStr = localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT_USER);
    return userStr ? JSON.parse(userStr) : null;
  } else if (currentPath.startsWith('/worker')) {
    const userStr = localStorage.getItem(AUTH_TOKEN_KEYS.WORKER_USER);
    return userStr ? JSON.parse(userStr) : null;
  }

  // デフォルトは最後にログインしたユーザー
  const userType = localStorage.getItem(AUTH_TOKEN_KEYS.USER_TYPE) as 'patient' | 'worker' | null;
  if (userType === 'patient') {
    const userStr = localStorage.getItem(AUTH_TOKEN_KEYS.PATIENT_USER);
    return userStr ? JSON.parse(userStr) : null;
  } else if (userType === 'worker') {
    const userStr = localStorage.getItem(AUTH_TOKEN_KEYS.WORKER_USER);
    return userStr ? JSON.parse(userStr) : null;
  }

  return null;
}
