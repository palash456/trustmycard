"use client";

import { useCallback, useMemo, useState } from "react";

import {
  ToastContext,
  ToastOptions,
} from "@/hooks/useToast";

interface ToastState extends ToastOptions {
  id: number;
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((toast: ToastOptions) => {
    const id = Date.now();

    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed right-6 top-6 z-[9999] flex w-96 flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border p-4 shadow-lg transition-all ${
              toast.type === "success"
                ? "border-green-300 bg-green-50"
                : toast.type === "error"
                ? "border-red-300 bg-red-50"
                : toast.type === "warning"
                ? "border-yellow-300 bg-yellow-50"
                : "border-blue-300 bg-blue-50"
            }`}
          >
            <h4 className="font-semibold">{toast.title}</h4>

            {toast.description && (
              <p className="mt-1 text-sm text-zinc-600">
                {toast.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}