import 'dotenv/config';
import crypto from 'node:crypto';

const SHEET_ID = process.env.GOOGLE_SHEET_ID?.trim();
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

if (!SHEET_ID || !EMAIL || !PRIVATE_KEY) {
  console.error(
    'Missing GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, or GOOGLE_PRIVATE_KEY in environment.',
  );
  process.exit(1);
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = base64Url(signer.sign(PRIVATE_KEY));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.access_token;
}

async function api(token, path, method = 'GET', body) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

const TABS = [
  'Settings',
  'Categories',
  'Banners',
  'Products',
  'Orders',
  'OrderItems',
];

async function main() {
  const token = await getToken();
  const meta = await api(token, '');
  const existingTitles = new Set((meta.sheets || []).map((s) => s.properties.title));

  const requests = TABS.filter((t) => !existingTitles.has(t)).map((title) => ({
    addSheet: { properties: { title } },
  }));

  if (requests.length > 0) {
    await api(token, ':batchUpdate', 'POST', { requests });
    console.log('Created missing tabs:', requests.map((r) => r.addSheet.properties.title));
  }

  const data = [
    {
      range: 'Settings!A1:B15',
      values: [
        ['key', 'value'],
        ['store_name', 'مِداد'],
        ['tagline', 'أدوات الخط العربي الأصيلة والمناهج التعليمية المتدرجة'],
        ['logo_url', '/icon.svg'],
        ['primary_color', '#0F4C3F'],
        ['currency', 'ر.س'],
        ['delivery_fee', '25'],
        ['free_shipping_over', '250'],
        ['announcement', 'شحن مجاني لأدوات الخط للطلبات فوق 250 ر.س · المناهج الرقمية متاحة فور تأكيد الطلب'],
        ['whatsapp', '966500000000'],
        ['telegram_username', ''],
        ['bot_username', process.env.TELEGRAM_BOT_USERNAME || ''],
        ['transfer_info', ''],
        ['is_open', 'TRUE'],
        ['contact_pay_enabled', 'TRUE'],
      ],
    },
    {
      range: 'Categories!A1:E4',
      values: [
        ['id', 'name', 'image_url', 'sort', 'active'],
        ['cat_tools', 'أدوات الخط', '/src/assets/images/product_bamboo_qalam_1795243896890.jpg', '1', 'TRUE'],
        ['cat_inks', 'الأحبار والورق', '/src/assets/images/product_ahar_paper_1795243896080.jpg', '2', 'TRUE'],
        ['cat_courses', 'المناهج التعليمية', '/src/assets/images/product_course_curriculum_1795243897155.jpg', '3', 'TRUE'],
      ],
    },
    {
      range: 'Banners!A1:H2',
      values: [
        ['id', 'image_url', 'title', 'subtitle', 'button_text', 'link', 'sort', 'active'],
        [
          'ban_main',
          '/src/assets/images/hero_calligraphy_atelier_1795243897105.jpg',
          'أدوات الحرف الأصيل ومنهج الإتقان',
          'أقلام قصب جاوي مبريّة بعناية، ورق آهار مصقول، ومناهج تعليمية بالصوت والفيديو لخط النسخ والرقعة.',
          'تصفح المجموعة',
          '#catalog',
          '1',
          'TRUE',
        ],
      ],
    },
    {
      range: 'Products!A1:N4',
      values: [
        [
          'id',
          'sku',
          'category_id',
          'type',
          'name',
          'description',
          'price',
          'old_price',
          'stock',
          'images',
          'preview_media',
          'digital_delivery_url',
          'sort',
          'active',
        ],
        [
          'prod_qalam_set',
          'QLM-JAVA-05',
          'cat_tools',
          'physical',
          'طقم أقلام قصب جاوي وبامبو (5 مقاسات)',
          'خمسة أقلام مختارة ومقطوعة يدوياً بمقاسات متدرجة من 1 مم إلى 3.5 مم لخط النسخ والثلث.',
          '145',
          '175',
          '18',
          '/src/assets/images/product_bamboo_qalam_1795243896890.jpg',
          '',
          '',
          '1',
          'TRUE',
        ],
        [
          'prod_naskh_curriculum',
          'CRS-NSK-01',
          'cat_courses',
          'digital',
          'منهج تأسيس خط النسخ — المستوى الأول (فيديو + كراسة PDF)',
          'منهج تعليمي متكامل يشمل 18 درساً مرئياً وصوتياً لشرح ميزان الحروف بالنقاط مع كراسة تمارين.',
          '160',
          '210',
          '-1',
          '/src/assets/images/product_course_curriculum_1795243897155.jpg',
          '',
          'https://drive.google.com/drive/folders/example-naskh-level-1',
          '2',
          'TRUE',
        ],
      ],
    },
    {
      range: 'Orders!A1:Q1',
      values: [
        [
          'order_id',
          'token',
          'created_at',
          'customer_name',
          'phone',
          'address',
          'notes',
          'has_physical',
          'has_digital',
          'payment_method',
          'payment_status',
          'subtotal',
          'delivery_fee',
          'total',
          'order_status',
          'stock_deducted',
          'customer_telegram_chat_id',
        ],
      ],
    },
    {
      range: 'OrderItems!A1:H1',
      values: [
        [
          'id',
          'order_id',
          'product_id',
          'product_type',
          'product_name',
          'unit_price',
          'qty',
          'line_total',
        ],
      ],
    },
  ];

  await api(token, '/values:batchUpdate', 'POST', {
    valueInputOption: 'USER_ENTERED',
    data,
  });

  console.log('Google Sheet initialized with all 6 tabs and headers!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
