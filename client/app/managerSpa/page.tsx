'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Scissors,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Users,
  Eye,
  Trash2,
  Edit2,
  Check,
  Loader2,
  DollarSign,
  TrendingUp,
  Award,
  MessageSquare,
  HelpCircle,
  Folder,
  FolderKanban,
  CheckCircle,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  User,
  Phone,
  MapPin,
  ShieldCheck,
  Star,
  Camera,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { spaApi } from '@/lib/api/spa';
import { uploadImages } from '@/lib/api/uploads';

function SpaManagerConsoleContent() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';
  const [managerUser, setManagerUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setManagerUser(JSON.parse(stored)); } catch (e) { }
    }
  }, []);
  // states
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [managerBrands, setManagerBrands] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackSearch, setFeedbackSearch] = useState<string>('');
  const [feedbackStarFilter, setFeedbackStarFilter] = useState<string>('ALL');

  // Assignment & Detail states
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<any | null>(null);
  const [managerStaffs, setManagerStaffs] = useState<any[]>([]);
  const [availableStaffsMap, setAvailableStaffsMap] = useState<Record<string, any[]>>({});
  const [selectedAssignStaffMap, setSelectedAssignStaffMap] = useState<Record<string, string>>({});
  const [assignConfirmBooking, setAssignConfirmBooking] = useState<any | null>(null);
  const [assignConfirmStaff, setAssignConfirmStaff] = useState<{ id: string; name: string } | null>(null);
  const [assigningLoading, setAssigningLoading] = useState<boolean>(false);

  // Helper to resolve subServices for any booking in Manager view
  const getManagerBookingSubServices = (b: any) => {
    if (!b) return [];
    if (b.subServices && b.subServices.length > 0) {
      return b.subServices;
    }
    if (b.subServiceIds && b.subServiceIds.length > 0 && services.length > 0) {
      const resolved = b.subServiceIds
        .map((id: string) => services.find((s: any) => s.id === id))
        .filter(Boolean);
      if (resolved.length > 0) return resolved;
    }
    return [];
  };

  // Helper to compute sub-services total revenue (even when IDs can't be resolved from DB)
  const getSubServicesTotal = (b: any) => {
    if (!b) return 0;
    const subList = getManagerBookingSubServices(b);
    if (subList.length > 0) {
      return subList.reduce((sum: number, s: any) => sum + (s?.price || 0), 0);
    }
    // Fallback: if subServiceIds exist but can't resolve, compute from total - main
    if (b.subServiceIds && b.subServiceIds.length > 0) {
      const mainPrice = b.priceSnapshot || b.service?.price || 0;
      const total = b.totalPrice ?? b.priceSnapshot ?? 0;
      return Math.max(0, total - mainPrice - (b.discountAmount || 0));
    }
    return 0;
  };

  // Reschedule states
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);

  // Service modal states
  const [serviceModalOpen, setServiceModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({
    brandId: '',
    name: '',
    description: '',
    imageUrl: '',
    price: '',
    durationMin: '60',
    durationMax: '',
    isMain: true,
    species: 'ALL' as 'ALL' | 'DOG' | 'CAT',
    petWeightMin: '',
    petWeightMax: '',
    isActive: true
  });
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState<string | null>(null);
  const [submittingService, setSubmittingService] = useState<boolean>(false);

  const handleServiceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ được chọn tệp hình ảnh. Không được tải tệp định dạng khác.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5 MB.');
      return;
    }
    if (serviceImagePreview) {
      URL.revokeObjectURL(serviceImagePreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setServiceImageFile(file);
    setServiceImagePreview(previewUrl);
  };

  const handleClearServiceImage = () => {
    if (serviceImagePreview) {
      URL.revokeObjectURL(serviceImagePreview);
    }
    setServiceImageFile(null);
    setServiceImagePreview(null);
    setServiceForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  // Booking search and filters
  const [bookingSearch, setBookingSearch] = useState<string>('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [bookingDateFilterType, setBookingDateFilterType] = useState<string>('ALL');
  const [bookingCustomDate, setBookingCustomDate] = useState<string>('');
  const [bookingStartDate, setBookingStartDate] = useState<string>('');
  const [bookingEndDate, setBookingEndDate] = useState<string>('');
  const [bookingTimeSlotFilter, setBookingTimeSlotFilter] = useState<string>('ALL');

  // Service filters
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL');
  const [serviceBrandFilter, setServiceBrandFilter] = useState<string>('ALL');

  // Category modal & filter states
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    isMain: true,
    status: 'ACTIVE' as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED'
  });
  const [submittingCategory, setSubmittingCategory] = useState<boolean>(false);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<string>('ALL');

  const [expandedServiceGroups, setExpandedServiceGroups] = useState<Record<string, boolean>>({});

  const toggleServiceGroup = (groupKey: string) => {
    setExpandedServiceGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const groupedServices = useMemo(() => {
    const map = new Map<string, {
      groupKey: string;
      baseName: string;
      isMain: boolean;
      categoryName: string;
      items: any[];
      totalBookings: number;
      minPrice: number;
      maxPrice: number;
      minDuration: number;
      maxDuration: number;
      minWeight: number | null;
      maxWeight: number | null;
    }>();

    services.forEach((s: any) => {
      if (serviceTypeFilter === 'MAIN' && !s.isMain) return;
      if (serviceTypeFilter === 'SUB' && s.isMain) return;
      if (serviceBrandFilter !== 'ALL' && (s.categoryId || s.brandId) !== serviceBrandFilter) return;

      const categoryName = s.category?.name || s.brand?.name || 'Grooming Spa';
      let cleanName = (s.name || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*\d+(\.\d+)?\s*-\s*\d+(\.\d+)?\s*kg.*/gi, '')
        .replace(/\s*<\s*\d+(\.\d+)?\s*kg.*/gi, '')
        .replace(/\s*>\s*\d+(\.\d+)?\s*kg.*/gi, '')
        .trim();

      if (!cleanName) cleanName = categoryName || s.name;

      const groupKey = `${cleanName}_${s.isMain ? 'MAIN' : 'SUB'}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          baseName: cleanName,
          isMain: s.isMain,
          categoryName,
          items: [s],
          totalBookings: s._count?.bookings || 0,
          minPrice: s.price,
          maxPrice: s.price,
          minDuration: s.durationMin || 0,
          maxDuration: s.durationMin || 0,
          minWeight: s.petWeightMin,
          maxWeight: s.petWeightMax,
        });
      } else {
        const group = map.get(groupKey)!;
        group.items.push(s);
        group.totalBookings += s._count?.bookings || 0;
        group.minPrice = Math.min(group.minPrice, s.price);
        group.maxPrice = Math.max(group.maxPrice, s.price);
        group.minDuration = Math.min(group.minDuration, s.durationMin || 0);
        group.maxDuration = Math.max(group.maxDuration, s.durationMin || 0);
        if (s.petWeightMin !== null && (group.minWeight === null || s.petWeightMin < group.minWeight)) {
          group.minWeight = s.petWeightMin;
        }
        if (s.petWeightMax !== null && (group.maxWeight === null || s.petWeightMax > group.maxWeight)) {
          group.maxWeight = s.petWeightMax;
        }
      }
    });

    const list = Array.from(map.values());

    // Sort items within each group by min weight
    list.forEach((g) => {
      g.items.sort((a, b) => (a.petWeightMin ?? 0) - (b.petWeightMin ?? 0));
    });

    // Sort groups ALPHABETICALLY by baseName (A-Z)
    list.sort((a, b) => a.baseName.localeCompare(b.baseName, 'vi', { sensitivity: 'base' }));

    return list;
  }, [services, serviceTypeFilter, serviceBrandFilter]);

  // Filter SpaBrand options in form based on selected classification (isMain)
  const filteredBrandsForForm = useMemo(() => {
    return managerBrands.filter((b: any) => {
      if (serviceForm.isMain) {
        return b.isMain !== false;
      } else {
        return b.isMain === false;
      }
    });
  }, [managerBrands, serviceForm.isMain]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f: any) => {
      const uName = (f.user?.name || '').toLowerCase();
      const pName = (f.booking?.petName || f.booking?.pet?.name || '').toLowerCase();
      const q = feedbackSearch.toLowerCase().trim();
      if (q && !uName.includes(q) && !pName.includes(q)) return false;
      if (feedbackStarFilter !== 'ALL') {
        const starNum = Number(feedbackStarFilter);
        if (f.rateServices !== starNum && f.rateStaff !== starNum) return false;
      }
      return true;
    });
  }, [feedbacks, feedbackSearch, feedbackStarFilter]);

  const handleClassificationChange = (isMainSelected: boolean) => {
    const matchingBrands = managerBrands.filter((b: any) =>
      isMainSelected ? b.isMain !== false : b.isMain === false
    );

    const currentBrandValid = matchingBrands.some((b: any) => b.id === serviceForm.brandId);
    const newBrandId = currentBrandValid ? serviceForm.brandId : (matchingBrands[0]?.id || '');

    setServiceForm((prev) => ({
      ...prev,
      isMain: isMainSelected,
      brandId: newBrandId,
    }));
  };


  // Fetch branches and categories managed by this manager
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesRes, categoriesRes] = await Promise.all([
          spaApi.getManagerBranches(),
          spaApi.getManagerCategories(),
        ]);
        const bData = branchesRes.data || [];
        setBranches(bData);
        setManagerBrands(categoriesRes.data || []);
        if (bData.length > 0) {
          setSelectedBranchId(bData[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        toast.error('Lỗi khi tải thông tin quản lý.');
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch data based on active tab and selected branch
  const refreshData = async () => {
    // For tabs that don't need a branch (categories, services), don't block on selectedBranchId
    const needsBranch = ['dashboard', 'bookings', 'staffs', 'feedbacks'].includes(currentTab);
    if (needsBranch && !selectedBranchId) return;
    setLoading(true);
    try {
      if (currentTab === 'dashboard') {
        const statsRes = await spaApi.getManagerDashboardStats(selectedBranchId);
        setStats(statsRes.data);

        // Auto fetch available staffs for confirmed bookings
        const todayBookings = statsRes.data?.todayBookings || [];
        const confirmed = todayBookings.filter((b: any) => b.status === 'CONFIRMED');
        const staffMap: Record<string, any[]> = {};
        for (const b of confirmed) {
          try {
            const stRes = await spaApi.getAvailableStaffForBooking(b.id);
            staffMap[b.id] = stRes.data || [];
          } catch (e) {
            console.error(e);
          }
        }
        setAvailableStaffsMap(staffMap);

      } else if (currentTab === 'bookings') {
        const [bookingsRes, staffsRes, servicesRes] = await Promise.all([
          spaApi.getManagerBookings(selectedBranchId),
          spaApi.getManagerStaffs(selectedBranchId).catch(() => ({ data: [] })),
          spaApi.getServices().catch(() => ({ data: [] })),
        ]);
        const bList = bookingsRes.data || [];
        setBookings(bList);
        setManagerStaffs(staffsRes.data || []);
        if (servicesRes.data) setServices(servicesRes.data);

        // Auto fetch available staff for bookings needing assignment
        const needStaffBookings = bList.filter((b: any) => !b.staffId && ['PENDING', 'CONFIRMED', 'CHECK_IN', 'LATE'].includes(b.status));
        const staffMap: Record<string, any[]> = {};
        await Promise.all(
          needStaffBookings.map(async (b: any) => {
            try {
              const stRes = await spaApi.getAvailableStaffForBooking(b.id);
              staffMap[b.id] = stRes.data || [];
            } catch (e) {
              console.error(e);
            }
          })
        );
        setAvailableStaffsMap(staffMap);
      } else if (currentTab === 'services') {
        const servicesRes = await spaApi.getManagerServices();
        setServices(servicesRes.data || []);
      } else if (currentTab === 'categories') {
        const categoriesRes = await spaApi.getManagerCategories();
        setManagerBrands(categoriesRes.data || []);
      } else if (currentTab === 'staffs') {
        const staffsRes = await spaApi.getManagerStaffs(selectedBranchId);
        setStaffs(staffsRes.data || []);
      } else if (currentTab === 'feedbacks') {
        const feedbacksRes = await spaApi.getManagerFeedbacks(selectedBranchId);
        setFeedbacks(feedbacksRes.data || []);
      }
    } catch (err) {
      toast.error('Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedBranchId, currentTab]);

  // Fetch slots for reschedule when date changes
  useEffect(() => {
    if (selectedBookingDetail?.id) {
      spaApi
        .getAvailableStaffForBooking(selectedBookingDetail.id)
        .then((stRes) => {
          setAvailableStaffsMap((prev) => ({
            ...prev,
            [selectedBookingDetail.id]: stRes.data || [],
          }));
        })
        .catch(console.error);
    }
  }, [selectedBookingDetail?.id]);

  useEffect(() => {
    const fetchRescheduleSlots = async () => {
      if (!rescheduleBooking || !rescheduleDate) return;
      setLoadingRescheduleSlots(true);
      try {
        const duration = rescheduleBooking.service?.durationMin || 30;
        const res = await spaApi.getAvailability(selectedBranchId, rescheduleDate, duration);
        setRescheduleSlots(res.data || []);
      } catch (err) {
        toast.error('Lỗi khi tải khung giờ khả dụng.');
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };
    fetchRescheduleSlots();
  }, [rescheduleBooking, rescheduleDate]);

  // Fetch available staff list whenever selectedBookingDetail opens
  useEffect(() => {
    if (selectedBookingDetail && selectedBookingDetail.id) {
      spaApi.getAvailableStaffForBooking(selectedBookingDetail.id)
        .then((res) => {
          setAvailableStaffsMap((prev) => ({ ...prev, [selectedBookingDetail.id]: res.data || [] }));
        })
        .catch(console.error);
    }
  }, [selectedBookingDetail]);

  // Confirm booking to CONFIRMED
  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await spaApi.confirmBooking(bookingId);
      toast.success('Xác nhận lịch hẹn thành công!');

      // Load available staff immediately
      const stRes = await spaApi.getAvailableStaffForBooking(bookingId);
      setAvailableStaffsMap(prev => ({ ...prev, [bookingId]: stRes.data || [] }));

      // Refresh page data
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xác nhận lịch hẹn.');
    }
  };

  // Assign staff to booking
  const handleAssignStaff = async () => {
    if (!assignConfirmBooking || !assignConfirmStaff) return;
    setAssigningLoading(true);
    try {
      await spaApi.assignStaff(assignConfirmBooking.id, assignConfirmStaff.id);
      toast.success(`Đã phân công lịch hẹn cho ${assignConfirmStaff.name}!`);
      setAssignConfirmBooking(null);
      setAssignConfirmStaff(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi phân công nhân viên.');
    } finally {
      setAssigningLoading(false);
    }
  };

  // Toggle staff status (ACTIVE / INACTIVE)
  const handleToggleStaffStatus = async (staffId: string) => {
    try {
      await spaApi.toggleStaffStatus(staffId);
      toast.success('Cập nhật trạng thái nhân viên thành công!');
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái nhân viên.');
    }
  };

  // Reschedule booking submission
  const handleRescheduleSubmit = async () => {
    if (!rescheduleBooking || !rescheduleDate || !selectedRescheduleSlot) {
      toast.error('Vui lòng chọn đầy đủ ngày và giờ.');
      return;
    }
    setSubmittingReschedule(true);
    try {
      const scheduledAt = `${rescheduleDate}T${selectedRescheduleSlot}:00`;
      await spaApi.rescheduleBooking(rescheduleBooking.id, scheduledAt);
      toast.success('Đổi lịch hẹn của khách hàng thành công!');
      setRescheduleBooking(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi đổi lịch hẹn.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Apply late discount 10%
  const handleApplyLateDiscount = async (bookingId: string) => {
    try {
      await spaApi.applyLateDiscount(bookingId);
      toast.success('Đã tự động giảm 10% giá đơn hàng do trễ hẹn!');
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi áp dụng giảm giá.');
    }
  };

  const handleMinWeightChange = (val: string) => {
    setServiceForm((prev) => ({ ...prev, petWeightMin: val }));
  };

  const handleMaxWeightChange = (val: string) => {
    setServiceForm((prev) => ({ ...prev, petWeightMax: val }));
  };

  // Validate weight inputs immediately when user finishes typing (onBlur)
  const handleWeightBlur = () => {
    const minVal = serviceForm.petWeightMin;
    const maxVal = serviceForm.petWeightMax;

    if (minVal !== '' && minVal !== null && minVal !== undefined) {
      const minNum = parseFloat(minVal);
      if (!isNaN(minNum) && minNum < 0) {
        toast.error('Cân nặng tối thiểu không được nhỏ hơn 0kg!');
        return;
      }
    }

    if (maxVal !== '' && maxVal !== null && maxVal !== undefined) {
      const maxNum = parseFloat(maxVal);
      if (!isNaN(maxNum) && maxNum < 0) {
        toast.error('Cân nặng tối đa không được nhỏ hơn 0kg!');
        return;
      }
    }

    if (
      minVal !== '' && minVal !== null && minVal !== undefined &&
      maxVal !== '' && maxVal !== null && maxVal !== undefined
    ) {
      const minNum = parseFloat(minVal);
      const maxNum = parseFloat(maxVal);
      if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
        toast.error('Cân nặng tối thiểu (min) phải nhỏ hơn hoặc bằng cân nặng tối đa (max)!');
      }
    }
  };

  // Format weight display range according to business rules:
  // - null/empty both -> "Tất cả cân nặng"
  // - min == max -> "minkg" (e.g. 0kg)
  // - max only -> "0 - maxkg"
  // - min only -> ">minkg"
  // - both min & max -> "min - maxkg"
  const formatWeightRange = (min?: number | null, max?: number | null): string => {
    const hasMin = min !== null && min !== undefined && min !== ('' as any) && !isNaN(Number(min));
    const hasMax = max !== null && max !== undefined && max !== ('' as any) && !isNaN(Number(max));

    if (!hasMin && !hasMax) {
      return 'Tất cả cân nặng';
    }

    const minNum = hasMin ? Number(min) : null;
    const maxNum = hasMax ? Number(max) : null;

    if (minNum !== null && maxNum !== null) {
      if (minNum === maxNum) {
        return `${minNum}kg`;
      }
      return `${minNum} - ${maxNum}kg`;
    }

    if (minNum === null && maxNum !== null) {
      return `0 - ${maxNum}kg`;
    }

    if (minNum !== null && maxNum === null) {
      return `>${minNum}kg`;
    }

    return 'Tất cả cân nặng';
  };

  // Service submit with complete field validation
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Brand
    if (!serviceForm.brandId) {
      toast.error('Vui lòng chọn Danh mục dịch vụ!');
      return;
    }

    // 2. Validate Service Name
    if (!serviceForm.name || serviceForm.name.trim().length < 2) {
      toast.error('Vui lòng nhập Tên dịch vụ (tối thiểu 2 ký tự)!');
      return;
    }

    // 3. Validate Price (> 0)
    const priceNum = parseVNDInput(serviceForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Vui lòng nhập Giá dịch vụ hợp lệ (lớn hơn 0đ)!');
      return;
    }

    // 4. Validate Duration (> 0)
    const durationNum = Number(String(serviceForm.durationMin || '').replace(/\D/g, ''));
    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error('Thời gian thực hiện phải lớn hơn 0 phút!');
      return;
    }

    // 5. Validate Weight Range after submission (sau khi nhập xong)
    const weightMinNum = serviceForm.petWeightMin !== '' && serviceForm.petWeightMin !== null && serviceForm.petWeightMin !== undefined
      ? Number(serviceForm.petWeightMin)
      : null;
    const weightMaxNum = serviceForm.petWeightMax !== '' && serviceForm.petWeightMax !== null && serviceForm.petWeightMax !== undefined
      ? Number(serviceForm.petWeightMax)
      : null;

    if (weightMinNum !== null && (isNaN(weightMinNum) || weightMinNum < 0)) {
      toast.error('Cân nặng tối thiểu không được nhỏ hơn 0kg!');
      return;
    }

    if (weightMaxNum !== null && (isNaN(weightMaxNum) || weightMaxNum < 0)) {
      toast.error('Cân nặng tối đa không được nhỏ hơn 0kg!');
      return;
    }

    if (weightMinNum !== null && weightMaxNum !== null && weightMinNum > weightMaxNum) {
      toast.error('Cân nặng tối thiểu (min) phải nhỏ hơn hoặc bằng cân nặng tối đa (max)!');
      return;
    }

    // 6. Validate Image Upload for New Service (Mandatory)
    if (!editingService && !serviceImageFile && !serviceForm.imageUrl) {
      toast.error('Vui lòng chọn và tải 1 ảnh dịch vụ lên! (Bắt buộc khi thêm mới dịch vụ)');
      return;
    }

    setSubmittingService(true);
    try {
      let finalImageUrl: string | undefined = serviceForm.imageUrl || undefined;
      if (serviceImageFile) {
        const uploaded = await uploadImages([serviceImageFile], 'spa-result');
        if (uploaded && uploaded[0]?.url) {
          finalImageUrl = uploaded[0].url;
        }
      }

      const data = {
        brandId: serviceForm.brandId,
        name: serviceForm.name.trim(),
        description: serviceForm.description ? serviceForm.description.trim() : undefined,
        imageUrl: finalImageUrl,
        price: priceNum,
        durationMin: durationNum,
        durationMax: durationNum,
        isMain: serviceForm.isMain,
        species: serviceForm.species === 'ALL' ? undefined : serviceForm.species,
        petWeightMin: weightMinNum !== null ? weightMinNum : null,
        petWeightMax: weightMaxNum !== null ? weightMaxNum : null,
        isActive: serviceForm.isActive
      };

      if (editingService) {
        await spaApi.updateManagerService(editingService.id, data);
        toast.success('Cập nhật dịch vụ và ảnh thành công!');
      } else {
        await spaApi.createManagerService(data);
        toast.success('Thêm dịch vụ mới thành công!');
      }
      setServiceModalOpen(false);
      setEditingService(null);
      setServiceImageFile(null);
      setServiceImagePreview(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu dịch vụ.');
    } finally {
      setSubmittingService(false);
    }
  };

  // Format price input live while typing (10000 -> 10.000)
  const formatVNDInput = (val: string) => {
    const digits = String(val || '').replace(/\D/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('vi-VN');
  };

  const parseVNDInput = (val: string) => {
    const digits = String(val || '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  };

  // Open edit service modal
  const handleEditServiceClick = (service: any) => {
    setEditingService(service);
    const selectedCatId = service.categoryId || service.category?.id || service.brandId || service.brand?.id || (managerBrands[0]?.id || '');
    const serviceIsMain = service.isMain ?? (service.category?.isMain ?? true);
    setServiceForm({
      brandId: selectedCatId,
      name: service.name || '',
      description: service.description || '',
      imageUrl: service.imageUrl || '',
      price: service.price ? Number(service.price).toLocaleString('vi-VN') : '',
      durationMin: String(service.durationMin || 60),
      durationMax: service.durationMax ? String(service.durationMax) : '',
      isMain: serviceIsMain,
      species: service.species || 'ALL',
      petWeightMin: service.petWeightMin !== null && service.petWeightMin !== undefined ? String(service.petWeightMin) : '',
      petWeightMax: service.petWeightMax !== null && service.petWeightMax !== undefined ? String(service.petWeightMax) : '',
      isActive: service.isActive ?? true
    });
    setServiceImageFile(null);
    setServiceImagePreview(service.imageUrl || null);
    setServiceModalOpen(true);
  };

  // Open add service modal
  const handleAddServiceClick = () => {
    setEditingService(null);
    const defaultMainBrand = managerBrands.find((b: any) => b.isMain !== false);
    const brandId = defaultMainBrand ? defaultMainBrand.id : (managerBrands[0]?.id || '');
    setServiceForm({
      brandId,
      name: '',
      description: '',
      imageUrl: '',
      price: '',
      durationMin: '60',
      durationMax: '60',
      isMain: true,
      species: 'ALL',
      petWeightMin: '',
      petWeightMax: '',
      isActive: true
    });
    setServiceImageFile(null);
    setServiceImagePreview(null);
    setServiceModalOpen(true);
  };

  // Category Handlers
  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      isMain: true,
      status: 'ACTIVE',
    });
    setCategoryModalOpen(true);
  };

  const handleEditCategoryClick = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      description: cat.description || '',
      isMain: cat.isMain ?? true,
      status: cat.status || 'ACTIVE',
    });
    setCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name || categoryForm.name.trim().length < 2) {
      toast.error('Vui lòng nhập Tên danh mục (tối thiểu 2 ký tự)!');
      return;
    }

    setSubmittingCategory(true);
    try {
      const data = {
        name: categoryForm.name.trim(),
        description: categoryForm.description ? categoryForm.description.trim() : undefined,
        isMain: categoryForm.isMain,
        status: categoryForm.status,
      };

      if (editingCategory) {
        await spaApi.updateManagerCategory(editingCategory.id, data);
        toast.success('Cập nhật danh mục thành công!');
      } else {
        await spaApi.createManagerCategory(data);
        toast.success('Thêm danh mục mới thành công!');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      const res = await spaApi.getManagerCategories();
      setManagerBrands(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu danh mục.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategoryClick = async (cat: any) => {
    if (cat._count?.services > 0) {
      toast.error(`Không thể xóa danh mục đang có ${cat._count.services} dịch vụ!`);
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${cat.name}"?`)) return;

    try {
      await spaApi.deleteManagerCategory(cat.id);
      toast.success('Xóa danh mục thành công!');
      const res = await spaApi.getManagerCategories();
      setManagerBrands(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa danh mục.');
    }
  };

  const navigateToBookingsTab = (targetBooking?: any, filterStatus?: string, filterDate?: string) => {
    if (filterStatus) {
      setBookingStatusFilter(filterStatus);
    }
    if (filterDate) {
      setBookingDateFilterType('SPECIFIC_DATE');
      setBookingCustomDate(filterDate);
    }
    if (targetBooking) {
      setSelectedBookingDetail(targetBooking);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'bookings');
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('popstate'));
  };

  // Filter bookings list
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    // This week (Monday to Sunday)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    // This month (1st of month to last of month)
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return bookings.filter((b) => {
      const sName = b.service?.name || (b.mainServiceResolved as any)?.name || '';
      const cName = b.user?.name || '';
      const petName = b.petName || b.pet?.name || '';
      const matchesSearch =
        !bookingSearch ||
        sName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        cName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        petName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.id.toLowerCase().includes(bookingSearch.toLowerCase());

      const matchesStatus = bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter;

      const bookingDate = new Date(b.scheduledAt);
      const bDateStr = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;
      const bHour = String(bookingDate.getHours()).padStart(2, '0');
      const bMin = String(bookingDate.getMinutes()).padStart(2, '0');
      const bTimeSlot = `${bHour}:${bMin}`;

      let matchesDate = true;
      if (bookingDateFilterType === 'TODAY') {
        matchesDate = bDateStr === todayStr;
      } else if (bookingDateFilterType === 'TOMORROW') {
        matchesDate = bDateStr === tomorrowStr;
      } else if (bookingDateFilterType === 'YESTERDAY') {
        matchesDate = bDateStr === yesterdayStr;
      } else if (bookingDateFilterType === 'THIS_WEEK') {
        matchesDate = bookingDate >= monday && bookingDate <= sunday;
      } else if (bookingDateFilterType === 'THIS_MONTH') {
        matchesDate = bookingDate >= firstDayOfMonth && bookingDate <= lastDayOfMonth;
      } else if (bookingDateFilterType === 'SPECIFIC_DATE' && bookingCustomDate) {
        matchesDate = bDateStr === bookingCustomDate;
      } else if (bookingDateFilterType === 'CUSTOM_RANGE') {
        if (bookingStartDate && bookingEndDate) {
          matchesDate = bDateStr >= bookingStartDate && bDateStr <= bookingEndDate;
        } else if (bookingStartDate) {
          matchesDate = bDateStr >= bookingStartDate;
        } else if (bookingEndDate) {
          matchesDate = bDateStr <= bookingEndDate;
        }
      }

      let matchesTimeSlot = true;
      if (bookingTimeSlotFilter && bookingTimeSlotFilter !== 'ALL') {
        matchesTimeSlot = bTimeSlot === bookingTimeSlotFilter;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesTimeSlot;
    });
  }, [bookings, bookingSearch, bookingStatusFilter, bookingDateFilterType, bookingCustomDate, bookingStartDate, bookingEndDate, bookingTimeSlotFilter]);

  const dateFilterLabel = useMemo(() => {
    let datePart = '';
    if (bookingDateFilterType === 'TODAY') datePart = 'Hôm nay';
    else if (bookingDateFilterType === 'TOMORROW') datePart = 'Ngày mai';
    else if (bookingDateFilterType === 'YESTERDAY') datePart = 'Hôm qua';
    else if (bookingDateFilterType === 'THIS_WEEK') datePart = 'Tuần này';
    else if (bookingDateFilterType === 'THIS_MONTH') datePart = 'Tháng này';
    else if (bookingDateFilterType === 'SPECIFIC_DATE' && bookingCustomDate) {
      const parts = bookingCustomDate.split('-');
      if (parts.length === 3) {
        datePart = `Ngày ${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        datePart = `Ngày ${bookingCustomDate}`;
      }
    } else if (bookingDateFilterType === 'CUSTOM_RANGE') {
      if (bookingStartDate && bookingEndDate) datePart = `Từ ${bookingStartDate} đến ${bookingEndDate}`;
      else if (bookingStartDate) datePart = `Từ ${bookingStartDate}`;
      else if (bookingEndDate) datePart = `Đến ${bookingEndDate}`;
    }

    let timePart = '';
    if (bookingTimeSlotFilter && bookingTimeSlotFilter !== 'ALL') {
      timePart = `Khung giờ ${bookingTimeSlotFilter}`;
    }

    if (datePart && timePart) return `${datePart} • ${timePart}`;
    if (datePart) return datePart;
    if (timePart) return `${timePart} (Tất cả ngày)`;
    return '';
  }, [bookingDateFilterType, bookingCustomDate, bookingStartDate, bookingEndDate, bookingTimeSlotFilter]);

  const bookingCountsSummary = useMemo(() => {
    const total = filteredBookings.length;
    const pending = filteredBookings.filter((b) => b.status === 'PENDING').length;
    const needStaff = filteredBookings.filter((b) => (b.status === 'CONFIRMED' || b.status === 'CHECK_IN' || b.status === 'ARRIVED') && !b.staffId).length;
    const assigned = filteredBookings.filter((b) => b.status === 'ASSIGNED').length;
    const inProgress = filteredBookings.filter((b) => b.status === 'IN_PROGRESS').length;
    const completed = filteredBookings.filter((b) => b.status === 'COMPLETED').length;
    const cancelled = filteredBookings.filter((b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW').length;
    return { total, pending, needStaff, assigned, inProgress, completed, cancelled };
  }, [filteredBookings]);

  if (branches.length === 0 && !loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <AlertCircle className="size-12 text-red-500" />
        <p className="text-sm font-black text-gray-700">Tài khoản này chưa được phân công quản lý chi nhánh Spa nào.</p>
        <p className="text-xs text-gray-500">Vui lòng liên hệ Admin để gán quản lý chi nhánh trong AddressSpa.</p>
      </div>
    );
  }

  // Display branches names under name
  const branchNames = branches.map(b => b.name).join(', ');

  return (
    <div className="space-y-6">

      {/* Dynamic Purple Header */}
      <section className="bg-primary text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs text-orange-200 block uppercase tracking-wider font-extrabold">Spa Manager</span>
          <h2 className="text-2xl font-black">{managerUser?.name || 'Nguyễn Thị Mai'}</h2>
          <p className="text-xs text-orange-100 mt-1 font-medium flex items-center gap-1">
            📍 Quản lý: <span className="font-bold">{branchNames || 'Chi nhánh Spa'}</span>
          </p>
        </div>

        {/* Branch switcher dropdown if multiple branches */}
        {branches.length > 1 && (
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs font-bold text-orange-100">Chi nhánh hiển thị:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent border-0 font-bold text-white text-xs focus:ring-0 focus:outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="text-gray-900 font-semibold">{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-2 text-sm font-bold text-gray-500">Đang tải dữ liệu Spa...</span>
        </div>
      ) : (
        <>
          {/* TAB CONTENT: DASHBOARD */}
          {(currentTab === 'dashboard' || !currentTab) && stats && (
            <div className="space-y-6 animate-fadeIn">

              {/* Metrics cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase text-[#8A8980]">Lịch hẹn hôm nay</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-black text-gray-900">{stats.todayBookingsCount}</p>
                      {stats.unconfirmedBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('tab', 'bookings');
                            window.history.pushState({}, '', url.toString());
                            window.dispatchEvent(new Event('popstate'));
                          }}
                          className="text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded-full shadow-2xs transition cursor-pointer flex items-center gap-1"
                        >
                          🚨 {stats.unconfirmedBookingsCount} cần xác nhận ➔
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="size-10 rounded-full bg-orange-55 shadow-inner flex items-center justify-center text-primary shrink-0">
                    <Calendar className="size-5" />
                  </div>
                </div>
                {/* Metric 2 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Hoàn thành</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.completedBookingsCount}</p>
                  </div>
                  <div className="size-10 rounded-full bg-green-50 shadow-inner flex items-center justify-center text-green-600">
                    <CheckCircle2 className="size-5" />
                  </div>
                </div>
                {/* Metric 3 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Doanh thu</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{(stats.totalRevenue).toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="size-10 rounded-full bg-purple-50 shadow-inner flex items-center justify-center text-purple-700">
                    <TrendingUp className="size-5" />
                  </div>
                </div>
                {/* Metric 4 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Nhân viên</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.staffCount}</p>
                  </div>
                  <div className="size-10 rounded-full bg-blue-50 shadow-inner flex items-center justify-center text-blue-600">
                    <Users className="size-5" />
                  </div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Revenue & Rating by Service Group */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Doanh thu & Đánh giá theo nhóm dịch vụ</h3>
                    <span className="text-[11px] font-bold text-gray-400">Tỉ lệ sao trung bình</span>
                  </div>
                  <div className="space-y-3 pt-1">
                    {(() => {
                      const categoriesData = stats.revenueByService || stats.categoryBreakdown || [];
                      const maxVal = Math.max(...categoriesData.map((x: any) => x.value || 0), 1);

                      if (!categoriesData || categoriesData.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 py-6 text-center">Chưa có danh mục hoặc doanh thu nào để hiển thị.</p>
                        );
                      }

                      return categoriesData.map((item: any, idx: number) => {
                        const percent = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                        const rating = item.avgRating || 0;
                        return (
                          <div key={item.id || idx} className="space-y-1.5 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                              <span className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-900">{item.name}</span>
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-black">
                                  <span>{rating > 0 ? rating.toFixed(1) : '0'}</span>
                                  <div className="flex text-amber-400">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`size-3 ${star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                      />
                                    ))}
                                  </div>
                                </span>
                              </span>
                              <span className="text-primary font-black">{(item.value || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className="h-full bg-primary rounded-full transition-all duration-500 shadow-xs"
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Status distribution custom chart */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs lg:col-span-5 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Phân bổ trạng thái lịch hẹn</h3>
                  <div className="space-y-3 pt-2">
                    {stats.statusDistribution && stats.statusDistribution.length > 0 ? (
                      stats.statusDistribution.map((item: any, idx: number) => {
                        const total = stats.statusDistribution.reduce((acc: number, x: any) => acc + x.value, 0);
                        const percent = ((item.value / total) * 100).toFixed(0);
                        const displayStatus = {
                          PENDING: { label: 'Đang xử lý', color: 'bg-amber-500' },
                          CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-500' },
                          ASSIGNED: { label: 'Đã phân công', color: 'bg-indigo-500' },
                          IN_PROGRESS: { label: 'Đang thực hiện', color: 'bg-orange-500' },
                          COMPLETED: { label: 'Hoàn thành', color: 'bg-green-500' },
                          CANCELLED: { label: 'Đã hủy', color: 'bg-red-500' },
                          NO_SHOW: { label: 'No Show', color: 'bg-gray-500' },
                          LATE: { label: 'Trễ hẹn', color: 'bg-rose-500' }
                        }[item.status as string] || { label: item.status, color: 'bg-gray-400' };

                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <span className={`size-2.5 rounded-full ${displayStatus.color}`} />
                                {displayStatus.label}
                              </span>
                              <span>{item.value} ({percent}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className={`h-full ${displayStatus.color} rounded-full`}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 py-6 text-center">Chưa có dữ liệu phân bổ trạng thái.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Today's Booking table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Lịch hẹn hôm nay ({stats.todayBookings?.length || 0})</h3>
                  {stats.unconfirmedBookingsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => navigateToBookingsTab(null, 'PENDING', new Date().toISOString().split('T')[0])}
                      className="text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
                    >
                      <AlertCircle className="size-3.5 text-amber-600" />
                      {stats.unconfirmedBookingsCount} lịch hẹn cần xác nhận (Chuyển qua trang lịch hẹn ➔)
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-3.5">Giờ</th>
                        <th className="px-6 py-3.5">Khách hàng / Bé</th>
                        <th className="px-6 py-3.5">Dịch vụ</th>
                        <th className="px-6 py-3.5">Ghi chú</th>
                        <th className="px-6 py-3.5">Nhân viên phụ trách</th>
                        <th className="px-6 py-3.5 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.todayBookings && stats.todayBookings.length > 0 ? (
                        stats.todayBookings.map((b: any) => {
                          const timeStr = new Date(b.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          const statusStyle = {
                            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
                            CONFIRMED: 'bg-blue-55 text-blue-700 border-blue-200',
                            ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                            IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
                            COMPLETED: 'bg-green-50 text-green-700 border-green-200',
                            CANCELLED: 'bg-red-50 text-red-700 border-red-200',
                            NO_SHOW: 'bg-gray-50 text-gray-700 border-gray-250',
                            LATE: 'bg-rose-50 text-rose-705 border-rose-200'
                          }[b.status as string] || 'bg-gray-50 text-gray-700 border-gray-200';

                          return (
                            <tr key={b.id} className="hover:bg-gray-50/30 transition">
                              <td className="px-6 py-4 font-extrabold text-gray-900 whitespace-nowrap">{timeStr}</td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-gray-800 text-xs">{b.customerName}</p>
                                  <p className="text-[10px] text-gray-405 font-semibold">Pet: <span className="text-gray-600 font-extrabold">{b.petName}</span></p>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-800 text-xs">{b.serviceName}</td>
                              <td className="px-6 py-4 text-xs italic text-gray-500 max-w-[200px] truncate" title={b.note}>
                                {b.note ? `"${b.note}"` : '—'}
                              </td>
                              <td className="px-6 py-4 font-semibold text-xs text-gray-700">
                                {b.staffName ? (
                                  <span className="font-bold text-xs text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                    ✨ {b.staffName}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Chưa phân công
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyle}`}>
                                  {b.status === 'PENDING' ? '🚨 Chờ xác nhận' : b.status}
                                </span>
                              </td>

                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Không có lịch hẹn nào phát sinh hôm nay.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT: SERVICES */}
          {currentTab === 'services' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Quản lý dịch vụ Spa</h2>
                  <p className="text-sm font-semibold text-gray-500">Thêm, chỉnh sửa dịch vụ spa, phân loại gói chính / dịch vụ lẻ và thiết lập mốc cân nặng.</p>
                </div>
                <button
                  onClick={handleAddServiceClick}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017]"
                >
                  <Plus className="size-4" /> Thêm dịch vụ
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">Phân loại dịch vụ:</span>
                    <select
                      value={serviceTypeFilter}
                      onChange={(e) => setServiceTypeFilter(e.target.value)}
                      className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="ALL">🌐 Tất cả dịch vụ ({services.length})</option>
                      <option value="MAIN">★ Chỉ gói dịch vụ chính ({services.filter((s: any) => s.isMain).length})</option>
                      <option value="SUB">✦ Chỉ dịch vụ lẻ chọn thêm ({services.filter((s: any) => !s.isMain).length})</option>
                    </select>
                  </div>

                  {managerBrands.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">Thương hiệu Spa:</span>
                      <select
                        value={serviceBrandFilter}
                        onChange={(e) => setServiceBrandFilter(e.target.value)}
                        className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="ALL">Tất cả thương hiệu</option>
                        {managerBrands.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Services Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50/80 text-[11px] font-extrabold uppercase text-gray-500 tracking-wider">
                        <th className="px-4 py-3">Tên dịch vụ</th>
                        <th className="px-4 py-3">Danh mục / Nhóm</th>
                        <th className="px-4 py-3 text-center">Thời gian</th>
                        <th className="px-4 py-3 text-right">Khoảng giá</th>
                        <th className="px-4 py-3 text-center">Lượt đặt</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupedServices.length > 0 ? (
                        groupedServices.map((group) => {
                          const isExpanded = !!expandedServiceGroups[group.groupKey];
                          const activeCount = group.items.filter((i) => i.isActive).length;

                          const priceStr = group.minPrice === group.maxPrice
                            ? `${group.minPrice.toLocaleString('vi-VN')}đ`
                            : `${group.minPrice.toLocaleString('vi-VN')}đ – ${group.maxPrice.toLocaleString('vi-VN')}đ`;

                          const durationStr = group.minDuration === group.maxDuration
                            ? `${group.minDuration} phút`
                            : `${group.minDuration} – ${group.maxDuration} phút`;

                          return (
                            <React.Fragment key={group.groupKey}>
                              {/* PARENT GROUP ROW */}
                              <tr
                                onClick={() => toggleServiceGroup(group.groupKey)}
                                className="hover:bg-orange-50/40 transition cursor-pointer bg-white group"
                              >
                                <td className="px-4 py-3 font-semibold">
                                  <div className="flex items-center gap-2">
                                    <button type="button" className="p-0.5 text-gray-400 group-hover:text-primary transition">
                                      {isExpanded ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4" />}
                                    </button>
                                    <span className="font-bold text-gray-900 text-sm group-hover:text-primary transition">
                                      {group.baseName}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                    {group.categoryName}
                                  </span>
                                </td>

                                <td className="px-4 py-3 text-center font-medium text-gray-600 text-xs">{durationStr}</td>
                                <td className="px-4 py-3 text-right font-black text-primary text-xs">{priceStr}</td>
                                <td className="px-4 py-3 text-center font-bold text-purple-700 text-xs">{group.totalBookings} lượt</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${activeCount > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                    {activeCount > 0 ? `Đang bật (${activeCount}/${group.items.length})` : 'Tắt'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleServiceGroup(group.groupKey);
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-primary/25 text-primary font-bold text-[11px] hover:bg-orange-50 transition inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {isExpanded ? 'Thu gọn' : 'Xem các mốc kg'}
                                  </button>
                                </td>
                              </tr>

                              {/* EXPANDED SUB-SERVICES LIST */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} className="bg-slate-50/70 px-4 py-2 border-y border-slate-200/80">
                                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
                                      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                        <h4 className="text-[11px] font-extrabold uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                                          ⚖️ Danh sách mốc cân nặng: <span className="text-primary">{group.baseName}</span>
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                          ({group.items.length} biến thể cân nặng)
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-150">
                                              <th className="py-2 px-3">Tên mốc dịch vụ</th>
                                              <th className="py-2 px-3">Đối tượng</th>
                                              <th className="py-2 px-3">Khoảng cân nặng</th>
                                              <th className="py-2 px-3 text-center">Thời gian</th>
                                              <th className="py-2 px-3 text-right">Đơn giá</th>
                                              <th className="py-2 px-3 text-center">Lượt đặt</th>
                                              <th className="py-2 px-3 text-center">Trạng thái</th>
                                              <th className="py-2 px-3 text-center">Chỉnh sửa</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {group.items.map((s: any) => {
                                              const speciesBadge = s.species === 'DOG' ? '🐕 Chó' : s.species === 'CAT' ? '🐈 Mèo' : '🐾 Tất cả';
                                              const weightText = formatWeightRange(s.petWeightMin, s.petWeightMax);

                                              return (
                                                <tr key={s.id} className="hover:bg-purple-50/30 transition">
                                                  <td className="py-2 px-3 font-bold text-gray-900 text-xs">{s.name}</td>
                                                  <td className="py-2 px-3 font-semibold text-gray-700">{speciesBadge}</td>
                                                  <td className="py-2 px-3 font-medium text-gray-600">{weightText}</td>
                                                  <td className="py-2 px-3 text-center font-medium text-gray-700">{s.durationMin} phút</td>
                                                  <td className="py-2 px-3 text-right font-black text-primary">{s.price.toLocaleString('vi-VN')}đ</td>
                                                  <td className="py-2 px-3 text-center font-bold text-purple-700">{s._count?.bookings || 0} lượt</td>
                                                  <td className="py-2 px-3 text-center">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${s.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                                      }`}>
                                                      {s.isActive ? 'Bật' : 'Tắt'}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 px-3 text-center">
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditServiceClick(s);
                                                      }}
                                                      className="p-1 rounded-md border border-gray-200 text-gray-500 hover:text-primary hover:bg-orange-50 transition cursor-pointer"
                                                      title="Chỉnh sửa mốc này"
                                                    >
                                                      <Edit2 className="size-3.5" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Không tìm thấy dịch vụ nào.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: CATEGORIES */}
          {currentTab === 'categories' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Quản lý Danh mục Spa</h2>
                  <p className="text-sm font-semibold text-gray-500">Thêm, chỉnh sửa và thiết lập phân loại danh mục (Gói chính / Dịch vụ lẻ).</p>
                </div>
                <button
                  onClick={handleAddCategoryClick}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017]"
                >
                  <Plus className="size-4" /> Thêm danh mục
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">Phân loại danh mục:</span>
                  <select
                    value={categoryTypeFilter}
                    onChange={(e) => setCategoryTypeFilter(e.target.value)}
                    className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="ALL">🌐 Tất cả danh mục ({managerBrands.length})</option>
                    <option value="MAIN">★ Chỉ gói dịch vụ chính ({managerBrands.filter((c: any) => c.isMain).length})</option>
                    <option value="SUB">✦ Chỉ dịch vụ lẻ chọn thêm ({managerBrands.filter((c: any) => !c.isMain).length})</option>
                  </select>
                </div>
              </div>

              {/* Categories Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Tên danh mục & Phân loại</th>
                        <th className="px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4 text-center">Số dịch vụ</th>
                        <th className="px-6 py-4 text-center">Số lượt đặt</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {managerBrands
                        .filter((c: any) => {
                          if (categoryTypeFilter === 'MAIN' && !c.isMain) return false;
                          if (categoryTypeFilter === 'SUB' && c.isMain) return false;
                          return true;
                        })
                        .map((c: any) => (
                          <tr key={c.id} className="hover:bg-gray-50/30 transition">
                            <td className="px-6 py-4 space-y-1">
                              <span className="font-extrabold text-gray-900 block text-sm">{c.name}</span>
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded ${c.isMain ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                {c.isMain ? '★ Gói dịch vụ chính' : '✦ Dịch vụ lẻ chọn thêm'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-gray-600 max-w-[250px] truncate" title={c.description || 'Chưa có mô tả'}>
                              {c.description || <span className="italic text-gray-400">Không có mô tả</span>}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-gray-800">
                              <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                                {c._count?.services || 0} dịch vụ
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-extrabold text-purple-700">
                              {c._count?.bookings || 0} lượt
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${c.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                }`}>
                                {c.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tắt'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEditCategoryClick(c)}
                                  className="p-1.5 rounded-lg border text-gray-600 hover:text-primary hover:bg-orange-50 transition"
                                  title="Chỉnh sửa danh mục"
                                >
                                  <Edit2 className="size-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategoryClick(c)}
                                  className="p-1.5 rounded-lg border text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Xóa danh mục"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: BOOKINGS */}
          {currentTab === 'bookings' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-black text-gray-900">Danh sách tất cả lịch hẹn</h2>
                <p className="text-sm font-semibold text-gray-500">Quản lý, đổi lịch hẹn, phân công nhân viên và áp dụng giảm giá trễ hẹn 10%.</p>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Search input */}
                  <div className="md:col-span-4 relative">
                    <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên khách, pet, dịch vụ, mã #..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="w-full rounded-xl border border-gray-150 bg-gray-50/50 py-2 pl-10 pr-10 text-sm focus:border-primary focus:bg-white focus:outline-none font-medium"
                    />
                    {bookingSearch && (
                      <button
                        type="button"
                        onClick={() => setBookingSearch('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition cursor-pointer"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Status filter */}
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2">
                      <Filter className="size-4 text-gray-400 shrink-0" />
                      <select
                        value={bookingStatusFilter}
                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">🌐 Tất cả trạng thái</option>
                        <option value="PENDING">🚨 Pending (Chờ xác nhận)</option>
                        <option value="CONFIRMED">👤 Confirmed (Cần gán NV)</option>
                        <option value="CHECK_IN">📍 Check-in (Khách đã đến)</option>
                        <option value="ASSIGNED">✨ Assigned (Đã giao việc)</option>
                        <option value="IN_PROGRESS">🔄 In Progress (Đang làm)</option>
                        <option value="COMPLETED">✅ Completed (Hoàn thành)</option>
                        <option value="CANCELLED">❌ Cancelled (Đã hủy)</option>
                        <option value="NO_SHOW">⏱️ No Show (Vắng mặt)</option>
                        <option value="LATE">⚠️ Late (Trễ hẹn)</option>
                      </select>
                    </div>
                  </div>

                  {/* Date Filter Type dropdown */}
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-gray-400 shrink-0" />
                      <select
                        value={bookingDateFilterType}
                        onChange={(e) => {
                          setBookingDateFilterType(e.target.value);
                          if (e.target.value === 'SPECIFIC_DATE' && !bookingCustomDate) {
                            const now = new Date();
                            setBookingCustomDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                          }
                        }}
                        className="w-full rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">📅 Tất cả ngày</option>
                        <option value="TODAY">⚡ Hôm nay</option>
                        <option value="THIS_WEEK">📆 Tuần này</option>
                        <option value="THIS_MONTH">🗓️ Tháng này</option>
                        <option value="SPECIFIC_DATE">🎯 Chọn ngày cụ thể...</option>
                        <option value="CUSTOM_RANGE">↔️ Khoảng ngày...</option>
                      </select>
                    </div>
                  </div>

                  {/* Time Slot Filter dropdown */}
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-gray-400 shrink-0" />
                      <select
                        value={bookingTimeSlotFilter}
                        onChange={(e) => setBookingTimeSlotFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">⏰ Tất cả giờ</option>
                        {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'].map((time) => (
                          <option key={time} value={time}>
                            ⏰ {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row: Left (Count & Date Picker Inputs) | Right (Date Label & Reset Button) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
                  {/* Left: Booking count + Date Pickers */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-gray-900 mr-1">
                      🔍 Tìm thấy <span className="text-primary font-black text-sm">{filteredBookings.length}</span> lịch hẹn
                    </span>

                    {/* Date Pickers if SPECIFIC_DATE or CUSTOM_RANGE */}
                    {bookingDateFilterType === 'SPECIFIC_DATE' && (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <span className="text-xs font-bold text-gray-600">Chọn ngày:</span>
                        <input
                          type="date"
                          value={bookingCustomDate}
                          onChange={(e) => setBookingCustomDate(e.target.value)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-800 focus:border-primary focus:outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {bookingDateFilterType === 'CUSTOM_RANGE' && (
                      <div className="flex flex-wrap items-center gap-1.5 animate-fadeIn">
                        <span className="text-xs font-bold text-gray-600">Từ:</span>
                        <input
                          type="date"
                          value={bookingStartDate}
                          onChange={(e) => setBookingStartDate(e.target.value)}
                          className="rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-800 focus:border-primary focus:outline-none shadow-2xs"
                        />
                        <span className="text-xs font-bold text-gray-600">Đến:</span>
                        <input
                          type="date"
                          value={bookingEndDate}
                          onChange={(e) => setBookingEndDate(e.target.value)}
                          className="rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-800 focus:border-primary focus:outline-none shadow-2xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right: Date filter label & Reset filter button */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {dateFilterLabel && bookingDateFilterType !== 'SPECIFIC_DATE' && bookingDateFilterType !== 'CUSTOM_RANGE' && (
                      <span className="bg-orange-50 text-orange-800 font-bold px-2 py-0.5 rounded-full border border-orange-200 text-[11px]">
                        📅 {dateFilterLabel}
                      </span>
                    )}
                    {(bookingSearch || bookingStatusFilter !== 'ALL' || bookingDateFilterType !== 'ALL' || bookingTimeSlotFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingSearch('');
                          setBookingStatusFilter('ALL');
                          setBookingDateFilterType('ALL');
                          setBookingCustomDate('');
                          setBookingStartDate('');
                          setBookingEndDate('');
                          setBookingTimeSlotFilter('ALL');
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <X className="size-3.5" />
                        <span>Đặt lại bộ lọc</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Mã lịch</th>
                        <th className="px-6 py-4">Thời gian hẹn</th>
                        <th className="px-6 py-4">Khách hàng / Thú cưng</th>
                        <th className="px-6 py-4">Dịch vụ</th>
                        <th className="px-6 py-4">Nhân viên</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center">Thao tác quản lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredBookings.length > 0 ? (
                        filteredBookings.map((b: any) => {
                          const dateObj = new Date(b.scheduledAt);
                          const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                          const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          const statusStyle = {
                            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
                            CONFIRMED: 'bg-blue-55 text-blue-700 border-blue-200',
                            CHECK_IN: 'bg-teal-50 text-teal-700 border-teal-200',
                            ARRIVED: 'bg-teal-50 text-teal-700 border-teal-200',
                            ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                            IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
                            COMPLETED: 'bg-green-50 text-green-700 border-green-200',
                            CANCELLED: 'bg-red-50 text-red-700 border-red-200',
                            NO_SHOW: 'bg-gray-50 text-gray-700 border-gray-250',
                            LATE: 'bg-rose-50 text-rose-700 border-rose-250'
                          }[b.status as string] || 'bg-gray-50 text-gray-700 border-gray-200';

                          const canReschedule = ['PENDING', 'CONFIRMED', 'CHECK_IN', 'ARRIVED', 'ASSIGNED', 'LATE'].includes(b.status) && (b.rescheduleCount || 0) < 2;
                          const isLateOfferable = (b.status === 'CHECK_IN' || b.status === 'ARRIVED' || b.status === 'LATE') && !b.discountAmount;

                          return (
                            <tr
                              key={b.id}
                              onClick={() => setSelectedBookingDetail(b)}
                              className="hover:bg-gray-50/70 transition cursor-pointer"
                            >
                              <td className="px-6 py-4 font-mono font-bold text-xs text-gray-500">#{b.id.slice(-6).toUpperCase()}</td>
                              <td className="px-6 py-4">
                                <span className="font-extrabold text-gray-900 block">{timeStr}</span>
                                <span className="text-[10px] text-gray-400 font-semibold block">{dateStr}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-gray-800 text-xs">{b.user?.name || 'Khách hàng'}</p>
                                  <p className="text-[10px] text-gray-500 font-semibold">Pet: <span className="text-gray-700 font-extrabold">{b.petName || b.pet?.name || 'Thú cưng'}</span></p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-gray-800 text-xs">{b.service?.name || (b.mainServiceResolved as any)?.name || 'Dịch vụ Spa'}</p>
                                <p className="text-[10px] text-gray-400 font-semibold">{(b.totalPrice || b.priceSnapshot || 0).toLocaleString('vi-VN')}đ</p>
                                {(() => {
                                  const subList = getManagerBookingSubServices(b);
                                  if (subList.length === 0) return null;
                                  return (
                                    <div className="text-[10px] text-purple-700 font-bold pt-0.5 line-clamp-1" title={subList.map((s: any) => s.name).join(', ')}>
                                      + {subList.length} dịch vụ lẻ
                                    </div>
                                  );
                                })()}
                                {b.discountAmount ? (
                                  <span className="inline-block text-[9px] bg-red-50 text-red-600 font-black px-1 rounded">Đã giảm 10% (trễ)</span>
                                ) : null}
                              </td>
                              <td className="px-6 py-4 font-semibold text-xs text-gray-700">
                                {b.staff ? `✨ ${b.staff.name}` : <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Chưa phân công</span>}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${statusStyle}`}>
                                  {b.status === 'PENDING' ? '🚨 Chờ xác nhận' : b.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-col items-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedBookingDetail(b)}
                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <Eye className="size-3.5" /> Xem chi tiết
                                  </button>

                                  {b.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmBooking(b.id)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      ✓ Xác nhận
                                    </button>
                                  )}

                                  {(b.status === 'CONFIRMED' || (b.status === 'CHECK_IN' && !b.staffId)) && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedBookingDetail(b)}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      👤 Gán nhân viên
                                    </button>
                                  )}

                                  {canReschedule && (
                                    <button
                                      onClick={() => {
                                        setRescheduleBooking(b);
                                        setRescheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                                        setSelectedRescheduleSlot('');
                                      }}
                                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-750 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      <Calendar className="size-3.5" /> Đổi lịch
                                    </button>
                                  )}

                                  {isLateOfferable && (
                                    <button
                                      onClick={() => handleApplyLateDiscount(b.id)}
                                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-extrabold transition cursor-pointer"
                                      title="Khách chờ >30p chưa được làm: Giảm giá 10% tự động"
                                    >
                                      🎁 Giảm 10%
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Không tìm thấy lịch hẹn phù hợp.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: STAFFS */}
          {currentTab === 'staffs' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-black text-gray-900">Quản lý nhân viên chi nhánh & Hiệu suất ca làm</h2>
                <p className="text-sm font-semibold text-gray-500">Theo dõi tỷ lệ hoàn thành Đúng hạn / Trễ hạn và tổng doanh thu của từng kỹ thuật viên.</p>
              </div>

              {/* Staffs Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffs.length > 0 ? (
                  staffs.map((s: any) => (
                    <div
                      key={s.id}
                      className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.name}
                              className="size-12 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="size-12 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-750 text-sm border border-purple-200">
                              {s.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{s.name}</h4>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${s.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}>
                                ● {s.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${s.isBusy || s.workStatus === 'BUSY'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                {s.isBusy || s.workStatus === 'BUSY' ? '🔴 Đang làm (Bận)' : '🟢 Đang rảnh'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-450 font-bold leading-normal">{s.email}</p>
                            <span className="inline-block mt-1 text-[9px] bg-purple-50 text-purple-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {s.currentBooking ? `✨ Đang làm pet: ${s.currentBooking.petName || 'Thú cưng'}` : 'Nhân viên Spa'}
                            </span>
                          </div>
                        </div>

                        {/* 5-star rating display column on the far right */}
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl">
                            <span className="text-xs font-black text-amber-700">{s.averageRating ? s.averageRating.toFixed(1) : '0'}</span>
                            <div className="flex text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`size-3.5 ${star <= Math.round(s.averageRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 mt-1">({s.feedbackCount || 0} đánh giá)</span>
                        </div>
                      </div>

                      {/* Performance metrics breakdown */}
                      <div className="space-y-2 border-t pt-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-gray-500">Tỷ lệ đúng hẹn:</span>
                          <span className={`font-black ${s.onTimeRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {s.onTimeRate ?? 100}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${s.onTimeRate ?? 100}%` }}
                            className={`h-full rounded-full transition-all ${s.onTimeRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-emerald-700 block font-bold">✅ Đúng hẹn</span>
                            <span className="text-base font-black text-emerald-800 block mt-0.5">{s.onTimeCount || 0} ca</span>
                          </div>
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-rose-700 block font-bold">⚠️ Trễ hẹn</span>
                            <span className="text-base font-black text-rose-800 block mt-0.5">{s.lateCount || 0} ca</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-gray-400 block font-bold">Đã hoàn thành</span>
                            <span className="text-sm font-black text-gray-800 block mt-0.5">{s.completedCount}</span>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-gray-400 block font-bold">Đang xử lý</span>
                            <span className="text-sm font-black text-amber-600 block mt-0.5">{s.activeCount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-3 flex justify-between items-center">
                        <div>
                          <span className="text-[11px] text-gray-400 font-bold uppercase block">Doanh thu tạo ra:</span>
                          <span className="text-base font-black text-primary">{(s.revenue || 0).toLocaleString('vi-VN')}đ</span>
                        </div>

                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(s.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${s.status === 'ACTIVE'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'
                            }`}
                        >
                          {s.status === 'ACTIVE' ? '🟢 Bật (Đang hoạt động)' : '⚪ Tắt (Đang dừng)'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-16 text-center text-gray-400 bg-white border rounded-2xl">
                    Không tìm thấy nhân viên nào ở chi nhánh này.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: FEEDBACKS */}
          {currentTab === 'feedbacks' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black text-gray-900">Đánh giá & Phản hồi từ khách hàng</h2>
                <p className="text-sm font-semibold text-gray-500">Xem tất cả nhận xét, số sao đánh giá dịch vụ và nhân viên (sắp xếp từ mới đến cũ).</p>
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên khách hoặc bé..."
                      value={feedbackSearch}
                      onChange={(e) => setFeedbackSearch(e.target.value)}
                      className="h-9 w-64 rounded-xl border border-gray-200 pl-9 pr-3 text-xs font-semibold focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">Bộ lọc số sao:</span>
                    <select
                      value={feedbackStarFilter}
                      onChange={(e) => setFeedbackStarFilter(e.target.value)}
                      className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="ALL">Tất cả số sao</option>
                      <option value="5">5 Sao (Tuyệt vời)</option>
                      <option value="4">4 Sao (Tốt)</option>
                      <option value="3">3 Sao (Bình thường)</option>
                      <option value="2">2 Sao (Tệ)</option>
                      <option value="1">1 Sao (Rất tệ)</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs font-extrabold text-gray-500">
                  Tổng số phản hồi: <span className="text-primary font-black">{filteredFeedbacks.length}</span>
                </div>
              </div>

              {/* Feedbacks Grid / List */}
              <div className="space-y-4">
                {filteredFeedbacks.length > 0 ? (
                  filteredFeedbacks.map((f: any) => {
                    const booking = f.booking || {};
                    const petName = booking.petName || booking.pet?.name || 'Thú cưng';
                    const mainService = booking.service?.name
                      || (booking.mainServiceResolved as any)?.name
                      || 'Dịch vụ Spa';
                    const subServices = (booking.subServices || []).map((s: any) => s.name).join(', ');
                    const staffName = booking.staff?.name || 'Chưa phân công';

                    return (
                      <div key={f.id} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs space-y-4 hover:border-gray-300 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-3">
                            {f.user?.avatarUrl ? (
                              <img src={f.user.avatarUrl} alt={f.user.name} className="size-11 rounded-full object-cover border" />
                            ) : (
                              <div className="size-11 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-sm border border-primary/20">
                                {(f.user?.name || 'K').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h4 className="font-black text-sm text-gray-900 leading-tight">{f.user?.name || 'Khách hàng'}</h4>
                              <p className="text-[11px] text-gray-500 font-semibold">{f.user?.email || f.user?.phone || 'Chưa có thông tin liên hệ'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-[11px] font-bold text-gray-400">
                              {new Date(f.createdAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                            <button
                              onClick={() => setSelectedBookingDetail(booking)}
                              className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              <Eye className="size-3.5" /> Xem đơn hàng ➔
                            </button>
                          </div>
                        </div>

                        {/* Booking Context & Ratings Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/80 p-3.5 rounded-xl border border-gray-150/70 text-xs">
                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Thú cưng:</span>
                            <span className="font-extrabold text-gray-800 flex items-center gap-1.5 mt-0.5">
                              🐶 {petName}
                            </span>
                          </div>

                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Dịch vụ đã dùng:</span>
                            <span className="font-extrabold text-gray-800 block mt-0.5">
                              {mainService} {subServices ? `(+ ${subServices})` : ''}
                            </span>
                          </div>

                          <div>
                            <span className="text-gray-400 font-bold block text-[10px] uppercase">Kỹ thuật viên phụ trách:</span>
                            <span className="font-extrabold text-purple-700 block mt-0.5">
                              ✨ {staffName}
                            </span>
                          </div>
                        </div>

                        {/* Ratings & Comment Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Rate Services */}
                          <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900">Đánh giá dịch vụ:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-amber-700">{f.rateServices}/5</span>
                              <div className="flex text-amber-400">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`size-4 ${star <= f.rateServices ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Rate Staff */}
                          <div className="bg-purple-50/50 border border-purple-200/60 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-900">Đánh giá nhân viên:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-purple-700">{f.rateStaff}/5</span>
                              <div className="flex text-amber-400">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`size-4 ${star <= f.rateStaff ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Customer Comment */}
                        {f.comment && (
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-150 text-xs font-semibold text-gray-700">
                            <span className="text-[10px] uppercase font-black text-gray-400 block mb-1">Lời nhắn từ khách hàng:</span>
                            "{f.comment}"
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 text-center text-gray-400 bg-white border border-gray-150 rounded-2xl">
                    Chưa có đánh giá nào từ khách hàng ở chi nhánh này.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* CONFIRMATION POPUP FOR STAFF ASSIGNMENT */}
      {assignConfirmBooking && assignConfirmStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Xác nhận phân công</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn phân công lịch hẹn dịch vụ <span className="font-extrabold text-primary">{assignConfirmBooking.serviceName}</span> cho kỹ thuật viên <span className="font-extrabold text-purple-700">{assignConfirmStaff.name}</span> không?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={assigningLoading}
                onClick={() => {
                  setAssignConfirmBooking(null);
                  setAssignConfirmStaff(null);
                }}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                disabled={assigningLoading}
                onClick={handleAssignStaff}
                className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017]"
              >
                {assigningLoading ? 'Đang giao...' : 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-5 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setRescheduleBooking(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-gray-900">Đổi lịch hẹn Spa</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Khách hàng: {rescheduleBooking.user?.name || 'Khách hàng'} ({rescheduleBooking.petName || 'Bé cưng'}) • Dịch vụ: {rescheduleBooking.service?.name}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-bold uppercase">1. Chọn ngày mới</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onKeyDown={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const val = e.target.value;
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (!val || val >= todayStr) {
                      setRescheduleDate(val);
                    } else {
                      setRescheduleDate(todayStr);
                    }
                    setSelectedRescheduleSlot('');
                  }}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-sm font-bold text-gray-700 bg-white cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-gray-400 font-bold uppercase">2. Chọn khung giờ khả dụng</label>
                {loadingRescheduleSlots ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : rescheduleSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {rescheduleSlots.map((slot: any) => (
                      <button
                        key={slot.time}
                        disabled={!slot.isAvailable}
                        onClick={() => setSelectedRescheduleSlot(slot.time)}
                        className={`py-2 px-1 border rounded-lg text-center transition flex flex-col items-center justify-center ${!slot.isAvailable
                          ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                          : selectedRescheduleSlot === slot.time
                            ? 'bg-primary border-primary text-white shadow-sm font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-primary'
                          }`}
                      >
                        <span className="text-xs font-black">{slot.time}</span>
                        {slot.isAvailable && (
                          <span className={`text-[9px] mt-0.5 ${selectedRescheduleSlot === slot.time ? 'text-white' : 'text-gray-400'}`}>
                            {slot.remainingSlots} chỗ
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-450 italic py-2">Chọn ngày để xem các khung giờ.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                disabled={submittingReschedule}
                onClick={() => setRescheduleBooking(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
              >
                Hủy bỏ
              </button>
              <button
                disabled={submittingReschedule || !selectedRescheduleSlot}
                onClick={handleRescheduleSubmit}
                className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] disabled:opacity-50"
              >
                {submittingReschedule ? 'Đang đổi...' : 'Xác nhận đổi lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE MODAL (ADD / EDIT) */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setServiceModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-gray-900">{editingService ? 'Chỉnh sửa dịch vụ Spa' : 'Thêm dịch vụ Spa mới'}</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Tạo hoặc cập nhật mốc cân nặng, giá và nhóm thương hiệu dịch vụ.</p>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4">

              {/* Category & Main/Sub Classification */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Danh mục dịch vụ *</label>
                  <select
                    required
                    value={serviceForm.brandId}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, brandId: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">-- Chọn danh mục dịch vụ --</option>
                    {filteredBrandsForForm.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Phân loại dịch vụ *</label>
                  <select
                    value={serviceForm.isMain ? 'MAIN' : 'SUB'}
                    onChange={(e) => handleClassificationChange(e.target.value === 'MAIN')}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="MAIN">Dịch vụ chính</option>
                    <option value="SUB">Dịch vụ lẻ</option>
                  </select>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên dịch vụ *</label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold"
                  placeholder="Ví dụ: SPA Cắt tỉa lông (Chó 3-6kg)"
                />
              </div>

              {/* Species & Weight Bracket */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Loài áp dụng</label>
                  <select
                    value={serviceForm.species}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, species: e.target.value as any }))}
                    className="w-full h-10 border rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-800 bg-white"
                  >
                    <option value="ALL">🐾 Tất cả loài</option>
                    <option value="DOG">🐕 Chó</option>
                    <option value="CAT">🐈 Mèo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Cân nặng từ (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={serviceForm.petWeightMin}
                    onChange={(e) => handleMinWeightChange(e.target.value)}
                    onBlur={handleWeightBlur}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Ví dụ: 1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Cân nặng đến (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={serviceForm.petWeightMax}
                    onChange={(e) => handleMaxWeightChange(e.target.value)}
                    onBlur={handleWeightBlur}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Ví dụ: 3.0"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Mô tả chi tiết</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[60px] border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                  placeholder="Mô tả công việc và ưu đãi dịch vụ..."
                />
              </div>

              {/* Service Image Upload (Only 1 image, non-image files blocked) */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase flex items-center gap-1">
                  <Camera className="size-3.5 text-primary" /> Ảnh dịch vụ (Hiển thị trang chủ {!editingService ? '* Bắt buộc' : ''})
                </label>
                {serviceImagePreview ? (
                  <div className="relative inline-block group rounded-xl overflow-hidden border border-gray-200 shadow-xs max-w-[220px] bg-white">
                    <img
                      src={serviceImagePreview}
                      alt="Ảnh dịch vụ"
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={handleClearServiceImage}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition cursor-pointer"
                      title="Xóa ảnh dịch vụ"
                    >
                      <X className="size-3.5" />
                    </button>
                    <div className="p-1.5 bg-gray-900/70 text-[9px] text-white font-semibold text-center backdrop-blur-xs truncate">
                      {serviceImageFile?.name || 'Ảnh dịch vụ đã chọn'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex items-center justify-center gap-2 w-full p-3.5 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl bg-purple-50/40 hover:bg-purple-50 cursor-pointer transition text-xs text-purple-700 font-bold">
                      <Upload className="size-4 text-purple-600" />
                      <span>Tải 1 ảnh dịch vụ từ thiết bị (Chỉ chọn tệp ảnh)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleServiceImageChange}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Price & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Giá dịch vụ (đ) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, price: formatVNDInput(e.target.value) }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-black text-primary bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="150.000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Thời gian thực hiện (phút) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={serviceForm.durationMin}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/\D/g, '');
                      setServiceForm(prev => ({ ...prev, durationMin: cleanVal, durationMax: cleanVal }));
                    }}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="service-active"
                  checked={serviceForm.isActive}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="accent-primary size-4"
                />
                <label htmlFor="service-active" className="text-xs font-bold text-gray-700">Dịch vụ đang hoạt động khả dụng</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingService}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] cursor-pointer"
                >
                  {submittingService ? 'Đang lưu...' : 'Lưu dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Booking Detail & Management Modal */}
      {selectedBookingDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono text-gray-400 block font-bold">MÃ LỊCH: #{selectedBookingDetail.id.slice(-6).toUpperCase()}</span>
                <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                  <Scissors className="size-5 text-primary" /> Chi Tiết Lịch Hẹn Spa
                </h3>
              </div>
              <button onClick={() => setSelectedBookingDetail(null)} className="rounded-full p-1 text-gray-400 hover:text-gray-600">
                <X className="size-5" />
              </button>
            </div>

            {/* Customer & Pet Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-150">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Khách hàng</span>
                <p className="font-extrabold text-gray-900">{selectedBookingDetail.user?.name || 'Khách hàng'}</p>
                {selectedBookingDetail.user?.phone && (
                  <p className="text-gray-600 font-semibold">📞 SĐT: {selectedBookingDetail.user.phone}</p>
                )}
                {selectedBookingDetail.user?.email && (
                  <p className="text-gray-500 font-medium truncate">{selectedBookingDetail.user.email}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Thú cưng</span>
                <p className="font-extrabold text-purple-950">🐾 {selectedBookingDetail.petName || selectedBookingDetail.pet?.name || 'Thú cưng'}</p>
                <p className="text-gray-600 font-semibold">
                  {selectedBookingDetail.petSpecies === 'CAT' ? '🐱 Mèo' : '🐶 Chó'} • {selectedBookingDetail.petWeight || 3}kg
                </p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-purple-800 uppercase block">Thời gian hẹn</span>
                <span className="font-black text-sm text-purple-950">
                  {new Date(selectedBookingDetail.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {new Date(selectedBookingDetail.scheduledAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${{
                PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
                CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
                ASSIGNED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                IN_PROGRESS: 'bg-orange-100 text-orange-800 border-orange-300',
                COMPLETED: 'bg-green-100 text-green-800 border-green-300',
                CANCELLED: 'bg-red-100 text-red-800 border-red-300',
                NO_SHOW: 'bg-gray-100 text-gray-800 border-gray-300',
                LATE: 'bg-rose-100 text-rose-800 border-rose-300',
              }[selectedBookingDetail.status as string] || 'bg-gray-100 text-gray-800'
                }`}>
                {selectedBookingDetail.status === 'PENDING' ? '🚨 Chờ xác nhận' : selectedBookingDetail.status}
              </span>
            </div>

            {/* Services List */}
            <div className="space-y-2 text-xs">
              <span className="font-extrabold text-gray-800 uppercase text-[10px] tracking-wider block">Dịch vụ chính & Dịch vụ phụ:</span>
              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center font-black text-gray-900">
                  <span>✂️ Dịch vụ chính: {selectedBookingDetail.service?.name || (selectedBookingDetail.mainServiceResolved as any)?.name || 'Gói Chăm Sóc Spa'}</span>
                  <span>{(selectedBookingDetail.service?.price || selectedBookingDetail.priceSnapshot || 0).toLocaleString('vi-VN')}đ</span>
                </div>

                {(() => {
                  const subList = getManagerBookingSubServices(selectedBookingDetail);
                  if (subList.length === 0) {
                    return <p className="text-[11px] text-gray-400 italic pt-1.5 border-t border-gray-150">Không có dịch vụ lẻ đi kèm.</p>;
                  }
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-gray-150">
                      <span className="text-[10px] font-extrabold text-purple-900 block uppercase">
                        Dịch vụ lẻ chọn thêm ({subList.length}):
                      </span>
                      <div className="space-y-1">
                        {subList.map((sub: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-green-50/70 p-2 rounded-lg border border-green-150 text-xs">
                            <span className="font-extrabold text-gray-900 flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-green-600 shrink-0" />
                              {sub.name}
                            </span>
                            <span className="text-green-700 font-black">+ {(sub.price || 0).toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2 border-t border-gray-200 flex justify-between items-center font-black text-sm text-purple-950">
                  <span>Tổng thanh toán:</span>
                  <span>{(selectedBookingDetail.totalPrice || selectedBookingDetail.priceSnapshot || 0).toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
            </div>

            {/* Staff Assignment Section inside Modal */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <span className="font-extrabold text-gray-800 block text-[10px] uppercase">Nhân viên phụ trách:</span>
              {selectedBookingDetail.staff ? (
                <div className="flex items-center gap-2 font-bold text-gray-900 bg-white p-2 rounded-lg border">
                  <span className="size-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs">
                    {selectedBookingDetail.staff.name.slice(0, 1)}
                  </span>
                  <div>
                    <p>{selectedBookingDetail.staff.name}</p>
                    <p className="text-[10px] text-gray-500 font-normal">{selectedBookingDetail.staff.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-amber-800 font-bold italic text-[11px]">⚠️ Đơn chưa được phân công nhân viên phụ trách ca làm.</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAssignStaffMap[selectedBookingDetail.id] || ''}
                      onChange={(e) => setSelectedAssignStaffMap(prev => ({ ...prev, [selectedBookingDetail.id]: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      <option value="">
                        {(availableStaffsMap[selectedBookingDetail.id] || []).length === 0
                          ? '-- Không có nhân viên rảnh ca làm này --'
                          : '-- Chọn nhân viên chưa có ca làm --'}
                      </option>
                      {(availableStaffsMap[selectedBookingDetail.id] || []).map((st: any) => (
                        <option key={st.id} value={st.id}>
                          👤 {st.name} ({st.email || 'NV Rảnh'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
              {selectedBookingDetail.status === 'PENDING' && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await spaApi.confirmBooking(selectedBookingDetail.id);
                      const staffIdToAssign = selectedAssignStaffMap[selectedBookingDetail.id];
                      if (staffIdToAssign) {
                        await spaApi.assignStaff(selectedBookingDetail.id, staffIdToAssign);
                        toast.success('Đã xác nhận đơn hàng và phân công nhân viên!');
                      } else {
                        toast.success('Đã xác nhận đơn hàng thành công!');
                      }
                      setSelectedBookingDetail(null);
                      refreshData();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Lỗi xác nhận.');
                    }
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-black text-xs h-9 px-4 rounded-lg shadow-sm transition cursor-pointer"
                >
                  {selectedAssignStaffMap[selectedBookingDetail.id] ? '✓&👤 Xác nhận & Phân công NV' : '✓ Xác nhận lịch hẹn'}
                </button>
              )}

              {selectedBookingDetail.status === 'CONFIRMED' && !selectedBookingDetail.staffId && (
                <button
                  type="button"
                  onClick={async () => {
                    const staffIdToAssign = selectedAssignStaffMap[selectedBookingDetail.id];
                    if (!staffIdToAssign) {
                      toast.error('Vui lòng chọn nhân viên trước khi xác nhận.');
                      return;
                    }
                    try {
                      await spaApi.assignStaff(selectedBookingDetail.id, staffIdToAssign);
                      toast.success('Đã phân công nhân viên thành công!');
                      setSelectedBookingDetail(null);
                      refreshData();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Lỗi phân công.');
                    }
                  }}
                  disabled={!selectedAssignStaffMap[selectedBookingDetail.id]}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs h-9 px-4 rounded-lg shadow-sm transition cursor-pointer"
                >
                  👤 Phân công Nhân viên
                </button>
              )}

              {['PENDING', 'CONFIRMED', 'CHECK_IN', 'ARRIVED', 'ASSIGNED', 'LATE'].includes(selectedBookingDetail.status) && (selectedBookingDetail.rescheduleCount || 0) < 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const b = selectedBookingDetail;
                    setSelectedBookingDetail(null);
                    setRescheduleBooking(b);
                    setRescheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                    setSelectedRescheduleSlot('');
                  }}
                  className="border border-purple-300 text-purple-800 hover:bg-purple-50 font-black text-xs h-9 px-3 gap-1 rounded-lg transition cursor-pointer flex items-center"
                >
                  <Calendar className="size-3.5 mr-1" /> Đổi lịch hẹn
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL (ADD / EDIT) */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-gray-900">{editingCategory ? 'Chỉnh sửa danh mục Spa' : 'Thêm danh mục Spa mới'}</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Tạo nhóm phân loại cho các gói dịch vụ chính hoặc dịch vụ lẻ.</p>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên danh mục *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold"
                  placeholder="Ví dụ: Tắm & Sấy, Cắt tỉa lông..."
                />
              </div>

              {/* Classification */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Phân loại danh mục *</label>
                <select
                  value={categoryForm.isMain ? 'MAIN' : 'SUB'}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, isMain: e.target.value === 'MAIN' }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="MAIN">Dịch vụ chính</option>
                  <option value="SUB">Dịch vụ lẻ</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Mô tả danh mục</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[60px] border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                  placeholder="Mô tả nhóm danh mục..."
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={categoryForm.status === 'ACTIVE'}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, status: e.target.checked ? 'ACTIVE' : 'SUSPENDED' }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                />
                <label htmlFor="catIsActive" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Danh mục đang hoạt động khả dụng
                </label>
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] disabled:opacity-50"
                >
                  {submittingCategory ? 'Đang lưu...' : (editingCategory ? 'Cập nhật' : 'Lưu danh mục')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SpaManagerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-2 text-sm font-bold text-gray-500">Đang tải dữ liệu Spa...</span>
        </div>
      }
    >
      <SpaManagerConsoleContent />
    </Suspense>
  );
}
