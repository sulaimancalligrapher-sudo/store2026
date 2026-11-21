import React, { useMemo, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Search, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import type { Product, StoreBootstrapData } from '../../shared/types.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { PWAInstallButton } from '../components/PWAControls.tsx';

interface StorefrontViewProps {
  data: StoreBootstrapData;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  data,
  favorites,
  onToggleFavorite,
  onSelectProduct,
  onQuickAdd,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'favorites'>('featured');

  const heroBanner = data.banners[0];
  const tgUrl = data.settings.telegram_username
    ? `https://t.me/${data.settings.telegram_username.replace(/^@/, '')}`
    : '';

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.products.filter((p) => {
      const catMatch = selectedCategory === 'all' || p.category_id === selectedCategory;
      const qMatch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const favMatch = sortBy !== 'favorites' || favorites.includes(p.id);
      return catMatch && qMatch && favMatch;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'featured') {
      list = [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    }
    return list;
  }, [data.products, selectedCategory, searchQuery, sortBy, favorites]);

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Storefront Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-hidden rounded-2xl border border-[#E5E2DC] bg-white">
          <div className="lg:col-span-6 p-7 md:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <p className="text-xs font-medium text-[#B45309]">
                تشكيلة {data.settings.store_name} · شحن سريع لجميع المدن
              </p>
              <h1
                className="text-3xl md:text-4xl font-extrabold text-[#141413] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {heroBanner?.title || data.settings.store_name}
              </h1>
              <p className="text-sm md:text-base text-[#44413C] leading-relaxed max-w-lg">
                {heroBanner?.subtitle || data.settings.store_tagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] transition-colors whitespace-nowrap shrink-0"
              >
                <span>تصفح المنتجات</span>
                <ArrowLeft className="h-4 w-4" />
              </a>
              <PWAInstallButton variant="outline" />
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#EFECE6]">
            <SafeImage
              src={heroBanner?.image_url || '/src/assets/images/hero_nukhba_banner_1795253789582.jpg'}
              alt={heroBanner?.title || data.settings.store_name}
              aspectClass="aspect-[16/9] lg:h-full lg:aspect-auto"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Store Trust Strip */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E2DC] bg-white px-4 py-3.5">
            <Truck className="h-5 w-5 text-[#B45309] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141413]">تسعيرة توصيل لكل مدينة</p>
              <p className="text-xs text-[#6E6A63]">
                شحن مجاني فوق {data.settings.free_shipping_min} {data.settings.currency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E2DC] bg-white px-4 py-3.5">
            <MessageCircle className="h-5 w-5 text-[#0088cc] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141413]">متابعة فورية عبر تيليجرام</p>
              <p className="text-xs text-[#6E6A63]">إشعارات الطلبات وتأكيدها لحظياً</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E2DC] bg-white px-4 py-3.5">
            <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141413]">الدفع عند الاستلام أو تحويل بنكي</p>
              <p className="text-xs text-[#6E6A63]">أسعار وكوبونات محققة بالكامل في السيرفر</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Catalog Filter & Product Grid */}
      <section id="catalog" className="mx-auto max-w-6xl px-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3F1EC] p-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all' ? 'bg-white text-[#141413] shadow-sm' : 'text-[#6E6A63] hover:text-[#141413]'
              }`}
            >
              الكل ({data.products.length})
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-[#141413] shadow-sm'
                    : 'text-[#6E6A63] hover:text-[#141413]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A847B]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full rounded-lg border border-[#E5E2DC] bg-white pr-9 pl-3 py-2 text-xs text-[#141413] focus:border-[#141413] focus:outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-medium text-[#141413] focus:outline-none"
            >
              <option value="featured">الأكثر تميزاً</option>
              <option value="price_asc">السعر: من الأقل</option>
              <option value="price_desc">السعر: من الأعلى</option>
              <option value="favorites">المفضلة ({favorites.length})</option>
            </select>
          </div>
        </div>

        {/* 3-Column Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-[#E5E2DC] bg-white py-16 text-center space-y-2">
            <p className="text-base font-semibold text-[#141413]">لا توجد منتجات مطابقة لبحثك</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setSortBy('featured');
              }}
              className="text-xs font-semibold text-[#B45309] underline cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const cat = data.categories.find((c) => c.id === product.category_id);
              const isFav = favorites.includes(product.id);
              const outOfStock = product.stock <= 0;

              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E2DC] bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative cursor-pointer" onClick={() => onSelectProduct(product)}>
                    <SafeImage
                      src={product.image_url}
                      alt={product.name}
                      aspectClass="aspect-[4/3]"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(product.id);
                      }}
                      className={`absolute top-3 left-3 rounded-lg border p-2 transition-colors cursor-pointer ${
                        isFav
                          ? 'border-red-200 bg-white text-red-600'
                          : 'border-[#E5E2DC] bg-white/90 text-[#6E6A63] hover:text-[#141413]'
                      }`}
                      aria-label="إضافة للمفضلة"
                    >
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4 gap-4">
                    <div className="space-y-1.5 cursor-pointer" onClick={() => onSelectProduct(product)}>
                      <div className="flex items-center gap-1.5 text-xs text-[#6E6A63]">
                        <span>{cat?.name || 'مختارات'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{outOfStock ? 'نفد المخزون' : `متوفر (${product.stock})`}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#141413] leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F3F1EC]">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-[#141413] tabular-nums">
                          {product.price} {data.settings.currency}
                        </span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-xs text-[#8A847B] line-through tabular-nums">
                            {product.compare_at_price}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onQuickAdd(product)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] disabled:bg-[#D4CFC7] disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>{outOfStock ? 'نفد' : 'أضف للسلة'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Direct Telegram Support Banner */}
      {tgUrl && (
        <section className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E2DC] bg-white p-6 md:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#141413]">هل تحتاج مساعدة قبل الطلب؟</h2>
              <p className="text-sm text-[#6E6A63]">
                تواصل معنا مباشرة عبر تيليجرام للاستفسار عن المقاسات أو مواعيد التوصيل لمدينتك.
              </p>
            </div>
            <a
              href={tgUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0088cc] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b3] transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="h-4 w-4" />
              <span>محادثة تيليجرام الفورية</span>
            </a>
          </div>
        </section>
      )}
    </div>
  );
};
