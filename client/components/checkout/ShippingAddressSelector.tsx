'use client';

import { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { Address } from '@/types';
import AddressFormModal from './AddressFormModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { usersApi } from '@/lib/api/users';
import { toast } from 'sonner';

interface ShippingAddressSelectorProps {
  savedAddresses: Address[];
  selectedAddressId: string;
  onSelectAddressId: (id: string) => void;
  onAddressesUpdated?: () => void;
  // Temporary Address State
  tempAddress?: {
    receiverName?: string;
    receiverPhone?: string;
    detail?: string;
    province?: string;
    district?: string;
    ward?: string;
    provinceId?: number;
    districtId?: number;
    wardCode?: string;
  };
  onApplyTempAddress?: (data: any) => void;
  title?: string;
  className?: string;
}

export default function ShippingAddressSelector({
  savedAddresses = [],
  selectedAddressId,
  onSelectAddressId,
  onAddressesUpdated,
  tempAddress,
  onApplyTempAddress,
  title = 'Địa chỉ giao hàng',
  className = '',
}: ShippingAddressSelectorProps) {
  const [previousAddressId, setPreviousAddressId] = useState<string>('');
  const [isAddressesExpanded, setIsAddressesExpanded] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Delete Dialog state
  const [addressToDeleteId, setAddressToDeleteId] = useState<string | null>(null);
  const [deletingAddressLoading, setDeletingAddressLoading] = useState(false);

  const handleSelectAddress = (id: string) => {
    onSelectAddressId(id);
    setPreviousAddressId(id);
  };

  const handleOpenNewAddressModal = () => {
    if (selectedAddressId && selectedAddressId !== 'new') {
      setPreviousAddressId(selectedAddressId);
    }
    onSelectAddressId('new');
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const handleEditAddressClick = (addr: Address) => {
    if (selectedAddressId && selectedAddressId !== 'new') {
      setPreviousAddressId(selectedAddressId);
    }
    setEditingAddress(addr);
    setIsAddressModalOpen(true);
  };

  const handleModalClose = () => {
    setIsAddressModalOpen(false);
    setEditingAddress(null);

    // Revert selection if user closed modal while "new" was active without submitting
    if (selectedAddressId === 'new') {
      const validPrev = savedAddresses.find((a) => a.id === previousAddressId);
      if (validPrev) {
        onSelectAddressId(validPrev.id);
      } else if (savedAddresses.length > 0) {
        const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
        onSelectAddressId(defaultAddr.id);
      }
    }
  };

  const handleModalSubmit = async (data: any) => {
    setIsAddressModalOpen(false);

    if (editingAddress) {
      try {
        await usersApi.updateAddress(editingAddress.id, {
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          province: data.provinceName,
          district: data.districtName,
          ward: data.wardName,
          detail: data.detail,
          provinceId: data.provinceId,
          districtId: data.districtId,
          wardCode: data.wardCode,
          isDefault: data.setAsDefault,
        });
        toast.success('Đã cập nhật thông tin địa chỉ thành công.');
        if (onAddressesUpdated) onAddressesUpdated();
      } catch (err) {
        console.error('Failed to update address', err);
        toast.error('Lỗi khi cập nhật địa chỉ.');
      } finally {
        setEditingAddress(null);
      }
    } else {
      if (data.saveAddressToDb) {
        try {
          await usersApi.createAddress({
            receiverName: data.receiverName,
            receiverPhone: data.receiverPhone,
            province: data.provinceName,
            district: data.districtName,
            ward: data.wardName,
            detail: data.detail,
            provinceId: data.provinceId,
            districtId: data.districtId,
            wardCode: data.wardCode,
            isDefault: data.setAsDefault,
          });
          toast.success('Đã thêm và lưu địa chỉ mới thành công.');
          if (onAddressesUpdated) await onAddressesUpdated();
        } catch (err) {
          console.error('Failed to save address to DB', err);
          toast.error('Lỗi khi lưu địa chỉ mới vào cơ sở dữ liệu.');
        }
      } else {
        if (onApplyTempAddress) {
          onApplyTempAddress(data);
        }
        onSelectAddressId('new');
        setPreviousAddressId('new');
        toast.success('Đã áp dụng địa chỉ giao hàng mới.');
      }
    }
  };

  const handleDeleteAddressConfirm = async () => {
    if (!addressToDeleteId) return;
    setDeletingAddressLoading(true);
    try {
      await usersApi.deleteAddress(addressToDeleteId);
      toast.success('Đã xóa địa chỉ thành công.');
      if (addressToDeleteId === selectedAddressId) {
        const remaining = savedAddresses.filter((a) => a.id !== addressToDeleteId);
        if (remaining.length > 0) {
          const fallback = remaining.find((a) => a.isDefault) || remaining[0];
          onSelectAddressId(fallback.id);
          setPreviousAddressId(fallback.id);
        } else {
          onSelectAddressId('new');
          setPreviousAddressId('new');
        }
      }
      if (onAddressesUpdated) await onAddressesUpdated();
    } catch (err) {
      console.error('Failed to delete address', err);
      toast.error('Lỗi khi xóa địa chỉ.');
    } finally {
      setDeletingAddressLoading(false);
      setAddressToDeleteId(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h2 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> {title}
        </h2>
      )}

      {/* Saved Addresses List */}
      {savedAddresses.length > 0 && (
        <div className="space-y-3">
          {(isAddressesExpanded
            ? savedAddresses
            : savedAddresses.filter((addr, index) => index < 2 || addr.id === selectedAddressId)
          ).map((addr) => (
            <label
              key={addr.id}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                selectedAddressId === addr.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="saved_address_selector"
                checked={selectedAddressId === addr.id}
                onChange={() => handleSelectAddress(addr.id)}
                className="mt-1 accent-[var(--primary-color)]"
              />
              <div className="flex-1 text-xs font-semibold">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-main)] text-sm">{addr.receiverName}</span>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-[var(--text-muted)]">{addr.receiverPhone}</span>
                    {addr.isDefault && (
                      <span className="rounded bg-[#EEF8F5] text-[#0F766E] px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                        Mặc định
                      </span>
                    )}
                    {(!addr.districtId || !addr.wardCode) && (
                      <span className="rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold border border-amber-200">
                        Cần cập nhật vùng nhận
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEditAddressClick(addr);
                      }}
                      className="text-xs text-[#0F766E] hover:underline font-bold transition hover:opacity-80"
                    >
                      Sửa
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAddressToDeleteId(addr.id);
                      }}
                      className="text-xs text-red-500 hover:underline font-bold transition hover:opacity-80"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                <p className="text-[var(--text-muted)] mt-1.5 leading-relaxed">
                  {addr.detail}, {addr.ward}, {addr.district}, {addr.province}
                </p>
                {selectedAddressId === addr.id && (!addr.districtId || !addr.wardCode) && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                    ⚠️ Địa chỉ cũ hoặc thiếu mã khu vực (phí vận chuyển mặc định 30.000₫). Vui lòng bấm &quot;Sửa&quot; để chọn lại phường/xã.
                  </p>
                )}
              </div>
            </label>
          ))}

          {savedAddresses.length > 2 && (
            <button
              type="button"
              onClick={() => setIsAddressesExpanded(!isAddressesExpanded)}
              className="text-xs font-bold text-[#0F766E] hover:underline flex items-center gap-1 mt-2 transition cursor-pointer"
            >
              {isAddressesExpanded ? 'Thu gọn' : 'Xem thêm địa chỉ khác'}
            </button>
          )}
        </div>
      )}

      {/* Option to use a new address */}
      <div
        onClick={handleOpenNewAddressModal}
        className={`flex items-center justify-between gap-3 rounded-xl border p-4 cursor-pointer transition ${
          selectedAddressId === 'new' || selectedAddressId === ''
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)]">
          <input
            type="radio"
            name="saved_address_selector"
            checked={selectedAddressId === 'new' || selectedAddressId === ''}
            readOnly
            className="accent-[var(--primary-color)]"
          />
          <Plus className="size-4 text-primary" />
          Sử dụng địa chỉ mới
        </div>
        {(selectedAddressId === 'new' || selectedAddressId === '') && tempAddress?.receiverName && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditingAddress(null);
              setIsAddressModalOpen(true);
            }}
            className="text-xs font-bold text-primary hover:underline"
          >
            Sửa
          </button>
        )}
      </div>

      {/* Temporary Address Summary Preview */}
      {(selectedAddressId === 'new' || selectedAddressId === '') && tempAddress?.receiverName && (
        <div className="rounded-xl border border-dashed border-primary bg-primary/5 p-4 text-xs font-semibold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-main)] text-sm">{tempAddress.receiverName}</span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-[var(--text-muted)]">{tempAddress.receiverPhone}</span>
            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
              Tạm thời
            </span>
          </div>
          <p className="text-[var(--text-muted)] mt-1.5 leading-relaxed">
            {tempAddress.detail}, {tempAddress.ward}, {tempAddress.district}, {tempAddress.province}
          </p>
        </div>
      )}

      {/* Reusable Address Input / Edit Modal */}
      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        showSaveOptions={editingAddress ? false : true}
        showShippingFee={true}
        title={editingAddress ? 'Sửa thông tin địa chỉ giao hàng' : 'Nhập thông tin giao hàng mới'}
        initialData={
          editingAddress
            ? {
                receiverName: editingAddress.receiverName,
                receiverPhone: editingAddress.receiverPhone,
                province: editingAddress.province,
                district: editingAddress.district,
                ward: editingAddress.ward,
                detail: editingAddress.detail,
              }
            : tempAddress
        }
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!addressToDeleteId}
        onClose={() => setAddressToDeleteId(null)}
        onConfirm={handleDeleteAddressConfirm}
        title="Xóa địa chỉ"
        message="Bạn có chắc chắn muốn xóa địa chỉ này khỏi tài khoản không? Hành động này không thể hoàn tác."
        confirmText="Xóa địa chỉ"
        isDanger={true}
        loading={deletingAddressLoading}
      />
    </div>
  );
}
