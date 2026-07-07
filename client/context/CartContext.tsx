'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/types';
import { toast } from 'sonner';

export interface CartItem {
  id: string; // matches product.id
  product: Product;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number, showToast?: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem('petmatch_cart');
    if (stored) {
      try {
        setCartItems(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse cart items', e);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('petmatch_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isMounted]);

  const addToCart = (product: Product, quantity = 1, showToast = true) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      
      // Check stock limit if defined
      const currentQtyInCart = existing ? existing.quantity : 0;
      const targetQty = currentQtyInCart + quantity;
      
      if (product.stock !== undefined && product.stock !== null && targetQty > product.stock) {
        toast.warning(`Chỉ có thể thêm tối đa ${product.stock} sản phẩm này vào giỏ hàng (Hiện tại trong giỏ: ${currentQtyInCart})`);
        return prev;
      }

      if (showToast) {
        toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng!`);
      }

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: targetQty } : item
        );
      }

      return [...prev, { id: product.id, product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (item) {
        toast.success(`Đã xóa "${item.product.name}" khỏi giỏ hàng`);
      }
      return prev.filter((i) => i.id !== productId);
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (!item) return prev;

      if (item.product.stock !== undefined && item.product.stock !== null && quantity > item.product.stock) {
        toast.warning(`Chỉ còn ${item.product.stock} sản phẩm trong kho`);
        return prev.map((i) =>
          i.id === productId ? { ...i, quantity: item.product.stock! } : i
        );
      }

      return prev.map((i) => (i.id === productId ? { ...i, quantity } : i));
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const cartTotal = cartItems.reduce((acc, item) => {
    const price = item.product.salePrice ?? item.product.originalPrice;
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
