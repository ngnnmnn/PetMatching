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
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  adminApi,
  type BreedRule,
  type BreedRulePayload,
  type Species,
} from '@/lib/api/admin';

const emptyForm: BreedRulePayload = {
  species: 'DOG',
  breedA: '',
  breedB: '',
  isCompatible: true,
  offspringName: '',
  warningNote: '',
  isActive: true,
};

export default function BreedRulesPage() {
  const [rules, setRules] = useState<BreedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<'ALL' | Species>('ALL');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [editing, setEditing] = useState<BreedRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BreedRulePayload>(emptyForm);
  const [deleting, setDeleting] = useState<BreedRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.breedRules();
      setRules(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể tải danh sách quy tắc giống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRules = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return rules.filter((rule) => {
      const matchesSearch =
        !keyword ||
        rule.breedA.toLocaleLowerCase('vi').includes(keyword) ||
        rule.breedB.toLocaleLowerCase('vi').includes(keyword) ||
        rule.offspringName?.toLocaleLowerCase('vi').includes(keyword);
      const matchesSpecies = species === 'ALL' || rule.species === species;
      const matchesStatus =
        status === 'ALL' || (status === 'ACTIVE' ? rule.isActive : !rule.isActive);
      return matchesSearch && matchesSpecies && matchesStatus;
    });
  }, [rules, search, species, status]);

  const stats = useMemo(
    () => ({
      total: rules.length,
      compatible: rules.filter((rule) => rule.isCompatible && rule.isActive).length,
      warnings: rules.filter((rule) => !rule.isCompatible && rule.isActive).length,
    }),
    [rules],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (rule: BreedRule) => {
    setEditing(rule);
    setForm({
      species: rule.species,
      breedA: rule.breedA,
      breedB: rule.breedB,
      isCompatible: rule.isCompatible,
      offspringName: rule.offspringName ?? '',
      warningNote: rule.warningNote ?? '',
      isActive: rule.isActive,
    });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.breedA.trim() || !form.breedB.trim()) {
      toast.error('Vui lòng nhập đầy đủ hai giống.');
      return;
    }
    if (form.breedA.trim().toLocaleLowerCase('vi') === form.breedB.trim().toLocaleLowerCase('vi')) {
      toast.error('Hai giống trong một quy tắc phải khác nhau.');
      return;
    }
    if (!form.isCompatible && !form.warningNote?.trim()) {
      toast.error('Quy tắc không khuyến nghị cần có nội dung cảnh báo.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateBreedRule(editing.id, form);
        toast.success('Đã cập nhật quy tắc giống.');
      } else {
        await adminApi.createBreedRule(form);
        toast.success('Đã thêm quy tắc giống.');
      }
      setFormOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể lưu quy tắc giống.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: BreedRule) => {
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
      toast.success(rule.isActive ? 'Đã tạm ngưng quy tắc.' : 'Đã kích hoạt quy tắc.');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể đổi trạng thái quy tắc.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await adminApi.deleteBreedRule(deleting.id);
      toast.success('Đã xóa quy tắc giống.');
      setDeleting(null);
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Không thể xóa quy tắc giống.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#CFE3E0] bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#0F766E]" />
        <div className="relative flex flex-col justify-between gap-5 p-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white">
              <SlidersHorizontal className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Ghép đôi</p>
              <h2 className="mt-1.5 text-3xl font-black text-[#172033]">Quy tắc giống</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#64748B]">
                Quản lý mức tương thích, tên con lai và cảnh báo cho từng cặp giống.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MiniStat label="Tổng quy tắc" value={stats.total} />
            <MiniStat label="Khuyến nghị" value={stats.compatible} tone="green" />
            <MiniStat label="Cảnh báo" value={stats.warnings} tone="red" />
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#115E59]"
            >
              <Plus className="size-4" /> Thêm quy tắc
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5EAF0] bg-[#FAFBFC] p-4 md:flex-row">
          <label className="relative flex-1 block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên giống hoặc tên con lai..."
              className="h-11 w-full rounded-xl border border-[#D8E0EA] bg-white pl-10 pr-10 text-sm font-semibold outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <FilterSelect value={species} onChange={(value) => setSpecies(value as typeof species)}>
            <option value="ALL">Tất cả loài</option>
            <option value="DOG">Chó</option>
            <option value="CAT">Mèo</option>
          </FilterSelect>
          <FilterSelect value={status} onChange={(value) => setStatus(value as typeof status)}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="INACTIVE">Tạm ngưng</option>
          </FilterSelect>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[#0F766E]" />
          </div>
        ) : visibleRules.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <SlidersHorizontal className="size-10 text-[#94A3B8]" />
            <p className="mt-3 font-black text-[#172033]">Không tìm thấy quy tắc</p>
            <p className="mt-1 text-sm font-semibold text-[#64748B]">Thử thay đổi bộ lọc hoặc thêm quy tắc mới.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead className="bg-[#F7F9FB] text-[11px] font-black uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Loài</th>
                  <th className="px-5 py-3">Cặp giống</th>
                  <th className="px-5 py-3">Đánh giá</th>
                  <th className="px-5 py-3">Tên con lai</th>
                  <th className="px-5 py-3">Cảnh báo</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0]">
                {visibleRules.map((rule) => (
                  <tr key={rule.id} className={!rule.isActive ? 'bg-[#FAFBFC] opacity-70' : 'hover:bg-[#FAFBFC]'}>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 font-black text-[#334155]">
                        {rule.species === 'DOG' ? <Dog className="size-4" /> : <Cat className="size-4" />}
                        {rule.species === 'DOG' ? 'Chó' : 'Mèo'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black text-[#172033]">{rule.breedA} × {rule.breedB}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                        rule.isCompatible ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {rule.isCompatible ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        {rule.isCompatible ? 'Khuyến nghị (+20)' : 'Không khuyến nghị (-10)'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#475569]">{rule.offspringName || '—'}</td>
                    <td className="max-w-xs px-5 py-4 text-sm font-semibold text-[#64748B]">
                      <p className="line-clamp-2">{rule.warningNote || 'Không có cảnh báo'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleActive(rule)}
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          rule.isActive ? 'bg-[#E7F3F1] text-[#0F766E]' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rule.isActive ? 'Đang áp dụng' : 'Tạm ngưng'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <IconButton label="Chỉnh sửa" onClick={() => openEdit(rule)}><Pencil className="size-4" /></IconButton>
                        <IconButton label="Xóa" danger onClick={() => setDeleting(rule)}><Trash2 className="size-4" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <BreedRuleForm
          form={form}
          editing={editing}
          saving={saving}
          onChange={setForm}
          onClose={() => setFormOpen(false)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Xóa quy tắc giống?"
        message={
          deleting
            ? `Quy tắc ${deleting.breedA} × ${deleting.breedB} sẽ bị xóa vĩnh viễn. Bạn có thể chọn tạm ngưng nếu muốn giữ lại dữ liệu.`
            : ''
        }
        confirmText="Xóa quy tắc"
        isDanger
        loading={saving}
      />
    </div>
  );
}

function BreedRuleForm({
  form,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: BreedRulePayload;
  editing: BreedRule | null;
  saving: boolean;
  onChange: (value: BreedRulePayload) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const inputClass = 'h-11 w-full rounded-xl border border-[#D8E0EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-[#E5EAF0] p-6">
          <h3 className="text-xl font-black text-[#172033]">{editing ? 'Chỉnh sửa quy tắc' : 'Thêm quy tắc giống'}</h3>
          <p className="mt-1 text-sm font-semibold text-[#64748B]">Hai chiều của cặp giống được xem là cùng một quy tắc.</p>
        </div>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Field label="Loài">
            <select className={inputClass} value={form.species} onChange={(event) => onChange({ ...form, species: event.target.value as Species })}>
              <option value="DOG">Chó</option>
              <option value="CAT">Mèo</option>
            </select>
          </Field>
          <Field label="Đánh giá">
            <select className={inputClass} value={String(form.isCompatible)} onChange={(event) => onChange({ ...form, isCompatible: event.target.value === 'true' })}>
              <option value="true">Khuyến nghị (+20 điểm)</option>
              <option value="false">Không khuyến nghị (-10 điểm)</option>
            </select>
          </Field>
          <Field label="Giống A" required>
            <input className={inputClass} maxLength={100} value={form.breedA} onChange={(event) => onChange({ ...form, breedA: event.target.value })} placeholder="Ví dụ: Poodle" />
          </Field>
          <Field label="Giống B" required>
            <input className={inputClass} maxLength={100} value={form.breedB} onChange={(event) => onChange({ ...form, breedB: event.target.value })} placeholder="Ví dụ: Golden Retriever" />
          </Field>
          <Field label="Tên con lai dự kiến">
            <input className={inputClass} maxLength={150} value={form.offspringName ?? ''} onChange={(event) => onChange({ ...form, offspringName: event.target.value })} placeholder="Ví dụ: Goldendoodle" />
          </Field>
          <Field label="Trạng thái">
            <select className={inputClass} value={String(form.isActive)} onChange={(event) => onChange({ ...form, isActive: event.target.value === 'true' })}>
              <option value="true">Đang áp dụng</option>
              <option value="false">Tạm ngưng</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={`Cảnh báo${form.isCompatible ? '' : ' (bắt buộc)'}`} required={!form.isCompatible}>
              <textarea
                className="min-h-28 w-full resize-y rounded-xl border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10"
                maxLength={1000}
                value={form.warningNote ?? ''}
                onChange={(event) => onChange({ ...form, warningNote: event.target.value })}
                placeholder="Nhập lưu ý về sức khỏe hoặc rủi ro di truyền..."
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#E5EAF0] bg-[#FAFBFC] p-5">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#D8E0EA] px-4 text-sm font-black text-[#475569]">Hủy</button>
          <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-black text-white disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? 'Lưu thay đổi' : 'Thêm quy tắc'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#334155]">
      <span>{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
    </label>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#D8E0EA] bg-white px-3 text-sm font-bold text-[#334155] outline-none focus:border-[#0F766E]">{children}</select>;
}

function IconButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`inline-flex size-9 items-center justify-center rounded-lg border transition ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-[#D8E0EA] text-[#475569] hover:border-[#0F766E] hover:text-[#0F766E]'}`}>{children}</button>;
}

function MiniStat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-[#172033]';
  return <div className="min-w-24 rounded-xl border border-[#E5EAF0] bg-[#F7F9FB] px-3 py-2 text-center"><p className={`text-xl font-black ${color}`}>{value}</p><p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">{label}</p></div>;
}
