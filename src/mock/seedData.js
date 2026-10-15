// Demo seed data for the frontend-only DeShop demo.
// Dates are anchored to a fixed demo "now" (see utils/demoClock) so the sales
// history is identical every time it is opened. Bump SEED_VERSION whenever you
// change the seed shape — mockDb re-seeds browsers that already have data.

import { demoNow } from '../utils/demoClock';

export const SEED_VERSION = 5;

const pad = (n) => String(n).padStart(2, '0');

const localIso = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

// date at (daysAgo, hour, minute)
const at = (daysAgo, hour = 9, minute = 0) => {
  const d = demoNow();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return localIso(d);
};

const dateOnly = (daysAgo) => at(daysAgo, 0, 0).slice(0, 10);

const dayOf = (isoStr) => isoStr.slice(0, 10);

const addDaysTo = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ─── Tiny inline-SVG fallbacks (used when no real photo/logo is present) ────
const svg = (name, bg, fg = '#FFFFFF') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
  `<rect width="160" height="160" rx="18" fill="${bg}"/>` +
  `<circle cx="80" cy="58" r="24" fill="${fg}" opacity="0.35"/>` +
  `<text x="80" y="112" text-anchor="middle" font-family="Noto Sans Myanmar, Noto Sans, sans-serif" font-size="30" font-weight="700" fill="${fg}">${name}</text>` +
  `</svg>`;

const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
  `<rect width="120" height="120" rx="24" fill="#132C4E"/>` +
  `<circle cx="60" cy="60" r="34" fill="#FFFFFF" opacity="0.2"/>` +
  `<text x="60" y="71" text-anchor="middle" font-family="Fraunces, serif" font-size="30" font-weight="700" fill="#FFFFFF">D</text>` +
  `</svg>`;

const round2 = (n) => Math.round(n * 100) / 100;

// Deterministic PRNG so the sampled demo data is stable across re-seeds.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Static catalog ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Fast Food', description: 'Burgers, sausage, hot snacks' },
  { name: 'Drinks', description: 'Tea, coffee, juice, bottled water' },
  { name: 'Snacks', description: 'Crackers, cakes, local snacks' },
  { name: 'Noodles & Rice', description: 'Mohinga, fried noodles, rice dishes' },
  { name: 'Daily Essentials', description: 'Eggs, oil, sugar, basics' },
];

// [sku, name (caption), myanmarName, desc, unit, unitPrice, costPrice, stock, minStock, categoryIdx, bgColor, imageFile]
const PRODUCT_SPECS = [
  ['CH-BG-1', 'Cheese Burger', 'ချီးစ်ဘာဂါ', 'Classic cheese burger with fresh lettuce', 'PC', 5.0, 3.63, 24, 10, 0, '#C2642E', 'cheese burger.webp'],
  ['CK-SS-01', 'Chicken Sausage', 'ကြက်အူချောင်း', 'Grilled chicken sausage', 'ချောင်း', 3.0, 1.5, 35, 10, 0, '#B23A2E', 'chicken-sausage.jpg'],
  ['DR-LP-01', 'Laphet Yay (Tea)', 'လက်ဖက်ရည်', 'Myanmar traditional milk tea', 'ခွက်', 1.5, 0.8, 60, 20, 1, '#7B5A3B', 'tea.jpg'],
  ['DR-CF-01', 'Black Coffee', 'ကော်ဖီ', 'Fresh brewed black coffee', 'ခွက်', 2.0, 1.0, 18, 20, 1, '#4B3621', 'coffee.jpg'],
  ['DR-JC-01', 'Lemon Juice', 'သံပုရာရည်', 'Fresh lemon juice with sugar', 'ခွက်', 2.5, 1.2, 26, 15, 1, '#C9A227', 'lemonade.jpg'],
  ['SN-CH-01', 'Fried Crackers', 'ကြာဆံကြော်', 'Crispy fried crackers', 'ထုပ်', 1.0, 0.5, 140, 30, 2, '#8A5A2A', 'kyarsan-kyaw.jpg'],
  ['SN-BK-01', 'Ring Snack', 'မုန့်လက်ကောက်', 'Traditional ring-shaped snack', 'ထုပ်', 1.5, 0.7, 40, 20, 2, '#D89E3E', 'Mont let kauk.jpg'],
  ['NL-MH-01', 'Mohinga', 'မုန့်ဟင်းခါး', 'Fish noodle soup, Myanmar breakfast', 'ပွဲ', 3.0, 1.8, 6, 10, 3, '#5E8C61', 'mohinga.jpg'],
  ['NL-KS-01', 'Fried Noodles', 'ခေါက်ဆွဲကြော်', 'Stir-fried egg noodles', 'ပွဲ', 3.5, 2.0, 4, 10, 3, '#C2642E', 'Fried noodles.jpg'],
  ['DE-EG-01', 'Eggs (dozen)', 'ကြက်ဥ', 'Farm eggs, one dozen', 'ဒါဇင်', 4.0, 3.0, 8, 20, 4, '#B8A25E', 'egg-dozen.jpg'],
];

