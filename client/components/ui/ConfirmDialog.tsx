'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  open,
  onClose,
  onCancel,
  onConfirm,
  title = 'Xác nhận',
  message,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDanger = false,
  loading = false
}: ConfirmDialogProps) {
  const visible = open ?? isOpen ?? false;
  const handleClose = onCancel ?? onClose ?? (() => {});
  const displayMessage = description ?? message ?? '';

  if (!visible) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <X className="size-5" />
        </button>

        <div className={`mx-auto flex size-12 items-center justify-center rounded-full ${
          isDanger ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
        }`}>
          <AlertTriangle className="size-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            {displayMessage}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border px-4 py-2.5 text-xs font-extrabold hover:bg-muted transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition flex items-center gap-1.5 shadow-sm ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading && <Loader2 className="size-3 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
