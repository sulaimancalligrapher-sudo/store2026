import type { SheetsConnectionMode } from '../shared/types.ts';

/**
 * ملف الإعدادات الخلفية الافتراضية للمتجر (Backend Default Config)
 * ------------------------------------------------------------------
 * يحتوي على رابط Google Apps Script الدائم وبيانات الإدارة الافتراضية
 * ليعمل المتجر على جميع الأجهزة وVercel مباشرة دون العودة لأي وضع تجريبي.
 */
export const BACKEND_CONFIG = {
  /**
   * طريقة الربط الوحيدة المعتمدة: Google Apps Script
   */
  sheetsMode: 'apps_script' as SheetsConnectionMode,

  /**
   * رابط Google Apps Script Web App URL الخاص بملف الشيت:
   */
  appsScriptUrl:
    'https://script.google.com/macros/s/AKfycbyV2L2UZ7GDPFnWkKeQkoam7_JYbnFKSAboPdLGwH23f7qAwhYp2JxzvnCPjDSHYOjB/exec',

  /**
   * اسم المستخدم ورقم التسجيل الافتراضي لتسجيل الدخول إلى لوحة التحكم (/admin).
   * يعملان مباشرة، ويمكنك تعديلهما هنا أو من ورقة Admin في Google Sheets
   * أو من تبويب الإعدادات في لوحة التحكم أو عبر ADMIN_USERNAME و ADMIN_PASSWORD.
   */
  adminUsername: 'admin',
  adminPasscode: '123456',
};
