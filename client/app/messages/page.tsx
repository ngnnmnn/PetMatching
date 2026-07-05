'use client';

import { useEffect, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';

type MatchingRequest = {
  id: string;
  note?: string | null;
  createdAt: string;
  femalePet: { id: string; name: string; breed: string; avatarUrl?: string | null; owner: { name: string } };
  malePet: { id: string; name: string; breed: string; avatarUrl?: string | null };
};

type Match = {
  id: string;
  compatibilityScore: number;
  pet1: { id: string; name: string; breed: string; avatarUrl?: string | null; owner: { name: string } };
  pet2: { id: string; name: string; breed: string; avatarUrl?: string | null; owner: { name: string } };
};

export default function MessagesPage() {
  const [requests, setRequests] = useState<MatchingRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<MatchingRequest[]>('/matching/requests/incoming'),
      api.get<Match[]>('/matching/matches'),
    ])
      .then(([requestResponse, matchResponse]) => {
        setRequests(requestResponse.data);
        setMatches(matchResponse.data);
      })
      .catch(() => setMessage('Không tải được yêu cầu và tin nhắn.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const respond = async (id: string, action: 'accept' | 'reject') => {
    await api.post(`/matching/requests/${id}/${action}`);
    setMessage(action === 'accept' ? 'Đã chấp nhận yêu cầu và tạo match.' : 'Đã từ chối yêu cầu.');
    loadData();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Tin nhắn" />
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="mt-2 text-3xl font-bold">Tin nhắn và ghép đôi</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Xử lý yêu cầu ghép đôi đến và xem các match đang active.
          </p>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[1fr_1fr]">
        {message && (
          <div className="rounded-xl border bg-card p-4 text-sm font-medium text-primary lg:col-span-2">
            {message}
          </div>
        )}

        <div>
          <h2 className="mb-4 text-2xl font-bold">Yêu cầu đang chờ</h2>
          {loading ? (
            <PanelLoading />
          ) : requests.length === 0 ? (
            <PanelEmpty text="Chưa có yêu cầu mới." />
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <article key={request.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={request.femalePet.avatarUrl || '/placeholder.svg'}
                      alt={request.femalePet.name}
                      className="size-16 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{request.femalePet.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {request.femalePet.breed} từ {request.femalePet.owner.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Muốn ghép với {request.malePet.name}
                      </p>
                    </div>
                  </div>
                  {request.note && <p className="mt-3 text-sm text-muted-foreground">{request.note}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Button variant="outline" className="gap-2" onClick={() => respond(request.id, 'reject')}>
                      <X className="size-4" />
                      Từ chối
                    </Button>
                    <Button className="gap-2" onClick={() => respond(request.id, 'accept')}>
                      <Check className="size-4" />
                      Chấp nhận
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-bold">Match active</h2>
          {loading ? (
            <PanelLoading />
          ) : matches.length === 0 ? (
            <PanelEmpty text="Chưa có match active." />
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <article key={match.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                      <img src={match.pet1.avatarUrl || '/placeholder.svg'} alt={match.pet1.name} className="size-14 rounded-full border object-cover" />
                      <img src={match.pet2.avatarUrl || '/placeholder.svg'} alt={match.pet2.name} className="size-14 rounded-full border object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">
                        {match.pet1.name} và {match.pet2.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Điểm phù hợp {match.compatibilityScore}%
                      </p>
                    </div>
                    <Button size="sm" className="gap-2">
                      <MessageCircle className="size-4" />
                      Chat
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function PanelLoading() {
  return <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Đang tải...</div>;
}

function PanelEmpty({ text }: { text: string }) {
  return <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">{text}</div>;
}
