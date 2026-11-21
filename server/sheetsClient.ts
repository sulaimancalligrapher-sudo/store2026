import crypto from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  SEED_BANNERS,
  SEED_CATEGORIES,
  SEED_ORDERS,
  SEED_PRODUCTS,
} from './seedData.ts';
import type {
  Banner,
  Category,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductType,
  StoreSettings,
} from './types.ts';

interface CachedCatalog {
  fetchedAt: number;
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  products: Product[];
}

const CACHE_TTL_MS = 30_000;
let catalogCache: CachedCatalog | null = null;
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

// In-memory fallback store used when Google Sheets credentials are not yet configured.
const memoryStore = {
  settings: { ...DEFAULT_SETTINGS },
  categories: SEED_CATEGORIES.map((c) => ({ ...c })),
  banners: SEED_BANNERS.map((b) => ({ ...b })),
  products: SEED_PRODUCTS.map((p) => ({ ...p, images: [...p.images] })),
  orders: SEED_ORDERS.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) })),
};

export function isServiceAccountConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim(),
  );
}

export function isAppsScriptConfigured(): boolean {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'script.google.com';
  } catch {
    return false;
  }
}

export function isGoogleSheetsConfigured(): boolean {
  return isServiceAccountConfigured() || isAppsScriptConfigured();
}

export function getConnectionMode(): 'service_account' | 'apps_script' | 'memory' {
  if (isServiceAccountConfigured()) return 'service_account';
  if (isAppsScriptConfigured()) return 'apps_script';
  return 'memory';
}

export function invalidateCatalogCache(): void {
  catalogCache = null;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60) {
    return cachedGoogleToken.token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n').trim();

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = base64Url(signer.sign(rawKey));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth token error: ${res.status} ${errText}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedGoogleToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3500),
  };
  return json.access_token;
}

