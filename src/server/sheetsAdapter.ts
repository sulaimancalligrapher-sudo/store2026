import crypto from 'node:crypto';
import {
  DEFAULT_BANNERS,
  DEFAULT_CATEGORIES,
  DEFAULT_CITIES,
  DEFAULT_COUPONS,
  DEFAULT_ORDERS,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  SHEET_SCHEMA_TABS,
} from '../shared/seedData.ts';
import type {
  Banner,
  Category,
  CityZone,
  Coupon,
  Order,
  OrderStatus,
  Product,
  SheetsConnectionMode,
  StoreSettings,
} from '../shared/types.ts';
import type { TelegramRuntimeConfig } from './telegramService.ts';
import { normalizeImageUrl } from '../shared/imageUrl.ts';
import { BACKEND_CONFIG } from './backendConfig.ts';

export interface StoreSnapshot {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  banners: Banner[];
  cities: CityZone[];
  coupons: Coupon[];
  orders: Order[];
}

export interface RuntimeIntegrations {
  sheetsMode: SheetsConnectionMode;
  appsScriptUrl: string;
  appsScriptSecret: string;
  sheetId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  telegramBotToken: string;
  telegramAdminChatId: string;
  telegramWebhookSecret: string;
}

const initialAppsScriptUrl =
  process.env.GOOGLE_APPS_SCRIPT_URL?.trim() || BACKEND_CONFIG.appsScriptUrl.trim() || '';

const runtimeConfig: RuntimeIntegrations = {
  sheetsMode:
    (process.env.GOOGLE_SHEETS_MODE as SheetsConnectionMode) ||
    (initialAppsScriptUrl
      ? 'apps_script'
      : process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        ? 'service_account'
        : BACKEND_CONFIG.sheetsMode || 'demo'),
  appsScriptUrl: initialAppsScriptUrl,
  appsScriptSecret: process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() || '',
  sheetId: process.env.GOOGLE_SHEET_ID?.trim() || '',
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '',
  serviceAccountPrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim(),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
};

export interface PersistedAdminAuth {
  username: string;
  hash: string;
  salt: string;
}

let persistedMemoryAuth: PersistedAdminAuth | null = null;

const memoryStore: StoreSnapshot = {
  settings: { ...DEFAULT_SETTINGS },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  products: DEFAULT_PRODUCTS.map((p) => ({ ...p, gallery_urls: [...p.gallery_urls], variants: [...p.variants] })),
  banners: DEFAULT_BANNERS.map((b) => ({ ...b })),
  cities: DEFAULT_CITIES.map((c) => ({ ...c })),
  coupons: DEFAULT_COUPONS.map((c) => ({ ...c })),
  orders: DEFAULT_ORDERS.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) })),
};

let snapshotCache: { data: StoreSnapshot; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

export function invalidateCache(): void {
  snapshotCache = null;
}

export function getRuntimeConfig(): RuntimeIntegrations {
  return runtimeConfig;
}

export function getTelegramConfig(): TelegramRuntimeConfig {
  return {
    botToken: runtimeConfig.telegramBotToken,
    adminChatId: runtimeConfig.telegramAdminChatId,
    webhookSecret: runtimeConfig.telegramWebhookSecret,
  };
}

export function maskSecret(value: string, visibleStart = 4, visibleEnd = 4): string {
  if (!value) return '';
  if (value.length <= visibleStart + visibleEnd + 2) return '••••••';
  return `${value.slice(0, visibleStart)}••••${value.slice(-visibleEnd)}`;
}

export function validateAppsScriptUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'script.google.com' || host === 'script.googleusercontent.com';
  } catch {
    return false;
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function updateRuntimeConfig(partial: {
  sheetsMode?: SheetsConnectionMode;
  appsScriptUrl?: string;
  appsScriptSecret?: string;
  sheetId?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  telegramWebhookSecret?: string;
}): { ok: boolean; error?: string } {
  if (partial.appsScriptUrl !== undefined && partial.appsScriptUrl.trim() !== '') {
    if (!validateAppsScriptUrl(partial.appsScriptUrl)) {
      return {
        ok: false,
        error: 'رابط Google Apps Script يجب أن يبدأ بـ https://script.google.com أو script.googleusercontent.com',
      };
    }
    runtimeConfig.appsScriptUrl = partial.appsScriptUrl.trim();
  } else if (partial.appsScriptUrl === '') {
    runtimeConfig.appsScriptUrl = '';
  }

  if (partial.appsScriptSecret !== undefined && partial.appsScriptSecret !== '__KEEP__') {
    runtimeConfig.appsScriptSecret = partial.appsScriptSecret.trim();
  }
  if (partial.sheetId !== undefined) {
    runtimeConfig.sheetId = extractSpreadsheetId(partial.sheetId);
  }
  if (partial.serviceAccountEmail !== undefined) {
    runtimeConfig.serviceAccountEmail = partial.serviceAccountEmail.trim();
  }
  if (partial.serviceAccountPrivateKey !== undefined && partial.serviceAccountPrivateKey !== '__KEEP__') {
    runtimeConfig.serviceAccountPrivateKey = partial.serviceAccountPrivateKey.replace(/\\n/g, '\n').trim();
    cachedGoogleToken = null;
  }
  if (partial.telegramBotToken !== undefined && partial.telegramBotToken !== '__KEEP__') {
    runtimeConfig.telegramBotToken = partial.telegramBotToken.trim();
  }
  if (partial.telegramAdminChatId !== undefined) {
    runtimeConfig.telegramAdminChatId = partial.telegramAdminChatId.trim();
  }
  if (partial.telegramWebhookSecret !== undefined && partial.telegramWebhookSecret !== '__KEEP__') {
    runtimeConfig.telegramWebhookSecret = partial.telegramWebhookSecret.trim();
  }
  if (partial.sheetsMode) {
    runtimeConfig.sheetsMode = partial.sheetsMode;
  }

  invalidateCache();
  return { ok: true };
}

function toBool(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'نعم') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'لا') return false;
  }
  if (typeof val === 'number') return val !== 0;
  return fallback;
}

function toNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  if (typeof val !== 'string') return [];
  const trimmed = val.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // fallback to comma split
    }
  }
  return trimmed
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRowObjects(rows: string[][]): Record<string, string>[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] !== undefined ? String(row[i]) : '';
      });
      return obj;
    });
}

function rowsToSnapshot(rawTabs: Record<string, string[][]>): StoreSnapshot {
  const settingsRows = parseRowObjects(rawTabs.Settings || []);
  const settingsMap: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key) settingsMap[row.key] = row.value ?? '';
  }

  const settings: StoreSettings = {
    store_name: settingsMap.store_name || DEFAULT_SETTINGS.store_name,
    store_tagline: settingsMap.store_tagline || DEFAULT_SETTINGS.store_tagline,
    currency: settingsMap.currency || DEFAULT_SETTINGS.currency,
    default_delivery_fee: toNum(settingsMap.default_delivery_fee, DEFAULT_SETTINGS.default_delivery_fee),
    free_shipping_min: toNum(settingsMap.free_shipping_min, DEFAULT_SETTINGS.free_shipping_min),
    whatsapp: settingsMap.whatsapp ?? DEFAULT_SETTINGS.whatsapp,
    telegram_username: settingsMap.telegram_username ?? DEFAULT_SETTINGS.telegram_username,
    bank_name: settingsMap.bank_name ?? DEFAULT_SETTINGS.bank_name,
    bank_account_name: settingsMap.bank_account_name ?? DEFAULT_SETTINGS.bank_account_name,
    bank_iban: settingsMap.bank_iban ?? DEFAULT_SETTINGS.bank_iban,
    cod_enabled: settingsMap.cod_enabled !== undefined ? toBool(settingsMap.cod_enabled, true) : true,
    bank_transfer_enabled:
      settingsMap.bank_transfer_enabled !== undefined ? toBool(settingsMap.bank_transfer_enabled, true) : true,
    announcement_text: settingsMap.announcement_text ?? DEFAULT_SETTINGS.announcement_text,
  };

  const categories: Category[] = parseRowObjects(rawTabs.Categories || []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug || r.id,
    image_url: normalizeImageUrl(r.image_url || ''),
    sort_order: toNum(r.sort_order, 0),
    is_active: toBool(r.is_active, true),
  }));

  const products: Product[] = parseRowObjects(rawTabs.Products || []).map((r) => ({
    id: r.id,
    category_id: r.category_id,
    name: r.name,
    sku: r.sku || '',
    description: r.description || '',
    price: toNum(r.price, 0),
    compare_at_price: r.compare_at_price ? toNum(r.compare_at_price, 0) || null : null,
    stock: toNum(r.stock, 0),
    image_url: normalizeImageUrl(r.image_url || ''),
    gallery_urls: parseList(r.gallery_urls).map(normalizeImageUrl).filter(Boolean),
    variants: parseList(r.variants),
    is_featured: toBool(r.is_featured, false),
    is_active: toBool(r.is_active, true),
    created_at: r.created_at || new Date().toISOString(),
  }));

  const banners: Banner[] = parseRowObjects(rawTabs.Banners || []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle || '',
    image_url: normalizeImageUrl(r.image_url || ''),
    link_url: r.link_url || '#catalog',
    sort_order: toNum(r.sort_order, 0),
    is_active: toBool(r.is_active, true),
  }));

  const cities: CityZone[] = parseRowObjects(rawTabs.Cities || []).map((r) => ({
    id: r.id,
    name: r.name,
    delivery_fee: toNum(r.delivery_fee, 0),
    estimated_days: r.estimated_days || '',
    free_shipping_min: r.free_shipping_min ? toNum(r.free_shipping_min, 0) : null,
    is_active: toBool(r.is_active, true),
  }));

  const coupons: Coupon[] = parseRowObjects(rawTabs.Coupons || []).map((r) => ({
    id: r.id,
    code: String(r.code || '').toUpperCase().trim(),
    discount_type: r.discount_type === 'fixed' ? 'fixed' : 'percent',
    discount_value: toNum(r.discount_value, 0),
    min_order: toNum(r.min_order, 0),
    max_uses: toNum(r.max_uses, 100),
    used_count: toNum(r.used_count, 0),
    expires_at: r.expires_at || '2099-12-31',
    is_active: toBool(r.is_active, true),
  }));

  const orders: Order[] = parseRowObjects(rawTabs.Orders || [])
    .map((r) => {
      let items = [];
      try {
        items = JSON.parse(r.items_json || '[]');
      } catch {
        items = [];
      }
      return {
        id: r.id,
        created_at: r.created_at || new Date().toISOString(),
        customer_name: r.customer_name || '',
        customer_phone: r.customer_phone || '',
        customer_city: r.customer_city || '',
        customer_address: r.customer_address || '',
        telegram_username: r.telegram_username || '',
        payment_method: (r.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cod') as Order['payment_method'],
        bank_reference: r.bank_reference || '',
        coupon_code: r.coupon_code || '',
        discount_amount: toNum(r.discount_amount, 0),
        items: Array.isArray(items) ? items : [],
        subtotal: toNum(r.subtotal, 0),
        delivery_fee: toNum(r.delivery_fee, 0),
        total: toNum(r.total, 0),
        status: (['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(r.status)
          ? r.status
          : 'pending') as OrderStatus,
        notes: r.notes || '',
      };
    })
    .reverse();

  return { settings, categories, products, banners, cities, coupons, orders };
}

function buildSeedRowsForTab(tabName: string, snap: StoreSnapshot): string[][] {
  const schema = SHEET_SCHEMA_TABS.find((t) => t.tabName === tabName);
  if (!schema) return [];
  const header = schema.columns.map((c) => c.name);

  if (tabName === 'Settings') {
    const labels: Record<string, string> = {
      store_name: 'اسم المتجر',
      store_tagline: 'وصف المتجر',
      currency: 'العملة',
      default_delivery_fee: 'رسوم التوصيل الافتراضية',
      free_shipping_min: 'حد الشحن المجاني',
      whatsapp: 'رقم الواتساب',
      telegram_username: 'معرف تيليجرام للتواصل',
      bank_name: 'اسم البنك',
      bank_account_name: 'اسم صاحب الحساب',
      bank_iban: 'رقم الآيبان IBAN',
      cod_enabled: 'تفعيل الدفع عند الاستلام',
      bank_transfer_enabled: 'تفعيل التحويل البنكي',
      announcement_text: 'شريط الإعلانات العلوي',
    };
    return [
      header,
      ...Object.entries(snap.settings).map(([k, v]) => [k, String(v ?? ''), labels[k] || k]),
    ];
  }
  if (tabName === 'Categories') {
    return [
      header,
      ...snap.categories.map((c) => [
        c.id,
        c.name,
        c.slug,
        c.image_url,
        String(c.sort_order),
        c.is_active ? 'TRUE' : 'FALSE',
      ]),
    ];
  }
  if (tabName === 'Products') {
    return [
      header,
      ...snap.products.map((p) => [
        p.id,
        p.category_id,
        p.name,
        p.sku,
        p.description,
        String(p.price),
        p.compare_at_price !== null ? String(p.compare_at_price) : '',
        String(p.stock),
        p.image_url,
        JSON.stringify(p.gallery_urls),
        JSON.stringify(p.variants),
        p.is_featured ? 'TRUE' : 'FALSE',
        p.is_active ? 'TRUE' : 'FALSE',
        p.created_at,
      ]),
    ];
  }
  if (tabName === 'Banners') {
    return [
      header,
      ...snap.banners.map((b) => [
        b.id,
        b.title,
        b.subtitle,
        b.image_url,
        b.link_url,
        String(b.sort_order),
        b.is_active ? 'TRUE' : 'FALSE',
      ]),
    ];
  }
  if (tabName === 'Cities') {
    return [
      header,
      ...snap.cities.map((c) => [
        c.id,
        c.name,
        String(c.delivery_fee),
        c.estimated_days,
        c.free_shipping_min !== null ? String(c.free_shipping_min) : '',
        c.is_active ? 'TRUE' : 'FALSE',
      ]),
    ];
  }
  if (tabName === 'Coupons') {
    return [
      header,
      ...snap.coupons.map((c) => [
        c.id,
        c.code,
        c.discount_type,
        String(c.discount_value),
        String(c.min_order),
        String(c.max_uses),
        String(c.used_count),
        c.expires_at,
        c.is_active ? 'TRUE' : 'FALSE',
      ]),
    ];
  }
  if (tabName === 'Orders') {
    return [
      header,
      ...snap.orders.map((o) => [
        o.id,
        o.created_at,
        o.customer_name,
        o.customer_phone,
        o.customer_city,
        o.customer_address,
        o.telegram_username,
        o.payment_method,
        o.bank_reference,
        o.coupon_code,
        String(o.discount_amount),
        JSON.stringify(o.items),
        String(o.subtotal),
        String(o.delivery_fee),
        String(o.total),
        o.status,
        o.notes,
      ]),
    ];
  }
  return [header];
}

// --- Google Service Account JWT Auth ---
async function getServiceAccountToken(): Promise<string> {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleToken.token;
  }
  if (!runtimeConfig.serviceAccountEmail || !runtimeConfig.serviceAccountPrivateKey) {
    throw new Error('بيانات Service Account غير مكتملة.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: runtimeConfig.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');

  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(runtimeConfig.serviceAccountPrivateKey, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'فشل توثيق Google Service Account');
  }
  cachedGoogleToken = {
    token: data.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return data.access_token;
}

async function callAppsScript<T = Record<string, unknown>>(action: string, payload?: unknown): Promise<T> {
  if (!validateAppsScriptUrl(runtimeConfig.appsScriptUrl)) {
    throw new Error('رابط Google Apps Script غير مضبوط أو غير صالح.');
  }
  const res = await fetch(runtimeConfig.appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: runtimeConfig.appsScriptSecret,
      action,
      payload,
    }),
  });
  const text = await res.text();
  let json: { ok?: boolean; error?: string; data?: T } & T;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('استجابة غير متوقعة من Google Apps Script. تأكد من نشره بصلاحية Anyone.');
  }
  if (json && json.ok === false) {
    if (json.error === 'Unauthorized secret') {
      throw new Error('المفتاح السري (Secret Token) غير متطابق مع قيمة SECRET_TOKEN داخل كود Google Apps Script.');
    }
    throw new Error(json.error || 'رفض Google Apps Script الطلب');
  }
  return (json.data !== undefined ? json.data : json) as T;
}

