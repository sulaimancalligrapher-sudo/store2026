export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'bank_transfer';
export type CouponDiscountType = 'percent' | 'fixed';
export type SheetsConnectionMode = 'demo' | 'apps_script' | 'service_account';

export interface StoreSettings {
  store_name: string;
  store_tagline: string;
  currency: string;
  default_delivery_fee: number;
  free_shipping_min: number;
  whatsapp: string;
  telegram_username: string;
  bank_name: string;
  bank_account_name: string;
  bank_iban: string;
  cod_enabled: boolean;
  bank_transfer_enabled: boolean;
  announcement_text: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  image_url: string;
  gallery_urls: string[];
  variants: string[];
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface CityZone {
  id: string;
  name: string;
  delivery_fee: number;
  estimated_days: string;
  free_shipping_min: number | null;
  is_active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  expires_at: string;
  is_active: boolean;
}

export interface OrderItem {
  product_id: string;
  name: string;
  sku: string;
  variant: string;
  qty: number;
  unit_price: number;
  line_total: number;
  image_url: string;
}

export interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  telegram_username: string;
  payment_method: PaymentMethod;
  bank_reference: string;
  coupon_code: string;
  discount_amount: number;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  notes: string;
}

export interface StoreBootstrapData {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  banners: Banner[];
  cities: CityZone[];
  mode: SheetsConnectionMode;
}

export interface IntegrationStatus {
  sheetsMode: SheetsConnectionMode;
  appsScriptConfigured: boolean;
  appsScriptUrlMasked: string;
  serviceAccountConfigured: boolean;
  sheetIdMasked: string;
  serviceAccountEmailMasked: string;
  telegramConfigured: boolean;
  telegramBotMasked: string;
  telegramChatIdMasked: string;
  telegramWebhookSecretConfigured: boolean;
  hasEnvAdminPassword: boolean;
  hasClaimedAdminPassword: boolean;
  adminUsername: string;
  hasFileAppsScriptUrl: boolean;
}

export interface SheetSchemaTab {
  tabName: string;
  titleAr: string;
  descriptionAr: string;
  columns: { name: string; type: string; note: string }[];
}
