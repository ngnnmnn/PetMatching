'use client';

import { useEffect, useState, type ReactNode, type WheelEvent } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type ImageLightboxProps = {
  imageUrl: string | null;
  alt?: string;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

export function ImageLightbox({ imageUrl, alt = 'Ảnh xem trước', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(MIN_SCALE);

  useEffect(() => {
    if (!imageUrl) return;
    setScale(MIN_SCALE);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP));
      if (event.key === '-') setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP));
      if (event.key === '0') setScale(MIN_SCALE);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl, onClose]);

  const zoomIn = () => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP));
  const zoomOut = () => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP));
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setScale((value) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))));
  };

  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
        >
          <div className="z-10 flex shrink-0 items-center justify-end gap-2 p-4 text-white">
            <span className="mr-1 rounded-full bg-black/45 px-3 py-2 text-xs font-bold tabular-nums">{Math.round(scale * 100)}%</span>
            <ControlButton label="Thu nhỏ" onClick={zoomOut} disabled={scale <= MIN_SCALE}><Minus className="size-5" /></ControlButton>
            <ControlButton label="Phóng to" onClick={zoomIn} disabled={scale >= MAX_SCALE}><Plus className="size-5" /></ControlButton>
            <ControlButton label="Đặt lại kích thước" onClick={() => setScale(MIN_SCALE)} disabled={scale === MIN_SCALE}><RotateCcw className="size-5" /></ControlButton>
            <ControlButton label="Đóng ảnh" onClick={onClose}><X className="size-6" /></ControlButton>
          </div>

          <div
            className="min-h-0 flex-1 overflow-auto overscroll-contain p-4 md:p-8"
            onWheel={handleWheel}
            onClick={onClose}
          >
            <div className="flex min-h-full min-w-full items-center justify-center">
              <motion.img
                key={imageUrl}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale }}
                src={imageUrl}
                alt={alt}
                draggable={false}
                onDoubleClick={() => setScale((value) => value > MIN_SCALE ? MIN_SCALE : 2)}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-3rem)] select-none rounded-xl object-contain shadow-2xl transition-transform duration-150 ease-out md:max-w-[calc(100vw-6rem)]"
                style={{ cursor: scale > 1 ? 'zoom-out' : 'zoom-in' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white shadow-lg transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
