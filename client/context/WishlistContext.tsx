'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/types';
import { toast } from 'sonner';
import { wishlistApi } from '@/lib/api/wishlist';

interface WishlistContextType {
  wishlistItems: Product[];
  toggleWishlist: (product: Product) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const loadWishlist = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        const res = await wishlistApi.getWishlist();
        setWishlistItems(res.data);
        localStorage.removeItem('petmatch_wishlist');
      } catch (e) {
        console.error('Failed to load wishlist from backend', e);
      }
    } else {
      const stored = localStorage.getItem('petmatch_wishlist');
      if (stored) {
        try {
          setWishlistItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse wishlist items', e);
        }
      } else {
        setWishlistItems([]);
      }
    }
  };

  const syncWishlist = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      const stored = localStorage.getItem('petmatch_wishlist');
      if (stored) {
        try {
          const localItems: Product[] = JSON.parse(stored);
          if (localItems.length > 0) {
            const productIds = localItems.map((item) => item.id);
            const res = await wishlistApi.mergeWishlist(productIds);
            setWishlistItems(res.data);
            localStorage.removeItem('petmatch_wishlist');
            return;
          }
        } catch (e) {
          console.error('Failed to merge local wishlist', e);
        }
      }
      await loadWishlist();
    } else {
      const stored = localStorage.getItem('petmatch_wishlist');
      if (stored) {
        try {
          setWishlistItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse wishlist items', e);
        }
      } else {
        setWishlistItems([]);
      }
    }
  };

  // Sync / Load wishlist on mount and when auth state changes
  useEffect(() => {
    setIsMounted(true);
    syncWishlist();

    const handleAuthChange = () => {
      syncWishlist();
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Save guest wishlist to localStorage
  useEffect(() => {
    if (isMounted) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        localStorage.setItem('petmatch_wishlist', JSON.stringify(wishlistItems));
      }
    }
  }, [wishlistItems, isMounted]);

  const toggleWishlist = async (product: Product) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const exists = wishlistItems.some((item) => item.id === product.id);

    if (token) {
      try {
        const res = await wishlistApi.toggleWishlist(product.id);
        if (res.data.added) {
          toast.success(`Đã thêm "${product.name}" vào danh sách yêu thích`);
        } else {
          toast.success(`Đã xóa "${product.name}" khỏi danh sách yêu thích`);
        }
        await loadWishlist();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể cập nhật danh sách yêu thích');
      }
    } else {
      if (exists) {
        toast.success(`Đã xóa "${product.name}" khỏi danh sách yêu thích`);
      } else {
        toast.success(`Đã thêm "${product.name}" vào danh sách yêu thích`);
      }
      setWishlistItems((prev) => {
        if (exists) {
          return prev.filter((item) => item.id !== product.id);
        } else {
          return [...prev, product];
        }
      });
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlistItems.some((item) => item.id === productId);
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
