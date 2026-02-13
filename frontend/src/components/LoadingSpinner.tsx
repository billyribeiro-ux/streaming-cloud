/**
 * LoadingSpinner Component - Animated loading indicator
 *
 * Features:
 * - CSS animation spinner
 * - Optional fullScreen mode for route transitions
 * - Optional loading message
 */

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

function LoadingSpinner({
  fullScreen = false,
  message,
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-gray-700 border-t-blue-500 rounded-full animate-spin`}
      />
      {message && (
        <p className="text-gray-400 text-sm font-medium">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        {spinner}
      </div>
    );
  }

  return spinner;
}

export default LoadingSpinner;
