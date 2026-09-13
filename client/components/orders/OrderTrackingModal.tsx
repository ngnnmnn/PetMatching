'use client';

import React, { useEffect, useState } from 'react';
import { X, Truck, CheckCircle2, Clock, MapPin, Phone, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { shippingApi, TrackingDetailResponse } from '@/lib/api/shipping';

interface OrderTrackingModalProps {
  isOpen: boolean;
  code: string | null;
  carrier?: 'GHN' | 'AHAMOVE';
  onClose: () => void;
}

/**
 * Modal hiển thị chi tiết Lịch sử Tracking tự động của Vận đơn GHN / AhaMove Hỏa Tốc
 * Cho phép khách hàng & Manager xem chi tiết hành trình vận chuyển theo thời gian thực
 */
export default function OrderTrackingModal({
  isOpen,
  code,
  carrier = 'AHAMOVE',
  onClose,
}: OrderTrackingModalProps) {
  const [data, setData] = useState<TrackingDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchTracking = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const res =
        carrier === 'AHAMOVE'
          ? await shippingApi.getAhamoveTrackingDetail(code)
          : await shippingApi.getTrackingDetail(code);
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch tracking detail', err);
      toast.error(
        err.response?.data?.message ||
          `Không thể lấy thông tin hành trình ${carrier === 'AHAMOVE' ? 'AhaMove' : 'GHN'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Tự động ngầm làm mới và đồng bộ timeline 4s/lần khi đang mở xem modal tracking
  useEffect(() => {
    if (isOpen && code) {
      fetchTracking();
      const interval = setInterval(() => {
        fetchTracking();
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setData(null);
    }
  }, [isOpen, code, carrier]);

  if (!isOpen || !code) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`Đã sao chép mã vận đơn ${carrier === 'AHAMOVE' ? 'AhaMove' : 'GHN'}!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-5 relative transition-all duration-300 animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 border-[#EFEAE2]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
              <Truck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#2C2B28] flex items-center gap-2">
                {carrier === 'AHAMOVE' ? '⚡ Hành trình AhaMove Hỏa Tốc' : 'Hành trình vận chuyển GHN'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs font-bold text-gray-500">
                  {code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 rounded text-gray-400 hover:text-rose-600 transition cursor-pointer"
                  title="Sao chép mã"
                >
                  {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchTracking}
              disabled={loading}
              className="p-2 rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin text-rose-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="size-8 animate-spin text-rose-500" />
            <p className="text-xs font-bold text-gray-500">Đang đồng bộ dữ liệu tracking từ AhaMove...</p>
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* Shipper Contact Info Box */}
            {data.shipperInfo && (
              <div className="rounded-2xl bg-rose-50/60 border border-rose-200/80 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                  Thông tin tài xế giao hàng (AhaMove Shipper)
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-gray-800">{data.shipperInfo.name}</p>
                    <p className="text-[11px] font-bold text-gray-500 mt-0.5">{data.shipperInfo.hubName}</p>
                  </div>
                  <a
                    href={`tel:${data.shipperInfo.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-xs"
                  >
                    <Phone className="size-3.5" />
                    <span>{data.shipperInfo.phone}</span>
                  </a>
                </div>
              </div>
            )}

            {/* Timeline Visual Progress */}
            <div className="space-y-1">
              <p className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                Lịch sử di chuyển vận đơn
              </p>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-rose-200">
                {data.events.map((evt, idx) => {
                  const isLatest = idx === data.events.length - 1;
                  return (
                    <div key={idx} className="relative group">
                      {/* Circle Step Node */}
                      <div
                        className={`absolute -left-6 top-0.5 flex size-5.5 items-center justify-center rounded-full border-2 text-[10px] font-black transition-all ${
                          isLatest
                            ? 'bg-rose-500 border-rose-200 text-white ring-4 ring-rose-100 animate-pulse'
                            : 'bg-green-600 border-green-200 text-white'
                        }`}
                      >
                        {isLatest ? (
                          <Truck className="size-3" />
                        ) : (
                          <CheckCircle2 className="size-3" />
                        )}
                      </div>

                      {/* Event Detail Content */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-black ${isLatest ? 'text-rose-600' : 'text-gray-800'}`}>
                            {evt.title}
                          </h4>
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(evt.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold">{evt.description}</p>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                          <MapPin className="size-3 shrink-0 text-rose-500" />
                          <span>{evt.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note Footer */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-[11px] font-bold text-gray-500 leading-relaxed">
              💡 <strong>Tự động hóa AhaMove:</strong> Tiến trình vận chuyển được tự động đồng bộ theo thời gian thực từ hệ thống AhaMove.
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 font-bold text-center py-6">Không có dữ liệu vận đơn.</p>
        )}
      </div>
    </div>
  );
}
