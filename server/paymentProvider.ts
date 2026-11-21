import type { Order, PaymentMethod } from './types.ts';

export interface PaymentInitResult {
  provider: PaymentMethod;
  mode: 'contact' | 'transfer' | 'redirect';
  redirectUrl?: string;
}

/**
 * Extensible payment provider layer.
 * Currently supports "contact" (WhatsApp/Telegram coordination) and "transfer".
 * Future gateways (Stripe, Moyasar, Tap, Paymob) can be plugged in here cleanly.
 */
export function initializePayment(
  order: Pick<Order, 'orderId' | 'token' | 'total' | 'paymentMethod'>,
): PaymentInitResult {
  if (order.paymentMethod === 'transfer') {
    return {
      provider: 'transfer',
      mode: 'transfer',
    };
  }

  // Future online payment hook:
  // if (order.paymentMethod === 'online') { ... }

  return {
    provider: 'contact',
    mode: 'contact',
  };
}