const SUPPLIER_SPECS = [
  ['KFC', 'Myat Thura Soe', 'myatthu.dev@gmail.com', '0933222', '73rd St, 32x33 Chan Nyein Het, Chanmyatharsi, Mandalay'],
  ['Myanmar Snacks Co.', 'U Kyaw Zin', 'kyawzin@mmsnacks.com', '09441122', 'Industrial Zone, Hlaing Tharyar, Yangon'],
  ['Golden Tea Trading', 'Daw Hla Hla', 'hlahla@goldentea.mm', '09553344', 'Bayint Naung Market, Yangon'],
  ['Ayeyar Rice & Oil', 'U Myint Oo', 'myintoo@ayeyar.mm', '09665566', 'Thiri Myay Market, Mandalay'],
  ['Shan Noodle House Supply', 'Sai Tun Aung', 'saitun@shannoodle.mm', '09778899', 'Nyaung Shwe, Shan State'],
  ['Yoma Cold Storage', 'Daw Phyu Phyu', 'phyu@yomafresh.mm', '09880011', 'Shwe Pyi Thar, Yangon'],
  ['88 Food Distributors', 'U Soe Moe', 'soemoe@88food.mm', '09991122', 'Mingalar Market, Yangon'],
  ['City Range Wholesale', 'Ko Zaw Oo', 'zaw@cityrange.mm', '09772233', 'Mandalay Industrial Zone'],
];

const CUSTOMER_SPECS = [
  ['Mrbeast', 'U', 'mrbeast@gmail.com', '09443388', 'Main Street Corner', 'Kalaw', 0],
  ['Aung', 'Kyaw', 'aungkyaw@gmail.com', '097712345', 'Bogyoke Street', 'Yangon', 300],
  ['Thida', 'Win', 'thidawin@gmail.com', '096623456', 'Anawrahta Road', 'Mandalay', 500],
  ['Ko', 'Htet', 'kohtet@gmail.com', '095534567', 'Strand Road', 'Mawlamyine', 400],
  ['Su', 'Myat', 'sumyat@gmail.com', '094445678', 'Zaykabar Street', 'Bago', 200],
  ['Min', 'Thu', 'minthu@gmail.com', '093356789', 'University Avenue', 'Yangon', 0],
  ['Hnin', 'Yi', 'hninyi@gmail.com', '092267890', 'Mandalay Hill Road', 'Mandalay', 150],
  ['Zaw', 'Lin', 'zawlin@gmail.com', '091178901', 'Beach Road', 'Pathein', 0],
];

// productId (1-based) → index in PRODUCT_SPECS
const pidx = (id) => id - 1;

// Popularity-ordered product ids: higher = more likely to appear in a sale.
// Mohinga (breakfast), tea and fried noodles sell most in a mini-mart demo.
const POPULARITY = [8, 3, 1, 4, 9, 5, 2, 10, 7, 6];

