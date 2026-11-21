import React, { useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { StoreSettings } from '../types';
import { PWAInstallButton } from './MediaElements';

interface HeaderProps {
  settings: StoreSettings;
  cartCount: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenCart: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  cartCount,
  currentPath,
  onNavigate,
  onOpenCart,
}) => {
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);

  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div className="sticky top-0 z-40 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#E5E0D5]">
      {settings.announcement && !dismissedAnnouncement && (
        <div className="bg-[#0F4C3F] text-[#FAF8F4] text-xs py-1.5 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="truncate">{settings.announcement}</p>
            <button
              type="button"
              onClick={() => setDismissedAnnouncement(true)}
              aria-label="إغلاق التنبيه"
              className="p-0.5 text-[#FAF8F4]/80 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <header className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="/"
          onClick={(e) => go(e, '/')}
          className="font-display text-2xl font-bold tracking-tight text-[#1A1A18] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C3F]"
        >
          {settings.storeName}
        </a>

        {/* Zone 2: Clean single-line text nav links */}
        <nav className="flex items-center gap-5 sm:gap-7 text-sm font-medium text-[#5F5C54] overflow-x-auto">
          <a
            href="/"
            onClick={(e) => go(e, '/')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1A1A18] ${
              currentPath === '/' ? 'text-[#1A1A18] underline underline-offset-8 decoration-[#0F4C3F]' : ''
            }`}
          >
            الرئيسية
          </a>
          <a
            href="/#catalog"
            onClick={(e) => {
              e.preventDefault();
              if (currentPath !== '/') {
                onNavigate('/');
                setTimeout(() => {
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }, 80);
              } else {
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#1A1A18]"
          >
            الأدوات والمناهج
          </a>
          <a
            href="/orders"
            onClick={(e) => go(e, '/orders')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1A1A18] ${
              currentPath === '/orders' ? 'text-[#1A1A18] underline underline-offset-8 decoration-[#0F4C3F]' : ''
            }`}
          >
            طلباتي
          </a>
          <a
            href="/admin"
            onClick={(e) => go(e, '/admin')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1A1A18] ${
              currentPath === '/admin' ? 'text-[#1A1A18] underline underline-offset-8 decoration-[#0F4C3F]' : ''
            }`}
          >
            الإعدادات
          </a>
          <PWAInstallButton variant="nav" />
        </nav>

        {/* Zone 3: Single primary action button (Cart) */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#0F4C3F] text-white hover:bg-[#0B3A30] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C3F]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>السلة</span>
            <span className="tabular-nums">({cartCount})</span>
          </button>
        </div>
      </header>
    </div>
  );
};
