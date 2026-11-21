import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { loadSavedOrders } from '../lib/storage';

interface MyOrdersPageProps {
  onNavigate: (path: string) => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ onNavigate }) => {
  const orders = loadSavedOrders();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-[#1A1A18] mb-2">طلباتي السابقة</h1>
      <p className="text-sm text-[#5F5C54] mb-8">
        الطلبات المحفوظة على هذا الجهاز لمتابعة حالتها أو فتح المناهج الرقمية المؤكدة.
      </p>

      {orders.length === 0 ? (
        <div className="bg-white border border-[#E5E0D5] rounded-2xl p-10 text-center space-y-4">
          <p className="text-base font-medium text-[#1A1A18]">لم تقم بأي طلبات من هذا المتصفح بعد</p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium"
          >
            تصفح المتجر
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <a
              key={o.token}
              href={`/o/${o.token}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/o/${o.token}`);
              }}
              className="flex items-center justify-between gap-4 p-5 bg-white border border-[#E5E0D5] rounded-xl hover:border-[#0F4C3F] transition-colors"
            >
              <div>
                <p className="font-bold text-[#1A1A18] tabular-nums">#{o.orderId}</p>
                <p className="text-xs text-[#5F5C54] mt-1 tabular-nums">
                  {new Date(o.createdAt).toLocaleDateString('ar-SA')} · {o.total} {o.currency}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F4C3F]">
                <span>عرض التفاصيل</span>
                <ArrowLeft className="w-4 h-4" />
              </span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
};
