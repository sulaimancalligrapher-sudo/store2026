import crypto from 'node:crypto';
import express from 'express';
import {
  claimInitialAdminPassword,
  getAdminAuthStatus,
  issueAdminToken,
  requireAdminAuth,
  verifyAdminPassword,
} from './adminAuth.ts';
import { GOOGLE_APPS_SCRIPT_CODE } from './appsScriptTemplate.ts';
import { initializePayment } from './paymentProvider.ts';
import {
  appendOrder,
  deleteProduct,
  getConnectionMode,
  getOrderByToken,
  getStoreCatalog,
  initializeConnectedSheet,
  saveStoreSettings,
  upsertProduct,
} from './sheetsClient.ts';
import {
  handleTelegramWebhook,
  notifyAdminNewOrder,
  verifyTelegramWebhookSecret,
} from './telegram.ts';
import type {
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  ProductType,
  PublicProduct,
  StoreSettings,
} from './types.ts';

function isSafeHttpOrRelative(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/')) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/store', async (_req, res) => {
    try {
      const catalog = await getStoreCatalog();
      // Never expose paid digitalDeliveryUrl in public catalog responses
      const publicProducts: PublicProduct[] = catalog.products.map(
        ({ digitalDeliveryUrl, ...rest }) => ({
          ...rest,
          hasDigitalContent: Boolean(digitalDeliveryUrl),
        }),
      );

      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      res.json({
        settings: catalog.settings,
        categories: catalog.categories,
        banners: catalog.banners,
        products: publicProducts,
      });
    } catch (error) {
      console.error('GET /api/store failed:', error);
      res.status(500).json({ error: 'تعذر تحميل بيانات المتجر حالياً.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const body = req.body as {
        customerName?: unknown;
        phone?: unknown;
        address?: unknown;
        notes?: unknown;
        paymentMethod?: unknown;
        items?: Array<{ productId?: unknown; qty?: unknown }>;
      };

      const customerName =
        typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const address = typeof body.address === 'string' ? body.address.trim() : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';
      const paymentMethod: PaymentMethod =
        body.paymentMethod === 'transfer' ? 'transfer' : 'contact';

      if (customerName.length < 2 || customerName.length > 100) {
        res.status(400).json({ error: 'يرجى كتابة الاسم الكامل بشكل صحيح.' });
        return;
      }

      if (phone.length < 7 || phone.length > 25) {
        res.status(400).json({ error: 'يرجى إدخال رقم جوال أو تواصل صحيح.' });
        return;
      }

      if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 40) {
        res.status(400).json({ error: 'سلة المشتريات فارغة أو غير صالحة.' });
        return;
      }

      const catalog = await getStoreCatalog(true);
      if (!catalog.settings.isOpen) {
        res.status(403).json({ error: 'المتجر مغلق مؤقتاً لاستقبال الطلبات.' });
        return;
      }

      const productMap = new Map(catalog.products.map((p) => [p.id, p]));
      const mergedItems = new Map<string, number>();

      for (const raw of body.items) {
        const productId = typeof raw.productId === 'string' ? raw.productId.trim() : '';
        const qty = Number(raw.qty);
        if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 50) {
          res.status(400).json({ error: 'كمية المنتج غير صالحة.' });
          return;
        }
        mergedItems.set(productId, (mergedItems.get(productId) || 0) + qty);
      }

      const nowIso = new Date().toISOString();
      const orderId = `ORD-${Date.now().toString().slice(-6)}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;
      const token = crypto.randomBytes(16).toString('hex');

      const orderItems: OrderItem[] = [];
      let subtotal = 0;
      let hasPhysical = false;
      let hasDigital = false;
      let itemCounter = 1;

      for (const [productId, qty] of mergedItems.entries()) {
        const prod = productMap.get(productId);
        if (!prod) {
          res.status(400).json({ error: 'أحد المنتجات في السلة لم يعد متاحاً.' });
          return;
        }

        if (prod.type === 'physical') {
          hasPhysical = true;
          if (prod.stock >= 0 && prod.stock < qty) {
            res.status(409).json({
              error:
                prod.stock === 0
                  ? `المنتج "${prod.name}" نفد من المخزون.`
                  : `الكمية المتوفرة من "${prod.name}" هي ${prod.stock} فقط.`,
            });
            return;
          }
        } else {
          hasDigital = true;
        }

        const lineTotal = prod.price * qty;
        subtotal += lineTotal;
        orderItems.push({
          id: `${orderId}-${itemCounter++}`,
          orderId,
          productId: prod.id,
          productType: prod.type,
          productName: prod.name,
          unitPrice: prod.price,
          qty,
          lineTotal,
        });
      }

      if (hasPhysical && address.length < 5) {
        res.status(400).json({ error: 'يرجى إدخال عنوان التوصيل لأدوات الخط المادية.' });
        return;
      }

      const freeOver = catalog.settings.freeShippingOver;
      const qualifiesFree = freeOver > 0 && subtotal >= freeOver;
      const deliveryFee = !hasPhysical || qualifiesFree ? 0 : catalog.settings.deliveryFee;
      const total = subtotal + deliveryFee;

      const order: Order = {
        orderId,
        token,
        createdAt: nowIso,
        customerName,
        phone,
        address: hasPhysical ? address : 'منتج رقمي (تسليم إلكتروني)',
        notes,
        hasPhysical,
        hasDigital,
        paymentMethod,
        paymentStatus: 'await_contact',
        subtotal,
        deliveryFee,
        total,
        orderStatus: 'new',
        stockDeducted: false,
        customerTelegramChatId: '',
        items: orderItems,
      };

      const paymentInit = initializePayment(order);
      await appendOrder(order);

      notifyAdminNewOrder(order, catalog.settings).catch((err) => {
        console.error('Failed to notify Telegram admin:', err);
      });

      res.status(201).json({
        orderId: order.orderId,
        token: order.token,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        payment: paymentInit,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        hasPhysical: order.hasPhysical,
        hasDigital: order.hasDigital,
      });
    } catch (error) {
      console.error('POST /api/orders failed:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الطلب، يرجى المحاولة مرة أخرى.' });
    }
  });

  app.get('/api/orders/:token', async (req, res) => {
    try {
      const token = (req.params.token || '').trim();
      if (!/^[a-f0-9]{16,64}$/i.test(token)) {
        res.status(400).json({ error: 'رمز الطلب غير صالح.' });
        return;
      }

      const order = await getOrderByToken(token);
      if (!order) {
        res.status(404).json({ error: 'لم يتم العثور على الطلب.' });
        return;
      }

      const catalog = await getStoreCatalog();
      const isUnlocked =
        order.paymentStatus === 'paid' ||
        order.orderStatus === 'confirmed' ||
        order.orderStatus === 'shipping' ||
        order.orderStatus === 'delivered';

      const digitalDeliveries = isUnlocked
        ? order.items
            .filter((item) => item.productType === 'digital')
            .map((item) => {
              const p = catalog.products.find((prod) => prod.id === item.productId);
              return {
                productId: item.productId,
                productName: item.productName,
                url: p?.digitalDeliveryUrl || '',
              };
            })
            .filter((d) => Boolean(d.url))
        : [];

      res.json({
        order: {
          orderId: order.orderId,
          token: order.token,
          createdAt: order.createdAt,
          customerName: order.customerName,
          phone: order.phone,
          address: order.address,
          notes: order.notes,
          hasPhysical: order.hasPhysical,
          hasDigital: order.hasDigital,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          total: order.total,
          orderStatus: order.orderStatus,
          items: order.items,
          digitalUnlocked: isUnlocked,
          digitalDeliveries,
        },
        settings: catalog.settings,
      });
    } catch (error) {
      console.error('GET /api/orders/:token failed:', error);
      res.status(500).json({ error: 'تعذر تحميل تفاصيل الطلب.' });
    }
  });

  // --- Admin Auth Routes ---
  app.get('/api/admin/auth/status', (_req, res) => {
    res.json(getAdminAuthStatus());
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    const password =
      typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const result = claimInitialAdminPassword(password);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ token: issueAdminToken() });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const password =
      typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (!verifyAdminPassword(password)) {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة.' });
      return;
    }
    res.json({ token: issueAdminToken() });
  });

  // --- Protected Admin & Settings Routes ---
  app.get('/api/admin/overview', requireAdminAuth, async (_req, res) => {
    try {
      const catalog = await getStoreCatalog(true, true);
      const hideBackendCode =
        (process.env.HIDE_BACKEND_CODE || '').trim().toLowerCase() === 'true';

      res.json({
        connectionMode: getConnectionMode(),
        telegramConfigured: Boolean(
          process.env.TELEGRAM_BOT_TOKEN?.trim() &&
            process.env.TELEGRAM_ADMIN_CHAT_ID?.trim(),
        ),
        hideBackendCode,
        settings: catalog.settings,
        categories: catalog.categories,
        products: catalog.products,
        appsScriptCode: hideBackendCode ? '' : GOOGLE_APPS_SCRIPT_CODE,
      });
    } catch (error) {
      console.error('GET /api/admin/overview failed:', error);
      res.status(500).json({ error: 'تعذر تحميل لوحة الإعدادات.' });
    }
  });

  app.post('/api/admin/products', requireAdminAuth, async (req, res) => {
    try {
      const b = req.body as Partial<Product> & { imagesText?: string };
      const name = typeof b.name === 'string' ? b.name.trim() : '';
      if (name.length < 2 || name.length > 150) {
        res.status(400).json({ error: 'يرجى إدخال اسم المنتج (حرفان على الأقل).' });
        return;
      }

      const type: ProductType = b.type === 'digital' ? 'digital' : 'physical';
      const price = Number(b.price);
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: 'يرجى إدخال سعر صحيح.' });
        return;
      }

      const oldPriceRaw = b.oldPrice !== null && b.oldPrice !== undefined ? Number(b.oldPrice) : 0;
      const oldPrice = Number.isFinite(oldPriceRaw) && oldPriceRaw > 0 ? oldPriceRaw : null;

      const stockRaw = Number(b.stock);
      const stock =
        type === 'digital'
          ? -1
          : Number.isFinite(stockRaw) && stockRaw >= 0
            ? Math.floor(stockRaw)
            : 0;

      const rawImages = Array.isArray(b.images)
        ? b.images
        : typeof b.imagesText === 'string'
          ? b.imagesText.split(',')
          : [];
      const images = rawImages
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s && isSafeHttpOrRelative(s));

      const previewMedia =
        typeof b.previewMedia === 'string' && isSafeHttpOrRelative(b.previewMedia)
          ? b.previewMedia.trim()
          : '';
      const digitalDeliveryUrl =
        typeof b.digitalDeliveryUrl === 'string' && isSafeHttpOrRelative(b.digitalDeliveryUrl)
          ? b.digitalDeliveryUrl.trim()
          : '';

      const product: Product = {
        id:
          typeof b.id === 'string' && /^[a-zA-Z0-9_-]{2,64}$/.test(b.id.trim())
            ? b.id.trim()
            : `prod_${Date.now().toString(36)}`,
        sku: typeof b.sku === 'string' ? b.sku.trim().slice(0, 40) : '',
        categoryId:
          typeof b.categoryId === 'string' && b.categoryId.trim()
            ? b.categoryId.trim()
            : 'cat_tools',
        type,
        name,
        description:
          typeof b.description === 'string' ? b.description.trim().slice(0, 2000) : '',
        price,
        oldPrice,
        stock,
        images,
        previewMedia,
        digitalDeliveryUrl,
        sort: Number.isFinite(Number(b.sort)) ? Number(b.sort) : 10,
        active: b.active !== false,
      };

      await upsertProduct(product);
      res.json({ ok: true, product });
    } catch (error) {
      console.error('POST /api/admin/products failed:', error);
      res.status(500).json({ error: 'تعذر حفظ المنتج.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = (req.params.id || '').trim();
      if (!/^[a-zA-Z0-9_-]{2,64}$/.test(id)) {
        res.status(400).json({ error: 'معرّف المنتج غير صالح.' });
        return;
      }
      await deleteProduct(id);
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/admin/products/:id failed:', error);
      res.status(500).json({ error: 'تعذر حذف المنتج.' });
    }
  });

  app.put('/api/admin/settings', requireAdminAuth, async (req, res) => {
    try {
      const b = req.body as Partial<StoreSettings>;
      const catalog = await getStoreCatalog(true, true);
      const current = catalog.settings;

      const updated: StoreSettings = {
        storeName:
          typeof b.storeName === 'string' && b.storeName.trim()
            ? b.storeName.trim().slice(0, 80)
            : current.storeName,
        tagline:
          typeof b.tagline === 'string' ? b.tagline.trim().slice(0, 200) : current.tagline,
        logoUrl:
          typeof b.logoUrl === 'string' && isSafeHttpOrRelative(b.logoUrl)
            ? b.logoUrl.trim() || '/icon.svg'
            : current.logoUrl,
        primaryColor:
          typeof b.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor.trim())
            ? b.primaryColor.trim()
            : current.primaryColor,
        currency:
          typeof b.currency === 'string' && b.currency.trim()
            ? b.currency.trim().slice(0, 12)
            : current.currency,
        deliveryFee:
          Number.isFinite(Number(b.deliveryFee)) && Number(b.deliveryFee) >= 0
            ? Number(b.deliveryFee)
            : current.deliveryFee,
        freeShippingOver:
          Number.isFinite(Number(b.freeShippingOver)) && Number(b.freeShippingOver) >= 0
            ? Number(b.freeShippingOver)
            : current.freeShippingOver,
        announcement:
          typeof b.announcement === 'string'
            ? b.announcement.trim().slice(0, 250)
            : current.announcement,
        whatsapp:
          typeof b.whatsapp === 'string' ? b.whatsapp.trim().slice(0, 30) : current.whatsapp,
        telegramUsername:
          typeof b.telegramUsername === 'string'
            ? b.telegramUsername.trim().slice(0, 60)
            : current.telegramUsername,
        botUsername:
          typeof b.botUsername === 'string'
            ? b.botUsername.trim().slice(0, 60)
            : current.botUsername,
        transferInfo:
          typeof b.transferInfo === 'string'
            ? b.transferInfo.trim().slice(0, 400)
            : current.transferInfo,
        isOpen: typeof b.isOpen === 'boolean' ? b.isOpen : current.isOpen,
        contactPayEnabled:
          typeof b.contactPayEnabled === 'boolean'
            ? b.contactPayEnabled
            : current.contactPayEnabled,
        onlinePayEnabled: current.onlinePayEnabled,
      };

      await saveStoreSettings(updated);
      res.json({ ok: true, settings: updated });
    } catch (error) {
      console.error('PUT /api/admin/settings failed:', error);
      res.status(500).json({ error: 'تعذر حفظ إعدادات المتجر.' });
    }
  });

  app.post('/api/admin/init-sheet', requireAdminAuth, async (_req, res) => {
    try {
      const result = await initializeConnectedSheet();
      res.json({ ok: true, mode: result.mode });
    } catch (error) {
      console.error('POST /api/admin/init-sheet failed:', error);
      res.status(500).json({ error: 'تعذر تهيئة أوراق الشيت، تأكد من صلاحيات الربط.' });
    }
  });

  app.post('/api/telegram/webhook', async (req, res) => {
    const secret = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (!verifyTelegramWebhookSecret(secret)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      await handleTelegramWebhook(req.body);
    } catch (error) {
      console.error('Telegram webhook error:', error);
    }

    res.status(200).json({ ok: true });
  });

  return app;
}
