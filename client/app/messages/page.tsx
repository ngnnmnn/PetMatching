'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  Heart,
  ImageIcon,
  Inbox,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PawPrint,
  Send,
  Sparkles,
  User,
  UserCheck,
  UserX,
  Flag,
  X,
} from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type MatchingRequest = {
  id: string;
  note?: string | null;
  createdAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  femalePet: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner: { name: string };
  };
  malePet: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner?: { name: string };
  };
};

type ReportTargetType = 'USER' | 'PET';
type ReportReason =
  | 'INAPPROPRIATE_MESSAGE'
  | 'HARASSMENT'
  | 'FAKE_INFORMATION'
  | 'PET_SAFETY'
  | 'NO_SHOW'
  | 'OTHER';

const reportReasons: Record<
  ReportTargetType,
  Array<{ value: ReportReason; label: string }>
> = {
  USER: [
    { value: 'INAPPROPRIATE_MESSAGE', label: 'Tin nhắn không phù hợp' },
    { value: 'HARASSMENT', label: 'Quấy rối' },
    { value: 'FAKE_INFORMATION', label: 'Thông tin giả' },
    { value: 'NO_SHOW', label: 'Không đến gặp' },
    { value: 'OTHER', label: 'Lý do khác' },
  ],
  PET: [
    { value: 'FAKE_INFORMATION', label: 'Thông tin thú cưng không đúng' },
    { value: 'PET_SAFETY', label: 'Vấn đề an toàn hoặc sức khỏe' },
    { value: 'OTHER', label: 'Lý do khác' },
  ],
};

type Match = {
  id: string;
  status: 'ACTIVE' | 'CANCELLED';
  compatibilityScore: number;
  endedAt?: string | null;
  endReason?: string | null;
  reportedTargetTypes?: ReportTargetType[];
  blockedByMe: boolean;
  createdAt: string;
  pet1: {
    id: string;
    name: string;
    breed: string;
    gender: 'MALE' | 'FEMALE';
    avatarUrl?: string | null;
    owner: { id: string; name: string };
  };
  pet2: {
    id: string;
    name: string;
    breed: string;
    gender: 'MALE' | 'FEMALE';
    avatarUrl?: string | null;
    owner: { id: string; name: string };
  };
  messages?: Array<{
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
    imageUrl?: string | null;
    sender: { id: string; name: string };
  }>;
  _count?: { messages: number };
};

type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
  isRead: boolean;
  imageUrl?: string | null;
  senderName?: string;
  time?: string;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
};

type MatchActionResult = Pick<
  Match,
  | 'id'
  | 'status'
  | 'endedAt'
  | 'endReason'
>;

function getApiErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } }).response?.data
      ?.message || fallback
  );
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<'CHAT' | 'INCOMING' | 'OUTGOING'>('CHAT');
  const [incomingRequests, setIncomingRequests] = useState<MatchingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<MatchingRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Active chat state
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [matchAction, setMatchAction] = useState<'END' | 'REPORT' | 'BLOCK' | 'UNBLOCK' | null>(null);
  const [endReason, setEndReason] = useState('');
  const [reportTargetType, setReportTargetType] = useState<ReportTargetType>('USER');
  const [reportReason, setReportReason] = useState<ReportReason>('INAPPROPRIATE_MESSAGE');
  const [reportDetail, setReportDetail] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      api.get<MatchingRequest[]>('/matching/requests/incoming'),
      api.get<MatchingRequest[]>('/matching/requests/outgoing'),
      api.get<Match[]>('/matching/matches'),
    ])
      .then(([reqResult, outResult, matchResult]) => {
        if (reqResult.status === 'fulfilled') setIncomingRequests(reqResult.value.data || []);
        if (outResult.status === 'fulfilled') setOutgoingRequests(outResult.value.data || []);
        if (matchResult.status === 'fulfilled') {
          const loadedMatches = matchResult.value.data || [];
          setMatches(loadedMatches);
          setSelectedMatch((current) =>
            current
              ? (loadedMatches.find((match) => match.id === current.id) ?? loadedMatches[0] ?? null)
              : (loadedMatches[0] ?? null),
          );
        }
        const failedSections = [
          reqResult.status === 'rejected' ? 'yêu cầu đến' : '',
          outResult.status === 'rejected' ? 'yêu cầu đã gửi' : '',
          matchResult.status === 'rejected' ? 'danh sách ghép đôi' : '',
        ].filter(Boolean);
        if (failedSections.length > 0) {
          toast.error(`Không tải được: ${failedSections.join(', ')}.`);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    try {
      setCurrentUserId((JSON.parse(storedUser) as { id?: string }).id || '');
    } catch {
      setCurrentUserId('');
    }
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    const matchId = selectedMatch.id;
    let cancelled = false;
    let timeoutId: number | undefined;
    const hasCachedMessages = Object.prototype.hasOwnProperty.call(chatMessages, matchId);
    if (!hasCachedMessages) setLoadingMessages(true);

    const loadMessages = async (showError = false) => {
      try {
        const res = await api.get<ChatMessage[]>(`/matching/matches/${matchId}/messages`, { timeout: 10000 });
        if (cancelled) return;
        const persistedMessages = (res.data || []).map((message) => ({
          ...message,
          senderName: message.senderId === currentUserId ? 'Bạn' : message.sender.name,
          time: new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        }));
        setChatMessages((prev) => {
          const localPending = (prev[matchId] || []).filter((message) => message.id.startsWith('temp-'));
          return { ...prev, [matchId]: [...persistedMessages, ...localPending] };
        });
        setMatches((prev) => prev.map((match) => match.id === matchId
          ? { ...match, _count: { messages: 0 } }
          : match));
      } catch {
        if (showError && !cancelled) toast.error('Không tải được lịch sử trò chuyện.');
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
          timeoutId = window.setTimeout(() => loadMessages(), 5000);
        }
      }
    };

    loadMessages(true);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    // Only restart when switching conversation; polling must not react to refreshed match objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatch?.id, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    const refreshMatches = async () => {
      try {
        const res = await api.get<Match[]>('/matching/matches', { timeout: 10000 });
        if (cancelled) return;
        const loadedMatches = res.data || [];
        setMatches(loadedMatches);
        setSelectedMatch((current) => current
          ? loadedMatches.find((match) => match.id === current.id) || current
          : loadedMatches[0] || null);
      } catch {
        // Keep the latest successful conversation list on transient network errors.
      } finally {
        if (!cancelled) timeoutId = window.setTimeout(refreshMatches, 5000);
      }
    };
    timeoutId = window.setTimeout(refreshMatches, 5000);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const respondRequest = async (id: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/matching/requests/${id}/${action}`);
      toast.success(action === 'accept' ? 'Đã chấp nhận yêu cầu ghép đôi và tạo Match!' : 'Đã từ chối yêu cầu.');
      loadData();
    } catch {
      toast.error('Không thể xử lý yêu cầu.');
    }
  };

  const handleImageSelect = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5 MB.');
      return;
    }
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImage(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImage(null);
    setSelectedImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if ((!content && !selectedImage) || !selectedMatch || sendingMessage) return;
    const currentMatchId = selectedMatch.id;
    const imageFile = selectedImage;
    const imagePreview = selectedImagePreview;
    const temporaryId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: temporaryId,
      content,
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      isRead: false,
      imageUrl: imagePreview,
      sender: { id: currentUserId, name: 'Bạn' },
      senderName: 'Bạn',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      deliveryStatus: 'sending',
    };
    setChatMessages((prev) => ({ ...prev, [currentMatchId]: [...(prev[currentMatchId] || []), optimisticMessage] }));
    setInputText('');
    setSendingMessage(true);
    try {
      let res;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        if (content) formData.append('content', content);
        res = await api.post<ChatMessage>(
          `/matching/matches/${currentMatchId}/messages/image`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 },
        );
      } else {
        res = await api.post<ChatMessage>(`/matching/matches/${currentMatchId}/messages`, { content }, { timeout: 10000 });
      }
      const savedMessage: ChatMessage = {
        ...res.data,
        senderName: 'Bạn',
        time: new Date(res.data.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        deliveryStatus: 'sent',
      };
      setChatMessages((prev) => ({
        ...prev,
        [currentMatchId]: (() => {
          const withoutTemporary = (prev[currentMatchId] || []).filter((message) => message.id !== temporaryId);
          return withoutTemporary.some((message) => message.id === savedMessage.id)
            ? withoutTemporary
            : [...withoutTemporary, savedMessage];
        })(),
      }));
      clearSelectedImage();
    } catch {
      setChatMessages((prev) => ({
        ...prev,
        [currentMatchId]: (prev[currentMatchId] || []).map((message) => message.id === temporaryId ? { ...message, deliveryStatus: 'failed' } : message),
      }));
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSendingMessage(false);
    }
  };

  const applyMatchUpdate = (update: MatchActionResult) => {
    setMatches((current) => current.map((match) => (
      match.id === update.id ? { ...match, ...update } : match
    )));
    setSelectedMatch((current) => (
      current?.id === update.id ? { ...current, ...update } : current
    ));
  };

  const handleEndMatch = async () => {
    if (!selectedMatch || matchAction) return;
    setMatchAction('END');
    try {
      const response = await api.post<MatchActionResult>(
        `/matching/matches/${selectedMatch.id}/end`,
        { reason: endReason.trim() || undefined },
      );
      applyMatchUpdate(response.data);
      setEndDialogOpen(false);
      setEndReason('');
      toast.success('Đã kết thúc match. Lịch sử trò chuyện được giữ ở chế độ chỉ đọc.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Không thể kết thúc match.'));
    } finally {
      setMatchAction(null);
    }
  };

  const handleReportMatch = async () => {
    if (!selectedMatch || matchAction) return;
    setMatchAction('REPORT');
    try {
      await api.post(`/matching/matches/${selectedMatch.id}/report`, {
        targetType: reportTargetType,
        reason: reportReason,
        detail: reportDetail.trim() || undefined,
      });
      setMatches((current) => current.map((match) => (
        match.id === selectedMatch.id
          ? {
              ...match,
              reportedTargetTypes: Array.from(new Set([
                ...(match.reportedTargetTypes ?? []),
                reportTargetType,
              ])),
            }
          : match
      )));
      setSelectedMatch((current) => current
        ? {
            ...current,
            reportedTargetTypes: Array.from(new Set([
              ...(current.reportedTargetTypes ?? []),
              reportTargetType,
            ])),
          }
        : current);
      setReportDialogOpen(false);
      setReportDetail('');
      toast.success('Báo cáo đã được gửi tới quản trị viên.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Không thể gửi báo cáo.'));
    } finally {
      setMatchAction(null);
    }
  };

  const openReportDialog = () => {
    if (!selectedMatch) return;
    const reportedTargets = selectedMatch.reportedTargetTypes ?? [];
    const targetType: ReportTargetType = reportedTargets.includes('USER')
      ? 'PET'
      : 'USER';
    setReportTargetType(targetType);
    setReportReason(reportReasons[targetType][0].value);
    setReportDialogOpen(true);
  };

  const handleBlockUser = async () => {
    if (!selectedMatch || matchAction) return;
    setMatchAction('BLOCK');
    try {
      await api.post(`/matching/matches/${selectedMatch.id}/block`);
      setBlockDialogOpen(false);
      toast.success('Đã chặn người dùng. Các tương tác ghép đôi đã được đóng.');
      loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Không thể chặn người dùng.'));
    } finally {
      setMatchAction(null);
    }
  };

  const handleUnblockUser = async () => {
    if (!selectedMatch || matchAction) return;
    const otherUserId = selectedMatch.pet1.owner.id === currentUserId
      ? selectedMatch.pet2.owner.id
      : selectedMatch.pet1.owner.id;
    setMatchAction('UNBLOCK');
    try {
      await api.delete(`/matching/blocks/${otherUserId}`);
      toast.success('Đã bỏ chặn người dùng. Match cũ vẫn ở chế độ chỉ đọc.');
      loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Không thể bỏ chặn người dùng.'));
    } finally {
      setMatchAction(null);
    }
  };

  const currentMatchMessages = useMemo(() => {
    if (!selectedMatch) return [];
    return chatMessages[selectedMatch.id] || [];
  }, [selectedMatch, chatMessages]);

  const currentUserOwnsPet1 = selectedMatch?.pet1.owner.id === currentUserId;
  const otherPet = selectedMatch
    ? (currentUserOwnsPet1 ? selectedMatch.pet2 : selectedMatch.pet1)
    : null;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedMatch?.id, currentMatchMessages.length]);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader sectionLabel="Tin nhắn & Ghép đôi" />

      {/* Hero Tabs Banner */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-orange-50/50">
        <div className="container mx-auto px-4 pt-6 pb-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
                <MessageSquare className="size-3.5" />
                Trung tâm Kết nối & Trò chuyện
              </div>
              <h1 className="text-3xl font-black">Nhắn tin & Yêu cầu Ghép đôi</h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('CHAT')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-extrabold transition-all',
                activeTab === 'CHAT'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <MessageCircle className="size-4" />
              Cặp đôi & Trò chuyện ({matches.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('INCOMING')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-extrabold transition-all relative',
                activeTab === 'INCOMING'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Inbox className="size-4" />
              Yêu cầu Nhận được
              {incomingRequests.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                  {incomingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OUTGOING')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-extrabold transition-all relative',
                activeTab === 'OUTGOING'
                  ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Heart className="size-4 text-primary" />
              Yêu cầu Đã gửi
              {outgoingRequests.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-black text-foreground">
                  {outgoingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="container mx-auto flex-1 px-4 py-6">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Đang tải dữ liệu...</div>
        ) : activeTab === 'CHAT' ? (
          /* ================= TAB 1: MATCHES & DIRECT CHAT WINDOW ================= */
          matches.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Heart className="size-10" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Chưa có cặp đôi ghép thành công nào</h2>
              <p className="mb-6 text-sm text-muted-foreground">Hãy gửi hoặc duyệt các yêu cầu ghép đôi để mở phòng trò chuyện trực tiếp.</p>
              <Button asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
                <Link href="/explore">Khám phá bạn đời ngay</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[min(720px,calc(100vh-280px))] min-h-[520px] rounded-3xl border bg-card overflow-hidden shadow-xl">
              {/* Sidebar Matches List (Left 4 cols) */}
              <div className="lg:col-span-4 min-h-0 border-r flex flex-col bg-muted/20">
                <div className="p-4 border-b">
                  <h3 className="font-extrabold text-base">Danh sách Cặp đôi ({matches.length})</h3>
                  <p className="text-xs text-muted-foreground">Chọn cuộc trò chuyện để trao đổi</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto divide-y">
                  {matches.map((m) => {
                    const isSelected = selectedMatch?.id === m.id;
                    const lastMessage = m.messages?.[0];
                    const unreadCount = m._count?.messages || 0;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMatch(m)}
                        className={cn(
                          'w-full p-4 text-left flex items-center gap-3 transition-all hover:bg-muted/50',
                          isSelected && 'bg-primary/10 border-l-4 border-primary',
                        )}
                      >
                        <div className="flex -space-x-3 shrink-0">
                          <img
                            src={m.pet1.avatarUrl || '/placeholder.svg'}
                            alt={m.pet1.name}
                            className="size-11 rounded-full border-2 border-background object-cover shadow-sm"
                          />
                          <img
                            src={m.pet2.avatarUrl || '/placeholder.svg'}
                            alt={m.pet2.name}
                            className="size-11 rounded-full border-2 border-background object-cover shadow-sm"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm truncate">{m.pet1.name} ❤️ {m.pet2.name}</h4>
                            <div className="ml-2 flex shrink-0 items-center gap-1.5">
                              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                {m.compatibilityScore}%
                              </span>
                              {unreadCount > 0 && !isSelected && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground shadow-sm">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {m.pet1.breed} & {m.pet2.breed}
                          </p>
                          <p className={cn(
                            'mt-1 text-[10px] font-bold',
                            m.status === 'CANCELLED' ? 'text-muted-foreground' : 'text-emerald-600',
                          )}>
                            {m.status === 'ACTIVE' && 'Đang hoạt động'}
                            {m.status === 'CANCELLED' && 'Đã kết thúc'}
                          </p>
                          {lastMessage && (
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className={cn('min-w-0 flex-1 truncate text-xs', unreadCount > 0 && !isSelected ? 'font-extrabold text-foreground' : 'text-muted-foreground')}>
                                {lastMessage.senderId === currentUserId ? 'Bạn: ' : ''}{lastMessage.content || (lastMessage.imageUrl ? '🖼️ Hình ảnh' : '')}
                              </p>
                              <time className="shrink-0 text-[10px] text-muted-foreground">
                                {new Date(lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </time>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Chat Window (Right 8 cols) */}
              {selectedMatch ? (
                <div className="lg:col-span-8 min-h-0 flex flex-col h-full bg-card overflow-hidden">
                  {/* Chat Header */}
                  <div className="shrink-0 flex items-center justify-between gap-3 border-b p-4 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <img src={selectedMatch.pet1.avatarUrl || '/placeholder.svg'} alt={selectedMatch.pet1.name} className="size-10 rounded-full border object-cover" />
                        <img src={selectedMatch.pet2.avatarUrl || '/placeholder.svg'} alt={selectedMatch.pet2.name} className="size-10 rounded-full border object-cover" />
                      </div>
                      <div>
                        <h3 className="font-black text-base leading-tight">
                          {selectedMatch.pet1.name} ({selectedMatch.pet1.owner.name}) & {selectedMatch.pet2.name} ({selectedMatch.pet2.owner.name})
                        </h3>
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold',
                          selectedMatch.status === 'CANCELLED' ? 'text-muted-foreground' : 'text-emerald-600',
                        )}>
                          <span className={cn(
                            'size-2 rounded-full',
                            selectedMatch.status === 'CANCELLED' ? 'bg-muted-foreground' : 'bg-emerald-500 animate-pulse',
                          )} />
                          {selectedMatch.status === 'ACTIVE' && 'Ghép đôi thành công · Phối giống Active'}
                          {selectedMatch.status === 'CANCELLED' && 'Match đã kết thúc · Chỉ đọc'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl border bg-card px-3 py-1.5 text-xs font-extrabold text-primary shadow-sm">
                        {selectedMatch.compatibilityScore}% Phù hợp
                      </span>
                      {selectedMatch.status !== 'CANCELLED' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-bold text-destructive hover:text-destructive"
                          onClick={() => setEndDialogOpen(true)}
                        >
                          Kết thúc
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="size-8 rounded-xl" aria-label="Tùy chọn an toàn">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={(selectedMatch.reportedTargetTypes?.length ?? 0) === 2}
                            onSelect={openReportDialog}
                          >
                            <Flag />
                            {(selectedMatch.reportedTargetTypes?.length ?? 0) === 2
                              ? 'Đã gửi đủ báo cáo'
                              : 'Báo cáo'}
                          </DropdownMenuItem>
                          {selectedMatch.blockedByMe ? (
                            <DropdownMenuItem onSelect={handleUnblockUser} disabled={matchAction === 'UNBLOCK'}>
                              <UserCheck /> Bỏ chặn người dùng
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onSelect={() => setBlockDialogOpen(true)}>
                              <UserX /> Chặn người dùng
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {selectedMatch.status === 'CANCELLED' && (
                    <div className="shrink-0 border-b bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground">
                      {selectedMatch.blockedByMe
                        ? 'Bạn đã chặn người dùng này. Phòng chat hiện ở chế độ chỉ đọc.'
                        : 'Match đã kết thúc. Phòng chat hiện ở chế độ chỉ đọc.'}
                      {selectedMatch.endReason && <span className="ml-1">Lý do: {selectedMatch.endReason}</span>}
                    </div>
                  )}

                  {/* Messages Stream */}
                  <div className="min-h-0 flex-1 p-4 overflow-y-auto overscroll-contain space-y-4 bg-gradient-to-b from-transparent to-muted/20">
                    {loadingMessages && <p className="py-6 text-center text-sm text-muted-foreground">Đang tải lịch sử trò chuyện...</p>}
                    {!loadingMessages && currentMatchMessages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</p>}
                    {currentMatchMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex flex-col',
                          msg.senderId === currentUserId ? 'items-end' : 'items-start',
                        )}
                      >
                        <div className="max-w-[75%] space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground px-1">
                              {msg.senderName} · {msg.time}
                            </span>
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm',
                                msg.senderId === currentUserId
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-card border text-foreground rounded-tl-none',
                              )}
                            >
                              {msg.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setViewingImageUrl(msg.imageUrl || null)}
                                  className="group relative mb-2 block cursor-zoom-in overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label="Xem ảnh lớn"
                                >
                                  <img
                                    src={msg.imageUrl}
                                    alt="Ảnh trong cuộc trò chuyện"
                                    className="max-h-80 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                                  />
                                  <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                                </button>
                              )}
                              {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                            </div>
                            {msg.senderId === currentUserId && (
                              <span className={cn('block px-1 text-right text-[10px] font-semibold', msg.deliveryStatus === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
                                {msg.deliveryStatus === 'sending'
                                  ? 'Đang gửi...'
                                  : msg.deliveryStatus === 'failed'
                                    ? 'Gửi thất bại'
                                    : msg.isRead
                                      ? 'Đã đọc'
                                      : 'Đã gửi'}
                              </span>
                            )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} aria-hidden="true" />
                  </div>

                  {/* Chat Input Bar */}
                  {selectedMatch.status === 'CANCELLED' ? (
                    <div className="shrink-0 border-t bg-muted/30 p-4 text-center text-xs font-bold text-muted-foreground">
                      Phòng chat chỉ đọc
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t bg-card p-4">
                    {selectedImagePreview && (
                      <div className="col-span-3 flex items-center gap-3 rounded-xl border bg-muted/30 p-2">
                        <img src={selectedImagePreview} alt="Ảnh chuẩn bị gửi" className="size-16 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{selectedImage?.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedImage ? `${(selectedImage.size / 1024 / 1024).toFixed(2)} MB` : ''}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={clearSelectedImage} disabled={sendingMessage} aria-label="Bỏ ảnh đã chọn">
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => handleImageSelect(event.target.files?.[0])}
                    />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => imageInputRef.current?.click()} disabled={sendingMessage} aria-label="Chọn ảnh để gửi">
                      <Paperclip className="size-5" />
                    </Button>
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Nhập tin nhắn trao đổi thời gian, địa điểm phối giống..."
                      className="flex-1 rounded-xl font-medium"
                    />
                    <Button type="submit" disabled={sendingMessage || (!inputText.trim() && !selectedImage)} className="rounded-xl font-bold shadow-md shadow-primary/20 shrink-0">
                      <Send className="size-4 mr-1" />
                      Gửi
                    </Button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="lg:col-span-8 flex items-center justify-center text-muted-foreground">
                  Chọn một cuộc trò chuyện để bắt đầu nhắn tin
                </div>
              )}
            </div>
          )
        ) : (
          /* ================= TAB 2: INCOMING REQUESTS ================= */
          activeTab === 'INCOMING' ? (
            incomingRequests.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="size-10" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Chưa có yêu cầu ghép đôi mới nào</h2>
                <p className="text-sm text-muted-foreground">Các lời mời phối giống từ thú cưng cái sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {incomingRequests.map((req) => (
                  <article key={req.id} className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={req.femalePet.avatarUrl || '/placeholder.svg'}
                        alt={req.femalePet.name}
                        className="size-16 rounded-2xl object-cover border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-lg truncate">{req.femalePet.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold">
                          Giống: {req.femalePet.breed} · Chủ sở hữu: <span className="text-foreground">{req.femalePet.owner.name}</span>
                        </p>
                        <p className="mt-1 text-xs font-bold text-primary">
                          Muốn ghép đôi với bé đực: {req.malePet.name}
                        </p>
                      </div>
                    </div>

                    {req.note && (
                      <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed italic text-muted-foreground">
                        &ldquo;{req.note}&rdquo;
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <Button variant="outline" className="rounded-xl font-bold" onClick={() => respondRequest(req.id, 'reject')}>
                        <X className="mr-1 size-4" /> Từ chối
                      </Button>
                      <Button className="rounded-xl font-bold shadow-md shadow-primary/20" onClick={() => respondRequest(req.id, 'accept')}>
                        <Check className="mr-1 size-4" /> Chấp nhận ghép đôi
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            /* ================= TAB 3: OUTGOING REQUESTS ================= */
            outgoingRequests.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Heart className="size-10 text-primary" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Chưa gửi yêu cầu ghép đôi nào</h2>
                <p className="mb-6 text-sm text-muted-foreground">Hãy vào trang Khám phá để tìm bạn đời thích hợp cho thú cưng của bạn.</p>
                <Button asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
                  <Link href="/explore">Khám phá & Gửi yêu cầu ngay</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {outgoingRequests.map((req) => (
                  <article key={req.id} className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={req.malePet.avatarUrl || '/placeholder.svg'}
                        alt={req.malePet.name}
                        className="size-16 rounded-2xl object-cover border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-extrabold text-lg truncate">Gửi tới bé đực: {req.malePet.name}</h3>
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-xs font-black shrink-0',
                              req.status === 'PENDING' && 'bg-amber-100 text-amber-800',
                              req.status === 'ACCEPTED' && 'bg-emerald-100 text-emerald-800',
                              req.status === 'REJECTED' && 'bg-rose-100 text-rose-800',
                              req.status === 'CANCELLED' && 'bg-slate-100 text-slate-800',
                            )}
                          >
                            {req.status === 'PENDING' && 'Chờ phản hồi'}
                            {req.status === 'ACCEPTED' && 'Đã chấp nhận'}
                            {req.status === 'REJECTED' && 'Đã từ chối'}
                            {req.status === 'CANCELLED' && 'Đã hủy'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold">
                          Giống: {req.malePet.breed} {req.malePet.owner?.name ? `· Chủ sở hữu: ${req.malePet.owner.name}` : ''}
                        </p>
                        <p className="mt-1 text-xs font-bold text-pink-600">
                          Bé cái của bạn: {req.femalePet.name} ({req.femalePet.breed})
                        </p>
                      </div>
                    </div>

                    {req.note && (
                      <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed italic text-muted-foreground">
                        Lời nhắn: &ldquo;{req.note}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t font-semibold">
                      <span>Gửi ngày: {new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </article>
                ))}
              </div>
            )
          )
        )}
      </section>

      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kết thúc match</DialogTitle>
            <DialogDescription>
              Phòng chat sẽ chuyển sang chế độ chỉ đọc. Lịch sử tin nhắn vẫn được giữ lại.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="messages-end-match-reason" className="text-xs font-bold">Lý do (không bắt buộc)</label>
            <Textarea
              id="messages-end-match-reason"
              maxLength={1000}
              value={endReason}
              onChange={(event) => setEndReason(event.target.value)}
              placeholder="Nhập lý do kết thúc match..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEndDialogOpen(false)} disabled={matchAction === 'END'}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={handleEndMatch} disabled={matchAction === 'END'}>
              {matchAction === 'END' ? 'Đang kết thúc...' : 'Kết thúc match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi báo cáo</DialogTitle>
            <DialogDescription>
              Chọn người dùng hoặc thú cưng cần báo cáo. Lịch sử chat của match sẽ được gửi tới quản trị viên để xem xét.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="matching-report-target" className="text-xs font-bold">Đối tượng báo cáo</label>
              <select
                id="matching-report-target"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={reportTargetType}
                onChange={(event) => {
                  const targetType = event.target.value as ReportTargetType;
                  setReportTargetType(targetType);
                  setReportReason(reportReasons[targetType][0].value);
                }}
              >
                <option value="USER" disabled={selectedMatch?.reportedTargetTypes?.includes('USER')}>
                  Người dùng: {otherPet?.owner.name ?? '-'}
                </option>
                <option value="PET" disabled={selectedMatch?.reportedTargetTypes?.includes('PET')}>
                  Thú cưng: {otherPet?.name ?? '-'}
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="matching-report-reason" className="text-xs font-bold">Lý do</label>
              <select
                id="matching-report-reason"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as ReportReason)}
              >
                {reportReasons[reportTargetType].map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="matching-report-detail" className="text-xs font-bold">Chi tiết (không bắt buộc)</label>
              <Textarea
                id="matching-report-detail"
                maxLength={1000}
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                placeholder="Mô tả vấn đề để quản trị viên dễ kiểm tra..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportDialogOpen(false)} disabled={matchAction === 'REPORT'}>Hủy</Button>
            <Button type="button" variant="destructive" onClick={handleReportMatch} disabled={matchAction === 'REPORT'}>
              {matchAction === 'REPORT' ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={blockDialogOpen}
        onCancel={() => setBlockDialogOpen(false)}
        onConfirm={handleBlockUser}
        title="Chặn người dùng"
        description="Các yêu cầu ghép đôi đang chờ và match giữa hai bạn sẽ bị đóng. Lịch sử chat vẫn được giữ ở chế độ chỉ đọc."
        confirmText="Chặn"
        loading={matchAction === 'BLOCK'}
      />

      <ImageLightbox
        imageUrl={viewingImageUrl}
        alt="Ảnh trong cuộc trò chuyện"
        onClose={() => setViewingImageUrl(null)}
      />
    </main>
  );
}
