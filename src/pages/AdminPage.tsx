import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  EyeOff,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Category, ProductType, StoreSettings } from '../types';

interface AdminProduct {
  id: string;
  sku: string;
  categoryId: string;
  type: ProductType;
  name: string;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  images: string[];
  previewMedia: string;
  digitalDeliveryUrl: string;
  sort: number;
  active: boolean;
}

interface AdminOverviewResponse {
  connectionMode: 'service_account' | 'apps_script' | 'memory';
  telegramConfigured: boolean;
  hideBackendCode: boolean;
  settings: StoreSettings;
  categories: Category[];
  products: AdminProduct[];
  appsScriptCode: string;
}

interface AdminPageProps {
  onCatalogUpdated: () => Promise<void>;
}

const EMPTY_FORM = {
  id: '',
  sku: '',
  categoryId: 'cat_tools',
  type: 'physical' as ProductType,
  name: '',
  description: '',
  price: '',
  oldPrice: '',
  stock: '10',
  imagesText: '',
  previewMedia: '',
  digitalDeliveryUrl: '',
  sort: '10',
  active: true,
};

export const AdminPage: React.FC<AdminPageProps> = ({ onCatalogUpdated }) => {
  // Token stays strictly in React memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<{
    loading: boolean;
    needsSetup: boolean;
    envConfigured: boolean;
  }>({ loading: true, needsSetup: false, envConfigured: false });
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [tab, setTab] = useState<'products' | 'settings' | 'backend'>('products');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Product editor state
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_FORM);
  const [savingProduct, setSavingProduct] = useState(false);

  // Settings editor state
  const [settingsForm, setSettingsForm] = useState<StoreSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Backend code copy & temporary hide state
  const [copiedKey, setCopiedKey] = useState<'script' | 'webhook' | null>(null);
  const [hideCodeLocal, setHideCodeLocal] = useState(false);
  const [initializingSheet, setInitializingSheet] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((data: { needsSetup: boolean; envConfigured: boolean }) => {
        if (active) {
          setAuthStatus({
            loading: false,
            needsSetup: Boolean(data.needsSetup),
            envConfigured: Boolean(data.envConfigured),
          });
        }
      })
      .catch(() => {
        if (active) setAuthStatus({ loading: false, needsSetup: false, envConfigured: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOverview = useCallback(async (token: string) => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setAdminToken('');
        return;
      }
      const data = (await res.json()) as AdminOverviewResponse;
      setOverview(data);
      setSettingsForm(data.settings);
    } catch {
      setFeedback({ type: 'err', text: 'تعذر تحميل بيانات الإدارة.' });
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    if (adminToken) {
      void loadOverview(adminToken);
    }
  }, [adminToken, loadOverview]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authStatus.needsSetup && passwordInput !== confirmPasswordInput) {
      setAuthError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const endpoint = authStatus.needsSetup
        ? '/api/admin/auth/claim'
        : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'تعذر تسجيل الدخول.');
        setAuthSubmitting(false);
        return;
      }
      setPasswordInput('');
      setConfirmPasswordInput('');
      setAuthStatus((prev) => ({ ...prev, needsSetup: false }));
      setAdminToken(data.token);
    } catch {
      setAuthError('تعذر الاتصال بالخادم.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSavingProduct(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id: productForm.id || undefined,
          sku: productForm.sku,
          categoryId: productForm.categoryId,
          type: productForm.type,
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          oldPrice: productForm.oldPrice ? Number(productForm.oldPrice) : null,
          stock: productForm.type === 'digital' ? -1 : Number(productForm.stock || 0),
          imagesText: productForm.imagesText,
          previewMedia: productForm.previewMedia,
          digitalDeliveryUrl: productForm.digitalDeliveryUrl,
          sort: Number(productForm.sort || 10),
          active: productForm.active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'تعذر حفظ المنتج.' });
        setSavingProduct(false);
        return;
      }

      setShowProductForm(false);
      setProductForm(EMPTY_FORM);
      setFeedback({ type: 'ok', text: 'تم حفظ المنتج وتحديث الكتالوج بنجاح.' });
      await loadOverview(adminToken);
      await onCatalogUpdated();
    } catch {
      setFeedback({ type: 'err', text: 'حدث خطأ أثناء حفظ المنتج.' });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditProduct = (p: AdminProduct) => {
    setProductForm({
      id: p.id,
      sku: p.sku,
      categoryId: p.categoryId || 'cat_tools',
      type: p.type,
      name: p.name,
      description: p.description,
      price: String(p.price),
      oldPrice: p.oldPrice ? String(p.oldPrice) : '',
      stock: p.type === 'digital' ? '-1' : String(p.stock),
      imagesText: p.images.join(', '),
      previewMedia: p.previewMedia || '',
      digitalDeliveryUrl: p.digitalDeliveryUrl || '',
      sort: String(p.sort),
      active: p.active,
    });
    setShowProductForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        setFeedback({ type: 'err', text: `تعذر حذف "${name}".` });
        return;
      }
      setFeedback({ type: 'ok', text: `تم حذف "${name}".` });
      await loadOverview(adminToken);
      await onCatalogUpdated();
    } catch {
      setFeedback({ type: 'err', text: 'تعذر حذف المنتج.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setFeedback(null);
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(settingsForm),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'تعذر حفظ الإعدادات.' });
        setSavingSettings(false);
        return;
      }
      setFeedback({ type: 'ok', text: 'تم حفظ إعدادات المتجر بنجاح.' });
      await loadOverview(adminToken);
      await onCatalogUpdated();
    } catch {
      setFeedback({ type: 'err', text: 'تعذر الاتصال بالخادم.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleInitSheet = async () => {
    setFeedback(null);
    setInitializingSheet(true);
    try {
      const res = await fetch('/api/admin/init-sheet', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { mode?: string; error?: string };
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'تعذر تهيئة الشيت.' });
        return;
      }
      if (data.mode === 'memory') {
        setFeedback({
          type: 'err',
          text: 'لم يتم ربط Google Sheet في متغيرات البيئة بعد. انسخ الكود الخلفي أولاً واربط الشيت.',
        });
      } else {
        setFeedback({ type: 'ok', text: 'تم إنشاء وتجهيز الأوراق الستة في Google Sheet بنجاح.' });
        await loadOverview(adminToken);
        await onCatalogUpdated();
      }
    } catch {
      setFeedback({ type: 'err', text: 'تعذر الاتصال بالخادم لتهيئة الشيت.' });
    } finally {
      setInitializingSheet(false);
    }
  };

  const copyText = async (text: string, key: 'script' | 'webhook') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({ type: 'err', text: 'تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.' });
    }
  };

  if (authStatus.loading) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center text-sm text-[#5F5C54]">
        جاري التحقق من لوحة الإعدادات...
      </main>
    );
  }

  if (!adminToken) {
    return (
      <main className="max-w-md mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F2EFE9] flex items-center justify-center text-[#0F4C3F]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#1A1A18]">
                {authStatus.needsSetup ? 'تعيين كلمة مرور الإدارة' : 'لوحة الإعدادات والمنتجات'}
              </h1>
              <p className="text-xs text-[#5F5C54]">
                {authStatus.needsSetup
                  ? 'أنشئ كلمة مرور لحماية إعدادات متجرك ونسخ كود الربط.'
                  : 'أدخل كلمة مرور المالك لإدارة المنتجات والإعدادات.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-pass" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                كلمة المرور
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                minLength={6}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="6 أحرف على الأقل"
                className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
              />
            </div>

            {authStatus.needsSetup && (
              <div>
                <label htmlFor="admin-pass-confirm" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                  تأكيد كلمة المرور
                </label>
                <input
                  id="admin-pass-confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                />
              </div>
            )}

            {authError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3 px-5 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] disabled:opacity-60 transition-colors"
            >
              {authSubmitting
                ? 'جاري التحقق...'
                : authStatus.needsSetup
                  ? 'حفظ كلمة المرور والدخول'
                  : 'دخول'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const showBackendTab = Boolean(overview && !overview.hideBackendCode && !hideCodeLocal);
  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
  const connectionLabel =
    overview?.connectionMode === 'service_account'
      ? 'متصل عبر Google Sheets API (Service Account)'
      : overview?.connectionMode === 'apps_script'
        ? 'متصل عبر Google Apps Script Web App'
        : 'يعمل حالياً بالوضع المبدئي التجريبي (بانتظار ربط Google Sheet)';

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5E0D5]">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1A1A18]">
            الإعدادات وإدارة المتجر
          </h1>
          <p className="text-xs text-[#5F5C54] mt-1">
            {connectionLabel} · {overview?.telegramConfigured ? 'بوت تيليجرام متصل' : 'بوت تيليجرام غير مضبوط بعد'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadOverview(adminToken)}
            disabled={loadingOverview}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] bg-white text-[#1A1A18] hover:bg-[#F2EFE9]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminToken('')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] bg-white text-[#5F5C54] hover:text-[#1A1A18]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'products'}
          onClick={() => setTab('products')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            tab === 'products'
              ? 'bg-[#0F4C3F] text-white'
              : 'bg-white border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]'
          }`}
        >
          إدخال وإدارة المنتجات ({overview?.products.length ?? 0})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'settings'}
          onClick={() => setTab('settings')}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            tab === 'settings'
              ? 'bg-[#0F4C3F] text-white'
              : 'bg-white border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]'
          }`}
        >
          إعدادات المتجر والتوصيل
        </button>
        {showBackendTab && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'backend'}
            onClick={() => setTab('backend')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              tab === 'backend'
                ? 'bg-[#0F4C3F] text-white'
                : 'bg-white border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]'
            }`}
          >
            ربط الشيت ونسخ الكود الخلفي
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
          role="status"
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: PRODUCTS */}
      {tab === 'products' && overview && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#5F5C54]">
              أضف أدوات الخط والمناهج التعليمية هنا، وتُحفظ مباشرة في ورقة Products.
            </p>
            <button
              type="button"
              onClick={() => {
                setProductForm(EMPTY_FORM);
                setShowProductForm((s) => !s);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{showProductForm ? 'إغلاق النموذج' : 'إضافة منتج جديد'}</span>
            </button>
          </div>

          {showProductForm && (
            <form
              onSubmit={handleSaveProduct}
              className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-5"
            >
              <h2 className="text-lg font-bold text-[#1A1A18]">
                {productForm.id ? 'تعديل المنتج' : 'إدخال منتج جديد'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="مثال: قلم قصب جاوي مقاس 2 مم"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">القسم</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                  >
                    {overview.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">نوع المنتج</label>
                  <select
                    value={productForm.type}
                    onChange={(e) =>
                      setProductForm({ ...productForm, type: e.target.value as ProductType })
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                  >
                    <option value="physical">أداة خط مادية (تُشحن وتُخصم من المخزون)</option>
                    <option value="digital">منهج تعليمي رقمي (Google Drive بعد التأكيد)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">رمز المنتج SKU (اختياري)</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="مثال: QLM-02"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">السعر ({overview.settings.currency}) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">السعر قبل الخصم (اختياري)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={productForm.oldPrice}
                    onChange={(e) => setProductForm({ ...productForm, oldPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>

                {productForm.type === 'physical' && (
                  <div>
                    <label className="block text-xs font-medium text-[#5F5C54] mb-1">الكمية في المخزون *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums focus:outline-none focus:border-[#0F4C3F]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">ترتيب العرض</label>
                  <input
                    type="number"
                    value={productForm.sort}
                    onChange={(e) => setProductForm({ ...productForm, sort: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F5C54] mb-1">الوصف</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="تفاصيل المقاس، الخامة، أو محاور المنهج التعليمي..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                  روابط الصور (يدعم روابط Google Drive أو الروابط المباشرة، مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={productForm.imagesText}
                  onChange={(e) => setProductForm({ ...productForm, imagesText: e.target.value })}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                    رابط المعاينة (فيديو أو صوت تعريفي من Drive / YouTube)
                  </label>
                  <input
                    type="text"
                    value={productForm.previewMedia}
                    onChange={(e) => setProductForm({ ...productForm, previewMedia: e.target.value })}
                    placeholder="اختياري — يظهر في صفحة المنتج"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                  />
                </div>

                {productForm.type === 'digital' && (
                  <div>
                    <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                      رابط المنهج الكامل على Google Drive (محمي بعد التأكيد)
                    </label>
                    <input
                      type="text"
                      value={productForm.digitalDeliveryUrl}
                      onChange={(e) =>
                        setProductForm({ ...productForm, digitalDeliveryUrl: e.target.value })
                      }
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center gap-2 text-sm text-[#1A1A18] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.active}
                    onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                    className="accent-[#0F4C3F]"
                  />
                  <span>عرض المنتج في المتجر</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProductForm(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E5E0D5] text-[#5F5C54]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-[#0F4C3F] text-white hover:bg-[#0B3A30] disabled:opacity-60"
                  >
                    {savingProduct ? 'جاري الحفظ...' : 'حفظ المنتج'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Product list */}
          <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
            <div className="divide-y divide-[#E5E0D5]">
              {overview.products.map((p) => (
                <div
                  key={p.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#5F5C54]">
                      <span>{p.type === 'digital' ? 'منهج رقمي' : 'أداة خط'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {p.type === 'digital' ? 'مخزون غير محدود' : `المخزون: ${p.stock}`}
                      </span>
                      {!p.active && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-700">مخفي</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#1A1A18] mt-0.5 truncate">
                      {p.name}
                    </h3>
                    <p className="text-sm font-bold text-[#0F4C3F] tabular-nums mt-0.5">
                      {p.price} {overview.settings.currency}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditProduct(p)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] text-[#1A1A18] hover:bg-[#F2EFE9]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProduct(p.id, p.name)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: STORE SETTINGS */}
      {tab === 'settings' && settingsForm && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <h2 className="text-lg font-bold text-[#1A1A18]">إعدادات المتجر والتواصل</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">اسم المتجر</label>
              <input
                type="text"
                required
                value={settingsForm.storeName}
                onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">العملة</label>
              <input
                type="text"
                required
                value={settingsForm.currency}
                onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">رسوم التوصيل للأدوات</label>
              <input
                type="number"
                min="0"
                value={settingsForm.deliveryFee}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, deliveryFee: Number(e.target.value || 0) })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                الشحن المجاني للطلبات فوق (0 = معطل)
              </label>
              <input
                type="number"
                min="0"
                value={settingsForm.freeShippingOver}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    freeShippingOver: Number(e.target.value || 0),
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">رقم الواتساب (بالرمز الدولي مثل 9665...)</label>
              <input
                type="text"
                value={settingsForm.whatsapp}
                onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                حسابك على تيليجرام للتواصل (بدون @)
              </label>
              <input
                type="text"
                value={settingsForm.telegramUsername}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, telegramUsername: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5F5C54] mb-1">
                اسم مستخدم بوت المتجر (بدون @، لمتابعة العملاء)
              </label>
              <input
                type="text"
                value={settingsForm.botUsername}
                onChange={(e) => setSettingsForm({ ...settingsForm, botUsername: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5F5C54] mb-1">الوصف المختصر للمتجر</label>
            <input
              type="text"
              value={settingsForm.tagline}
              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5F5C54] mb-1">
              الشريط الإعلاني العلوي (اتركه فارغاً لإخفائه)
            </label>
            <input
              type="text"
              value={settingsForm.announcement}
              onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5F5C54] mb-1">
              بيانات التحويل البنكي / المحفظة (اختياري — إذا ملأتها يظهر خيار التحويل عند الطلب)
            </label>
            <textarea
              rows={3}
              value={settingsForm.transferInfo}
              onChange={(e) => setSettingsForm({ ...settingsForm, transferInfo: e.target.value })}
              placeholder="مثال: مصرف الراجحي — الآيبان SA... — باسم..."
              className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-[#1A1A18] cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.isOpen}
                onChange={(e) => setSettingsForm({ ...settingsForm, isOpen: e.target.checked })}
                className="accent-[#0F4C3F]"
              />
              <span>المتجر مفتوح لاستقبال الطلبات</span>
            </label>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-[#0F4C3F] text-white hover:bg-[#0B3A30] disabled:opacity-60"
            >
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BACKEND CODE & SHEET CONNECTOR */}
      {tab === 'backend' && showBackendTab && overview && (
        <section className="space-y-6">
          <div className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A18]">
                  ربط Google Sheet بالكود الخلفي (Google Apps Script)
                </h2>
                <p className="text-sm text-[#5F5C54] mt-1">
                  انسخ هذا الكود الخلفي والصقه داخل ملف Google Sheet (الإضافات &larr; Apps Script) لإنشاء الأوراق الستة وربط الشيت بالمتجر بسهولة بدون تعقيد.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleInitSheet()}
                  disabled={initializingSheet}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#0F4C3F] text-[#0F4C3F] hover:bg-[#F2EFE9]"
                >
                  {initializingSheet ? 'جاري التهيئة...' : 'تهيئة أوراق الشيت المتصل'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHideCodeLocal(true);
                    setTab('products');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>إخفاء قسم الكود الخلفي</span>
                </button>
              </div>
            </div>

            <ol className="text-sm text-[#5F5C54] space-y-1.5 list-decimal list-inside bg-[#FAF8F4] p-4 rounded-xl border border-[#E5E0D5]">
              <li>أنشئ ملف Google Sheet جديد، ثم افتح من القائمة: <strong>الإضافات (Extensions) &larr; Apps Script</strong>.</li>
              <li>احذف أي كود افتراضي، ثم انسخ الكود الخلفي بالأسفل والصقه واحفظ الملف.</li>
              <li>شغّل دالة <strong>setupStoreSheet</strong> لإنشاء الأوراق الستة، ثم اضغط <strong>نشر (Deploy) &larr; تطبيق ويب (Web app)</strong> بصلاحية <strong>Anyone</strong>.</li>
              <li>ضع رابط النشر الناتج في متغير <code className="font-mono text-xs">GOOGLE_APPS_SCRIPT_URL</code> داخل إعدادات الاستضافة (Vercel)، وبعد اكتمال الربط يمكنك إزالة هذا القسم بتعيين <code className="font-mono text-xs">HIDE_BACKEND_CODE=true</code>.</li>
            </ol>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1A1A18]">كود Google Apps Script الخلفي</span>
                <button
                  type="button"
                  onClick={() => void copyText(overview.appsScriptCode, 'script')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F4C3F] text-white hover:bg-[#0B3A30]"
                >
                  {copiedKey === 'script' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الكود الخلفي</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                dir="ltr"
                className="p-4 rounded-xl bg-[#1A1A18] text-[#FAF8F4] text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"
              >
                <code>{overview.appsScriptCode}</code>
              </pre>
            </div>
          </div>

          <div className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-3">
            <h3 className="text-base font-bold text-[#1A1A18]">رابط Webhook بوت تيليجرام</h3>
            <p className="text-sm text-[#5F5C54]">
              استخدم هذا الرابط عند تفعيل Webhook لبوت تيليجرام بعد النشر على Vercel:
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={webhookUrl}
                className="flex-1 px-3.5 py-2 text-xs font-mono bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg"
              />
              <button
                type="button"
                onClick={() => void copyText(webhookUrl, 'webhook')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] text-[#1A1A18] hover:bg-[#F2EFE9]"
              >
                {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'webhook' ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
