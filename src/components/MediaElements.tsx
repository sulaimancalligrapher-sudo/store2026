import React, { useState } from 'react';
import { Download, ExternalLink, Feather, WifiOff } from 'lucide-react';
import { resolveImageUrl, resolvePreviewMedia } from '../lib/media';
import { useOnlineStatus, usePWAInstall } from '../lib/pwa';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUrl(src);

  if (!resolved || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE5] text-[#5F5C54] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Feather className="w-8 h-8 mb-2 text-[#0F4C3F] opacity-60" strokeWidth={1.5} />
        <span className="text-xs font-medium line-clamp-2 max-w-[18ch]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};

interface MediaPreviewPlayerProps {
  url: string;
  title: string;
}

export const MediaPreviewPlayer: React.FC<MediaPreviewPlayerProps> = ({ url, title }) => {
  const media = resolvePreviewMedia(url);

  if (media.kind === 'none') return null;

  if (media.kind === 'iframe') {
    return (
      <div className="border border-[#E5E0D5] bg-white rounded-lg overflow-hidden">
        <div className="aspect-video w-full bg-[#1A1A18]">
          <iframe
            src={media.src}
            title={`معاينة ${title}`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (media.kind === 'video') {
    return (
      <div className="border border-[#E5E0D5] bg-white rounded-lg overflow-hidden">
        <video controls preload="metadata" className="w-full aspect-video bg-[#1A1A18]">
          <source src={media.src} />
        </video>
      </div>
    );
  }

  if (media.kind === 'audio') {
    return (
      <div className="border border-[#E5E0D5] bg-[#F2EFE9] rounded-lg p-4">
        <p className="text-sm font-medium text-[#1A1A18] mb-2">عينة صوتية من المنهج</p>
        <audio controls preload="metadata" className="w-full">
          <source src={media.src} />
        </audio>
      </div>
    );
  }

  return (
    <a
      href={media.src}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-[#0F4C3F] hover:underline"
    >
      <ExternalLink className="w-4 h-4" />
      <span>فتح ملف المعاينة</span>
    </a>
  );
};

interface PWAInstallButtonProps {
  variant?: 'nav' | 'footer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'footer' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  const handleClick = () => {
    if (isInstallable) {
      void install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'nav' ? (
        <button
          type="button"
          onClick={handleClick}
          className="text-sm font-medium text-[#0F4C3F] hover:underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C3F]"
        >
          تثبيت التطبيق
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[#E5E0D5] bg-white text-[#1A1A18] rounded-lg hover:bg-[#F2EFE9] transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 text-[#0F4C3F]" />
          <span>تثبيت المتجر كتطبيق</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div className="w-full max-w-sm bg-white border border-[#E5E0D5] rounded-xl p-6 shadow-lg">
            <h3 id="ios-install-title" className="text-xl font-bold text-[#1A1A18]">
              تثبيت التطبيق على الآيفون والآيباد
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-[#5F5C54] list-decimal list-inside">
              <li>اضغط على زر المشاركة (Share) في شريط متصفح Safari بالأسفل.</li>
              <li>مرّر للأسفل واختر &laquo;إضافة إلى الشاشة الرئيسية&raquo; (Add to Home Screen).</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#0F4C3F] text-white text-sm font-medium hover:bg-[#0B3A30] transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineNotice: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-lg bg-[#1A1A18] text-[#FAF8F4] px-4 py-2.5 text-xs font-medium shadow-lg"
      role="status"
    >
      <WifiOff className="w-4 h-4 text-[#C49A4F]" />
      <span>أنت تتصفح الآن بدون إنترنت — يتم عرض النسخة المحفوظة.</span>
    </div>
  );
};