async function fetchServiceAccountAllTabs(): Promise<Record<string, string[][]>> {
  const token = await getServiceAccountToken();
  const sheetId = runtimeConfig.sheetId;
  if (!sheetId) throw new Error('يرجى إدخال معرف ملف الشيت (Spreadsheet ID).');
  const ranges = SHEET_SCHEMA_TABS.map((t) => `ranges=${encodeURIComponent(`${t.tabName}!A1:Z1000`)}`).join('&');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${ranges}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = (await res.json()) as {
    valueRanges?: { range?: string; values?: string[][] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message || 'تعذر قراءة ملف Google Sheet. تأكد من مشاركة الشيت مع بريد Service Account.');
  }
  const out: Record<string, string[][]> = {};
  for (const tab of SHEET_SCHEMA_TABS) {
    const found = json.valueRanges?.find((vr) => vr.range?.startsWith(`${tab.tabName}!`) || vr.range?.startsWith(`'${tab.tabName}'!`));
    out[tab.tabName] = found?.values || [];
  }
  return out;
}

async function upsertRowServiceAccount(tabName: string, keyField: string, rowObj: Record<string, string>): Promise<void> {
  const token = await getServiceAccountToken();
  const sheetId = runtimeConfig.sheetId;
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${tabName}!A1:Z1000`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const readJson = (await readRes.json()) as { values?: string[][] };
  const rows = readJson.values || [];
  const schema = SHEET_SCHEMA_TABS.find((t) => t.tabName === tabName);
  const headers = rows[0] && rows[0].length > 0 ? rows[0] : schema?.columns.map((c) => c.name) || Object.keys(rowObj);

  const keyIdx = headers.indexOf(keyField);
  const targetVal = rowObj[keyField];
  const rowArray = headers.map((h) => rowObj[h] ?? '');

  let foundRowIndex = -1;
  if (keyIdx >= 0 && targetVal) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i]?.[keyIdx] ?? '') === targetVal) {
        foundRowIndex = i + 1; // 1-indexed in Sheets
        break;
      }
    }
  }

  if (foundRowIndex > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${tabName}!A${foundRowIndex}`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowArray] }),
      }
    );
  } else {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${tabName}!A1`)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowArray] }),
      }
    );
  }
}

async function deleteRowServiceAccount(tabName: string, keyField: string, keyValue: string): Promise<void> {
  const token = await getServiceAccountToken();
  const sheetId = runtimeConfig.sheetId;
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = (await metaRes.json()) as { sheets?: { properties: { sheetId: number; title: string } }[] };
  const sheetProp = meta.sheets?.find((s) => s.properties.title === tabName)?.properties;
  if (!sheetProp) return;

  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${tabName}!A1:Z1000`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const readJson = (await readRes.json()) as { values?: string[][] };
  const rows = readJson.values || [];
  if (rows.length < 2) return;
  const keyIdx = rows[0].indexOf(keyField);
  if (keyIdx < 0) return;

  const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[keyIdx] ?? '') === keyValue);
  if (rowIdx < 1) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetProp.sheetId,
              dimension: 'ROWS',
              startIndex: rowIdx,
              endIndex: rowIdx + 1,
            },
          },
        },
      ],
    }),
  });
}

