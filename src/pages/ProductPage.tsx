import React, { useState } from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { Category, PublicProduct, StoreSettings } from '../types';
import { MediaPreviewPlayer, SafeImage } from '../components/MediaElements';

interface ProductPageProps {
  product: PublicProduct | undefined;
  categories: Category[];
  settings: StoreSettings;
  onNavigate: (path: string) => void;
  onAddToCart: (product: PublicProduct, qty: number) => void;
}

export const ProductPage: React.FC<ProductPageProps> = ({
  product,
  categories,
  settings,
  onNavigate,
  onAddToCart,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-[#1A1A18]">المنتج غير موجود</h1>
        <p className="mt-2 text-sm text-[#5F5C54]">قد يكون تم إيقاف هذا المنتج أو تغيّر رابطه.</p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-6 px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium"
        >
          العودة إلى المتجر
        </button>
      </main>
    );
  }

  const category = categories.find((c) => c.id === product.categoryId);
  const isOutOfStock = product.type === 'physical' && product.stock === 0;
  const maxQty = product.type === 'physical' && product.stock >= 0 ? product.stock : 20;
  const images = product.images.length > 0 ? product.images : [''];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-12">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5F5C54] hover:text-[#1A1A18] mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة إلى المنتجات</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Start: Product Gallery & Google Drive Preview Media */}
        <div className="lg:col-span-7 space-y-5">
          <div className="aspect-[4/3] bg-[#F2EFE9] border border-[#E5E0D5] rounded-2xl overflow-hidden">
            <SafeImage
              src={images[selectedImageIdx] || images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border transition-colors shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-[#0F4C3F] ring-2 ring-[#0F4C3F]/20'
                      : 'border-[#E5E0D5]'
                  }`}
                >
                  <SafeImage src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {product.previewMedia && (
            <div className="pt-2 space-y-2">
              <h2 className="text-base font-semibold text-[#1A1A18]">معاينة توضيحية</h2>
              <MediaPreviewPlayer url={product.previewMedia} title={product.name} />
            </div>
          )}
        </div>

        {/* Right/End: Contiguous Purchase Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F5C54]">
              <span>{category?.name || 'مقتنيات'}</span>
              <span aria-hidden="true">·</span>
              <span>{product.type === 'digital' ? 'منهج رقمي (Google Drive)' : 'أداة خط مادية'}</span>
              {product.sku && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{product.sku}</span>
                </>
              )}
            </div>

            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#1A1A18] leading-snug">
              {product.name}
            </h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#0F4C3F] tabular-nums">
                {product.price} {settings.currency}
              </span>
              {product.oldPrice && (
                <span className="text-sm text-[#5F5C54] line-through tabular-nums">
                  {product.oldPrice} {settings.currency}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-[#5F5C54] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>

          <div className="pt-4 border-t border-[#E5E0D5] space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#5F5C54]">التوفر</span>
              <span className={`font-medium ${isOutOfStock ? 'text-red-700' : 'text-[#1A1A18]'}`}>
                {product.type === 'digital'
                  ? 'متاح للتسليم الرقمي بعد التأكيد'
                  : isOutOfStock
                    ? 'نفدت الكمية حالياً'
                    : `متوفر (${product.stock} قطعة)`}
              </span>
            </div>

            {product.type === 'physical' && !isOutOfStock && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5F5C54]">الكمية</span>
                <div className="inline-flex items-center border border-[#E5E0D5] rounded-lg bg-[#FAF8F4]">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="إنقاص الكمية"
                    className="w-10 h-10 inline-flex items-center justify-center hover:bg-[#F2EFE9]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    aria-label="زيادة الكمية"
                    className="w-10 h-10 inline-flex items-center justify-center hover:bg-[#F2EFE9]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isOutOfStock || !settings.isOpen}
              onClick={() => onAddToCart(product, qty)}
              className="w-full py-3.5 px-6 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] disabled:bg-[#E5E0D5] disabled:text-[#5F5C54] transition-colors inline-flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {!settings.isOpen
                  ? 'المتجر مغلق مؤقتاً'
                  : isOutOfStock
                    ? 'نفدت الكمية'
                    : 'أضف إلى السلة'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact mobile sticky bar (within 15% mobile viewport height cap) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E5E0D5] px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#5F5C54] truncate max-w-[160px]">{product.name}</p>
          <p className="text-base font-bold text-[#0F4C3F] tabular-nums">
            {product.price} {settings.currency}
          </p>
        </div>
        <button
          type="button"
          disabled={isOutOfStock || !settings.isOpen}
          onClick={() => onAddToCart(product, qty)}
          className="px-5 py-2.5 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold disabled:bg-[#E5E0D5] disabled:text-[#5F5C54] whitespace-nowrap shrink-0"
        >
          {isOutOfStock ? 'نفد' : 'أضف للسلة'}
        </button>
      </div>
    </main>
  );
};
