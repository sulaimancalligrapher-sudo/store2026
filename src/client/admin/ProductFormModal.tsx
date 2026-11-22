import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Category, Product } from '../../shared/types.ts';
import { extractGoogleDriveFileId } from '../../shared/imageUrl.ts';
import { SafeImage } from '../components/SafeImage.tsx';

const PRESET_IMAGES = [
  { label: 'سماعة رأس لاسلكية', url: '/src/assets/images/product_wireless_headphones_1795253790126.jpg' },
  { label: 'إبريق قهوة مختصة', url: '/src/assets/images/product_espresso_kettle_1795253788869.jpg' },
  { label: 'حافظة لابتوب جلد', url: '/src/assets/images/product_leather_sleeve_1795253789520.jpg' },
  { label: 'مصباح مكتب معماري', url: '/src/assets/images/product_smart_desk_lamp_1795253790257.jpg' },
];

interface ProductFormModalProps {
  initial?: Product | null;
  categories: Category[];
  currency: string;
  onSave: (payload: Partial<Product>, isEdit: boolean) => Promise<void>;
  onClose: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  initial,
  categories,
  currency,
  onSave,
  onClose,
}) => {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name || '');
  const [categoryId, setCategoryId] = useState(initial?.category_id || categories[0]?.id || '');
  const [sku, setSku] = useState(initial?.sku || '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [compareAt, setCompareAt] = useState(initial?.compare_at_price ? String(initial.compare_at_price) : '');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '10');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || PRESET_IMAGES[0].url);
  const [galleryText, setGalleryText] = useState((initial?.gallery_urls || []).join(', '));
  const [variantsText, setVariantsText] = useState((initial?.variants || []).join('، '));
  const [description, setDescription] = useState(initial?.description || '');
  const [isFeatured, setIsFeatured] = useState(initial ? initial.is_featured : true);
  const [isActive, setIsActive] = useState(initial ? initial.is_active : true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      await onSave(
        {
          id: initial?.id,
          name: name.trim(),
          category_id: categoryId,
          sku: sku.trim(),
          price: Number(price || 0),
          compare_at_price: compareAt ? Number(compareAt) : null,
          stock: Math.max(0, Math.floor(Number(stock || 0))),
          image_url: imageUrl.trim(),
          gallery_urls: galleryText
            .split(/[،,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          variants: variantsText
            .split(/[،,]/)
            .map((s) => s.trim())
            .filter(Boolean),
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
              <label className="mb-1 block text-xs font-medium text-[#44413C]">القسم *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">السعر ({currency}) *</label>
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
              <label className="mb-1 block text-xs font-medium text-[#44413C]">رمز الصنف (SKU)</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="NKH-01"
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
                  يقبل الروابط المباشرة أو روابط مشاركة Google Drive بصلاحية «أي شخص لديه الرابط».
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_IMAGES.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className="rounded-md border border-[#E5E2DC] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#44413C] hover:border-[#141413] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#E5E2DC]">
              <SafeImage src={imageUrl} alt={name || 'معاينة الصورة'} aspectClass="aspect-[4/3]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">
                الخيارات / المقاسات / الألوان (مفصولة بفاصلة)
              </label>
              <input
                value={variantsText}
                onChange={(e) => setVariantsText(e.target.value)}
                placeholder="أسود مطفي، رمادي حجري"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
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
              <p className="mt-1 text-[11px] text-[#6E6A63]">يدعم روابط Google Drive أو الروابط المباشرة مفصولة بفاصلة.</p>
            </div>
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
