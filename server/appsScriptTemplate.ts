export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * الكود الخلفي لربط ملف Google Sheets بمتجر مِداد
 * طريقة الاستخدام:
 * 1) افتح ملف Google Sheet جديد
 * 2) من القائمة العلوية: الإضافات (Extensions) -> Apps Script
 * 3) امسح أي كود موجود والصق هذا الكود بالكامل ثم احفظ (Ctrl+S)
 * 4) اختر دالة setupStoreSheet من الأعلى واضغط "تشغيل" (Run) لإنشاء الأوراق الستة تلقائياً
 * 5) اضغط "نشر" (Deploy) -> "نشر جديد" (New deployment) -> Web app
 *    - التنفيذ باسم (Execute as): Me
 *    - من لديه صلاحية الوصول (Who has access): Anyone
 * 6) انسخ رابط Web App الناتج وضعه في متغير GOOGLE_APPS_SCRIPT_URL في إعدادات الاستضافة (Vercel)
 */

const TABS = {
  Settings: ['key', 'value'],
  Categories: ['id', 'name', 'image_url', 'sort', 'active'],
  Banners: ['id', 'image_url', 'title', 'subtitle', 'button_text', 'link', 'sort', 'active'],
  Products: [
    'id', 'sku', 'category_id', 'type', 'name', 'description',
    'price', 'old_price', 'stock', 'images', 'preview_media',
    'digital_delivery_url', 'sort', 'active'
  ],
  Orders: [
    'order_id', 'token', 'created_at', 'customer_name', 'phone',
    'address', 'notes', 'has_physical', 'has_digital', 'payment_method',
    'payment_status', 'subtotal', 'delivery_fee', 'total',
    'order_status', 'stock_deducted', 'customer_telegram_chat_id'
  ],
  OrderItems: [
    'id', 'order_id', 'product_id', 'product_type',
    'product_name', 'unit_price', 'qty', 'line_total'
  ]
};

function setupStoreSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      const headers = TABS[name];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0F4C3F').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.getRange(2, 1, 14, 2).setValues([
      ['store_name', 'مِداد'],
      ['tagline', 'أدوات الخط العربي الأصيلة والمناهج التعليمية المتدرجة'],
      ['logo_url', '/icon.svg'],
      ['primary_color', '#0F4C3F'],
      ['currency', 'ر.س'],
      ['delivery_fee', '25'],
      ['free_shipping_over', '250'],
      ['announcement', 'شحن مجاني لأدوات الخط للطلبات فوق 250 ر.س'],
      ['whatsapp', '966500000000'],
      ['telegram_username', ''],
      ['bot_username', ''],
      ['transfer_info', ''],
      ['is_open', 'TRUE'],
      ['contact_pay_enabled', 'TRUE']
    ]);
  }
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'catalog';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'catalog') {
    return jsonResponse({
      settings: sheetValues(ss, 'Settings'),
      categories: sheetValues(ss, 'Categories'),
      banners: sheetValues(ss, 'Banners'),
      products: sheetValues(ss, 'Products')
    });
  }

  if (action === 'orders') {
    return jsonResponse({
      orders: sheetValues(ss, 'Orders'),
      items: sheetValues(ss, 'OrderItems')
    });
  }

  return jsonResponse({ ok: true });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = body.action;

  if (action === 'setup') {
    setupStoreSheet();
    return jsonResponse({ ok: true });
  }

  if (action === 'appendOrder') {
    const ordersSheet = ss.getSheetByName('Orders');
    ordersSheet.appendRow(body.orderRow);
    const itemsSheet = ss.getSheetByName('OrderItems');
    (body.itemRows || []).forEach(function (r) {
      itemsSheet.appendRow(r);
    });
    return jsonResponse({ ok: true });
  }

  if (action === 'upsertProduct') {
    const sheet = ss.getSheetByName('Products');
    const values = sheet.getDataRange().getValues();
    const row = body.row;
    const idx = values.findIndex(function (r, i) { return i > 0 && String(r[0]) === String(row[0]); });
    if (idx > -1) {
      sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return jsonResponse({ ok: true });
  }

  if (action === 'deleteProduct') {
    const sheet = ss.getSheetByName('Products');
    const values = sheet.getDataRange().getValues();
    const idx = values.findIndex(function (r, i) { return i > 0 && String(r[0]) === String(body.productId); });
    if (idx > -1) {
      sheet.deleteRow(idx + 1);
    }
    return jsonResponse({ ok: true });
  }

  if (action === 'saveSettings') {
    const sheet = ss.getSheetByName('Settings');
    sheet.clearContents();
    sheet.getRange(1, 1, body.rows.length, 2).setValues(body.rows);
    return jsonResponse({ ok: true });
  }

  if (action === 'updateOrder') {
    const ordersSheet = ss.getSheetByName('Orders');
    const values = ordersSheet.getDataRange().getValues();
    const idx = values.findIndex(function (r, i) { return i > 0 && String(r[0]) === String(body.orderId); });
    if (idx > -1) {
      const rowNum = idx + 1;
      ordersSheet.getRange(rowNum, 11).setValue(body.paymentStatus);
      ordersSheet.getRange(rowNum, 15).setValue(body.orderStatus);
      ordersSheet.getRange(rowNum, 16).setValue(body.stockDeducted ? 'TRUE' : 'FALSE');
    }
    if (Array.isArray(body.stockUpdates) && body.stockUpdates.length > 0) {
      const prodSheet = ss.getSheetByName('Products');
      const prodValues = prodSheet.getDataRange().getValues();
      body.stockUpdates.forEach(function (u) {
        const pIdx = prodValues.findIndex(function (r, i) { return i > 0 && String(r[0]) === String(u.productId); });
        if (pIdx > -1) {
          prodSheet.getRange(pIdx + 1, 9).setValue(u.stock);
        }
      });
    }
    return jsonResponse({ ok: true });
  }

  if (action === 'linkTelegram') {
    const ordersSheet = ss.getSheetByName('Orders');
    const values = ordersSheet.getDataRange().getValues();
    const idx = values.findIndex(function (r, i) { return i > 0 && String(r[1]) === String(body.token); });
    if (idx > -1) {
      ordersSheet.getRange(idx + 1, 17).setValue(body.chatId);
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function sheetValues(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().map(function (r) {
    return r.map(function (c) { return c === null || c === undefined ? '' : String(c); });
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
