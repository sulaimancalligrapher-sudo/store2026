export type ProductType = 'physical' | 'digital';

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'contact' | 'transfer' | 'online';

export type PaymentStatus = 'await_contact' | 'pending' | 'paid' | 'failed';

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  currency: string;
  deliveryFee: number;
  freeShippingOver: number;
  announcement: string;
  whatsapp: string;
  telegramUsername: string;
  botUsername: string;
  transferInfo: string;
  isOpen: boolean;
  contactPayEnabled: boolean;
  onlinePayEnabled: boolean;
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
  sort: number;
  active: boolean;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  sort: number;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  categoryId: string;
  type: ProductType;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number; // -1 means unlimited (digital products)
  images: string[];
  previewMedia: string;
  digitalDeliveryUrl: string;
  sort: number;
  active: boolean;
}

export type PublicProduct = Omit<Product, 'digitalDeliveryUrl'> & {
  hasDigitalContent: boolean;
};

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productType: ProductType;
  productName: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface Order {
  orderId: string;
  token: string;
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  notes: string;
  hasPhysical: boolean;
  hasDigital: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderStatus: OrderStatus;
  stockDeducted: boolean;
  customerTelegramChatId: string;
  items: OrderItem[];
}
