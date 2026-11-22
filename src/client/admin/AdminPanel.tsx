import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Edit3,
  ExternalLink,
  FolderKanban,
  GraduationCap,
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
import type {
  EnrollmentStatus,
  OrderStatus,
  Product,
  TrainingFormat,
  TrainingProgram,
} from '../../shared/types.ts';
import { extractGoogleDriveFileId } from '../../shared/imageUrl.ts';
import { getProductPriceSummary } from '../../shared/variants.ts';
import { ApiError, authApi, createAdminApi, type AdminOverviewResponse } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { ProductFormModal } from './ProductFormModal.tsx';
import { ProgramFormModal } from './ProgramFormModal.tsx';
import { SettingsConnectionsTab } from './SettingsConnectionsTab.tsx';

type AdminTab =
  | 'overview'
  | 'products'
  | 'programs'
  | 'orders'
  | 'catalog'
  | 'marketing'
  | 'settings';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'تم التأكيد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'قيد المراجعة',
  confirmed: 'مقبول ومؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const FORMAT_LABELS: Record<TrainingFormat, string> = {
  online_live: 'عن بُعد مباشر',
  in_person: 'حضوري',
  recorded: 'مسجل بالكامل',
};

interface AdminPanelProps {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onCatalogUpdated: () => void;
  onBackToStore?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  onTokenChange,
  onCatalogUpdated,
  onBackToStore,
}) => {
  const [authChecking, setAuthChecking] = useState(true);
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Products & Programs modals
  const [productQuery, setProductQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null | undefined>(undefined);

  // Orders & Enrollments filters
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [enrollStatusFilter, setEnrollStatusFilter] = useState<'all' | EnrollmentStatus>('all');

  // Category quick form
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState('');

  // Banner quick form
  const [banTitle, setBanTitle] = useState('');
  const [banSubtitle, setBanSubtitle] = useState('');
  const [banImage, setBanImage] = useState('');

  // City quick form
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [cityName, setCityName] = useState('');
  const [cityFee, setCityFee] = useState('20');
  const [cityDays, setCityDays] = useState('1 - 2 يوم عمل');
  const [cityFreeMin, setCityFreeMin] = useState('400');

  // Coupon quick form
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [editingCouponUsedCount, setEditingCouponUsedCount] = useState<number>(0);
  const [cpnCode, setCpnCode] = useState('');
  const [cpnType, setCpnType] = useState<'percent' | 'fixed'>('percent');
  const [cpnVal, setCpnVal] = useState('15');
  const [cpnMin, setCpnMin] = useState('150');
  const [cpnMaxUses, setCpnMaxUses] = useState('100');
  const [cpnExpires, setCpnExpires] = useState('2027-12-31');

  const [marketingFeedback, setMarketingFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const api = useMemo(() => (token ? createAdminApi(token) : null), [token]);

  useEffect(() => {
    authApi
      .status()
      .then((st) => {
        setNeedsInitialSetup(st.needsInitialSetup);
        if (st.defaultUsername) {
          setUsernameInput(st.defaultUsername);
        }
      })
      .catch(() => undefined)
      .finally(() => setAuthChecking(false));
  }, []);

  const handleSessionExpired = useCallback(
    (message: string) => {
      setSessionNotice(message);
      setData(null);
      onTokenChange(null);
      authApi
        .status()
        .then((st) => setNeedsInitialSetup(st.needsInitialSetup))
        .catch(() => undefined);
    },
    [onTokenChange]
  );

  const handleMutationError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        handleSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : fallback);
    },
    [handleSessionExpired]
  );

  const loadOverview = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.overview();
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleSessionExpired('جلسة الإدارة غير صالحة أو منتهية. يرجى تسجيل الدخول مجدداً.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'تعذر تحميل البيانات');
      }
    } finally {
      setLoading(false);
    }
  }, [api, handleSessionExpired]);

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token, loadOverview]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSessionNotice('');
    setAuthBusy(true);
    try {
      const res = needsInitialSetup
        ? await authApi.setup(usernameInput.trim() || 'admin', passwordInput)
        : await authApi.login(usernameInput.trim() || 'admin', passwordInput);
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
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-[#E5E2DC] bg-white p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#141413]">بوابة دخول الإدارة</h1>
              <p className="text-xs text-[#6E6A63]">
                أدخل اسم المستخدم ورقم التسجيل الخاص بالإدارة لفتح لوحة التحكم.
              </p>
            </div>
          </div>

          {authChecking ? (
            <p className="text-sm text-[#6E6A63]">جاري التحقق من حالة الحساب...</p>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {sessionNotice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 leading-relaxed">
                  {sessionNotice}
                </div>
              )}
              {authError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                  {authError}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#44413C]">
                  اسم المستخدم الإداري
                </label>
                <input
                  required
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#44413C]">
                  رقم التسجيل / كلمة المرور
                </label>
                <input
                  required
                  type="password"
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
                {authBusy ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </button>
              <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] p-3 text-[11px] text-[#44413C] leading-relaxed space-y-1">
                <p>
                  <strong>بيانات الدخول الافتراضية الجاهزة:</strong> اسم المستخدم{' '}
                  <span className="font-mono-num font-semibold text-[#141413]">admin</span> · رقم التسجيل{' '}
                  <span className="font-mono-num font-semibold text-[#141413]">123456</span> (إلا إذا تم تعديلهما من ورقة{' '}
                  <span className="font-mono-num font-semibold">Admin</span> في Google Sheets أو من تبويب الإعدادات).
                </p>
              </div>
            </form>
          )}

          {onBackToStore && (
            <div className="border-t border-[#E5E2DC] pt-4 text-center">
              <button
                type="button"
                onClick={onBackToStore}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6A63] hover:text-[#141413] cursor-pointer"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>العودة إلى واجهة المتجر</span>
              </button>
            </div>
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
  const programsList = data.programs || [];
  const enrollmentsList = data.enrollments || [];

  const filteredProducts = data.products.filter(
    (p) =>
      !productQuery.trim() ||
      p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(productQuery.toLowerCase())
  );

  const filteredOrders =
    orderStatusFilter === 'all' ? data.orders : data.orders.filter((o) => o.status === orderStatusFilter);

  const filteredEnrollments =
    enrollStatusFilter === 'all'
      ? enrollmentsList
      : enrollmentsList.filter((e) => e.status === enrollStatusFilter);

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'products', label: `المنتجات (${data.products.length})`, icon: <Package className="h-4 w-4" /> },
    { id: 'programs', label: `البرامج التدريبية (${programsList.length})`, icon: <GraduationCap className="h-4 w-4" /> },
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
            قاعدة البيانات:{' '}
            <span className="font-semibold text-emerald-800">Google Sheets (Apps Script المباشر)</span>
            {' · '}
            إشعارات تيليجرام:{' '}
            <span className={data.integrationStatus.telegramConfigured ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
              {data.integrationStatus.telegramConfigured ? 'مفعّلة' : 'غير مضبوطة'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBackToStore && (
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>عرض المتجر</span>
            </button>
          )}
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

      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

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
              <p className="text-xs text-[#6E6A63]">الطلبات · طلبات بانتظار المراجعة</p>
              <p className="mt-2 text-2xl font-bold text-[#141413] tabular-nums">
                {data.orders.length} <span className="text-sm font-semibold text-[#B45309]">({pendingOrders} جديد)</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">تسجيلات البرامج التدريبية</p>
              <p className="mt-2 text-2xl font-bold text-[#141413] tabular-nums">{enrollmentsList.length}</p>
            </div>
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
              <p className="text-xs text-[#6E6A63]">منتجات بمخزون منخفض (5 أو أقل)</p>
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
                  <th className="px-4 py-3 font-semibold">السعر والخيارات</th>
                  <th className="px-4 py-3 font-semibold">المخزون</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredProducts.map((p) => {
                  const cat = data.categories.find((c) => c.id === p.category_id);
                  const summary = getProductPriceSummary(p);
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
                      <td className="px-4 py-3 tabular-nums text-[#141413]">
                        <span className="font-semibold">
                          {summary.hasRange ? `${summary.minPrice} - ${summary.maxPrice}` : summary.defaultPrice} {currency}
                        </span>
                        {p.variants.length > 0 && (
                          <span className="block text-[11px] text-[#6E6A63]">{p.variants.length} خيارات</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        <span className={p.stock <= 5 ? 'text-red-700' : 'text-[#141413]'}>{p.stock}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.saveProduct({ ...p, is_active: !p.is_active }, true);
                              await refreshAll();
                            } catch (err) {
                              handleMutationError(err, 'تعذر تحديث حالة المنتج');
                            }
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
                              try {
                                await api.deleteProduct(p.id);
                                await refreshAll();
                              } catch (err) {
                                handleMutationError(err, 'تعذر حذف المنتج');
                              }
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

      {/* TAB 3: Training Programs & Enrollments */}
      {tab === 'programs' && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#141413]">البرامج والدورات التدريبية (ورقة Programs)</h2>
                <p className="text-xs text-[#6E6A63]">تظهر مباشرة في قسم «البرامج التدريبية» بواجهة المتجر مع حجز المقاعد.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProgram(null)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة برنامج تدريبي</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E5E2DC] bg-white">
              <table className="w-full text-right text-sm">
                <thead className="bg-[#FAF9F6] text-xs text-[#6E6A63] border-b border-[#E5E2DC]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">البرنامج التدريبي</th>
                    <th className="px-4 py-3 font-semibold">النمط والمدة</th>
                    <th className="px-4 py-3 font-semibold">الرسوم</th>
                    <th className="px-4 py-3 font-semibold">المقاعد المتبقية</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {programsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#6E6A63]">
                        لا توجد برامج تدريبية بعد. أضف برنامجك الأول من الزر بالأعلى.
                      </td>
                    </tr>
                  ) : (
                    programsList.map((prog) => (
                      <tr key={prog.id} className="hover:bg-[#FAF9F6]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 shrink-0 overflow-hidden rounded-md border border-[#E5E2DC]">
                              <SafeImage src={prog.image_url} alt={prog.title} aspectClass="aspect-[16/10]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#141413]">{prog.title}</p>
                              <p className="text-xs text-[#6E6A63]">
                                {prog.instructor || 'بدون مدرب محدد'} · {prog.start_date || 'تسجيل مفتوح'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#44413C]">
                          <span className="block font-medium text-[#141413]">{FORMAT_LABELS[prog.format]}</span>
                          <span className="text-[#6E6A63]">{prog.duration}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold text-[#141413]">
                          {prog.price <= 0 ? 'مجاني' : `${prog.price} ${currency}`}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-semibold">
                          <span className={prog.seats_left <= 3 ? 'text-red-700' : 'text-[#141413]'}>
                            {prog.seats_left} / {prog.seats_total}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.saveProgram({ ...prog, is_active: !prog.is_active }, true);
                                await refreshAll();
                              } catch (err) {
                                handleMutationError(err, 'تعذر تحديث حالة البرنامج');
                              }
                            }}
                            className={`font-semibold cursor-pointer ${
                              prog.is_active ? 'text-emerald-700' : 'text-[#8A847B]'
                            }`}
                          >
                            {prog.is_active ? 'ظاهر' : 'مخفي'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingProgram(prog)}
                              className="rounded-lg border border-[#E5E2DC] p-1.5 text-[#44413C] hover:text-[#141413] cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.deleteProgram(prog.id);
                                  await refreshAll();
                                } catch (err) {
                                  handleMutationError(err, 'تعذر حذف البرنامج');
                                }
                              }}
                              className="rounded-lg border border-[#E5E2DC] p-1.5 text-[#6E6A63] hover:text-red-700 cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enrollments List */}
          <div className="space-y-4 border-t border-[#E5E2DC] pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#141413]">تسجيلات المتدربين (ورقة Enrollments)</h2>
                <p className="text-xs text-[#6E6A63]">إجمالي التسجيلات المسجلة: {enrollmentsList.length}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEnrollStatusFilter(st)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      enrollStatusFilter === st
                        ? 'border-[#141413] bg-[#141413] text-white'
                        : 'border-[#E5E2DC] bg-white text-[#44413C]'
                    }`}
                  >
                    {st === 'all' ? 'الكل' : ENROLLMENT_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>

            {filteredEnrollments.length === 0 ? (
              <div className="rounded-xl border border-[#E5E2DC] bg-white py-10 text-center text-xs text-[#6E6A63]">
                لا توجد تسجيلات مطابقة لهذا الفلتر بعد.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEnrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E5E2DC] bg-white p-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-sm text-[#141413]">{enr.id}</span>
                        <span className="text-[#6E6A63]">
                          · {new Date(enr.created_at).toLocaleString('ar-SA')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#141413]">{enr.program_title}</p>
                      <p className="text-[#44413C]">
                        المتدرب: <strong>{enr.student_name}</strong> · {enr.student_phone}
                        {enr.telegram_username ? ` · تيليجرام: ${enr.telegram_username}` : ''}
                      </p>
                      <p className="text-[#6E6A63]">
                        الرسوم: <strong className="tabular-nums text-[#141413]">{enr.price_paid <= 0 ? 'مجاني' : `${enr.price_paid} ${currency}`}</strong>
                        {enr.bank_reference ? ` · مرجع الحوالة: ${enr.bank_reference}` : ''}
                        {enr.notes ? ` · ملاحظة: ${enr.notes}` : ''}
                      </p>
                    </div>

                    <select
                      value={enr.status}
                      onChange={async (e) => {
                        try {
                          await api.updateEnrollmentStatus(enr.id, e.target.value as EnrollmentStatus);
                          await refreshAll();
                        } catch (err) {
                          handleMutationError(err, 'تعذر تحديث حالة التسجيل');
                        }
                      }}
                      className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#141413] focus:outline-none"
                    >
                      {(Object.keys(ENROLLMENT_STATUS_LABELS) as EnrollmentStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {ENROLLMENT_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Orders */}
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
                        try {
                          await api.updateOrderStatus(order.id, e.target.value as OrderStatus);
                          await refreshAll();
                        } catch (err) {
                          handleMutationError(err, 'تعذر تحديث حالة الطلب');
                        }
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

      {/* TAB 5: Categories & Banners */}
      {tab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-[#141413]">إدارة الأقسام</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catName.trim()) return;
                try {
                  await api.saveCategory({
                    name: catName.trim(),
                    image_url: catImage.trim(),
                    sort_order: data.categories.length + 1,
                  });
                  setCatName('');
                  await refreshAll();
                } catch (err) {
                  handleMutationError(err, 'تعذر إضافة القسم');
                }
              }}
              className="space-y-2.5"
            >
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="اسم القسم الجديد"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  value={catImage}
                  onChange={(e) => setCatImage(e.target.value)}
                  placeholder="رابط صورة القسم (أو رابط Google Drive)"
                  className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white cursor-pointer shrink-0"
                >
                  إضافة قسم
                </button>
              </div>
              {extractGoogleDriveFileId(catImage) && (
                <p className="text-[11px] text-emerald-700">
                  ✓ تم التعرف على رابط Google Drive لصورة القسم (تأكد أن المشاركة «أي شخص لديه الرابط»).
                </p>
              )}
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 shrink-0 overflow-hidden rounded border border-[#E5E2DC]">
                      <SafeImage src={c.image_url} alt={c.name} aspectClass="aspect-square" />
                    </div>
                    <div>
                      <span className="font-semibold text-[#141413]">{c.name}</span>
                      <span className="mr-2 font-mono-num text-xs text-[#6E6A63]">{c.id}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.deleteCategory(c.id);
                        await refreshAll();
                      } catch (err) {
                        handleMutationError(err, 'تعذر حذف القسم');
                      }
                    }}
                    className="text-[#8A847B] hover:text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-[#141413]">إدارة البانرات الترويجية</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!banTitle.trim()) return;
                try {
                  await api.saveBanner({
                    title: banTitle.trim(),
                    subtitle: banSubtitle.trim(),
                    image_url: banImage.trim(),
                  });
                  setBanTitle('');
                  setBanSubtitle('');
                  await refreshAll();
                } catch (err) {
                  handleMutationError(err, 'تعذر إضافة البانر');
                }
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
                  placeholder="رابط صورة البانر (16:9 أو رابط Google Drive)"
                  className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white cursor-pointer shrink-0"
                >
                  إضافة بانر
                </button>
              </div>
              {extractGoogleDriveFileId(banImage) && (
                <p className="text-[11px] text-emerald-700">
                  ✓ تم التعرف على رابط Google Drive لصورة البانر (تأكد أن المشاركة «أي شخص لديه الرابط»).
                </p>
              )}
            </form>

            <div className="divide-y divide-[#E5E2DC]">
              {data.banners.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 shrink-0 overflow-hidden rounded border border-[#E5E2DC]">
                      <SafeImage src={b.image_url} alt={b.title} aspectClass="aspect-video" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#141413] truncate">{b.title}</p>
                      <p className="text-xs text-[#6E6A63] line-clamp-1">{b.subtitle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.deleteBanner(b.id);
                        await refreshAll();
                      } catch (err) {
                        handleMutationError(err, 'تعذر حذف البانر');
                      }
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

      {/* TAB 6: Coupons & Cities */}
      {tab === 'marketing' && (
        <div className="space-y-4">
          {marketingFeedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                marketingFeedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {marketingFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coupons */}
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#B45309]" />
                  <h2 className="text-base font-bold text-[#141413]">كوبونات الخصم (ورقة Coupons)</h2>
                </div>
                {editingCouponId && (
                  <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    وضع تعديل كوبون
                  </span>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMarketingFeedback(null);
                  try {
                    const isEdit = Boolean(editingCouponId);
                    await api.saveCoupon({
                      id: editingCouponId || undefined,
                      code: cpnCode.trim().toUpperCase(),
                      discount_type: cpnType,
                      discount_value: Number(cpnVal) || 0,
                      min_order: Number(cpnMin) || 0,
                      max_uses: Number(cpnMaxUses) || 100,
                      used_count: isEdit ? editingCouponUsedCount : 0,
                      expires_at: cpnExpires,
                    });
                    setEditingCouponId(null);
                    setEditingCouponUsedCount(0);
                    setCpnCode('');
                    setCpnType('percent');
                    setCpnVal('15');
                    setCpnMin('150');
                    setCpnMaxUses('100');
                    setCpnExpires('2027-12-31');
                    await refreshAll();
                    setMarketingFeedback({
                      type: 'ok',
                      text: isEdit ? 'تم حفظ تعديل الكوبون بنجاح.' : 'تمت إضافة الكوبون بنجاح.',
                    });
                  } catch (err) {
                    handleMutationError(err, 'تعذر حفظ الكوبون');
                  }
                }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-3.5"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">كود الكوبون</label>
                  <input
                    required
                    value={cpnCode}
                    onChange={(e) => setCpnCode(e.target.value.toUpperCase())}
                    placeholder="SAVE20"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-mono-num uppercase focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">نوع الخصم</label>
                  <select
                    value={cpnType}
                    onChange={(e) => setCpnType(e.target.value as 'percent' | 'fixed')}
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-2.5 py-2 text-xs focus:border-[#141413] focus:outline-none"
                  >
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ مباشر ({currency})</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">
                    قيمة الخصم ({cpnType === 'percent' ? '%' : currency})
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="any"
                    value={cpnVal}
                    onChange={(e) => setCpnVal(e.target.value)}
                    placeholder={cpnType === 'percent' ? '15' : '30'}
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">الحد الأدنى للطلب ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={cpnMin}
                    onChange={(e) => setCpnMin(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">الحد الأقصى للاستخدام</label>
                  <input
                    type="number"
                    min={1}
                    value={cpnMaxUses}
                    onChange={(e) => setCpnMaxUses(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={cpnExpires}
                    onChange={(e) => setCpnExpires(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-3 flex items-center justify-end gap-2 pt-1">
                  {editingCouponId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCouponId(null);
                        setEditingCouponUsedCount(0);
                        setCpnCode('');
                        setCpnType('percent');
                        setCpnVal('15');
                        setCpnMin('150');
                        setCpnMaxUses('100');
                        setCpnExpires('2027-12-31');
                      }}
                      className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#44413C] hover:bg-[#EFECE6] cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="submit"
                    className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
                  >
                    {editingCouponId ? 'حفظ تعديل الكوبون' : 'إضافة كوبون'}
                  </button>
                </div>
              </form>

              <div className="divide-y divide-[#E5E2DC]">
                {data.coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono-num text-sm font-bold text-[#141413]">{c.code}</span>
                      <span className="mr-2 text-[#44413C]">
                        {c.discount_type === 'percent'
                          ? `خصم نسبة ${c.discount_value}%`
                          : `خصم مبلغ مباشر ${c.discount_value} ${currency}`}{' '}
                        · حد أدنى {c.min_order} · استخدام {c.used_count}/{c.max_uses}
                        {c.expires_at ? ` · ينتهي ${c.expires_at}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="تعديل الكوبون"
                        onClick={() => {
                          setEditingCouponId(c.id);
                          setEditingCouponUsedCount(c.used_count || 0);
                          setCpnCode(c.code);
                          setCpnType(c.discount_type);
                          setCpnVal(String(c.discount_value));
                          setCpnMin(String(c.min_order));
                          setCpnMaxUses(String(c.max_uses));
                          setCpnExpires(c.expires_at || '2027-12-31');
                          setMarketingFeedback(null);
                        }}
                        className="rounded-md p-1.5 text-[#6E6A63] hover:bg-[#FAF9F6] hover:text-[#141413] cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="حذف الكوبون"
                        onClick={async () => {
                          try {
                            await api.deleteCoupon(c.id);
                            if (editingCouponId === c.id) {
                              setEditingCouponId(null);
                              setCpnCode('');
                            }
                            await refreshAll();
                            setMarketingFeedback({ type: 'ok', text: `تم حذف الكوبون ${c.code}.` });
                          } catch (err) {
                            handleMutationError(err, 'تعذر حذف الكوبون');
                          }
                        }}
                        className="rounded-md p-1.5 text-[#8A847B] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cities */}
            <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#B45309]" />
                  <h2 className="text-base font-bold text-[#141413]">تسعيرة التوصيل حسب المدينة (ورقة Cities)</h2>
                </div>
                {editingCityId && (
                  <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                    وضع تعديل مدينة
                  </span>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setMarketingFeedback(null);
                  try {
                    const isEdit = Boolean(editingCityId);
                    await api.saveCity({
                      id: editingCityId || undefined,
                      name: cityName.trim(),
                      delivery_fee: Number(cityFee) || 0,
                      estimated_days: cityDays.trim(),
                      free_shipping_min: cityFreeMin.trim() ? Number(cityFreeMin) : null,
                    });
                    setEditingCityId(null);
                    setCityName('');
                    setCityFee('20');
                    setCityDays('1 - 2 يوم عمل');
                    setCityFreeMin('400');
                    await refreshAll();
                    setMarketingFeedback({
                      type: 'ok',
                      text: isEdit ? 'تم حفظ تعديل المدينة بنجاح.' : 'تمت إضافة المدينة بنجاح.',
                    });
                  } catch (err) {
                    handleMutationError(err, 'تعذر حفظ المدينة');
                  }
                }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-3.5"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">اسم المدينة</label>
                  <input
                    required
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    placeholder="الرياض"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">سعر التوصيل ({currency})</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={cityFee}
                    onChange={(e) => setCityFee(e.target.value)}
                    placeholder="20"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">مدة التوصيل</label>
                  <input
                    value={cityDays}
                    onChange={(e) => setCityDays(e.target.value)}
                    placeholder="1 - 2 يوم عمل"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#44413C]">شحن مجاني فوق ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={cityFreeMin}
                    onChange={(e) => setCityFreeMin(e.target.value)}
                    placeholder="اختياري"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-4 flex items-center justify-end gap-2 pt-1">
                  {editingCityId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCityId(null);
                        setCityName('');
                        setCityFee('20');
                        setCityDays('1 - 2 يوم عمل');
                        setCityFreeMin('400');
                      }}
                      className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#44413C] hover:bg-[#EFECE6] cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="submit"
                    className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
                  >
                    {editingCityId ? 'حفظ تعديل المدينة' : 'إضافة مدينة'}
                  </button>
                </div>
              </form>

              <div className="divide-y divide-[#E5E2DC]">
                {data.cities.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-3 text-xs">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-[#141413]">{c.name}</span>
                      <span className="mr-2 text-[#44413C] tabular-nums">
                        التوصيل: {c.delivery_fee} {currency} · {c.estimated_days}
                        {c.free_shipping_min ? ` · مجاني فوق ${c.free_shipping_min}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="تعديل المدينة"
                        onClick={() => {
                          setEditingCityId(c.id);
                          setCityName(c.name);
                          setCityFee(String(c.delivery_fee));
                          setCityDays(c.estimated_days || '');
                          setCityFreeMin(
                            c.free_shipping_min !== null && c.free_shipping_min !== undefined
                              ? String(c.free_shipping_min)
                              : ''
                          );
                          setMarketingFeedback(null);
                        }}
                        className="rounded-md p-1.5 text-[#6E6A63] hover:bg-[#FAF9F6] hover:text-[#141413] cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="حذف المدينة"
                        onClick={async () => {
                          try {
                            await api.deleteCity(c.id);
                            if (editingCityId === c.id) {
                              setEditingCityId(null);
                              setCityName('');
                            }
                            await refreshAll();
                            setMarketingFeedback({ type: 'ok', text: `تم حذف مدينة ${c.name}.` });
                          } catch (err) {
                            handleMutationError(err, 'تعذر حذف المدينة');
                          }
                        }}
                        className="rounded-md p-1.5 text-[#8A847B] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Settings & Connections */}
      {tab === 'settings' && (
        <SettingsConnectionsTab
          api={api}
          settings={data.settings}
          integrationStatus={data.integrationStatus}
          schemaTabs={data.schemaTabs}
          appsScriptTemplate={data.appsScriptTemplate}
          onRefresh={refreshAll}
          onSessionExpired={handleSessionExpired}
          onTokenChange={onTokenChange}
        />
      )}

      {/* Product Add/Edit Modal */}
      {editingProduct !== undefined && (
        <ProductFormModal
          initial={editingProduct}
          categories={data.categories}
          currency={currency}
          onSave={async (payload, isEdit) => {
            try {
              await api.saveProduct(payload, isEdit);
              await refreshAll();
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                setEditingProduct(undefined);
                handleSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
                return;
              }
              throw err;
            }
          }}
          onCreateCategory={async (catTitle) => {
            try {
              const res = await api.saveCategory({
                name: catTitle,
                image_url: '',
                sort_order: data.categories.length + 1,
              });
              await refreshAll();
              return res.category;
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                setEditingProduct(undefined);
                handleSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
              }
              throw err;
            }
          }}
          onDeleteCategory={async (catId) => {
            try {
              await api.deleteCategory(catId);
              await refreshAll();
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                setEditingProduct(undefined);
                handleSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
              }
              throw err;
            }
          }}
          onClose={() => setEditingProduct(undefined)}
        />
      )}

      {/* Program Add/Edit Modal */}
      {editingProgram !== undefined && (
        <ProgramFormModal
          initial={editingProgram}
          currency={currency}
          onSave={async (payload, isEdit) => {
            try {
              await api.saveProgram(payload, isEdit);
              await refreshAll();
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                setEditingProgram(undefined);
                handleSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
                return;
              }
              throw err;
            }
          }}
          onClose={() => setEditingProgram(undefined)}
        />
      )}
    </section>
  );
};
