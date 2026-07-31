'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/types';
import { toast } from 'sonner';
import { cartApi } from '@/lib/api/cart';

export interface CartItem {
  id: string; // matches product.id
  product: Product;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, showToast?: boolean) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const loadCart = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        const res = await cartApi.getCart();
        const items = res.data.map((item) => ({
          id: item.product.id,
          product: item.product,
          quantity: item.quantity,
        }));
        setCartItems(items);
        localStorage.removeItem('petmatch_cart');
      } catch (e) {
        console.error('Failed to load cart from backend', e);
      }
    } else {
      const stored = localStorage.getItem('petmatch_cart');
      if (stored) {
        try {
          setCartItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse cart items', e);
        }
      } else {
        setCartItems([]);
      }
    }
  };

  const syncCart = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      const stored = localStorage.getItem('petmatch_cart');
      if (stored) {
        try {
          const localItems: CartItem[] = JSON.parse(stored);
          if (localItems.length > 0) {
            const mergePayload = localItems.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
            }));
            const res = await cartApi.mergeCart(mergePayload);
            const items = res.data.map((item) => ({
              id: item.product.id,
              product: item.product,
              quantity: item.quantity,
            }));
            setCartItems(items);
            localStorage.removeItem('petmatch_cart');
            return;
          }
        } catch (e) {
          console.error('Failed to merge local cart', e);
        }
      }
      await loadCart();
    } else {
      const stored = localStorage.getItem('petmatch_cart');
      if (stored) {
        try {
          setCartItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse cart items', e);
        }
      } else {
        setCartItems([]);
      }
    }
  };

  // Sync / Load cart on mount and when auth state changes
  useEffect(() => {
    setIsMounted(true);
    syncCart();

    const handleAuthChange = () => {
      syncCart();
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Save guest cart to localStorage
  useEffect(() => {
    if (isMounted) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        localStorage.setItem('petmatch_cart', JSON.stringify(cartItems));
      }
    }
  }, [cartItems, isMounted]);

  const addToCart = async (product: Product, quantity = 1, showToast = true) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const existing = cartItems.find((item) => item.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const targetQty = currentQtyInCart + quantity;

    if (product.stock !== undefined && product.stock !== null && targetQty > product.stock) {
      toast.warning(`Chỉ có thể thêm tối đa ${product.stock} sản phẩm này vào giỏ hàng (Hiện tại trong giỏ: ${currentQtyInCart})`);
      return;
    }

    if (token) {
      try {
        await cartApi.addToCart(product.id, quantity);
        if (showToast) {
          toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng!`);
        }
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể thêm sản phẩm vào giỏ hàng');
      }
    } else {
      if (showToast) {
        toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng!`);
      }
      setCartItems((prev) => {
        if (existing) {
          return prev.map((item) =>
            item.id === product.id ? { ...item, quantity: targetQty } : item
          );
        }
        return [...prev, { id: product.id, product, quantity }];
      });
    }
  };

  const removeFromCart = async (productId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const item = cartItems.find((i) => i.id === productId);

    if (item && token) {
      try {
        await cartApi.removeFromCart(productId);
        toast.success(`Đã xóa "${item.product.name}" khỏi giỏ hàng`);
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể xóa sản phẩm khỏi giỏ hàng');
      }
    } else {
      setCartItems((prev) => {
        const item = prev.find((i) => i.id === productId);
        if (item) {
          toast.success(`Đã xóa "${item.product.name}" khỏi giỏ hàng`);
        }
        return prev.filter((i) => i.id !== productId);
      });
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const item = cartItems.find((i) => i.id === productId);
    if (!item) return;

    if (item.product.stock !== undefined && item.product.stock !== null && quantity > item.product.stock) {
      toast.warning(`Chỉ còn ${item.product.stock} sản phẩm trong kho`);
      quantity = item.product.stock;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        await cartApi.updateQuantity(productId, quantity);
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể cập nhật số lượng');
      }
    } else {
      setCartItems((prev) => {
        return prev.map((i) => (i.id === productId ? { ...i, quantity } : i));
      });
    }
  };

  const clearCart = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        await cartApi.clearCart();
        setCartItems([]);
      } catch (e) {
        console.error('Failed to clear cart on backend', e);
      }
    } else {
      setCartItems([]);
    }
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const cartTotal = cartItems.reduce((acc, item) => {
    const price = item.product.salePrice ?? item.product.sellingPrice;
    return acc + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
