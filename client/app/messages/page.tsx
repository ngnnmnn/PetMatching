'use client';

import { useEffect, useState, useMemo } from 'react';
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
  Paperclip,
  PawPrint,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    verificationBadge?: string;
    owner: { name: string };
  };
  malePet: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    verificationBadge?: string;
    owner?: { name: string };
  };
};

type Match = {
  id: string;
  compatibilityScore: number;
  createdAt: string;
  pet1: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner: { name: string };
  };
  pet2: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner: { name: string };
  };
};

type ChatMessage = {
  id: string;
  sender: 'system' | 'me' | 'partner';
  senderName: string;
  text: string;
  imageUrl?: string;
  time: string;
};

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<'CHAT' | 'INCOMING' | 'OUTGOING'>('CHAT');
  const [incomingRequests, setIncomingRequests] = useState<MatchingRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Active chat state
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({
    default: [
      {
        id: 'sys-1',
        sender: 'system',
        senderName: 'Hệ thống',
        text: '🎉 Hai bên đã ghép đôi thành công! Hãy trao đổi về thời gian và địa điểm phối giống.',
        time: 'Hôm nay',
      },
    ],
  });
  const [inputText, setInputText] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<MatchingRequest[]>('/matching/requests/incoming'),
      api.get<Match[]>('/matching/matches'),
    ])
      .then(([reqRes, matchRes]) => {
        setIncomingRequests(reqRes.data || []);
        setMatches(matchRes.data || []);
        if (matchRes.data && matchRes.data.length > 0 && !selectedMatch) {
          setSelectedMatch(matchRes.data[0]);
        }
      })
      .catch(() => toast.error('Không tải được danh sách ghép đôi và tin nhắn.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const respondRequest = async (id: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/matching/requests/${id}/${action}`);
      toast.success(action === 'accept' ? 'Đã chấp nhận yêu cầu ghép đôi và tạo Match!' : 'Đã từ chối yêu cầu.');
      loadData();
    } catch {
      toast.error('Không thể xử lý yêu cầu.');
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedMatch) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'me',
      senderName: 'Bạn',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMatchId = selectedMatch.id;
    setChatMessages((prev) => ({
      ...prev,
      [currentMatchId]: [...(prev[currentMatchId] || prev['default'] || []), newMsg],
    }));

    setInputText('');
  };

  const currentMatchMessages = useMemo(() => {
    if (!selectedMatch) return [];
    return chatMessages[selectedMatch.id] || chatMessages['default'] || [];
  }, [selectedMatch, chatMessages]);

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

            <Link
              href="/requests"
              className="flex items-center gap-2 border-b-2 border-transparent px-5 py-3 text-sm font-extrabold text-muted-foreground hover:text-foreground transition-all"
            >
              <Heart className="size-4 text-primary" />
              Yêu cầu Đã gửi
            </Link>
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px] rounded-3xl border bg-card overflow-hidden shadow-xl">
              {/* Sidebar Matches List (Left 4 cols) */}
              <div className="lg:col-span-4 border-r flex flex-col bg-muted/20">
                <div className="p-4 border-b">
                  <h3 className="font-extrabold text-base">Danh sách Cặp đôi ({matches.length})</h3>
                  <p className="text-xs text-muted-foreground">Chọn cuộc trò chuyện để trao đổi</p>
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {matches.map((m) => {
                    const isSelected = selectedMatch?.id === m.id;
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
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {m.compatibilityScore}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {m.pet1.breed} & {m.pet2.breed}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Chat Window (Right 8 cols) */}
              {selectedMatch ? (
                <div className="lg:col-span-8 flex flex-col h-full bg-card">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b p-4 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <img src={selectedMatch.pet1.avatarUrl || '/placeholder.svg'} alt={selectedMatch.pet1.name} className="size-10 rounded-full border object-cover" />
                        <img src={selectedMatch.pet2.avatarUrl || '/placeholder.svg'} alt={selectedMatch.pet2.name} className="size-10 rounded-full border object-cover" />
                      </div>
                      <div>
                        <h3 className="font-black text-base leading-tight">
                          {selectedMatch.pet1.name} ({selectedMatch.pet1.owner.name}) & {selectedMatch.pet2.name} ({selectedMatch.pet2.owner.name})
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          Ghép đôi thành công · Phối giống Active
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl border bg-card px-3 py-1.5 text-xs font-extrabold text-primary shadow-sm">
                        {selectedMatch.compatibilityScore}% Phù hợp
                      </span>
                    </div>
                  </div>

                  {/* Messages Stream */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-transparent to-muted/20">
                    {currentMatchMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex flex-col',
                          msg.sender === 'system'
                            ? 'items-center my-3'
                            : msg.sender === 'me'
                            ? 'items-end'
                            : 'items-start',
                        )}
                      >
                        {msg.sender === 'system' ? (
                          <div className="rounded-2xl border bg-primary/5 px-4 py-2 text-center text-xs font-bold text-primary shadow-sm max-w-md">
                            {msg.text}
                          </div>
                        ) : (
                          <div className="max-w-[75%] space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground px-1">
                              {msg.senderName} · {msg.time}
                            </span>
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-sm',
                                msg.sender === 'me'
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-card border text-foreground rounded-tl-none',
                              )}
                            >
                              {msg.text}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Chat Input Bar */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center gap-2 bg-card">
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                      <Paperclip className="size-5" />
                    </Button>
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Nhập tin nhắn trao đổi thời gian, địa điểm phối giống..."
                      className="flex-1 rounded-xl font-medium"
                    />
                    <Button type="submit" className="rounded-xl font-bold shadow-md shadow-primary/20 shrink-0">
                      <Send className="size-4 mr-1" />
                      Gửi
                    </Button>
                  </form>
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
                        {req.femalePet.verificationBadge === 'VERIFIED' && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <ShieldCheck className="size-3" /> VERIFIED
                          </span>
                        )}
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
        )}
      </section>
    </main>
  );
}
