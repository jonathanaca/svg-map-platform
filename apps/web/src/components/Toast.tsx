import React, { useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

const ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0',
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: '#0d1f0d', border: '#22c55e', text: '#4ade80' },
  error: { bg: '#1f0d0d', border: '#ef4444', text: '#f87171' },
  info: { bg: '#0d1520', border: '#3b82f6', text: '#60a5fa' },
  warning: { bg: '#1f1a0d', border: '#f59e0b', text: '#fbbf24' },
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  return { toasts, showToast };
}

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const c = COLORS[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 8,
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              minWidth: 200,
              maxWidth: 360,
              opacity: toast.exiting ? 0 : 1,
              transform: toast.exiting ? 'translateX(20px)' : 'translateX(0)',
              transition: 'opacity 0.3s, transform 0.3s',
              animation: 'toast-slide-in 0.3s ease-out',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{ICONS[toast.type]}</span>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
