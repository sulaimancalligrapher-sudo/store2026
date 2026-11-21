import type { Banner, Category, Order, Product, StoreSettings } from './types.ts';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'مِداد',
  tagline: 'أدوات الخط العربي الأصيلة والمناهج التعليمية المتدرجة',
  logoUrl: '/icon.svg',
  primaryColor: '#0F4C3F',
  currency: 'ر.س',
  deliveryFee: 25,
  freeShippingOver: 250,
  announcement: 'شحن مجاني لأدوات الخط للطلبات فوق 250 ر.س · المناهج الرقمية متاحة فور تأكيد الطلب',
  whatsapp: '966500000000',
  telegramUsername: '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  transferInfo: '',
  isOpen: true,
  contactPayEnabled: true,
  onlinePayEnabled: false,
};

export const SEED_CATEGORIES: Category[] = [
  {
    id: 'cat_tools',
    name: 'أدوات الخط',
    imageUrl: '/src/assets/images/product_bamboo_qalam_1795243896890.jpg',
    sort: 1,
    active: true,
  },
  {
    id: 'cat_inks',
    name: 'الأحبار والورق',
    imageUrl: '/src/assets/images/product_ahar_paper_1795243896080.jpg',
    sort: 2,
    active: true,
  },
  {
    id: 'cat_courses',
    name: 'المناهج التعليمية',
    imageUrl: '/src/assets/images/product_course_curriculum_1795243897155.jpg',
    sort: 3,
    active: true,
  },
];

export const SEED_BANNERS: Banner[] = [
  {
    id: 'ban_main',
    imageUrl: '/src/assets/images/hero_calligraphy_atelier_1795243897105.jpg',
    title: 'أدوات الحرف الأصيل ومنهج الإتقان',
    subtitle: 'أقلام قصب جاوي مبريّة بعناية، ورق آهار مصقول، ومناهج تعليمية بالصوت والفيديو لخط النسخ والرقعة.',
    buttonText: 'تصفح المجموعة',
    link: '#catalog',
    sort: 1,
    active: true,
  },
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod_qalam_set',
    sku: 'QLM-JAVA-05',
    categoryId: 'cat_tools',
    type: 'physical',
    name: 'طقم أقلام قصب جاوي وبامبو (5 مقاسات)',
    description:
      'خمسة أقلام مختارة ومقطوعة يدوياً بمقاسات متدرجة من 1 مم إلى 3.5 مم لخط النسخ والثلث، ملفوفة بخيوط الكتان لثبات مريح أثناء الكتابة.',
    price: 145,
    oldPrice: 175,
    stock: 18,
    images: ['/src/assets/images/product_bamboo_qalam_1795243896890.jpg'],
    previewMedia: '',
    digitalDeliveryUrl: '',
    sort: 1,
    active: true,
  },
  {
    id: 'prod_inkwell_knife',
    sku: 'INK-GLS-01',
    categoryId: 'cat_inks',
    type: 'physical',
    name: 'محبرة زجاجية مع الليقة وسكين البري النحاسي',
    description:
      'محبرة زجاجية ثقيلة بغطاء محكم، مزودة بألياف الحرير الخام (الليقة) لضبط تدفق الحبر، مع سكين فولاذي بمقبض نحاسي مخصص لبري أقلام القصب.',
    price: 120,
    oldPrice: null,
    stock: 12,
    images: ['/src/assets/images/product_inkwell_set_1795243896765.jpg'],
    previewMedia: '',
    digitalDeliveryUrl: '',
    sort: 2,
    active: true,
  },
  {
    id: 'prod_ahar_paper',
    sku: 'PPR-AHR-25',
    categoryId: 'cat_inks',
    type: 'physical',
    name: 'ورق آهار تقليدي مصقول (25 فرخ A4)',
    description:
      'ورق قطني معالج يدوياً بالنشا والبيض ومصقول بحجر العقيق ليمنح القلم انسياباً سلساً وحواف حروف حادة دون تشرب زائد للحبر.',
    price: 85,
    oldPrice: null,
    stock: 24,
    images: ['/src/assets/images/product_ahar_paper_1795243896080.jpg'],
    previewMedia: '',
    digitalDeliveryUrl: '',
    sort: 3,
    active: true,
  },
  {
    id: 'prod_naskh_curriculum',
    sku: 'CRS-NSK-01',
    categoryId: 'cat_courses',
    type: 'digital',
    name: 'منهج تأسيس خط النسخ — المستوى الأول (فيديو + كراسة PDF)',
    description:
      'منهج تعليمي متكامل يشمل 18 درساً مرئياً وصوتياً لشرح ميزان الحروف بالنقاط، اتصالات الألف والباء والجيم، مع كراسة تمارين قابلة للطباعة.',
    price: 160,
    oldPrice: 210,
    stock: -1,
    images: ['/src/assets/images/product_course_curriculum_1795243897155.jpg'],
    previewMedia: '',
    digitalDeliveryUrl: 'https://drive.google.com/drive/folders/example-naskh-level-1',
    sort: 4,
    active: true,
  },
  {
    id: 'prod_ruqah_audio_pack',
    sku: 'CRS-RQA-01',
    categoryId: 'cat_courses',
    type: 'digital',
    name: 'كراسة وشرح خط الرقعة العملي (ملفات صوتية وPDF)',
    description:
      'دليل عملي منظم لإتقان خط الرقعة اليومي وأسرار السرعة والتوازن، يتضمن شروحات صوتية إرشادية وأوراق تسطير بمقاس 2 مم.',
    price: 95,
    oldPrice: null,
    stock: -1,
    images: ['/src/assets/images/hero_calligraphy_atelier_1795243897105.jpg'],
    previewMedia: '',
    digitalDeliveryUrl: 'https://drive.google.com/drive/folders/example-ruqah-pack',
    sort: 5,
    active: true,
  },
];

export const SEED_ORDERS: Order[] = [];
