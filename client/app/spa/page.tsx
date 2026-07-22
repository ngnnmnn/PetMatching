'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Phone, Search, Sparkles, Star } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { spaApi } from '@/lib/api/spa';
import { SpaBranchType, SpaServiceType, AddressSpaType } from '@/types';
import BookingDialog from '@/components/spa/BookingDialog';

// Map images for high aesthetic mockups based on services
const SERVICE_IMAGES: Record<string, string> = {
  'Tắm & sấy cơ bản': 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&h=400&fit=crop',
  'Tắm & sấy cao cấp': 'https://images.unsplash.com/photo-1608096299210-db7e38487075?w=600&h=400&fit=crop',
  'Cắt tỉa lông cơ bản': 'https://images.unsplash.com/photo-1527526029430-319f10814151?w=600&h=400&fit=crop',
  'Cắt tỉa lông theo yêu cầu': 'https://images.unsplash.com/photo-1597633425046-08f5110420b5?w=600&h=400&fit=crop',
  'Chăm sóc móng': 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=600&h=400&fit=crop',
  'Vệ sinh tai & răng': 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&h=400&fit=crop',
  'Massage thư giãn': 'https://images.unsplash.com/photo-1544198365-f5d60b6d8190?w=600&h=400&fit=crop',
  'Gói spa full day': 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&h=400&fit=crop',
  'Gói spa mèo Premium': 'https://images.unsplash.com/photo-1535268647977-a403b69fc756?w=600&h=400&fit=crop',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&h=400&fit=crop';

// Mock ratings and reviews to match the user's mockup style
const RATING_MOCK: Record<string, { rating: number; reviews: number }> = {
  'Tắm & sấy cơ bản': { rating: 4.7, reviews: 234 },
  'Tắm & sấy cao cấp': { rating: 4.9, reviews: 156 },
  'Cắt tỉa lông cơ bản': { rating: 4.6, reviews: 98 },
  'Cắt tỉa lông theo yêu cầu': { rating: 4.8, reviews: 189 },
  'Chăm sóc móng': { rating: 4.5, reviews: 64 },
  'Vệ sinh tai & răng': { rating: 4.7, reviews: 112 },
  'Massage thư giãn': { rating: 4.9, reviews: 45 },
  'Gói spa full day': { rating: 5.0, reviews: 88 },
  'Gói spa mèo Premium': { rating: 4.8, reviews: 73 },
};

const CATEGORIES = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Tắm & Sấy', value: 'Tắm & Sấy' },
  { label: 'Cắt tỉa lông', value: 'Cắt tỉa lông' },
  { label: 'Chăm sóc móng', value: 'Chăm sóc móng' },
  { label: 'Vệ sinh tai & răng', value: 'Vệ sinh tai và răng' },
  { label: 'Massage & Thư giãn', value: 'Massage thư giãn' },
  { label: 'Gói combo', value: 'gói combo' },
];

