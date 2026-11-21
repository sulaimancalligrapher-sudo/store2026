import crypto from 'node:crypto';
import {
  getOrderById,
  getStoreCatalog,
  linkCustomerTelegramByToken,
  updateOrderAndStock,
} from './sheetsClient.ts';
import type { Order, OrderStatus, StoreSettings } from './types.ts';

function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_ADMIN_CHAT_ID?.trim(),
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusArabic(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    new: 'طلب جديد (بانتظار التواصل)',
    confirmed: 'تم تأكيد الدفع والطلب',
    shipping: 'جاري التجهيز والشحن',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
  };
  return labels[status] || status;
}

async function telegramCall(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Telegram API ${method} error:`, res.status, errText);
    return null;
  }
  return res.json();
}

function cleanWhatsAppDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function buildAdminKeyboard(order: Order) {
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (order.orderStatus === 'new') {
    buttons.push([
      {
        text: '✅ تأكيد الدفع وخصم المخزون',
        callback_data: `order:confirm:${order.orderId}`,
      },
    ]);
  }

  if (order.orderStatus === 'confirmed' && order.hasPhysical) {
    buttons.push([
      {
        text: '📦 جاري التجهيز والشحن',
        callback_data: `order:shipping:${order.orderId}`,
      },
    ]);
  }

  if (order.orderStatus === 'confirmed' || order.orderStatus === 'shipping') {
    buttons.push([
      {
        text: '✔️ تم التسليم',
        callback_data: `order:delivered:${order.orderId}`,
      },
    ]);
  }

  if (order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered') {
    buttons.push([
      {
        text: '❌ إلغاء الطلب',
        callback_data: `order:cancel:${order.orderId}`,
      },
    ]);
  }

  return { inline_keyboard: buttons };
}

function formatAdminOrderMessage(order: Order, settings: StoreSettings): string {
  const typeLabel =
    order.hasPhysical && order.hasDigital
      ? 'أدوات خط + منهج رقمي'
      : order.hasDigital
        ? 'منهج تعليمي رقمي'
        : 'أدوات خط (شحن)';

  const itemsLines = order.items
    .map(
      (i) =>
        `• ${escapeHtml(i.productName)} × ${i.qty} — <b>${i.lineTotal} ${escapeHtml(settings.currency)}</b>`,
    )
    .join('\n');

  const waDigits = cleanWhatsAppDigits(order.phone);
  const waLink = waDigits ? `https://wa.me/${waDigits}` : '';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const orderLink = appUrl ? `${appUrl}/o/${order.token}` : '';

  const lines = [
    `<b>طلب جديد #${escapeHtml(order.orderId)}</b>`,
    `الحالة: <b>${escapeHtml(statusArabic(order.orderStatus))}</b>`,
    `النوع: ${escapeHtml(typeLabel)}`,
    `الدفع: ${order.paymentMethod === 'transfer' ? 'تحويل بنكي/محفظة' : 'تواصل واتفاق'}`,
    '',
    `<b>بيانات العميل:</b>`,
    `الاسم: ${escapeHtml(order.customerName)}`,
    `الجوال: ${escapeHtml(order.phone)}${waLink ? ` (<a href="${waLink}">فتح واتساب</a>)` : ''}`,
    ...(order.address ? [`العنوان: ${escapeHtml(order.address)}`] : []),
    ...(order.notes ? [`ملاحظات: ${escapeHtml(order.notes)}`] : []),
    '',
    `<b>المنتجات:</b>`,
    itemsLines,
    '',
    `المجموع الفرعي: ${order.subtotal} ${escapeHtml(settings.currency)}`,
    `التوصيل: ${order.deliveryFee} ${escapeHtml(settings.currency)}`,
    `<b>الإجمالي: ${order.total} ${escapeHtml(settings.currency)}</b>`,
    ...(orderLink ? ['', `<a href="${orderLink}">صفحة متابعة الطلب</a>`] : []),
  ];

  return lines.join('\n');
}

export async function notifyAdminNewOrder(
  order: Order,
  settings: StoreSettings,
): Promise<void> {
  if (!isTelegramConfigured()) return;

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID!.trim();
  await telegramCall('sendMessage', {
    chat_id: adminChatId,
    text: formatAdminOrderMessage(order, settings),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: buildAdminKeyboard(order),
  });
}

export function verifyTelegramWebhookSecret(headerSecret: string | undefined): boolean {
  const configured = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!configured) return true;
  if (!headerSecret) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(headerSecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from?: { id?: number | string };
    data?: string;
    message?: {
      message_id: number;
      chat?: { id?: number | string };
    };
  };
}

