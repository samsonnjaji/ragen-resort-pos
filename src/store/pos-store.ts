import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

interface POSStore {
  cart: CartItem[];
  discount: number;
  heldSales: { id: string; cart: CartItem[]; discount: number }[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (discount: number) => void;
  clearCart: () => void;
  loadCart: (cart: CartItem[], discount: number) => void;
}

export const usePOSStore = create<POSStore>()(
  persist(
    (set, get) => ({
      cart: [],
      discount: 0,
      heldSales: [],

      addItem: (item) => {
        const { cart } = get();
        const existing = cart.find((c) => c.productId === item.productId);
        if (existing) {
          if (existing.quantity >= existing.stock) return;
          set({
            cart: cart.map((c) =>
              c.productId === item.productId
                ? { ...c, quantity: Math.min(c.quantity + 1, c.stock) }
                : c
            ),
          });
        } else {
          set({
            cart: [...cart, { ...item, quantity: item.quantity || 1 }],
          });
        }
      },

      removeItem: (productId) => {
        set({ cart: get().cart.filter((c) => c.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          cart: get().cart.map((c) =>
            c.productId === productId
              ? { ...c, quantity: Math.min(quantity, c.stock) }
              : c
          ),
        });
      },

      setDiscount: (discount) => set({ discount }),

      clearCart: () => set({ cart: [], discount: 0 }),

      loadCart: (cart, discount) => set({ cart, discount }),
    }),
    { name: "ragen-pos-cart" }
  )
);

export function calculateCartTotals(cart: CartItem[], discount: number, taxRate: number) {
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (taxRate / 100);
  const total = taxable + tax;
  return { subtotal, tax, total };
}
