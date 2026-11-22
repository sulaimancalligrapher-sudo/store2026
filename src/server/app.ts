import crypto from 'node:crypto';
import express from 'express';
import { SHEET_SCHEMA_TABS } from '../shared/seedData.ts';
import type {
  Banner,
  Category,
  CityZone,
  Coupon,
  IntegrationStatus,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  StoreSettings,
} from '../shared/types.ts';
import {
  claimInitialAdminPassword,
  createAdminToken,
  ensurePersistedAuthLoaded,
  getActiveAdminUsername,
  getAuthSetupState,
  requireAdmin,
  updateAdminCredentials,
  verifyAdminCredentials,
} from './auth.ts';
import { BACKEND_CONFIG } from './backendConfig.ts';
import {
  APPS_SCRIPT_TEMPLATE,
  deleteEntity,
  getRuntimeConfig,
  getSnapshot,
  getTelegramConfig,
  initializeSheetsStructure,
  maskSecret,
  saveStoreSettings,
  testSheetsConnection,
  updateRuntimeConfig,
  upsertEntity,
} from './sheetsAdapter.ts';
import {
  answerTelegramCallback,
  editTelegramOrderMessage,
  registerTelegramWebhook,
  sendOrderToTelegram,
  sendTelegramBotReply,
  sendTelegramTestMessage,
} from './telegramService.ts';
import { normalizeImageUrl } from '../shared/imageUrl.ts';

function sanitizeUrl(url: unknown): string {
  return normalizeImageUrl(url);
}

function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/[^\d]/g, '');
}

function validateCouponCalculation(
  coupon: Coupon | undefined,
  subtotal: number
): { valid: boolean; discount: number; error?: string } {
  if (!coupon || !coupon.is_active) {
    return { valid: false, discount: 0, error: 'كود الخصم غير موجود أو غير نشط.' };
  }
  if (coupon.expires_at) {
    const expiry = new Date(`${coupon.expires_at}T23:59:59Z`);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      return { valid: false, discount: 0, error: 'انتهت صلاحية كود الخصم.' };
    }
  }
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return { valid: false, discount: 0, error: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.' };
  }
  if (subtotal < coupon.min_order) {
    return { valid: false, discount: 0, error: `الحد الأدنى لاستخدام الكوبون هو ${coupon.min_order}.` };
  }
  const rawDiscount =
    coupon.discount_type === 'percent'
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;
  const discount = Math.max(0, Math.min(subtotal, rawDiscount));
  return { valid: true, discount };
}

function computeDeliveryFee(
  cities: CityZone[],
  cityName: string,
  subtotalAfterDiscount: number,
  settings: StoreSettings
): { fee: number; cityFound: CityZone | undefined } {
  const city = cities.find((c) => c.is_active && (c.name === cityName || c.id === cityName));
  const baseFee = city ? city.delivery_fee : settings.default_delivery_fee;
  const freeMin =
    city && city.free_shipping_min !== null && city.free_shipping_min > 0
      ? city.free_shipping_min
      : settings.free_shipping_min;

  if (freeMin > 0 && subtotalAfterDiscount >= freeMin) {
    return { fee: 0, cityFound: city };
  }
  return { fee: Math.max(0, baseFee), cityFound: city };
}