async function sheetsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getGoogleAccessToken();
  const sheetId = encodeURIComponent(process.env.GOOGLE_SHEET_ID!.trim());
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${body}`);
  }

  return (await res.json()) as T;
}

async function appsScriptGet<T>(action: string): Promise<T> {
  const base = process.env.GOOGLE_APPS_SCRIPT_URL!.trim();
  const url = `${base}${base.includes('?') ? '&' : '?'}action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Apps Script GET error: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function appsScriptPost<T>(payload: Record<string, unknown>): Promise<T> {
  const base = process.env.GOOGLE_APPS_SCRIPT_URL!.trim();
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Apps Script POST error: ${res.status}`);
  }
  return (await res.json()) as T;
}

function parseBool(val: string | undefined, fallback = true): boolean {
  if (val === undefined || val === '') return fallback;
  const normalized = val.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parseNum(val: string | undefined, fallback = 0): number {
  if (val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function rowsToObjects(rows: string[][] | undefined): Record<string, string>[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (row[idx] ?? '').trim();
    });
    return obj;
  });
}

function mapSettings(rows: Record<string, string>[]): StoreSettings {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.key) map.set(r.key.trim(), r.value ?? '');
  }

  const get = (k: string, fb: string) => (map.has(k) ? map.get(k)! : fb);

  return {
    storeName: get('store_name', DEFAULT_SETTINGS.storeName) || DEFAULT_SETTINGS.storeName,
    tagline: get('tagline', DEFAULT_SETTINGS.tagline),
    logoUrl: get('logo_url', DEFAULT_SETTINGS.logoUrl) || '/icon.svg',
    primaryColor: get('primary_color', DEFAULT_SETTINGS.primaryColor) || '#0F4C3F',
    currency: get('currency', DEFAULT_SETTINGS.currency) || 'ر.س',
    deliveryFee: parseNum(map.get('delivery_fee'), DEFAULT_SETTINGS.deliveryFee),
    freeShippingOver: parseNum(map.get('free_shipping_over'), DEFAULT_SETTINGS.freeShippingOver),
    announcement: get('announcement', DEFAULT_SETTINGS.announcement),
    whatsapp: get('whatsapp', DEFAULT_SETTINGS.whatsapp),
    telegramUsername: get('telegram_username', ''),
    botUsername: get('bot_username', process.env.TELEGRAM_BOT_USERNAME || ''),
    transferInfo: get('transfer_info', ''),
    isOpen: parseBool(map.get('is_open'), true),
    contactPayEnabled: parseBool(map.get('contact_pay_enabled'), true),
    onlinePayEnabled: parseBool(map.get('online_pay_enabled'), false),
  };
}

function mapCategories(rows: Record<string, string>[]): Category[] {
  return rows
    .filter((r) => r.id && r.name)
    .map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.image_url || '',
      sort: parseNum(r.sort, 0),
      active: parseBool(r.active, true),
    }))
    .filter((c) => c.active)
    .sort((a, b) => a.sort - b.sort);
}

function mapBanners(rows: Record<string, string>[]): Banner[] {
  return rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      imageUrl: r.image_url || '',
      title: r.title || '',
      subtitle: r.subtitle || '',
      buttonText: r.button_text || '',
      link: r.link || '',
      sort: parseNum(r.sort, 0),
      active: parseBool(r.active, true),
    }))
    .filter((b) => b.active)
    .sort((a, b) => a.sort - b.sort);
}

function mapProducts(rows: Record<string, string>[], includeInactive = false): Product[] {
  return rows
    .filter((r) => r.id && r.name)
    .map((r) => {
      const type: ProductType = r.type === 'digital' ? 'digital' : 'physical';
      const rawStock = r.stock;
      const stock =
        rawStock === '' || rawStock === undefined
          ? type === 'digital'
            ? -1
            : 0
          : parseNum(rawStock, 0);

      const oldPriceNum = r.old_price ? parseNum(r.old_price, 0) : 0;
      const images = (r.images || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        id: r.id,
        sku: r.sku || '',
        categoryId: r.category_id || '',
        type,
        name: r.name,
        description: r.description || '',
        price: parseNum(r.price, 0),
        oldPrice: oldPriceNum > 0 ? oldPriceNum : null,
        stock,
        images,
        previewMedia: r.preview_media || '',
        digitalDeliveryUrl: r.digital_delivery_url || '',
        sort: parseNum(r.sort, 0),
        active: parseBool(r.active, true),
      };
    })
    .filter((p) => includeInactive || p.active)
    .sort((a, b) => a.sort - b.sort);
}

export async function getStoreCatalog(
  forceRefresh = false,
  includeInactive = false,
): Promise<{
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  products: Product[];
}> {
  if (!isGoogleSheetsConfigured()) {
    return {
      settings: memoryStore.settings,
      categories: memoryStore.categories.filter((c) => c.active),
      banners: memoryStore.banners.filter((b) => b.active),
      products: memoryStore.products.filter((p) => includeInactive || p.active),
    };
  }

  if (
    !forceRefresh &&
    !includeInactive &&
    catalogCache &&
    Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS
  ) {
    return {
      settings: catalogCache.settings,
      categories: catalogCache.categories,
      banners: catalogCache.banners,
      products: catalogCache.products,
    };
  }

  let settingsRaw: string[][] | undefined;
  let catRaw: string[][] | undefined;
  let bannerRaw: string[][] | undefined;
  let prodRaw: string[][] | undefined;

  if (isServiceAccountConfigured()) {
    const ranges = [
      'Settings!A:B',
      'Categories!A:E',
      'Banners!A:H',
      'Products!A:N',
    ]
      .map((r) => `ranges=${encodeURIComponent(r)}`)
      .join('&');

    const data = await sheetsFetch<{
      valueRanges: Array<{ values?: string[][] }>;
    }>(`/values:batchGet?${ranges}`);

    settingsRaw = data.valueRanges[0]?.values;
    catRaw = data.valueRanges[1]?.values;
    bannerRaw = data.valueRanges[2]?.values;
    prodRaw = data.valueRanges[3]?.values;
  } else {
    const data = await appsScriptGet<{
      settings?: string[][];
      categories?: string[][];
      banners?: string[][];
      products?: string[][];
    }>('catalog');

    settingsRaw = data.settings;
    catRaw = data.categories;
    bannerRaw = data.banners;
    prodRaw = data.products;
  }

  const parsedSettings = mapSettings(rowsToObjects(settingsRaw));
  const parsedCategories = mapCategories(rowsToObjects(catRaw));
  const parsedBanners = mapBanners(rowsToObjects(bannerRaw));
  const allProducts = mapProducts(rowsToObjects(prodRaw), true);

  const activeProducts = allProducts.filter((p) => p.active);

  catalogCache = {
    fetchedAt: Date.now(),
    settings: parsedSettings,
    categories: parsedCategories,
    banners: parsedBanners,
    products: activeProducts,
  };

  return {
    settings: parsedSettings,
    categories: parsedCategories,
    banners: parsedBanners,
    products: includeInactive ? allProducts : activeProducts,
  };
}

function productToSheetRow(p: Product): string[] {
  return [
    p.id,
    p.sku,
    p.categoryId,
    p.type,
    p.name,
    p.description,
    String(p.price),
    p.oldPrice !== null && p.oldPrice > 0 ? String(p.oldPrice) : '',
    String(p.type === 'digital' ? -1 : p.stock),
    p.images.join(', '),
    p.previewMedia,
    p.digitalDeliveryUrl,
    String(p.sort),
    p.active ? 'TRUE' : 'FALSE',
  ];
}

export async function upsertProduct(product: Product): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    const idx = memoryStore.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      memoryStore.products[idx] = { ...product, images: [...product.images] };
    } else {
      memoryStore.products.push({ ...product, images: [...product.images] });
    }
    invalidateCatalogCache();
    return;
  }

  const row = productToSheetRow(product);

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'upsertProduct', row });
    invalidateCatalogCache();
    return;
  }

  const prodResp = await sheetsFetch<{ values?: string[][] }>(
    `/values/${encodeURIComponent('Products!A:N')}`,
  );
  const rows = prodResp.values || [];
  const existingIdx = rows.findIndex((r, idx) => idx > 0 && r[0] === product.id);

  if (existingIdx >= 0) {
    const rowNum = existingIdx + 1;
    await sheetsFetch(
      `/values/${encodeURIComponent(`Products!A${rowNum}:N${rowNum}`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [row] }),
      },
    );
  } else {
    await sheetsFetch(
      `/values/${encodeURIComponent('Products!A:N')}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        body: JSON.stringify({ values: [row] }),
      },
    );
  }

  invalidateCatalogCache();
}

export async function deleteProduct(productId: string): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    memoryStore.products = memoryStore.products.filter((p) => p.id !== productId);
    invalidateCatalogCache();
    return;
  }

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'deleteProduct', productId });
    invalidateCatalogCache();
    return;
  }

  const prodResp = await sheetsFetch<{ values?: string[][] }>(
    `/values/${encodeURIComponent('Products!A:N')}`,
  );
  const rows = prodResp.values || [];
  const existingIdx = rows.findIndex((r, idx) => idx > 0 && r[0] === productId);
  if (existingIdx === -1) return;

  // Mark inactive so row indexes remain stable without needing sheetId lookup
  const rowNum = existingIdx + 1;
  await sheetsFetch(
    `/values/${encodeURIComponent(`Products!N${rowNum}`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [['FALSE']] }),
    },
  );

  invalidateCatalogCache();
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    memoryStore.settings = { ...settings };
    invalidateCatalogCache();
    return;
  }

  const rows: string[][] = [
    ['key', 'value'],
    ['store_name', settings.storeName],
    ['tagline', settings.tagline],
    ['logo_url', settings.logoUrl],
    ['primary_color', settings.primaryColor],
    ['currency', settings.currency],
    ['delivery_fee', String(settings.deliveryFee)],
    ['free_shipping_over', String(settings.freeShippingOver)],
    ['announcement', settings.announcement],
    ['whatsapp', settings.whatsapp],
    ['telegram_username', settings.telegramUsername],
    ['bot_username', settings.botUsername],
    ['transfer_info', settings.transferInfo],
    ['is_open', settings.isOpen ? 'TRUE' : 'FALSE'],
    ['contact_pay_enabled', settings.contactPayEnabled ? 'TRUE' : 'FALSE'],
  ];

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'saveSettings', rows });
    invalidateCatalogCache();
    return;
  }

  await sheetsFetch(
    `/values/${encodeURIComponent(`Settings!A1:B${rows.length}`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: rows }),
    },
  );
  invalidateCatalogCache();
}

export async function initializeConnectedSheet(): Promise<{ mode: string }> {
  if (!isGoogleSheetsConfigured()) {
    return { mode: 'memory' };
  }

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'setup' });
    invalidateCatalogCache();
    return { mode: 'apps_script' };
  }

  const meta = await sheetsFetch<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>('');
  const existingTitles = new Set(
    (meta.sheets || []).map((s) => s.properties?.title || '').filter(Boolean),
  );

  const requiredTabs = ['Settings', 'Categories', 'Banners', 'Products', 'Orders', 'OrderItems'];
  const addRequests = requiredTabs
    .filter((t) => !existingTitles.has(t))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (addRequests.length > 0) {
    await sheetsFetch(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: addRequests }),
    });
  }

  const data = [
    {
      range: 'Settings!A1:B15',
      values: [
        ['key', 'value'],
        ['store_name', memoryStore.settings.storeName],
        ['tagline', memoryStore.settings.tagline],
        ['logo_url', memoryStore.settings.logoUrl],
        ['primary_color', memoryStore.settings.primaryColor],
        ['currency', memoryStore.settings.currency],
        ['delivery_fee', String(memoryStore.settings.deliveryFee)],
        ['free_shipping_over', String(memoryStore.settings.freeShippingOver)],
        ['announcement', memoryStore.settings.announcement],
        ['whatsapp', memoryStore.settings.whatsapp],
        ['telegram_username', memoryStore.settings.telegramUsername],
        ['bot_username', memoryStore.settings.botUsername],
        ['transfer_info', memoryStore.settings.transferInfo],
        ['is_open', 'TRUE'],
        ['contact_pay_enabled', 'TRUE'],
      ],
    },
    {
      range: 'Categories!A1:E4',
      values: [
        ['id', 'name', 'image_url', 'sort', 'active'],
        ...memoryStore.categories.map((c) => [
          c.id,
          c.name,
          c.imageUrl,
          String(c.sort),
          c.active ? 'TRUE' : 'FALSE',
        ]),
      ],
    },
    {
      range: 'Banners!A1:H2',
      values: [
        ['id', 'image_url', 'title', 'subtitle', 'button_text', 'link', 'sort', 'active'],
        ...memoryStore.banners.map((b) => [
          b.id,
          b.imageUrl,
          b.title,
          b.subtitle,
          b.buttonText,
          b.link,
          String(b.sort),
          b.active ? 'TRUE' : 'FALSE',
        ]),
      ],
    },
    {
      range: `Products!A1:N${memoryStore.products.length + 1}`,
      values: [
        [
          'id',
          'sku',
          'category_id',
          'type',
          'name',
          'description',
          'price',
          'old_price',
          'stock',
          'images',
          'preview_media',
          'digital_delivery_url',
          'sort',
          'active',
        ],
        ...memoryStore.products.map(productToSheetRow),
      ],
    },
    {
      range: 'Orders!A1:Q1',
      values: [
        [
          'order_id',
          'token',
          'created_at',
          'customer_name',
          'phone',
          'address',
          'notes',
          'has_physical',
          'has_digital',
          'payment_method',
          'payment_status',
          'subtotal',
          'delivery_fee',
          'total',
          'order_status',
          'stock_deducted',
          'customer_telegram_chat_id',
        ],
      ],
    },
    {
      range: 'OrderItems!A1:H1',
      values: [
        [
          'id',
          'order_id',
          'product_id',
          'product_type',
          'product_name',
          'unit_price',
          'qty',
          'line_total',
        ],
      ],
    },
  ];

  await sheetsFetch('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data,
    }),
  });

  invalidateCatalogCache();
  return { mode: 'service_account' };
}

export async function appendOrder(order: Order): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    memoryStore.orders.unshift({
      ...order,
      items: order.items.map((i) => ({ ...i })),
    });
    return;
  }

  const orderRow = [
    order.orderId,
    order.token,
    order.createdAt,
    order.customerName,
    order.phone,
    order.address,
    order.notes,
    order.hasPhysical ? 'TRUE' : 'FALSE',
    order.hasDigital ? 'TRUE' : 'FALSE',
    order.paymentMethod,
    order.paymentStatus,
    String(order.subtotal),
    String(order.deliveryFee),
    String(order.total),
    order.orderStatus,
    order.stockDeducted ? 'TRUE' : 'FALSE',
    order.customerTelegramChatId || '',
  ];

  const itemRows = order.items.map((item) => [
    item.id,
    item.orderId,
    item.productId,
    item.productType,
    item.productName,
    String(item.unitPrice),
    String(item.qty),
    String(item.lineTotal),
  ]);

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'appendOrder', orderRow, itemRows });
    return;
  }

  await sheetsFetch(
    `/values/${encodeURIComponent('Orders!A:Q')}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [orderRow] }),
    },
  );

  if (itemRows.length > 0) {
    await sheetsFetch(
      `/values/${encodeURIComponent('OrderItems!A:H')}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        body: JSON.stringify({ values: itemRows }),
      },
    );
  }
}

async function readAllOrdersAndItemsFromSheets(): Promise<{
  ordersRaw: string[][];
  itemsRaw: string[][];
}> {
  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    const data = await appsScriptGet<{ orders?: string[][]; items?: string[][] }>('orders');
    return {
      ordersRaw: data.orders || [],
      itemsRaw: data.items || [],
    };
  }

  const ranges = ['Orders!A:Q', 'OrderItems!A:H']
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');
  const data = await sheetsFetch<{ valueRanges: Array<{ values?: string[][] }> }>(
    `/values:batchGet?${ranges}`,
  );
  return {
    ordersRaw: data.valueRanges[0]?.values || [],
    itemsRaw: data.valueRanges[1]?.values || [],
  };
}

function rowToOrder(row: string[], items: OrderItem[]): Order {
  return {
    orderId: row[0] || '',
    token: row[1] || '',
    createdAt: row[2] || '',
    customerName: row[3] || '',
    phone: row[4] || '',
    address: row[5] || '',
    notes: row[6] || '',
    hasPhysical: parseBool(row[7], false),
    hasDigital: parseBool(row[8], false),
    paymentMethod: (row[9] as PaymentMethod) || 'contact',
    paymentStatus: (row[10] as PaymentStatus) || 'await_contact',
    subtotal: parseNum(row[11], 0),
    deliveryFee: parseNum(row[12], 0),
    total: parseNum(row[13], 0),
    orderStatus: (row[14] as OrderStatus) || 'new',
    stockDeducted: parseBool(row[15], false),
    customerTelegramChatId: row[16] || '',
    items,
  };
}

function rowsToItems(rows: string[][], orderId: string): OrderItem[] {
  if (rows.length < 2) return [];
  return rows
    .slice(1)
    .filter((r) => r[1] === orderId)
    .map((r) => ({
      id: r[0] || '',
      orderId: r[1] || '',
      productId: r[2] || '',
      productType: (r[3] as ProductType) || 'physical',
      productName: r[4] || '',
      unitPrice: parseNum(r[5], 0),
      qty: parseNum(r[6], 1),
      lineTotal: parseNum(r[7], 0),
    }));
}

export async function getOrderByToken(token: string): Promise<Order | null> {
  if (!isGoogleSheetsConfigured()) {
    return memoryStore.orders.find((o) => o.token === token) || null;
  }

  const { ordersRaw, itemsRaw } = await readAllOrdersAndItemsFromSheets();
  if (ordersRaw.length < 2) return null;

  const matched = ordersRaw.slice(1).find((r) => r[1] === token);
  if (!matched) return null;

  const items = rowsToItems(itemsRaw, matched[0]);
  return rowToOrder(matched, items);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  if (!isGoogleSheetsConfigured()) {
    return memoryStore.orders.find((o) => o.orderId === orderId) || null;
  }

  const { ordersRaw, itemsRaw } = await readAllOrdersAndItemsFromSheets();
  if (ordersRaw.length < 2) return null;

  const matched = ordersRaw.slice(1).find((r) => r[0] === orderId);
  if (!matched) return null;

  const items = rowsToItems(itemsRaw, matched[0]);
  return rowToOrder(matched, items);
}

export async function linkCustomerTelegramByToken(
  token: string,
  chatId: string,
): Promise<Order | null> {
  if (!isGoogleSheetsConfigured()) {
    const ord = memoryStore.orders.find((o) => o.token === token);
    if (!ord) return null;
    ord.customerTelegramChatId = chatId;
    return ord;
  }

  const { ordersRaw, itemsRaw } = await readAllOrdersAndItemsFromSheets();
  const rowIndex = ordersRaw.findIndex((r, idx) => idx > 0 && r[1] === token);
  if (rowIndex === -1) return null;

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    await appsScriptPost({ action: 'linkTelegram', token, chatId });
  } else {
    const sheetRowNum = rowIndex + 1;
    await sheetsFetch(
      `/values/${encodeURIComponent(`Orders!Q${sheetRowNum}`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [[chatId]] }),
      },
    );
  }

  const row = [...ordersRaw[rowIndex]];
  row[16] = chatId;
  return rowToOrder(row, rowsToItems(itemsRaw, row[0]));
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  remaining: number;
}

