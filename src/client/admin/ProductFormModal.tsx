import React, { useState } from 'react';
import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { Category, Product, ProductVariantOption } from '../../shared/types.ts';
import { extractGoogleDriveFileId } from '../../shared/imageUrl.ts';
import { SafeImage } from '../components/SafeImage.tsx';

function generateAutoSku(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const stamp = Date.now().toString().slice(-3);
  return `NKH-${stamp}${rand}`;
}

interface VariantRowState {
  label: string;
  priceText: string;
}

interface ProductFormModalProps {
  initial?: Product | null;
  categories: Category[];
  currency: string;
  onSave: (payload: Partial<Product>, isEdit: boolean) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<void>;
  onClose: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  initial,
  categories,
  currency,
  onSave,
  onCreateCategory,
  onDeleteCategory,
  onClose,
}) => {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name || '');
  const [categoryId, setCategoryId] = useState(initial?.category_id || categories[0]?.id || '');
  const [sku, setSku] = useState(initial?.sku || (isEdit ? '' : generateAutoSku()));
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [compareAt, setCompareAt] = useState(initial?.compare_at_price ? String(initial.compare_at_price) : '');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '10');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const [galleryText, setGalleryText] = useState((initial?.gallery_urls || []).join(', '));
  const [variantRows, setVariantRows] = useState<VariantRowState[]>(() => {
    if (initial?.variants && initial.variants.length > 0) {
      return initial.variants.map((v) => ({
        label: v.label,
        priceText: v.price !== null && v.price !== undefined ? String(v.price) : '',
      }));
    }
    return [];
  });
  const [description, setDescription] = useState(initial?.description || '');
  const [isFeatured, setIsFeatured] = useState(initial ? initial.is_featured : true);
  const [isActive, setIsActive] = useState(initial ? initial.is_active : true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(false);

  const handleAddCategory = async () => {
    const clean = newCatName.trim();
    if (!clean) return;
    setErrorMsg('');
    setCatBusy(true);
    try {
      const created = await onCreateCategory(clean);
      setCategoryId(created.id);
      setNewCatName('');
      setAddingCat(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إضافة القسم الجديد');
    } finally {
      setCatBusy(false);
    }
  };

  const handleDeleteSelectedCategory = async () => {
    if (!categoryId) return;
    setErrorMsg('');
    setCatBusy(true);
    try {
      const remaining = categories.filter((c) => c.id !== categoryId);
      await onDeleteCategory(categoryId);
      setCategoryId(remaining[0]?.id || '');
      setConfirmDeleteCat(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حذف القسم');
    } finally {
      setCatBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!categoryId) {
      setErrorMsg('يرجى اختيار قسم أو إضافة قسم جديد أولاً.');
      return;
    }

    const structuredVariants: ProductVariantOption[] = variantRows
      .map((row) => {
        const cleanLabel = row.label.trim();
        if (!cleanLabel) return null;
        const cleanPriceStr = row.priceText.trim();
        const parsedPrice = cleanPriceStr !== '' ? Number(cleanPriceStr) : NaN;
        return {
          label: cleanLabel,
          price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
        };
      })
      .filter((v): v is ProductVariantOption => v !== null);

    setSaving(true);
    try {
      await onSave(
        {
          id: initial?.id,
          name: name.trim(),
          category_id: categoryId,
          sku: sku.trim() || generateAutoSku(),
          price: Number(price || 0),
          compare_at_price: compareAt ? Number(compareAt) : null,
          stock: Math.max(0, Math.floor(Number(stock || 0))),
          image_url: imageUrl.trim(),
          gallery_urls: galleryText
            .split(/[،,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          variants: structuredVariants,
          description: description.trim(),
          is_featured: isFeatured,
          is_active: isActive,
        },
        isEdit
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-[#E5E2DC] bg-white shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-[#E5E2DC] px-6 py-4">
          <h3 className="text-lg font-bold text-[#141413]">
            {isEdit ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد إلى Google Sheets'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6E6A63] hover:bg-[#F3F1EC] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">اسم المنتج *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مطحنة قهوة يدوية احترافية"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-[#44413C]">القسم *</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={catBusy}
                    onClick={() => {
                      setAddingCat((v) => !v);
                      setConfirmDeleteCat(false);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[#E5E2DC] bg-[#FAF9F6] px-2 py-0.5 text-[11px] font-medium text-[#141413] hover:bg-[#EFECE6] cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>قسم جديد</span>
                  </button>
                  {categoryId && categories.length > 0 && !confirmDeleteCat && (
                    <button
                      type="button"
                      disabled={catBusy}
                      title="حذف القسم المحدد"
                      onClick={() => {
                        setConfirmDeleteCat(true);
                        setAddingCat(false);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#E5E2DC] bg-[#FAF9F6] px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>

              <select
                required
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setConfirmDeleteCat(false);
                }}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              >
                {categories.length === 0 && <option value="">لا توجد أقسام — أضف قسماً جديداً</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {addingCat && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] p-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="اكتب اسم القسم الجديد..."
                    className="flex-1 rounded border border-[#E5E2DC] bg-white px-2.5 py-1.5 text-xs focus:border-[#141413] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={catBusy || !newCatName.trim()}
                    onClick={handleAddCategory}
                    className="rounded bg-[#141413] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                  >
                    {catBusy ? '...' : 'إضافة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCat(false);
                      setNewCatName('');
                    }}
                    className="rounded border border-[#E5E2DC] bg-white px-2.5 py-1.5 text-xs text-[#6E6A63] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              )}

              {confirmDeleteCat && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  <span>
                    تأكيد حذف «{categories.find((c) => c.id === categoryId)?.name}»؟
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={catBusy}
                      onClick={handleDeleteSelectedCategory}
                      className="rounded bg-red-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                    >
                      {catBusy ? '...' : 'نعم، احذف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCat(false)}
                      className="rounded border border-red-200 bg-white px-2.5 py-1 text-[11px] text-[#44413C] cursor-pointer"
                    >
                      تراجع
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">السعر الأساسي ({currency}) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">السعر قبل الخصم</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="اختياري"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">المخزون *</label>
              <input
                required
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-1">
                <label className="block text-xs font-medium text-[#44413C]">رمز الصنف (SKU)</label>
                <button
                  type="button"
                  onClick={() => setSku(generateAutoSku())}
                  title="توليد رمز صنف تلقائي جديد"
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#B45309] hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <span>تلقائي</span>
                </button>
              </div>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="تلقائي أو اكتب رمزك"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-medium text-[#44413C]">رابط الصورة الرئيسية *</label>
              <input
                required
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing أو رابط صورة مباشر"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
              {extractGoogleDriveFileId(imageUrl) ? (
                <p className="text-[11px] font-medium text-emerald-700">
                  ✓ تم التعرف على رابط Google Drive وسيتم تحويله وعرضه تلقائياً (تأكد أن المشاركة «أي شخص لديه الرابط»).
                </p>
              ) : (
                <p className="text-[11px] text-[#6E6A63]">
                  أدخل رابط الصورة المباشر أو رابط مشاركة Google Drive بصلاحية «أي شخص لديه الرابط».
                </p>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-[#E5E2DC] bg-[#FAF9F6]">
              <SafeImage src={imageUrl} alt={name || 'معاينة الصورة'} aspectClass="aspect-[4/3]" />
            </div>
          </div>

          {/* Per-Variant Custom Pricing Builder */}
          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#141413]">الخيارات والمقاسات مع تسعير مخصص لكل خيار</p>
                <p className="text-[11px] text-[#6E6A63]">
                  أضف مثلاً «حجم صغير» بسعر مختلف عن «حجم كبير». اترك السعر فارغاً لاستخدام السعر الأساسي.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantRows((prev) => [...prev, { label: '', priceText: '' }])}
                className="inline-flex items-center gap-1 rounded-lg border border-[#141413] bg-white px-3 py-1.5 text-xs font-semibold text-[#141413] hover:bg-[#141413] hover:text-white transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة خيار</span>
              </button>
            </div>

            {variantRows.length > 0 && (
              <div className="space-y-2">
                {variantRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <input
                        value={row.label}
                        onChange={(e) =>
                          setVariantRows((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                          )
                        }
                        placeholder="اسم الخيار (مثال: 16 بوصة - بني)"
                        className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.priceText}
                        onChange={(e) =>
                          setVariantRows((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, priceText: e.target.value } : item))
                          )
                        }
                        placeholder={`السعر (${price || 'الأساسي'} ${currency})`}
                        className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs tabular-nums focus:border-[#141413] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setVariantRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-lg p-1.5 text-[#8A847B] hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        title="حذف الخيار"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">
              روابط صور إضافية (اختياري، مفصولة بفاصلة)
            </label>
            <input
              value={galleryText}
              onChange={(e) => setGalleryText(e.target.value)}
              placeholder="https://drive.google.com/file/d/.../view?usp=sharing, https://..."
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">وصف المنتج</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب مواصفات المنتج ومميزاته..."
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[#E5E2DC] accent-[#141413]"
              />
              <span>متاح للبيع في المتجر</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-[#E5E2DC] accent-[#B45309]"
              />
              <span>تمييز المنتج في الصفحة الرئيسية</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E2DC] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E5E2DC] px-4 py-2.5 text-sm font-medium text-[#44413C] hover:bg-[#FAF9F6] cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#141413] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'جاري الحفظ في الشيت...' : isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
