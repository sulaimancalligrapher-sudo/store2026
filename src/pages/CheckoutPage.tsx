import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CartItem, PaymentMethod, PublicProduct, StoreSettings } from '../types';
import { saveOrderSummary } from '../lib/storage';

interface CheckoutPageProps {
  items: CartItem[];
  products: PublicProduct[];
  settings: StoreSettings;
  onNavigate: (path: string) => void;
  onClearCart: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  products,
  settings,
  onNavigate,
  onClearCart,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('contact');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const productMap = new Map(products.map((p) => [p.id, p]));
  const detailed = items
    .map((item) => {
      const product = productMap.get(item.productId);
      return product ? { ...item, product } : null;
    })
    .filter((entry): entry is { productId: string; qty: number; product: PublicProduct } =>
      Boolean(entry),
    );

  if (detailed.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-[#1A1A18]">سلتك فارغة</h1>
        <p className="mt-2 text-sm text-[#5F5C54]">
          أضف المنتجات التي ترغب بها أولاً ثم تابع إلى إتمام الطلب.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-6 px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium"
        >
          تصفح المتجر
        </button>
      </main>
    );
  }

  const subtotal = detailed.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  const hasPhysical = detailed.some((entry) => entry.product.type === 'physical');
  const freeOver = settings.freeShippingOver;
  const qualifiesFree = freeOver > 0 && subtotal >= freeOver;
  const deliveryFee = !hasPhysical || qualifiesFree ? 0 : settings.deliveryFee;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phone,
          address: hasPhysical ? address : '',
          notes,
          paymentMethod,
          items: detailed.map((d) => ({ productId: d.productId, qty: d.qty })),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        orderId?: string;
        token?: string;
        total?: number;
      };

      if (!res.ok || !data.token || !data.orderId) {
        setErrorMsg(data.error || 'تعذر إرسال الطلب، يرجى التحقق من البيانات.');
        setSubmitting(false);
        return;
      }

      saveOrderSummary({
        orderId: data.orderId,
        token: data.token,
        createdAt: new Date().toISOString(),
        total: data.total ?? total,
        currency: settings.currency,
      });

      onClearCart();
      onNavigate(`/o/${data.token}`);
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.');
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-16">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5F5C54] hover:text-[#1A1A18] mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة للمتجر</span>
      </button>

      <h1 className="font-display text-3xl font-bold text-[#1A1A18] mb-8">إتمام الطلب</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
              الاسم الكامل
            </label>
            <input
              id="customerName"
              type="text"
              required
              minLength={2}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: عبد الله السالم"
              className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
              رقم الجوال (واتساب / تيليجرام)
            </label>
            <input
              id="phone"
              type="tel"
              required
              minLength={7}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="مثال: 0500000000"
              className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
            />
          </div>

          {hasPhysical ? (
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                المدينة وعنوان التوصيل
              </label>
              <textarea
                id="address"
                required
                rows={3}
                minLength={5}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المدينة، الحي، الشارع، أو أقرب معلم"
                className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
              />
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-[#F2EFE9] border border-[#E5E0D5] text-sm text-[#1A1A18]">
              طلبك يحتوي على مناهج رقمية فقط — لا حاجة لعنوان شحن، وستظهر لك روابط المنهج في صفحة الطلب فور تأكيد الدفع.
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-[#1A1A18] mb-1.5">
              ملاحظات إضافية (اختياري)
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل حول مقاس القلم أو وقت التواصل المناسب"
              className="w-full px-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#E5E0D5] rounded-lg focus:outline-none focus:border-[#0F4C3F]"
            />
          </div>

          <div className="pt-2 space-y-3">
            <span className="block text-sm font-medium text-[#1A1A18]">طريقة الدفع</span>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-[#E5E0D5] bg-[#FAF8F4] cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="contact"
                checked={paymentMethod === 'contact'}
                onChange={() => setPaymentMethod('contact')}
                className="mt-1 accent-[#0F4C3F]"
              />
              <div>
                <p className="text-sm font-semibold text-[#1A1A18]">
                  الطلب والدفع بالتواصل المباشر
                </p>
                <p className="text-xs text-[#5F5C54] mt-0.5">
                  يصلنا طلبك فوراً، ونتواصل معك عبر واتساب أو تيليجرام للاتفاق على وسيلة الدفع الأنسب لك.
                </p>
              </div>
            </label>

            {settings.transferInfo && (
              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#E5E0D5] bg-[#FAF8F4] cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="transfer"
                  checked={paymentMethod === 'transfer'}
                  onChange={() => setPaymentMethod('transfer')}
                  className="mt-1 accent-[#0F4C3F]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">تحويل بنكي أو محفظة</p>
                  <p className="text-xs text-[#5F5C54] mt-1 whitespace-pre-line">
                    {settings.transferInfo}
                  </p>
                </div>
              </label>
            )}
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800" role="alert">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !settings.isOpen}
            className="w-full py-3.5 px-6 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] disabled:bg-[#E5E0D5] disabled:text-[#5F5C54] transition-colors"
          >
            {submitting ? 'جاري تسجيل الطلب...' : 'تأكيد وإرسال الطلب'}
          </button>
        </form>

        {/* Summary Card */}
        <aside className="lg:col-span-5 bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1A1A18]">ملخص الطلب</h2>
          <div className="divide-y divide-[#E5E0D5]">
            {detailed.map(({ product, qty }) => (
              <div key={product.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#1A1A18] truncate">{product.name}</p>
                  <p className="text-xs text-[#5F5C54] tabular-nums">الكمية: {qty}</p>
                </div>
                <span className="font-semibold text-[#1A1A18] tabular-nums shrink-0">
                  {product.price * qty} {settings.currency}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E5E0D5] space-y-2 text-sm">
            <div className="flex justify-between text-[#5F5C54]">
              <span>المجموع الفرعي</span>
              <span className="tabular-nums text-[#1A1A18]">
                {subtotal} {settings.currency}
              </span>
            </div>
            <div className="flex justify-between text-[#5F5C54]">
              <span>الشحن والتوصيل</span>
              <span className="tabular-nums text-[#1A1A18]">
                {deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${settings.currency}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E5E0D5] text-base font-bold text-[#1A1A18]">
              <span>الإجمالي المطلوب</span>
              <span className="tabular-nums text-[#0F4C3F]">
                {total} {settings.currency}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};