function pickProductId(rnd) {
  const weightSum = POPULARITY.reduce((s, x, i) => s + (10 - i), 0);
  let r = rnd() * weightSum;
  for (let i = 0; i < POPULARITY.length; i += 1) {
    r -= 10 - i;
    if (r <= 0) return POPULARITY[i];
  }
  return POPULARITY[0];
}

// [supplierIdx, paymentStatus, daysAgo, [[productId, qty, unitCost], ...]]
const PURCHASE_TEMPLATES = [
  [0, 'PAID', 58, [[1, 40, 3.6], [2, 50, 1.4]]],
  [2, 'PAID', 55, [[3, 100, 0.75], [4, 80, 0.95], [5, 60, 1.15]]],
  [1, 'PAID', 52, [[6, 120, 0.45], [7, 80, 0.65]]],
  [4, 'PAID', 46, [[8, 60, 1.7], [9, 55, 1.9]]],
  [3, 'PAID', 43, [[10, 60, 2.9]]],
  [5, 'PAID', 38, [[3, 60, 0.78], [4, 50, 0.98], [8, 40, 1.75]]],
  [0, 'PAID', 33, [[1, 35, 3.62], [2, 45, 1.48]]],
  [1, 'PAID', 28, [[6, 100, 0.48], [7, 70, 0.66]]],
  [2, 'PAID', 24, [[3, 80, 0.76], [4, 60, 0.97]]],
  [4, 'PAID', 19, [[8, 50, 1.75], [9, 40, 1.95]]],
  [6, 'PAID', 14, [[1, 30, 3.6], [2, 40, 1.5], [10, 40, 2.95]]],
  [3, 'PENDING', 9, [[10, 30, 3.0]]],
  [7, 'PAID', 5, [[5, 50, 1.2], [6, 80, 0.5], [7, 60, 0.7]]],
  [5, 'PENDING', 0, [[3, 40, 0.8], [8, 30, 1.8], [9, 30, 2.0]]],
];

// [daysAgo, category, description, amount]
const EXPENSE_TEMPLATES = [
  [74, 'RENT', 'Shop rent - previous month', 50],
  [70, 'UTILITIES', 'Electricity bill', 14],
  [67, 'SUPPLIES', 'Packaging bags and boxes', 5],
  [64, 'TRANSPORT', 'Delivery fuel cost', 3],
  [60, 'UTILITIES', 'Water bill', 5],
  [58, 'MAINTENANCE', 'Refrigerator service', 8],
  [55, 'MARKETING', 'Facebook ad for promotion', 3],
  [52, 'SUPPLIES', 'Gas cylinder refill', 4],
  [49, 'UTILITIES', 'Electricity bill', 16],
  [46, 'TRANSPORT', 'Delivery fuel cost', 4],
  [42, 'MAINTENANCE', 'Drawer lock repair', 6],
  [39, 'UTILITIES', 'Water bill', 5],
  [37, 'SUPPLIES', 'Cleaning supplies', 2.5],
  [35, 'RENT', 'Shop rent - current month', 50],
  [32, 'SUPPLIES', 'Paper rolls for receipt printer', 3],
  [29, 'MARKETING', 'Local newspaper ad', 4],
  [27, 'UTILITIES', 'Electricity bill', 15],
  [24, 'TRANSPORT', 'Delivery fuel cost', 3.5],
  [21, 'MAINTENANCE', 'Aircon recharge', 10],
  [18, 'UTILITIES', 'Water bill', 5],
  [16, 'SUPPLIES', 'Packaging bags restock', 4],
  [13, 'MARKETING', 'Facebook boosted post', 3.5],
  [11, 'UTILITIES', 'Electricity bill', 14.5],
  [9, 'MAINTENANCE', 'Refrigerator repair', 8],
  [7, 'UTILITIES', 'Water bill', 5],
  [5, 'SUPPLIES', 'Gas cylinder refill', 4],
  [3, 'MARKETING', 'Facebook ad for promotion', 3],
  [1, 'UTILITIES', 'Electricity bill', 15],
  [0, 'SUPPLIES', 'Cleaning supplies', 2.5],
];