// --- Public Adapter Operations ---
export async function getSnapshot(forceFresh = false): Promise<StoreSnapshot> {
  if (!forceFresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.data;
  }

  let data: StoreSnapshot;
  if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
    const rawTabs = await callAppsScript<Record<string, string[][]>>('getAll');
    data = rowsToSnapshot(rawTabs);
  } else if (runtimeConfig.sheetsMode === 'service_account' && runtimeConfig.sheetId && runtimeConfig.serviceAccountEmail) {
    const rawTabs = await fetchServiceAccountAllTabs();
    data = rowsToSnapshot(rawTabs);
  } else {
    data = memoryStore;
  }

  snapshotCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getPersistedAdminAuthFromSheets(): Promise<PersistedAdminAuth | null> {
  if (persistedMemoryAuth) return persistedMemoryAuth;

  try {
    let settingsRows: Record<string, string>[] = [];
    if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
      const rawTabs = await callAppsScript<Record<string, string[][]>>('getAll');
      settingsRows = parseRowObjects(rawTabs.Settings || []);
    } else if (
      runtimeConfig.sheetsMode === 'service_account' &&
      runtimeConfig.sheetId &&
      runtimeConfig.serviceAccountEmail
    ) {
      const rawTabs = await fetchServiceAccountAllTabs();
      settingsRows = parseRowObjects(rawTabs.Settings || []);
    } else {
      return null;
    }

    const map: Record<string, string> = {};
    for (const r of settingsRows) {
      if (r.key && r.key.startsWith('__admin_')) {
        map[r.key] = r.value ?? '';
      }
    }
    if (map.__admin_password_hash && map.__admin_password_salt) {
      persistedMemoryAuth = {
        username: map.__admin_username || BACKEND_CONFIG.adminUsername || 'admin',
        hash: map.__admin_password_hash,
        salt: map.__admin_password_salt,
      };
      return persistedMemoryAuth;
    }
  } catch {
    // Ignore transient sheet read failures during auth check
  }
  return null;
}

