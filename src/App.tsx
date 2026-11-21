import { useCallback, useEffect, useState } from 'react';
import { CartDrawer } from './components/CartDrawer';
import { Header } from './components/Header';
import { OfflineNotice, PWAInstallButton } from './components/MediaElements';
import { loadCart, saveCart } from './lib/storage';
import { AdminPage } from './pages/AdminPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderPage } from './pages/OrderPage';
import { ProductPage } from './pages/ProductPage';
import type {
  CartItem,
  PublicProduct,
  StoreCatalogResponse,
  StoreSettings,
} from './types';

const FALLBACK_SETTINGS: StoreSettings = {
  storeName: 'مِداد',
  tagline: 'أدوات الخط العربي الأصيلة والمناهج التعليمية المتدرجة',
  logoUrl: '/icon.svg',
  primaryColor: '#0F4C3F',
  currency: 'ر.س',
  deliveryFee: 25,
  freeShippingOver: 250,
  announcement: '',
  whatsapp: '',
  telegramUsername: '',
  botUsername: '',
  transferInfo: '',
  isOpen: true,
  contactPayEnabled: true,
  onlinePayEnabled: false,
};

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [catalog, setCatalog] = useState<StoreCatalogResponse>({
    settings: FALLBACK_SETTINGS,
    categories: [],
    banners: [],
    products: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartItem[]>(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);

  const navigate = useCallback((nextPath: string) => {
    if (nextPath !== window.location.pathname) {
      window.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/store');
      if (!res.ok) throw new Error('Store load error');
      const data = (await res.json()) as StoreCatalogResponse;
      setCatalog(data);
    } catch {
      setLoadError('تعذر تحميل المنتجات حالياً، يرجى تحديث الصفحة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    if (catalog.settings.storeName) {
      document.title = `${catalog.settings.storeName} — أدوات الخط والمناهج التعليمية`;
    }
  }, [catalog.settings.storeName]);

  const handleAddToCart = (product: PublicProduct, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      const maxStock =
        product.type === 'physical' && product.stock >= 0 ? product.stock : 50;
      if (existing) {
        const nextQty = Math.min(maxStock, existing.qty + qty);
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: nextQty } : item,
        );
      }
      return [...prev, { productId: product.id, qty: Math.min(maxStock, qty) }];
    });
    setCartOpen(true);
  };

  const handleUpdateQty = (productId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qty: nextQty } : item,
      ),
    );
  };

  const handleRemoveCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const productMatch = /^\/p\/([^/]+)$/.exec(path);
  const orderMatch = /^\/o\/([^/]+)$/.exec(path);

  const renderPage = () => {
    if (loading && catalog.products.length === 0) {
      return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center text-sm text-[#5F5C54]">
          جاري تجهيز المتجر...
        </div>
      );
    }

    if (loadError && catalog.products.length === 0) {
      return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
          <p className="text-base font-medium text-[#1A1A18]">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchCatalog()}
            className="px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    if (productMatch) {
      const productId = decodeURIComponent(productMatch[1]);
      const product = catalog.products.find((p) => p.id === productId);
      return (
        <ProductPage
          product={product}
          categories={catalog.categories}
          settings={catalog.settings}
          onNavigate={navigate}
          onAddToCart={handleAddToCart}
        />
      );
    }

    if (path === '/checkout') {
      return (
        <CheckoutPage
          items={cart}
          products={catalog.products}
          settings={catalog.settings}
          onNavigate={navigate}
          onClearCart={() => setCart([])}
        />
      );
    }

    if (orderMatch) {
      const token = decodeURIComponent(orderMatch[1]);
      return <OrderPage token={token} onNavigate={navigate} />;
    }

    if (path === '/orders') {
      return <MyOrdersPage onNavigate={navigate} />;
    }

    if (path === '/admin') {
      return <AdminPage onCatalogUpdated={fetchCatalog} />;
    }

    return (
      <HomePage
        settings={catalog.settings}
        categories={catalog.categories}
        banners={catalog.banners}
        products={catalog.products}
        onNavigate={navigate}
        onAddToCart={(p) => handleAddToCart(p, 1)}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#1A1A18]">
      <Header
        settings={catalog.settings}
        cartCount={cartCount}
        currentPath={path}
        onNavigate={navigate}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="flex-1">{renderPage()}</div>

      <footer className="border-t border-[#E5E0D5] bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold text-[#1A1A18]">
              {catalog.settings.storeName}
            </p>
            <p className="text-xs text-[#5F5C54] mt-1">{catalog.settings.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href="/orders"
              onClick={(e) => {
                e.preventDefault();
                navigate('/orders');
              }}
              className="text-[#5F5C54] hover:text-[#1A1A18]"
            >
              متابعة طلباتي
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigate('/admin');
              }}
              className="text-[#5F5C54] hover:text-[#1A1A18]"
            >
              الإعدادات والإدارة
            </a>
            {catalog.settings.whatsapp && (
              <a
                href={`https://wa.me/${catalog.settings.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5F5C54] hover:text-[#1A1A18]"
              >
                تواصل واتساب
              </a>
            )}
            <PWAInstallButton variant="footer" />
          </div>
        </div>
      </footer>

      <CartDrawer
        isOpen={cartOpen}
        items={cart}
        products={catalog.products}
        settings={catalog.settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemoveCart}
        onCheckout={() => {
          setCartOpen(false);
          navigate('/checkout');
        }}
      />

      <OfflineNotice />
    </div>
  );
}
