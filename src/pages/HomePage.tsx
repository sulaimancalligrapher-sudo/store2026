import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, ShoppingBag } from 'lucide-react';
import type {
  Banner,
  Category,
  PublicProduct,
  StoreSettings,
} from '../types';
import { SafeImage } from '../components/MediaElements';

interface HomePageProps {
  settings: StoreSettings;
  categories: Category[];
  banners: Banner[];
  products: PublicProduct[];
  onNavigate: (path: string) => void;
  onAddToCart: (product: PublicProduct) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  settings,
  categories,
  banners,
  products,
  onNavigate,
  onAddToCart,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const hero = banners[0] || {
    id: 'default',
    imageUrl: '/src/assets/images/hero_calligraphy_atelier_1795243897105.jpg',
    title: 'أدوات الحرف الأصيل ومنهج الإتقان',
    subtitle: settings.tagline,
    buttonText: 'تصفح المجموعة',
    link: '#catalog',
    sort: 1,
    active: true,
  };

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <main>
      {/* 1. Storefront Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
          <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-center">
            <p className="text-xs font-medium text-[#9E7636] mb-3">
              أدوات الخط العربي · مناهج تعليمية رقمية
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#1A1A18] leading-[1.25]">
              {hero.title}
            </h1>
            <p className="mt-4 text-base text-[#5F5C54] leading-relaxed max-w-md">
              {hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0F4C3F] text-white text-sm font-semibold hover:bg-[#0B3A30] transition-colors whitespace-nowrap shrink-0"
              >
                <span>{hero.buttonText || 'تصفح المتجر'}</span>
                <ArrowLeft className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  const courseCat = categories.find((c) => c.id === 'cat_courses');
                  setSelectedCategory(courseCat ? courseCat.id : 'all');
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-3 rounded-lg border border-[#E5E0D5] bg-[#FAF8F4] text-sm font-medium text-[#1A1A18] hover:bg-[#F2EFE9] transition-colors whitespace-nowrap shrink-0"
              >
                المناهج التعليمية
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 min-h-[260px] lg:min-h-[420px] bg-[#F2EFE9]">
            <SafeImage
              src={hero.imageUrl}
              alt={hero.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 2. Featured Collection Grid */}
      <section id="catalog" className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#E5E0D5]">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1A1A18]">
              المقتنيات والمناهج
            </h2>
            <p className="mt-1 text-sm text-[#5F5C54]">
              اطلب الأدوات التي تصلك بالشحن، أو المناهج الرقمية التي تُفتح لك فور تأكيد الدفع.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#5F5C54] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن قلم، ورق، أو منهج..."
              aria-label="بحث في المنتجات"
              className="w-full ps-10 pe-4 py-2.5 text-sm bg-white border border-[#E5E0D5] rounded-lg text-[#1A1A18] placeholder:text-[#5F5C54]/70 focus:outline-none focus:border-[#0F4C3F]"
            />
          </div>
        </div>

        {/* Interactive Category Filter Tabs */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2" role="tablist" aria-label="تصفية حسب القسم">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#0F4C3F] text-white'
                : 'bg-white border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]'
            }`}
          >
            الكل ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-[#0F4C3F] text-white'
                  : 'bg-white border border-[#E5E0D5] text-[#5F5C54] hover:text-[#1A1A18]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="mt-10 bg-white border border-[#E5E0D5] rounded-xl p-12 text-center">
            <p className="text-base font-medium text-[#1A1A18]">
              لا توجد منتجات مطابقة لبحثك حالياً
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 px-5 py-2.5 text-sm font-medium rounded-lg border border-[#E5E0D5] text-[#1A1A18] hover:bg-[#F2EFE9]"
            >
              عرض جميع المنتجات
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const catName = categoryMap.get(product.categoryId) || 'متنوع';
              const isOutOfStock = product.type === 'physical' && product.stock === 0;
              const typeText = product.type === 'digital' ? 'منهج رقمي' : 'أداة شحن';
              const stockText =
                product.type === 'digital'
                  ? 'متاح دائماً'
                  : isOutOfStock
                    ? 'نفدت الكمية'
                    : `متوفر (${product.stock})`;

              return (
                <article
                  key={product.id}
                  className="group bg-white border border-[#E5E0D5] rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <a
                    href={`/p/${product.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(`/p/${product.id}`);
                    }}
                    className="block aspect-[4/3] bg-[#F2EFE9] overflow-hidden"
                  >
                    <SafeImage
                      src={product.images[0] || ''}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </a>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-[#5F5C54]">
                      <span>{catName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{typeText}</span>
                      <span aria-hidden="true">·</span>
                      <span className={isOutOfStock ? 'text-red-700 font-medium' : ''}>
                        {stockText}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-semibold text-[#1A1A18] leading-snug">
                      <a
                        href={`/p/${product.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(`/p/${product.id}`);
                        }}
                        className="hover:text-[#0F4C3F] transition-colors"
                      >
                        {product.name}
                      </a>
                    </h3>

                    <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-[#1A1A18] tabular-nums">
                          {product.price} {settings.currency}
                        </span>
                        {product.oldPrice && (
                          <span className="text-xs text-[#5F5C54] line-through tabular-nums">
                            {product.oldPrice} {settings.currency}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock || !settings.isOpen}
                        onClick={() => onAddToCart(product)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F4C3F] text-white hover:bg-[#0B3A30] disabled:bg-[#E5E0D5] disabled:text-[#5F5C54] transition-colors whitespace-nowrap shrink-0"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{isOutOfStock ? 'نفد' : 'أضف للسلة'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Craftsmanship & Digital Delivery Overview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="border-t border-[#E5E0D5] pt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display text-xl font-bold text-[#1A1A18]">
              01. طلب وحجز بالتواصل المباشر
            </h3>
            <p className="mt-2 text-sm text-[#5F5C54] leading-relaxed">
              لا يلزم الدفع بالبطاقة أثناء الطلب؛ بعد إرسال سلتك تحصل على رقم طلب وتتواصل معنا مباشرة لتأكيد وسيلة الدفع الأنسب لك.
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-[#1A1A18]">
              02. مناهج تعليمية بالصوت والفيديو
            </h3>
            <p className="mt-2 text-sm text-[#5F5C54] leading-relaxed">
              بمجرد تأكيد استلام المبلغ، تُفتح لك روابط المنهج وكراسات التمارين على Google Drive تلقائياً في صفحة متابعة طلبك.
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-[#1A1A18]">
              03. عناية بأدوات الخط العربي
            </h3>
            <p className="mt-2 text-sm text-[#5F5C54] leading-relaxed">
              أقلام القصب، المحابر، وورق الآهار تُجهّز وتُغلّف بعناية مع تحديث تلقائي للمخزون عند اعتماد كل طلب.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
