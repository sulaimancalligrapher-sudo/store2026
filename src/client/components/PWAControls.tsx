import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../lib/usePWAInstall.ts';

export const PWAInstallButton: React.FC<{ variant?: 'dark' | 'outline' }> = ({ variant = 'outline' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  const baseClass =
    variant === 'dark'
      ? 'inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-sm font-medium text-[#FAF9F6] hover:bg-[#2A2A28] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : 'inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-sm font-medium text-[#141413] hover:bg-[#F3F1EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={baseClass}>
        <Download className="h-4 w-4" />
        <span>تثبيت التطبيق على الجوال</span>
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setShowIOSGuide(true)} className={baseClass}>
        <Smartphone className="h-4 w-4" />
        <span>{isIOS ? 'تثبيت على آيفون' : 'تثبيت كتطبيق (PWA)'}</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E5E2DC] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
              <h3 className="text-lg font-bold text-[#141413]">تثبيت المتجر كتطبيق على هاتفك</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="rounded-lg p-1.5 text-[#6E6A63] hover:bg-[#F3F1EC]"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#44413C]">
              <p>
                يعمل هذا المتجر كتطبيق جوال متكامل (PWA) يفتح من الشاشة الرئيسية فوراً حتى مع ضعف الشبكة:
              </p>
              <div className="rounded-lg bg-[#FAF9F6] p-3.5 border border-[#E5E2DC] space-y-2">
                <p className="font-semibold text-[#141413] flex items-center gap-2">
                  <Share className="h-4 w-4 text-[#B45309]" />
                  <span>على أجهزة iPhone / iPad (متصفح Safari):</span>
                </p>
                <p>1. اضغط على زر المشاركة (Share) أسفل الشاشة.</p>
                <p>2. اختر «إضافة إلى الصفحة الرئيسية» (Add to Home Screen).</p>
              </div>
              <div className="rounded-lg bg-[#FAF9F6] p-3.5 border border-[#E5E2DC] space-y-1.5">
                <p className="font-semibold text-[#141413]">على أجهزة Android / Chrome:</p>
                <p>اضغط على قائمة المتصفح (⋮) ثم اختر «تثبيت التطبيق» (Install App).</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#141413] py-2.5 text-sm font-medium text-white hover:bg-[#2A2A28] cursor-pointer"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="h-4 w-4" />
      <span>وضع عدم الاتصال — يتم عرض البيانات المحفوظة مؤقتاً</span>
    </div>
  );
};
