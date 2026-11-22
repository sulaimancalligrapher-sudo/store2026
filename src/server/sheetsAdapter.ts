import {
  DEFAULT_BANNERS,
  DEFAULT_CATEGORIES,
  DEFAULT_CITIES,
  DEFAULT_COUPONS,
  DEFAULT_ORDERS,
  DEFAULT_PRODUCTS,
  DEFAULT_PROGRAMS,
  DEFAULT_SETTINGS,
  SHEET_SCHEMA_TABS,
} from '../shared/seedData.ts';
import type {
  Banner,
  Category,
  CityZone,
  Coupon,
  EnrollmentStatus,
  Order,
  OrderStatus,
  Product,
  ProgramEnrollment,
  SheetsConnectionMode,
  StoreSettings,
  TrainingFormat,
  TrainingProgram,
} from '../shared/types.ts';
import type { TelegramRuntimeConfig } from './telegramService.ts';
import { normalizeImageUrl } from '../shared/imageUrl.ts';
import { parseProductVariants } from '../shared/variants.ts';
import { BACKEND_CONFIG } from './backendConfig.ts';

export interface StoreSnapshot {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  programs: TrainingProgram[];
  banners: Banner[];
  cities: CityZone[];
  coupons: Coupon[];
  orders: Order[];
  enrollments: ProgramEnrollment[];
}

export interface RuntimeIntegrations {
  sheetsMode: SheetsConnectionMode;
  appsScriptUrl: string;
  appsScriptSecret: string;
  telegramBotToken: string;
  telegramAdminChatId: string;
  telegramWebhookSecret: string;
}

const runtimeConfig: RuntimeIntegrations = {
  sheetsMode: 'apps_script',
  appsScriptUrl:
    process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ||
    BACKEND_CONFIG.appsScriptUrl.trim() ||
    '',
  appsScriptSecret: process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
};

export interface PersistedAdminAuth {
  username: string;
  hash?: string;
  salt?: string;
  plainPasscode?: string;
}

