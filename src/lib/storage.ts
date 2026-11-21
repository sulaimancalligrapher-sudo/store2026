import type { CartItem, SavedOrderSummary } from '../types';

const CART_KEY = 'medad_cart_v1';
const ORDERS_KEY = 'medad_orders_v1';

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CartItem).productId === 'string' &&
        Number.isInteger((item as CartItem).qty) &&
        (item as CartItem).qty > 0,
    );
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedOrders(): SavedOrderSummary[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is SavedOrderSummary =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as SavedOrderSummary).token === 'string' &&
        typeof (o as SavedOrderSummary).orderId === 'string',
    );
  } catch {
    return [];
  }
}

export function saveOrderSummary(order: SavedOrderSummary): void {
  try {
    const existing = loadSavedOrders().filter((o) => o.token !== order.token);
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...existing].slice(0, 20)));
  } catch {
    // Ignore storage quota errors
  }
}
