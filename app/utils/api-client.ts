/**
 * 型安全なAPIクライアント
 */

import type { ApiError } from '../types/api';
import { getAuthToken } from './auth';

export class ApiException extends Error {
  constructor(
    public statusCode: number,
    public error: ApiError,
    message?: string
  ) {
    super(message || error.error);
    this.name = 'ApiException';
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * 型安全なfetchラッパー
 */
export async function fetchApi<T>(
  url: string,
  options?: FetchOptions
): Promise<T> {
  const { params, ...fetchOptions } = options || {};

  // URLパラメータの追加
  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    finalUrl = `${url}?${searchParams.toString()}`;
  }

  // トークンの取得 (URLに基づいて適切なトークンを自動選択)
  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  // ヘッダーの設定
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(finalUrl, {
      ...fetchOptions,
      headers,
    });

    // エラーレスポンスの処理
    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      throw new ApiException(response.status, errorData);
    }

    // 204 No Contentの場合
    if (response.status === 204) {
      return {} as T;
    }

    // JSONレスポンスのパース
    const data = await response.json();
    return data as T;
  } catch (error) {
    // ネットワークエラーなど
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException(0, {
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET リクエスト
 */
export function get<T>(url: string, params?: Record<string, any>): Promise<T> {
  return fetchApi<T>(url, { method: 'GET', params });
}

/**
 * POST リクエスト
 */
export function post<T>(url: string, body?: any): Promise<T> {
  return fetchApi<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT リクエスト
 */
export function put<T>(url: string, body?: any): Promise<T> {
  return fetchApi<T>(url, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE リクエスト
 */
export function del<T>(url: string): Promise<T> {
  return fetchApi<T>(url, { method: 'DELETE' });
}

/**
 * PATCH リクエスト
 */
export function patch<T>(url: string, body?: any): Promise<T> {
  return fetchApi<T>(url, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}
