import React from 'react';

interface NotificationBadgeProps {
  /** 通知数 */
  count: number;
  /** 最大表示数（これを超えると+表示） */
  maxCount?: number;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** 色 */
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'gray';
  /** パルスアニメーション */
  pulse?: boolean;
  /** ドット表示（数値を表示しない） */
  dot?: boolean;
}

export function NotificationBadge({
  count,
  maxCount = 99,
  size = 'medium',
  color = 'red',
  pulse = false,
  dot = false,
}: NotificationBadgeProps) {
  // カウントが0の場合は表示しない
  if (count <= 0 && !dot) {
    return null;
  }

  const sizeClasses = {
    small: dot ? 'h-2 w-2' : 'h-5 min-w-[1.25rem] text-xs px-1.5',
    medium: dot ? 'h-2.5 w-2.5' : 'h-6 min-w-[1.5rem] text-xs px-2',
    large: dot ? 'h-3 w-3' : 'h-7 min-w-[1.75rem] text-sm px-2.5',
  };

  const colorClasses = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    gray: 'bg-gray-500',
  };

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <span className="relative inline-flex">
      <span
        className={`
          inline-flex items-center justify-center 
          ${sizeClasses[size]}
          ${colorClasses[color]}
          ${dot ? 'rounded-full' : 'rounded-full text-white font-medium'}
        `}
      >
        {!dot && displayCount}
      </span>
      {pulse && (
        <span
          className={`
            absolute inset-0 
            ${dot ? 'rounded-full' : 'rounded-full'}
            ${colorClasses[color]}
            opacity-75 animate-ping
          `}
        />
      )}
    </span>
  );
}

/**
 * アイコン付き通知バッジ（ベルアイコンなどと組み合わせて使用）
 */
interface IconWithBadgeProps {
  /** アイコン要素 */
  children: React.ReactNode;
  /** 通知数 */
  count: number;
  /** バッジの位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** バッジのプロパティ */
  badgeProps?: Omit<NotificationBadgeProps, 'count'>;
}

export function IconWithBadge({
  children,
  count,
  position = 'top-right',
  badgeProps = {},
}: IconWithBadgeProps) {
  const positionClasses = {
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1',
  };

  return (
    <div className="relative inline-flex">
      {children}
      {count > 0 && (
        <div className={`absolute ${positionClasses[position]}`}>
          <NotificationBadge count={count} {...badgeProps} />
        </div>
      )}
    </div>
  );
}

/**
 * 通知リストアイテム（通知一覧で使用）
 */
interface NotificationItemProps {
  /** 通知タイトル */
  title: string;
  /** 通知内容 */
  message: string;
  /** 通知時刻 */
  time: string;
  /** 既読状態 */
  isRead?: boolean;
  /** 通知タイプ */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** クリックアクション */
  onClick?: () => void;
}

export function NotificationItem({
  title,
  message,
  time,
  isRead = false,
  type = 'info',
  onClick,
}: NotificationItemProps) {
  const typeConfig = {
    info: {
      icon: (
        <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    success: {
      icon: (
        <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    warning: {
      icon: (
        <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    error: {
      icon: (
        <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  return (
    <div
      className={`
        flex items-start space-x-3 p-4 
        ${!isRead ? 'bg-blue-50' : 'bg-white'}
        hover:bg-gray-50 cursor-pointer
        border-b border-gray-200
      `}
      onClick={onClick}
    >
      <div className="flex-shrink-0">{typeConfig[type].icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${!isRead ? 'text-gray-900' : 'text-gray-700'}`}>
          {title}
        </p>
        <p className="text-sm text-gray-500 mt-1">{message}</p>
        <p className="text-xs text-gray-400 mt-1">{time}</p>
      </div>
      {!isRead && (
        <div className="flex-shrink-0">
          <NotificationBadge count={1} dot size="small" />
        </div>
      )}
    </div>
  );
}