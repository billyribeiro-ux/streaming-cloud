/**
 * Toast Component - Toast notification system
 *
 * Features:
 * - Uses @radix-ui/react-toast
 * - Types: success, error, warning, info
 * - Auto-dismiss after 5 seconds
 * - Position: bottom-right
 * - Exports ToastProvider wrapper and useToast hook
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

// ============================================================================
// TYPES
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// ICON MAP
// ============================================================================

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

const borderMap: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-yellow-500',
  info: 'border-l-blue-500',
};

// ============================================================================
// SINGLE TOAST COMPONENT
// ============================================================================

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const Icon = iconMap[item.type];

  return (
    <ToastPrimitive.Root
      duration={item.duration ?? 5000}
      onOpenChange={(open) => {
        if (!open) onDismiss(item.id);
      }}
      className={cn(
        'bg-gray-900 border border-gray-800 border-l-4 rounded-lg shadow-lg p-4',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[swipe=cancel]:translate-x-0',
        'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right',
        borderMap[item.type]
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colorMap[item.type])} />

        <div className="flex-1 min-w-0">
          <ToastPrimitive.Title className="text-sm font-medium text-white">
            {item.title}
          </ToastPrimitive.Title>

          {item.description && (
            <ToastPrimitive.Description className="text-sm text-gray-400 mt-1">
              {item.description}
            </ToastPrimitive.Description>
          )}
        </div>

        <ToastPrimitive.Close
          className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
}

// ============================================================================
// TOAST PROVIDER
// ============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const success = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'success', title, description });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'error', title, description });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'warning', title, description });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      addToast({ type: 'info', title, description });
    },
    [addToast]
  );

  const contextValue: ToastContextValue = {
    toast: addToast,
    success,
    error,
    warning,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((item) => (
          <ToastNotification key={item.id} item={item} onDismiss={dismiss} />
        ))}

        <ToastPrimitive.Viewport
          className="fixed bottom-0 right-0 z-[100] flex max-w-[420px] flex-col gap-2 p-6 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// ============================================================================
// useToast HOOK
// ============================================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
