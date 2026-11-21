import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { OrderDetail, OrderStatus, StoreSettings } from '../types';
import { isSafeHttpUrl } from '../lib/media';

interface OrderPageProps {
  token: string;
  onNavigate: (path: string) => void;
}

function statusArabic(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    new: 'طلب جديد · بانتظار التواصل لتأكيد الدفع',
    confirmed: 'تم تأكيد الدفع والطلب',
    shipping: 'جاري تجهيز وشحن أدواتك',
    delivered: 'تم تسليم الطلب بنجاح',
    cancelled: 'تم إلغاء الطلب',
  };
  return labels[status] || status;
}

export const OrderPage: React.FC<OrderPageProps> = ({ token, onNavigate }) => {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(token)}`);
      const data = (await res.json()) as {
        order?: OrderDetail;
        settings?: StoreSettings;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setErrorMsg(data.error || 'تعذر العثور على الطلب.');
        setLoading(false);
        return;
      }
      setOrder(data.order);
      if (data.settings) setSettings(data.settings);
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم لتحديث الطلب.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  if (loading && !order) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center text-sm text-[#5F5C54]">
        جاري تحميل تفاصيل الطلب...
      </main>
    );
  }

  if (errorMsg || !order) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-[#1A1A18]">
          {errorMsg || 'الطلب غير موجود'}
        </h1>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-6 px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium"
        >
          العودة للمتجر
        </button>
      </main>
    );
  }

  const currency = settings?.currency || 'ر.س';
  const waDigits = (settings?.whatsapp || '').replace(/[^\d]/g, '');
  const prefilledMessage = encodeURIComponent(
    `السلام عليكم، أرجو إتمام طلبي رقم ${order.orderId}\nالاسم: ${order.customerName}\nالإجمالي: ${order.total} ${currency}`,
  );
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${prefilledMessage}` : '';
  const tgUsername = (settings?.telegramUsername || '').replace(/^@/, '');
  const tgContactHref = tgUsername ? `https://t.me/${encodeURIComponent(tgUsername)}` : '';
  const botUsername = (settings?.botUsername || '').replace(/^@/, '');
  const botTrackHref = botUsername
    ? `https://t.me/${encodeURIComponent(botUsername)}?start=order_${encodeURIComponent(order.token)}`
    : '';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[#5F5C54]">إيصال ومتابعة الطلب</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#1A1A18] tabular-nums">
              طلب #{order.orderId}
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#0F4C3F] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusArabic(order.orderStatus)}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchOrder()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E0D5] text-[#1A1A18] hover:bg-[#F2EFE9]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الحالة</span>
          </button>
        </div>

        {/* Contact & Telegram Tracking Actions */}
        {order.orderStatus === 'new' && (
          <div className="p-4 rounded-xl bg-[#F2EFE9] border border-[#E5E0D5] space-y-3">
            <p className="text-sm text-[#1A1A18] font-medium">
              الخطوة التالية: تواصل معنا لإتمام الدفع وتأكيد الطلب
            </p>
            <div className="flex flex-wrap gap-3">
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال الطلب عبر واتساب</span>
                </a>
              )}
              {tgContactHref && (
                <a
                  href={tgContactHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#E5E0D5] bg-white text-[#1A1A18] text-sm font-medium hover:bg-[#FAF8F4]"
                >
                  <Send className="w-4 h-4 text-[#0F4C3F]" />
                  <span>التواصل عبر تيليجرام</span>
                </a>
              )}
            </div>
          </div>
        )}

        {botTrackHref && (
          <div className="pt-1">
            <a
              href={botTrackHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#0F4C3F] hover:underline"
            >
              <Send className="w-4 h-4" />
              <span>اشترك في إشعارات حالة هذا الطلب عبر بوت تيليجرام</span>
            </a>
          </div>
        )}

        {/* Digital Curriculum Unlock Area */}
        {order.hasDigital && (
          <div className="p-5 rounded-xl border border-[#E5E0D5] bg-[#FAF8F4] space-y-3">
            <h2 className="text-base font-bold text-[#1A1A18]">
              روابط المناهج التعليمية الرقمية
            </h2>
            {order.digitalUnlocked && order.digitalDeliveries.length > 0 ? (
              <ul className="space-y-2">
                {order.digitalDeliveries.map((d) =>
                  isSafeHttpUrl(d.url) ? (
                    <li key={d.productId}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C3F] hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>فتح منهج: {d.productName}</span>
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <p className="text-sm text-[#5F5C54]">
                ستظهر هنا روابط ملفات المنهج على Google Drive تلقائياً فور تأكيد الدفع من قِبل المتجر.
              </p>
            )}
          </div>
        )}

        {/* Order Items & Totals */}
        <div className="pt-4 border-t border-[#E5E0D5]">
          <h2 className="text-sm font-bold text-[#1A1A18] mb-3">تفاصيل المنتجات</h2>
          <div className="divide-y divide-[#E5E0D5]">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between text-sm">
                <span>
                  {item.productName} × <span className="tabular-nums">{item.qty}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {item.lineTotal} {currency}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#E5E0D5] space-y-1.5 text-sm">
            <div className="flex justify-between text-[#5F5C54]">
              <span>المجموع الفرعي</span>
              <span className="tabular-nums">
                {order.subtotal} {currency}
              </span>
            </div>
            <div className="flex justify-between text-[#5F5C54]">
              <span>التوصيل</span>
              <span className="tabular-nums">
                {order.deliveryFee === 0 ? 'مجاني' : `${order.deliveryFee} ${currency}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base text-[#1A1A18] pt-1">
              <span>الإجمالي</span>
              <span className="tabular-nums text-[#0F4C3F]">
                {order.total} {currency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
