'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
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
  Scissors,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  UserRound,
  Heart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/auth/AuthShell';
import UserDropdown from '@/components/home/UserDropdown';
import { usersApi } from '@/lib/api/users';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AddressDraft = Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

type ProvinceOption = {
  code: number;
  name: string;
};

type DistrictOption = {
  code: number;
  name: string;
};

type WardOption = {
  code: number;
  name: string;
};

type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  width: string;
  color: string;
};

const emptyAddress: AddressDraft = {
  receiverName: '',
  receiverPhone: '',
  province: '',
  district: '',
  ward: '',
  detail: '',
  isDefault: false,
};

const VIETNAM_ADMIN_API = 'https://provinces.open-api.vn/api';

const emptyPasswordStrength: PasswordStrength = {
  level: 0,
  label: '',
  width: '0%',
  color: 'transparent',
};

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return emptyPasswordStrength;
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLower && hasUpper && hasNumber && hasSpecial) {
    return {
      level: 4,
      label: 'Mật khẩu cực mạnh (Rất an toàn)',
      width: '100%',
      color: '#10B981',
    };
  }

  if (hasLower && hasUpper && hasNumber) {
    return {
      level: 3,
      label: 'Mật khẩu mạnh',
      width: '75%',
      color: '#3B82F6',
    };
  }

  if (hasLetter && hasNumber) {
    return {
      level: 2,
      label: 'Mật khẩu trung bình',
      width: '50%',
      color: '#F59E0B',
    };
  }

  return {
    level: 1,
    label: 'Mật khẩu yếu',
    width: '25%',
    color: '#EF4444',
  };
}

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
  const [weakPasswordModalOpen, setWeakPasswordModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddress);
  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([]);
  const [wardOptions, setWardOptions] = useState<WardOption[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [addressOptionsLoading, setAddressOptionsLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const defaultAddress = useMemo(
    () => profile?.addresses.find((address) => address.isDefault),
    [profile?.addresses],
  );

  const secondaryAddresses = useMemo(
    () => profile?.addresses.filter((address) => !address.isDefault) ?? [],
    [profile?.addresses],
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwords.newPassword),
    [passwords.newPassword],
  );

  const canAttemptChangePassword =
    passwords.currentPassword.length > 0 &&
    passwords.newPassword.length > 0 &&
    passwords.confirmPassword.length > 0 &&
    !passwordSaving;

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
      .then((response) => {
        const data = response.data;
        setProfile(data);
        setName(data.name);
        setPhone(data.phone ?? '');
        setAvatarUrl(data.avatarUrl ?? '');
      })
      .catch(() => toast.error('Không thể tải hồ sơ.'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetch(`${VIETNAM_ADMIN_API}/p/`)
      .then((response) => response.json())
      .then((data: ProvinceOption[]) => setProvinceOptions(data))
      .catch(() => toast.error('Không thể tải danh sách tỉnh/thành.'));
  }, []);

  useEffect(() => {
    if (!addressOpen || !addressDraft.province || selectedProvinceCode || provinceOptions.length === 0) {
      return;
    }

    const province = provinceOptions.find((item) => item.name === addressDraft.province);
    if (!province) {
      return;
    }

    void loadDistricts(String(province.code), addressDraft.district, addressDraft.ward);
  }, [addressOpen, addressDraft.province, addressDraft.district, addressDraft.ward, provinceOptions, selectedProvinceCode]);

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

  const refreshProfile = async () => {
    const response = await usersApi.getProfile();
    setProfile(response.data);
    syncUserStorage(response.data);
    return response.data;
  };

  const loadDistricts = async (
    provinceCode: string,
    districtNameToSelect?: string,
    wardNameToSelect?: string,
  ) => {
    setAddressOptionsLoading(true);
    try {
      const response = await fetch(`${VIETNAM_ADMIN_API}/p/${provinceCode}?depth=2`);
      const data = (await response.json()) as ProvinceOption & { districts: DistrictOption[] };
      setSelectedProvinceCode(provinceCode);
      setDistrictOptions(data.districts ?? []);

      if (districtNameToSelect) {
        const district = data.districts?.find((item) => item.name === districtNameToSelect);
        if (district) {
          await loadWards(String(district.code), wardNameToSelect);
        }
      }
    } catch {
      toast.error('Không thể tải danh sách quận/huyện.');
    } finally {
      setAddressOptionsLoading(false);
    }
  };

  const loadWards = async (districtCode: string, wardNameToSelect?: string) => {
    setAddressOptionsLoading(true);
    try {
      const response = await fetch(`${VIETNAM_ADMIN_API}/d/${districtCode}?depth=2`);
      const data = (await response.json()) as DistrictOption & { wards: WardOption[] };
      setSelectedDistrictCode(districtCode);
      setWardOptions(data.wards ?? []);

      if (wardNameToSelect) {
        const ward = data.wards?.find((item) => item.name === wardNameToSelect);
        if (ward) {
          setSelectedWardCode(String(ward.code));
        }
      }
    } catch {
      toast.error('Không thể tải danh sách phường/xã.');
    } finally {
      setAddressOptionsLoading(false);
    }
  };

  const handleProvinceChange = (provinceCode: string) => {
    const province = provinceOptions.find((item) => String(item.code) === provinceCode);

    setSelectedProvinceCode(provinceCode);
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setDistrictOptions([]);
    setWardOptions([]);
    setAddressDraft((value) => ({
      ...value,
      province: province?.name ?? '',
      district: '',
      ward: '',
    }));

    if (provinceCode) {
      void loadDistricts(provinceCode);
    }
  };

  const handleDistrictChange = (districtCode: string) => {
    const district = districtOptions.find((item) => String(item.code) === districtCode);

    setSelectedDistrictCode(districtCode);
    setSelectedWardCode('');
    setWardOptions([]);
    setAddressDraft((value) => ({
      ...value,
      district: district?.name ?? '',
      ward: '',
    }));

    if (districtCode) {
      void loadWards(districtCode);
    }
  };

  const handleWardChange = (wardCode: string) => {
    const ward = wardOptions.find((item) => String(item.code) === wardCode);

    setSelectedWardCode(wardCode);
    setAddressDraft((value) => ({
      ...value,
      ward: ward?.name ?? '',
    }));
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

  const openAddressDialog = (address?: Address) => {
    setEditingAddress(address ?? null);
    setSelectedProvinceCode('');
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setDistrictOptions([]);
    setWardOptions([]);
    setAddressDraft(
      address
        ? {
            receiverName: address.receiverName,
            receiverPhone: address.receiverPhone,
            province: address.province,
            district: address.district,
            ward: address.ward,
            detail: address.detail,
            isDefault: address.isDefault,
          }
        : emptyAddress,
    );
    setAddressOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!addressDraft.province || !addressDraft.district || !addressDraft.ward) {
      toast.error('Vui lòng chọn đầy đủ tỉnh/thành, quận/huyện và phường/xã.');
      return;
    }

    try {
      if (editingAddress) {
        await usersApi.updateAddress(editingAddress.id, addressDraft);
        toast.success('Đã cập nhật địa chỉ.');
      } else {
        await usersApi.createAddress(addressDraft);
        toast.success('Đã thêm địa chỉ mới.');
      }

      await refreshProfile();
      setAddressOpen(false);
    } catch {
      toast.error('Không thể lưu địa chỉ.');
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      await usersApi.setDefaultAddress(id);
      await refreshProfile();
      toast.success('Đã đặt địa chỉ chính.');
    } catch {
      toast.error('Không thể đặt địa chỉ chính.');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await usersApi.deleteAddress(id);
      await refreshProfile();
      toast.success('Đã xóa địa chỉ.');
    } catch {
      toast.error('Không thể xóa địa chỉ.');
    }
  };

  const submitPasswordChange = async () => {
    setPasswordSaving(true);
    try {
      await usersApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Đã đổi mật khẩu.');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        'Không thể đổi mật khẩu. Tài khoản Google sẽ không dùng form này.';
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
    try {
      await usersApi.deleteAccount();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      toast.success('Tài khoản đã được xóa.');
      router.push('/login');
    } catch {
      toast.error('Không thể xóa tài khoản.');
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

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]"
      style={{ fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif' }}
    >
      <nav className="sticky top-0 z-40 border-b border-[#ECE7DE] bg-white/90 shadow-[0_10px_30px_rgba(26,26,26,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/home"
            className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-[var(--text-main)] transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
          >
            <BrandMark size="sm" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-lg font-extrabold tracking-normal">PetMatch</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F766E]">Store</span>
            </span>
          </Link>

          <div className="hidden items-center rounded-lg border border-[#EFEAE2] bg-[#FBFAF7] p-1 md:flex">
            {[
              { label: 'Khám phá', href: '/explore', icon: Search },
              { label: 'Yêu thích', href: '/favorites', icon: Heart },
              { label: 'Thú cưng', href: '/my-pets', icon: BadgeCheck },
            ].map((nav) => (
              <Link
                key={nav.label}
                href={nav.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-main)] hover:shadow-sm"
              >
                <nav.icon className="size-4" />
                {nav.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/spa"
              className="hidden h-10 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[#EFEAE2] hover:bg-[#FBFAF7] hover:text-[var(--text-main)] sm:flex"
            >
              <Scissors className="size-4" />
              Spa
            </Link>
            <span className="hidden h-10 items-center gap-1.5 rounded-md border border-[rgba(228,93,28,0.18)] bg-[var(--bg-demo-box)] px-3 text-sm font-extrabold text-[var(--primary-color)] shadow-[0_10px_20px_rgba(228,93,28,0.10)] sm:flex">
              <Store className="size-4" />
              Cửa hàng
            </span>
            <button
              type="button"
              className="relative inline-flex size-10 items-center justify-center rounded-md border border-[#EFEAE2] bg-white text-[var(--text-main)] shadow-sm transition hover:border-[rgba(228,93,28,0.28)] hover:text-[var(--primary-color)]"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--primary-color)] text-[10px] font-bold text-white shadow-sm">
                0
              </span>
            </button>
            <UserDropdown />
          </div>
        </div>
      </nav>

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
                  <span className="flex size-full items-center justify-center bg-[var(--primary-color)] text-4xl font-extrabold text-white">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                  {uploading ? (
                    <Loader2 className="size-6 animate-spin text-white" />
                  ) : (
                    <Camera className="size-7 text-white" />
                  )}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleAvatarChange}
                  disabled={uploading}
                />
              </label>

              <h1 className="mt-4 text-xl font-extrabold">{profile.name}</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{profile.email}</p>
              <span className="mt-3 rounded-full bg-[var(--bg-demo-box)] px-3 py-1 text-xs font-bold uppercase text-[var(--primary-color)]">
                {profile.role}
              </span>
            </div>

            <div className="px-5 pb-5">
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Stat label="Pets" value={profile.stats.pets} />
                <Stat label="Orders" value={profile.stats.orders} />
                <Stat label="Spent" value={currency.format(profile.stats.totalSpent)} />
              </div>
              <div className="mt-5 grid gap-2 rounded-lg bg-[#FBFAF7] p-3 text-sm">
                <InfoLine icon={Mail} label="Email" value={profile.email} />
                <InfoLine icon={Phone} label="Phone" value={profile.phone || 'Chưa cập nhật'} />
                <InfoLine icon={ShieldCheck} label="Status" value={profile.isVerified ? 'Đã xác thực' : 'Chưa xác thực'} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border-color)] bg-white p-4 shadow-[0_18px_50px_rgba(26,26,26,0.04)]">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Tiện ích nhanh
            </h2>
            <div className="flex flex-col gap-2">
              {shortcuts.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-page)]"
                >
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
                <p className="mt-1 text-xs leading-5 text-red-700/75">
                  Xóa tài khoản sẽ xóa hồ sơ và dữ liệu liên quan khỏi hệ thống.
                </p>
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
                  <AlertDialogDescription>
                    Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa tài khoản này không?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteAccount}>
                    Xóa vĩnh viễn
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="profile-card">
            <SectionHeader
              icon={UserRound}
              title="Hồ sơ cá nhân"
              description="Thông tin này được dùng cho đơn hàng, liên hệ và hiển thị trong hệ thống."
            />

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
                <input className="profile-input text-[var(--text-muted)]" value={profile.role} readOnly />
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
              <SectionHeader
                icon={Lock}
                title="Đổi mật khẩu"
                description="Cập nhật mật khẩu mới để tăng bảo mật cho tài khoản."
                compact
              />

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
                  <PasswordStrengthMeter strength={passwordStrength} />
                </div>

                <PasswordRowLabel>Nhập lại mật khẩu</PasswordRowLabel>
                <PasswordControl
                  value={passwords.confirmPassword}
                  visible={showPasswords.confirm}
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
              <SectionHeader
                icon={MapPin}
                title="Địa chỉ giao hàng"
                description="Địa chỉ chính sẽ được ưu tiên khi tạo đơn hàng."
                compact
              />
              <button type="button" className="profile-secondary-button" onClick={() => openAddressDialog()}>
                <Plus className="size-4" />
                Thêm địa chỉ
              </button>
            </div>

            <div className="grid gap-3">
              {defaultAddress && (
                <AddressRow
                  address={defaultAddress}
                  onEdit={openAddressDialog}
                  onDelete={handleDeleteAddress}
                  onSetDefault={handleSetDefaultAddress}
                />
              )}
              {secondaryAddresses.map((address) => (
                <AddressRow
                  key={address.id}
                  address={address}
                  onEdit={openAddressDialog}
                  onDelete={handleDeleteAddress}
                  onSetDefault={handleSetDefaultAddress}
                />
              ))}
              {!profile.addresses.length && (
                <div className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center text-sm text-[var(--text-muted)]">
                  Chưa có địa chỉ giao hàng.
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

      <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Người nhận">
              <input className="profile-input" value={addressDraft.receiverName} onChange={(event) => setAddressDraft((value) => ({ ...value, receiverName: event.target.value }))} />
            </Field>
            <Field label="Số điện thoại">
              <input className="profile-input" value={addressDraft.receiverPhone} onChange={(event) => setAddressDraft((value) => ({ ...value, receiverPhone: event.target.value }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tỉnh/Thành">
                <select
                  className="profile-input"
                  value={selectedProvinceCode}
                  onChange={(event) => handleProvinceChange(event.target.value)}
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {provinceOptions.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quận/Huyện">
                <select
                  className="profile-input disabled:cursor-not-allowed disabled:bg-[#F1F1F1] disabled:text-[var(--text-muted)]"
                  value={selectedDistrictCode}
                  onChange={(event) => handleDistrictChange(event.target.value)}
                  disabled={!selectedProvinceCode || addressOptionsLoading}
                >
                  <option value="">{selectedProvinceCode ? 'Chọn quận/huyện' : 'Chọn tỉnh trước'}</option>
                  {districtOptions.map((district) => (
                    <option key={district.code} value={district.code}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phường/Xã">
                <select
                  className="profile-input disabled:cursor-not-allowed disabled:bg-[#F1F1F1] disabled:text-[var(--text-muted)]"
                  value={selectedWardCode}
                  onChange={(event) => handleWardChange(event.target.value)}
                  disabled={!selectedDistrictCode || addressOptionsLoading}
                >
                  <option value="">{selectedDistrictCode ? 'Chọn phường/xã' : 'Chọn quận trước'}</option>
                  {wardOptions.map((ward) => (
                    <option key={ward.code} value={ward.code}>
                      {ward.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {addressOptionsLoading && (
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <Loader2 className="size-3.5 animate-spin text-[var(--primary-color)]" />
                Đang tải dữ liệu hành chính...
              </div>
            )}
            <Field label="Địa chỉ chi tiết">
              <input className="profile-input" value={addressDraft.detail} onChange={(event) => setAddressDraft((value) => ({ ...value, detail: event.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={addressDraft.isDefault}
                onChange={(event) => setAddressDraft((value) => ({ ...value, isDefault: event.target.checked }))}
              />
              Đặt làm địa chỉ chính
            </label>
          </div>
          <DialogFooter>
            <button type="button" className="profile-secondary-button" onClick={() => setAddressOpen(false)}>
              Hủy
            </button>
            <button type="button" className="profile-primary-button" onClick={handleSaveAddress}>
              <Save className="size-4" />
              Lưu địa chỉ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-[var(--primary-color)]" />
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-sm font-semibold">{value}</span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
}) {
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

function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  return (
    <div className="-mt-1 grid gap-1">
      <div className="h-1 overflow-hidden rounded-full bg-[#ECE7DE]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: strength.width,
            backgroundColor: strength.color,
          }}
        />
      </div>
      <p
        className="min-h-4 text-[11px] font-semibold leading-4"
        style={{ color: strength.color === 'transparent' ? 'var(--text-muted)' : strength.color }}
      >
        {strength.label || 'Nhập mật khẩu mới để kiểm tra độ mạnh'}
      </p>
    </div>
  );
}

function PasswordRowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm font-semibold text-[var(--text-main)] lg:self-center">
      {children}
    </div>
  );
}

function PasswordControl({
  value,
  visible,
  inputRef,
  isNewPassword = false,
  onToggle,
  onChange,
}: {
  value: string;
  visible: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  isNewPassword?: boolean;
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

function AddressRow({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[#FFFEFC] p-4 transition hover:border-[rgba(228,93,28,0.22)] hover:shadow-[0_14px_34px_rgba(26,26,26,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold">{address.receiverName}</p>
            <span className="text-sm text-[var(--text-muted)]">{address.receiverPhone}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${address.isDefault ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
              {address.isDefault ? 'Địa chỉ chính' : 'Địa chỉ phụ'}
            </span>
          </div>
          <div className="mt-2 flex min-w-0 items-start gap-2 text-sm text-[var(--text-muted)]">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--primary-color)]" />
            <p>{address.detail}, {address.ward}, {address.district}, {address.province}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!address.isDefault && (
            <button type="button" className="profile-secondary-button" onClick={() => onSetDefault(address.id)}>
              <Check className="size-4" />
              Đặt chính
            </button>
          )}
          <button type="button" className="profile-secondary-button" onClick={() => onEdit(address)}>
            Sửa
          </button>
          <button type="button" className="rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50" onClick={() => onDelete(address.id)}>
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