export async function savePersistedAdminAuthToSheets(auth: PersistedAdminAuth): Promise<void> {
  persistedMemoryAuth = auth;
  const rows = [
    { key: '__admin_username', value: auth.username, label: 'اسم المستخدم الإداري' },
    { key: '__admin_password_hash', value: auth.hash, label: 'بيانات التحقق الإدارية' },
    { key: '__admin_password_salt', value: auth.salt, label: 'معرف التحقق الإداري' },
  ];

  if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
    for (const row of rows) {
      await callAppsScript('upsert', { tab: 'Settings', keyField: 'key', row });
    }
    return;
  }

  if (runtimeConfig.sheetsMode === 'service_account' && runtimeConfig.sheetId) {
    for (const row of rows) {
      await upsertRowServiceAccount('Settings', 'key', row);
    }
  }
}

export async function testSheetsConnection(): Promise<{
  ok: boolean;
  mode: SheetsConnectionMode;
  isDemo?: boolean;
  message: string;
  tabsFound?: string[];
  productCount?: number;
}> {
  if (runtimeConfig.sheetsMode === 'demo') {
    return {
      ok: false,
      mode: 'demo',
      isDemo: true,
      message:
        'النظام يعمل حالياً بالوضع التجريبي المؤقت (لا يحفظ في Google Sheets). اختر Google Apps Script وأدخل الرابط ثم اضغط حفظ واختبار الاتصال.',
      tabsFound: SHEET_SCHEMA_TABS.map((t) => t.tabName),
      productCount: memoryStore.products.length,
    };
  }

  if (runtimeConfig.sheetsMode === 'apps_script') {
    const res = await callAppsScript<{ tabs?: string[]; spreadsheetName?: string }>('test');
    const snap = await getSnapshot(true);
    return {
      ok: true,
      mode: 'apps_script',
      message: `تم الاتصال بنجاح عبر Google Apps Script${res.spreadsheetName ? ` (${res.spreadsheetName})` : ''}.`,
      tabsFound: res.tabs || [],
      productCount: snap.products.length,
    };
  }

  const token = await getServiceAccountToken();
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(runtimeConfig.sheetId)}?fields=properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = (await metaRes.json()) as {
    properties?: { title?: string };
    sheets?: { properties: { title: string } }[];
    error?: { message?: string };
  };
  if (!metaRes.ok) {
    throw new Error(meta.error?.message || 'فشل الاتصال بـ Google Sheets API');
  }
  const snap = await getSnapshot(true);
  return {
    ok: true,
    mode: 'service_account',
    message: `متصل بملف "${meta.properties?.title || 'Google Sheet'}" عبر Service Account.`,
    tabsFound: meta.sheets?.map((s) => s.properties.title) || [],
    productCount: snap.products.length,
  };
}

