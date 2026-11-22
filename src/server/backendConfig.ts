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
   * اسم المستخدم الافتراضي لتسجيل الدخول إلى لوحة التحكم (/admin).
   * (لتغيير أو تثبيت رقم التسجيل/كلمة المرور بشكل دائم استخدم ADMIN_PASSWORD في إعدادات البيئة
   * أو أنشئ رقم التسجيل من شاشة التفعيل الأولى عند فتح /admin أول مرة).
   */
  adminUsername: 'admin',
};
