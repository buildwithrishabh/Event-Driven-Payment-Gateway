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
  success: "border border-[#282A30] bg-[#16171A]/95 backdrop-blur-md text-[#F4F4F5] shadow-dropdown",
  error: "border border-[#282A30] bg-[#16171A]/95 backdrop-blur-md text-[#F4F4F5] shadow-dropdown",
  warning: "border border-[#282A30] bg-[#16171A]/95 backdrop-blur-md text-[#F4F4F5] shadow-dropdown",
  info: "border border-[#282A30] bg-[#16171A]/95 backdrop-blur-md text-[#F4F4F5] shadow-dropdown",
};

const ICON_WRAP = {
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  error: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  info: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2.5 p-4 sm:items-end"
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
                  <p className="text-sm font-semibold text-white">{toast.title}</p>
                )}
                {toast.message && (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-400">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-slate-400 opacity-80 transition hover:bg-white/10 hover:text-white hover:opacity-100"
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
