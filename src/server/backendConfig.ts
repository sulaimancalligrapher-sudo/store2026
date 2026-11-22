import type { SheetsConnectionMode } from '../shared/types.ts';

/**
 * ملف الإعدادات الخلفية الافتراضية للمتجر (Backend Default Config)
 * ------------------------------------------------------------------
 * يمكنك تعديل هذه القيم مباشرة داخل الكود ثم رفع المشروع إلى GitHub / Vercel
 * لتعمل جميع الأجهزة والزوار على نفس قاعدة بيانات Google Sheets تلقائياً
 * دون الحاجة لإعداد متغيرات بيئة إضافية لرابط الشيت في Vercel.
 */
export const BACKEND_CONFIG = {
  /**
   * طريقة الربط الافتراضية:
   * - 'apps_script' : للاتصال الفعلي بـ Google Sheets عبر رابط Apps Script أدناه
   * - 'demo'        : الوضع التجريبي المحلي (يُفعَّل تلقائياً إلى apps_script إذا أضفت appsScriptUrl)
   */
  sheetsMode: 'demo' as SheetsConnectionMode,

  /**
   * الصق هنا رابط Google Apps Script Web App URL الخاص بملف الشيت:
   * مثال: 'https://script.google.com/macros/s/AKfycb.../exec'
   */
  appsScriptUrl: '',

  /**
   * اسم المستخدم ورقم التسجيل الافتراضي لتسجيل الدخول إلى لوحة التحكم (/admin).
   * يعملان مباشرة دون طلب إعداد مسبق، ويمكنك تغييرهما هنا أو من ورقة Admin في Google Sheets
   * أو من تبويب الإعدادات في لوحة التحكم أو عبر ADMIN_USERNAME و ADMIN_PASSWORD.
   */
  adminUsername: 'admin',
  adminPasscode: '123456',
};
