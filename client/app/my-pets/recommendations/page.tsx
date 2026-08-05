'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Apple,
  Award,
  Calendar,
  ChevronRight,
  Heart,
  HeartPulse,
  Info,
  ListChecks,
  Loader2,
  PawPrint,
  Plus,
  RefreshCw,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Syringe,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import AppHeader from '@/components/layout/AppHeader';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/home/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { SpaServiceType } from '@/types';
import { spaApi } from '@/lib/api/spa';

// Define the Pet type matching the database schema
interface Pet {
  id: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string;
  gender: 'MALE' | 'FEMALE';
  weight: number;
  location: string;
  avatarUrl?: string | null;
  gallery: string[];
  hasPedigree: boolean;
  isVaccinated: boolean;
  pedigreeVerified: boolean;
  vaccineVerified: boolean;
  verificationBadge?: 'NONE' | 'PENDING' | 'VERIFIED';
  isAvailableForMatching: boolean;
  breedingOption?: 'CASH' | 'SHARE_LITTER' | 'NEGOTIATE';
  breedingFee?: number | null;
  shareLitterCount?: number | null;
  personality?: string | null;
  status: 'ACTIVE' | 'BREAKDOWN' | 'HIDDEN' | 'INACTIVE';
  birthday?: string;
}

// Fallback mock pets for guest users or users without pets
const MOCK_PETS: Pet[] = [
  {
    id: 'mock-dog',
    name: 'Chó Poodle Mẫu',
    species: 'DOG',
    breed: 'Toy Poodle',
    gender: 'MALE',
    weight: 4.8,
    location: 'Hồ Chí Minh',
    avatarUrl: null,
    gallery: [],
    hasPedigree: false,
    isVaccinated: false,
    pedigreeVerified: false,
    vaccineVerified: false,
    isAvailableForMatching: false,
    status: 'ACTIVE',
    birthday: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 5 months old puppy
  },
  {
    id: 'mock-cat',
    name: 'Mèo Anh Lông Ngắn Mẫu',
    species: 'CAT',
    breed: 'British Shorthair',
    gender: 'FEMALE',
    weight: 3.5,
    location: 'Hà Nội',
    avatarUrl: null,
    gallery: [],
    hasPedigree: false,
    isVaccinated: true,
    pedigreeVerified: false,
    vaccineVerified: false,
    isAvailableForMatching: false,
    status: 'ACTIVE',
    birthday: new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 14 months old cat
  }
];

function getPetAgeDetails(birthdayStr?: string) {
  if (!birthdayStr) return { months: 0, years: 0, text: 'Không rõ tuổi' };
  const birthday = new Date(birthdayStr);
  const now = new Date();
  const months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  let text = '';
  if (years > 0) {
    text = `${years} tuổi ${remainingMonths > 0 ? `${remainingMonths} tháng` : ''}`;
  } else {
    text = `${months} tháng tuổi`;
  }
  return { months, years, text };
}

const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let cleanLine = line.trim();
    const isListItem = cleanLine.startsWith('- ') || cleanLine.startsWith('* ');
    if (isListItem) {
      cleanLine = cleanLine.replace(/^[-*]\s+/, '');
    }

    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = boldRegex.exec(cleanLine)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanLine.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-extrabold text-[var(--text-main)]">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < cleanLine.length) {
      parts.push(cleanLine.substring(lastIndex));
    }

    if (isListItem) {
      return (
        <li key={idx} className="ml-5 list-disc text-xs leading-relaxed mb-1.5 text-[var(--text-main)]">
          {parts.length > 0 ? parts : cleanLine}
        </li>
      );
    }
    return (
      <p key={idx} className="text-xs leading-relaxed mb-2 min-h-[1em] text-[var(--text-main)]">
        {parts.length > 0 ? parts : cleanLine}
      </p>
    );
  });
};

function RecommendationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPetId = searchParams.get('petId');

  const [pets, setPets] = useState<Pet[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState<'food' | 'toys' | 'care'>('food');
  const [spaServices, setSpaServices] = useState<SpaServiceType[]>([]);
  const [loadingSpa, setLoadingSpa] = useState(false);

  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [errorAi, setErrorAi] = useState<string | null>(null);

  // Reset AI advice when selected pet changes
  useEffect(() => {
    setAiAdvice('');
    setErrorAi(null);
  }, [selectedPet?.id]);

  // Load pets list on mount
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    
    if (!token) {
      setIsGuest(true);
      setPets(MOCK_PETS);
      const preselect = queryPetId === 'mock-cat' ? MOCK_PETS[1] : MOCK_PETS[0];
      setSelectedPet(preselect);
      setLoadingPets(false);
      return;
    }

    setLoadingPets(true);
    api.get<Pet[]>('/pets/my')
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setPets(res.data);
          const found = queryPetId ? res.data.find(p => p.id === queryPetId) : null;
          setSelectedPet(found || res.data[0]);
          setIsGuest(false);
        } else {
          // Logged in but has no pets, use mocks
          setPets(MOCK_PETS);
          const preselect = queryPetId === 'mock-cat' ? MOCK_PETS[1] : MOCK_PETS[0];
          setSelectedPet(preselect);
          setIsGuest(true); // Treat as guest flow for suggestions
        }
      })
      .catch(() => {
        toast.error('Không tải được danh sách thú cưng. Sử dụng hồ sơ mẫu.');
        setPets(MOCK_PETS);
        const preselect = queryPetId === 'mock-cat' ? MOCK_PETS[1] : MOCK_PETS[0];
        setSelectedPet(preselect);
        setIsGuest(true);
      })
      .finally(() => {
        setLoadingPets(false);
      });
  }, [queryPetId]);

  // Fetch products for active species
  const activeSpecies = selectedPet?.species || 'DOG';
  const { products, loading: loadingProducts, setFilters } = useProducts({
    limit: 80,
    targetSpecies: activeSpecies,
  });

  // Sync species filter reactively when selectedPet changes
  useEffect(() => {
    if (selectedPet?.species) {
      setFilters((prev) => ({
        ...prev,
        targetSpecies: selectedPet.species,
      }));
    }
  }, [selectedPet?.species, setFilters]);

  // Calculate pet age details
  const ageDetails = getPetAgeDetails(selectedPet?.birthday);

  const handleFetchAiAdvice = async () => {
    if (!selectedPet || loadingAi) return;
    setLoadingAi(true);
    setErrorAi(null);

    const prompt = `Tôi có một bé thú cưng tên là ${selectedPet.name}, thuộc loài ${selectedPet.species === 'DOG' ? 'Chó' : 'Mèo'}, giống ${selectedPet.breed}, nặng ${selectedPet.weight} kg, ${ageDetails.text}. Bé ${selectedPet.isVaccinated ? 'đã được tiêm phòng đầy đủ' : 'chưa được tiêm phòng đầy đủ'}.
Hãy đưa ra 3 lời khuyên ngắn gọn, thiết thực nhất về cách chăm sóc sức khỏe, chế độ dinh dưỡng hàng ngày và 1 mẹo huấn luyện hoặc thói quen sinh hoạt tốt nhất dành riêng cho bé. Trình bày ngắn gọn bằng tiếng Việt, phân tách bằng các gạch đầu dòng rõ ràng, không dài dòng.`;

    try {
      const response = await api.post('/chat', {
        messages: [{ role: 'user', content: prompt }]
      });
      if (response.data && response.data.text) {
        setAiAdvice(response.data.text);
      } else {
        setErrorAi('Hệ thống AI không trả về phản hồi hợp lệ. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('AI consultation error:', err);
      const errMsg = err.response?.data?.message || 'Không kết nối được với máy chủ AI. Vui lòng thử lại sau.';
      setErrorAi(errMsg);
    } finally {
      setLoadingAi(false);
    }
  };

  // Fetch recommended Spa services when active pet changes
  useEffect(() => {
    if (!selectedPet) return;
    setLoadingSpa(true);
    spaApi.getServices(selectedPet.species, selectedPet.weight)
      .then((res) => {
        setSpaServices(res.data.filter(s => s.isActive));
      })
      .catch((err) => {
        console.error('Failed to fetch recommended spa services', err);
        setSpaServices([]);
      })
      .finally(() => {
        setLoadingSpa(false);
      });
  }, [selectedPet]);

  // Filter out test/system products (e.g. vouchers, shipping fees, debug products)
  const isTestOrSystemProduct = (product: any) => {
    const nameLower = product.name.toLowerCase();
    const brandLower = (product.brand || '').toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    
    return (
      nameLower.includes('test') ||
      nameLower.includes('freeship') ||
      nameLower.includes('voucher') ||
      nameLower.includes('coupon') ||
      nameLower.includes('phí ship') ||
      nameLower.includes('phí vận chuyển') ||
      brandLower.includes('test') ||
      descLower.includes('test thanh toán') ||
      descLower.includes('test voucher')
    );
  };

  // Filter out products with weight constraints that don't fit the pet's weight
  const isWeightCompatible = (product: any, petWeight: number) => {
    const text = `${product.name} ${product.description || ''}`.toLowerCase();
    
    // 1. Check max weight limits: e.g. "dưới 5kg", "tối đa 4kg", "<3kg", "3kg trở xuống"
    const underRegexes = [
      /dưới\s*(\d+(?:\.\d+)?)\s*kg/g,
      /tối\s*đa\s*(\d+(?:\.\d+)?)\s*kg/g,
      /<\s*(\d+(?:\.\d+)?)\s*kg/g,
      /(\d+(?:\.\d+)?)\s*kg\s*trở\s*xuống/g
    ];
    
    for (const regex of underRegexes) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const maxWeight = parseFloat(match[1]);
        if (!isNaN(maxWeight) && petWeight > maxWeight) {
          return false;
        }
      }
    }

    // 2. Check weight range limits: e.g. "1 - 3kg", "3-5 kg"
    const rangeRegex = /(\d+(?:\.\d+)?)\s*[-to]\s*(\d+(?:\.\d+)?)\s*kg/g;
    let rangeMatch;
    while ((rangeMatch = rangeRegex.exec(text)) !== null) {
      const minWeight = parseFloat(rangeMatch[1]);
      const maxWeight = parseFloat(rangeMatch[2]);
      if (!isNaN(minWeight) && !isNaN(maxWeight)) {
        if (petWeight > maxWeight || petWeight < minWeight) {
          return false;
        }
      }
    }

    return true;
  };

  // Standard sizing weight range mappings (S, M, L, XL, XXL, XXXL) for pet accessories/clothes
  const SIZE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
    s: { min: 0, max: 4 },
    m: { min: 4, max: 8 },
    l: { min: 8, max: 15 },
    xl: { min: 15, max: 30 },
    xxl: { min: 30, max: 100 },
    xxxl: { min: 45, max: 150 },
  };

  // Filter out products with size specs that don't match the pet's weight
  const isSizeCompatible = (product: any, petWeight: number) => {
    if (petWeight <= 0) return true;

    let sizeStr = '';

    // 1. Check specifications JSON
    if (product.specifications && typeof product.specifications === 'object') {
      const specs = product.specifications as Record<string, any>;
      const sizeKey = Object.keys(specs).find(k => {
        const kl = k.toLowerCase();
        return kl === 'size' || kl === 'kích thước' || kl === 'kích cỡ';
      });
      if (sizeKey && typeof specs[sizeKey] === 'string') {
        sizeStr = specs[sizeKey].trim().toLowerCase();
      }
    }

    // 2. Check product name or description
    if (!sizeStr) {
      const nameLower = product.name.toLowerCase();
      const sizeRegex = /\b(?:size|cỡ|kích\s*thước|kích\s*cỡ)\s+([sml]|xl|xxl|xxxl)\b/i;
      const match = nameLower.match(sizeRegex);
      if (match) {
        sizeStr = match[1].toLowerCase();
      } else {
        // Look for standalone size codes separated by space/dash/parentheses, e.g. " - S", "(S)"
        const nameParts = nameLower.split(/[-()]/);
        for (const part of nameParts) {
          const trimmed = part.trim();
          if (/^(s|m|l|xl|xxl|xxxl)$/i.test(trimmed)) {
            sizeStr = trimmed.toLowerCase();
            break;
          }
        }
      }
    }

    if (sizeStr) {
      const cleanSize = sizeStr.replace(/^(size|cỡ)\s+/i, '').trim();
      const range = SIZE_WEIGHT_RANGES[cleanSize];
      if (range) {
        return petWeight >= range.min && petWeight <= range.max;
      }
    }

    return true;
  };

  // Split products into tabs and apply filters (stock, test products, weight compatibility, size compatibility)
  const petWeight = selectedPet?.weight || 0;
  const filteredProducts = products.filter(p => {
    if (p.stock === 0) return false;
    if (isTestOrSystemProduct(p)) return false;
    if (petWeight > 0) {
      if (!isWeightCompatible(p, petWeight)) return false;
      if (!isSizeCompatible(p, petWeight)) return false;
    }
    return true;
  });

  const foodProducts = filteredProducts.filter(p => p.category.includes('FOOD'));
  const toysProducts = filteredProducts.filter(
    p => p.category === 'TOY' || p.category === 'ACCESSORY' || p.category === 'LEASH_COLLAR'
  );
  const careProducts = filteredProducts.filter(
    p =>
      p.category === 'CAGE_BED' ||
      (!p.category.includes('FOOD') &&
        p.category !== 'TOY' &&
        p.category !== 'ACCESSORY' &&
        p.category !== 'LEASH_COLLAR')
  );

  const displayedProducts =
    activeProductTab === 'food'
      ? foodProducts
      : activeProductTab === 'toys'
      ? toysProducts
      : careProducts;

  // Determine pet color theme
  const isDog = activeSpecies === 'DOG';
  const themeColor = isDog ? 'text-[#0F766E]' : 'text-pink-600';
  const themeBg = isDog ? 'bg-[#0F766E]/5 hover:bg-[#0F766E]/10' : 'bg-pink-50 hover:bg-pink-100';
  const themeBorder = isDog ? 'border-[#0F766E]/30' : 'border-pink-300';
  const themeBadge = isDog ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-pink-50 text-pink-700 border-pink-200';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7]" style={{ fontFamily: 'Inter, Outfit, sans-serif' }}>
      <AppHeader sectionLabel="Đề xuất chăm sóc" />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 sm:px-6 w-full space-y-8 animate-in fade-in duration-300">
        
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-teal-500/5 p-6 md:p-10 border border-orange-500/10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600 border border-orange-200">
              <Sparkles className="size-3.5 fill-orange-600/15" />
              Tính năng Cá nhân hóa
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-main)] tracking-tight">
              Cẩm Nang Chăm Sóc & Đồ Dùng Phù Hợp
            </h1>
            <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed">
              Dựa trên giống loài, tuổi và cân nặng của thú cưng, chúng tôi cung cấp các tư vấn y khoa tiêu chuẩn cùng gợi ý các sản phẩm hỗ trợ tốt nhất cho sự phát triển của bé.
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <span className="text-7xl filter drop-shadow-md select-none">🐾</span>
          </div>
        </section>

        {/* Pet Selector Row */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
              <PawPrint className="size-5 text-orange-500" />
              Chọn Thú Cưng để xem Đề Xuất
            </h2>
            {!isGuest && (
              <Link
                href="/my-pets/new"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 hover:text-orange-700 transition"
              >
                <Plus className="size-4" />
                Thêm thú cưng mới
              </Link>
            )}
          </div>

          {isGuest && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 text-xs font-semibold text-amber-800 flex items-start gap-3 shadow-2xs">
              <Info className="size-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Bạn đang sử dụng tài khoản khách hoặc chưa tạo hồ sơ thú cưng. Hãy{' '}
                <Link href="/login" className="underline font-black text-orange-600">Đăng nhập</Link> hoặc{' '}
                <Link href="/my-pets/new" className="underline font-black text-orange-600">Tạo hồ sơ thú cưng</Link>{' '}
                để nhận đề xuất chính xác nhất. Bên dưới là các hồ sơ mẫu để bạn tham khảo.
              </div>
            </div>
          )}

          {loadingPets ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2].map((i) => (
                <div key={i} className="w-56 h-20 rounded-2xl bg-white border border-[#EFEAE2] p-3 animate-pulse flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gray-200 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-2/3 bg-gray-200 rounded-sm" />
                    <div className="h-2 w-1/2 bg-gray-200 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
              {pets.map((pet) => {
                const isActive = selectedPet?.id === pet.id;
                return (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={cn(
                      "w-60 shrink-0 flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition-all duration-300 transform hover:-translate-y-0.5",
                      isActive
                        ? "border-orange-500 bg-orange-50/30 shadow-md"
                        : "border-[#EFEAE2]/80 bg-white hover:border-orange-500/40 hover:shadow-xs"
                    )}
                  >
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shadow-2xs">
                      {pet.avatarUrl || pet.gallery?.[0] ? (
                        <img
                          src={pet.avatarUrl || pet.gallery[0]}
                          alt={pet.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">{pet.species === 'DOG' ? '🐶' : '🐱'}</span>
                      )}
                      {isActive && (
                        <span className="absolute bottom-0 right-0 size-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                          <CheckIcon className="size-2 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-black text-[var(--text-main)]">
                        {pet.name}
                      </h4>
                      <p className="truncate text-[10px] font-bold text-[var(--text-muted)] mt-0.5">
                        {pet.breed}
                      </p>
                      <span className="inline-block text-[8px] font-extrabold uppercase mt-1 px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-600">
                        {pet.species === 'DOG' ? 'Chó' : 'Mèo'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Pet Care Advice Dashboard */}
        {selectedPet && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Health and Medical schedules (Vaccine, Deworm, Checkups) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Pet Info Card */}
              <div className="bg-white rounded-3xl border border-[#EFEAE2] p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-gray-50 border border-[#EFEAE2] flex items-center justify-center shadow-inner">
                  {selectedPet.avatarUrl || selectedPet.gallery?.[0] ? (
                    <img
                      src={selectedPet.avatarUrl || selectedPet.gallery[0]}
                      alt={selectedPet.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">{selectedPet.species === 'DOG' ? '🐶' : '🐱'}</span>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-main)]">{selectedPet.name}</h3>
                    <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">
                      {selectedPet.breed} · {selectedPet.gender === 'MALE' ? 'Đực' : 'Cái'} · {selectedPet.weight} kg
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold border bg-orange-50 text-orange-700 border-orange-200">
                      <Calendar className="size-3" />
                      {ageDetails.text}
                    </span>
                    {selectedPet.isVaccinated ? (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <ShieldCheck className="size-3" />
                        Đã tiêm phòng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold border bg-rose-50 text-rose-700 border-rose-200">
                        <ShieldAlert className="size-3" />
                        Chưa tiêm phòng
                      </span>
                    )}
                    {selectedPet.hasPedigree && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold border bg-amber-50 text-amber-700 border-amber-200">
                        <Award className="size-3" />
                        Phả hệ VKA/TICA
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Virtual Vet Consultation */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50/30 to-amber-50/20 rounded-3xl border border-indigo-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-indigo-900 flex items-center gap-1.5">
                      <Sparkles className="size-4 text-indigo-600 fill-indigo-600/10" />
                      Tư vấn Sức khỏe & Huấn luyện bởi AI
                    </h3>
                    <p className="text-[11px] text-indigo-700/80 font-bold">
                      Bác sĩ ảo Gemini phân tích riêng theo giống, tuổi và cân nặng của {selectedPet.name}.
                    </p>
                  </div>
                  {!aiAdvice && !loadingAi && (
                    <button
                      onClick={handleFetchAiAdvice}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition active:scale-95 shadow-sm shadow-indigo-600/15"
                    >
                      Nhận tư vấn AI 🪄
                    </button>
                  )}
                </div>

                {loadingAi && (
                  <div className="flex items-center gap-3 py-2.5 text-xs font-bold text-indigo-600 animate-pulse">
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Gemini đang nghiên cứu hồ sơ và soạn thảo tư vấn...</span>
                  </div>
                )}

                {errorAi && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-700">
                    ⚠️ {errorAi}
                  </div>
                )}

                {aiAdvice && (
                  <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4.5 border border-indigo-50/60 shadow-2xs space-y-3 relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-indigo-200 select-none pointer-events-none text-3xl font-black opacity-30">Gemini</div>
                    <div className="space-y-1 max-w-full">
                      {renderFormattedText(aiAdvice)}
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleFetchAiAdvice}
                        className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition"
                      >
                        <RefreshCw className="size-3" />
                        Tạo lại tư vấn mới
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Health Planner Card */}
              <div className="bg-white rounded-3xl border border-[#EFEAE2] p-6 shadow-sm space-y-6">
                <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2 border-b border-[#FAF9F7] pb-3">
                  <HeartPulse className="size-5 text-red-500" />
                  Lịch trình Sức khỏe Chủ động
                </h3>

                {/* 1. Vaccination schedule */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-[#FAF9F7] pb-5 last:border-b-0 last:pb-0">
                  <div className="md:col-span-1 flex justify-center md:justify-start">
                    <span className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                      <Syringe className="size-5" />
                    </span>
                  </div>
                  <div className="md:col-span-11 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-sm font-black text-[var(--text-main)]">Lịch tiêm vắc-xin</h4>
                      {selectedPet.isVaccinated ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 w-fit">
                          Đã hoàn thành mũi cơ bản
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 w-fit">
                          Đang có lịch tiêm khuyến nghị
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed">
                      {selectedPet.isVaccinated
                        ? '🛡️ Bé đã hoàn tất các mũi tiêm cơ bản ban đầu. Kháng thể sẽ suy giảm theo thời gian, vui lòng đưa bé đi tiêm nhắc lại 1 mũi vắc-xin tổng hợp & 1 mũi phòng dại định kỳ 12 tháng/lần.'
                        : `⚠️ Bé chưa tiêm chủng đầy đủ. Lịch trình tiêm phòng chuẩn cho ${selectedPet.species === 'DOG' ? 'Chó' : 'Mèo'} non gồm:`}
                    </p>

                    {!selectedPet.isVaccinated && (
                      <div className="bg-[#FAF9F7] rounded-2xl p-3.5 border border-[#EFEAE2]/60 mt-2 space-y-2.5">
                        {selectedPet.species === 'DOG' ? (
                          <>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 1 (6-8 tuần tuổi):</span>
                              <span>Vắc-xin 5 hoặc 7 trong 1 (ngăn ngừa Care, Parvo, Viêm gan truyền nhiễm, Phó cúm...)</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 2 (10-12 tuần tuổi):</span>
                              <span>Vắc-xin 7 trong 1 nhắc lại + Kiểm tra sức khỏe tổng thể.</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 3 (14-16 tuần tuổi):</span>
                              <span>Vắc-xin 7 trong 1 nhắc lại + Tiêm phòng dại (chỉ tiêm khi bé từ 3 tháng trở lên).</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 1 (8 tuần tuổi):</span>
                              <span>Vắc-xin 4 trong 1 (ngăn ngừa giảm bạch cầu, viêm mũi khí quản, Calicivirus...)</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 2 (12 tuần tuổi):</span>
                              <span>Vắc-xin 4 trong 1 nhắc lại để kích hoạt kháng thể tối ưu.</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs font-semibold text-[var(--text-main)]">
                              <span className="text-orange-500 font-bold shrink-0">📍 Mũi 3 (16 tuần tuổi):</span>
                              <span>Vắc-xin 4 trong 1 nhắc lại + Tiêm phòng dại định kỳ.</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Deworming schedule */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-[#FAF9F7] pb-5 last:border-b-0 last:pb-0">
                  <div className="md:col-span-1 flex justify-center md:justify-start">
                    <span className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                      <ListChecks className="size-5" />
                    </span>
                  </div>
                  <div className="md:col-span-11 space-y-2">
                    <h4 className="text-sm font-black text-[var(--text-main)]">Tẩy giun định kỳ</h4>
                    
                    {ageDetails.months <= 6 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed">
                          🍼 Bé mới <span className="font-extrabold text-orange-600">{ageDetails.text}</span>. Trong giai đoạn dưới 6 tháng tuổi, hệ miễn dịch đường ruột của bé còn yếu. 
                          Khuyến nghị tẩy giun **1 lần/tháng** bắt đầu từ tuần thứ 4 cho đến khi đủ 6 tháng tuổi.
                        </p>
                        <div className="text-[11px] font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                          Sản phẩm gợi ý: Thuốc tẩy giun dạng nước uống hoặc viên nhỏ dễ chia liều lượng (Drontal Cat/Puppy, Milbemax).
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed">
                          🐾 Bé đã trưởng thành (<span className="font-extrabold text-orange-600">{ageDetails.text}</span>). 
                          Khuyến nghị tẩy giun định kỳ **mỗi 3 - 6 tháng một lần** để loại bỏ ký sinh trùng đường ruột gây suy dinh dưỡng hoặc viêm ruột.
                        </p>
                        <div className="text-[11px] font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                          Sản phẩm gợi ý: Viên nén tẩy giun phổ rộng (Drontal Plus cho chó, Drontal Cat cho mèo, Nexgard Spectra ngừa cả ký sinh trùng trong và ngoài).
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Clinical checkup recommendation */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-1 flex justify-center md:justify-start">
                    <span className="p-3 rounded-2xl bg-teal-50 text-teal-600">
                      <Activity className="size-5" />
                    </span>
                  </div>
                  <div className="md:col-span-11 space-y-2">
                    <h4 className="text-sm font-black text-[var(--text-main)]">Khám sức khỏe tổng quát</h4>
                    <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed">
                      {ageDetails.months < 12 ? (
                        '👶 Thú non đang trong giai đoạn phát triển thể chất nhanh. Nên đưa bé đi khám lâm sàng 2 tháng một lần (thường lồng ghép vào lịch hẹn tiêm phòng) để theo dõi cân nặng, cơ xương khớp và răng miệng.'
                      ) : ageDetails.years <= 7 ? (
                        '💪 Thú cưng đang ở giai đoạn ổn định. Khuyến nghị duy trì khám sức khỏe định kỳ ít nhất 1 lần/năm để xét nghiệm ký sinh trùng máu, kiểm tra da liễu và chức năng tiêu hóa cơ bản.'
                      ) : (
                        '👴 Thú cưng đã bước vào giai đoạn lão hóa (trên 7 tuổi). Các cơ quan nội tạng dần suy giảm chức năng. Nên khám định kỳ 2 lần/năm, thực hiện xét nghiệm sinh hóa máu, nước tiểu, chụp X-quang khớp và siêu âm ổ bụng để phát hiện sớm các bệnh tim mạch, thận, gan.'
                      )}
                    </p>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column: Nutrition and Grooming Tips */}
            <div className="space-y-6">
              
              {/* Nutrition & Diet advice */}
              <div className="bg-white rounded-3xl border border-[#EFEAE2] p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2 border-b border-[#FAF9F7] pb-3">
                  <Apple className="size-5 text-orange-500" />
                  Chế độ Dinh dưỡng
                </h3>

                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-[#FAF9F7] border border-[#EFEAE2]/60 space-y-1.5">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Khẩu phần đề xuất:</span>
                    <p className="text-xs text-[var(--text-main)] font-semibold leading-relaxed">
                      {ageDetails.months < 12 
                        ? 'Nên cho ăn thức ăn giàu Protein (>30%) và chất béo chất lượng cao để tăng cơ xương. Chia làm 3-4 bữa nhỏ/ngày để tránh đầy hơi dạ dày.'
                        : 'Cho ăn 2 bữa/ngày (Sáng & Tối). Kiểm soát lượng Calo tiêu thụ để tránh thừa cân, béo phì (đặc biệt khi bé đã thiến/triệt sản).'
                      }
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF9F7] border border-[#EFEAE2]/60 space-y-1.5">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Lưu ý nước uống:</span>
                    <p className="text-xs text-[var(--text-main)] font-semibold leading-relaxed">
                      Đảm bảo nước sạch luôn có sẵn 24/7. Với Mèo, khuyến khích lắp vòi nước máy tự động để kích thích mèo uống nước nhiều hơn, ngăn ngừa bệnh sỏi thận và đường tiết niệu.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grooming advice */}
              <div className="bg-white rounded-3xl border border-[#EFEAE2] p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2 border-b border-[#FAF9F7] pb-3">
                  <Scissors className="size-5 text-teal-600" />
                  Chăm sóc & Spa tại nhà
                </h3>

                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <span className="text-xl">🚿</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[var(--text-main)]">Tần suất tắm rửa</h4>
                      <p className="text-[11px] text-[var(--text-muted)] font-semibold leading-relaxed">
                        {isDog 
                          ? 'Nên tắm cho chó từ 1 - 2 tuần/lần. Sử dụng sữa tắm khử mùi, dưỡng lông chuyên biệt phù hợp với màu lông (lông trắng, lông nâu).'
                          : 'Mèo tự chải chuốt thường xuyên, chỉ cần tắm 2 - 3 tháng/lần hoặc khi lông dính bẩn cứng đầu.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="text-xl">🪮</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[var(--text-main)]">Chải lông & Cắt móng</h4>
                      <p className="text-[11px] text-[var(--text-muted)] font-semibold leading-relaxed">
                        Chải lông {isDog ? 'hàng ngày' : '2-3 lần/tuần'} để gỡ rối, giảm thiểu rụng lông ra nhà và kích thích mọc lông mới. Nên cắt móng chân mỗi 2 tuần để tránh móng đâm vào đệm thịt.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Matching status promo card */}
              <div className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-white space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 bottom-0 text-9xl opacity-10 translate-x-8 translate-y-8 select-none pointer-events-none">💖</div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded-md w-fit">Hệ sinh thái PetMatch</span>
                  <h4 className="text-base font-black leading-snug">Tìm người bạn đời hoàn hảo cho bé yêu?</h4>
                  <p className="text-xs text-white/90 leading-relaxed font-semibold">
                    Kết nối với hàng ngàn thú cưng khác trong khu vực của bạn. Bật chế độ ghép đôi để tìm đối tác phối giống chất lượng, có gia phả chuẩn.
                  </p>
                </div>
                <button 
                  onClick={() => router.push('/pet-matching')}
                  className="w-full py-2.5 rounded-xl bg-white text-teal-800 text-xs font-black hover:bg-teal-50 transition active:scale-95 shadow-sm"
                >
                  Khám phá Ghép đôi ngay
                </button>
              </div>

            </div>

          </section>
        )}

        {/* Recommended Products Showcase */}
        <section className="space-y-6 pt-6">
          <div className="border-t border-[#EFEAE2] pt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                <ShoppingBag className="size-5 text-orange-600" />
                Sản phẩm khuyên dùng cho {selectedPet?.name || 'bé'}
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-bold mt-1">
                Lọc tự động dựa trên loài: {isDog ? '🐶 Chó cưng' : '🐱 Mèo cưng'}
              </p>
            </div>

            {/* Product Category Tabs */}
            <div className="flex border border-[#EFEAE2] p-1 rounded-2xl bg-white shadow-2xs w-fit max-w-full overflow-x-auto">
              <button
                onClick={() => setActiveProductTab('food')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap",
                  activeProductTab === 'food'
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                Nutrition & Dinh dưỡng
              </button>
              <button
                onClick={() => setActiveProductTab('toys')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap",
                  activeProductTab === 'toys'
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                Đồ chơi & Phụ kiện
              </button>
              <button
                onClick={() => setActiveProductTab('care')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap",
                  activeProductTab === 'care'
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                Vệ sinh & Chăm sóc
              </button>
            </div>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-[#EFEAE2] bg-white overflow-hidden p-3 space-y-3 animate-pulse">
                  <div className="aspect-square w-full bg-gray-200 rounded-xl" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded-sm" />
                  <div className="h-4.5 w-1/2 bg-gray-200 rounded-sm" />
                </div>
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#EFEAE2] rounded-3xl space-y-4">
              <span className="text-5xl">🛍️</span>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-[var(--text-main)]">Chưa có sản phẩm phù hợp</h4>
                <p className="text-xs text-[var(--text-muted)] font-semibold">
                  Hiện tại danh mục sản phẩm này cho {isDog ? 'Chó' : 'Mèo'} đang được cập nhật thêm.
                </p>
              </div>
              <Link
                href="/shop"
                className="inline-flex h-9 items-center gap-1 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-xs font-extrabold px-5 rounded-xl shadow-xs transition active:scale-95"
              >
                Ghé thăm Cửa hàng lớn
                <ChevronRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* Recommended Spa Services Showcase */}
        {selectedPet && (
          <section className="space-y-6 pt-6 border-t border-[#EFEAE2] mt-8">
            <div>
              <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
                <Scissors className="size-5 text-teal-600" />
                Dịch vụ Spa & Làm đẹp khuyên dùng
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-bold mt-1">
                Phù hợp với thể trạng của {selectedPet.name} ({selectedPet.species === 'DOG' ? 'Chó' : 'Mèo'} · {selectedPet.weight} kg)
              </p>
            </div>

            {/* Educational tip before recommending */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4.5 text-xs font-semibold text-teal-900 leading-relaxed shadow-2xs">
              {selectedPet.species === 'DOG' ? (
                <p>
                  💡 <strong>Lời khuyên vệ sinh</strong>: Chó cần được tắm dưỡng lông, vệ sinh tai và cắt móng định kỳ <strong>1 - 2 lần mỗi tháng</strong>. 
                  Đặc biệt, với các dòng chó năng động hoặc lông dài, việc chăm sóc móng và chải tơi lông thường xuyên là bắt buộc để ngăn ngừa ve, rận, nấm da và tình trạng móng mọc ngược gây đau đớn khi vận động.
                </p>
              ) : (
                <p>
                  💡 <strong>Lời khuyên vệ sinh</strong>: Mèo có thói quen tự liếm lông, nhưng bạn vẫn nên cho bé đi vệ sinh tai, cắt tỉa móng và chải lông chuyên nghiệp <strong>1 lần mỗi tháng</strong>. 
                  Điều này giúp loại bỏ hoàn toàn lông chết bám trên da (giảm thiểu hội chứng búi lông trong ruột do nuốt lông rụng), lấy ráy tai tích tụ phòng viêm tai giữa và giữ bàn chân luôn sạch sẽ, thơm tho.
                </p>
              )}
            </div>

            {loadingSpa ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 rounded-2xl border border-[#EFEAE2] bg-white p-4 animate-pulse flex flex-col justify-between">
                    <div className="h-4 w-1/3 bg-gray-200 rounded-sm" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded-sm" />
                    <div className="h-8 w-24 bg-gray-200 rounded-sm self-end" />
                  </div>
                ))}
              </div>
            ) : spaServices.length === 0 ? (
              <div className="text-center py-10 bg-white border border-[#EFEAE2] rounded-3xl text-xs text-[var(--text-muted)] font-bold">
                Không tìm thấy dịch vụ spa nào phù hợp với loài và cân nặng hiện tại của bé.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {spaServices.map((service) => (
                  <article key={service.id} className="bg-white rounded-2xl border border-[#EFEAE2] p-5 shadow-2xs hover:shadow-md transition duration-300 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-[var(--text-main)]">{service.name}</h4>
                        <span className="text-sm font-black text-[#0F766E]">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(service.price)}
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      <span className="inline-block text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        Thời gian ước tính: {service.durationMin} phút {service.durationMax ? `- ${service.durationMax} phút` : ''}
                      </span>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-[#FAF9F7]">
                      <Link
                        href="/spa/book"
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-xs font-extrabold px-4 shadow-xs transition active:scale-95"
                      >
                        Đặt lịch ngay
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

      </main>

      <Footer />
    </div>
  );
}

// Utility SVG Helper
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F7]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-orange-500" />
            <p className="text-sm font-bold text-[var(--text-muted)]">Đang tải cẩm nang đề xuất...</p>
          </div>
        </div>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