let persistedSheetAuthCache: { auth: PersistedAdminAuth; expiresAt: number } | null = null;
let snapshotCache: { data: StoreSnapshot; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

let ensuredAdminTabInSession = false;
let ensuredProgramsTabInSession = false;
let ensuringTabsPromise: Promise<void> | null = null;

export function invalidateCache(): void {
  snapshotCache = null;
  persistedSheetAuthCache = null;
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

export async function getTelegramConfigAsync(forceFresh = false): Promise<TelegramRuntimeConfig> {
  if (
    forceFresh ||
    !runtimeConfig.telegramBotToken ||
    !runtimeConfig.telegramAdminChatId
  ) {
    try {
      await getSnapshot(forceFresh);
    } catch {
      // Fall back cleanly to whatever is currently in runtimeConfig
    }
  }
  return getTelegramConfig();
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

export function updateRuntimeConfig(partial: {
  appsScriptUrl?: string;
  appsScriptSecret?: string;
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
    ensuredAdminTabInSession = false;
    ensuredProgramsTabInSession = false;
  }

  if (partial.appsScriptSecret !== undefined && partial.appsScriptSecret !== '__KEEP__') {
    runtimeConfig.appsScriptSecret = partial.appsScriptSecret.trim();
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

  runtimeConfig.sheetsMode = 'apps_script';
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
      // fallback to newline / comma split
    }
  }
  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
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

function hydrateTelegramFromSettingsMap(settingsMap: Record<string, string>): void {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() && settingsMap.__tg_bot_token) {
    runtimeConfig.telegramBotToken = settingsMap.__tg_bot_token.trim();
  }
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() && settingsMap.__tg_admin_chat_id) {
    runtimeConfig.telegramAdminChatId = settingsMap.__tg_admin_chat_id.trim();
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET?.trim() && settingsMap.__tg_webhook_secret) {
    runtimeConfig.telegramWebhookSecret = settingsMap.__tg_webhook_secret.trim();
  }
}

function rowsToSnapshot(rawTabs: Record<string, string[][]>): StoreSnapshot {
  const settingsRows = parseRowObjects(rawTabs.Settings || []);
  const settingsMap: Record<string, string> = {};
  for (const row of settingsRows) {
    if (row.key) settingsMap[row.key] = row.value ?? '';
  }

  hydrateTelegramFromSettingsMap(settingsMap);

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
    variants: parseProductVariants(r.variants),
    is_featured: toBool(r.is_featured, false),
    is_active: toBool(r.is_active, true),
    created_at: r.created_at || new Date().toISOString(),
  }));

  const programs: TrainingProgram[] = parseRowObjects(rawTabs.Programs || []).map((r) => {
    const rawFormat = String(r.format || 'online_live').trim();
    const format: TrainingFormat =
      rawFormat === 'in_person' || rawFormat === 'recorded' ? rawFormat : 'online_live';
    return {
      id: r.id,
      title: r.title || '',
      instructor: r.instructor || '',
      category: r.category || 'عام',
      format,
      duration: r.duration || '',
      start_date: r.start_date || '',
      seats_total: Math.max(0, toNum(r.seats_total, 20)),
      seats_left: Math.max(0, toNum(r.seats_left, 0)),
      price: Math.max(0, toNum(r.price, 0)),
      compare_at_price: r.compare_at_price ? toNum(r.compare_at_price, 0) || null : null,
      image_url: normalizeImageUrl(r.image_url || ''),
      syllabus: parseList(r.syllabus),
      description: r.description || '',
      is_featured: toBool(r.is_featured, true),
      is_active: toBool(r.is_active, true),
      created_at: r.created_at || new Date().toISOString(),
    };
  });

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

  const enrollments: ProgramEnrollment[] = parseRowObjects(rawTabs.Enrollments || [])
    .map((r) => ({
      id: r.id,
      created_at: r.created_at || new Date().toISOString(),
      program_id: r.program_id || '',
      program_title: r.program_title || '',
      student_name: r.student_name || '',
      student_phone: r.student_phone || '',
      telegram_username: r.telegram_username || '',
      payment_method: (
        r.payment_method === 'bank_transfer' || r.payment_method === 'free' ? r.payment_method : 'cod'
      ) as ProgramEnrollment['payment_method'],
      bank_reference: r.bank_reference || '',
      price_paid: toNum(r.price_paid, 0),
      status: (['pending', 'confirmed', 'completed', 'cancelled'].includes(r.status)
        ? r.status
        : 'pending') as EnrollmentStatus,
      notes: r.notes || '',
    }))
    .reverse();

  return { settings, categories, products, programs, banners, cities, coupons, orders, enrollments };
}

