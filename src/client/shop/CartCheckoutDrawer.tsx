import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CityZone, Order, PaymentMethod, Product, StoreSettings } from '../../shared/types.ts';
import { storeApi } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';

export interface CartEntry {
  key: string;
  product: Product;
  variant: string;
  qty: number;
}

interface CartCheckoutDrawerProps {
  open: boolean;
  items: CartEntry[];
  cities: CityZone[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQty: (key: string, qty: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
  onOrderCreated: (order: Order) => void;
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  open,
  items,
  cities,
  settings,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderCreated,
}) => {
  const [step, setStep] = useState<'cart' | 'checkout' | 'receipt'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState(cities[0]?.name || '');
  const [customerAddress, setCustomerAddress] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.cod_enabled ? 'cod' : 'bank_transfer'
  );
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [telegramNotified, setTelegramNotified] = useState(false);
  const [copiedIban, setCopiedIban] = useState(false);

  // Auto-fill Telegram Mini App user if available
  useEffect(() => {
    const tg = (window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string; last_name?: string; username?: string } } } };
    }).Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser) {
      if (!customerName && tgUser.first_name) {
        setCustomerName([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '));
      }
      if (!telegramUsername && tgUser.username) {
        setTelegramUsername(`@${tgUser.username}`);
      }
    }
  }, [open]);

  useEffect(() => {
    if (!customerCity && cities.length > 0) {
      setCustomerCity(cities[0].name);
    }
  }, [cities, customerCity]);

  if (!open) return null;

  const subtotal = items.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  const discountAmount = appliedCoupon ? Math.min(subtotal, appliedCoupon.discount) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  const selectedCityObj = cities.find((c) => c.name === customerCity);
  const baseCityFee = selectedCityObj ? selectedCityObj.delivery_fee : settings.default_delivery_fee;
  const cityFreeMin =
    selectedCityObj && selectedCityObj.free_shipping_min !== null && selectedCityObj.free_shipping_min > 0
      ? selectedCityObj.free_shipping_min
      : settings.free_shipping_min;
  const deliveryFee = cityFreeMin > 0 && subtotalAfterDiscount >= cityFreeMin ? 0 : baseCityFee;
  const finalTotal = subtotalAfterDiscount + deliveryFee;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponMessage('');
    try {
      const res = await storeApi.validateCoupon(couponInput.trim(), subtotal);
      setAppliedCoupon({ code: res.code, discount: res.discount_amount });
      setCouponMessage(`تم تطبيق الخصم: -${res.discount_amount} ${settings.currency}`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage(err instanceof Error ? err.message : 'كوبون غير صالح');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await storeApi.createOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_city: customerCity,
        customer_address: customerAddress,
        telegram_username: telegramUsername,
        payment_method: paymentMethod,
        bank_reference: bankReference,
        coupon_code: appliedCoupon?.code || '',
        notes,
        items: items.map((i) => ({
          product_id: i.product.id,
          qty: i.qty,
          variant: i.variant,
        })),
      });
      setConfirmedOrder(res.order);
      setTelegramNotified(res.telegramNotified);
      onOrderCreated(res.order);
      onClearCart();
      setAppliedCoupon(null);
      setCouponInput('');
      setStep('receipt');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إتمام الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyIban = () => {
    navigator.clipboard.writeText(settings.bank_iban);
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  };

  const handleClose = () => {
    if (step === 'receipt') setStep('cart');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E5E2DC] px-6 py-4">
          <div className="flex items-center gap-2">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="rounded-lg p-1.5 text-[#6E6A63] hover:bg-[#F3F1EC] cursor-pointer"
                aria-label="العودة للسلة"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-[#141413]">
              {step === 'cart' && `سلة المشتريات (${items.reduce((s, i) => s + i.qty, 0)})`}
              {step === 'checkout' && 'إتمام الطلب والتوصيل'}
              {step === 'receipt' && 'تم استلام طلبك بنجاح'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-[#6E6A63] hover:bg-[#F3F1EC] cursor-pointer"
            aria-label="إغلاق السلة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <ShoppingBag className="h-12 w-12 text-[#B8B2A8] mb-3" />
                  <p className="text-base font-semibold text-[#141413]">سلة المشتريات فارغة</p>
                  <p className="mt-1 text-sm text-[#6E6A63]">أضف منتجاتك المختارة للبدء بإتمام الطلب.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((entry) => (
                    <div
                      key={entry.key}
                      className="flex gap-4 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-3"
                    >
                      <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-[#E5E2DC]">
                        <SafeImage src={entry.product.image_url} alt={entry.product.name} aspectClass="aspect-[4/3]" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-[#141413] leading-snug">{entry.product.name}</h4>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(entry.key)}
                              className="text-[#8A847B] hover:text-red-600 p-1 cursor-pointer"
                              aria-label="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {entry.variant && (
                            <p className="mt-0.5 text-xs text-[#6E6A63]">{entry.variant}</p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-[#E5E2DC] bg-white">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(entry.key, entry.qty - 1)}
                              className="p-1.5 text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold tabular-nums">{entry.qty}</span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(entry.key, Math.min(entry.product.stock, entry.qty + 1))}
                              className="p-1.5 text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-[#141413] tabular-nums">
                            {entry.product.price * entry.qty} {settings.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-5">
              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#141413]">بيانات المستلم</h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">الاسم الكامل *</label>
                  <input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم الجوال *</label>
                    <input
                      required
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#141413] tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#44413C]">معرف تيليجرام (اختياري)</label>
                    <input
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* City Selector */}
              <div className="space-y-3 border-t border-[#E5E2DC] pt-4">
                <h3 className="text-sm font-bold text-[#141413] flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#B45309]" />
                  <span>المدينة وعنوان التوصيل</span>
                </h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">اختر المدينة *</label>
                  <select
                    required
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} — {c.delivery_fee} {settings.currency} ({c.estimated_days})
                      </option>
                    ))}
                  </select>
                  {selectedCityObj && (
                    <p className="mt-1.5 text-xs text-[#6E6A63]">
                      مدة التوصيل المتوقعة: {selectedCityObj.estimated_days}
                      {cityFreeMin > 0 ? ` · شحن مجاني للطلبات فوق ${cityFreeMin} ${settings.currency}` : ''}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">العنوان التفصيلي *</label>
                  <textarea
                    required
                    rows={2}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="الحي، اسم الشارع، رقم المبنى أو أقرب معلم"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Coupon */}
              <div className="space-y-2 border-t border-[#E5E2DC] pt-4">
                <label className="text-xs font-semibold text-[#141413] flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[#B45309]" />
                  <span>لديك كوبون خصم؟ (جرّب NUKHBA10)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="أدخل كود الخصم"
                    className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm uppercase text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={handleApplyCoupon}
                    className="rounded-lg border border-[#141413] bg-white px-4 py-2 text-xs font-semibold text-[#141413] hover:bg-[#141413] hover:text-white disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {couponLoading ? 'جاري التحقق...' : 'تطبيق'}
                  </button>
                </div>
                {couponMessage && (
                  <p className={`text-xs ${appliedCoupon ? 'text-emerald-700 font-medium' : 'text-red-700'}`}>
                    {couponMessage}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-3 border-t border-[#E5E2DC] pt-4">
                <h3 className="text-sm font-bold text-[#141413]">طريقة الدفع</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {settings.cod_enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`rounded-xl border p-3.5 text-right transition-colors cursor-pointer ${
                        paymentMethod === 'cod'
                          ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413]'
                          : 'border-[#E5E2DC] bg-white hover:border-[#B8B2A8]'
                      }`}
                    >
                      <span className="block text-sm font-bold text-[#141413]">الدفع عند الاستلام</span>
                      <span className="mt-0.5 block text-xs text-[#6E6A63]">نقداً أو شبكة عند وصول المندوب</span>
                    </button>
                  )}
                  {settings.bank_transfer_enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`rounded-xl border p-3.5 text-right transition-colors cursor-pointer ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413]'
                          : 'border-[#E5E2DC] bg-white hover:border-[#B8B2A8]'
                      }`}
                    >
                      <span className="block text-sm font-bold text-[#141413]">تحويل بنكي</span>
                      <span className="mt-0.5 block text-xs text-[#6E6A63]">تحويل مباشر لحساب المتجر</span>
                    </button>
                  )}
                </div>

                {paymentMethod === 'bank_transfer' && (
                  <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-2.5 text-xs">
                    <p className="font-semibold text-[#141413]">{settings.bank_name}</p>
                    <p className="text-[#44413C]">اسم المستفيد: {settings.bank_account_name}</p>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2">
                      <span className="font-mono-num text-[#141413] select-all">{settings.bank_iban}</span>
                      <button
                        type="button"
                        onClick={copyIban}
                        className="inline-flex items-center gap-1 text-[#B45309] font-semibold cursor-pointer shrink-0"
                      >
                        {copiedIban ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedIban ? 'تم النسخ' : 'نسخ'}</span>
                      </button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#44413C]">
                        رقم مرجع الحوالة أو اسم المحوّل (اختياري)
                      </label>
                      <input
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        placeholder="مثال: رقم العملية أو اسم الحساب المحول منه"
                        className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs text-[#141413] focus:border-[#141413] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">ملاحظات إضافية (اختياري)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="وقت التوصيل المفضل أو أي تعليمات"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}

          {step === 'receipt' && confirmedOrder && (
            <div className="space-y-5 py-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-700" />
                <h3 className="text-xl font-bold text-[#141413]">شكراً لك، تم تأكيد استلام طلبك</h3>
                <p className="text-sm text-[#6E6A63]">
                  رقم الطلب المرجعي:{' '}
                  <span className="font-mono-num font-bold text-[#141413] select-all">{confirmedOrder.id}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6E6A63]">العميل:</span>
                  <span className="font-medium text-[#141413]">{confirmedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6A63]">المدينة:</span>
                  <span className="font-medium text-[#141413]">{confirmedOrder.customer_city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6A63]">الإجمالي النهائي:</span>
                  <span className="font-bold text-[#141413] tabular-nums">
                    {confirmedOrder.total} {settings.currency}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E5E2DC] text-xs text-[#6E6A63]">
                  {telegramNotified
                    ? 'تم إرسال إشعار فوري بإيصال الطلب إلى تيليجرام الإدارة للمراجعة والتجهيز.'
                    : 'تم تسجيل الطلب في قاعدة بيانات المتجر (Google Sheets) وحفظه في قسم «طلباتي».'}
                </div>
              </div>

              {settings.telegram_username && (
                <a
                  href={`https://t.me/${settings.telegram_username.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0088cc] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0077b3] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>تواصل معنا عبر تيليجرام لمتابعة الطلب</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {step !== 'receipt' && items.length > 0 && (
          <div className="border-t border-[#E5E2DC] bg-[#FAF9F6] p-6 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6E6A63]">
                <span>المجموع الفرعي</span>
                <span className="tabular-nums font-medium text-[#141413]">
                  {subtotal} {settings.currency}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>خصم الكوبون ({appliedCoupon?.code})</span>
                  <span className="tabular-nums font-medium">
                    -{discountAmount} {settings.currency}
                  </span>
                </div>
              )}
              {step === 'checkout' && (
                <div className="flex justify-between text-[#6E6A63]">
                  <span>رسوم التوصيل ({customerCity})</span>
                  <span className="tabular-nums font-medium text-[#141413]">
                    {deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${settings.currency}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#E5E2DC] pt-2 text-base font-bold text-[#141413]">
                <span>الإجمالي</span>
                <span className="tabular-nums">
                  {step === 'checkout' ? finalTotal : subtotal} {settings.currency}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full rounded-lg bg-[#141413] py-3 text-sm font-semibold text-white hover:bg-[#2A2A28] transition-colors cursor-pointer"
              >
                المتابعة لإتمام الطلب
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="w-full rounded-lg bg-[#B45309] py-3 text-sm font-semibold text-white hover:bg-[#92400E] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'جاري تسجيل الطلب...' : `تأكيد الطلب (${finalTotal} ${settings.currency})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
