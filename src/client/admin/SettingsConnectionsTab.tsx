import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileSpreadsheet,
  KeyRound,
  Send,
  Settings2,
  Sparkles,
  Webhook,
} from 'lucide-react';
import type { IntegrationStatus, SheetSchemaTab, StoreSettings } from '../../shared/types.ts';
import { ApiError, type createAdminApi } from '../lib/api.ts';

interface SettingsConnectionsTabProps {
  api: ReturnType<typeof createAdminApi>;
  settings: StoreSettings;
  integrationStatus: IntegrationStatus;
  schemaTabs: SheetSchemaTab[];
  appsScriptTemplate: string;
  onRefresh: () => Promise<void>;
  onSessionExpired: (message: string) => void;
  onTokenChange: (token: string) => void;
}

export const SettingsConnectionsTab: React.FC<SettingsConnectionsTabProps> = ({
  api,
  settings: initialSettings,
  integrationStatus,
  schemaTabs,
  appsScriptTemplate,
  onRefresh,
  onSessionExpired,
  onTokenChange,
}) => {
  const [appsScriptUrl, setAppsScriptUrl] = useState(integrationStatus.appsScriptUrl || '');
  const [appsScriptSecret, setAppsScriptSecret] = useState('');

  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramAdminChatId, setTelegramAdminChatId] = useState(integrationStatus.telegramAdminChatId || '');
  const [telegramBotUsername, setTelegramBotUsername] = useState(
    (initialSettings.telegram_username || '').replace(/^@/, '')
  );
  const [telegramWebhookSecret, setTelegramWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : ''
  );

  const [storeForm, setStoreForm] = useState<StoreSettings>(initialSettings);

  const [credCurrentPass, setCredCurrentPass] = useState('');
  const [credNewUser, setCredNewUser] = useState(integrationStatus.adminUsername || 'admin');
  const [credNewPass, setCredNewPass] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sheetsFeedback, setSheetsFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [telegramFeedback, setTelegramFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [storeFeedback, setStoreFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [credFeedback, setCredFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBackendCfg, setCopiedBackendCfg] = useState(false);
  const [expandedTab, setExpandedTab] = useState<string>('Products');

  const notify = (
    type: 'ok' | 'err',
    text: string,
    section?: 'sheets' | 'telegram' | 'store' | 'cred'
  ) => {
    setFeedback({ type, text });
    if (section === 'sheets') setSheetsFeedback({ type, text });
    if (section === 'telegram') setTelegramFeedback({ type, text });
    if (section === 'store') setStoreFeedback({ type, text });
    if (section === 'cred') setCredFeedback({ type, text });
  };

  useEffect(() => {
    if (integrationStatus.appsScriptUrl) {
      setAppsScriptUrl(integrationStatus.appsScriptUrl);
    }
  }, [integrationStatus.appsScriptUrl]);

  useEffect(() => {
    if (integrationStatus.telegramAdminChatId) {
      setTelegramAdminChatId(integrationStatus.telegramAdminChatId);
    }
  }, [integrationStatus.telegramAdminChatId]);

  useEffect(() => {
    setStoreForm(initialSettings);
    setTelegramBotUsername((initialSettings.telegram_username || '').replace(/^@/, ''));
  }, [initialSettings]);

  const handleApiError = (
    err: unknown,
    fallback: string,
    section?: 'sheets' | 'telegram' | 'store' | 'cred'
  ) => {
    if (err instanceof ApiError && err.status === 401) {
      onSessionExpired('انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.');
      return;
    }
    notify('err', err instanceof Error ? err.message : fallback, section);
  };

  const persistSheetsInputsIfNeeded = async () => {
    const hasPendingInputs =
      appsScriptUrl.trim() !== (integrationStatus.appsScriptUrl || '') ||
      Boolean(appsScriptSecret.trim());

    if (hasPendingInputs) {
      await api.updateIntegrations({
        appsScriptUrl: appsScriptUrl.trim() || undefined,
        appsScriptSecret: appsScriptSecret.trim() || undefined,
      });
    }
  };

  const handleSaveSheetsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setSheetsFeedback(null);
    try {
      if (!appsScriptUrl.trim() && !integrationStatus.appsScriptConfigured) {
        notify('err', 'يرجى لصق رابط Google Apps Script (Web App URL) أولاً.', 'sheets');
        return;
      }
      await persistSheetsInputsIfNeeded();
      const testRes = await api.testSheets();
      await onRefresh();
      notify(
        'ok',
        `تم تأكيد الاتصال وحفظ الربط بنجاح ✓ (${testRes.message} · عدد المنتجات: ${testRes.productCount ?? 0}).`,
        'sheets'
      );
    } catch (err) {
      handleApiError(err, 'تعذر حفظ إعدادات الربط', 'sheets');
    } finally {
      setBusy(false);
    }
  };

  const handleTestSheets = async () => {
    setBusy(true);
    setFeedback(null);
    setSheetsFeedback(null);
    try {
      await persistSheetsInputsIfNeeded();
      const res = await api.testSheets();
      await onRefresh();
      notify('ok', `${res.message} (الأوراق المكتشفة: ${res.tabsFound?.length ?? 0} · المنتجات: ${res.productCount ?? 0})`, 'sheets');
    } catch (err) {
      handleApiError(err, 'فشل اختبار الاتصال بـ Google Sheets', 'sheets');
    } finally {
      setBusy(false);
    }
  };

  const handleInitSheets = async (seedSampleData: boolean) => {
    setBusy(true);
    setFeedback(null);
    setSheetsFeedback(null);
    try {
      await persistSheetsInputsIfNeeded();
      const res = await api.initSheets(seedSampleData);
      await onRefresh();
      notify('ok', res.message, 'sheets');
    } catch (err) {
      handleApiError(err, 'تعذر تهيئة أوراق الشيت', 'sheets');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setTelegramFeedback(null);
    try {
      await api.updateIntegrations({
        telegramBotToken: telegramBotToken.trim() || '__KEEP__',
        telegramAdminChatId: telegramAdminChatId.trim() || undefined,
        telegramWebhookSecret: telegramWebhookSecret.trim() || '__KEEP__',
      });
      const cleanBotUsername = telegramBotUsername.trim().replace(/^@/, '');
      const updatedStoreForm: StoreSettings = {
        ...storeForm,
        telegram_username: cleanBotUsername,
      };
      setStoreForm(updatedStoreForm);
      await api.saveSettings(updatedStoreForm);
      await onRefresh();
      notify(
        'ok',
        'تم حفظ بيانات بوت تيليجرام ومعرف الإداري داخل ورقة Settings في Google Sheets بنجاح.',
        'telegram'
      );
    } catch (err) {
      handleApiError(err, 'تعذر حفظ إعدادات تيليجرام', 'telegram');
    } finally {
      setBusy(false);
    }
  };

  const handleTestTelegram = async () => {
    setBusy(true);
    setFeedback(null);
    setTelegramFeedback(null);
    try {
      const res = await api.testTelegram();
      notify('ok', res.message, 'telegram');
    } catch (err) {
      handleApiError(err, 'فشل إرسال الرسالة التجريبية', 'telegram');
    } finally {
      setBusy(false);
    }
  };

  const handleSetWebhook = async () => {
    setBusy(true);
    setFeedback(null);
    setTelegramFeedback(null);
    try {
      const res = await api.setTelegramWebhook(webhookUrl);
      notify('ok', res.message, 'telegram');
    } catch (err) {
      handleApiError(err, 'فشل تسجيل Webhook تيليجرام', 'telegram');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setStoreFeedback(null);
    try {
      const cleanPayload: StoreSettings = {
        ...storeForm,
        telegram_username: storeForm.telegram_username.trim().replace(/^@/, ''),
        default_delivery_fee: Number(storeForm.default_delivery_fee) || 0,
        free_shipping_min: Number(storeForm.free_shipping_min) || 0,
      };
      await api.saveSettings(cleanPayload);
      setTelegramBotUsername(cleanPayload.telegram_username);
      await onRefresh();
      notify('ok', 'تم حفظ إعدادات المتجر والدفع والتواصل في ورقة Settings بملف Google Sheets بنجاح.', 'store');
    } catch (err) {
      handleApiError(err, 'تعذر حفظ إعدادات المتجر', 'store');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setCredFeedback(null);
    try {
      const res = await api.updateCredentials(credCurrentPass, credNewUser.trim(), credNewPass);
      onTokenChange(res.token);
      setCredCurrentPass('');
      setCredNewPass('');
      await onRefresh();
      notify('ok', 'تم تحديث اسم المستخدم ورقم التسجيل وحفظهما في ورقة Admin بنجاح.', 'cred');
    } catch (err) {
      handleApiError(err, 'تعذر تحديث بيانات الدخول', 'cred');
    } finally {
      setBusy(false);
    }
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptTemplate);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const backendConfigSnippet = `import type { SheetsConnectionMode } from '../shared/types.ts';

export const BACKEND_CONFIG = {
  sheetsMode: 'apps_script' as SheetsConnectionMode,
  appsScriptUrl: '${appsScriptUrl.trim() || integrationStatus.appsScriptUrl || ''}',
  adminUsername: '${credNewUser.trim() || integrationStatus.adminUsername || 'admin'}',
  adminPasscode: '123456',
};`;

  const copyBackendConfigSnippet = () => {
    navigator.clipboard.writeText(backendConfigSnippet);
    setCopiedBackendCfg(true);
    setTimeout(() => setCopiedBackendCfg(false), 2500);
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 1. Google Apps Script Connection Center (Single Reliable Mode) */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#B45309]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#141413]">ربط قاعدة البيانات (Google Apps Script فقط)</h2>
              <p className="text-xs text-[#6E6A63]">
                الحالة:{' '}
                <strong className={integrationStatus.appsScriptConfigured ? 'text-emerald-700' : 'text-red-700'}>
                  {integrationStatus.appsScriptConfigured
                    ? `متصل دائماً (${integrationStatus.appsScriptUrlMasked})`
                    : 'غير مضبوط'}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleTestSheets}
              className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-xs font-semibold text-[#141413] hover:bg-[#EFECE6] cursor-pointer"
            >
              اختبار الاتصال
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleInitSheets(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>تهيئة أوراق الشيت الـ 10 + بيانات مبدئية</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSheetsConfig} className="space-y-4">
          <div className="space-y-4 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5">
              <span className="text-xs font-semibold text-[#141413]">كود جسر Google Apps Script الجاهز</span>
              <button
                type="button"
                onClick={copyAppsScript}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#141413] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
              >
                {copiedScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedScript ? 'تم نسخ الكود!' : 'نسخ كود Apps Script'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">
                  رابط Web App URL المعتمد
                </label>
                <input
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">
                  المفتاح السري (Secret Token) — اختياري
                </label>
                <input
                  type="password"
                  value={appsScriptSecret}
                  onChange={(e) => setAppsScriptSecret(e.target.value)}
                  placeholder="اتركه فارغاً أو اكتب نفس SECRET_TOKEN في السكربت"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm focus:border-[#141413] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#6E6A63]">
              الرابط الدائم مدمج مباشرة في <span className="font-mono-num text-[#141413]">src/server/backendConfig.ts</span> ليعمل المتجر على جميع الأجهزة وVercel بدون وضع تجريبي.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'جاري التحقق...' : 'تأكيد واختبار الربط'}
            </button>
          </div>

          {sheetsFeedback && (
            <div
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
                sheetsFeedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {sheetsFeedback.text}
            </div>
          )}

          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#141413]">
                نسخة الملف الخلفي الحالية (<span className="font-mono-num">src/server/backendConfig.ts</span>)
              </p>
              <button
                type="button"
                onClick={copyBackendConfigSnippet}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#141413] hover:bg-[#EFECE6] cursor-pointer"
              >
                {copiedBackendCfg ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedBackendCfg ? 'تم النسخ!' : 'نسخ'}</span>
              </button>
            </div>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-lg border border-[#E5E2DC] bg-white p-3 text-[11px] font-mono-num text-[#141413]"
            >
              {backendConfigSnippet}
            </pre>
          </div>
        </form>
      </div>

      {/* 2. Telegram Bot & Webhook Center (Persisted in Google Sheets Settings tab) */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#0088cc]">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#141413]">ربط بوت تيليجرام الفوري (يُحفظ في ورقة Settings بالشيت)</h2>
              <p className="text-xs text-[#6E6A63]">
                الحالة:{' '}
                <strong className={integrationStatus.telegramConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                  {integrationStatus.telegramConfigured
                    ? `مربوط (${integrationStatus.telegramBotMasked} ← ${integrationStatus.telegramChatIdMasked})`
                    : 'غير مضبوط بعد'}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleTestTelegram}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-xs font-semibold text-[#141413] hover:bg-[#EFECE6] cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-[#0088cc]" />
            <span>إرسال رسالة تجريبية</span>
          </button>
        </div>

        <form onSubmit={handleSaveTelegramConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">
                رمز البوت الخاص (Bot Token) {integrationStatus.telegramBotMasked && `(${integrationStatus.telegramBotMasked})`}
              </label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdef..."
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">
                معرّف الإداري الشخصي (Private User ID) {integrationStatus.telegramChatIdMasked && `(${integrationStatus.telegramChatIdMasked})`}
              </label>
              <input
                value={telegramAdminChatId}
                onChange={(e) => setTelegramAdminChatId(e.target.value)}
                placeholder="مثال: 512345678"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">
                اسم مستخدم البوت في تيليجرام (Bot Username)
              </label>
              <input
                value={telegramBotUsername}
                onChange={(e) => {
                  const clean = e.target.value.replace(/^@/, '');
                  setTelegramBotUsername(clean);
                  setStoreForm((prev) => ({ ...prev, telegram_username: clean }));
                }}
                placeholder="my_store_bot"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <details className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 text-xs text-[#44413C]">
            <summary className="cursor-pointer font-bold text-[#141413]">
              إعدادات متقدمة اختيارية: تفعيل أزرار الطلب والتسجيل داخل رسالة تيليجرام (Webhook)
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-[#E5E2DC] pt-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#44413C]">Webhook Secret (اختياري)</label>
                <input
                  type="password"
                  value={telegramWebhookSecret}
                  onChange={(e) => setTelegramWebhookSecret(e.target.value)}
                  placeholder="اتركه فارغاً أو اكتب كلمة سر من اختيارك"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs focus:border-[#141413] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#44413C]">رابط تفعيل Webhook</label>
                <div className="flex gap-2">
                  <input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-store.vercel.app/api/telegram/webhook"
                    className="flex-1 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-xs font-mono-num focus:border-[#141413] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSetWebhook}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#141413] bg-white px-3 py-2 text-xs font-semibold text-[#141413] hover:bg-[#141413] hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    <Webhook className="h-3.5 w-3.5" />
                    <span>تفعيل Webhook</span>
                  </button>
                </div>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {telegramFeedback ? (
              <p
                className={`text-xs font-medium ${
                  telegramFeedback.type === 'ok' ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                {telegramFeedback.text}
              </p>
            ) : (
              <span className="text-xs text-[#6E6A63]">
                يُحفظ التوكن ومعرف الإداري تلقائياً داخل ورقة Settings في Google Sheets ليعمل عبر جميع الأجهزة وVercel.
              </span>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#0088cc] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b3] disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'جاري الحفظ...' : 'حفظ بيانات تيليجرام في الشيت'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Store Identity & Checkout Settings */}
      <form onSubmit={handleSaveStoreSettings} className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-[#E5E2DC] pb-4">
          <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#141413]">إعدادات المتجر والدفع والتواصل (ورقة Settings)</h2>
            <p className="text-xs text-[#6E6A63]">تُحفظ هذه البيانات مباشرة في ورقة الإعدادات داخل Google Sheets.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">اسم المتجر</label>
            <input
              value={storeForm.store_name}
              onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">العملة</label>
            <input
              value={storeForm.currency}
              onChange={(e) => setStoreForm({ ...storeForm, currency: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">معرف تيليجرام للتواصل (Bot / Support Username)</label>
            <input
              value={storeForm.telegram_username}
              onChange={(e) => {
                const clean = e.target.value.replace(/^@/, '');
                setStoreForm({ ...storeForm, telegram_username: clean });
                setTelegramBotUsername(clean);
              }}
              placeholder="my_store_bot"
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">وصف المتجر</label>
            <input
              value={storeForm.store_tagline}
              onChange={(e) => setStoreForm({ ...storeForm, store_tagline: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">نص شريط الإعلانات العلوي</label>
            <input
              value={storeForm.announcement_text}
              onChange={(e) => setStoreForm({ ...storeForm, announcement_text: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">رسوم التوصيل الافتراضية</label>
            <input
              type="number"
              value={storeForm.default_delivery_fee}
              onChange={(e) => setStoreForm({ ...storeForm, default_delivery_fee: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">الحد الأدنى للشحن المجاني</label>
            <input
              type="number"
              value={storeForm.free_shipping_min}
              onChange={(e) => setStoreForm({ ...storeForm, free_shipping_min: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم واتساب التواصل</label>
            <input
              value={storeForm.whatsapp}
              onChange={(e) => setStoreForm({ ...storeForm, whatsapp: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm tabular-nums focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#E5E2DC] pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">اسم البنك للتحويل</label>
            <input
              value={storeForm.bank_name}
              onChange={(e) => setStoreForm({ ...storeForm, bank_name: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">اسم المستفيد</label>
            <input
              value={storeForm.bank_account_name}
              onChange={(e) => setStoreForm({ ...storeForm, bank_account_name: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم الآيبان (IBAN)</label>
            <input
              value={storeForm.bank_iban}
              onChange={(e) => setStoreForm({ ...storeForm, bank_iban: e.target.value })}
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={storeForm.cod_enabled}
                onChange={(e) => setStoreForm({ ...storeForm, cod_enabled: e.target.checked })}
                className="h-4 w-4 accent-[#141413]"
              />
              <span>تفعيل الدفع عند الاستلام</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={storeForm.bank_transfer_enabled}
                onChange={(e) => setStoreForm({ ...storeForm, bank_transfer_enabled: e.target.checked })}
                className="h-4 w-4 accent-[#141413]"
              />
              <span>تفعيل التحويل البنكي</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#141413] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'جاري الحفظ...' : 'حفظ إعدادات المتجر'}
          </button>
        </div>

        {storeFeedback && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
              storeFeedback.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {storeFeedback.text}
          </div>
        )}
      </form>

      {/* 4. Interactive Sheet Schema Reference (10 Tabs) */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#E5E2DC] pb-4">
          <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#141413]">
              هيكل أوراق Google Sheets المعتمد ({schemaTabs.length} أوراق)
            </h2>
            <p className="text-xs text-[#6E6A63]">
              تشمل أوراق المتجر، ورقة <span className="font-mono-num font-semibold">Admin</span> لتسجيل الدخول، وأوراق{' '}
              <span className="font-mono-num font-semibold">Programs</span> و{' '}
              <span className="font-mono-num font-semibold">Enrollments</span> للبرامج التدريبية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {schemaTabs.map((tab) => (
            <button
              key={tab.tabName}
              type="button"
              onClick={() => setExpandedTab(tab.tabName)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                expandedTab === tab.tabName
                  ? 'border-[#141413] bg-[#141413] text-white'
                  : 'border-[#E5E2DC] bg-[#FAF9F6] text-[#44413C] hover:border-[#141413]'
              }`}
            >
              {tab.tabName} — {tab.titleAr}
            </button>
          ))}
        </div>

        {schemaTabs
          .filter((t) => t.tabName === expandedTab)
          .map((tab) => (
            <div key={tab.tabName} className="space-y-3 pt-2">
              <p className="text-sm text-[#44413C]">{tab.descriptionAr}</p>
              <div className="overflow-x-auto rounded-lg border border-[#E5E2DC]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#FAF9F6] text-[#6E6A63]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">اسم العمود (Header)</th>
                      <th className="px-4 py-2.5 font-semibold">النوع</th>
                      <th className="px-4 py-2.5 font-semibold">الوصف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {tab.columns.map((col) => (
                      <tr key={col.name} className="bg-white">
                        <td className="px-4 py-2 font-mono-num font-semibold text-[#141413]">{col.name}</td>
                        <td className="px-4 py-2 text-[#6E6A63]">{col.type}</td>
                        <td className="px-4 py-2 text-[#44413C]">{col.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>

      {/* 5. Admin Credentials Management */}
      <form onSubmit={handleUpdateCredentials} className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#E5E2DC] pb-4">
          <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#141413]">بيانات دخول لوحة التحكم (/admin)</h2>
            <p className="text-xs text-[#6E6A63]">
              اسم المستخدم الحالي:{' '}
              <strong className="font-mono-num text-[#141413]">{integrationStatus.adminUsername}</strong>
              {integrationStatus.hasEnvAdminPassword && ' · كلمة المرور مضبوطة عبر ADMIN_PASSWORD في البيئة'}
            </p>
          </div>
        </div>

        {integrationStatus.hasEnvAdminPassword ? (
          <p className="text-xs text-[#44413C] rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] p-3.5">
            بيانات الدخول محمية حالياً عبر متغير البيئة <span className="font-mono-num">ADMIN_PASSWORD</span>. لتعديلها حدّث القيمة في إعدادات البيئة.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم التسجيل الحالي *</label>
                <input
                  required
                  type="password"
                  value={credCurrentPass}
                  onChange={(e) => setCredCurrentPass(e.target.value)}
                  placeholder="أدخل الرقم الحالي للتأكيد"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">اسم المستخدم الجديد</label>
                <input
                  required
                  value={credNewUser}
                  onChange={(e) => setCredNewUser(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">رقم التسجيل الجديد (اتركه فارغاً للإبقاء على الحالي)</label>
                <input
                  type="password"
                  minLength={4}
                  value={credNewPass}
                  onChange={(e) => setCredNewPass(e.target.value)}
                  placeholder="4 أحرف أو أرقام فأكثر"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {credFeedback ? (
                <span
                  className={`text-xs font-medium ${
                    credFeedback.type === 'ok' ? 'text-emerald-800' : 'text-red-700'
                  }`}
                >
                  {credFeedback.text}
                </span>
              ) : (
                <span className="text-[11px] text-[#6E6A63]">
                  يُحفظ اسم المستخدم ورقم التسجيل في ورقة <span className="font-mono-num">Admin</span> داخل Google Sheets.
                </span>
              )}
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
              >
                حفظ بيانات الدخول في ورقة Admin
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
