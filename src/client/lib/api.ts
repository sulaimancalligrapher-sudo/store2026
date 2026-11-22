import type {
  Banner,
  Category,
  CityZone,
  Coupon,
  IntegrationStatus,
  Order,
  OrderStatus,
  Product,
  SheetSchemaTab,
  SheetsConnectionMode,
  StoreBootstrapData,
  StoreSettings,
} from '../../shared/types.ts';

export interface AdminOverviewResponse {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  banners: Banner[];
  cities: CityZone[];
  coupons: Coupon[];
  orders: Order[];
  integrationStatus: IntegrationStatus;
  schemaTabs: SheetSchemaTab[];
  appsScriptTemplate: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const storeApi = {
  bootstrap: () => requestJson<StoreBootstrapData>('/api/store/bootstrap'),
  validateCoupon: (code: string, subtotal: number) =>
    requestJson<{
      ok: boolean;
      code: string;
      discount_type: 'percent' | 'fixed';
      discount_value: number;
      discount_amount: number;
    }>('/api/store/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    }),
  createOrder: (payload: {
    customer_name: string;
    customer_phone: string;
    customer_city: string;
    customer_address: string;
    telegram_username: string;
    payment_method: 'cod' | 'bank_transfer';
    bank_reference: string;
    coupon_code: string;
    notes: string;
    items: { product_id: string; qty: number; variant: string }[];
  }) =>
    requestJson<{ ok: boolean; order: Order; telegramNotified: boolean }>('/api/store/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  trackOrder: (orderId: string, phone: string) =>
    requestJson<{ ok: boolean; order: Order }>(
      `/api/store/orders/${encodeURIComponent(orderId)}?phone=${encodeURIComponent(phone)}`
    ),
};

export function createAdminApi(token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    overview: () => requestJson<AdminOverviewResponse>('/api/admin/overview', { headers }),
    updateIntegrations: (payload: {
      sheetsMode?: SheetsConnectionMode;
      appsScriptUrl?: string;
      appsScriptSecret?: string;
      sheetId?: string;
      serviceAccountEmail?: string;
      serviceAccountPrivateKey?: string;
      telegramBotToken?: string;
      telegramAdminChatId?: string;
      telegramWebhookSecret?: string;
    }) =>
      requestJson<{ ok: boolean; integrationStatus: IntegrationStatus }>('/api/admin/integrations/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
    testSheets: () =>
      requestJson<{ ok: boolean; mode: string; isDemo?: boolean; message: string; tabsFound?: string[]; productCount?: number }>(
        '/api/admin/sheets/test',
        { method: 'POST', headers }
      ),
    initSheets: (seedSampleData = true) =>
      requestJson<{ ok: boolean; message: string }>('/api/admin/sheets/init', {
        method: 'POST',
        headers,
        body: JSON.stringify({ seedSampleData }),
      }),
    testTelegram: () =>
      requestJson<{ ok: boolean; message: string }>('/api/admin/telegram/test', {
        method: 'POST',
        headers,
      }),
    setTelegramWebhook: (webhookUrl: string) =>
      requestJson<{ ok: boolean; message: string }>('/api/admin/telegram/webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify({ webhookUrl }),
      }),
    saveProduct: (product: Partial<Product>, isEdit = false) =>
      requestJson<{ ok: boolean; product: Product }>(
        isEdit && product.id ? `/api/admin/products/${encodeURIComponent(product.id)}` : '/api/admin/products',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(product),
        }
      ),
    deleteProduct: (id: string) =>
      requestJson<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }),
    saveCategory: (cat: Partial<Category>) =>
      requestJson<{ ok: boolean; category: Category }>('/api/admin/categories', {
        method: 'POST',
        headers,
        body: JSON.stringify(cat),
      }),
    deleteCategory: (id: string) =>
      requestJson<{ ok: boolean }>(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }),
    saveBanner: (banner: Partial<Banner>) =>
      requestJson<{ ok: boolean; banner: Banner }>('/api/admin/banners', {
        method: 'POST',
        headers,
        body: JSON.stringify(banner),
      }),
    deleteBanner: (id: string) =>
      requestJson<{ ok: boolean }>(`/api/admin/banners/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }),
    saveCity: (city: Partial<CityZone>) =>
      requestJson<{ ok: boolean; city: CityZone }>('/api/admin/cities', {
        method: 'POST',
        headers,
        body: JSON.stringify(city),
      }),
    deleteCity: (id: string) =>
      requestJson<{ ok: boolean }>(`/api/admin/cities/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }),
    saveCoupon: (coupon: Partial<Coupon>) =>
      requestJson<{ ok: boolean; coupon: Coupon }>('/api/admin/coupons', {
        method: 'POST',
        headers,
        body: JSON.stringify(coupon),
      }),
    deleteCoupon: (id: string) =>
      requestJson<{ ok: boolean }>(`/api/admin/coupons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }),
    updateOrderStatus: (id: string, status: OrderStatus, notes?: string) =>
      requestJson<{ ok: boolean; order: Order }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, notes }),
      }),
    saveSettings: (settings: StoreSettings) =>
      requestJson<{ ok: boolean; settings: StoreSettings }>('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings),
      }),
    updateCredentials: (currentPassword: string, newUsername: string, newPassword: string) =>
      requestJson<{ ok: boolean; token: string }>('/api/admin/auth/credentials', {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPassword, newUsername, newPassword }),
      }),
  };
}

export const authApi = {
  status: () =>
    requestJson<{
      hasEnvAdminPassword: boolean;
      hasClaimedAdminPassword: boolean;
      needsInitialSetup: boolean;
      defaultUsername: string;
    }>('/api/admin/auth-status'),
  setup: (username: string, password: string) =>
    requestJson<{ ok: boolean; token: string }>('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    requestJson<{ ok: boolean; token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};
