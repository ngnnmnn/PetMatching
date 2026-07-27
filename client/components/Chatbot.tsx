'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Sparkles, RefreshCw, AlertCircle, ShoppingBag } from 'lucide-react';
import api from '@/lib/axios';
import { Product } from '@/types';
import { productsApi } from '@/lib/api/products';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  productIds?: string[];
}

const QUICK_SUGGESTIONS = [
  'Tư vấn thức ăn cho chó Corgi',
  'Đồ chơi cho mèo giải tỏa stress',
  'Giường ngủ êm ái cho thú cưng',
  'Bát ăn tự động PUKY có gì hot?',
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Chatbot() {
  const pathname = usePathname();
  const hiddenRoutes = ['/login', '/register', '/admin', '/verify-email'];
  const shouldHide = hiddenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch active products on mount to match IDs client-side
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await productsApi.getList({ limit: 100 });
        if (response.data && response.data.data) {
          setAllProducts(response.data.data);
        }
      } catch (err) {
        console.error('Error loading products for chatbot:', err);
      }
    }
    loadProducts();
  }, []);

  // 2. Initialize chat with a welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Xin chào! Mình là **Trợ lý AI PetMatch** 🐾. Mình có thể giúp gì cho bạn hôm nay? Mình có thể tư vấn chăm sóc thú cưng và gợi ý những sản phẩm phù hợp nhất cho bé cưng nhà bạn đấy!',
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length]);

  // 3. Scroll to bottom whenever messages list updates or chat opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Extract recommendations tags (e.g. [RECOMMENDATIONS: id1, id2]) and clean the display text
  const parseRecommendationsAndCleanText = (text: string) => {
    const regex = /\[RECOMMENDATIONS:\s*([^\]]+)\]/g;
    let match;
    const productIds: string[] = [];
    let cleanText = text;

    while ((match = regex.exec(text)) !== null) {
      const ids = match[1].split(',').map(id => id.trim()).filter(Boolean);
      productIds.push(...ids);
    }

    cleanText = cleanText.replace(regex, '').trim();
    return { cleanText, productIds };
  };

  // Helper to parse line markdown (list items, bold, and links)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      let cleanLine = line;
      if (isListItem) {
        cleanLine = line.trim().replace(/^[-*]\s+/, '');
      }

      // Parse bold **text** and link [text](url)
      const parts = parseLineMarkup(cleanLine);

      if (isListItem) {
        return (
          <li key={lineIndex} className="ml-4 list-disc text-sm leading-relaxed mb-1 text-[var(--text-main)]">
            {parts}
          </li>
        );
      }

      return (
        <p key={lineIndex} className="text-sm leading-relaxed mb-1.5 min-h-[1em] text-[var(--text-main)]">
          {parts}
        </p>
      );
    });
  };

  const parseLineMarkup = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    const tokens = text.split(regex);

    return tokens.map((token, index) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={index} className="font-extrabold text-[var(--text-main)]">{token.slice(2, -2)}</strong>;
      }

      if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
        const closingBracketIndex = token.indexOf('](');
        const linkText = token.slice(1, closingBracketIndex);
        const url = token.slice(closingBracketIndex + 2, -1);

        return (
          <Link
            key={index}
            href={url}
            onClick={() => {
              // Optionally close chat on link click to improve visibility
              if (window.innerWidth < 768) {
                setIsOpen(false);
              }
            }}
            className="text-[#E45D1C] hover:text-[#cf5017] font-bold underline transition duration-150 inline-flex items-center gap-0.5"
          >
            {linkText}
          </Link>
        );
      }

      return token;
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare message history for server backend
      // We pass the last 10 messages to keep request context lean and fast
      const history = [...messages, userMsg]
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await api.post('/chat', { messages: history });
      const rawText = response.data.text || '';

      const { cleanText, productIds } = parseRecommendationsAndCleanText(rawText);

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'assistant',
          content: cleanText,
          timestamp: new Date(),
          productIds: productIds.length > 0 ? productIds : undefined,
        },
      ]);
      setHasNewMessage(true);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errMsg = error.response?.data?.message || 'Xin lỗi bạn, kết nối của mình đang gặp sự cố. Bạn vui lòng thử lại nhé!';
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'assistant',
          content: `⚠️ **Lỗi**: ${errMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
    }
  };

  if (shouldHide) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* 1. Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[540px] w-[380px] max-h-[calc(100vh-120px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out animate-in slide-in-from-bottom-5 fade-in-50">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#E45D1C] to-[#ff6b2b] px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex size-10 items-center justify-center rounded-full bg-white text-[#E45D1C] shadow-sm">
                <Sparkles className="size-5 fill-[#E45D1C]/20" />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-green-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold leading-tight tracking-wide">Trợ lý AI PetMatch</h3>
                <p className="text-[11px] font-semibold text-white/85">Luôn sẵn sàng tư vấn 🐾</p>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="rounded-full p-1.5 transition hover:bg-white/10 active:scale-95"
              aria-label="Đóng chat"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-[#FAF9F5] p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              
              // Get suggested products
              const suggestedProducts = msg.productIds 
                ? allProducts.filter(p => msg.productIds?.includes(p.id)) 
                : [];

              return (
                <div
                  key={msg.id}
                  className={`flex w-full flex-col ${isUser ? 'items-end animate-in slide-in-from-right-3' : 'items-start animate-in slide-in-from-left-3'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${
                      isUser
                        ? 'bg-[#E45D1C] text-white rounded-tr-none'
                        : 'bg-white text-[var(--text-main)] border border-[#ECE9E0] rounded-tl-none'
                    }`}
                  >
                    {/* Render message body */}
                    <div className="space-y-1">
                      {renderFormattedText(msg.content)}
                    </div>

                    {/* Rich Suggested Products Cards inside the message area */}
                    {!isUser && suggestedProducts.length > 0 && (
                      <div className="mt-3.5 border-t border-dashed border-[#ECE9E0] pt-3.5 space-y-2">
                        <p className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingBag className="size-3 text-[#E45D1C]" />
                          Sản phẩm gợi ý cho bạn:
                        </p>
                        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                          {suggestedProducts.map(product => (
                            <Link
                              key={product.id}
                              href={`/home/product/${product.id}`}
                              onClick={() => {
                                if (window.innerWidth < 768) {
                                  setIsOpen(false);
                                }
                              }}
                              className="flex w-[145px] shrink-0 flex-col rounded-lg border border-[#ECE9E0] bg-white p-2 hover:border-[#E45D1C] hover:shadow-sm transition duration-200 group"
                            >
                              <div className="aspect-square w-full overflow-hidden rounded bg-[#FAF9F5] relative">
                                <img
                                  src={product.imageUrl || '/placeholder.svg'}
                                  alt={product.name}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                              </div>
                              <h4 className="mt-2 line-clamp-1 text-[11px] font-extrabold text-[var(--text-main)] group-hover:text-[#E45D1C] transition duration-150">
                                {product.name}
                              </h4>
                              <p className="text-[9px] font-bold text-[var(--text-muted)]">{product.brand || 'PetMatch'}</p>
                              <div className="mt-1 flex items-center justify-between">
                                <span className="text-[11px] font-black text-[#E45D1C]">
                                  {formatCurrency(product.salePrice ?? product.originalPrice)}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="mt-1 px-1 text-[9px] font-semibold text-gray-400">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            
            {/* AI typing loader */}
            {isLoading && (
              <div className="flex items-center gap-1.5 rounded-full bg-white border border-[#ECE9E0] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] self-start w-fit animate-pulse">
                <RefreshCw className="size-3.5 text-[#E45D1C] animate-spin" />
                <span className="text-xs font-bold text-gray-400">PetMatch Assistant đang nhập...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="border-t border-[#EAEAEA] bg-white px-3 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-100">
              {QUICK_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-[#ECE9E0] bg-[#FAF9F5] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[#E45D1C] hover:bg-[#FFF6F0] hover:text-[#E45D1C] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex border-t border-[#EAEAEA] bg-white p-3 gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              disabled={isLoading}
              className="flex-1 rounded-xl bg-[#FAF9F5] border border-transparent px-4 py-2 text-sm text-[var(--text-main)] transition placeholder:text-gray-400 focus:border-[#E45D1C]/35 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E45D1C]/15 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex size-9 items-center justify-center rounded-xl bg-[#E45D1C] text-white transition hover:bg-[#cf5017] active:scale-95 disabled:pointer-events-none disabled:bg-gray-300"
              aria-label="Gửi tin nhắn"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      {/* 2. Floating Toggle Button */}
      <button
        onClick={toggleChat}
        className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#E45D1C] to-[#ff7d45] text-white shadow-[0_6px_24px_rgba(228,93,28,0.32)] transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_8px_32px_rgba(228,93,28,0.4)] cursor-pointer group"
        aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
      >
        {isOpen ? (
          <X className="size-6 transition duration-300 rotate-90" />
        ) : (
          <>
            <MessageCircle className="size-6 transition duration-300 group-hover:rotate-6" />
            <Sparkles className="absolute -top-1 -right-1 size-4 fill-white text-[#F59E0B] animate-bounce" />
            {hasNewMessage && (
              <span className="absolute top-0 right-0 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-red-500"></span>
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