export async function updateOrderAndStock(params: {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus?: PaymentStatus;
  stockAction: 'deduct' | 'restore' | 'none';
}): Promise<{ order: Order; lowStockAlerts: LowStockAlert[] } | null> {
  const { orderId, orderStatus, paymentStatus, stockAction } = params;
  const lowStockAlerts: LowStockAlert[] = [];

  if (!isGoogleSheetsConfigured()) {
    const order = memoryStore.orders.find((o) => o.orderId === orderId);
    if (!order) return null;

    if (stockAction === 'deduct' && !order.stockDeducted) {
      for (const item of order.items) {
        if (item.productType !== 'physical') continue;
        const prod = memoryStore.products.find((p) => p.id === item.productId);
        if (prod && prod.stock >= 0) {
          prod.stock = Math.max(0, prod.stock - item.qty);
          if (prod.stock <= 3) {
            lowStockAlerts.push({
              productId: prod.id,
              productName: prod.name,
              remaining: prod.stock,
            });
          }
        }
      }
      order.stockDeducted = true;
    } else if (stockAction === 'restore' && order.stockDeducted) {
      for (const item of order.items) {
        if (item.productType !== 'physical') continue;
        const prod = memoryStore.products.find((p) => p.id === item.productId);
        if (prod && prod.stock >= 0) {
          prod.stock += item.qty;
        }
      }
      order.stockDeducted = false;
    }

    order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    return { order, lowStockAlerts };
  }

  const { ordersRaw, itemsRaw } = await readAllOrdersAndItemsFromSheets();
  const orderRowIndex = ordersRaw.findIndex((r, idx) => idx > 0 && r[0] === orderId);
  if (orderRowIndex === -1) return null;

  const existingItems = rowsToItems(itemsRaw, orderId);
  const existingOrder = rowToOrder(ordersRaw[orderRowIndex], existingItems);
  let nextStockDeducted = existingOrder.stockDeducted;
  const nextPaymentStatus = paymentStatus || existingOrder.paymentStatus;

  if (isAppsScriptConfigured() && !isServiceAccountConfigured()) {
    const stockUpdates: Array<{ productId: string; stock: number }> = [];
    if (
      (stockAction === 'deduct' && !existingOrder.stockDeducted) ||
      (stockAction === 'restore' && existingOrder.stockDeducted)
    ) {
      const catalog = await getStoreCatalog(true, true);
      for (const item of existingItems) {
        if (item.productType !== 'physical') continue;
        const prod = catalog.products.find((p) => p.id === item.productId);
        if (!prod || prod.stock < 0) continue;
        const newStock =
          stockAction === 'deduct' ? Math.max(0, prod.stock - item.qty) : prod.stock + item.qty;
        stockUpdates.push({ productId: prod.id, stock: newStock });
        if (stockAction === 'deduct' && newStock <= 3) {
          lowStockAlerts.push({
            productId: prod.id,
            productName: prod.name,
            remaining: newStock,
          });
        }
      }
      nextStockDeducted = stockAction === 'deduct';
    }

    await appsScriptPost({
      action: 'updateOrder',
      orderId,
      orderStatus,
      paymentStatus: nextPaymentStatus,
      stockDeducted: nextStockDeducted,
      stockUpdates,
    });
    invalidateCatalogCache();

    return {
      order: {
        ...existingOrder,
        paymentStatus: nextPaymentStatus,
        orderStatus,
        stockDeducted: nextStockDeducted,
      },
      lowStockAlerts,
    };
  }

  if (
    (stockAction === 'deduct' && !existingOrder.stockDeducted) ||
    (stockAction === 'restore' && existingOrder.stockDeducted)
  ) {
    const prodResp = await sheetsFetch<{ values?: string[][] }>(
      `/values/${encodeURIComponent('Products!A:N')}`,
    );
    const prodRows = prodResp.values || [];
    const headers = (prodRows[0] || []).map((h) => h.trim());
    const idCol = headers.indexOf('id');
    const nameCol = headers.indexOf('name');
    const stockCol = headers.indexOf('stock');
    const typeCol = headers.indexOf('type');

    if (idCol >= 0 && stockCol >= 0) {
      const colLetter = String.fromCharCode(65 + stockCol);
      const updates: Array<{ range: string; values: string[][] }> = [];

      for (const item of existingItems) {
        if (item.productType !== 'physical') continue;
        const pIdx = prodRows.findIndex((r, idx) => idx > 0 && r[idCol] === item.productId);
        if (pIdx === -1) continue;

        const pType = typeCol >= 0 ? prodRows[pIdx][typeCol] : 'physical';
        if (pType === 'digital') continue;

        const currentStock = parseNum(prodRows[pIdx][stockCol], 0);
        if (currentStock < 0) continue;

        const newStock =
          stockAction === 'deduct'
            ? Math.max(0, currentStock - item.qty)
            : currentStock + item.qty;

        prodRows[pIdx][stockCol] = String(newStock);
        updates.push({
          range: `Products!${colLetter}${pIdx + 1}`,
          values: [[String(newStock)]],
        });

        if (stockAction === 'deduct' && newStock <= 3) {
          lowStockAlerts.push({
            productId: item.productId,
            productName: (nameCol >= 0 ? prodRows[pIdx][nameCol] : '') || item.productName,
            remaining: newStock,
          });
        }
      }

      if (updates.length > 0) {
        await sheetsFetch('/values:batchUpdate', {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updates,
          }),
        });
      }
    }

    nextStockDeducted = stockAction === 'deduct';
    invalidateCatalogCache();
  }

  const sheetRowNum = orderRowIndex + 1;

  await sheetsFetch('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Orders!K${sheetRowNum}`, values: [[nextPaymentStatus]] },
        { range: `Orders!O${sheetRowNum}`, values: [[orderStatus]] },
        { range: `Orders!P${sheetRowNum}`, values: [[nextStockDeducted ? 'TRUE' : 'FALSE']] },
      ],
    }),
  });

  const updatedOrder: Order = {
    ...existingOrder,
    paymentStatus: nextPaymentStatus,
    orderStatus,
    stockDeducted: nextStockDeducted,
  };

  return { order: updatedOrder, lowStockAlerts };
}
