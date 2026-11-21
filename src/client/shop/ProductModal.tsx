import React, { useState } from 'react';
import { Heart, MessageCircle, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import type { Category, Product, StoreSettings } from '../../shared/types.ts';
import { SafeImage } from '../components/SafeImage.tsx';

interface ProductModalProps {
  product: Product;
  category?: Category;
  settings: StoreSettings;
  isFavorite: boolean;
  onToggleFavorite: (productId: string) => void;
  onAddToCart: (product: Product, qty: number, variant: string) => void;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  category,
  settings,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onClose,
}) => {
  const images = [product.image_url, ...(product.gallery_urls || [])].filter(Boolean);
  const [activeImage, setActiveImage] = useState(images[0] || '');
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0] || '');
  const [qty, setQty] = useState(1);

  const outOfStock = product.stock <= 0;
  const tgUrl = settings.telegram_username
    ? `https://t.me/${settings.telegram_username.replace(/^@/, '')}`
    : '';

  const handleAdd = () => {
    if (outOfStock) return;
    onAddToCart(product, qty, selectedVariant);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl border border-[#E5E2DC] bg-white shadow-2xl overflow-hidden my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 z-10 rounded-lg border border-[#E5E2DC] bg-white/95 p-2 text-[#141413] hover:bg-[#F3F1EC] cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Gallery */}
          <div className="bg-[#FAF9F6] p-5 flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg border border-[#E5E2DC]">
              <SafeImage src={activeImage} alt={product.name} aspectClass="aspect-[4/3]" />
            </div>
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`w-20 shrink-0 overflow-hidden rounded-md border transition-all cursor-pointer ${
                      activeImage === img ? 'border-[#141413] ring-1 ring-[#141413]' : 'border-[#E5E2DC] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <SafeImage src={img} alt={`${product.name} ${idx + 1}`} aspectClass="aspect-[4/3]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contiguous Purchase Module */}
          <div className="p-6 md:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#6E6A63]">
                <span>{category?.name || 'مقتنيات مختارة'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{product.sku || product.id}</span>
                <span aria-hidden="true">·</span>
                <span className={outOfStock ? 'text-red-700 font-medium' : 'text-emerald-800 font-medium'}>
                  {outOfStock ? 'نفد المخزون' : `متوفر (${product.stock})`}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-[#141413] leading-snug">{product.name}</h2>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-[#141413] tabular-nums">
                  {product.price} {settings.currency}
                </span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="text-base text-[#8A847B] line-through tabular-nums">
                    {product.compare_at_price} {settings.currency}
                  </span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-[#44413C]">{product.description}</p>

              {product.variants.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-semibold text-[#141413]">اختر الخيار:</span>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedVariant === variant
                            ? 'border-[#141413] bg-[#141413] text-white'
                            : 'border-[#E5E2DC] bg-white text-[#44413C] hover:border-[#141413]'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-[#E5E2DC] pt-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-[#E5E2DC] bg-[#FAF9F6]">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-[#141413] hover:bg-[#EFECE6] rounded-r-lg cursor-pointer"
                    aria-label="إنقاص الكمية"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                    className="p-2.5 text-[#141413] hover:bg-[#EFECE6] rounded-l-lg cursor-pointer"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={handleAdd}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#141413] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:bg-[#D4CFC7] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>{outOfStock ? 'غير متوفر حالياً' : 'أضف إلى السلة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                    isFavorite
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-[#E5E2DC] bg-white text-[#6E6A63] hover:text-[#141413]'
                  }`}
                  aria-label="المفضلة"
                >
                  <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              {tgUrl && (
                <a
                  href={tgUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] py-2.5 text-xs font-medium text-[#141413] hover:bg-[#EFECE6] transition-colors"
                >
                  <MessageCircle className="h-4 w-4 text-[#0088cc]" />
                  <span>استفسر عن المنتج مباشرة عبر تيليجرام</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
