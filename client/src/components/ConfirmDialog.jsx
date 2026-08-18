import React from "react";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl bg-surface dark:bg-surface-dark p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">{title}</h3>
        <p className="mt-2 text-sm text-ink-secondary dark:text-ink-secondary-dark">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-page dark:hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              danger ? "bg-critical hover:opacity-90" : "bg-brand dark:bg-brand-dark hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