export async function handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;

  // 1. Handle customer /start order_<token> tracking subscription
  if (update.message?.text && update.message.chat?.id) {
    const text = update.message.text.trim();
    const chatId = String(update.message.chat.id);
    const match = /^\/start\s+order_([a-f0-9]{16,64})$/i.exec(text);
    if (match) {
      const order = await linkCustomerTelegramByToken(match[1], chatId);
      if (order) {
        await telegramCall('sendMessage', {
          chat_id: chatId,
          text:
            `تم ربط طلبك <b>#${escapeHtml(order.orderId)}</b> بنجاح.\n` +
            `حالته الحالية: <b>${escapeHtml(statusArabic(order.orderStatus))}</b>\n` +
            `سيصلك إشعار فوري هنا عند كل تحديث في الطلب.`,
          parse_mode: 'HTML',
        });
      } else {
        await telegramCall('sendMessage', {
          chat_id: chatId,
          text: 'تعذر العثور على هذا الطلب. تأكد من فتح الرابط من صفحة تأكيد الطلب.',
        });
      }
      return;
    }

    if (text === '/start') {
      await telegramCall('sendMessage', {
        chat_id: chatId,
        text: 'أهلاً بك في بوت متجر مِداد. افتح رابط متابعة طلبك من المتجر لتصلك التحديثات هنا.',
      });
    }
    return;
  }

  // 2. Handle admin inline action buttons
  const cb = update.callback_query;
  if (!cb?.data) return;

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const callerId = String(cb.from?.id || '');
  const msgChatId = String(cb.message?.chat?.id || '');

  if (!adminChatId || (callerId !== adminChatId && msgChatId !== adminChatId)) {
    await telegramCall('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'هذا الإجراء مخصص لصاحب المتجر فقط.',
      show_alert: true,
    });
    return;
  }

  const parts = cb.data.split(':');
  if (parts.length !== 3 || parts[0] !== 'order') {
    await telegramCall('answerCallbackQuery', { callback_query_id: cb.id });
    return;
  }

  const [, action, orderId] = parts;
  const existing = await getOrderById(orderId);
  if (!existing) {
    await telegramCall('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'الطلب غير موجود.',
      show_alert: true,
    });
    return;
  }

  let nextStatus: OrderStatus = existing.orderStatus;
  let nextPaymentStatus = existing.paymentStatus;
  let stockAction: 'deduct' | 'restore' | 'none' = 'none';

  if (action === 'confirm') {
    nextStatus = 'confirmed';
    nextPaymentStatus = 'paid';
    stockAction = 'deduct';
  } else if (action === 'shipping') {
    nextStatus = 'shipping';
  } else if (action === 'delivered') {
    nextStatus = 'delivered';
    if (nextPaymentStatus !== 'paid') {
      nextPaymentStatus = 'paid';
      stockAction = 'deduct';
    }
  } else if (action === 'cancel') {
    nextStatus = 'cancelled';
    stockAction = 'restore';
  } else {
    await telegramCall('answerCallbackQuery', { callback_query_id: cb.id });
    return;
  }

  const result = await updateOrderAndStock({
    orderId,
    orderStatus: nextStatus,
    paymentStatus: nextPaymentStatus,
    stockAction,
  });

  if (!result) {
    await telegramCall('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: 'تعذر تحديث الطلب.',
      show_alert: true,
    });
    return;
  }

  const { settings, products } = await getStoreCatalog(true);

  // Update original admin message
  if (cb.message?.chat?.id && cb.message?.message_id) {
    await telegramCall('editMessageText', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: formatAdminOrderMessage(result.order, settings),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: buildAdminKeyboard(result.order),
    });
  }

  await telegramCall('answerCallbackQuery', {
    callback_query_id: cb.id,
    text: `تم التحديث: ${statusArabic(nextStatus)}`,
  });

  // Low stock alerts to admin
  for (const alert of result.lowStockAlerts) {
    const label =
      alert.remaining === 0
        ? `⚠️ <b>نفد المخزون:</b> ${escapeHtml(alert.productName)} (الكمية: 0)`
        : `⚠️ <b>تنبيه انخفاض المخزون:</b> ${escapeHtml(alert.productName)} — المتبقي: <b>${alert.remaining}</b>`;
    await telegramCall('sendMessage', {
      chat_id: adminChatId,
      text: label,
      parse_mode: 'HTML',
    });
  }

  // Notify customer if subscribed
  if (result.order.customerTelegramChatId) {
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const orderUrl = appUrl ? `${appUrl}/o/${result.order.token}` : '';
    const digitalLinks: string[] = [];

    if (
      result.order.hasDigital &&
      (result.order.paymentStatus === 'paid' ||
        result.order.orderStatus === 'confirmed' ||
        result.order.orderStatus === 'delivered')
    ) {
      for (const item of result.order.items) {
        if (item.productType !== 'digital') continue;
        const p = products.find((prod) => prod.id === item.productId);
        if (p?.digitalDeliveryUrl) {
          digitalLinks.push(`• ${escapeHtml(p.name)}: ${escapeHtml(p.digitalDeliveryUrl)}`);
        }
      }
    }

    const customerMsgLines = [
      `تحديث لطلبك <b>#${escapeHtml(result.order.orderId)}</b>:`,
      `الحالة الجديدة: <b>${escapeHtml(statusArabic(result.order.orderStatus))}</b>`,
      ...(digitalLinks.length > 0
        ? ['', '<b>تم فتح روابط المنهج الرقمي:</b>', ...digitalLinks]
        : []),
      ...(orderUrl ? ['', `<a href="${orderUrl}">عرض صفحة الطلب</a>`] : []),
    ];

    await telegramCall('sendMessage', {
      chat_id: result.order.customerTelegramChatId,
      text: customerMsgLines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }
}
