import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: "border-emerald-200/80 bg-white text-ink-900",
  error: "border-rose-200/80 bg-white text-ink-900",
  warning: "border-amber-200/80 bg-white text-ink-900",
  info: "border-ink-200/80 bg-white text-ink-900",
};

const ICON_WRAP = {
  success: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100",
  error: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100",
  warning: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100",
  info: "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ type = "info", title, message, duration = 5000 }) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, type, title, message }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      notify,
      success: (title, message) => notify({ type: "success", title, message }),
      error: (title, message) => notify({ type: "error", title, message }),
      warning: (title, message) => notify({ type: "warning", title, message }),
      info: (title, message) => notify({ type: "info", title, message }),
      dismiss,
    }),
    [notify, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-3.5 shadow-pop animate-fade-up ${
                STYLES[toast.type] || STYLES.info
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                  ICON_WRAP[toast.type] || ICON_WRAP.info
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {toast.title && (
                  <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
                )}
                {toast.message && (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-500">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-ink-400 opacity-80 transition hover:bg-ink-100 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
