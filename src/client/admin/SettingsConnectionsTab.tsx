import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
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

  const [credCurrentPass, setCredCurrentPass] = useState('');
  const [credNewUser, setCredNewUser] = useState(integrationStatus.adminUsername || 'admin');
  const [credNewPass, setCredNewPass] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBackendCfg, setCopiedBackendCfg] = useState(false);
  const [expandedTab, setExpandedTab] = useState<string>('Products');

  const notify = (type: 'ok' | 'err', text: string) => setFeedback({ type, text });

  useEffect(() => {
    setSheetsMode(integrationStatus.sheetsMode);
  }, [integrationStatus.sheetsMode]);

  useEffect(() => {
    setStoreForm(initialSettings);
  }, [initialSettings]);

  const handleApiError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 401) {
      onSessionExpired('انتهت صلاحية جلسة الإدارة أو أُعيد تشغيل الخادم. يرجى تسجيل الدخول مجدداً.');
      return;
    }
    notify('err', err instanceof Error ? err.message : fallback);
  };

  const persistSheetsInputsIfNeeded = async (): Promise<SheetsConnectionMode> => {
    let effectiveMode: SheetsConnectionMode = sheetsMode;
    if (effectiveMode === 'demo' && appsScriptUrl.trim()) {
      effectiveMode = 'apps_script';
      setSheetsMode('apps_script');
    } else if (effectiveMode === 'demo' && sheetId.trim() && serviceAccountEmail.trim()) {
      effectiveMode = 'service_account';
      setSheetsMode('service_account');
    }

    const hasPendingInputs =
      effectiveMode !== integrationStatus.sheetsMode ||
      Boolean(appsScriptUrl.trim()) ||
      Boolean(appsScriptSecret.trim()) ||
      Boolean(sheetId.trim()) ||
      Boolean(serviceAccountEmail.trim()) ||
      Boolean(serviceAccountKey.trim());

    if (hasPendingInputs) {
      const payload: Parameters<typeof api.updateIntegrations>[0] = { sheetsMode: effectiveMode };
      if (appsScriptUrl.trim()) payload.appsScriptUrl = appsScriptUrl.trim();
      if (appsScriptSecret.trim()) payload.appsScriptSecret = appsScriptSecret.trim();
      if (sheetId.trim()) payload.sheetId = sheetId.trim();
      if (serviceAccountEmail.trim()) payload.serviceAccountEmail = serviceAccountEmail.trim();
      if (serviceAccountKey.trim()) payload.serviceAccountPrivateKey = serviceAccountKey.trim();
      await api.updateIntegrations(payload);
    }

    return effectiveMode;
  };

  const handleSaveSheetsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const effectiveMode = await persistSheetsInputsIfNeeded();
      await onRefresh();
      if (effectiveMode === 'demo') {
        notify('err', 'النظام مضبوط حالياً على الوضع التجريبي المحلي ولا يحفظ في Google Sheets.');
      } else {
        notify('ok', 'تم حفظ إعدادات الربط بنجاح. يمكنك الآن الضغط على "اختبار الاتصال" أو "تهيئة أوراق الشيت".');
      }
    } catch (err) {
      handleApiError(err, 'تعذر حفظ إعدادات الربط');
    } finally {
      setBusy(false);
    }
  };

  const handleTestSheets = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await persistSheetsInputsIfNeeded();
      const res = await api.testSheets();
      await onRefresh();
      if (!res.ok || res.isDemo) {
        notify('err', res.message);
      } else {
        notify('ok', `${res.message} (عدد المنتجات المقروءة: ${res.productCount ?? 0})`);
      }
    } catch (err) {
      handleApiError(err, 'فشل اختبار الاتصال بـ Google Sheets');
    } finally {
      setBusy(false);
    }
  };

  const handleInitSheets = async (seedSampleData: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      await persistSheetsInputsIfNeeded();
      const res = await api.initSheets(seedSampleData);
      await onRefresh();
      if (!res.ok) {
        notify('err', res.message);
      } else {
        notify('ok', res.message);
      }
    } catch (err) {
      handleApiError(err, 'تعذر تهيئة أوراق الشيت');
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
      handleApiError(err, 'تعذر حفظ إعدادات تيليجرام');
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
      handleApiError(err, 'فشل إرسال الرسالة التجريبية');
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
      handleApiError(err, 'فشل تسجيل Webhook تيليجرام');
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
      handleApiError(err, 'تعذر حفظ إعدادات المتجر');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.updateCredentials(credCurrentPass, credNewUser.trim(), credNewPass);
      onTokenChange(res.token);
      setCredCurrentPass('');
      setCredNewPass('');
      await onRefresh();
      notify('ok', 'تم تحديث اسم المستخدم ورقم التسجيل الإداري وحفظهما بنجاح.');
    } catch (err) {
      handleApiError(err, 'تعذر تحديث بيانات الدخول');
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
  sheetsMode: '${appsScriptUrl.trim() ? 'apps_script' : sheetsMode}' as SheetsConnectionMode,
  appsScriptUrl: '${appsScriptUrl.trim() || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'}',
  adminUsername: '${credNewUser.trim() || integrationStatus.adminUsername || 'admin'}',
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

        {integrationStatus.sheetsMode === 'demo' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <strong>تنبيه مهم:</strong> الوضع الحالي هو <strong>الوضع التجريبي</strong>؛ أي منتج أو طلب جديد يُسجَّل الآن في ذاكرة الموقع فقط ولا يُرسل إلى Google Sheets.
              اختر <strong>Google Apps Script</strong> أدناه وأدخل الرابط ثم اضغط <strong>«حفظ وضع الربط»</strong> أو <strong>«تهيئة أوراق الشيت تلقائياً»</strong> لتفعيل الحفظ الحقيقي.
            </div>
          </div>
        )}

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
                  <p className="mt-1.5 text-[11px] text-[#6E6A63] leading-relaxed">
                    <strong>ما هذا؟</strong> كلمة مرور اختيارية من تأليفك (مثل <code>my-secret-2026</code>) تمنع أي شخص غريب من الكتابة في الشيت عبر رابط السكربت.
                    إذا تركت السطر <code>SECRET_TOKEN = &quot;CHANGE_THIS_TO_YOUR_SECRET&quot;</code> كما هو داخل كود Apps Script فيمكنك ترك هذا الحقل <strong>فارغاً</strong>.
                  </p>
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
              الحفظ هنا يعمل فوراً على السيرفر الحالي. لتعميم الرابط على جميع الأجهزة دون متغيرات بيئة في Vercel، ضعه داخل الملف الخلفي بالأسفل.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
            >
              حفظ وضع الربط
            </button>
          </div>

          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#141413]">
                  الربط الدائم داخل الملف الخلفي (بدون متغيرات بيئة في Vercel)
                </p>
                <p className="text-[11px] text-[#6E6A63] mt-0.5">
                  الصق هذا المقطع داخل الملف <span className="font-mono-num text-[#141413]">src/server/backendConfig.ts</span> قبل الرفع إلى GitHub لتفتح جميع الأجهزة المتجر وترسل الطلبات إلى الشيت تلقائياً.
                </p>
              </div>
              <button
                type="button"
                onClick={copyBackendConfigSnippet}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#141413] hover:bg-[#EFECE6] cursor-pointer"
              >
                {copiedBackendCfg ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedBackendCfg ? 'تم النسخ!' : 'نسخ إعدادات الملف الخلفي'}</span>
              </button>
            </div>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-lg border border-[#E5E2DC] bg-white p-3 text-[11px] font-mono-num text-[#141413]"
            >
              {backendConfigSnippet}
            </pre>
            <p className="text-[11px] text-[#6E6A63]">
              حالة الملف الخلفي الحالية:{' '}
              <strong className={integrationStatus.hasFileAppsScriptUrl ? 'text-emerald-700' : 'text-[#141413]'}>
                {integrationStatus.hasFileAppsScriptUrl
                  ? 'تم تضمين رابط Apps Script في الملف الخلفي ✓'
                  : 'لم يُكتب رابط في src/server/backendConfig.ts بعد'}
              </strong>
            </p>
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
            <span>متغيرات البيئة الاختيارية على Vercel (Environment Variables):</span>
          </p>
          <p className="font-mono-num text-[11px] leading-relaxed text-[#141413]">
            ADMIN_USERNAME · ADMIN_PASSWORD · TELEGRAM_BOT_TOKEN · TELEGRAM_ADMIN_CHAT_ID · GOOGLE_APPS_SCRIPT_SECRET
          </p>
        </div>
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
                  minLength={6}
                  value={credNewPass}
                  onChange={(e) => setCredNewPass(e.target.value)}
                  placeholder="6 أحرف أو أرقام فأكثر"
                  className="w-full rounded-lg border border-[#E5E2DC] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:border-[#141413] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2A2A28] disabled:opacity-60 cursor-pointer"
              >
                حفظ بيانات الدخول في الشيت
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
