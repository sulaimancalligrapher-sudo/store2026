import React from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import type { CartItem, PublicProduct, StoreSettings } from '../types';
import { SafeImage } from './MediaElements';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  products: PublicProduct[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  items,
  products,
  settings,
  onClose,
  onUpdateQty,
  onRemove,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const productMap = new Map(products.map((p) => [p.id, p]));
  const detailed = items
    .map((item) => {
      const product = productMap.get(item.productId);
      return product ? { ...item, product } : null;
    })
    .filter((entry): entry is { productId: string; qty: number; product: PublicProduct } =>
      Boolean(entry),
    );

  const subtotal = detailed.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  const hasPhysical = detailed.some((entry) => entry.product.type === 'physical');
  const freeOver = settings.freeShippingOver;
  const qualifiesFree = freeOver > 0 && subtotal >= freeOver;
  const deliveryFee = !hasPhysical || qualifiesFree ? 0 : settings.deliveryFee;
  const total = subtotal + deliveryFee;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-label="سلة المشتريات">
      <div className="w-full max-w-md bg-[#FAF8F4] h-full flex flex-col border-s border-[#E5E0D5] shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E0D5] bg-white flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1A1A18]">سلة المشتريات</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق السلة"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#5F5C54] hover:bg-[#F2EFE9] hover:text-[#1A1A18]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {detailed.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-base font-medium text-[#1A1A18]">سلتك فارغة حالياً</p>
              <p className="text-sm text-[#5F5C54]">
                أضف أدوات الخط أو المناهج التعليمية التي تناسب مستواك.
              </p>
            </div>
          ) : (
            detailed.map(({ product, qty }) => {
              const maxQty =
                product.type === 'physical' && product.stock >= 0 ? product.stock : 50;

              return (
                <div
                  key={product.id}
                  className="flex gap-4 pb-5 border-b border-[#E5E0D5] last:border-b-0"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#F2EFE9] shrink-0 border border-[#E5E0D5]">
                    <SafeImage
                      src={product.images[0] || ''}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#5F5C54] mb-0.5">
                      {product.type === 'digital' ? 'منهج رقمي' : 'أداة خط · شحن'}
                    </p>
                    <h3 className="text-sm font-semibold text-[#1A1A18] line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-sm font-semibold text-[#0F4C3F] tabular-nums mt-1">
                      {product.price * qty} {settings.currency}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center border border-[#E5E0D5] rounded-lg bg-white">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(product.id, qty - 1)}
                          aria-label="إنقاص الكمية"
                          className="w-9 h-9 inline-flex items-center justify-center text-[#1A1A18] hover:bg-[#F2EFE9]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-sm font-medium tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (qty < maxQty) onUpdateQty(product.id, qty + 1);
                          }}
                          disabled={qty >= maxQty}
                          aria-label="زيادة الكمية"
                          className="w-9 h-9 inline-flex items-center justify-center text-[#1A1A18] hover:bg-[#F2EFE9] disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemove(product.id)}
                        aria-label={`حذف ${product.name}`}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#5F5C54] hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {detailed.length > 0 && (
          <div className="p-6 bg-white border-t border-[#E5E0D5] space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#5F5C54]">
                <span>مجموع المنتجات</span>
                <span className="tabular-nums font-medium text-[#1A1A18]">
                  {subtotal} {settings.currency}
                </span>
              </div>
              <div className="flex justify-between text-[#5F5C54]">
                <span>رسوم التوصيل</span>
                <span className="tabular-nums font-medium text-[#1A1A18]">
                  {deliveryFee === 0 ? 'مجاني' : `${deliveryFee} ${settings.currency}`}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E5E0D5] text-base font-bold text-[#1A1A18]">
                <span>الإجمالي التقديري</span>
                <span className="tabular-nums">
                  {total} {settings.currency}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3 px-5 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] transition-colors"
            >
              إتمام الطلب
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
