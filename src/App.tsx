/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { Order, Product, StoreBootstrapData } from './shared/types.ts';
import { storeApi } from './client/lib/api.ts';
import { StorefrontView } from './client/shop/StorefrontView.tsx';
import { ProductModal } from './client/shop/ProductModal.tsx';
import { CartCheckoutDrawer, type CartEntry } from './client/shop/CartCheckoutDrawer.tsx';
import { OrdersTrackingView } from './client/shop/OrdersTrackingView.tsx';
import { AdminPanel } from './client/admin/AdminPanel.tsx';
import { OfflineIndicator } from './client/components/PWAControls.tsx';

type ActiveRoute = 'shop' | 'orders' | 'admin';

const CART_STORAGE_KEY = 'nukhba_cart_v1';
const ORDERS_STORAGE_KEY = 'nukhba_my_orders_v1';
const FAV_STORAGE_KEY = 'nukhba_favorites_v1';

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return 'admin';
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/orders')) return 'orders';
    return 'shop';
  });

  const [storeData, setStoreData] = useState<StoreBootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Admin token held strictly in memory
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [savedOrders, setSavedOrders] = useState<Order[]>(() => {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const fetchBootstrap = useCallback(async () => {
    setLoadError('');
    try {
      const data = await storeApi.bootstrap();
      setStoreData(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل بيانات المتجر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
    // Initialize Telegram Mini App viewport if running inside Telegram
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } })
      .Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
  }, [fetchBootstrap]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(savedOrders));
    } catch {
      // ignore
    }
  }, [savedOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const navigate = (nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    const nextPath = nextRoute === 'shop' ? '/' : `/${nextRoute}`;
    window.history.pushState({}, '', nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname.startsWith('/admin')) setRoute('admin');
      else if (window.location.pathname.startsWith('/orders')) setRoute('orders');
      else setRoute('shop');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 2600);
  };

  const addToCart = (product: Product, qty: number, variant: string) => {
    const key = `${product.id}::${variant}`;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: Math.min(product.stock, i.qty + qty) } : i
        );
      }
      return [...prev, { key, product, variant, qty }];
    });
    showToast(`تمت إضافة "${product.name}" إلى السلة`);
  };

  const updateCartQty = (key: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.key !== key));
      return;
    }
    setCartItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty } : i)));
  };

  const removeCartItem = (key: string) => {
    setCartItems((prev) => prev.filter((i) => i.key !== key));
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const upsertSavedOrder = (order: Order) => {
    setSavedOrders((prev) => {
      const exists = prev.some((o) => o.id === order.id);
      if (exists) return prev.map((o) => (o.id === order.id ? order : o));
      return [order, ...prev];
    });
  };

  const totalCartCount = new Set(cartItems.map((i) => i.product.id)).size;

  if (loading && !storeData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] text-sm text-[#6E6A63]">
        جاري تجهيز المتجر...
      </div>
    );
  }

  if (loadError && !storeData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] px-4 text-center space-y-4">
        <p className="text-base font-semibold text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={fetchBootstrap}
          className="rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!storeData) return null;

  if (route === 'admin') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#141413]">
        <AdminPanel
          token={adminToken}
          onTokenChange={setAdminToken}
          onCatalogUpdated={fetchBootstrap}
          onBackToStore={() => navigate('shop')}
        />
        <OfflineIndicator />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#141413]">
      {/* Slim Dismissible Announcement Bar */}
      {!bannerDismissed && storeData.settings.announcement_text && (
        <div className="bg-[#141413] text-[#FAF9F6] text-xs px-4 py-2 flex items-center justify-between gap-4">
          <span className="mx-auto truncate">{storeData.settings.announcement_text}</span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-[#B8B2A8] hover:text-white shrink-0 cursor-pointer"
            aria-label="إخفاء الشريط"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E5E2DC] bg-[#FAF9F6]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5">
          {/* Zone 1: Single text brand wordmark */}
          <button
            type="button"
            onClick={() => navigate('shop')}
            className="font-display text-xl font-extrabold tracking-tight text-[#141413] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {storeData.settings.store_name}
          </button>

          {/* Zone 2: Clean text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6E6A63]">
            <button
              type="button"
              onClick={() => navigate('shop')}
              className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'shop' ? 'text-[#141413] underline underline-offset-8' : ''
              }`}
            >
              الرئيسية
            </button>
            <a
              href="#catalog"
              onClick={() => {
                if (route !== 'shop') navigate('shop');
              }}
              className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
            >
              المنتجات
            </a>
            <button
              type="button"
              onClick={() => navigate('orders')}
              className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'orders' ? 'text-[#141413] underline underline-offset-8' : ''
              }`}
            >
              طلباتي
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>السلة</span>
              <span className="tabular-nums">({totalCartCount})</span>
            </button>
          </div>
        </div>

        {/* Mobile Secondary Nav */}
        <div className="flex md:hidden items-center justify-around border-t border-[#E5E2DC] px-2 py-2 text-xs font-semibold text-[#6E6A63]">
          <button
            type="button"
            onClick={() => navigate('shop')}
            className={`px-2 py-1 whitespace-nowrap ${route === 'shop' ? 'text-[#141413]' : ''}`}
          >
            المتجر
          </button>
          <button
            type="button"
            onClick={() => navigate('orders')}
            className={`px-2 py-1 whitespace-nowrap ${route === 'orders' ? 'text-[#141413]' : ''}`}
          >
            طلباتي
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {route === 'shop' && (
          <StorefrontView
            data={storeData}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onSelectProduct={(p) => setSelectedProduct(p)}
            onQuickAdd={(p) => addToCart(p, 1, p.variants[0] || '')}
          />
        )}

        {route === 'orders' && (
          <OrdersTrackingView
            savedOrders={savedOrders}
            settings={storeData.settings}
            onUpdateSavedOrder={upsertSavedOrder}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-[#E5E2DC] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-[#6E6A63]">
          <p>
            © {new Date().getFullYear()} {storeData.settings.store_name} — مدعوم بـ Google Sheets وتيليجرام
          </p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => navigate('shop')} className="hover:text-[#141413] cursor-pointer">
              المتجر
            </button>
            <button type="button" onClick={() => navigate('orders')} className="hover:text-[#141413] cursor-pointer">
              تتبع الطلب
            </button>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          category={storeData.categories.find((c) => c.id === selectedProduct.category_id)}
          settings={storeData.settings}
          isFavorite={favorites.includes(selectedProduct.id)}
          onToggleFavorite={toggleFavorite}
          onAddToCart={addToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Slide-over Cart & Checkout Drawer */}
      <CartCheckoutDrawer
        open={cartOpen}
        items={cartItems}
        cities={storeData.cities}
        settings={storeData.settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onRemoveItem={removeCartItem}
        onClearCart={() => setCartItems([])}
        onOrderCreated={(order) => {
          upsertSavedOrder(order);
          fetchBootstrap();
        }}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-[#141413] px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
