'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  PawPrint,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import AppHeader from '@/components/layout/AppHeader';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';
import { AddressFormModal } from '@/components/checkout';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usersApi } from '@/lib/api/users';
import { getPasswordPolicyError, getPasswordStrength, PASSWORD_MIN_LENGTH } from '@/lib/password-policy';
import { Address, ProfileResponse } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type MatchingBlock = {
  createdAt: string;
  blocked: { id: string; name: string; avatarUrl?: string | null };
};

const shortcuts = [
  { href: '/my-pets', label: 'Thú cưng của tôi', icon: PawPrint },
  { href: '/orders', label: 'Đơn hàng', icon: Package },
  { href: '/messages', label: 'Tin nhắn', icon: MessageCircle },
  { href: '/home', label: 'Cửa hàng', icon: ShoppingBag },
];

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

export default function ProfilePage() {
  const router = useRouter();
  const newPasswordInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [weakPasswordModalOpen, setWeakPasswordModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [matchingBlocks, setMatchingBlocks] = useState<MatchingBlock[]>([]);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAddressesExpanded, setIsAddressesExpanded] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressToDeleteId, setAddressToDeleteId] = useState<string | null>(null);
  const [deletingAddressLoading, setDeletingAddressLoading] = useState(false);

  const refreshProfile = async () => {
    try {
      const response = await usersApi.getProfile();
      setProfile(response.data);
    } catch (e) {
      console.error('Failed to refresh profile', e);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setIsAddressModalOpen(true);
  };

  const handleAddressFormSubmit = async (data: any) => {
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
        await refreshProfile();
      } catch (err) {
        console.error('Failed to update address', err);
        toast.error('Lỗi khi cập nhật địa chỉ.');
      } finally {
        setEditingAddress(null);
      }
    } else {
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
        toast.success('Đã thêm địa chỉ mới thành công.');
        await refreshProfile();
      } catch (err) {
        console.error('Failed to create address', err);
        toast.error('Lỗi khi lưu địa chỉ mới.');
      }
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      await usersApi.setDefaultAddress(id);
      toast.success('Đã đặt làm địa chỉ mặc định.');
      await refreshProfile();
    } catch (err) {
      console.error('Failed to set default address', err);
      toast.error('Không thể đặt địa chỉ mặc định.');
    }
  };

  const handleDeleteAddressConfirm = async () => {
    if (!addressToDeleteId) return;
    setDeletingAddressLoading(true);
    try {
      await usersApi.deleteAddress(addressToDeleteId);
      toast.success('Đã xóa địa chỉ thành công.');
      await refreshProfile();
    } catch (err) {
      console.error('Failed to delete address', err);
      toast.error('Lỗi khi xóa địa chỉ.');
    } finally {
      setDeletingAddressLoading(false);
      setAddressToDeleteId(null);
    }
  };

  const passwordStrength = useMemo(() => getPasswordStrength(passwords.newPassword), [passwords.newPassword]);

  const canAttemptChangePassword = passwords.currentPassword.length > 0 && passwords.newPassword.length > 0 && passwords.confirmPassword.length > 0 && !passwordSaving;

  const updatePasswordField = (field: keyof typeof passwords, value: string) => {
    setPasswords((state) => ({ ...state, [field]: value }));
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((value) => ({ ...value, [field]: !value[field] }));
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    usersApi
      .getProfile()
      .then((profileResponse) => {
        const data = profileResponse.data;
        setProfile(data);
        setName(data.name);
        setPhone(data.phone ?? '');
        setAvatarUrl(data.avatarUrl ?? '');
      })
      .catch(() => toast.error('Không thể tải hồ sơ.'))
      .finally(() => setLoading(false));

    usersApi
      .getMatchingBlocks()
      .then((response) => setMatchingBlocks(response.data))
      .catch(() => toast.error('Không thể tải danh sách người dùng đã chặn.'));
  }, [router]);

  const handleUnblockMatchingUser = async (userId: string) => {
    if (unblockingUserId) return;
    setUnblockingUserId(userId);
    try {
      await usersApi.unblockMatchingUser(userId);
      setMatchingBlocks((current) => current.filter((item) => item.blocked.id !== userId));
      toast.success('Đã bỏ chặn người dùng.');
    } catch {
      toast.error('Không thể bỏ chặn người dùng.');
    } finally {
      setUnblockingUserId(null);
    }
  };

  const syncUserStorage = (nextUser: ProfileResponse) => {
    const stored = localStorage.getItem('user');
    const current = stored ? JSON.parse(stored) : {};
    localStorage.setItem(
      'user',
      JSON.stringify({
        ...current,
        id: nextUser.id,
        email: nextUser.email,
        name: nextUser.name,
        phone: nextUser.phone,
        role: nextUser.role,
        avatarUrl: nextUser.avatarUrl,
        isVerified: nextUser.isVerified,
      }),
    );
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const response = await usersApi.uploadAvatar(formData);
      setAvatarUrl(response.data.avatarUrl);
      toast.success('Ảnh đại diện đã sẵn sàng.');
    } catch {
      toast.error('Tải ảnh thất bại. Hãy chọn ảnh nhỏ hơn 2MB.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await usersApi.updateProfile({ name, phone, avatarUrl });
      const nextProfile = {
        ...(profile as ProfileResponse),
        ...response.data,
      };
      setProfile(nextProfile);
      syncUserStorage(nextProfile);
      toast.success('Đã lưu thay đổi hồ sơ.');
    } catch {
      toast.error('Lưu hồ sơ thất bại.');
    } finally {
      setSaving(false);
    }
  };



  const submitPasswordChange = async () => {
    setPasswordSaving(true);
    try {
      await usersApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      });
      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success('Đã đổi mật khẩu.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.';
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Mật khẩu mới không khớp.');
      return;
    }

    const policyError = getPasswordPolicyError(passwords.newPassword);
    if (policyError) {
      toast.error(policyError);
      return;
    }

    if (passwordStrength.level === 1) {
      setWeakPasswordModalOpen(true);
      return;
    }

    await submitPasswordChange();
  };

  const handleUseWeakPassword = async () => {
    setWeakPasswordModalOpen(false);
    await submitPasswordChange();
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await usersApi.deleteAccount();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      localStorage.removeItem('petmatch_shop_selected_pet');
      window.dispatchEvent(new Event('auth-change'));
      toast.success('Tài khoản đã được xóa.');
      router.push('/login');
    } catch (error: unknown) {
      const data = (error as {
        response?: { data?: { code?: string; message?: string } };
      }).response?.data;
      const action = data?.code === 'USER_HAS_ACTIVE_STORE_ORDERS'
        ? { label: 'Xem đơn hàng', onClick: () => router.push('/orders') }
        : data?.code === 'USER_HAS_ACTIVE_SPA_BOOKING'
          ? { label: 'Xem lịch Spa', onClick: () => router.push('/spa/bookings') }
          : undefined;
      toast.error(data?.message || 'Không thể xóa tài khoản.', { action });
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
        <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  const roleLabel = profile.role === 'USER' ? 'Người dùng' : profile.role;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
      <AppHeader sectionLabel="Hồ sơ" />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 inline-flex h-9 items-center gap-2 rounded-md border border-[#EFEAE2] bg-white px-3 text-sm font-bold text-[var(--text-main)] shadow-sm transition hover:border-[rgba(228,93,28,0.28)] hover:text-[var(--primary-color)]"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </button>

          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-white shadow-[0_18px_50px_rgba(26,26,26,0.06)]">
                <div className="h-20 bg-[linear-gradient(135deg,#E45D1C_0%,#0F766E_100%)]" />
                <div className="flex flex-col items-center text-center">
                  <label className="group relative -mt-12 block size-36 cursor-pointer overflow-hidden rounded-full border-4 border-white bg-white shadow-md ring-1 ring-[var(--border-color)]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-[var(--primary-color)] text-4xl font-extrabold text-white">{name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                      {uploading ? <Loader2 className="size-6 animate-spin text-white" /> : <Camera className="size-7 text-white" />}
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarChange} disabled={uploading} />
                  </label>

                  <h1 className="mt-4 text-xl font-extrabold">{profile.name}</h1>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{profile.email}</p>
                  <span className="mt-3 rounded-full bg-[var(--bg-demo-box)] px-3 py-1 text-xs font-bold uppercase text-[var(--primary-color)]">{roleLabel}</span>
                </div>

                <div className="px-5 pb-5">
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Thú cưng" value={profile.stats.pets} />
                    <Stat label="Đơn hàng" value={profile.stats.orders} />
                    <Stat label="Đã chi tiêu" value={currency.format(profile.stats.totalSpent)} />
                  </div>
                  <div className="mt-5 grid gap-2 rounded-lg bg-[#FBFAF7] p-3 text-sm">
                    <InfoLine icon={Mail} value={profile.email} />
                    <InfoLine icon={Phone} value={profile.phone || 'Chưa cập nhật'} />
                    <InfoLine icon={ShieldCheck} value={profile.isVerified ? 'Đã xác thực' : 'Chưa xác thực'} />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[var(--border-color)] bg-white p-4 shadow-[0_18px_50px_rgba(26,26,26,0.04)]">
                <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Tiện ích nhanh</h2>
                <div className="flex flex-col gap-2">
                  {shortcuts.map((item) => (
                    <Link key={item.href} href={item.href} className="group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-page)]">
                      <span className="flex items-center gap-2.5">
                        <item.icon className="size-4 text-[var(--primary-color)]" />
                        {item.label}
                      </span>
                      <ChevronRight className="size-4 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-red-100 bg-red-50/70 p-4 shadow-[0_18px_50px_rgba(26,26,26,0.04)]">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-red-600">
                    <ShieldAlert className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-red-700">Vùng nguy hiểm</h2>
                    <p className="mt-1 text-xs leading-5 text-red-700/75">Hồ sơ cá nhân sẽ bị xóa vĩnh viễn; thông tin giao dịch Store/Spa đã hoàn thành vẫn được lưu trong lịch sử, còn Match được ẩn danh.</p>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      <Trash2 className="size-4" />
                      Xóa tài khoản
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="size-5 text-red-600" />
                        Xóa tài khoản?
                      </AlertDialogTitle>
                      <AlertDialogDescription>Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa tài khoản này không?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deletingAccount}>Hủy</AlertDialogCancel>
                      <AlertDialogAction disabled={deletingAccount} className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteAccount}>
                        {deletingAccount ? <Loader2 className="size-4 animate-spin" /> : null}
                        {deletingAccount ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>
            </aside>

            <div className="space-y-6">
              <section className="profile-card">
                <SectionHeader icon={UserRound} title="Hồ sơ cá nhân" description="Thông tin này được dùng cho đơn hàng, liên hệ và hiển thị trong hệ thống." />

                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveProfile}>
                  <Field label="Họ tên">
                    <input className="profile-input" value={name} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field label="Số điện thoại">
                    <input className="profile-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input className="profile-input text-[var(--text-muted)]" value={profile.email} readOnly />
                  </Field>
                  <Field label="Vai trò">
                    <input className="profile-input text-[var(--text-muted)]" value={roleLabel} readOnly />
                  </Field>
                  <div className="md:col-span-2">
                    <button type="submit" disabled={saving} className="profile-primary-button">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Lưu thay đổi
                    </button>
                  </div>
                </form>

                <div className="my-4 h-px bg-[#EFEAE2]" />

                <div className="grid gap-4">
                  <SectionHeader icon={Lock} title="Đổi mật khẩu" description="Cập nhật mật khẩu mới để tăng bảo mật cho tài khoản." compact />

                  <form className="grid w-full gap-3 md:grid-cols-[170px_minmax(0,420px)] md:items-center" onSubmit={handleChangePassword}>
                    <PasswordRowLabel>Mật khẩu hiện tại</PasswordRowLabel>
                    <PasswordControl
                      value={passwords.currentPassword}
                      visible={showPasswords.current}
                      onToggle={() => togglePasswordVisibility('current')}
                      onChange={(value) => updatePasswordField('currentPassword', value)}
                    />

                    <PasswordRowLabel>Mật khẩu mới</PasswordRowLabel>
                    <div className="grid gap-1.5">
                      <PasswordControl
                        value={passwords.newPassword}
                        visible={showPasswords.next}
                        inputRef={newPasswordInputRef}
                        isNewPassword
                        onToggle={() => togglePasswordVisibility('next')}
                        onChange={(value) => updatePasswordField('newPassword', value)}
                      />
                      <PasswordStrengthMeter password={passwords.newPassword} className="-mt-1" />
                    </div>

                    <PasswordRowLabel>Nhập lại mật khẩu</PasswordRowLabel>
                    <PasswordControl
                      value={passwords.confirmPassword}
                      visible={showPasswords.confirm}
                      autoComplete="new-password"
                      onToggle={() => togglePasswordVisibility('confirm')}
                      onChange={(value) => updatePasswordField('confirmPassword', value)}
                    />

                    <div className="md:col-span-2">
                      <button type="submit" disabled={!canAttemptChangePassword} className="profile-primary-button">
                        {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                        Cập nhật mật khẩu
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="profile-card">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader icon={MapPin} title="Địa chỉ giao hàng" description="Địa chỉ chính sẽ được ưu tiên khi tạo đơn hàng." compact />
                  <button type="button" className="profile-secondary-button" onClick={handleOpenAddModal}>
                    <Plus className="size-4" />
                    Thêm địa chỉ
                  </button>
                </div>

                <div className="grid gap-3">
                  {(isAddressesExpanded
                    ? profile?.addresses
                    : profile?.addresses?.filter((_, index) => index < 2)
                  )?.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-lg border border-[var(--border-color)] bg-[#FFFEFC] p-4 transition hover:border-[rgba(228,93,28,0.22)] hover:shadow-[0_14px_34px_rgba(26,26,26,0.05)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold">{address.receiverName}</p>
                            <span className="text-sm text-[var(--text-muted)]">{address.receiverPhone}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                                address.isDefault ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {address.isDefault ? 'Địa chỉ chính' : 'Địa chỉ phụ'}
                            </span>
                            {(!address.districtId || !address.wardCode) && (
                              <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold border border-amber-200">
                                Cần cập nhật mã địa chỉ
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex min-w-0 items-start gap-2 text-sm text-[var(--text-muted)]">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--primary-color)]" />
                            <p>
                              {address.detail}, {address.ward}, {address.district}, {address.province}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!address.isDefault && (
                            <button
                              type="button"
                              className="profile-secondary-button"
                              onClick={() => handleSetDefaultAddress(address.id)}
                            >
                              <Check className="size-4" />
                              Đặt chính
                            </button>
                          )}
                          <button
                            type="button"
                            className="profile-secondary-button"
                            onClick={() => handleOpenEditModal(address)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                            onClick={() => setAddressToDeleteId(address.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {profile?.addresses && profile.addresses.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setIsAddressesExpanded(!isAddressesExpanded)}
                      className="text-xs font-bold text-[#0F766E] hover:underline flex items-center gap-1 mt-1 transition cursor-pointer self-start"
                    >
                      {isAddressesExpanded ? 'Thu gọn' : `Xem thêm (${profile.addresses.length - 2} địa chỉ khác)`}
                    </button>
                  )}

                  {(!profile?.addresses || profile.addresses.length === 0) && (
                    <div className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--text-muted)]">
                      Chưa có địa chỉ giao hàng.
                    </div>
                  )}
                </div>
              </section>

              <section className="profile-card">
                <SectionHeader
                  icon={ShieldAlert}
                  title="Người dùng đã chặn"
                  description="Bỏ chặn chỉ cho phép tương tác mới; các match cũ vẫn giữ trạng thái đã kết thúc."
                  compact
                />
                <div className="mt-5 grid gap-3">
                  {matchingBlocks.map((item) => (
                    <div key={item.blocked.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={item.blocked.avatarUrl || '/placeholder.svg'}
                          alt={item.blocked.name}
                          className="size-10 rounded-full border object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{item.blocked.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            Đã chặn ngày {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button type="button" className="profile-secondary-button" disabled={unblockingUserId === item.blocked.id}>
                            {unblockingUserId === item.blocked.id ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                            Bỏ chặn
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Bỏ chặn {item.blocked.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Hai bạn có thể xuất hiện lại trong các tương tác ghép đôi mới. Match cũ sẽ không tự mở lại.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleUnblockMatchingUser(item.blocked.id)}>Bỏ chặn</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                  {matchingBlocks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--text-muted)]">
                      Bạn chưa chặn người dùng nào.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {weakPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-red-100 bg-white p-6 shadow-[0_24px_70px_rgba(26,26,26,0.22)]">
              <h2 className="text-xl font-extrabold text-red-600">⚠️ Cảnh báo bảo mật</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Mật khẩu này quá ngắn hoặc dễ đoán, có thể khiến tài khoản của bạn gặp rủi ro. Bạn có chắc chắn vẫn muốn sử dụng mật khẩu này không?
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[#D8D3CA] bg-white px-4 text-sm font-bold text-[var(--text-main)] transition hover:bg-[#FBFAF7]"
                  onClick={handleUseWeakPassword}
                >
                  Tôi vẫn muốn sử dụng
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
                  onClick={() => {
                    setWeakPasswordModalOpen(false);
                    requestAnimationFrame(() => {
                      const input = document.querySelector<HTMLInputElement>('[data-new-password-input="true"]');
                      input?.focus();
                    });
                  }}
                >
                  Thay đổi mật khẩu khác
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reusable address form modal */}
        <AddressFormModal
          isOpen={isAddressModalOpen}
          onClose={() => {
            setIsAddressModalOpen(false);
            setEditingAddress(null);
          }}
          onSubmit={handleAddressFormSubmit}
          showSaveOptions={false}
          title={editingAddress ? 'Sửa địa chỉ giao hàng' : 'Thêm địa chỉ giao hàng mới'}
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
              : undefined
          }
        />

        {/* Confirm Delete Address Dialog */}
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

      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[var(--bg-page)] px-2 py-3">
      <p className="truncate text-sm font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function InfoLine({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-[var(--primary-color)]" />
      <span className="min-w-0 truncate text-sm font-semibold">{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, compact = false }: { icon: LucideIcon; title: string; description: string; compact?: boolean }) {
  return (
    <div className={compact ? 'flex min-w-0 items-start gap-2.5' : 'mb-5 flex min-w-0 items-start gap-3'}>
      <span className={`flex shrink-0 items-center justify-center rounded-md bg-[var(--bg-demo-box)] text-[var(--primary-color)] ${compact ? 'size-9' : 'size-10'}`}>
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </span>
      <div className="min-w-0">
        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-extrabold tracking-normal`}>{title}</h2>
        <p className={`${compact ? 'mt-0.5 text-xs leading-5' : 'mt-1 text-sm leading-5'} text-[var(--text-muted)]`}>{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PasswordRowLabel({ children }: { children: ReactNode }) {
  return <div className="text-sm font-semibold text-[var(--text-main)] lg:self-center">{children}</div>;
}

function PasswordControl({
  value,
  visible,
  inputRef,
  isNewPassword = false,
  autoComplete,
  onToggle,
  onChange,
}: {
  value: string;
  visible: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  isNewPassword?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <span className="relative block">
      <input
        ref={inputRef}
        data-new-password-input={isNewPassword ? 'true' : undefined}
        type={visible ? 'text' : 'password'}
        className="profile-input pr-11"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={isNewPassword ? PASSWORD_MIN_LENGTH : undefined}
        autoComplete={autoComplete ?? (isNewPassword ? 'new-password' : 'current-password')}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-main)]"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
}
