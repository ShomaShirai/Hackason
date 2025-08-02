interface LoadingProps {
  /** ローディングメッセージ */
  message?: string;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** 全画面表示 */
  fullScreen?: boolean;
}

export function Loading({
  message = '読み込み中...',
  size = 'medium',
  fullScreen = false,
}: LoadingProps) {
  const sizeClasses = {
    small: 'h-8 w-8',
    medium: 'h-12 w-12',
    large: 'h-16 w-16',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200`}
        >
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        </div>
      </div>
      {message && (
        <p className={`mt-4 text-gray-600 ${size === 'small' ? 'text-sm' : 'text-base'}`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-8">{spinner}</div>;
}

/**
 * ボタン内で使用するコンパクトなローディングスピナー
 */
export function ButtonLoading() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
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
  );
}

/**
 * スケルトンローディング（プレースホルダー）
 */
interface SkeletonProps {
  /** 幅（Tailwind CSSクラス） */
  width?: string;
  /** 高さ（Tailwind CSSクラス） */
  height?: string;
  /** 形状 */
  variant?: 'text' | 'rect' | 'circle';
  /** アニメーション */
  animate?: boolean;
}

export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  variant = 'rect',
  animate = true,
}: SkeletonProps) {
  const baseClasses = `bg-gray-200 ${width} ${height}`;
  const animateClasses = animate ? 'animate-pulse' : '';
  const variantClasses = {
    text: 'rounded',
    rect: 'rounded-md',
    circle: 'rounded-full',
  };

  return <div className={`${baseClasses} ${animateClasses} ${variantClasses[variant]}`} />;
}

/**
 * カードのスケルトン
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circle" width="w-12" height="h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton width="w-32" height="h-4" />
          <Skeleton width="w-24" height="h-3" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton width="w-full" height="h-4" />
        <Skeleton width="w-3/4" height="h-4" />
      </div>
    </div>
  );
}

/**
 * テーブル行のスケルトン
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton width="w-full" height="h-4" />
        </td>
      ))}
    </tr>
  );
}