export async function initializeSheetsStructure(seedSampleData = true): Promise<{ ok: boolean; message: string }> {
  invalidateCache();

  if (runtimeConfig.sheetsMode === 'demo') {
    return {
      ok: false,
      message: 'النظام ما زال في الوضع التجريبي. اختر Google Apps Script وأدخل رابط Web App أولاً ثم اضغط تهيئة الأوراق.',
    };
  }

  const seedSnap = memoryStore;
  const tabsPayload: Record<string, string[][]> = {};
  for (const tab of SHEET_SCHEMA_TABS) {
    tabsPayload[tab.tabName] = seedSampleData ? buildSeedRowsForTab(tab.tabName, seedSnap) : [tab.columns.map((c) => c.name)];
  }

  if (runtimeConfig.sheetsMode === 'apps_script') {
    await callAppsScript('init', { tabs: tabsPayload, seedSampleData });
    return { ok: true, message: 'تم إنشاء الأوراق السبع وتعبئة العناوين والبيانات بنجاح عبر Apps Script.' };
  }

  const token = await getServiceAccountToken();
  const sheetId = runtimeConfig.sheetId;
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = (await metaRes.json()) as { sheets?: { properties: { title: string } }[]; error?: { message?: string } };
  if (!metaRes.ok) {
    throw new Error(meta.error?.message || 'تعذر الوصول إلى ملف الشيت.');
  }

  const existingTitles = new Set((meta.sheets || []).map((s) => s.properties.title));
  const missingTabs = SHEET_SCHEMA_TABS.filter((t) => !existingTitles.has(t.tabName));
  if (missingTabs.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: missingTabs.map((t) => ({ addSheet: { properties: { title: t.tabName } } })),
      }),
    });
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: Object.entries(tabsPayload).map(([tabName, values]) => ({
        range: `${tabName}!A1`,
        values,
      })),
    }),
  });

  return { ok: true, message: 'تمت تهيئة جميع أوراق الشيت (7 أوراق) وإدراج البيانات بنجاح!' };
}

