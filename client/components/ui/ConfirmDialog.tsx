'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDanger = false,
  loading = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:text-[var(--text-main)] hover:bg-gray-100 transition"
        >
          <X className="size-5" />
        </button>

        <div className={`mx-auto flex size-12 items-center justify-center rounded-full ${
          isDanger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
        }`}>
          <AlertTriangle className="size-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-lg font-black text-[var(--text-main)]">{title}</h3>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed px-4">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-xs font-extrabold text-[var(--text-main)] hover:bg-gray-50 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition flex items-center gap-1.5 shadow-sm ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0F766E] hover:bg-[#115E59]'
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