export default function SpaHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'services' | 'branches'>('services');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [branches, setBranches] = useState<AddressSpaType[]>([]);
  const [services, setServices] = useState<SpaServiceType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Booking dialog state
  const [bookingDialogOpen, setBookingDialogOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<{
    id: string;
    name: string;
    price: number;
    branchId: string;
    branchName: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [branchesRes, servicesRes] = await Promise.all([
          spaApi.getSpaAddresses(),
          spaApi.getServices(),
        ]);
        setBranches(branchesRes.data || []);
        setServices(servicesRes.data || []);
      } catch (error) {
        console.error('Failed to load spa data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleOpenBooking = (service: SpaServiceType) => {
    setSelectedService({
      id: service.id,
      name: service.name,
      price: service.price,
      branchId: service.branchId ?? service.brandId,
      branchName: service.branch?.name || 'Chi nhánh Spa',
    });
    setBookingDialogOpen(true);
  };

  const safeServices = Array.isArray(services) ? services : [];
  const safeBranches = Array.isArray(branches) ? branches : [];

  // Filtering services based on search, tabs and selected sub-categories
  const filteredServices = safeServices.filter((service) => {
    if (!service || !service.name) return false;
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (service.brand?.name && service.brand.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Category filter match
    if (selectedCategory === 'all') return true;

    return service.brand?.name === selectedCategory || service.brand?.name?.includes(selectedCategory);
  });

  const filteredBranches = safeBranches.filter((branch) => {
    if (!branch || !branch.name) return false;
    return (
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (branch.description && branch.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (branch.address && branch.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-12">
      <AppHeader sectionLabel="Spa" />

      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-[#E45D1C] py-16 text-white text-center">
        {/* Abstract shapes for background styling */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
            <Sparkles className="size-3.5 text-yellow-300 fill-yellow-300" />
            Dịch vụ chăm sóc cao cấp
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">PetMatch Spa</h1>
          <p className="text-white/80 font-medium text-sm md:text-base max-w-xl mx-auto">
            Chăm sóc thú cưng chuyên nghiệp, tận tâm. {branches.length || 5} chi nhánh trên toàn quốc.
          </p>

          {/* Search bar inside Hero */}
          <div className="relative max-w-xl mx-auto mt-4 shadow-lg rounded-full overflow-hidden">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Tìm dịch vụ hoặc chi nhánh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full pl-12 pr-6 rounded-full border-0 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary/20 text-sm focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Main Controls Section */}
      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit">
            <button
              onClick={() => {
                setActiveTab('services');
                setSelectedCategory('all');
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                activeTab === 'services'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dịch vụ
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition ${
                activeTab === 'branches'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Chi nhánh
            </button>
          </div>

          {/* My Appointments Button */}
          <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 font-semibold gap-2 w-fit">
            <Link href="/spa/bookings">
              <Calendar className="size-4" />
              Lịch hẹn của tôi
            </Link>
          </Button>
        </div>

        {/* Categories Bar (Only for Services Tab) */}
        {activeTab === 'services' && (
          <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 text-xs font-bold rounded-full transition whitespace-nowrap ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-page)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Grids */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 font-semibold text-sm">Đang tải dữ liệu Spa...</p>
          </div>
        ) : activeTab === 'services' ? (
          // SERVICES GRID - GROUPED BY BRAND / BASE TITLE (ONLY 1 CARD PER SERVICE TYPE)
          (() => {
            const brandMap = new Map<string, {
              id: string;
              title: string;
              description: string;
              minPrice: number;
              maxPrice: number;
              categoryLabel: string;
            }>();

            filteredServices.forEach((service) => {
              let cleanTitle = service.brand?.name || service.name;
              cleanTitle = cleanTitle.replace(/\s*\([^)]*\)/g, '').trim();
              if (!cleanTitle) cleanTitle = service.name;

              let categoryLabel = 'Grooming Spa';
              if (cleanTitle.includes('Tắm')) categoryLabel = 'Tắm & Sấy';
              else if (cleanTitle.includes('tỉa') || cleanTitle.includes('Tỉa')) categoryLabel = 'Cắt tỉa lông';
              else if (cleanTitle.includes('móng') || cleanTitle.includes('Móng')) categoryLabel = 'Chăm sóc móng';
              else if (cleanTitle.includes('tai') || cleanTitle.includes('răng')) categoryLabel = 'Vệ sinh tai & răng';
              else if (cleanTitle.includes('Massage')) categoryLabel = 'Massage';
              else if (cleanTitle.includes('Gói') || cleanTitle.includes('Combo')) categoryLabel = 'Gói combo';

              if (!brandMap.has(cleanTitle)) {
                brandMap.set(cleanTitle, {
                  id: service.id,
                  title: cleanTitle,
                  description: service.description || 'Dịch vụ chăm sóc chuyên sâu dành cho thú cưng theo mốc cân nặng.',
                  minPrice: service.price,
                  maxPrice: service.price,
                  categoryLabel,
                });
              } else {
                const existing = brandMap.get(cleanTitle)!;
                existing.minPrice = Math.min(existing.minPrice, service.price);
                existing.maxPrice = Math.max(existing.maxPrice, service.price);
              }
            });

            const uniqueCards = Array.from(brandMap.values());

            if (uniqueCards.length === 0) {
              return (
                <div className="text-center py-16 bg-white rounded-xl border border-[var(--border-color)] p-8">
                  <p className="text-muted-foreground text-sm">Không tìm thấy dịch vụ nào phù hợp.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uniqueCards.map((card) => {
                  const img = SERVICE_IMAGES[card.title] || DEFAULT_IMAGE;
                  const ratingInfo = RATING_MOCK[card.title] || { rating: 4.8, reviews: 120 };

                  const priceRangeStr = card.minPrice === card.maxPrice
                    ? `${card.minPrice.toLocaleString('vi-VN')}đ`
                    : `${card.minPrice.toLocaleString('vi-VN')}đ – ${card.maxPrice.toLocaleString('vi-VN')}đ`;

                  return (
                    <article
                      key={card.id}
                      className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full"
                    >
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        <img
                          src={img}
                          alt={card.title}
                          className="size-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                        <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-xs px-3 py-1 text-[10px] font-extrabold text-white uppercase tracking-wider">
                          {card.categoryLabel}
                        </span>
                        {card.minPrice !== card.maxPrice && (
                          <span className="absolute bottom-3 right-3 rounded-full bg-purple-900/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-purple-100">
                            Theo mốc cân nặng
                          </span>
                        )}
                      </div>

                      <div className="p-5 flex flex-col flex-1 space-y-3 justify-between">
                        <div className="space-y-1.5">
                          <h3 className="text-base font-extrabold text-gray-900 leading-snug line-clamp-1">
                            {card.title}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
                            {card.description}
                          </p>
                          
                          <div className="flex items-center gap-1 text-amber-500 font-bold text-xs pt-1">
                            <Star className="size-3.5 fill-current" />
                            <span>{ratingInfo.rating.toFixed(1)}</span>
                            <span className="text-gray-400 font-medium">({ratingInfo.reviews} đánh giá)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-150 mt-auto">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Khoảng giá dịch vụ</span>
                            <span className="text-base font-black text-primary">
                              {priceRangeStr}
                            </span>
                          </div>
                          <Button
                            asChild
                            className="bg-primary hover:bg-primary/95 text-white font-black text-xs px-4 h-9 shadow-xs rounded-xl"
                          >
                            <Link href={`/spa/book?serviceId=${card.id}`}>
                              Đặt lịch
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })()
        ) : (
          // BRANCHES GRID
          filteredBranches.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-[var(--border-color)] p-8">
              <p className="text-muted-foreground text-sm">Không tìm thấy chi nhánh nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBranches.map((branch) => (
                <div
                  key={branch.id}
                  className="rounded-xl border border-[var(--border-color)] bg-card p-6 shadow-sm flex flex-col justify-between h-full"
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Chi nhánh Spa</span>
                      <h3 className="text-xl font-bold text-[var(--text-main)]">{branch.name}</h3>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                      {branch.description || 'Chi nhánh chăm sóc sắc đẹp và vệ sinh chuyên sâu của PetMatch.'}
                    </p>
                    
                    <div className="space-y-2 pt-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-color)]">
                      <div className="flex items-start gap-2">
                        <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                        <span>{branch.address || 'Hệ thống chi nhánh PetMatch toàn quốc'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="size-4 text-primary shrink-0" />
                        <span>{branch.phone || '092-222-2000'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-auto">
                    <Button
                      variant="outline"
                      className="w-full text-xs font-bold border-primary/20 text-primary hover:bg-primary/5"
                      onClick={() => {
                        // Switch back to services and filter by this branch name
                        setActiveTab('services');
                        setSelectedCategory(branch.name);
                      }}
                    >
                      Xem dịch vụ chi nhánh
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* Booking Dialog Modal */}
      {selectedService && (
        <BookingDialog
          isOpen={bookingDialogOpen}
          onClose={() => setBookingDialogOpen(false)}
          branchId={selectedService.branchId}
          branchName={selectedService.branchName}
          serviceId={selectedService.id}
          serviceName={selectedService.name}
          price={selectedService.price}
        />
      )}
    </main>
  );
}