function buildIntegrationStatus(): IntegrationStatus {
  const cfg = getRuntimeConfig();
  const auth = getAuthSetupState();
  return {
    sheetsMode: cfg.sheetsMode,
    appsScriptConfigured: Boolean(cfg.appsScriptUrl),
    appsScriptUrlMasked: cfg.appsScriptUrl ? maskSecret(cfg.appsScriptUrl, 24, 12) : '',
    serviceAccountConfigured: Boolean(cfg.sheetId && cfg.serviceAccountEmail && cfg.serviceAccountPrivateKey),
    sheetIdMasked: cfg.sheetId ? maskSecret(cfg.sheetId, 6, 4) : '',
    serviceAccountEmailMasked: cfg.serviceAccountEmail ? maskSecret(cfg.serviceAccountEmail, 6, 12) : '',
    telegramConfigured: Boolean(cfg.telegramBotToken && cfg.telegramAdminChatId),
    telegramBotMasked: cfg.telegramBotToken ? maskSecret(cfg.telegramBotToken, 6, 4) : '',
    telegramChatIdMasked: cfg.telegramAdminChatId ? maskSecret(cfg.telegramAdminChatId, 3, 3) : '',
    telegramWebhookSecretConfigured: Boolean(cfg.telegramWebhookSecret),
    hasEnvAdminPassword: auth.hasEnvAdminPassword,
    hasClaimedAdminPassword: auth.hasClaimedAdminPassword,
    adminUsername: getActiveAdminUsername(),
    hasFileAppsScriptUrl: Boolean(BACKEND_CONFIG.appsScriptUrl.trim()),
    appsScriptUrl: cfg.appsScriptUrl,
    telegramAdminChatId: cfg.telegramAdminChatId,
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // --- Public Storefront Endpoints ---
  app.get('/api/store/bootstrap', async (_req, res) => {
    try {
      const snap = await getSnapshot(false);
      const cfg = getRuntimeConfig();
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=120');
      res.json({
        settings: snap.settings,
        categories: snap.categories
          .filter((c) => c.is_active)
          .sort((a, b) => a.sort_order - b.sort_order),
        products: snap.products.filter((p) => p.is_active),
        banners: snap.banners
          .filter((b) => b.is_active)
          .sort((a, b) => a.sort_order - b.sort_order),
        cities: snap.cities.filter((c) => c.is_active),
        mode: cfg.sheetsMode,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر تحميل بيانات المتجر من قاعدة البيانات.',
      });
    }
  });

  app.post('/api/store/coupons/validate', async (req, res) => {
    try {
      const code = String(req.body?.code || '').trim().toUpperCase();
      const subtotal = Number(req.body?.subtotal || 0);
      if (!code) {
        res.status(400).json({ error: 'يرجى إدخال كود الخصم.' });
        return;
      }
      const snap = await getSnapshot(false);
      const coupon = snap.coupons.find((c) => c.code.toUpperCase() === code);
      const check = validateCouponCalculation(coupon, subtotal);
      if (!check.valid || !coupon) {
        res.status(400).json({ error: check.error || 'كوبون غير صالح.' });
        return;
      }
      res.json({
        ok: true,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: check.discount,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر التحقق من الكوبون.' });
    }
  });

  app.post('/api/store/orders', async (req, res) => {
    try {
      const body = req.body || {};
      const customerName = String(body.customer_name || '').trim();
      const customerPhone = String(body.customer_phone || '').trim();
      const customerCity = String(body.customer_city || '').trim();
      const customerAddress = String(body.customer_address || '').trim();
      const telegramUsername = String(body.telegram_username || '').trim();
      const paymentMethod: PaymentMethod = body.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod';
      const bankReference = String(body.bank_reference || '').trim();
      const couponCodeInput = String(body.coupon_code || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim();
      const rawItems = Array.isArray(body.items) ? body.items : [];

      if (!customerName || customerName.length < 2) {
        res.status(400).json({ error: 'يرجى إدخال الاسم الكامل.' });
        return;
      }
      if (!customerPhone || normalizePhoneDigits(customerPhone).length < 7) {
        res.status(400).json({ error: 'يرجى إدخال رقم جوال صحيح.' });
        return;
      }
      if (!customerCity) {
        res.status(400).json({ error: 'يرجى اختيار المدينة لحساب رسوم التوصيل.' });
        return;
      }
      if (!customerAddress || customerAddress.length < 5) {
        res.status(400).json({ error: 'يرجى إدخال العنوان التفصيلي للتوصيل.' });
        return;
      }
      if (rawItems.length === 0) {
        res.status(400).json({ error: 'سلة المشتريات فارغة.' });
        return;
      }

      const snap = await getSnapshot(true);

      if (paymentMethod === 'cod' && !snap.settings.cod_enabled) {
        res.status(400).json({ error: 'الدفع عند الاستلام غير متاح حالياً.' });
        return;
      }
      if (paymentMethod === 'bank_transfer' && !snap.settings.bank_transfer_enabled) {
        res.status(400).json({ error: 'التحويل البنكي غير متاح حالياً.' });
        return;
      }

      const verifiedItems: OrderItem[] = [];
      const productsToUpdate: Product[] = [];
      let subtotal = 0;

      for (const reqItem of rawItems) {
        const productId = String(reqItem?.product_id || '').trim();
        const qty = Math.floor(Number(reqItem?.qty || 0));
        const variant = String(reqItem?.variant || '').trim();
        if (!productId || qty < 1 || qty > 99) {
          res.status(400).json({ error: 'بيانات أحد المنتجات في السلة غير صالحة.' });
          return;
        }
        const product = snap.products.find((p) => p.id === productId && p.is_active);
        if (!product) {
          res.status(400).json({ error: 'أحد المنتجات في السلة لم يعد متاحاً.' });
          return;
        }
        if (product.stock < qty) {
          res.status(400).json({
            error: `الكمية المطلوبة من "${product.name}" غير متوفرة حالياً (المتوفر: ${product.stock}).`,
          });
          return;
        }
        const lineTotal = product.price * qty;
        subtotal += lineTotal;
        verifiedItems.push({
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          variant,
          qty,
          unit_price: product.price,
          line_total: lineTotal,
          image_url: product.image_url,
        });
        productsToUpdate.push({
          ...product,
          stock: Math.max(0, product.stock - qty),
        });
      }

      let appliedCoupon: Coupon | undefined;
      let discountAmount = 0;
      if (couponCodeInput) {
        const foundCoupon = snap.coupons.find((c) => c.code.toUpperCase() === couponCodeInput);
        const check = validateCouponCalculation(foundCoupon, subtotal);
        if (!check.valid || !foundCoupon) {
          res.status(400).json({ error: check.error || 'كود الخصم غير صالح.' });
          return;
        }
        appliedCoupon = { ...foundCoupon, used_count: foundCoupon.used_count + 1 };
        discountAmount = check.discount;
      }

      const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
      const { fee: deliveryFee, cityFound } = computeDeliveryFee(
        snap.cities,
        customerCity,
        subtotalAfterDiscount,
        snap.settings
      );
      const total = subtotalAfterDiscount + deliveryFee;

      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;

      const newOrder: Order = {
        id: orderId,
        created_at: new Date().toISOString(),
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_city: cityFound ? cityFound.name : customerCity,
        customer_address: customerAddress,
        telegram_username: telegramUsername,
        payment_method: paymentMethod,
        bank_reference: bankReference,
        coupon_code: appliedCoupon ? appliedCoupon.code : '',
        discount_amount: discountAmount,
        items: verifiedItems,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: 'pending',
        notes,
      };

      await upsertEntity('Orders', newOrder);
      for (const updatedProd of productsToUpdate) {
        await upsertEntity('Products', updatedProd);
      }
      if (appliedCoupon) {
        await upsertEntity('Coupons', appliedCoupon);
      }

      const tgResult = await sendOrderToTelegram(getTelegramConfig(), newOrder, snap.settings);

      res.status(201).json({
        ok: true,
        order: newOrder,
        telegramNotified: tgResult.sent,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الطلب.',
      });
    }
  });

  app.get('/api/store/orders/:id', async (req, res) => {
    try {
      const orderId = String(req.params.id || '').trim().toUpperCase();
      const phone = normalizePhoneDigits(String(req.query.phone || ''));
      if (!orderId || phone.length < 4) {
        res.status(400).json({ error: 'يرجى إدخال رقم الطلب ورقم الجوال للتحقق.' });
        return;
      }
      const snap = await getSnapshot(false);
      const order = snap.orders.find((o) => o.id.toUpperCase() === orderId);
      if (!order) {
        res.status(404).json({ error: 'لم يتم العثور على طلب بهذا الرقم.' });
        return;
      }
      const orderPhone = normalizePhoneDigits(order.customer_phone);
      if (!orderPhone.endsWith(phone) && !phone.endsWith(orderPhone)) {
        res.status(403).json({ error: 'رقم الجوال لا يطابق بيانات الطلب.' });
        return;
      }
      res.json({ ok: true, order });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر جلب حالة الطلب.' });
    }
  });

  // --- Telegram Bot Webhook (Interactive Confirm / Ship / Cancel Buttons) ---
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      const tgConfig = getTelegramConfig();
      if (tgConfig.webhookSecret) {
        const incomingSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '');
        const a = Buffer.from(incomingSecret);
        const b = Buffer.from(tgConfig.webhookSecret);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          res.status(401).json({ ok: false });
          return;
        }
      }

      const update = req.body || {};
      if (update.callback_query) {
        const cq = update.callback_query as {
          id: string;
          data?: string;
          message?: { chat: { id: number }; message_id: number };
        };
        const parts = String(cq.data || '').split(':');
        if (parts[0] === 'order_status' && parts[1] && parts[2]) {
          const orderId = parts[1];
          const nextStatus = parts[2] as OrderStatus;
          if (['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(nextStatus)) {
            const snap = await getSnapshot(true);
            const existing = snap.orders.find((o) => o.id === orderId);
            if (existing) {
              const updated: Order = { ...existing, status: nextStatus };
              await upsertEntity('Orders', updated);
              await answerTelegramCallback(tgConfig.botToken, cq.id, `تم تحديث حالة ${orderId}`);
              if (cq.message) {
                await editTelegramOrderMessage(
                  tgConfig.botToken,
                  cq.message.chat.id,
                  cq.message.message_id,
                  updated,
                  snap.settings
                );
              }
            } else {
              await answerTelegramCallback(tgConfig.botToken, cq.id, 'لم يتم العثور على الطلب');
            }
          }
        }
        res.json({ ok: true });
        return;
      }

      if (update.message?.chat?.id && typeof update.message.text === 'string') {
        const text = update.message.text.trim();
        if (text.startsWith('/start')) {
          const snap = await getSnapshot(false);
          const appUrl = process.env.APP_URL || '';
          await sendTelegramBotReply(
            tgConfig.botToken,
            update.message.chat.id,
            `أهلاً بك في <b>${snap.settings.store_name}</b> 🛍️\n${snap.settings.store_tagline}\n\nرقم المحادثة الخاص بك (Chat ID): <code>${update.message.chat.id}</code>`,
            appUrl
          );
        }
      }

      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // --- Admin Auth Routes ---
  app.get('/api/admin/auth-status', async (_req, res) => {
    await ensurePersistedAuthLoaded();
    res.json(getAuthSetupState());
  });

  app.post('/api/admin/setup', async (req, res) => {
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const result = await claimInitialAdminPassword(username, password);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ ok: true, token: createAdminToken() });
  });

  app.post('/api/admin/login', async (req, res) => {
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const valid = await verifyAdminCredentials(username, password);
    if (!valid) {
      res.status(401).json({ error: 'اسم المستخدم أو رقم التسجيل غير صحيح.' });
      return;
    }
    res.json({ ok: true, token: createAdminToken() });
  });

  // --- Protected Admin Routes ---
  app.use('/api/admin', requireAdmin);

  app.post('/api/admin/auth/credentials', async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newUsername = String(req.body?.newUsername || '');
    const newPassword = String(req.body?.newPassword || '');
    const result = await updateAdminCredentials(currentPassword, newUsername, newPassword);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, token: createAdminToken() });
  });

  app.get('/api/admin/overview', async (_req, res) => {
    try {
      const snap = await getSnapshot(true);
      res.json({
        ...snap,
        integrationStatus: buildIntegrationStatus(),
        schemaTabs: SHEET_SCHEMA_TABS,
        appsScriptTemplate: APPS_SCRIPT_TEMPLATE,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر تحميل لوحة التحكم.' });
    }
  });

  app.post('/api/admin/integrations/config', (req, res) => {
    const result = updateRuntimeConfig(req.body || {});
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, integrationStatus: buildIntegrationStatus() });
  });

  app.post('/api/admin/sheets/test', async (_req, res) => {
    try {
      const result = await testSheetsConnection();
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'فشل اختبار الاتصال بالشيت.' });
    }
  });

  app.post('/api/admin/sheets/init', async (req, res) => {
    try {
      const seedSampleData = req.body?.seedSampleData !== false;
      const result = await initializeSheetsStructure(seedSampleData);
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'فشل تهيئة أوراق الشيت.' });
    }
  });

  app.post('/api/admin/telegram/test', async (_req, res) => {
    const snap = await getSnapshot(false);
    const result = await sendTelegramTestMessage(getTelegramConfig(), snap.settings.store_name);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({ ok: true, message: 'تم إرسال رسالة تجريبية إلى تيليجرام بنجاح!' });
  });

  app.post('/api/admin/telegram/webhook', async (req, res) => {
    const webhookUrl = String(req.body?.webhookUrl || '').trim();
    const result = await registerTelegramWebhook(getTelegramConfig(), webhookUrl);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({ ok: true, message: 'تم تسجيل Webhook تيليجرام بنجاح. أزرار الطلبات التفاعلية أصبحت جاهزة!' });
  });

  // Products CRUD
  app.post('/api/admin/products', async (req, res) => {
    try {
      const b = req.body || {};
      const product: Product = {
        id: b.id ? String(b.id).trim() : `prod_${Date.now().toString().slice(-6)}`,
        category_id: String(b.category_id || '').trim(),
        name: String(b.name || '').trim(),
        sku: String(b.sku || '').trim() || `NKH-${Date.now().toString().slice(-5)}`,
        description: String(b.description || '').trim(),
        price: Math.max(0, Number(b.price || 0)),
        compare_at_price: b.compare_at_price ? Math.max(0, Number(b.compare_at_price)) : null,
        stock: Math.max(0, Math.floor(Number(b.stock || 0))),
        image_url: sanitizeUrl(b.image_url),
        gallery_urls: Array.isArray(b.gallery_urls) ? b.gallery_urls.map(sanitizeUrl).filter(Boolean) : [],
        variants: Array.isArray(b.variants) ? b.variants.map((v: unknown) => String(v).trim()).filter(Boolean) : [],
        is_featured: Boolean(b.is_featured),
        is_active: b.is_active !== false,
        created_at: new Date().toISOString(),
      };
      if (!product.name) {
        res.status(400).json({ error: 'اسم المنتج مطلوب.' });
        return;
      }
      await upsertEntity('Products', product);
      res.status(201).json({ ok: true, product });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر إضافة المنتج.' });
    }
  });

  app.put('/api/admin/products/:id', async (req, res) => {
    try {
      const id = String(req.params.id);
      const snap = await getSnapshot(true);
      const existing = snap.products.find((p) => p.id === id);
      if (!existing) {
        res.status(404).json({ error: 'المنتج غير موجود.' });
        return;
      }
      const b = req.body || {};
      const updated: Product = {
        ...existing,
        category_id: b.category_id !== undefined ? String(b.category_id).trim() : existing.category_id,
        name: b.name !== undefined ? String(b.name).trim() : existing.name,
        sku: b.sku !== undefined ? String(b.sku).trim() : existing.sku,
        description: b.description !== undefined ? String(b.description).trim() : existing.description,
        price: b.price !== undefined ? Math.max(0, Number(b.price)) : existing.price,
        compare_at_price:
          b.compare_at_price !== undefined
            ? b.compare_at_price
              ? Math.max(0, Number(b.compare_at_price))
              : null
            : existing.compare_at_price,
        stock: b.stock !== undefined ? Math.max(0, Math.floor(Number(b.stock))) : existing.stock,
        image_url: b.image_url !== undefined ? sanitizeUrl(b.image_url) || existing.image_url : existing.image_url,
        gallery_urls:
          b.gallery_urls !== undefined
            ? (Array.isArray(b.gallery_urls) ? b.gallery_urls : []).map(sanitizeUrl).filter(Boolean)
            : existing.gallery_urls,
        variants:
          b.variants !== undefined
            ? (Array.isArray(b.variants) ? b.variants : []).map((v: unknown) => String(v).trim()).filter(Boolean)
            : existing.variants,
        is_featured: b.is_featured !== undefined ? Boolean(b.is_featured) : existing.is_featured,
        is_active: b.is_active !== undefined ? Boolean(b.is_active) : existing.is_active,
      };
      await upsertEntity('Products', updated);
      res.json({ ok: true, product: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر تحديث المنتج.' });
    }
  });

  app.delete('/api/admin/products/:id', async (req, res) => {
    try {
      await deleteEntity('Products', String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حذف المنتج.' });
    }
  });

  // Categories CRUD
  app.post('/api/admin/categories', async (req, res) => {
    try {
      const b = req.body || {};
      const cat: Category = {
        id: b.id ? String(b.id).trim() : `cat_${Date.now().toString().slice(-5)}`,
        name: String(b.name || '').trim(),
        slug: String(b.slug || b.name || '').trim().toLowerCase().replace(/\s+/g, '-'),
        image_url: sanitizeUrl(b.image_url),
        sort_order: Number(b.sort_order || 1),
        is_active: b.is_active !== false,
      };
      if (!cat.name) {
        res.status(400).json({ error: 'اسم القسم مطلوب.' });
        return;
      }
      await upsertEntity('Categories', cat);
      res.status(201).json({ ok: true, category: cat });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حفظ القسم.' });
    }
  });

  app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
      await deleteEntity('Categories', String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حذف القسم.' });
    }
  });

  // Banners CRUD
  app.post('/api/admin/banners', async (req, res) => {
    try {
      const b = req.body || {};
      const banner: Banner = {
        id: b.id ? String(b.id).trim() : `ban_${Date.now().toString().slice(-5)}`,
        title: String(b.title || '').trim(),
        subtitle: String(b.subtitle || '').trim(),
        image_url: sanitizeUrl(b.image_url) || '/src/assets/images/hero_nukhba_banner_1795253789582.jpg',
        link_url: sanitizeUrl(b.link_url) || '#catalog',
        sort_order: Number(b.sort_order || 1),
        is_active: b.is_active !== false,
      };
      if (!banner.title) {
        res.status(400).json({ error: 'عنوان البانر مطلوب.' });
        return;
      }
      await upsertEntity('Banners', banner);
      res.status(201).json({ ok: true, banner });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حفظ البانر.' });
    }
  });

  app.delete('/api/admin/banners/:id', async (req, res) => {
    try {
      await deleteEntity('Banners', String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حذف البانر.' });
    }
  });

  // Cities CRUD
  app.post('/api/admin/cities', async (req, res) => {
    try {
      const b = req.body || {};
      const city: CityZone = {
        id: b.id ? String(b.id).trim() : `city_${Date.now().toString().slice(-5)}`,
        name: String(b.name || '').trim(),
        delivery_fee: Math.max(0, Number(b.delivery_fee || 0)),
        estimated_days: String(b.estimated_days || '1 - 3 أيام عمل').trim(),
        free_shipping_min: b.free_shipping_min ? Math.max(0, Number(b.free_shipping_min)) : null,
        is_active: b.is_active !== false,
      };
      if (!city.name) {
        res.status(400).json({ error: 'اسم المدينة مطلوب.' });
        return;
      }
      await upsertEntity('Cities', city);
      res.status(201).json({ ok: true, city });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حفظ المدينة.' });
    }
  });

  app.delete('/api/admin/cities/:id', async (req, res) => {
    try {
      await deleteEntity('Cities', String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حذف المدينة.' });
    }
  });

  // Coupons CRUD
  app.post('/api/admin/coupons', async (req, res) => {
    try {
      const b = req.body || {};
      const code = String(b.code || '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'كود الخصم مطلوب.' });
        return;
      }
      const id = b.id ? String(b.id).trim() : `cpn_${Date.now().toString().slice(-5)}`;
      let preservedUsedCount = Math.max(0, Number(b.used_count || 0));
      if (b.id && b.used_count === undefined) {
        const snap = await getSnapshot(false);
        const existing = snap.coupons.find((c) => c.id === id);
        if (existing) preservedUsedCount = existing.used_count;
      }
      const coupon: Coupon = {
        id,
        code,
        discount_type: b.discount_type === 'fixed' ? 'fixed' : 'percent',
        discount_value: Math.max(1, Number(b.discount_value || 10)),
        min_order: Math.max(0, Number(b.min_order || 0)),
        max_uses: Math.max(1, Number(b.max_uses || 100)),
        used_count: preservedUsedCount,
        expires_at: String(b.expires_at || '2027-12-31').trim(),
        is_active: b.is_active !== false,
      };
      await upsertEntity('Coupons', coupon);
      res.status(201).json({ ok: true, coupon });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حفظ الكوبون.' });
    }
  });

  app.delete('/api/admin/coupons/:id', async (req, res) => {
    try {
      await deleteEntity('Coupons', String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حذف الكوبون.' });
    }
  });

  // Orders Update
  app.patch('/api/admin/orders/:id', async (req, res) => {
    try {
      const id = String(req.params.id);
      const snap = await getSnapshot(true);
      const existing = snap.orders.find((o) => o.id === id);
      if (!existing) {
        res.status(404).json({ error: 'الطلب غير موجود.' });
        return;
      }
      const nextStatus = req.body?.status as OrderStatus;
      if (nextStatus && !['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(nextStatus)) {
        res.status(400).json({ error: 'حالة الطلب غير صالحة.' });
        return;
      }
      const updated: Order = {
        ...existing,
        status: nextStatus || existing.status,
        notes: req.body?.notes !== undefined ? String(req.body.notes) : existing.notes,
      };
      await upsertEntity('Orders', updated);
      res.json({ ok: true, order: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر تحديث الطلب.' });
    }
  });

  // Store Settings Update
  app.put('/api/admin/settings', async (req, res) => {
    try {
      const b = req.body || {};
      const snap = await getSnapshot(true);
      const updated: StoreSettings = {
        ...snap.settings,
        store_name: b.store_name !== undefined ? String(b.store_name).trim() : snap.settings.store_name,
        store_tagline: b.store_tagline !== undefined ? String(b.store_tagline).trim() : snap.settings.store_tagline,
        currency: b.currency !== undefined ? String(b.currency).trim() : snap.settings.currency,
        default_delivery_fee:
          b.default_delivery_fee !== undefined ? Math.max(0, Number(b.default_delivery_fee)) : snap.settings.default_delivery_fee,
        free_shipping_min:
          b.free_shipping_min !== undefined ? Math.max(0, Number(b.free_shipping_min)) : snap.settings.free_shipping_min,
        whatsapp: b.whatsapp !== undefined ? String(b.whatsapp).trim() : snap.settings.whatsapp,
        telegram_username:
          b.telegram_username !== undefined ? String(b.telegram_username).trim() : snap.settings.telegram_username,
        bank_name: b.bank_name !== undefined ? String(b.bank_name).trim() : snap.settings.bank_name,
        bank_account_name:
          b.bank_account_name !== undefined ? String(b.bank_account_name).trim() : snap.settings.bank_account_name,
        bank_iban: b.bank_iban !== undefined ? String(b.bank_iban).trim() : snap.settings.bank_iban,
        cod_enabled: b.cod_enabled !== undefined ? Boolean(b.cod_enabled) : snap.settings.cod_enabled,
        bank_transfer_enabled:
          b.bank_transfer_enabled !== undefined ? Boolean(b.bank_transfer_enabled) : snap.settings.bank_transfer_enabled,
        announcement_text:
          b.announcement_text !== undefined ? String(b.announcement_text).trim() : snap.settings.announcement_text,
      };
      await saveStoreSettings(updated);
      res.json({ ok: true, settings: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'تعذر حفظ إعدادات المتجر.' });
    }
  });

  return app;
}
