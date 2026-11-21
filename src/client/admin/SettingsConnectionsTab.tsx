import React, { useState } from 'react';
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
import type {
  IntegrationStatus,
  SheetSchemaTab,
  SheetsConnectionMode,
  StoreSettings,
} from '../../shared/types.ts';
import type { createAdminApi } from '../lib/api.ts';

interface SettingsConnectionsTabProps {
  api: ReturnType<typeof createAdminApi>;
  settings: StoreSettings;
  integrationStatus: IntegrationStatus;
  schemaTabs: SheetSchemaTab[];
  appsScriptTemplate: string;
  onRefresh: () => Promise<void>;
}

export const SettingsConnectionsTab: React.FC<SettingsConnectionsTabProps> = ({
  api,
  settings: initialSettings,
  integrationStatus,
  schemaTabs,
  appsScriptTemplate,
  onRefresh,
}) => {
  const [sheetsMode, setSheetsMode] = useState<SheetsConnectionMode>(integrationStatus.sheetsMode);
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [appsScriptSecret, setAppsScriptSecret] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');

  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramAdminChatId, setTelegramAdminChatId] = useState('');
  const [telegramWebhookSecret, setTelegramWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(
    typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : ''
  );

  const [storeForm, setStoreForm] = useState<StoreSettings>(initialSettings);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [expandedTab, setExpandedTab] = useState<string>('Products');

  const notify = (type: 'ok' | 'err', text: string) => setFeedback({ type, text });

  const handleSaveSheetsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const payload: Parameters<typeof api.updateIntegrations>[0] = { sheetsMode };
      if (appsScriptUrl.trim()) payload.appsScriptUrl = appsScriptUrl.trim();
      if (appsScriptSecret.trim()) payload.appsScriptSecret = appsScriptSecret.trim();
      if (sheetId.trim()) payload.sheetId = sheetId.trim();
      if (serviceAccountEmail.trim()) payload.serviceAccountEmail = serviceAccountEmail.trim();
      if (serviceAccountKey.trim()) payload.serviceAccountPrivateKey = serviceAccountKey.trim();
      await api.updateIntegrations(payload);
      await onRefresh();
      notify('ok', 'تم حفظ إعدادات الربط بنجاح. يمكنك الآن الضغط على "اختبار الاتصال" أو "تهيئة أوراق الشيت".');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'تعذر حفظ إعدادات الربط');
    } finally {
      setBusy(false);
    }
  };

  const handleTestSheets = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.testSheets();
      notify('ok', `${res.message} (عدد المنتجات المقروءة: ${res.productCount ?? 0})`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'فشل اختبار الاتصال بـ Google Sheets');
    } finally {
      setBusy(false);
    }
  };

  const handleInitSheets = async (seedSampleData: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.initSheets(seedSampleData);
      await onRefresh();
      notify('ok', res.message);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'تعذر تهيئة أوراق الشيت');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api.updateIntegrations({
        telegramBotToken: telegramBotToken.trim() || '__KEEP__',
        telegramAdminChatId: telegramAdminChatId.trim() || undefined,
        telegramWebhookSecret: telegramWebhookSecret.trim() || '__KEEP__',
      });
      await onRefresh();
      notify('ok', 'تم حفظ إعدادات بوت تيليجرام بنجاح.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'تعذر حفظ إعدادات تيليجرام');
    } finally {
      setBusy(false);
    }
  };

  const handleTestTelegram = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.testTelegram();
      notify('ok', res.message);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'فشل إرسال الرسالة التجريبية');
    } finally {
      setBusy(false);
    }
  };

  const handleSetWebhook = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.setTelegramWebhook(webhookUrl);
      notify('ok', res.message);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'فشل تسجيل Webhook تيليجرام');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api.saveSettings(storeForm);
      await onRefresh();
      notify('ok', 'تم حفظ إعدادات المتجر والدفع في ورقة Settings بنجاح.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'تعذر حفظ إعدادات المتجر');
    } finally {
      setBusy(false);
    }
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptTemplate);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
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

      {/* 1. Google Sheets Connection Center */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#B45309]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#141413]">ربط قاعدة البيانات (Google Sheets)</h2>
              <p className="text-xs text-[#6E6A63]">
                الوضع الحالي:{' '}
                <strong className="text-[#141413]">
                  {integrationStatus.sheetsMode === 'apps_script'
                    ? `Google Apps Script (${integrationStatus.appsScriptConfigured ? 'متصل' : 'غير مضبوط'})`
                    : integrationStatus.sheetsMode === 'service_account'
                      ? `Service Account (${integrationStatus.serviceAccountConfigured ? 'متصل' : 'غير مضبوط'})`
                      : 'الوضع التجريبي السريع (في الذاكرة)'}
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
              <span>تهيئة أوراق الشيت تلقائياً + بيانات تجريبية</span>
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSheetsMode('apps_script')}
            className={`rounded-xl border p-4 text-right transition-colors cursor-pointer ${
              sheetsMode === 'apps_script'
                ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413]'
                : 'border-[#E5E2DC] hover:border-[#B8B2A8]'
            }`}
          >
            <p className="text-sm font-bold text-[#141413]">1. Google Apps Script (موصى به)</p>
            <p className="mt-1 text-xs text-[#6E6A63]">
              مجاني 100%، لا يحتاج Google Cloud أو بطاقة بنكية، ويعمل خلال دقيقتين بالنسخ واللصق.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSheetsMode('service_account')}
            className={`rounded-xl border p-4 text-right transition-colors cursor-pointer ${
              sheetsMode === 'service_account'
                ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413]'
                : 'border-[#E5E2DC] hover:border-[#B8B2A8]'
            }`}
          >
            <p className="text-sm font-bold text-[#141413]">2. Google Service Account</p>
            <p className="mt-1 text-xs text-[#6E6A63]">
              ربط مباشر وسريع جداً عبر Google Sheets API v4 (مناسب لمتغيرات بيئة Vercel).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSheetsMode('demo')}
            className={`rounded-xl border p-4 text-right transition-colors cursor-pointer ${
              sheetsMode === 'demo'
                ? 'border-[#141413] bg-[#FAF9F6] ring-1 ring-[#141413]'
                : 'border-[#E5E2DC] hover:border-[#B8B2A8]'
            }`}
          >
            <p className="text-sm font-bold text-[#141413]">3. الوضع التجريبي المحلي</p>
            <p className="mt-1 text-xs text-[#6E6A63]">
              لتجربة كامل مزايا المتجر ولوحة التحكم فوراً قبل ربط ملف Google Sheets الحقيقي.
            </p>
          </button>
        </div>

        <form onSubmit={handleSaveSheetsConfig} className="space-y-4">
          {sheetsMode === 'apps_script' && (
            <div className="space-y-4 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-5">
              <div className="space-y-1.5 text-xs text-[#44413C] leading-relaxed">
                <p className="font-bold text-sm text-[#141413]">خطوات الربط المجاني عبر Google Apps Script (دقيقتان):</p>
                <p>1. أنشئ ملف Google Sheets جديد في حسابك على Google Drive.</p>
                <p>2. من القائمة العلوية اختر: <strong>الإضافات (Extensions) ← Apps Script</strong>.</p>
                <p>3. انسخ الكود الجاهز بالأسفل والصقه بالكامل مكان الكود الموجود، ثم اضغط <strong>حفظ</strong>.</p>
                <p>
                  4. اضغط <strong>نشر (Deploy) ← نشر جديد (New deployment)</strong> ← اختر النوع <strong>تطبيق ويب (Web app)</strong>، واجعل الوصول <strong>أياً كان (Anyone)</strong>، ثم انسخ الرابط وضعه هنا.
                </p>
              </div>

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
                    رابط Web App URL {integrationStatus.appsScriptUrlMasked && `(${integrationStatus.appsScriptUrlMasked})`}
                  </label>
                  <input
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">المفتاح السري (Secret Token)</label>
                  <input
                    type="password"
                    value={appsScriptSecret}
                    onChange={(e) => setAppsScriptSecret(e.target.value)}
                    placeholder="مطابق لقيمة SECRET_TOKEN داخل السكربت"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm focus:border-[#141413] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {sheetsMode === 'service_account' && (
            <div className="space-y-3 rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-5">
              <p className="text-xs text-[#44413C] leading-relaxed">
                أنشئ Service Account من Google Cloud Console مجاناً، فعّل Google Sheets API، وشارك ملف الشيت مع بريد حساب الخدمة بصلاحية <strong>محرر (Editor)</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">
                    معرف الشيت أو رابطه (Spreadsheet ID) {integrationStatus.sheetIdMasked && `(${integrationStatus.sheetIdMasked})`}
                  </label>
                  <input
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs..."
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#44413C]">
                    بريد Service Account {integrationStatus.serviceAccountEmailMasked && `(${integrationStatus.serviceAccountEmailMasked})`}
                  </label>
                  <input
                    value={serviceAccountEmail}
                    onChange={(e) => setServiceAccountEmail(e.target.value)}
                    placeholder="store-bot@project.iam.gserviceaccount.com"
                    className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#44413C]">المفتاح الخاص (Private Key PEM)</label>
                <textarea
                  rows={3}
                  value={serviceAccountKey}
                  onChange={(e) => setServiceAccountKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                  className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-xs font-mono-num focus:border-[#141413] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#6E6A63]">
              للثبات الدائم بعد إعادة التشغيل على Vercel، أضف هذه القيم أيضاً في{' '}
              <span className="font-mono-num text-[#141413]">Vercel → Settings → Environment Variables</span>.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
            >
              حفظ وضع الربط
            </button>
          </div>
        </form>
      </div>

      {/* 2. Telegram Bot & Webhook Center */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#0088cc]">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#141413]">ربط بوت تيليجرام الفوري (استلام الطلبات + أزرار التأكيد)</h2>
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

        <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 text-xs text-[#44413C] space-y-1.5 leading-relaxed">
          <p className="font-bold text-[#141413]">كيف تحصل على بيانات البوت مجاناً؟</p>
          <p>1. افتح تيليجرام وابحث عن <strong>@BotFather</strong> وأرسل <code>/newbot</code> لإنشاء بوت جديد واستلام <strong>Bot Token</strong>.</p>
          <p>2. أرسل رسالة <code>/start</code> لبوتك أو ابحث عن <strong>@userinfobot</strong> لمعرفة رقم حسابك <strong>Admin Chat ID</strong>.</p>
          <p>3. بعد النشر على Vercel، اضغط زر <strong>«تفعيل Webhook التفاعلي»</strong> لتعمل أزرار (تأكيد / تم الشحن / إلغاء) مباشرة من داخل رسالة تيليجرام.</p>
        </div>

        <form onSubmit={handleSaveTelegramConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">
                Bot Token {integrationStatus.telegramBotMasked && `(${integrationStatus.telegramBotMasked})`}
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
                Admin Chat ID {integrationStatus.telegramChatIdMasked && `(${integrationStatus.telegramChatIdMasked})`}
              </label>
              <input
                value={telegramAdminChatId}
                onChange={(e) => setTelegramAdminChatId(e.target.value)}
                placeholder="مثال: 512345678"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#44413C]">Webhook Secret (اختياري)</label>
              <input
                type="password"
                value={telegramWebhookSecret}
                onChange={(e) => setTelegramWebhookSecret(e.target.value)}
                placeholder="كلمة سر لحماية Webhook"
                className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 min-w-[260px] gap-2">
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-store.vercel.app/api/telegram/webhook"
                className="flex-1 rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3 py-2 text-xs font-mono-num focus:border-[#141413] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleSetWebhook}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#141413] bg-white px-3.5 py-2 text-xs font-semibold text-[#141413] hover:bg-[#141413] hover:text-white cursor-pointer whitespace-nowrap"
              >
                <Webhook className="h-3.5 w-3.5" />
                <span>تفعيل Webhook</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#0088cc] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077b3] cursor-pointer"
            >
              حفظ بيانات تيليجرام
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
            <label className="mb-1 block text-xs font-medium text-[#44413C]">معرف تيليجرام للتواصل</label>
            <input
              value={storeForm.telegram_username}
              onChange={(e) => setStoreForm({ ...storeForm, telegram_username: e.target.value })}
              placeholder="nukhba_store_bot"
              className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
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
            className="rounded-lg bg-[#141413] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] cursor-pointer"
          >
            حفظ إعدادات المتجر
          </button>
        </div>
      </form>

      {/* 4. Interactive Sheet Schema Reference */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#E5E2DC] pb-4">
          <div className="rounded-lg bg-[#FAF9F6] border border-[#E5E2DC] p-2.5 text-[#141413]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#141413]">هيكل أوراق Google Sheets المعتمد (7 أوراق)</h2>
            <p className="text-xs text-[#6E6A63]">
              يمكنك استعراض أعمدة كل ورقة هنا، أو الضغط على زر التهيئة التلقائية بالأعلى لإنشائها دفعة واحدة.
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

        <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-2 text-xs text-[#44413C]">
          <p className="font-bold text-[#141413] flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-[#B45309]" />
            <span>متغيرات البيئة للنشر الدائم على Vercel (Environment Variables):</span>
          </p>
          <p className="font-mono-num text-[11px] leading-relaxed text-[#141413]">
            ADMIN_PASSWORD · GOOGLE_SHEETS_MODE=apps_script · GOOGLE_APPS_SCRIPT_URL · GOOGLE_APPS_SCRIPT_SECRET ·
            TELEGRAM_BOT_TOKEN · TELEGRAM_ADMIN_CHAT_ID
          </p>
        </div>
      </div>
    </div>
  );
};