function serializeEntityRow(tabName: string, entity: unknown): Record<string, string> {
  if (tabName === 'Categories') {
    const c = entity as Category;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      image_url: c.image_url,
      sort_order: String(c.sort_order),
      is_active: c.is_active ? 'TRUE' : 'FALSE',
    };
  }
  if (tabName === 'Products') {
    const p = entity as Product;
    return {
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: String(p.price),
      compare_at_price: p.compare_at_price !== null ? String(p.compare_at_price) : '',
      stock: String(p.stock),
      image_url: p.image_url,
      gallery_urls: JSON.stringify(p.gallery_urls || []),
      variants: JSON.stringify(p.variants || []),
      is_featured: p.is_featured ? 'TRUE' : 'FALSE',
      is_active: p.is_active ? 'TRUE' : 'FALSE',
      created_at: p.created_at,
    };
  }
  if (tabName === 'Banners') {
    const b = entity as Banner;
    return {
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link_url: b.link_url,
      sort_order: String(b.sort_order),
      is_active: b.is_active ? 'TRUE' : 'FALSE',
    };
  }
  if (tabName === 'Cities') {
    const c = entity as CityZone;
    return {
      id: c.id,
      name: c.name,
      delivery_fee: String(c.delivery_fee),
      estimated_days: c.estimated_days,
      free_shipping_min: c.free_shipping_min !== null ? String(c.free_shipping_min) : '',
      is_active: c.is_active ? 'TRUE' : 'FALSE',
    };
  }
  if (tabName === 'Coupons') {
    const c = entity as Coupon;
    return {
      id: c.id,
      code: c.code.toUpperCase().trim(),
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order: String(c.min_order),
      max_uses: String(c.max_uses),
      used_count: String(c.used_count),
      expires_at: c.expires_at,
      is_active: c.is_active ? 'TRUE' : 'FALSE',
    };
  }
  if (tabName === 'Orders') {
    const o = entity as Order;
    return {
      id: o.id,
      created_at: o.created_at,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_city: o.customer_city,
      customer_address: o.customer_address,
      telegram_username: o.telegram_username,
      payment_method: o.payment_method,
      bank_reference: o.bank_reference,
      coupon_code: o.coupon_code,
      discount_amount: String(o.discount_amount),
      items_json: JSON.stringify(o.items),
      subtotal: String(o.subtotal),
      delivery_fee: String(o.delivery_fee),
      total: String(o.total),
      status: o.status,
      notes: o.notes,
    };
  }
  return entity as Record<string, string>;
}

export async function upsertEntity(
  tabName: 'Categories' | 'Products' | 'Banners' | 'Cities' | 'Coupons' | 'Orders',
  entity: Category | Product | Banner | CityZone | Coupon | Order
): Promise<void> {
  invalidateCache();

  if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
    await callAppsScript('upsert', {
      tab: tabName,
      keyField: 'id',
      row: serializeEntityRow(tabName, entity),
    });
    return;
  }
  if (runtimeConfig.sheetsMode === 'service_account' && runtimeConfig.sheetId) {
    await upsertRowServiceAccount(tabName, 'id', serializeEntityRow(tabName, entity));
    return;
  }

  const list = memoryStore[
    tabName.toLowerCase() as 'categories' | 'products' | 'banners' | 'cities' | 'coupons' | 'orders'
  ] as { id: string }[];
  const idx = list.findIndex((item) => item.id === entity.id);
  if (idx >= 0) {
    list[idx] = entity;
  } else {
    if (tabName === 'Orders') list.unshift(entity);
    else list.push(entity);
  }
}

export async function deleteEntity(
  tabName: 'Categories' | 'Products' | 'Banners' | 'Cities' | 'Coupons',
  id: string
): Promise<void> {
  invalidateCache();

  if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
    await callAppsScript('delete', { tab: tabName, keyField: 'id', keyValue: id });
    return;
  }
  if (runtimeConfig.sheetsMode === 'service_account' && runtimeConfig.sheetId) {
    await deleteRowServiceAccount(tabName, 'id', id);
    return;
  }

  const key = tabName.toLowerCase() as 'categories' | 'products' | 'banners' | 'cities' | 'coupons';
  const filtered = (memoryStore[key] as { id: string }[]).filter((item) => item.id !== id);
  // @ts-expect-error dynamic assignment on typed memoryStore
  memoryStore[key] = filtered;
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  invalidateCache();

  const labels: Record<string, string> = {
    store_name: 'اسم المتجر',
    store_tagline: 'وصف المتجر',
    currency: 'العملة',
    default_delivery_fee: 'رسوم التوصيل الافتراضية',
    free_shipping_min: 'حد الشحن المجاني',
    whatsapp: 'رقم الواتساب',
    telegram_username: 'معرف تيليجرام للتواصل',
    bank_name: 'اسم البنك',
    bank_account_name: 'اسم صاحب الحساب',
    bank_iban: 'رقم الآيبان IBAN',
    cod_enabled: 'تفعيل الدفع عند الاستلام',
    bank_transfer_enabled: 'تفعيل التحويل البنكي',
    announcement_text: 'شريط الإعلانات العلوي',
  };

  if (runtimeConfig.sheetsMode === 'apps_script' && runtimeConfig.appsScriptUrl) {
    const rows = Object.entries(settings).map(([k, v]) => ({
      key: k,
      value: String(v ?? ''),
      label: labels[k] || k,
    }));
    await callAppsScript('saveSettings', { rows });
    return;
  }

  if (runtimeConfig.sheetsMode === 'service_account' && runtimeConfig.sheetId) {
    for (const [k, v] of Object.entries(settings)) {
      await upsertRowServiceAccount('Settings', 'key', {
        key: k,
        value: String(v ?? ''),
        label: labels[k] || k,
      });
    }
    return;
  }

  memoryStore.settings = { ...settings };
}

