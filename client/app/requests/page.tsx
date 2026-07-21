'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Heart,
  Inbox,
  MessageCircle,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
type RequestDirection = 'INCOMING' | 'OUTGOING';
type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

type MatchingRequest = {
  id: string;
  note?: string | null;
  createdAt: string;
  status: RequestStatus;
  requester: {
    id: string;
    name: string;
    email: string;
  };
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
    owner: { name: string };
  };
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Chờ phản hồi',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

export default function RequestsPage() {
  const [direction, setDirection] = useState<RequestDirection>('INCOMING');
  const [incomingRequests, setIncomingRequests] = useState<MatchingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<MatchingRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        api.get<MatchingRequest[]>('/matching/requests/incoming'),
        api.get<MatchingRequest[]>('/matching/requests/outgoing'),
      ]);

      setIncomingRequests(incomingResponse.data || []);
      setOutgoingRequests(outgoingResponse.data || []);
    } catch {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      toast.error('Không tải được danh sách yêu cầu ghép đôi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const requests = direction === 'INCOMING' ? incomingRequests : outgoingRequests;
  const filteredRequests = useMemo(
    () => requests.filter((request) => filterStatus === 'ALL' || request.status === filterStatus),
    [filterStatus, requests],
  );

  const changeDirection = (nextDirection: RequestDirection) => {
    setDirection(nextDirection);
    setFilterStatus('ALL');
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setRespondingId(requestId);
    try {
      await api.post(`/matching/requests/${requestId}/${action}`);
      toast.success(
        action === 'accept'
          ? 'Đã chấp nhận yêu cầu và tạo cặp đôi thành công!'
          : 'Đã từ chối yêu cầu ghép đôi.',
      );
      await loadRequests();
    } catch {
      toast.error('Không thể xử lý yêu cầu này. Vui lòng thử lại.');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader sectionLabel="Yêu cầu ghép đôi" />

      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-orange-50/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/explore"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" /> Quay lại trang Khám phá
              </Link>
              <h1 className="text-3xl font-black">Yêu cầu Ghép đôi</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Xem và phản hồi yêu cầu nhận được, hoặc theo dõi các yêu cầu bạn đã gửi.
              </p>
            </div>
            <Button asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
              <Link href="/explore">
                <Heart className="mr-1.5 size-4" />
                Gửi yêu cầu mới
              </Link>
            </Button>
          </div>

          <div className="mt-6 flex gap-2 border-b">
            <button
              type="button"
              onClick={() => changeDirection('INCOMING')}
              className={cn(
                'relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition-all',
                direction === 'INCOMING'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Inbox className="size-4" />
              Yêu cầu nhận được
              {incomingRequests.length > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
                  {incomingRequests.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => changeDirection('OUTGOING')}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition-all',
                direction === 'OUTGOING'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Send className="size-4" />
              Đã gửi ({outgoingRequests.length})
            </button>
          </div>

          {direction === 'OUTGOING' && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((status) => {
              const count =
                status === 'ALL'
                  ? requests.length
                  : requests.filter((request) => request.status === status).length;
              const label =
                status === 'ALL'
                  ? 'Tất cả'
                  : status === 'PENDING'
                    ? 'Chờ phản hồi'
                    : status === 'ACCEPTED'
                      ? 'Đã chấp nhận'
                      : 'Đã từ chối';

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-xs font-extrabold transition-all',
                    filterStatus === status
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {label} ({count})
                </button>
              );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Đang tải danh sách yêu cầu...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              {direction === 'INCOMING' ? <Inbox className="size-10" /> : <Send className="size-10" />}
            </div>
            <h2 className="mb-2 text-2xl font-bold">
              {direction === 'INCOMING' ? 'Chưa có yêu cầu nhận được' : 'Chưa có yêu cầu đã gửi'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {direction === 'INCOMING'
                ? 'Yêu cầu gửi tới thú cưng đực của bạn sẽ xuất hiện tại đây.'
                : 'Các yêu cầu do thú cưng cái của bạn gửi đi sẽ xuất hiện tại đây.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredRequests.map((request) => {
              const displayedPet = direction === 'INCOMING' ? request.femalePet : request.malePet;
              const ownerName = displayedPet.owner?.name || request.requester.name;

              return (
                <article
                  key={request.id}
                  className="space-y-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={displayedPet.avatarUrl || '/placeholder.svg'}
                        alt={displayedPet.name}
                        className="size-16 shrink-0 rounded-2xl border object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-lg font-black">{displayedPet.name}</h3>
                          {displayedPet.verificationBadge === 'VERIFIED' && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <ShieldCheck className="size-3" /> VERIFIED
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {displayedPet.breed} · Chủ nuôi:{' '}
                          <span className="text-foreground">{ownerName}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {direction === 'INCOMING' ? 'Muốn ghép với bé đực: ' : 'Gửi từ bé cái: '}
                          <span className="font-bold text-primary">
                            {direction === 'INCOMING' ? request.malePet.name : request.femalePet.name}
                          </span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'shrink-0 rounded-xl px-3 py-1 text-xs font-black shadow-sm',
                        request.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : request.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800',
                      )}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>

                  {request.note && (
                    <div className="rounded-xl border bg-muted/30 p-3 text-xs italic text-muted-foreground">
                      Lời nhắn: &ldquo;{request.note}&rdquo;
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {new Date(request.createdAt).toLocaleDateString('vi-VN')}
                    </span>

                    {direction === 'INCOMING' && request.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl font-bold"
                          disabled={respondingId === request.id}
                          onClick={() => respondToRequest(request.id, 'reject')}
                        >
                          <X className="mr-1 size-4" /> Từ chối
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl font-bold shadow-md shadow-primary/20"
                          disabled={respondingId === request.id}
                          onClick={() => respondToRequest(request.id, 'accept')}
                        >
                          <Check className="mr-1 size-4" /> Chấp nhận
                        </Button>
                      </div>
                    ) : request.status === 'ACCEPTED' ? (
                      <Button size="sm" className="rounded-xl font-bold" asChild>
                        <Link href="/messages">
                          <MessageCircle className="mr-1 size-4" /> Nhắn tin
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