function buildSeedRowsForTab(tabName: string): string[][] {
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
    const baseRows = Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, String(v ?? ''), labels[k] || k]);
    if (runtimeConfig.telegramBotToken) {
      baseRows.push(['__tg_bot_token', runtimeConfig.telegramBotToken, 'رمز بوت تيليجرام (خاص بالسيرفر)']);
    }
    if (runtimeConfig.telegramAdminChatId) {
      baseRows.push(['__tg_admin_chat_id', runtimeConfig.telegramAdminChatId, 'معرف الإداري في تيليجرام']);
    }
    if (runtimeConfig.telegramWebhookSecret) {
      baseRows.push(['__tg_webhook_secret', runtimeConfig.telegramWebhookSecret, 'كلمة سر Webhook تيليجرام']);
    }
    return [header, ...baseRows];
  }
  if (tabName === 'Categories') {
    return [
      header,
      ...DEFAULT_CATEGORIES.map((c) => [
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
      ...DEFAULT_PRODUCTS.map((p) => [
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
  if (tabName === 'Programs') {
    return [
      header,
      ...DEFAULT_PROGRAMS.map((p) => [
        p.id,
        p.title,
        p.instructor,
        p.category,
        p.format,
        p.duration,
        p.start_date,
        String(p.seats_total),
        String(p.seats_left),
        String(p.price),
        p.compare_at_price !== null ? String(p.compare_at_price) : '',
        p.image_url,
        JSON.stringify(p.syllabus),
        p.description,
        p.is_featured ? 'TRUE' : 'FALSE',
        p.is_active ? 'TRUE' : 'FALSE',
        p.created_at,
      ]),
    ];
  }
  if (tabName === 'Banners') {
    return [
      header,
      ...DEFAULT_BANNERS.map((b) => [
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
      ...DEFAULT_CITIES.map((c) => [
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
      ...DEFAULT_COUPONS.map((c) => [
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
      ...DEFAULT_ORDERS.map((o) => [
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
  if (tabName === 'Admin') {
    const activeUser = BACKEND_CONFIG.adminUsername || 'admin';
    const activePass = BACKEND_CONFIG.adminPasscode || '123456';
    return [header, ['adm_1', activeUser, activePass, 'admin', 'TRUE', new Date().toISOString()]];
  }
  return [header];
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

/**
 * Auto-creates missing Admin and Programs tabs safely without modifying existing data.
 */
async function ensureMissingRequiredTabs(rawTabs: Record<string, string[][]>): Promise<void> {
  const needsAdmin = (!rawTabs.Admin || rawTabs.Admin.length === 0) && !ensuredAdminTabInSession;
  const needsPrograms = (!rawTabs.Programs || rawTabs.Programs.length === 0) && !ensuredProgramsTabInSession;

  if (!needsAdmin && !needsPrograms) return;

  if (ensuringTabsPromise) {
    await ensuringTabsPromise;
    return;
  }

  ensuringTabsPromise = (async () => {
    try {
      if (needsAdmin) {
        ensuredAdminTabInSession = true;
        const adminRow = {
          id: 'adm_1',
          username: BACKEND_CONFIG.adminUsername || 'admin',
          passcode: BACKEND_CONFIG.adminPasscode || '123456',
          role: 'admin',
          is_active: 'TRUE',
          updated_at: new Date().toISOString(),
        };
        await callAppsScript('upsert', { tab: 'Admin', keyField: 'id', row: adminRow });
        rawTabs.Admin = [
          ['id', 'username', 'passcode', 'role', 'is_active', 'updated_at'],
          [adminRow.id, adminRow.username, adminRow.passcode, adminRow.role, adminRow.is_active, adminRow.updated_at],
        ];
      }

      if (needsPrograms) {
        ensuredProgramsTabInSession = true;
        const header =
          SHEET_SCHEMA_TABS.find((t) => t.tabName === 'Programs')?.columns.map((c) => c.name) || [];
        const createdRows: string[][] = [header];
        for (const prog of DEFAULT_PROGRAMS) {
          const serialized = serializeEntityRow('Programs', prog);
          await callAppsScript('upsert', { tab: 'Programs', keyField: 'id', row: serialized });
          createdRows.push(header.map((col) => serialized[col] ?? ''));
        }
        rawTabs.Programs = createdRows;
      }
    } catch {
      // Non-fatal: retry cleanly on subsequent request
    } finally {
      ensuringTabsPromise = null;
    }
  })();

  await ensuringTabsPromise;
}

// --- Public Adapter Operations ---
export async function getSnapshot(forceFresh = false): Promise<StoreSnapshot> {
  if (!forceFresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.data;
  }

  const rawTabs = await callAppsScript<Record<string, string[][]>>('getAll');
  await ensureMissingRequiredTabs(rawTabs);
  const data = rowsToSnapshot(rawTabs);

  snapshotCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getPersistedAdminAuthFromSheets(forceFresh = false): Promise<PersistedAdminAuth | null> {
  if (!forceFresh && persistedSheetAuthCache && persistedSheetAuthCache.expiresAt > Date.now()) {
    return persistedSheetAuthCache.auth;
  }

  try {
    const rawTabs = await callAppsScript<Record<string, string[][]>>('getAll');
    await ensureMissingRequiredTabs(rawTabs);

    const adminRows = parseRowObjects(rawTabs.Admin || []);
    const activeAdmin = adminRows.find(
      (r) => toBool(r.is_active, true) && String(r.username || '').trim() && String(r.passcode || '').trim()
    );
    if (activeAdmin) {
      const rawPass = String(activeAdmin.passcode).trim();
      let parsedAuth: PersistedAdminAuth;
      if (rawPass.startsWith('scrypt:')) {
        const parts = rawPass.split(':');
        if (parts.length === 3 && parts[1] && parts[2]) {
          parsedAuth = {
            username: String(activeAdmin.username).trim(),
            salt: parts[1],
            hash: parts[2],
          };
        } else {
          parsedAuth = {
            username: String(activeAdmin.username).trim(),
            plainPasscode: rawPass,
          };
        }
      } else {
        parsedAuth = {
          username: String(activeAdmin.username).trim(),
          plainPasscode: rawPass,
        };
      }
      persistedSheetAuthCache = { auth: parsedAuth, expiresAt: Date.now() + CACHE_TTL_MS };
      return parsedAuth;
    }

    const settingsRows = parseRowObjects(rawTabs.Settings || []);
    const map: Record<string, string> = {};
    for (const r of settingsRows) {
      if (r.key && r.key.startsWith('__admin_')) {
        map[r.key] = r.value ?? '';
      }
    }
    if (map.__admin_password_hash && map.__admin_password_salt) {
      const legacyAuth: PersistedAdminAuth = {
        username: map.__admin_username || BACKEND_CONFIG.adminUsername || 'admin',
        hash: map.__admin_password_hash,
        salt: map.__admin_password_salt,
      };
      persistedSheetAuthCache = { auth: legacyAuth, expiresAt: Date.now() + CACHE_TTL_MS };
      return legacyAuth;
    }
  } catch {
    // Ignore transient sheet read failures during auth check
  }
  return null;
}

export async function savePersistedAdminAuthToSheets(auth: PersistedAdminAuth): Promise<void> {
  persistedSheetAuthCache = { auth, expiresAt: Date.now() + CACHE_TTL_MS };
  const serializedPasscode =
    auth.hash && auth.salt ? `scrypt:${auth.salt}:${auth.hash}` : auth.plainPasscode || '';

  const adminRow = {
    id: 'adm_1',
    username: auth.username,
    passcode: serializedPasscode,
    role: 'admin',
    is_active: 'TRUE',
    updated_at: new Date().toISOString(),
  };

  await callAppsScript('upsert', { tab: 'Admin', keyField: 'id', row: adminRow });
}

export async function saveTelegramConfigToSheets(config: TelegramRuntimeConfig): Promise<void> {
  invalidateCache();
  runtimeConfig.telegramBotToken = config.botToken;
  runtimeConfig.telegramAdminChatId = config.adminChatId;
  runtimeConfig.telegramWebhookSecret = config.webhookSecret;

  const rows = [
    { key: '__tg_bot_token', value: config.botToken, label: 'رمز بوت تيليجرام (خاص بالسيرفر)' },
    { key: '__tg_admin_chat_id', value: config.adminChatId, label: 'معرف الإداري في تيليجرام' },
    { key: '__tg_webhook_secret', value: config.webhookSecret, label: 'كلمة سر Webhook تيليجرام' },
  ];

  for (const row of rows) {
    await callAppsScript('upsert', { tab: 'Settings', keyField: 'key', row });
  }
}

export async function testSheetsConnection(): Promise<{
  ok: boolean;
  mode: SheetsConnectionMode;
  message: string;
  tabsFound?: string[];
  productCount?: number;
}> {
  const res = await callAppsScript<{ tabs?: string[]; spreadsheetName?: string }>('test');
  const snap = await getSnapshot(true);
  const afterTest = await callAppsScript<{ tabs?: string[]; spreadsheetName?: string }>('test');
  return {
    ok: true,
    mode: 'apps_script',
    message: `تم الاتصال بنجاح عبر Google Apps Script${res.spreadsheetName ? ` (${res.spreadsheetName})` : ''}.`,
    tabsFound: afterTest.tabs || res.tabs || [],
    productCount: snap.products.length,
  };
}

export async function initializeSheetsStructure(seedSampleData = true): Promise<{ ok: boolean; message: string }> {
  invalidateCache();
  ensuredAdminTabInSession = false;
  ensuredProgramsTabInSession = false;

  const tabsPayload: Record<string, string[][]> = {};
  for (const tab of SHEET_SCHEMA_TABS) {
    tabsPayload[tab.tabName] = seedSampleData ? buildSeedRowsForTab(tab.tabName) : [tab.columns.map((c) => c.name)];
  }

  await callAppsScript('init', { tabs: tabsPayload, seedSampleData });
  return {
    ok: true,
    message: `تم إنشاء وتهيئة جميع أوراق الشيت الـ ${SHEET_SCHEMA_TABS.length} (بما فيها Admin وPrograms وEnrollments) بنجاح.`,
  };
}

export type EntityTabName =
  | 'Categories'
  | 'Products'
  | 'Programs'
  | 'Banners'
  | 'Cities'
  | 'Coupons'
  | 'Orders'
  | 'Enrollments';

function serializeEntityRow(tabName: EntityTabName, entity: unknown): Record<string, string> {
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
  if (tabName === 'Programs') {
    const p = entity as TrainingProgram;
    return {
      id: p.id,
      title: p.title,
      instructor: p.instructor,
      category: p.category,
      format: p.format,
      duration: p.duration,
      start_date: p.start_date,
      seats_total: String(p.seats_total),
      seats_left: String(p.seats_left),
      price: String(p.price),
      compare_at_price: p.compare_at_price !== null ? String(p.compare_at_price) : '',
      image_url: p.image_url,
      syllabus: JSON.stringify(p.syllabus || []),
      description: p.description,
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
  if (tabName === 'Enrollments') {
    const e = entity as ProgramEnrollment;
    return {
      id: e.id,
      created_at: e.created_at,
      program_id: e.program_id,
      program_title: e.program_title,
      student_name: e.student_name,
      student_phone: e.student_phone,
      telegram_username: e.telegram_username,
      payment_method: e.payment_method,
      bank_reference: e.bank_reference,
      price_paid: String(e.price_paid),
      status: e.status,
      notes: e.notes,
    };
  }
  return entity as Record<string, string>;
}

export async function upsertEntity(
  tabName: EntityTabName,
  entity: Category | Product | TrainingProgram | Banner | CityZone | Coupon | Order | ProgramEnrollment
): Promise<void> {
  invalidateCache();
  await callAppsScript('upsert', {
    tab: tabName,
    keyField: 'id',
    row: serializeEntityRow(tabName, entity),
  });
}

export async function deleteEntity(
  tabName: 'Categories' | 'Products' | 'Programs' | 'Banners' | 'Cities' | 'Coupons',
  id: string
): Promise<void> {
  invalidateCache();
  await callAppsScript('delete', { tab: tabName, keyField: 'id', keyValue: id });
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

  const rows = Object.entries(settings).map(([k, v]) => ({
    key: k,
    value: String(v ?? ''),
    label: labels[k] || k,
  }));

  // Preserve server-only Telegram credentials inside Settings sheet even on older deployed Apps Scripts
  if (runtimeConfig.telegramBotToken) {
    rows.push({
      key: '__tg_bot_token',
      value: runtimeConfig.telegramBotToken,
      label: 'رمز بوت تيليجرام (خاص بالسيرفر)',
    });
  }
  if (runtimeConfig.telegramAdminChatId) {
    rows.push({
      key: '__tg_admin_chat_id',
      value: runtimeConfig.telegramAdminChatId,
      label: 'معرف الإداري في تيليجرام',
    });
  }
  if (runtimeConfig.telegramWebhookSecret) {
    rows.push({
      key: '__tg_webhook_secret',
      value: runtimeConfig.telegramWebhookSecret,
      label: 'كلمة سر Webhook تيليجرام',
    });
  }

  await callAppsScript('saveSettings', { rows });
}

export const APPS_SCRIPT_TEMPLATE = `// انسخ هذا الكود بالكامل وضعه في: الإضافات (Extensions) -> Apps Script داخل ملف Google Sheets
// ثم اضغط نشر (Deploy) -> نشر جديد (New deployment) -> تطبيق ويب (Web app)
// اختر "أياً كان" (Anyone) للوصول، وانسخ رابط الـ Web App إلى إعدادات السيرفر.

const SECRET_TOKEN = "CHANGE_THIS_TO_YOUR_SECRET"; // اختياري: اتركه كما هو أو ضع نفس المفتاح السري

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
      const incomingKeys = {};
      rows.forEach(function(r) { incomingKeys[String(r.key)] = true; });
      const preserved = [];
      if (sheet.getLastRow() >= 2 && sheet.getLastColumn() >= 2) {
        const existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(3, sheet.getLastColumn())).getDisplayValues();
        existing.forEach(function(r) {
          const k = String(r[0] || "");
          if ((k.indexOf("__admin_") === 0 || k.indexOf("__tg_") === 0) && !incomingKeys[k]) {
            preserved.push([k, r[1] || "", r[2] || ""]);
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