export const APPS_SCRIPT_TEMPLATE = `// انسخ هذا الكود بالكامل وضعه في: الإضافات (Extensions) -> Apps Script داخل ملف Google Sheets
// ثم اضغط نشر (Deploy) -> نشر جديد (New deployment) -> تطبيق ويب (Web app)
// اختر "أياً كان" (Anyone) للوصول، وانسخ رابط الـ Web App إلى لوحة تحكم المتجر.

const SECRET_TOKEN = "CHANGE_THIS_TO_YOUR_SECRET"; // نفس المفتاح السري الذي تضعه في إعدادات المتجر

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (SECRET_TOKEN && SECRET_TOKEN !== "CHANGE_THIS_TO_YOUR_SECRET" && body.secret !== SECRET_TOKEN) {
      return jsonOut({ ok: false, error: "Unauthorized secret" });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = body.action;

    if (action === "test") {
      return jsonOut({
        ok: true,
        data: {
          spreadsheetName: ss.getName(),
          tabs: ss.getSheets().map(function(s) { return s.getName(); })
        }
      });
    }

    if (action === "init") {
      const tabs = (body.payload && body.payload.tabs) || {};
      Object.keys(tabs).forEach(function(tabName) {
        let sheet = ss.getSheetByName(tabName);
        if (!sheet) sheet = ss.insertSheet(tabName);
        const rows = tabs[tabName];
        if (rows && rows.length > 0) {
          sheet.clearContents();
          sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
          sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
          sheet.setFrozenRows(1);
        }
      });
      SpreadsheetApp.flush();
      return jsonOut({ ok: true, data: { initialized: true } });
    }

    if (action === "getAll") {
      const result = {};
      ss.getSheets().forEach(function(sheet) {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow > 0 && lastCol > 0) {
          result[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
        } else {
          result[sheet.getName()] = [];
        }
      });
      return jsonOut({ ok: true, data: result });
    }

    if (action === "upsert") {
      const p = body.payload;
      let sheet = ss.getSheetByName(p.tab);
      if (!sheet) sheet = ss.insertSheet(p.tab);
      if (sheet.getLastRow() === 0) {
        const initHeaders = Object.keys(p.row);
        sheet.getRange(1, 1, 1, initHeaders.length).setValues([initHeaders]);
        sheet.getRange(1, 1, 1, initHeaders.length).setFontWeight("bold");
        sheet.setFrozenRows(1);
      }
      const lastCol = Math.max(sheet.getLastColumn(), Object.keys(p.row).length);
      const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].filter(Boolean);
      const keyIdx = headers.indexOf(p.keyField);
      const values = headers.map(function(h) { return p.row[h] !== undefined ? p.row[h] : ""; });
      const lastRow = sheet.getLastRow();
      let targetRow = -1;
      if (lastRow >= 2 && keyIdx >= 0) {
        const colVals = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < colVals.length; i++) {
          if (String(colVals[i][0]) === String(p.row[p.keyField])) {
            targetRow = i + 2;
            break;
          }
        }
      }
      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
      SpreadsheetApp.flush();
      return jsonOut({ ok: true });
    }

    if (action === "delete") {
      const p = body.payload;
      const sheet = ss.getSheetByName(p.tab);
      if (!sheet || sheet.getLastRow() < 2) return jsonOut({ ok: true });
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
      const keyIdx = headers.indexOf(p.keyField);
      if (keyIdx < 0) return jsonOut({ ok: true });
      const colVals = sheet.getRange(2, keyIdx + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      for (let i = colVals.length - 1; i >= 0; i--) {
        if (String(colVals[i][0]) === String(p.keyValue)) {
          sheet.deleteRow(i + 2);
        }
      }
      SpreadsheetApp.flush();
      return jsonOut({ ok: true });
    }

    if (action === "saveSettings") {
      const rows = (body.payload && body.payload.rows) || [];
      let sheet = ss.getSheetByName("Settings");
      if (!sheet) sheet = ss.insertSheet("Settings");
      const preserved = [];
      if (sheet.getLastRow() >= 2 && sheet.getLastColumn() >= 2) {
        const existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(3, sheet.getLastColumn())).getDisplayValues();
        existing.forEach(function(r) {
          if (String(r[0] || "").indexOf("__admin_") === 0) {
            preserved.push([r[0], r[1] || "", r[2] || ""]);
          }
        });
      }
      const data = [["key", "value", "label"]]
        .concat(rows.map(function(r) { return [r.key, r.value, r.label]; }))
        .concat(preserved);
      sheet.clearContents();
      sheet.getRange(1, 1, data.length, 3).setValues(data);
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
      SpreadsheetApp.flush();
      return jsonOut({ ok: true });
    }

    return jsonOut({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
