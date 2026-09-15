'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant } from '@/types';
import { toast } from 'sonner';
import { cartApi } from '@/lib/api/cart';
import { productsApi } from '@/lib/api/products';

export interface CartItem {
  id: string; // unique cart item line identifier (cuid on DB or composite key for guest)
  productId: string;
  variantId?: string | null;
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, showToast?: boolean, variantId?: string | null) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  removeMultipleFromCart: (cartItemIds: string[]) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  /**
   * Tải lại giỏ hàng từ server hoặc cập nhật trạng thái tồn kho / mở bán mới nhất của sản phẩm
   */
  const loadCart = useCallback(async () => {
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
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
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
          // Khi server gặp sự cố mạng hoặc lỗi tạm thời, fallback sang giỏ hàng lưu cục bộ
          console.warn('Không thể kết nối tải giỏ hàng từ server, sử dụng bộ nhớ tạm:', e?.message || e);
          const stored = localStorage.getItem('petmatch_cart');
          if (stored) {
            try {
              setCartItems(JSON.parse(stored));
            } catch {}
          }
        }
      }
    } else {
      const stored = localStorage.getItem('petmatch_cart');
      if (stored) {
        try {
          const rawItems: CartItem[] = JSON.parse(stored);
          if (rawItems.length > 0) {
            // Cập nhật thông tin tồn kho và trạng thái mở bán mới nhất cho giỏ hàng khách vãng lai
            const updatedItems = await Promise.all(
              rawItems.map(async (item) => {
                try {
                  const res = await productsApi.getById(item.productId);
                  const p = res.data;
                  const v = item.variantId && p.variants ? p.variants.find((v) => v.id === item.variantId) : null;
                  return {
                    ...item,
                    product: p,
                    variant: v || item.variant,
                  };
                } catch {
                  return item;
                }
              })
            );
            setCartItems(updatedItems);
          } else {
            setCartItems([]);
          }
        } catch (e) {
          console.error('Failed to parse cart items', e);
          setCartItems([]);
        }
      } else {
        setCartItems([]);
      }
    }
  }, []);

  /**
   * Đồng bộ giỏ hàng local lên server khi người dùng đăng nhập
   */
  const syncCart = useCallback(async () => {
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
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
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
      await loadCart();
    }
  }, [loadCart]);

  // Khởi tạo và lắng nghe thay đổi đăng nhập
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
  }, [syncCart]);

  // Cơ chế Polling tự động cập nhật giỏ hàng theo thời gian thực (mỗi 4 giây & khi quay lại tab)
  useEffect(() => {
    if (!isMounted) return;

    const interval = setInterval(() => {
      loadCart();
    }, 4000);

    const handleFocus = () => {
      loadCart();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
    };
  }, [isMounted, loadCart]);


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
        const now = new Date().toISOString();
        if (existing) {
          return prev.map((item) =>
            item.id === existing.id ? { ...item, quantity: targetQty, updatedAt: now } : item
          );
        }
        // Thêm sản phẩm mới lên đầu danh sách: sản phẩm thêm sau ở trên cùng
        return [{
          id: cartItemId,
          productId: product.id,
          variantId: variantId || null,
          product,
          variant,
          quantity,
          createdAt: now,
          updatedAt: now,
        }, ...prev];
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

  /**
   * Xóa nhiều sản phẩm khỏi giỏ hàng cùng lúc (hỗ trợ xóa hàng loạt hàng không khả dụng).
   */
  const removeMultipleFromCart = async (cartItemIds: string[]) => {
    if (!cartItemIds || cartItemIds.length === 0) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const itemsToDelete = cartItems.filter((i) => cartItemIds.includes(i.id));

    if (itemsToDelete.length === 0) return;

    if (token) {
      try {
        await Promise.all(
          itemsToDelete.map((item) => cartApi.removeFromCart(item.productId, item.variantId))
        );
        toast.success(`Đã xóa ${itemsToDelete.length} sản phẩm khỏi giỏ hàng`);
        await loadCart();
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Không thể xóa các sản phẩm khỏi giỏ hàng');
      }
    } else {
      setCartItems((prev) => prev.filter((i) => !cartItemIds.includes(i.id)));
      toast.success(`Đã xóa ${itemsToDelete.length} sản phẩm khỏi giỏ hàng`);
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
        removeMultipleFromCart,
        updateQuantity,
        clearCart,
        refreshCart: loadCart,
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
