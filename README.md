# مِداد — متجر أدوات الخط العربي والمناهج التعليمية (Google Sheets + GitHub + Vercel + Telegram)

متجر إلكتروني خفيف وتطبيق جوال (PWA) يدعم اللغة العربية (RTL)، يعتمد على **Google Sheets** كقاعدة بيانات، و**Google Drive** لاستضافة الصور والصوت والفيديو والمناهج، و**Telegram Bot** لإشعارات الطلبات والتحكم بالمخزون، ومهيأ للنشر المجاني عبر **GitHub + Vercel**.

---

## 1. إعداد Google Sheets (مرة واحدة)

1. أنشئ ملف **Google Sheet** جديد وانسخ معرّف الشيت (`GOOGLE_SHEET_ID`) من الرابط:
   `https://docs.google.com/spreadsheets/d/HERE_IS_THE_SHEET_ID/edit`
2. من **Google Cloud Console**:
   - فعّل **Google Sheets API**.
   - أنشئ **Service Account** وحمّل مفتاح JSON (ستأخذ منه `client_email` و `private_key`).
3. شارك ملف Google Sheet مع إيميل الـ Service Account بصلاحية **محرر (Editor)**.
4. لتجهيز الأوراق الستة (`Settings`, `Categories`, `Banners`, `Products`, `Orders`, `OrderItems`) تلقائياً بضغطة واحدة، شغّل:
   ```bash
   node scripts/init-sheet.mjs
   ```

### روابط Google Drive للوسائط والمناهج
- ارفع الصورة أو ملف الصوت أو الفيديو أو مجلد المنهج على **Google Drive**.
- غيّر صلاحية الرابط إلى: **أي شخص لديه الرابط — عارض (Viewer)**.
- ضع الرابط مباشرة في عمود `images` أو `preview_media` أو `digital_delivery_url` في ورقة `Products`؛ وسيقوم المتجر بتحويله تلقائياً لعرض الصور أو تشغيل الصوت/الفيديو.
- **حماية المناهج الرقمية:** عمود `digital_delivery_url` لا يظهر في واجهة المتجر العامة أبداً، ولا يُعرض للعميل في صفحة طلبه إلا بعد أن تضغط أنت زر **"✅ تأكيد الدفع"** من بوت تيليجرام (أو تغيّر الحالة في الشيت).

---

## 2. إعداد بوت تيليجرام (إشعارات + خصم المخزون)

1. تحدث مع `@BotFather` على تيليجرام وأنشئ بوتاً جديداً واحفظ `TELEGRAM_BOT_TOKEN` و `TELEGRAM_BOT_USERNAME`.
2. احصل على رقم حسابك `TELEGRAM_ADMIN_CHAT_ID` (مثلاً عبر `@userinfobot`).
3. بعد النشر على Vercel، فعّل الـ Webhook لمرة واحدة بفتح أو تنفيذ الأمر التالي:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://<YOUR-VERCEL-DOMAIN>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
   ```

---

## 3. النشر المجاني على GitHub + Vercel

1. ارفع المشروع إلى مستودع **GitHub**.
2. اربط المستودع بـ **Vercel** (إطار العمل `Vite`).
3. أضف المتغيرات البيئية التالية في **Vercel Environment Variables**:
   - `APP_URL`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `TELEGRAM_BOT_USERNAME`
   - `TELEGRAM_WEBHOOK_SECRET`
4. انشر المشروع — وسيعمل المتجر ولوحة الشيت وإشعارات تيليجرام بالكامل.
