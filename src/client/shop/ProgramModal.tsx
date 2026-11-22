import React, { useState } from 'react';
import { Calendar, Check, CheckCircle2, Clock, Copy, MessageCircle, Users, X } from 'lucide-react';
import type { ProgramEnrollment, StoreSettings, TrainingFormat, TrainingProgram } from '../../shared/types.ts';
import { storeApi } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';

const FORMAT_LABELS: Record<TrainingFormat, string> = {
  online_live: 'عن بُعد مباشر',
  in_person: 'حضوري',
  recorded: 'مسجل بالكامل',
};

interface ProgramModalProps {
  program: TrainingProgram;
  settings: StoreSettings;
  onEnrolled: () => void;
  onClose: () => void;
}

export const ProgramModal: React.FC<ProgramModalProps> = ({
  program,
  settings,
  onEnrolled,
  onClose,
}) => {
  const isFree = program.price <= 0;
  const soldOut = program.seats_left <= 0;
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer' | 'free'>(
    isFree ? 'free' : settings.bank_transfer_enabled ? 'bank_transfer' : 'cod'
  );
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [enrollment, setEnrollment] = useState<ProgramEnrollment | null>(null);
  const [tgNotified, setTgNotified] = useState(false);
  const [copiedIban, setCopiedIban] = useState(false);

  const tgUrl = settings.telegram_username
    ? `https://t.me/${settings.telegram_username.replace(/^@/, '')}`
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soldOut || submitting) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await storeApi.createEnrollment({
        program_id: program.id,
        student_name: studentName.trim(),
        student_phone: studentPhone.trim(),
        telegram_username: telegramUsername.trim(),
        payment_method: isFree ? 'free' : paymentMethod,
        bank_reference: bankReference.trim(),
        notes: notes.trim(),
      });
      setEnrollment(res.enrollment);
      setTgNotified(res.telegramNotified);
      onEnrolled();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تسجيل الطلب حالياً.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyIban = () => {
    navigator.clipboard.writeText(settings.bank_iban);
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
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

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left/Right Info Column */}
          <div className="md:col-span-6 bg-[#FAF9F6] p-6 space-y-5 border-b md:border-b-0 md:border-l border-[#E5E2DC]">
            <div className="overflow-hidden rounded-lg border border-[#E5E2DC]">
              <SafeImage src={program.image_url} alt={program.title} aspectClass="aspect-[16/10]" />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6A63]">
                <span>{program.category || 'برنامج تدريبي'}</span>
                <span aria-hidden="true">·</span>
                <span>{FORMAT_LABELS[program.format]}</span>
                {program.instructor && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>المدرب: {program.instructor}</span>
                  </>
                )}
              </div>

              <h2 className="text-xl font-bold text-[#141413] leading-snug">{program.title}</h2>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-[#141413] tabular-nums">
                  {isFree ? 'مجاني' : `${program.price} ${settings.currency}`}
                </span>
                {program.compare_at_price && program.compare_at_price > program.price && (
                  <span className="text-sm text-[#8A847B] line-through tabular-nums">
                    {program.compare_at_price} {settings.currency}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-[#44413C]">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
                  <span className="truncate">{program.duration || 'مرن'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
                  <span className="tabular-nums truncate">{program.start_date || 'تسجيل مفتوح'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
                  <span className={`tabular-nums ${soldOut ? 'text-red-700 font-semibold' : ''}`}>
                    {soldOut ? 'مكتمل' : `${program.seats_left} مقعد متاح`}
                  </span>
                </div>
              </div>

              {program.description && (
                <p className="text-sm leading-relaxed text-[#44413C] pt-1">{program.description}</p>
              )}

              {program.syllabus.length > 0 && (
                <div className="space-y-2 border-t border-[#E5E2DC] pt-4">
                  <h3 className="text-xs font-bold text-[#141413]">محاور البرنامج التدريبي:</h3>
                  <ol className="space-y-1.5 text-xs text-[#44413C]">
                    {program.syllabus.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="font-mono-num font-bold text-[#B45309] shrink-0">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Enrollment Form / Receipt Column */}
          <div className="md:col-span-6 p-6 md:p-7 flex flex-col justify-center">
            {enrollment ? (
              <div className="space-y-5 py-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-700" />
                  <h3 className="text-xl font-bold text-[#141413]">تم تسجيلك في البرنامج بنجاح</h3>
                  <p className="text-sm text-[#6E6A63]">
                    رقم التسجيل المرجعي:{' '}
                    <span className="font-mono-num font-bold text-[#141413] select-all">{enrollment.id}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6E6A63]">المتدرب:</span>
                    <span className="font-medium text-[#141413]">{enrollment.student_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6A63]">البرنامج:</span>
                    <span className="font-medium text-[#141413] text-left max-w-[60%] truncate">
                      {enrollment.program_title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6A63]">الرسوم:</span>
                    <span className="font-bold text-[#141413] tabular-nums">
                      {enrollment.price_paid <= 0 ? 'مجاني' : `${enrollment.price_paid} ${settings.currency}`}
                    </span>
                  </div>
                  <p className="pt-2 border-t border-[#E5E2DC] text-xs text-[#6E6A63]">
                    {tgNotified
                      ? 'تم إرسال إشعار فوري بتسجيلك إلى تيليجرام الإدارة وسيتم التواصل معك للتأكيد وإرسال رابط الحضور.'
                      : 'تم حفظ تسجيلك بنجاح في سجل البرامج التدريبية (Google Sheets).'}
                  </p>
                </div>

                {tgUrl && (
                  <a
                    href={tgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0088cc] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0077b3] transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>تواصل عبر تيليجرام لتأكيد مقعدك</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-lg border border-[#E5E2DC] bg-white py-2.5 text-sm font-semibold text-[#141413] hover:bg-[#FAF9F6] cursor-pointer"
                >
                  إغلاق والعودة للمتجر
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#141413]">نموذج التسجيل وحجز المقعد</h3>
                  <p className="text-xs text-[#6E6A63] mt-0.5">
                    أكمل بياناتك ليتم حجز مقعدك وإرسال إشعار فوري للإدارة.
                  </p>
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">الاسم الكامل *</label>
                  <input
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="مثال: سارة الغامدي"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم الجوال *</label>
                    <input
                      required
                      type="tel"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#44413C]">معرف تيليجرام (اختياري)</label>
                    <input
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2.5 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {!isFree && (
                  <div className="space-y-2.5 pt-1">
                    <label className="block text-xs font-semibold text-[#141413]">طريقة السداد</label>
                    <div className="grid grid-cols-2 gap-2">
                      {settings.bank_transfer_enabled && (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('bank_transfer')}
                          className={`rounded-lg border p-2.5 text-right text-xs transition-colors cursor-pointer ${
                            paymentMethod === 'bank_transfer'
                              ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413] font-semibold'
                              : 'border-[#E5E2DC] bg-white'
                          }`}
                        >
                          تحويل بنكي
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`rounded-lg border p-2.5 text-right text-xs transition-colors cursor-pointer ${
                          paymentMethod === 'cod'
                            ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413] font-semibold'
                            : 'border-[#E5E2DC] bg-white'
                        }`}
                      >
                        تأكيد لاحقاً مع المنسق
                      </button>
                    </div>

                    {paymentMethod === 'bank_transfer' && (
                      <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] p-3 space-y-2 text-xs">
                        <p className="font-semibold text-[#141413]">{settings.bank_name}</p>
                        <div className="flex items-center justify-between gap-2 rounded border border-[#E5E2DC] bg-white px-2.5 py-1.5">
                          <span className="font-mono-num text-[#141413] select-all truncate">{settings.bank_iban}</span>
                          <button
                            type="button"
                            onClick={copyIban}
                            className="inline-flex items-center gap-1 text-[#B45309] font-semibold cursor-pointer shrink-0"
                          >
                            {copiedIban ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedIban ? 'تم النسخ' : 'نسخ'}</span>
                          </button>
                        </div>
                        <input
                          value={bankReference}
                          onChange={(e) => setBankReference(e.target.value)}
                          placeholder="رقم مرجع الحوالة أو اسم المحوّل (اختياري)"
                          className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">ملاحظات أو استفسارات (اختياري)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي ملاحظة تود إيصالها للمدرب أو المنسق"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={soldOut || submitting}
                  className="w-full rounded-lg bg-[#141413] py-3 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:bg-[#D4CFC7] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {soldOut
                    ? 'اكتملت المقاعد المتاحة'
                    : submitting
                      ? 'جاري تسجيل مقعدك...'
                      : isFree
                        ? 'تأكيد التسجيل المجاني'
                        : `تأكيد التسجيل (${program.price} ${settings.currency})`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
