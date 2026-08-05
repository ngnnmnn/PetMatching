'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, ProductVariant } from '@/types';
import { toast } from 'sonner';
import { cartApi } from '@/lib/api/cart';

export interface CartItem {
  id: string; // unique cart item line identifier (cuid on DB or composite key for guest)
  productId: string;
  variantId?: string | null;
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, showToast?: boolean, variantId?: string | null) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
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
          id: item.id,
          productId: item.productId,
          variantId: item.variantId || null,
          product: item.product,
          variant: item.variant || null,
          quantity: item.quantity,
        }));
        setCartItems(items);
        localStorage.removeItem('petmatch_cart');
      } catch (e: any) {
        if (e?.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          const stored = localStorage.getItem('petmatch_cart');
          if (stored) {
            try {
              setCartItems(JSON.parse(stored));
            } catch {}
          } else {
            setCartItems([]);
          }
        } else {
          console.error('Failed to load cart from backend', e);
        }
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
              productId: item.productId,
              quantity: item.quantity,
              variantId: item.variantId || null,
            }));
            const res = await cartApi.mergeCart(mergePayload);
            const items = res.data.map((item) => ({
              id: item.id,
              productId: item.productId,
              variantId: item.variantId || null,
              product: item.product,
              variant: item.variant || null,
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

  const addToCart = async (product: Product, quantity = 1, showToast = true, variantId?: string | null) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    
    // Resolve variant details
    const variant = variantId && product.variants
      ? product.variants.find(v => v.id === variantId)
      : null;

    // Unique key on frontend
    const cartItemId = token ? '' : (variantId ? `${product.id}_${variantId}` : product.id);
    
    // Find existing item in frontend state
    const existing = token
      ? cartItems.find((item) => item.productId === product.id && item.variantId === (variantId || null))
      : cartItems.find((item) => item.id === cartItemId);

    const currentQtyInCart = existing ? existing.quantity : 0;
    const targetQty = currentQtyInCart + quantity;
    const stock = variant ? variant.stock : product.stock;

    if (stock !== undefined && stock !== null && targetQty > stock) {
      toast.warning(`Chỉ có thể thêm tối đa ${stock} sản phẩm này vào giỏ hàng (Hiện tại trong giỏ: ${currentQtyInCart})`);
      return;
    }

    if (token) {
      try {
        await cartApi.addToCart(product.id, quantity, variantId);
        if (showToast) {
          toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}${variant ? ` (${variant.name})` : ''}" vào giỏ hàng!`);
        }
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể thêm sản phẩm vào giỏ hàng');
      }
    } else {
      if (showToast) {
        toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}${variant ? ` (${variant.name})` : ''}" vào giỏ hàng!`);
      }
      setCartItems((prev) => {
        if (existing) {
          return prev.map((item) =>
            item.id === existing.id ? { ...item, quantity: targetQty } : item
          );
        }
        return [...prev, {
          id: cartItemId,
          productId: product.id,
          variantId: variantId || null,
          product,
          variant,
          quantity
        }];
      });
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const item = cartItems.find((i) => i.id === cartItemId);

    if (item && token) {
      try {
        await cartApi.removeFromCart(item.productId, item.variantId);
        toast.success(`Đã xóa "${item.product.name}${item.variant ? ` (${item.variant.name})` : ''}" khỏi giỏ hàng`);
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể xóa sản phẩm khỏi giỏ hàng');
      }
    } else {
      setCartItems((prev) => {
        const item = prev.find((i) => i.id === cartItemId);
        if (item) {
          toast.success(`Đã xóa "${item.product.name}${item.variant ? ` (${item.variant.name})` : ''}" khỏi giỏ hàng`);
        }
        return prev.filter((i) => i.id !== cartItemId);
      });
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(cartItemId);
      return;
    }

    const item = cartItems.find((i) => i.id === cartItemId);
    if (!item) return;

    const stock = item.variant ? item.variant.stock : item.product.stock;

    if (stock !== undefined && stock !== null && quantity > stock) {
      toast.warning(`Chỉ còn ${stock} sản phẩm trong kho`);
      quantity = stock;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      try {
        await cartApi.updateQuantity(item.productId, quantity, item.variantId);
        await loadCart();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể cập nhật số lượng');
      }
    } else {
      setCartItems((prev) => {
        return prev.map((i) => (i.id === cartItemId ? { ...i, quantity } : i));
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
    const price = item.variant
      ? (item.variant.salePrice ?? item.variant.sellingPrice)
      : (item.product.salePrice ?? item.product.sellingPrice);
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
