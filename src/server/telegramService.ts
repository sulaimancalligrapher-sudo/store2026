import type { Order, OrderStatus, StoreSettings } from '../shared/types.ts';

export interface TelegramRuntimeConfig {
  botToken: string;
  adminChatId: string;
  webhookSecret: string;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '⏳ قيد المراجعة',
  confirmed: '✅ مؤكد',
  shipped: '🚚 تم الشحن',
  delivered: '📦 تم التسليم',
  cancelled: '❌ ملغي',
};

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTelegramMessage(order: Order, settings: StoreSettings): string {
  const currency = settings.currency || 'ر.س';
  const paymentLabel =
    order.payment_method === 'bank_transfer' ? '🏦 تحويل بنكي' : '💵 الدفع عند الاستلام';

  const itemsText = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. <b>${escapeHtml(item.name)}</b>${item.variant ? ` (${escapeHtml(item.variant)})` : ''} × <b>${item.qty}</b> — ${item.line_total} ${escapeHtml(currency)}`
    )
    .join('\n');

  const lines = [
    `🛍️ <b>طلب جديد في ${escapeHtml(settings.store_name)}</b>`,
    `رقم الطلب: <code>${escapeHtml(order.id)}</code>`,
    `الحالة الحالية: <b>${ORDER_STATUS_LABELS[order.status] || order.status}</b>`,
    ``,
    `👤 <b>بيانات العميل:</b>`,
    `• الاسم: ${escapeHtml(order.customer_name)}`,
    `• الجوال: <code>${escapeHtml(order.customer_phone)}</code>`,
    `• المدينة: ${escapeHtml(order.customer_city)}`,
    `• العنوان: ${escapeHtml(order.customer_address)}`,
  ];

  if (order.telegram_username) {
    lines.push(`• تيليجرام العميل: ${escapeHtml(order.telegram_username)}`);
  }

  lines.push(``, `📦 <b>المنتجات:</b>`, itemsText, ``);
  lines.push(`💳 <b>الدفع:</b> ${paymentLabel}`);
  if (order.bank_reference) {
    lines.push(`• مرجع الحوالة: <code>${escapeHtml(order.bank_reference)}</code>`);
  }
  if (order.coupon_code) {
    lines.push(
      `🎟️ الكوبون: <code>${escapeHtml(order.coupon_code)}</code> (خصم ${order.discount_amount} ${escapeHtml(currency)})`
    );
  }
  lines.push(`• المجموع الفرعي: ${order.subtotal} ${escapeHtml(currency)}`);
  lines.push(
    `• التوصيل: ${order.delivery_fee === 0 ? 'مجاني' : `${order.delivery_fee} ${escapeHtml(currency)}`}`
  );
  lines.push(`💰 <b>الإجمالي النهائي: ${order.total} ${escapeHtml(currency)}</b>`);

  if (order.notes) {
    lines.push(``, `📝 <b>ملاحظات:</b> ${escapeHtml(order.notes)}`);
  }

  return lines.join('\n');
}

function buildOrderInlineKeyboard(order: Order) {
  const cleanPhone = order.customer_phone.replace(/[^\d]/g, '');
  const contactUrl = order.telegram_username
    ? `https://t.me/${order.telegram_username.replace(/^@/, '')}`
    : cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('0') ? `966${cleanPhone.slice(1)}` : cleanPhone}`
      : undefined;

  const rows: { text: string; callback_data?: string; url?: string }[][] = [
    [
      { text: '✅ تأكيد', callback_data: `order_status:${order.id}:confirmed` },
      { text: '🚚 تم الشحن', callback_data: `order_status:${order.id}:shipped` },
    ],
    [
      { text: '📦 تم التسليم', callback_data: `order_status:${order.id}:delivered` },
      { text: '❌ إلغاء', callback_data: `order_status:${order.id}:cancelled` },
    ],
  ];

  if (contactUrl) {
    rows.push([{ text: '💬 تواصل مباشر مع العميل', url: contactUrl }]);
  }

  return { inline_keyboard: rows };
}

export async function sendOrderToTelegram(
  config: TelegramRuntimeConfig,
  order: Order,
  settings: StoreSettings
): Promise<{ sent: boolean; error?: string }> {
  if (!config.botToken || !config.adminChatId) {
    return { sent: false, error: 'Telegram not configured' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.adminChatId,
        text: formatTelegramMessage(order, settings),
        parse_mode: 'HTML',
        reply_markup: buildOrderInlineKeyboard(order),
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { sent: false, error: data.description || 'Telegram API error' };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendTelegramTestMessage(
  config: TelegramRuntimeConfig,
  storeName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!config.botToken || !config.adminChatId) {
    return { ok: false, error: 'يرجى إدخال Bot Token و Admin Chat ID أولاً.' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.adminChatId,
        text: `✅ <b>تم ربط بوت تيليجرام بنجاح!</b>\nالمتجر: <b>${escapeHtml(storeName)}</b>\nستصلك هنا إشعارات الطلبات الجديدة مع أزرار التأكيد والشحن الفورية.`,
        parse_mode: 'HTML',
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description || 'فشل إرسال الرسالة عبر Telegram API' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذر الاتصال بخوادم تيليجرام' };
  }
}

export async function registerTelegramWebhook(
  config: TelegramRuntimeConfig,
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!config.botToken) {
    return { ok: false, error: 'يرجى إدخال Bot Token أولاً.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return { ok: false, error: 'رابط Webhook غير صالح.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'يتطلب تيليجرام رابط HTTPS عاماً (مثل رابط النشر على Vercel).' };
  }

  try {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    };
    if (config.webhookSecret) {
      body.secret_token = config.webhookSecret;
    }
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description || 'فشل تسجيل Webhook' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذر الاتصال بتيليجرام' };
  }
}

export async function answerTelegramCallback(
  botToken: string,
  callbackQueryId: string,
  text: string
): Promise<void> {
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  }).catch(() => undefined);
}

export async function editTelegramOrderMessage(
  botToken: string,
  chatId: number | string,
  messageId: number,
  order: Order,
  settings: StoreSettings
): Promise<void> {
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: formatTelegramMessage(order, settings),
      parse_mode: 'HTML',
      reply_markup: buildOrderInlineKeyboard(order),
    }),
  }).catch(() => undefined);
}

export async function sendTelegramBotReply(
  botToken: string,
  chatId: number | string,
  text: string,
  storeUrl?: string
): Promise<void> {
  if (!botToken) return;
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (storeUrl && storeUrl.startsWith('https://')) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: '🛍️ فتح المتجر الآن', web_app: { url: storeUrl } }]],
    };
  }
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
