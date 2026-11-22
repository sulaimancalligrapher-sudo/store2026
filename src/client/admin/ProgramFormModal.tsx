import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { TrainingFormat, TrainingProgram } from '../../shared/types.ts';
import { extractGoogleDriveFileId } from '../../shared/imageUrl.ts';
import { SafeImage } from '../components/SafeImage.tsx';

interface ProgramFormModalProps {
  initial?: TrainingProgram | null;
  currency: string;
  onSave: (payload: Partial<TrainingProgram>, isEdit: boolean) => Promise<void>;
  onClose: () => void;
}

export const ProgramFormModal: React.FC<ProgramFormModalProps> = ({
  initial,
  currency,
  onSave,
  onClose,
}) => {
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState(initial?.title || '');
  const [instructor, setInstructor] = useState(initial?.instructor || '');
  const [category, setCategory] = useState(initial?.category || 'تطوير الأعمال');
  const [format, setFormat] = useState<TrainingFormat>(initial?.format || 'online_live');
  const [duration, setDuration] = useState(initial?.duration || '10 ساعات · 3 أيام');
  const [startDate, setStartDate] = useState(initial?.start_date || '2026-12-20');
  const [seatsTotal, setSeatsTotal] = useState(initial ? String(initial.seats_total) : '25');
  const [seatsLeft, setSeatsLeft] = useState(initial ? String(initial.seats_left) : '25');
  const [price, setPrice] = useState(initial ? String(initial.price) : '290');
  const [compareAt, setCompareAt] = useState(initial?.compare_at_price ? String(initial.compare_at_price) : '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const [syllabusText, setSyllabusText] = useState((initial?.syllabus || []).join('\n'));
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
          title: title.trim(),
          instructor: instructor.trim(),
          category: category.trim(),
          format,
          duration: duration.trim(),
          start_date: startDate.trim(),
          seats_total: Math.max(1, Math.floor(Number(seatsTotal || 20))),
          seats_left: Math.max(0, Math.floor(Number(seatsLeft || 0))),
          price: Math.max(0, Number(price || 0)),
          compare_at_price: compareAt ? Math.max(0, Number(compareAt)) : null,
          image_url: imageUrl.trim(),
          syllabus: syllabusText
            .split(/\r?\n/)
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
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ البرنامج التدريبي');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-[#E5E2DC] bg-white shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-[#E5E2DC] px-6 py-4">
          <h3 className="text-lg font-bold text-[#141413]">
            {isEdit ? 'تعديل البرنامج التدريبي' : 'إضافة برنامج تدريبي جديد'}
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
              <label className="mb-1 block text-xs font-medium text-[#44413C]">عنوان البرنامج *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: إدارة المتاجر والأتمتة الذكية"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">المدرب / المحاضر</label>
              <input
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="أ. فيصل القحطاني"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">التخصص / المجال</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="التجارة الإلكترونية"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">نمط التقديم</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TrainingFormat)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              >
                <option value="online_live">عن بُعد مباشر</option>
                <option value="in_person">حضوري</option>
                <option value="recorded">مسجل بالكامل</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">المدة الزمنية</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="12 ساعة · 4 أيام"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">الرسوم ({currency})</label>
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
              <label className="mb-1 block text-xs font-medium text-[#44413C]">إجمالي المقاعد</label>
              <input
                required
                type="number"
                min="1"
                value={seatsTotal}
                onChange={(e) => setSeatsTotal(e.target.value)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">المقاعد المتبقية</label>
              <input
                required
                type="number"
                min="0"
                value={seatsLeft}
                onChange={(e) => setSeatsLeft(e.target.value)}
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-2 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">تاريخ البداية</label>
                  <input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="2026-12-20 أو مفتوح"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">رابط صورة الغلاف *</label>
                  <input
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              {extractGoogleDriveFileId(imageUrl) && (
                <p className="text-[11px] text-emerald-700">
                  ✓ تم التعرف على رابط Google Drive لصورة البرنامج.
                </p>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-[#E5E2DC] bg-[#FAF9F6]">
              <SafeImage src={imageUrl} alt={title || 'معاينة'} aspectClass="aspect-[16/10]" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">
              محاور البرنامج التدريبي (كل محور في سطر مستقل)
            </label>
            <textarea
              rows={4}
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder={'المحور الأول: تأسيس المتجر وربط الشيت\nالمحور الثاني: أتمتة إشعارات تيليجرام\nالمحور الثالث: استراتيجيات التسعير'}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">نبذة عن البرنامج</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب وصفاً موجزاً للفئة المستهدفة ومخرجات البرنامج..."
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
              <span>متاح للتسجيل في الواجهة</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-[#E5E2DC] accent-[#B45309]"
              />
              <span>برنامج مميز</span>
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
              {saving ? 'جاري الحفظ في الشيت...' : isEdit ? 'حفظ التعديلات' : 'إضافة البرنامج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
