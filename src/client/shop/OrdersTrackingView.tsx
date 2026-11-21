import React, { useState } from 'react';
import { PackageSearch, RefreshCw } from 'lucide-react';
import type { Order, OrderStatus, StoreSettings } from '../../shared/types.ts';
import { storeApi } from '../lib/api.ts';

const STATUS_AR: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  confirmed: { label: 'تم التأكيد', color: 'text-sky-800 bg-sky-50 border-sky-200' },
  shipped: { label: 'جاري التوصيل', color: 'text-indigo-800 bg-indigo-50 border-indigo-200' },
  delivered: { label: 'تم التسليم', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'ملغي', color: 'text-red-800 bg-red-50 border-red-200' },
};

interface OrdersTrackingViewProps {
  savedOrders: Order[];
  settings: StoreSettings;
  onUpdateSavedOrder: (order: Order) => void;
}

export const OrdersTrackingView: React.FC<OrdersTrackingViewProps> = ({
  savedOrders,
  settings,
  onUpdateSavedOrder,
}) => {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await storeApi.trackOrder(orderIdInput.trim(), phoneInput.trim());
      setTrackedOrder(res.order);
      onUpdateSavedOrder(res.order);
    } catch (err) {
      setTrackedOrder(null);
      setErrorMsg(err instanceof Error ? err.message : 'تعذر العثور على الطلب');
    } finally {
      setLoading(false);
    }
  };

  const refreshSaved = async (order: Order) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await storeApi.trackOrder(order.id, order.customer_phone);
      onUpdateSavedOrder(res.order);
      setTrackedOrder(res.order);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحديث حالة الطلب');
    } finally {
      setLoading(false);
    }
  };

  const renderOrderCard = (order: Order, allowRefresh = false) => {
    const st = STATUS_AR[order.status] || STATUS_AR.pending;
    return (
      <div key={order.id} className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E2DC] pb-3">
          <div>
            <span className="font-mono-num text-base font-bold text-[#141413]">{order.id}</span>
            <p className="text-xs text-[#6E6A63] mt-0.5">
              {new Date(order.created_at).toLocaleString('ar-SA')} · {order.customer_city}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${st.color}`}>
              {st.label}
            </span>
            {allowRefresh && (
              <button
                type="button"
                onClick={() => refreshSaved(order)}
                className="rounded-lg border border-[#E5E2DC] p-1.5 text-[#6E6A63] hover:text-[#141413] cursor-pointer"
                title="تحديث الحالة من السيرفر"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {order.items.map((item, idx) => (
            <div key={`${item.product_id}-${idx}`} className="flex justify-between text-[#44413C]">
              <span>
                {item.name} {item.variant ? `(${item.variant})` : ''} × {item.qty}
              </span>
              <span className="tabular-nums font-medium text-[#141413]">
                {item.line_total} {settings.currency}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2DC] pt-3 text-sm">
          <span className="text-xs text-[#6E6A63]">
            {order.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}
            {order.coupon_code ? ` · كوبون ${order.coupon_code}` : ''}
          </span>
          <span className="font-bold text-[#141413] tabular-nums">
            الإجمالي: {order.total} {settings.currency}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[#141413]">تتبع الطلبات وطلباتي</h1>
        <p className="text-sm text-[#6E6A63]">
          استعلم عن حالة طلبك مباشرة من قاعدة بيانات Google Sheets عبر رقم الطلب ورقم الجوال.
        </p>
      </div>

      <form
        onSubmit={handleLookup}
        className="rounded-xl border border-[#E5E2DC] bg-white p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#44413C]">رقم الطلب</label>
          <input
            required
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="مثال: ORD-1041"
            className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm font-mono-num text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#44413C]">رقم الجوال المستخدم في الطلب</label>
          <input
            required
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="05xxxxxxxx"
            className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm tabular-nums text-[#141413] focus:border-[#141413] focus:bg-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
        >
          <PackageSearch className="h-4 w-4" />
          <span>{loading ? 'جاري البحث...' : 'تتبع الطلب'}</span>
        </button>
      </form>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>
      )}

      {trackedOrder && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#141413]">نتيجة البحث</h2>
          {renderOrderCard(trackedOrder)}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#141413]">طلباتي المحفوظة على هذا الجهاز</h2>
        {savedOrders.length === 0 ? (
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 text-center text-sm text-[#6E6A63]">
            لم تقم بإرسال أي طلبات من هذا المتصفح بعد.
          </div>
        ) : (
          <div className="space-y-4">{savedOrders.map((o) => renderOrderCard(o, true))}</div>
        )}
      </div>
    </section>
  );
};
