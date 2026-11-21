import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Edit3,
  FolderKanban,
  Lock,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Trash2,
} from 'lucide-react';
import type { OrderStatus, Product } from '../../shared/types.ts';
import { authApi, createAdminApi, type AdminOverviewResponse } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { ProductFormModal } from './ProductFormModal.tsx';
import { SettingsConnectionsTab } from './SettingsConnectionsTab.tsx';

type AdminTab = 'overview' | 'products' | 'orders' | 'catalog' | 'marketing' | 'settings';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

interface AdminPanelProps {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onCatalogUpdated: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  onTokenChange,
  onCatalogUpdated,
}) => {
  const [authChecking, setAuthChecking] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Products state
  const [productQuery, setProductQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);

  // Orders filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');

  // Category quick form
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState('/src/assets/images/product_wireless_headphones_1795253790126.jpg');

  // Banner quick form
  const [banTitle, setBanTitle] = useState('');
  const [banSubtitle, setBanSubtitle] = useState('');
  const [banImage, setBanImage] = useState('/src/assets/images/hero_nukhba_banner_1795253789582.jpg');

  // City quick form
  const [cityName, setCityName] = useState('');
  const [cityFee, setCityFee] = useState('20');
  const [cityDays, setCityDays] = useState('1 - 2 يوم عمل');
  const [cityFreeMin, setCityFreeMin] = useState('400');

  // Coupon quick form
  const [cpnCode, setCpnCode] = useState('');
  const [cpnType, setCpnType] = useState<'percent' | 'fixed'>('percent');
  const [cpnVal, setCpnVal] = useState('15');
  const [cpnMin, setCpnMin] = useState('150');
  const [cpnMaxUses, setCpnMaxUses] = useState('100');
  const [cpnExpires, setCpnExpires] = useState('2027-12-31');

  const api = useMemo(() => (token ? createAdminApi(token) : null), [token]);

  useEffect(() => {
    authApi
      .status()
      .then((st) => setNeedsInitialSetup(st.needsInitialSetup))
      .catch(() => undefined)
      .finally(() => setAuthChecking(false));
  }, []);

  const loadOverview = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.overview();
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل البيانات';
      setErrorMsg(msg);
      if (msg.includes('تسجيل الدخول') || msg.includes('منتهية')) {
        onTokenChange(null);
      }
    } finally {
      setLoading(false);
    }
  }, [api, onTokenChange]);

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token, loadOverview]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const res = needsInitialSetup
        ? await authApi.setup(passwordInput)
        : await authApi.login(passwordInput);
      onTokenChange(res.token);
      setNeedsInitialSetup(false);
      setPasswordInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setAuthBusy(false);
    }
  };

  const refreshAll = async () => {
    await loadOverview();
    onCatalogUpdated();
  };

  if (!token) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#141413]">
                {needsInitialSetup ? 'إعداد كلمة مرور لوحة التحكم' : 'دخول لوحة تحكم التاجر'}
              </h1>
              <p className="text-xs text-[#6E6A63]">
                {needsInitialSetup
                  ? 'أول تشغيل: أنشئ كلمة مرور لحماية لوحة التحكم والإعدادات (6 أحرف فأكثر).'
                  : 'أدخل كلمة مرور الإدارة للوصول إلى المنتجات والطلبات وإعدادات Google Sheets.'}
              </p>
            </div>
          </div>

          {authChecking ? (
            <p className="text-sm text-[#6E6A63]">جاري التحقق...</p>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                  {authError}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#44413C]">كلمة المرور</label>
                <input
                  required
                  type="password"
                  minLength={needsInitialSetup ? 6 : 1}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-lg bg-[#141413] py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
              >
                {authBusy ? 'جاري التحقق...' : needsInitialSetup ? 'حفظ كلمة المرور والدخول' : 'تسجيل الدخول'}
              </button>
              {needsInitialSetup && (
                <p className="text-[11px] text-[#6E6A63] leading-relaxed">
                  ملاحظة للنشر على Vercel: أضف متغير البيئة <span className="font-mono-num">ADMIN_PASSWORD</span> في لوحة Vercel لضمان ثبات كلمة المرور عبر جميع الطلبات السحابية.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    );
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[#6E6A63]">
        جاري تحميل بيانات لوحة التحكم من Google Sheets...
      </div>
    );
  }

  if (!data || !api) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMsg || 'تعذر تحميل بيانات الإدارة.'}
        </div>
        <button
          type="button"
          onClick={loadOverview}
          className="rounded-lg bg-[#141413] px-4 py-2 text-sm text-white cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const currency = data.settings.currency || 'ر.س';
  const validOrders = data.orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = data.orders.filter((o) => o.status === 'pending').length;
  const lowStockProducts = data.products.filter((p) => p.stock <= 5);

  const filteredProducts = data.products.filter(
    (p) =>
      !productQuery.trim() ||
      p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(productQuery.toLowerCase())
  );

  const filteredOrders =
    orderStatusFilter === 'all' ? data.orders : data.orders.filter((o) => o.status === orderStatusFilter);

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'products', label: `المنتجات (${data.products.length})`, icon: <Package className="h-4 w-4" /> },
    { id: 'orders', label: `الطلبات (${data.orders.length})`, icon: <ShoppingCart className="h-4 w-4" /> },
    { id: 'catalog', label: 'الأقسام والبانرات', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'marketing', label: 'الكوبونات والمدن', icon: <Tag className="h-4 w-4" /> },
    { id: 'settings', label: 'الإعدادات والربط', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#141413]">لوحة إدارة {data.settings.store_name}</h1>
          <p className="text-xs text-[#6E6A63] mt-0.5">
            مصدر البيانات:{' '}
            <span className="font-semibold text-[#141413]">
              {data.integrationStatus.sheetsMode === 'apps_script'
                ? 'Google Sheets (Apps Script)'
                : data.integrationStatus.sheetsMode === 'service_account'
                  ? 'Google Sheets (Service Account)'
                  : 'وضع المعاينة التجريبي'}
            </span>
            {' · '}
            إشعارات تيليجرام:{' '}
            <span className={data.integrationStatus.telegramConfigured ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
              {data.integrationStatus.telegramConfigured ? 'مفعّلة' : 'غير مفعّلة'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>مزامنة</span>
          </button>
          <button
            type="button"
            onClick={() => onTokenChange(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#6E6A63] hover:text-red-700 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#F3F1EC] p-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === item.id ? 'bg-white text-[#141413] shadow-sm' : 'text-[#6E6A63] hover:text-[#141413]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">إجمالي المبيعات المؤكدة</p>
              <p className="mt-2 text-2xl font-bold text-[#141413] tabular-nums">
                {totalRevenue} {currency}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">إجمالي الطلبات</p>
              <p className="mt-2 text-2xl font-bold text-[#141413] tabular-nums">{data.orders.length}</p>
            </div>
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">طلبات بانتظار المراجعة</p>
              <p className="mt-2 text-2xl font-bold text-[#B45309] tabular-nums">{pendingOrders}</p>
            </div>
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">منتجات قارب مخزونها على النفاد</p>
              <p className="mt-2 text-2xl font-bold text-[#141413] tabular-nums">{lowStockProducts.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#141413]">أحدث الطلبات</h2>
                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className="text-xs font-semibold text-[#B45309] cursor-pointer"
                >
                  عرض الكل
                </button>
              </div>
              {data.orders.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between border-b border-[#E5E2DC] pb-3 last:border-0 last:pb-0 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#141413]">
                      {o.customer_name} · <span className="font-mono-num text-xs text-[#6E6A63]">{o.id}</span>
                    </p>
                    <p className="text-xs text-[#6E6A63]">
                      {o.customer_city} · {STATUS_LABELS[o.status]}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-[#141413]">
                    {o.total} {currency}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#141413] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                  <span>تنبيهات المخزون المنخفض (5 أو أقل)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('products')}
                  className="text-xs font-semibold text-[#B45309] cursor-pointer"
                >
                  إدارة المخزون
                </button>
              </div>
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-[#6E6A63]">جميع المنتجات تتوفر بكميات جيدة.</p>
              ) : (
                lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b border-[#E5E2DC] pb-2.5 last:border-0 last:pb-0 text-sm"
                  >
                    <span className="font-medium text-[#141413]">{p.name}</span>
                    <span className="font-mono-num font-bold text-red-700">المتبقي: {p.stock}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Products & Add Product */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A847B]" />
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="ابحث باسم المنتج أو رمز SKU..."
                className="w-full rounded-lg border border-[#E5E2DC] bg-white pr-9 pl-4 py-2.5 text-sm focus:border-[#141413] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة منتج جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E5E2DC] bg-white">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#FAF9F6] text-xs text-[#6E6A63] border-b border-[#E5E2DC]">
                <tr>
                  <th className="px-4 py-3 font-semibold">المنتج</th>
                  <th className="px-4 py-3 font-semibold">القسم</th>
                  <th className="px-4 py-3 font-semibold">السعر</th>
                  <th className="px-4 py-3 font-semibold">المخزون</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredProducts.map((p) => {
                  const cat = data.categories.find((c) => c.id === p.category_id);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF9F6]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 shrink-0 overflow-hidden rounded-md border border-[#E5E2DC]">
                            <SafeImage src={p.image_url} alt={p.name} aspectClass="aspect-[4/3]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#141413]">{p.name}</p>
                            <p className="text-xs text-[#6E6A63] font-mono-num">{p.sku || p.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#44413C]">{cat?.name || '-'}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-[#141413]">
                        {p.price} {currency}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        <span className={p.stock <= 5 ? 'text-red-700' : 'text-[#141413]'}>{p.stock}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.saveProduct({ ...p, is_active: !p.is_active }, true);
                            await refreshAll();
                          }}
                          className={`font-semibold cursor-pointer ${
                            p.is_active ? 'text-emerald-700' : 'text-[#8A847B]'
                          }`}
                        >
                          {p.is_active ? 'ظاهر' : 'مخفي'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="rounded-lg border border-[#E5E2DC] p-1.5 text-[#44413C] hover:text-[#141413] cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteProduct(p.id);
                              await refreshAll();
                            }}
                            className="rounded-lg border border-[#E5E2DC] p-1.5 text-[#6E6A63] hover:text-red-700 cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Orders */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setOrderStatusFilter(st)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  orderStatusFilter === st
                    ? 'border-[#141413] bg-[#141413] text-white'
                    : 'border-[#E5E2DC] bg-white text-[#44413C]'
                }`}
              >
                {st === 'all' ? 'الكل' : STATUS_LABELS[st]}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E2DC] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-base font-bold text-[#141413]">{order.id}</span>
                      <span className="text-xs text-[#6E6A63]">
                        · {new Date(order.created_at).toLocaleString('ar-SA')}
                      </span>
                    </div>
                    <p className="text-sm text-[#44413C] mt-1">
                      <strong>{order.customer_name}</strong> · {order.customer_phone} · {order.customer_city}
                    </p>
                    <p className="text-xs text-[#6E6A63] mt-0.5">{order.customer_address}</p>
                    {order.telegram_username && (
                      <p className="text-xs text-[#0088cc] mt-0.5">تيليجرام: {order.telegram_username}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={order.status}
                      onChange={async (e) => {
                        await api.updateOrderStatus(order.id, e.target.value as OrderStatus);
                        await refreshAll();
                      }}
                      className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#141413] focus:outline-none"
                    >
                      {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-[#44413C]">
                  {order.items.map((item, idx) => (
                    <div key={`${item.product_id}-${idx}`} className="flex justify-between">
                      <span>
                        {item.name} {item.variant ? `(${item.variant})` : ''} × {item.qty}
                      </span>
                      <span className="tabular-nums font-semibold text-[#141413]">
                        {item.line_total} {currency}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2DC] pt-3 text-xs">
                  <span className="text-[#6E6A63]">
                    {order.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}
                    {order.bank_reference ? ` (مرجع: ${order.bank_reference})` : ''}
                    {order.coupon_code ? ` · كوبون: ${order.coupon_code} (-${order.discount_amount})` : ''}
                    {order.notes ? ` · ملاحظة: ${order.notes}` : ''}
                  </span>
                  <span className="text-sm font-bold text-[#141413] tabular-nums">
                    الإجمالي: {order.total} {currency} (توصيل: {order.delivery_fee})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Categories & Banners */}
      {tab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-[#141413]">إدارة الأقسام</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catName.trim()) return;
                await api.saveCategory({ name: catName.trim(), image_url: catImage.trim(), sort_order: data.categories.length + 1 });
                setCatName('');
                await refreshAll();
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="اسم القسم الجديد"
                className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                إضافة قسم
              </button>
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-semibold text-[#141413]">{c.name}</span>
                    <span className="mr-2 font-mono-num text-xs text-[#6E6A63]">{c.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteCategory(c.id);
                      await refreshAll();
                    }}
                    className="text-[#8A847B] hover:text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Banners */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-[#141413]">إدارة البانرات الترويجية</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!banTitle.trim()) return;
                await api.saveBanner({
                  title: banTitle.trim(),
                  subtitle: banSubtitle.trim(),
                  image_url: banImage.trim(),
                });
                setBanTitle('');
                setBanSubtitle('');
                await refreshAll();
              }}
              className="space-y-2.5"
            >
              <input
                required
                value={banTitle}
                onChange={(e) => setBanTitle(e.target.value)}
                placeholder="عنوان البانر"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:outline-none"
              />
              <input
                value={banSubtitle}
                onChange={(e) => setBanSubtitle(e.target.value)}
                placeholder="النص التوضيحي للبانر"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={banImage}
                  onChange={(e) => setBanImage(e.target.value)}
                  placeholder="رابط صورة البانر (16:9)"
                  className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  إضافة بانر
                </button>
              </div>
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.banners.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#141413]">{b.title}</p>
                    <p className="text-xs text-[#6E6A63] line-clamp-1">{b.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteBanner(b.id);
                      await refreshAll();
                    }}
                    className="text-[#8A847B] hover:text-red-700 p-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Coupons & Cities */}
      {tab === 'marketing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coupons */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#B45309]" />
              <h2 className="text-base font-bold text-[#141413]">كوبونات الخصم (ورقة Coupons)</h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await api.saveCoupon({
                  code: cpnCode.trim().toUpperCase(),
                  discount_type: cpnType,
                  discount_value: Number(cpnVal),
                  min_order: Number(cpnMin),
                  max_uses: Number(cpnMaxUses),
                  expires_at: cpnExpires,
                });
                setCpnCode('');
                await refreshAll();
              }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
            >
              <input
                required
                value={cpnCode}
                onChange={(e) => setCpnCode(e.target.value.toUpperCase())}
                placeholder="الكود (SAVE20)"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num uppercase focus:outline-none"
              />
              <select
                value={cpnType}
                onChange={(e) => setCpnType(e.target.value as 'percent' | 'fixed')}
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs focus:outline-none"
              >
                <option value="percent">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت ({currency})</option>
              </select>
              <input
                required
                type="number"
                value={cpnVal}
                onChange={(e) => setCpnVal(e.target.value)}
                placeholder="القيمة"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs tabular-nums focus:outline-none"
              />
              <input
                type="number"
                value={cpnMin}
                onChange={(e) => setCpnMin(e.target.value)}
                placeholder="الحد الأدنى"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs tabular-nums focus:outline-none"
              />
              <input
                type="date"
                value={cpnExpires}
                onChange={(e) => setCpnExpires(e.target.value)}
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#141413] px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                إضافة كوبون
              </button>
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <span className="font-mono-num text-sm font-bold text-[#141413]">{c.code}</span>
                    <span className="mr-2 text-[#44413C]">
                      خصم {c.discount_value}
                      {c.discount_type === 'percent' ? '%' : ` ${currency}`} · حد أدنى {c.min_order} · استخدام{' '}
                      {c.used_count}/{c.max_uses}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteCoupon(c.id);
                      await refreshAll();
                    }}
                    className="text-[#8A847B] hover:text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#B45309]" />
              <h2 className="text-base font-bold text-[#141413]">تسعيرة التوصيل حسب المدينة (ورقة Cities)</h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await api.saveCity({
                  name: cityName.trim(),
                  delivery_fee: Number(cityFee),
                  estimated_days: cityDays.trim(),
                  free_shipping_min: cityFreeMin ? Number(cityFreeMin) : null,
                });
                setCityName('');
                await refreshAll();
              }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              <input
                required
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="اسم المدينة"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs focus:outline-none"
              />
              <input
                required
                type="number"
                value={cityFee}
                onChange={(e) => setCityFee(e.target.value)}
                placeholder="سعر التوصيل"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs tabular-nums focus:outline-none"
              />
              <input
                value={cityDays}
                onChange={(e) => setCityDays(e.target.value)}
                placeholder="المدة (24 ساعة)"
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#141413] px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                إضافة مدينة
              </button>
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.cities.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <span className="text-sm font-bold text-[#141413]">{c.name}</span>
                    <span className="mr-2 text-[#44413C] tabular-nums">
                      التوصيل: {c.delivery_fee} {currency} · {c.estimated_days}
                      {c.free_shipping_min ? ` · مجاني فوق ${c.free_shipping_min}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteCity(c.id);
                      await refreshAll();
                    }}
                    className="text-[#8A847B] hover:text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Settings & Connections */}
      {tab === 'settings' && (
        <SettingsConnectionsTab
          api={api}
          settings={data.settings}
          integrationStatus={data.integrationStatus}
          schemaTabs={data.schemaTabs}
          appsScriptTemplate={data.appsScriptTemplate}
          onRefresh={refreshAll}
        />
      )}

      {/* Product Add/Edit Modal */}
      {editingProduct !== undefined && (
        <ProductFormModal
          initial={editingProduct}
          categories={data.categories}
          currency={currency}
          onSave={async (payload, isEdit) => {
            await api.saveProduct(payload, isEdit);
            await refreshAll();
          }}
          onClose={() => setEditingProduct(undefined)}
        />
      )}
    </section>
  );
};
