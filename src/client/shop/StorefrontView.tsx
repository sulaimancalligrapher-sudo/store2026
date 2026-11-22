import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  GraduationCap,
  Heart,
  MessageCircle,
  Search,
  ShoppingBag,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { Product, StoreBootstrapData, TrainingFormat, TrainingProgram } from '../../shared/types.ts';
import { getProductPriceSummary } from '../../shared/variants.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { PWAInstallButton } from '../components/PWAControls.tsx';

const FORMAT_LABELS: Record<TrainingFormat, string> = {
  online_live: 'عن بُعد مباشر',
  in_person: 'حضوري',
  recorded: 'مسجل بالكامل',
};

interface StorefrontViewProps {
  data: StoreBootstrapData;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onSelectProgram: (program: TrainingProgram) => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  data,
  favorites,
  onToggleFavorite,
  onSelectProduct,
  onQuickAdd,
  onSelectProgram,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'favorites'>('featured');
  const [programFormatFilter, setProgramFormatFilter] = useState<'all' | TrainingFormat>('all');

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
      list = [...list].sort((a, b) => getProductPriceSummary(a).minPrice - getProductPriceSummary(b).minPrice);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => getProductPriceSummary(b).minPrice - getProductPriceSummary(a).minPrice);
    } else if (sortBy === 'featured') {
      list = [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    }
    return list;
  }, [data.products, selectedCategory, searchQuery, sortBy, favorites]);

  const filteredPrograms = useMemo(() => {
    const list = data.programs || [];
    if (programFormatFilter === 'all') return list;
    return list.filter((p) => p.format === programFormatFilter);
  }, [data.programs, programFormatFilter]);

  return (
    <div className="space-y-14 pb-16">
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
              {(data.programs || []).length > 0 && (
                <a
                  href="#programs"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-4 py-2.5 text-sm font-semibold text-[#141413] hover:bg-[#EFECE6] transition-colors whitespace-nowrap shrink-0"
                >
                  <GraduationCap className="h-4 w-4 text-[#B45309]" />
                  <span>البرامج التدريبية</span>
                </a>
              )}
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
              const priceSummary = getProductPriceSummary(product);

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
                        {product.variants.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{product.variants.length} خيارات</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-[#141413] leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F3F1EC]">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-[#141413] tabular-nums">
                          {priceSummary.hasRange ? `ابتداءً من ${priceSummary.minPrice}` : priceSummary.defaultPrice}{' '}
                          {data.settings.currency}
                        </span>
                        {!priceSummary.hasRange &&
                          product.compare_at_price &&
                          product.compare_at_price > priceSummary.defaultPrice && (
                            <span className="text-xs text-[#8A847B] line-through tabular-nums">
                              {product.compare_at_price}
                            </span>
                          )}
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onQuickAdd(product)}
                        aria-label={outOfStock ? 'نفد المخزون' : 'أضف إلى السلة'}
                        title={outOfStock ? 'نفد المخزون' : 'أضف إلى السلة'}
                        className="inline-flex items-center justify-center rounded-lg bg-[#141413] p-2.5 text-white hover:bg-[#2A2A28] disabled:bg-[#D4CFC7] disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
                      >
                        <ShoppingBag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Training Programs Section */}
      {(data.programs || []).length > 0 && (
        <section id="programs" className="mx-auto max-w-6xl px-4 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E2DC] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#B45309]">التأهيل والتطوير العملي</p>
              <h2 className="text-2xl font-bold text-[#141413]">البرامج التدريبية والورش العملية</h2>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3F1EC] p-1">
              {(
                [
                  { id: 'all', label: 'جميع الأنماط' },
                  { id: 'online_live', label: 'عن بُعد مباشر' },
                  { id: 'in_person', label: 'حضوري' },
                  { id: 'recorded', label: 'مسجل' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProgramFormatFilter(item.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    programFormatFilter === item.id
                      ? 'bg-white text-[#141413] shadow-sm'
                      : 'text-[#6E6A63] hover:text-[#141413]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPrograms.length === 0 ? (
            <div className="rounded-xl border border-[#E5E2DC] bg-white py-12 text-center text-sm text-[#6E6A63]">
              لا توجد برامج تدريبية متاحة تحت هذا النمط حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrograms.map((program) => {
                const soldOut = program.seats_left <= 0;
                const isFree = program.price <= 0;
                return (
                  <article
                    key={program.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E2DC] bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="cursor-pointer" onClick={() => onSelectProgram(program)}>
                      <SafeImage
                        src={program.image_url}
                        alt={program.title}
                        aspectClass="aspect-[16/10]"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-5 gap-4">
                      <div className="space-y-2 cursor-pointer" onClick={() => onSelectProgram(program)}>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6E6A63]">
                          <span>{program.category || 'تدريب'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{FORMAT_LABELS[program.format]}</span>
                          {program.instructor && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{program.instructor}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[#141413] leading-snug line-clamp-2">
                          {program.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E6A63] pt-1">
                          {program.duration && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-[#B45309]" />
                              <span>{program.duration}</span>
                            </span>
                          )}
                          {program.start_date && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3.5 w-3.5 text-[#B45309]" />
                              <span>{program.start_date}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#F3F1EC]">
                        <div>
                          <span className="block text-base font-bold text-[#141413] tabular-nums">
                            {isFree ? 'مجاني' : `${program.price} ${data.settings.currency}`}
                          </span>
                          <span className={`block text-[11px] tabular-nums ${soldOut ? 'text-red-700' : 'text-[#6E6A63]'}`}>
                            {soldOut ? 'اكتملت المقاعد' : `متبقي ${program.seats_left} مقعد`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectProgram(program)}
                          className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          التفاصيل والتسجيل
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. Direct Telegram Support Banner */}
      {tgUrl && (
        <section className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E2DC] bg-white p-6 md:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#141413]">هل تحتاج مساعدة قبل الطلب أو التسجيل؟</h2>
              <p className="text-sm text-[#6E6A63]">
                تواصل معنا مباشرة عبر تيليجرام للاستفسار عن المنتجات، مواعيد التوصيل، أو البرامج التدريبية.
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