// [daysAgo, customerId|null, status, items:[productId, qty]]
const ORDER_TEMPLATES = [
  [1, 6, 'OPEN', [[1, 1], [9, 1]]],
  [2, 2, 'OPEN', [[3, 4], [10, 2]]],
  [4, null, 'CANCELLED', [[6, 6]]],
  [6, 3, 'COMPLETED', [[8, 2], [4, 1]]],
  [8, 7, 'OPEN', [[5, 3], [7, 2]]],
  [11, null, 'CANCELLED', [[1, 2]]],
  [13, 2, 'COMPLETED', [[3, 2], [10, 1], [6, 4]]],
];

// ─── Build the seed ──────────────────────────────────────────────────────────
export function buildSeed() {
  const rnd = mulberry32(20260830);

  const categories = CATEGORIES.map((c, i) => ({
    id: i + 1,
    name: c.name,
    description: c.description,
    isActive: true,
    createdAt: at(90, 10, 0),
    updatedAt: at(90, 10, 0),
    revenue: 0,
  }));

  const suppliers = SUPPLIER_SPECS.map((s, i) => ({
    id: i + 1,
    name: s[0],
    contactPerson: s[1],
    email: s[2],
    phone: s[3],
    address: s[4],
    city: s[4].split(',')[s[4].split(',').length - 1].trim(),
    isActive: true,
    createdAt: at(80 - i, 9, 0),
    updatedAt: at(80 - i, 9, 0),
  }));

  const customers = CUSTOMER_SPECS.map((c, i) => ({
    id: i + 1,
    customerCode: `CUST-${String(1000 + i + 1)}`,
    firstName: c[0],
    lastName: c[1],
    email: c[2],
    phone: c[3],
    address: c[4],
    city: c[5],
    state: '',
    country: 'Myanmar',
    creditLimit: c[6] * 1000,
    currentBalance: 0,
    isQuickAdd: false,
    isActive: true,
    createdAt: at(75, 10, 0),
    updatedAt: at(75, 10, 0),
  }));

  // Supplier index per category index (roughly who supplies what)
  const CATEGORY_SUPPLIER = [0, 2, 1, 4, 3];

  const products = PRODUCT_SPECS.map((s, i) => {
    const supplierIdx = CATEGORY_SUPPLIER[s[9]] || 0;
    const currentPrice = s[5] * 1000;
    // 3 recorded price changes per product, newest first: +5% at 1d ago,
    // +2% at 3d ago, +4% at 6d ago (from the current price backward).
    const steps = [
      { daysAgo: 1, pct: -0.05, by: 'Ma Su' },
      { daysAgo: 3, pct: -0.02, by: 'U Kaung' },
      { daysAgo: 6, pct: -0.04, by: 'Nyi Nyi' },
    ];
    let runningPrice = currentPrice;
    const priceHistory = steps.map((st, k) => {
      const newPrice = k === 0 ? currentPrice : runningPrice;
      runningPrice = Math.round(runningPrice / (1 - st.pct));
      const oldPrice = runningPrice;
      return {
        id: i * steps.length + k + 1,
        productId: i + 1,
        oldPrice,
        newPrice,
        changedAt: at(st.daysAgo, 11, 15 + k * 10),
        changedByUsername: st.by,
      };
    });
    return {
      id: i + 1,
      sku: s[0],
      name: s[2] ? `${s[1]}` : s[1],
      myanmarName: s[2],
      description: s[3],
      unit: s[4],
      unitPrice: currentPrice,
      costPrice: s[6] * 1000,
      taxRate: 0,
      stockQuantity: s[7],
      minStockLevel: s[8],
      categoryId: s[9] + 1,
      categoryName: categories[s[9]].name,
      supplierId: suppliers[supplierIdx].id,
      supplierName: suppliers[supplierIdx].name,
      hasImage: true,
      imageSvg: svg(s[2] || s[1], s[10]),
      imageUrl: `/products/${s[11]}`,
      isActive: true,
      priceHistory,
      createdAt: at(80, 10, 0),
      updatedAt: at(6, 15, 0),
    };
  });

  const productById = (id) => products[pidx(id)];
  const customersById = (id) => (id ? customers[id - 1] : null);

  // ── Sales: ~30 days, 3-6 sales/day, deterministic ──
  let subCounter = {};
  const nextInvoice = (dateStr) => {
    const key = dateStr.replace(/-/g, '');
    subCounter[key] = (subCounter[key] || 0) + 1;
    return `INV-${key}-${String(subCounter[key]).padStart(3, '0')}`;
  };

  const dayPlans = [];
  const HOT_HOUR_BOOST = { 8: [8, 3, 10], 9: [8, 3], 12: [3, 1, 4], 17: [9, 2, 6, 7] }; // extra-likely items per hour
  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const nSales = 3 + Math.floor(rnd() * 4); // 3..6 per day
    for (let k = 0; k < nSales; k += 1) {
      const hour = 8 + Math.floor(rnd() * 11); // 08..18
      const minute = [0, 15, 30, 45][Math.floor(rnd() * 4)];
      const customerId = rnd() < 0.3 ? 1 + Math.floor(rnd() * customers.length) : null;
      const customer = customersById(customerId);
      const canCredit = !!customer && Number(customer.creditLimit) > 0;
      const saleType = canCredit && rnd() < 0.22 ? 'CREDIT' : 'CASH';
      const discount = rnd() < 0.12 ? 500 : 0;

      const nItems = 1 + Math.floor(rnd() * 3);
      const chosen = [];
      for (let j = 0; j < nItems; j += 1) {
        let id;
        if (rnd() < 0.25 && HOT_HOUR_BOOST[hour]) {
          const pool = HOT_HOUR_BOOST[hour];
          id = pool[Math.floor(rnd() * pool.length)];
        } else {
          id = pickProductId(rnd);
        }
        let guard = 0;
        while (chosen.includes(id) && guard++ < 30) id = pickProductId(rnd);
        chosen.push(id);
      }

      dayPlans.push({
        daysAgo, hour, minute, customerId, discount, saleType,
        items: chosen.map((id) => [id, 1 + Math.floor(rnd() * 3)]),
      });
    }
  }

  const voidedIndex = Math.floor(dayPlans.length * 0.35);

  const sales = dayPlans.map((tpl, idx) => {
    const { daysAgo, hour, minute, customerId, discount, saleType } = tpl;
    const saleDate = at(daysAgo, hour, minute);
    const customer = customersById(customerId);

    const saleItems = tpl.items.map(([pid, qty], itemIdx) => {
      const p = productById(pid);
      return {
        saleItemId: idx * 100 + itemIdx + 1,
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        quantity: qty,
        unitPrice: p.unitPrice,
        totalPrice: round2(p.unitPrice * qty),
        costPriceAtSale: p.costPrice,
        quantityRefunded: 0,
        quantityAlreadyReturned: 0,
        quantityReturnable: qty,
        quantitySold: qty,
        unitRefundAmount: null,
      };
    });

    const subtotal = round2(saleItems.reduce((s, it) => s + it.totalPrice, 0));
    const taxAmount = 0;
    const totalAmount = round2(Math.max(0, subtotal + taxAmount - discount));
    const isCredit = saleType === 'CREDIT';
    const isVoided = idx === voidedIndex;
    const amountPaid = isCredit || isVoided ? 0 : round2(totalAmount);

    if (isCredit && !isVoided && customer) {
      customer.currentBalance = round2((customer.currentBalance || 0) + totalAmount);
    }

    return {
      id: idx + 1,
      invoiceNumber: nextInvoice(dayOf(saleDate)),
      customerId: customerId || null,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : (idx % 4 === 0 ? 'Walk-in' : null),
      cashierId: idx % 2 === 1 ? 4 : 3,
      cashierName: idx % 2 === 1 ? 'Ma Su' : 'U Kaung',
      saleDate,
      subtotal,
      subTotal: subtotal,
      taxAmount,
      discountAmount: discount || 0,
      totalAmount,
      amountPaid,
      changeGiven: isCredit || isVoided ? 0 : round2(amountPaid - totalAmount),
      paymentMethod: isCredit ? 'CREDIT' : 'CASH',
      saleType,
      dueDate: isCredit ? addDaysTo(dayOf(saleDate), 7) : null,
      paymentStatus: isVoided ? 'VOIDED' : (isCredit ? 'CREDIT' : 'PAID'),
      isVoided,
      voidedReason: isVoided ? 'Wrong order placed by mistake' : null,
      totalReturned: 0,
      returnStatus: null,
      balanceDue: isCredit ? totalAmount : 0,
      items: saleItems,
      createdAt: saleDate,
      updatedAt: saleDate,
    };
  });

  // AR payments: partial payment for the 3 earliest credit sales, recorded a
  // couple of days after each sale (clamped to today).
  const arPayments = [];
  const todayStr = dateOnly(0);
  sales
    .filter((s) => s.saleType === 'CREDIT' && !s.isVoided && s.balanceDue > 0)
    .slice(0, 3)
    .forEach((s, i) => {
      const paid = round2(s.balanceDue * (0.3 + ((i * 13) % 30) / 100));
      let payDate = addDaysTo(dayOf(s.saleDate), i + 2);
      if (payDate > todayStr) payDate = todayStr;
      arPayments.push({
        id: i + 1,
        invoiceId: s.id,
        invoiceNumber: s.invoiceNumber,
        amount: paid,
        paymentDate: `${payDate}T16:00:00`,
        recordedByName: i % 2 === 1 ? 'Ma Su' : 'U Kaung',
        notes: i === 0 ? 'Initial partial payment' : 'Payment received',
      });
      s.balanceDue = round2(s.balanceDue - paid);
      s.amountPaid = round2((s.amountPaid || 0) + paid);
      const c = findCustomerById(s.customerId);
      if (c) c.currentBalance = round2((c.currentBalance || 0) - paid);
    });

  // Sale returns: one cash-sale partial return and one credit-sale partial refund.
  const saleReturns = [];
  const clampToToday = (d) => (d > todayStr ? todayStr : d);
  const addReturn = (sale, itemIdx, qty, daysAfter) => {
    const it = sale.items[itemIdx];
    if (!it) return;
    const refund = round2(it.unitPrice * qty);
    it.quantityRefunded = (it.quantityRefunded || 0) + qty;
    it.quantityAlreadyReturned = it.quantityRefunded;
    it.quantityReturnable = Math.max(0, Number(it.quantity) - it.quantityRefunded);
    sale.totalReturned = round2((sale.totalReturned || 0) + refund);
    sale.returnStatus = 'PARTIAL';
    if (sale.saleType === 'CREDIT') {
      sale.balanceDue = round2(Math.max(0, (sale.balanceDue || 0) - refund));
      const c = findCustomerById(sale.customerId);
      if (c) c.currentBalance = round2(Math.max(0, (c.currentBalance || 0) - refund));
    }
    saleReturns.push({
      id: saleReturns.length + 1,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      returnDate: clampToToday(addDaysTo(dayOf(sale.saleDate), daysAfter)),
      totalRefund: refund,
      items: [{ productId: it.productId, productName: it.productName, quantity: qty, refundAmount: refund }],
      paymentMethod: 'CASH',
    });
  };
  const cashSaleForReturn = sales.find((s) => !s.isVoided && s.saleType === 'CASH' && s.items.length >= 2);
  const creditSaleForReturn = sales.find((s) => !s.isVoided && s.saleType === 'CREDIT' && s.items.length >= 2);
  if (cashSaleForReturn) addReturn(cashSaleForReturn, 0, 1, 1);
  if (creditSaleForReturn) addReturn(creditSaleForReturn, 1, 1, 2);

  // ── Shifts: one closed shift per day that has sales ──
  const byDay = {};
  sales.forEach((s) => {
    if (s.isVoided) return;
    const day = dayOf(s.saleDate);
    if (!byDay[day]) byDay[day] = { cashSales: 0 };
    if (s.saleType === 'CASH') byDay[day].cashSales = round2(byDay[day].cashSales + s.totalAmount);
  });
  const shifts = Object.keys(byDay)
    .sort()
    .map((day, i) => {
      const openingAmount = 50000;
      const cashSalesTotal = byDay[day].cashSales;
      const expectedAmount = round2(openingAmount + cashSalesTotal);
      return {
        id: i + 1,
        cashierId: i % 2 === 1 ? 4 : 3,
        cashierName: i % 2 === 1 ? 'Ma Su' : 'U Kaung',
        openingAmount,
        openingTime: `${day}T08:00:00`,
        cashSalesTotal,
        expectedAmount,
        closingAmount: expectedAmount,
        variance: 0,
        closingTime: `${day}T17:30:00`,
        notes: '',
        status: 'CLOSED',
      };
    });

  // ── Purchases ──
  const purchases = PURCHASE_TEMPLATES.map((tpl, idx) => {
    const [supplierIdx, paymentStatus, daysAgo, items] = tpl;
    const itemsOut = items.map(([pid, qty, unitCost], itemIdx) => {
      const p = productById(pid);
      return {
        id: idx * 10 + itemIdx + 1,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: qty,
        unitCost: unitCost * 1000,
        totalCost: round2(qty * unitCost * 1000),
      };
    });
    const total = round2(itemsOut.reduce((s, it) => s + it.totalCost, 0));
    return {
      id: idx + 1,
      purchaseNumber: `PO-${dateOnly(daysAgo).replace(/-/g, '')}-${String(idx + 1).padStart(4, '0')}`,
      supplierId: supplierIdx + 1,
      supplierName: suppliers[supplierIdx].name,
      purchaseDate: dateOnly(daysAgo),
      subtotal: total,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: total,
      paymentStatus,
      createdBy: 4,
      createdByName: 'U Kaung',
      items: itemsOut,
      notes: '',
      createdAt: at(daysAgo, 9, 0),
    };
  });

  // ── Orders ──
  let orderSeq = 0;
  const orders = ORDER_TEMPLATES.map((tpl) => {
    const [daysAgo, customerId, status, items] = tpl;
    const customer = customersById(customerId);
    const itemsOut = items.map(([pid, qty]) => {
      const p = productById(pid);
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: qty,
        unitPrice: p.unitPrice,
      };
    });
    const total = round2(itemsOut.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
    orderSeq += 1;
    return {
      id: orderSeq,
      orderNumber: `ORD-${String(1000 + orderSeq)}`,
      items: itemsOut,
      customerId: customerId || null,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : null,
      cashierId: 3,
      cashierName: 'U Kaung',
      notes: '',
      status,
      totalAmount: total,
      createdAt: at(daysAgo, 13, 15),
      updatedAt: at(daysAgo, 13, 15),
    };
  });

  // ── Expenses ──
  const expenses = EXPENSE_TEMPLATES.map((tpl, idx) => ({
    id: idx + 1,
    category: tpl[1],
    description: tpl[2],
    amount: tpl[3] * 1000,
    expenseDate: dateOnly(tpl[0]),
    createdBy: idx % 2 === 0 ? 4 : 3,
    createdByName: idx % 2 === 0 ? 'U Kaung' : 'Ma Su',
    hasReceiptImage: false,
    createdAt: at(tpl[0], 10, 0),
  }));

  // ── Audit logs ──
  const AUDIT_ACTIONS = [
    ['LOGIN', 'User', 'admin', 'Logged in successfully'],
    ['CREATE', 'Sale', 'Ma Su', `Created sale ${sales[sales.length - 1].invoiceNumber}`],
    ['UPDATE', 'Product', 'U Kaung', 'Updated Cheese Burger stock'],
    ['CREATE', 'Purchase', 'U Kaung', `Created purchase ${purchases[0].purchaseNumber}`],
    ['LOGIN', 'User', 'cashier', 'Logged in successfully'],
    ['CREATE', 'Expense', 'U Kaung', 'Added cleaning supplies expense'],
    ['CREATE', 'Return', 'Ma Su', `Processed return for ${saleReturns[0] ? saleReturns[0].invoiceNumber : 'sale'}`],
    ['UPDATE', 'Customer', 'U Kaung', `Recorded payment for ${arPayments[0] ? arPayments[0].invoiceNumber : 'credit sale'}`],
  ];
  const auditLogs = AUDIT_ACTIONS.map((a, i) => ({
    id: i + 1,
    action: a[0],
    entity: a[1],
    username: a[2],
    details: a[3],
    timestamp: at(i + 2, i + 8, 0),
  }));

  // ── System settings ──
  const settings = [
    { key: 'companyName', value: 'Sunrise Mini Mart' },
    { key: 'currency', value: 'MMK' },
    { key: 'taxPercentage', value: '0' },
  ];

  const users = [
    {
      id: 1,
      username: 'admin',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@deshop.demo',
      phone: '0912345678',
      roleName: 'ROLE_ADMIN',
      isActive: true,
      preferredLanguage: 'en',
      createdAt: at(90, 9, 0),
    },
    {
      id: 2,
      username: 'manager',
      password: 'manager123',
      firstName: 'Nyi',
      lastName: 'Nyi',
      email: 'manager@deshop.demo',
      phone: '0922334455',
      roleName: 'ROLE_MANAGER',
      isActive: true,
      preferredLanguage: 'en',
      createdAt: at(90, 9, 5),
    },
    {
      id: 3,
      username: 'cashier',
      password: 'cashier123',
      firstName: 'Ma',
      lastName: 'Su',
      email: 'cashier@deshop.demo',
      phone: '0933445566',
      roleName: 'ROLE_CASHIER',
      isActive: true,
      preferredLanguage: 'en',
      createdAt: at(90, 9, 10),
    },
  ];

  // Helper used above (defined late intentionally, scope is buildSeed).
  function findCustomerById(id) {
    return customersById(id);
  }

  return {
    meta: { version: SEED_VERSION, seededAt: localIso(demoNow()) },
    nextId: { user: 100, product: 100, category: 100, supplier: 100, customer: 100, sale: 200, purchase: 100, order: 100, expense: 100, shift: 100, movement: 1000, payment: 100, audit: 100 },
    users,
    roles: [
      { id: 1, name: 'ROLE_ADMIN' },
      { id: 2, name: 'ROLE_MANAGER' },
      { id: 3, name: 'ROLE_CASHIER' },
    ],
    shopInfo: {
      id: 1,
      shopName: 'Sunrise Mini Mart',
      shopType: 'MINI_MART',
      address: 'No. 45, Anawrahta Road, Pabedan Township, Yangon, Myanmar',
      phone: '09 771 234 567',
      email: 'info@sunriseminimart.demo',
      currency: 'MMK',
      taxPercentage: 0,
      discountEnabled: true,
      discountType: 'PERCENTAGE',
      discountValue: 5,
      hasLogo: true,
      logoSvg: LOGO_SVG,
      logoUrl: '/DeShop.ico',
      createdAt: at(90, 9, 0),
    },
    categories,
    products,
    suppliers,
    customers,
    sales,
    saleReturns,
    arPayments,
    shifts,
    purchases,
    orders,
    expenses,
    auditLogs,
    settings,
    receiptCustomization: {
      headerText: 'Thank you for shopping with us',
      mainMessage: 'Please keep this receipt for your records.',
      footerText: 'Thank you for your business!',
      paperSize: '58',
      timeFormat: '12',
      logoSize: 80,
      showLogo: true,
      showShopName: true,
      showAddress: true,
      showPhone: true,
      headerAlign: 'center',
      fontSize: 'normal',
      dividerStyle: 'dashed',
      boldShopName: true,
      showQRCode: false,
      showCreditInfo: true,
      showTax: true,
      showDiscount: true,
    },
    backupSettings: {
      isEnabled: false,
      frequency: 'WEEKLY',
      customCronExpression: '',
      lastBackupDate: at(2, 9, 0),
      nextBackupDate: null,
      googleRefreshToken: null,
      googleAccountEmail: null,
    },
  };
}