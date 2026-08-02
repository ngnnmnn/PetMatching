'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Cat,
  CheckCircle2,
  Dog,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  adminApi,
  type Breed,
  type BreedRule,
  type BreedRulePayload,
  type CustomBreedItem,
  type Species,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const emptyRuleForm: BreedRulePayload = {
  species: 'DOG',
  breedA: '',
  breedB: '',
  isCompatible: true,
  offspringName: '',
  warningNote: '',
  isActive: true,
};

export default function BreedRulesPage() {
  const [activeMainTab, setActiveMainTab] = useState<'BREEDS' | 'RULES'>('BREEDS');

  // Breed Rules State
  const [rules, setRules] = useState<BreedRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [searchRule, setSearchRule] = useState('');
  const [speciesRule, setSpeciesRule] = useState<'ALL' | Species>('ALL');
  const [statusRule, setStatusRule] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [editingRule, setEditingRule] = useState<BreedRule | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<BreedRulePayload>(emptyRuleForm);
  const [deletingRule, setDeletingRule] = useState<BreedRule | null>(null);

  // Breed Catalog State
  const [officialBreeds, setOfficialBreeds] = useState<Breed[]>([]);
  const [customBreeds, setCustomBreeds] = useState<CustomBreedItem[]>([]);
  const [loadingBreeds, setLoadingBreeds] = useState(true);
  const [savingBreed, setSavingBreed] = useState(false);
  const [searchBreed, setSearchBreed] = useState('');
  const [speciesBreed, setSpeciesBreed] = useState<'ALL' | Species>('ALL');
  const [breedFormOpen, setBreedFormOpen] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [breedForm, setBreedForm] = useState<{ species: Species; name: string; isActive: boolean }>({
    species: 'DOG',
    name: '',
    isActive: true,
  });
  const [deletingBreed, setDeletingBreed] = useState<Breed | null>(null);

  // Load Rules
  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const response = await adminApi.breedRules();
      setRules(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể tải danh sách quy tắc giống.');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // Load Breeds
  const loadBreeds = useCallback(async () => {
    setLoadingBreeds(true);
    try {
      const response = await adminApi.breeds();
      setOfficialBreeds(response.data?.official || []);
      setCustomBreeds(response.data?.custom || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể tải danh mục giống.');
    } finally {
      setLoadingBreeds(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadBreeds();
  }, [loadRules, loadBreeds]);

  // Derived Rules Filter
  const visibleRules = useMemo(() => {
    const keyword = searchRule.trim().toLocaleLowerCase('vi');
    return rules.filter((rule) => {
      const matchesSearch =
        !keyword ||
        rule.breedA.toLocaleLowerCase('vi').includes(keyword) ||
        rule.breedB.toLocaleLowerCase('vi').includes(keyword) ||
        rule.offspringName?.toLocaleLowerCase('vi').includes(keyword);
      const matchesSpecies = speciesRule === 'ALL' || rule.species === speciesRule;
      const matchesStatus =
        statusRule === 'ALL' || (statusRule === 'ACTIVE' ? rule.isActive : !rule.isActive);
      return matchesSearch && matchesSpecies && matchesStatus;
    });
  }, [rules, searchRule, speciesRule, statusRule]);

  // Derived Breeds Filter
  const visibleOfficialBreeds = useMemo(() => {
    const keyword = searchBreed.trim().toLocaleLowerCase('vi');
    return officialBreeds.filter((b) => {
      const matchesSearch = !keyword || b.name.toLocaleLowerCase('vi').includes(keyword);
      const matchesSpecies = speciesBreed === 'ALL' || b.species === speciesBreed;
      return matchesSearch && matchesSpecies;
    });
  }, [officialBreeds, searchBreed, speciesBreed]);

  const visibleCustomBreeds = useMemo(() => {
    const keyword = searchBreed.trim().toLocaleLowerCase('vi');
    return customBreeds.filter((b) => {
      const matchesSearch = !keyword || b.name.toLocaleLowerCase('vi').includes(keyword);
      const matchesSpecies = speciesBreed === 'ALL' || b.species === speciesBreed;
      return matchesSearch && matchesSpecies;
    });
  }, [customBreeds, searchBreed, speciesBreed]);

  // Rule Handlers
  const openCreateRule = (defaultBreedA?: string) => {
    setEditingRule(null);
    setRuleForm({ ...emptyRuleForm, breedA: defaultBreedA || '' });
    setRuleFormOpen(true);
  };

  const openEditRule = (rule: BreedRule) => {
    setEditingRule(rule);
    setRuleForm({
      species: rule.species,
      breedA: rule.breedA,
      breedB: rule.breedB,
      isCompatible: rule.isCompatible,
      offspringName: rule.offspringName ?? '',
      warningNote: rule.warningNote ?? '',
      isActive: rule.isActive,
    });
    setRuleFormOpen(true);
  };

  const submitRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!ruleForm.breedA.trim() || !ruleForm.breedB.trim()) {
      toast.error('Vui lòng nhập đầy đủ hai giống.');
      return;
    }
    if (ruleForm.breedA.trim().toLocaleLowerCase('vi') === ruleForm.breedB.trim().toLocaleLowerCase('vi')) {
      toast.error('Hai giống trong một quy tắc phải khác nhau.');
      return;
    }
    if (!ruleForm.isCompatible && !ruleForm.warningNote?.trim()) {
      toast.error('Quy tắc không khuyến nghị cần có nội dung cảnh báo.');
      return;
    }

    setSavingRule(true);
    try {
      if (editingRule) {
        await adminApi.updateBreedRule(editingRule.id, ruleForm);
        toast.success('Đã cập nhật quy tắc giống.');
      } else {
        await adminApi.createBreedRule(ruleForm);
        toast.success('Đã thêm quy tắc giống.');
      }
      setRuleFormOpen(false);
      await loadRules();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể lưu quy tắc giống.');
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRuleActive = async (rule: BreedRule) => {
    try {
      await adminApi.updateBreedRule(rule.id, {
        species: rule.species,
        breedA: rule.breedA,
        breedB: rule.breedB,
        isCompatible: rule.isCompatible,
        offspringName: rule.offspringName ?? '',
        warningNote: rule.warningNote ?? '',
        isActive: !rule.isActive,
      });
      toast.success(rule.isActive ? 'Đã tắt quy tắc.' : 'Đã bật quy tắc.');
      await loadRules();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể cập nhật quy tắc.');
    }
  };

  const confirmDeleteRule = async () => {
    if (!deletingRule) return;
    try {
      await adminApi.deleteBreedRule(deletingRule.id);
      toast.success('Đã xóa quy tắc giống.');
      setDeletingRule(null);
      await loadRules();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể xóa quy tắc.');
    }
  };

  // Breed Catalog Handlers
  const openCreateBreed = (prefilledName?: string, prefilledSpecies?: Species) => {
    setEditingBreed(null);
    setBreedForm({
      species: prefilledSpecies || 'DOG',
      name: prefilledName || '',
      isActive: true,
    });
    setBreedFormOpen(true);
  };

  const openEditBreed = (breed: Breed) => {
    setEditingBreed(breed);
    setBreedForm({
      species: breed.species,
      name: breed.name,
      isActive: breed.isActive,
    });
    setBreedFormOpen(true);
  };

  const submitBreed = async (event: FormEvent) => {
    event.preventDefault();
    if (!breedForm.name.trim()) {
      toast.error('Vui lòng nhập tên giống.');
      return;
    }

    setSavingBreed(true);
    try {
      if (editingBreed) {
        await adminApi.updateBreed(editingBreed.id, breedForm);
        toast.success('Đã cập nhật giống thú cưng.');
      } else {
        await adminApi.createBreed(breedForm);
        toast.success('Đã thêm giống mới vào danh mục chính thức.');
      }
      setBreedFormOpen(false);
      await loadBreeds();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể lưu giống.');
    } finally {
      setSavingBreed(false);
    }
  };

  const toggleBreedActive = async (breed: Breed) => {
    try {
      await adminApi.updateBreed(breed.id, { isActive: !breed.isActive });
      toast.success(breed.isActive ? 'Đã ẩn giống khỏi danh sách chọn.' : 'Đã kích hoạt lại giống.');
      await loadBreeds();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể cập nhật giống.');
    }
  };

  const confirmDeleteBreed = async () => {
    if (!deletingBreed) return;
    try {
      await adminApi.deleteBreed(deletingBreed.id);
      toast.success('Đã xóa giống khỏi danh mục.');
      setDeletingBreed(null);
      await loadBreeds();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể xóa giống.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Quản lý Giống & Quy tắc Phối giống</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Cấu hình danh mục giống chính thức, duyệt giống do người dùng tự nhập và thiết lập quy tắc tương thích.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-2xl border">
          <button
            type="button"
            onClick={() => setActiveMainTab('BREEDS')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all',
              activeMainTab === 'BREEDS'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Dog className="size-4" /> Danh mục Giống ({officialBreeds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('RULES')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all',
              activeMainTab === 'RULES'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <SlidersHorizontal className="size-4" /> Quy tắc Phối giống ({rules.length})
          </button>
        </div>
      </div>

      {/* ================= MAIN TAB 1: DANH MỤC GIỐNG ================= */}
      {activeMainTab === 'BREEDS' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên giống..."
                  value={searchBreed}
                  onChange={(e) => setSearchBreed(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>

              <div className="flex rounded-xl border bg-muted/20 p-1">
                <button
                  type="button"
                  onClick={() => setSpeciesBreed('ALL')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                    speciesBreed === 'ALL' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSpeciesBreed('DOG')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                    speciesBreed === 'DOG' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  <Dog className="size-3 text-amber-600" /> Chó
                </button>
                <button
                  type="button"
                  onClick={() => setSpeciesBreed('CAT')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                    speciesBreed === 'CAT' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  <Cat className="size-3 text-violet-600" /> Mèo
                </button>
              </div>
            </div>

            <Button onClick={() => openCreateBreed()} className="rounded-xl font-bold gap-2">
              <Plus className="size-4" /> Thêm giống mới
            </Button>
          </div>

          {/* Section: Custom Breeds from User Pets (Chờ duyệt) */}
          {visibleCustomBreeds.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-600" />
                <h2 className="text-base font-extrabold text-amber-900">
                  Giống người dùng tự nhập ({visibleCustomBreeds.length})
                </h2>
              </div>
              <p className="text-xs text-amber-700">
                Các giống thú cưng này do người dùng nhập khi đăng ký pet. Nhấn nút &ldquo;Phê duyệt&rdquo; để đưa vào Danh mục chính thức và cấu hình quy tắc lai phối.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {visibleCustomBreeds.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-card border shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.species === 'DOG' ? (
                        <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 font-bold text-xs">🐕</span>
                      ) : (
                        <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 font-bold text-xs">🐈</span>
                      )}
                      <span className="font-bold text-xs truncate">{item.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
                      onClick={() => openCreateBreed(item.name, item.species)}
                    >
                      Phê duyệt
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Official Breed Catalog */}
          {loadingBreeds ? (
            <div className="py-16 text-center text-muted-foreground">Đang tải danh mục giống...</div>
          ) : visibleOfficialBreeds.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Chưa có giống nào trong danh mục.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleOfficialBreeds.map((breed) => (
                <div
                  key={breed.id}
                  className={cn(
                    'p-4 rounded-2xl border bg-card transition-all flex flex-col justify-between space-y-3',
                    !breed.isActive && 'opacity-60 bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {breed.species === 'DOG' ? (
                        <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold text-sm shrink-0">
                          🐕
                        </span>
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold text-sm shrink-0">
                          🐈
                        </span>
                      )}
                      <h3 className="font-extrabold text-sm truncate">{breed.name}</h3>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-black shrink-0',
                        breed.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {breed.isActive ? 'Bật' : 'Tắt'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleBreedActive(breed)}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      {breed.isActive ? 'Tắt kích hoạt' : 'Bật kích hoạt'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openCreateRule(breed.name)}
                        title="Tạo quy tắc phối cho giống này"
                        className="p-1 rounded-lg text-primary hover:bg-primary/10 font-bold text-xs flex items-center gap-1"
                      >
                        <SlidersHorizontal className="size-3.5" /> Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditBreed(breed)}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingBreed(breed)}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MAIN TAB 2: QUY TẮC PHỐI GIỐNG ================= */}
      {activeMainTab === 'RULES' && (
        <div className="space-y-6">
          {/* Action & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm quy tắc lai phối..."
                  value={searchRule}
                  onChange={(e) => setSearchRule(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>

              <div className="flex rounded-xl border bg-muted/20 p-1">
                <button
                  type="button"
                  onClick={() => setSpeciesRule('ALL')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                    speciesRule === 'ALL' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSpeciesRule('DOG')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                    speciesRule === 'DOG' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  <Dog className="size-3 text-amber-600" /> Chó
                </button>
                <button
                  type="button"
                  onClick={() => setSpeciesRule('CAT')}
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1',
                    speciesRule === 'CAT' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  <Cat className="size-3 text-violet-600" /> Mèo
                </button>
              </div>
            </div>

            <Button onClick={() => openCreateRule()} className="rounded-xl font-bold gap-2">
              <Plus className="size-4" /> Thêm quy tắc lai
            </Button>
          </div>

          {/* Rules List */}
          {loadingRules ? (
            <div className="py-16 text-center text-muted-foreground">Đang tải quy tắc phối giống...</div>
          ) : visibleRules.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Chưa có quy tắc phối giống nào.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleRules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    'p-5 rounded-3xl border bg-card space-y-4 shadow-sm transition-all',
                    !rule.isActive && 'opacity-60 bg-muted/20',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                          {rule.species === 'DOG' ? '🐕 Giống Chó' : '🐈 Giống Mèo'}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-black',
                            rule.isCompatible
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800',
                          )}
                        >
                          {rule.isCompatible ? '✓ Tương thích (+20đ)' : '⚠ Cảnh báo (-10đ)'}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base leading-tight">
                        {rule.breedA} <span className="text-primary font-normal">❤️</span> {rule.breedB}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRule(rule)}
                        className="p-2 rounded-xl hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Offspring & Warning Note */}
                  {(rule.offspringName || rule.warningNote) && (
                    <div className="space-y-2 pt-2 border-t text-xs">
                      {rule.offspringName && (
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                          <Sparkles className="size-4 text-amber-500 shrink-0" />
                          <span>Dòng con lai: <span className="font-extrabold text-primary">{rule.offspringName}</span></span>
                        </div>
                      )}
                      {rule.warningNote && (
                        <div className="flex items-start gap-2 text-rose-700 bg-rose-50 p-2.5 rounded-xl font-medium border border-rose-200">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                          <span>{rule.warningNote}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleRuleActive(rule)}
                      className="font-bold hover:text-foreground"
                    >
                      Trạng thái: <span className={rule.isActive ? 'text-emerald-600' : 'text-slate-500'}>{rule.isActive ? 'Đang hoạt động' : 'Tắt'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: BREED CATALOG FORM ================= */}
      {breedFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card rounded-3xl p-6 shadow-2xl space-y-5 border">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-black text-lg">
                {editingBreed ? 'Chỉnh sửa Giống thú cưng' : 'Thêm Giống mới vào Danh mục'}
              </h2>
              <button type="button" onClick={() => setBreedFormOpen(false)}><X className="size-5" /></button>
            </div>

            <form onSubmit={submitBreed} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loài *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBreedForm({ ...breedForm, species: 'DOG' })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      breedForm.species === 'DOG' ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                    )}
                  >
                    <Dog className="size-4" /> Chó
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreedForm({ ...breedForm, species: 'CAT' })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      breedForm.species === 'CAT' ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                    )}
                  >
                    <Cat className="size-4" /> Mèo
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tên giống *</label>
                <Input
                  value={breedForm.name}
                  onChange={(e) => setBreedForm({ ...breedForm, name: e.target.value })}
                  placeholder="Ví dụ: Poodle, Corgi, Mèo ta..."
                  className="rounded-xl font-bold"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={breedForm.isActive}
                  onChange={(e) => setBreedForm({ ...breedForm, isActive: e.target.checked })}
                  className="size-4 accent-primary"
                />
                <span>Kích hoạt hiển thị cho người dùng chọn</span>
              </label>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setBreedFormOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={savingBreed} className="flex-1 rounded-xl font-bold">
                  {savingBreed ? <Loader2 className="size-4 animate-spin" /> : editingBreed ? 'Cập nhật' : 'Thêm giống'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: BREED RULE FORM ================= */}
      {ruleFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-card rounded-3xl p-6 shadow-2xl space-y-5 border overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-black text-lg">
                {editingRule ? 'Chỉnh sửa Quy tắc Lai phối' : 'Thêm Quy tắc Phối giống mới'}
              </h2>
              <button type="button" onClick={() => setRuleFormOpen(false)}><X className="size-5" /></button>
            </div>

            <form onSubmit={submitRule} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loài *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, species: 'DOG' })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      ruleForm.species === 'DOG' ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                    )}
                  >
                    <Dog className="size-4" /> Chó
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, species: 'CAT' })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      ruleForm.species === 'CAT' ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                    )}
                  >
                    <Cat className="size-4" /> Mèo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Giống thứ nhất (A) *</label>
                  <Input
                    value={ruleForm.breedA}
                    onChange={(e) => setRuleForm({ ...ruleForm, breedA: e.target.value })}
                    placeholder="Ví dụ: Pug"
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Giống thứ hai (B) *</label>
                  <Input
                    value={ruleForm.breedB}
                    onChange={(e) => setRuleForm({ ...ruleForm, breedB: e.target.value })}
                    placeholder="Ví dụ: Beagle"
                    className="rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Đánh giá Tương thích *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, isCompatible: true })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      ruleForm.isCompatible ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-border',
                    )}
                  >
                    <ShieldCheck className="size-4 text-emerald-600" /> Tương thích (+20đ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, isCompatible: false })}
                    className={cn(
                      'p-3 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition-all',
                      !ruleForm.isCompatible ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-border',
                    )}
                  >
                    <ShieldAlert className="size-4 text-rose-600" /> Khuyên tránh (-10đ)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tên dòng con lai (Tùy chọn)</label>
                <Input
                  value={ruleForm.offspringName}
                  onChange={(e) => setRuleForm({ ...ruleForm, offspringName: e.target.value })}
                  placeholder="Ví dụ: Puggle"
                  className="rounded-xl font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nội dung Cảnh báo / Ghi chú</label>
                <textarea
                  value={ruleForm.warningNote}
                  onChange={(e) => setRuleForm({ ...ruleForm, warningNote: e.target.value })}
                  placeholder="Nhập ghi chú cảnh báo di truyền hoặc rủi ro vóc dáng..."
                  rows={3}
                  className="w-full rounded-xl border bg-background p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setRuleFormOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={savingRule} className="flex-1 rounded-xl font-bold">
                  {savingRule ? <Loader2 className="size-4 animate-spin" /> : editingRule ? 'Cập nhật' : 'Thêm quy tắc'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation */}
      <ConfirmDialog
        open={!!deletingRule}
        title="Xóa quy tắc phối giống?"
        description={`Bạn có chắc chắn muốn xóa quy tắc lai phối giữa ${deletingRule?.breedA} và ${deletingRule?.breedB}?`}
        onConfirm={confirmDeleteRule}
        onCancel={() => setDeletingRule(null)}
      />

      {/* Delete Breed Confirmation */}
      <ConfirmDialog
        open={!!deletingBreed}
        title="Xóa giống khỏi danh mục?"
        description={`Bạn có chắc chắn muốn xóa giống ${deletingBreed?.name} khỏi danh mục chính thức?`}
        onConfirm={confirmDeleteBreed}
        onCancel={() => setDeletingBreed(null)}
      />
    </div>
  );
}
