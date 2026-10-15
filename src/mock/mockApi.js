// Demo mock API. Masquerades as the backend so the existing services layer
// (axios-shaped calls over /api) works unchanged in a pure frontend demo.
//
// Responses follow the real backend contract:
//   - JSON endpoints → { status, data: { success, message, data } }
//   - blob/text endpoints → axios-like { status, data: <Blob|string> } directly
//   - failures → rejected promise with .response = { status, data: { message, code } }

import { getDb, saveDb } from './mockDb';
import { demoNow, demoToday, demoYear, demoMonth } from '../utils/demoClock';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Deterministic 0..1 value derived from a key, so "change %" style numbers stay
// identical across reloads instead of using Math.random().
const stableRatio = (key) => {
  let h = 2166136261;
  const str = String(key);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

const todayLocal = () => demoToday();

const dayOf = (isoStr) => (isoStr || '').slice(0, 10);

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function ok(data) {
  return { status: 200, data: { success: true, message: 'OK', data } };
}

function created(data) {
  return { status: 201, data: { success: true, message: 'Created', data } };
}

function raw(data) {
  return { status: 200, data };
}

function fail(message, status = 400, code = null) {
  const err = new Error(message);
  err.response = { status, data: { success: false, message, code } };
  throw err;
}

function notFound(message = 'Resource not found') {
  return fail(message, 404);
}

function paginate(arr, page = 0, size = 20) {
  page = Number(page) || 0;
  size = Number(size) || 20;
  const start = page * size;
  return {
    content: arr.slice(start, start + size),
    page: {
      size,
      number: page,
      totalElements: arr.length,
      totalPages: Math.max(1, Math.ceil(arr.length / size)),
    },
  };
}

function sortDescBy(arr, field) {
  return [...arr].sort((a, b) => (String(b[field] || '') < String(a[field] || '') ? -1 : 1));
}

const toBlob = (str, type) => new Blob([str], { type });

const dataUrlToBlob = (dataUrl) => {
  const [head, b64] = String(dataUrl).split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const DEFAULT_PRODUCT_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
  `<rect width="160" height="160" rx="18" fill="#5A6473"/>` +
  `<text x="80" y="90" text-anchor="middle" font-size="22" font-weight="700" fill="#FFFFFF">No image</text>` +
  `</svg>`;

function findProduct(db, id) {
  return db.products.find((p) => p.id === Number(id));
}

function findCustomer(db, id) {
  return db.customers.find((c) => c.id === Number(id));
}

function activeTokenUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u;
  } catch {
    return null;
  }
}

// ─── Shared report math ──────────────────────────────────────────────────────
function salesInRange(db, startDate, endDate) {
  const s = startDate || '0000-01-01';
  const e = endDate || '9999-12-31';
  return db.sales.filter(
    (x) => !x.isVoided && dayOf(x.saleDate) >= s && dayOf(x.saleDate) <= e
  );
}

function rangeWindow(startDate, endDate) {
  const s = startDate || todayLocal();
  const e = endDate || todayLocal();
  const len = Math.max(1, Math.round((new Date(e) - new Date(s)) / 86400000) + 1);
  return { startDate: addDays(s, -len), endDate: addDays(s, -1) };
}

function shiftMonths(y, m, by) {
  const d = new Date(y, m - 1 + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function salesCost(db, list) {
  let cost = 0;
  (list || []).forEach((s) => {
    (s.items || []).forEach((it) => {
      cost += (Number(it.costPriceAtSale) || 0) * (Number(it.quantity) || 0);
    });
  });
  return round2(cost);
}

function expensesIn(db, start, end) {
  return db.expenses.filter((e) => dayOf(e.expenseDate) >= start && dayOf(e.expenseDate) <= end);
}

function financialNumbers(db, list) {
  const revenue = round2(list.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
  const totalCogs = salesCost(db, list);
  const grossProfit = round2(revenue - totalCogs);
  return { revenue, totalCogs, grossProfit };
}

function customerTotalSpend(db, customerId) {
  return round2(
    db.sales
      .filter((s) => s.customerId === Number(customerId) && !s.isVoided)
      .reduce((s, x) => s + Number(x.totalAmount || 0), 0)
  );
}

function ensureMovements(db) {
  if (db.movements && db.movements.length) return;
  const seed = [];
  db.sales.forEach((s) => {
    (s.items || []).forEach((it) => {
      seed.push({
        id: seed.length + 1,
        productId: it.productId,
        productName: it.productName,
        sku: '',
        quantityChange: -(Number(it.quantity) || 0),
        type: 'SALE',
        reason: `Sale ${s.invoiceNumber}`,
        movementDate: s.saleDate,
        performedByName: s.cashierName || 'System',
      });
    });
  });
  db.purchases.forEach((p) => {
    (p.items || []).forEach((it) => {
      seed.push({
        id: seed.length + 1,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku || '',
        quantityChange: Number(it.quantity) || 0,
        type: 'PURCHASE',
        reason: `Purchase ${p.purchaseNumber}`,
        movementDate: `${p.purchaseDate}T09:00:00`,
        performedByName: p.createdByName || 'System',
      });
    });
  });
  db.movements = seed.sort((a, b) => (a.movementDate < b.movementDate ? 1 : -1));
  db.nextId.movement = db.movements.length + 1;
}

function buildSaleFromPayload(db, body, currentUser) {
  const items = (body.items || []).map((raw, idx) => {
    const p = findProduct(db, raw.productId);
    if (!p) fail(`Product ${raw.productId} not found`, 400);
    const qty = Number(raw.quantity) || 1;
    if (qty > (p.stockQuantity || 0)) {
      fail(`Insufficient stock for ${p.name}`, 400);
    }
    return {
      saleItemId: idx + 1,
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      quantity: qty,
      unitPrice: Number(p.unitPrice) || 0,
      totalPrice: round2((Number(p.unitPrice) || 0) * qty),
      costPriceAtSale: p.costPrice || 0,
      quantityRefunded: 0,
      quantityAlreadyReturned: 0,
      quantityReturnable: qty,
      quantitySold: qty,
      unitRefundAmount: null,
    };
  });

  const subtotal = round2(items.reduce((s, it) => s + it.totalPrice, 0));
  const shop = db.shopInfo;
  const taxPercentage = Number(shop.taxPercentage) || 0;
  const taxAmount = round2(subtotal * (taxPercentage / 100));

  let discount = Number(body.discountAmount) || 0;
  if (!discount && shop.discountEnabled && shop.discountType === 'PERCENTAGE') {
    discount = round2(subtotal * ((Number(shop.discountValue) || 0) / 100));
  }
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;

  const totalAmount = round2(subtotal + taxAmount - discount);
  const saleType = body.saleType === 'CREDIT' ? 'CREDIT' : 'CASH';
  const customerId = body.customerId ? Number(body.customerId) : null;
  const customer = customerId ? findCustomer(db, customerId) : null;

  let amountPaid = 0;
  let paymentStatus = 'PAID';
  let balanceDue = 0;
  if (saleType === 'CREDIT') {
    if (!customer) fail('Credit sale requires a registered customer', 400);
    if (!body.dueDate) fail('Due date is required for credit sale', 400);
    amountPaid = Number(body.amountPaid) || 0;
    balanceDue = round2(totalAmount - amountPaid);
    paymentStatus = balanceDue > 0 ? 'CREDIT' : 'PAID';
    customer.currentBalance = round2((customer.currentBalance || 0) + balanceDue);
    if (customer.currentBalance > (customer.creditLimit || 0)) {
      customer.currentBalance = round2(customer.currentBalance - balanceDue);
      fail(`Credit limit exceeded for ${customer.firstName} ${customer.lastName}`, 400);
    }
  } else {
    amountPaid = Number(body.amountPaid);
    if (!amountPaid || amountPaid < totalAmount) {
      fail('Paid amount is less than total amount', 400);
    }
  }

  const saleDate = nowIso();
  const invoiceNumber = (() => {
    const key = dayOf(saleDate).replace(/-/g, '');
    db.nextId.invoiceCounter = db.nextId.invoiceCounter || {};
    db.nextId.invoiceCounter[key] = (db.nextId.invoiceCounter[key] || db.sales.length) + 1;
    return `INV-${key}-${String(db.nextId.invoiceCounter[key]).padStart(3, '0')}`;
  })();

  const sale = {
    id: db.nextId.sale++,
    invoiceNumber,
    customerId,
    customerName: customer
      ? `${customer.firstName} ${customer.lastName}`
      : body.customerName || null,
    cashierId: currentUser?.id || 1,
    cashierName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.username : 'Admin',
    saleDate,
    subtotal,
    subTotal: subtotal,
    taxAmount,
    discountAmount: discount,
    totalAmount,
    amountPaid,
    changeGiven: saleType === 'CASH' ? round2(amountPaid - totalAmount) : 0,
    paymentMethod: saleType,
    saleType,
    dueDate: saleType === 'CREDIT' ? body.dueDate : null,
    paymentStatus,
    isVoided: false,
    voidedReason: null,
    totalReturned: 0,
    returnStatus: null,
    balanceDue,
    items,
    createdAt: saleDate,
    updatedAt: saleDate,
  };

  items.forEach((it) => {
    const p = findProduct(db, it.productId);
    p.stockQuantity = Math.max(0, (p.stockQuantity || 0) - it.quantity);
  });

  db.sales.push(sale);
  db.movements = db.movements || [];
  items.forEach((it) => {
    db.movements.unshift({
      id: db.nextId.movement++,
      productId: it.productId,
      productName: it.productName,
      sku: findProduct(db, it.productId)?.sku || '',
      quantityChange: -it.quantity,
      type: 'SALE',
      reason: `Sale ${sale.invoiceNumber}`,
      movementDate: saleDate,
      performedByName: sale.cashierName,
    });
  });

  return sale;
}

// ─── Router ──────────────────────────────────────────────────────────────────
function dispatch(method, path, body, config = {}) {
  const db = getDb();
  const query = config.params || {};
  const user = activeTokenUser();
  const q = (k, dflt) => (query[k] != null && query[k] !== '' ? query[k] : dflt);

  // ── Auth ────────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/login') {
    const u = db.users.find(
      (x) => x.username === body.username && x.password === body.password && x.isActive
    );
    if (!u) fail('Invalid username or password', 401);
    const userOut = {
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      roleName: u.roleName,
      isActive: u.isActive,
      preferredLanguage: u.preferredLanguage || 'en',
      roles: [{ name: u.roleName.replace(/^ROLE_/, '') }],
    };
    return ok({ token: `demo.jwt.${u.id}.${Date.now()}`, accessToken: `demo.jwt.${u.id}.${Date.now()}`, user: userOut });
  }

  if (method === 'POST' && path === '/auth/logout') return ok(true);

  if (method === 'POST' && path === '/auth/change-password') {
    const u = db.users.find((x) => x.id === Number(user?.id));
    if (!u) fail('Not authenticated', 401);
    if (u.password !== body.currentPassword) fail('Current password is incorrect', 400);
    u.password = body.newPassword;
    saveDb();
    return ok(true);
  }

  if (method === 'POST' && path === '/auth/register-first-admin') {
    if (db.users.length > 0) fail('An administrator is already registered', 409);
    db.users.push({
      id: db.nextId.user++,
      username: body.username,
      password: body.password,
      firstName: body.firstName || 'Admin',
      lastName: body.lastName || '',
      email: body.email || '',
      phone: body.phone || '',
      roleName: 'ROLE_ADMIN',
      isActive: true,
      preferredLanguage: 'en',
    });
    saveDb();
    return created(true);
  }

  // ── Users ───────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/users') {
    const rows = sortDescBy(db.users, 'id');
    // The app reads /users BOTH as a plain array (Users page) and as a paged
    // body (ShiftHistory cashier filter: .content/.page). Return an array that
    // carries .content/.page too so both consumers work.
    const res = rows.slice();
    res.content = rows;
    res.page = { size: rows.length, number: 0, totalElements: rows.length, totalPages: Math.max(1, rows.length) };
    return ok(res);
  }
  if (method === 'POST' && path === '/users') {
    if (db.users.some((u) => u.username === body.username)) fail('Username already exists', 409);
    const n = {
      id: db.nextId.user++,
      username: body.username,
      password: body.password || 'password123',
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      email: body.email || '',
      phone: body.phone || '',
      roleName: `ROLE_${(body.roleName || 'CASHIER').replace(/^ROLE_/, '').toUpperCase()}`,
      isActive: body.isActive !== false,
      preferredLanguage: 'en',
    };
    db.users.push(n);
    saveDb();
    return created(n);
  }
  if (method === 'GET' && /^\/users\/me\/language$/.test(path)) {
    return ok(db.users.find((x) => x.id === Number(user?.id)) || {});
  }
  if (method === 'PATCH' && /^\/users\/me\/language$/.test(path)) {
    const u = db.users.find((x) => x.id === Number(user?.id));
    if (!u) fail('Not authenticated', 401);
    u.preferredLanguage = query.lang || 'en';
    saveDb();
    return ok(u);
  }
  if (method === 'GET' && /^\/users\/\d+\/stats$/.test(path)) {
    const uid = Number(path.split('/')[2]);
    const u = db.users.find((x) => x.id === uid);
    if (!u) notFound('User not found');
    const theirs = db.sales.filter((s) => s.cashierId === uid && !s.isVoided);
    const todayS = todayLocal();
    const todayRows = theirs.filter((s) => dayOf(s.saleDate) === todayS);
    return ok({
      totalSales: theirs.length,
      totalRevenue: round2(theirs.reduce((s, x) => s + Number(x.totalAmount || 0), 0)),
      todaySales: todayRows.length,
      todayRevenue: round2(todayRows.reduce((s, x) => s + Number(x.totalAmount || 0), 0)),
    });
  }
  if (method === 'GET' && /^\/users\/\d+$/.test(path)) {
    const u = db.users.find((x) => x.id === Number(path.split('/')[2]));
    if (!u) notFound('User not found');
    return ok(u);
  }
  if (method === 'PUT' && /^\/users\/\d+$/.test(path)) {
    const u = db.users.find((x) => x.id === Number(path.split('/')[2]));
    if (!u) notFound('User not found');
    if (body.username && db.users.some((x) => x.id !== u.id && x.username === body.username)) {
      fail('Username already exists', 409);
    }
    const { id, ...changes } = body;
    Object.assign(u, changes, { id: u.id });
    saveDb();
    return ok(u);
  }
  if (method === 'DELETE' && /^\/users\/\d+$/.test(path)) {
    const id = Number(path.split('/')[2]);
    if (id === Number(user?.id)) fail('You cannot delete your own account', 400);
    db.users = db.users.filter((u) => u.id !== id);
    saveDb();
    return ok(true);
  }

  // ── System settings ─────────────────────────────────────────────────────
  if (method === 'GET' && path === '/settings') return ok(db.settings || []);
  if (method === 'GET' && /^\/settings\/key\/.+/.test(path)) {
    const key = decodeURIComponent(path.slice('/settings/key/'.length));
    const v = (db.settings || []).find((s) => s.key === key) || { key };
    return ok(v);
  }
  if (method === 'PUT' && /^\/settings\/key\//.test(path)) {
    const key = decodeURIComponent(path.slice('/settings/key/'.length));
    const v = db.settings.find((s) => s.key === key);
    if (v) Object.assign(v, body);
    else db.settings.push({ key, ...body });
    saveDb();
    return ok(v || body);
  }

  // ── Audit logs ──────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/audit-logs') {
    let rows = sortDescBy(db.auditLogs || [], 'timestamp');
    if (query.userId) rows = rows.filter((r) => r.userId === Number(query.userId));
    if (query.action) rows = rows.filter((r) => r.action === query.action);
    if (query.startDate) rows = rows.filter((r) => dayOf(r.timestamp) >= query.startDate);
    if (query.endDate) rows = rows.filter((r) => dayOf(r.timestamp) <= query.endDate);
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }

  // ── Catalog: products ───────────────────────────────────────────────────
  if (method === 'GET' && path === '/products/search') {
    const kw = String(query.keyword || '').toLowerCase();
    const rows = kw
      ? db.products.filter((p) => (p.name || '').toLowerCase().includes(kw) || (p.sku || '').toLowerCase().includes(kw))
      : db.products;
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'GET' && /^\/products\/\d+\/image$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (!p || !p.hasImage) return raw(toBlob(DEFAULT_PRODUCT_SVG, 'image/svg+xml'));
    if (p.imageDataUrl) return raw(dataUrlToBlob(p.imageDataUrl));
    if (p.imageUrl) {
      return fetch(p.imageUrl)
        .then((r) => {
          if (!r.ok) throw new Error('image fetch failed');
          return r.blob();
        })
        .then((blob) => raw(blob))
        .catch(() => raw(toBlob(p.imageSvg || DEFAULT_PRODUCT_SVG, 'image/svg+xml')));
    }
    return raw(toBlob(p.imageSvg || DEFAULT_PRODUCT_SVG, 'image/svg+xml'));
  }
  if (method === 'POST' && /^\/products\/\d+\/image$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (!p) notFound('Product not found');
    const file = body instanceof FormData ? body.get('file') : null;
    if (!file) fail('No image file provided', 400);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        p.imageDataUrl = reader.result;
        p.imageSvg = null;
        p.hasImage = true;
        saveDb();
        resolve(created({ id: p.id }));
      };
      reader.onerror = () => fail('Could not read image file', 400);
      reader.readAsDataURL(file);
    });
  }
  if (method === 'DELETE' && /^\/products\/\d+\/image$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (p) {
      p.hasImage = false;
      p.imageSvg = null;
      p.imageDataUrl = null;
      saveDb();
    }
    return ok(true);
  }
  if (method === 'GET' && /^\/products\/\d+\/suppliers$/.test(path)) {
    const pid = Number(path.split('/')[2]);
    const supplierMap = {};
    db.purchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        if (Number(item.productId) !== pid) return;
        const sid = purchase.supplierId;
        if (!supplierMap[sid]) {
          supplierMap[sid] = {
            supplierId: sid,
            supplierName: purchase.supplierName,
            timesPurchased: 0,
            totalQuantityPurchased: 0,
            totalAmountSpent: 0,
            mostRecentUnitCost: item.unitCost,
            mostRecentPurchaseDate: purchase.purchaseDate,
          };
        }
        const e = supplierMap[sid];
        e.timesPurchased += 1;
        e.totalQuantityPurchased += item.quantity;
        e.totalAmountSpent += item.totalCost;
        if (purchase.purchaseDate >= e.mostRecentPurchaseDate) {
          e.mostRecentPurchaseDate = purchase.purchaseDate;
          e.mostRecentUnitCost = item.unitCost;
        }
      });
    });
    return ok(Object.values(supplierMap).map((v) => ({ ...v, totalAmountSpent: round2(v.totalAmountSpent) })));
  }
  if (method === 'GET' && /^\/products\/\d+\/cost-history$/.test(path)) {
    const pid = Number(path.split('/')[2]);
    const product = db.products.find((x) => x.id === pid);
    const sellingPrice = product ? Number(product.unitPrice) || 0 : 0;
    const entries = [];
    db.purchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        if (Number(item.productId) !== pid) return;
        entries.push({
          purchaseDate: purchase.purchaseDate,
          supplierName: purchase.supplierName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          currentSellingPrice: sellingPrice,
          impliedMarginPercent: sellingPrice > 0
            ? round2(((sellingPrice - item.unitCost) / sellingPrice) * 100)
            : 0,
        });
      });
    });
    return ok(entries);
  }
  if (method === 'GET' && /^\/products\/\d+\/price-history$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (!p) return ok([]);
    const currentPrice = Number(p.unitPrice) || 0;
    let history = Array.isArray(p.priceHistory) ? p.priceHistory : [];
    // Defensive fallback: if a stale localStorage seed lacks price history, build
    // 3 plausible recent changes ending at the current price so the section never
    // shows "No price changes" for a product that has a current selling price.
    if (history.length === 0 && currentPrice > 0) {
      const steps = [
        { daysAgo: 1, pct: -0.05, by: 'Ma Su' },
        { daysAgo: 3, pct: -0.02, by: 'U Kaung' },
        { daysAgo: 6, pct: -0.04, by: 'Nyi Nyi' },
      ];
      let runningPrice = currentPrice;
      history = steps.map((st, k) => {
        const newPrice = k === 0 ? currentPrice : runningPrice;
        runningPrice = Math.round(runningPrice / (1 - st.pct));
        const oldPrice = runningPrice;
        const d = demoNow();
        d.setDate(d.getDate() - st.daysAgo);
        d.setHours(11, 15 + k * 10, 0, 0);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
        return { id: steps.length - k, productId: p.id, oldPrice, newPrice, changedAt: iso, changedByUsername: st.by };
      });
    }
    return ok([...history].sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1)));
  }
  if (method === 'GET' && /^\/products\/\d+\/top-customers$/.test(path)) {
    const pid = Number(path.split('/')[2]);
    const map = {};
    db.sales.forEach((s) => {
      if (s.isVoided || !s.customerId) return;
      (s.items || []).forEach((it) => {
        if (Number(it.productId) === pid) {
          const key = s.customerId;
          map[key] = map[key] || { customerId: key, customerName: s.customerName, phone: findCustomer(db, key)?.phone || '', totalSpent: 0, visitCount: 0 };
          map[key].totalSpent = round2(map[key].totalSpent + it.totalPrice);
          map[key].visitCount += 1;
        }
      });
    });
    return ok(Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, Number(query.limit) || 10));
  }
  if (method === 'GET' && /^\/products\/\d+\/sales-summary$/.test(path)) {
    const pid = Number(path.split('/')[2]);
    let qty = 0; let revenue = 0; let count = 0; let last = null;
    db.sales.forEach((s) => {
      if (s.isVoided) return;
      const its = (s.items || []).filter((it) => Number(it.productId) === pid);
      if (its.length) {
        count += 1;
        last = last && last > s.saleDate ? last : s.saleDate;
      }
      its.forEach((it) => { qty += Number(it.quantity); revenue += Number(it.totalPrice); });
    });
    return ok({ totalQuantitySold: qty, totalRevenue: round2(revenue), totalProfit: round2(revenue - 0), transactionCount: count, lastSoldDate: last, averageQuantityPerSale: count ? round2(qty / count) : 0 });
  }
  if (method === 'GET' && /^\/products\/\d+$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (!p) notFound('Product not found');
    return ok(p);
  }
  if (method === 'PUT' && /^\/products\/\d+$/.test(path)) {
    const p = findProduct(db, path.split('/')[2]);
    if (!p) notFound('Product not found');
    if (body.sku && db.products.some((x) => x.id !== p.id && x.sku === body.sku)) fail('A product with this SKU already exists', 409);
    Object.assign(p, body, { categoryName: db.categories.find((c) => c.id === Number(body.categoryId || p.categoryId))?.name, supplierName: db.suppliers.find((s) => s.id === Number(body.supplierId || p.supplierId))?.name, updatedAt: nowIso() });
    saveDb();
    return ok(p);
  }
  if (method === 'DELETE' && /^\/products\/\d+$/.test(path)) {
    const id = Number(path.split('/')[2]);
    db.products = db.products.filter((p) => p.id !== id);
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/products') {
    let rows = [...db.products];
    if (query.categoryId) rows = rows.filter((p) => String(p.categoryId) === String(query.categoryId));
    if (query.view === 'low-stock') rows = rows.filter((p) => p.stockQuantity <= p.minStockLevel);
    const sortBy = query.sortBy || 'createdAt';
    rows.sort((a, b) => (String(b[sortBy] || '') < String(a[sortBy] || '') ? -1 : 1));
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'POST' && path === '/products') {
    if (db.products.some((p) => p.sku === body.sku)) fail('A product with this SKU already exists', 409);
    const catId = body.categoryId ? Number(body.categoryId) : null;
    const supId = body.supplierId ? Number(body.supplierId) : null;
    const n = {
      id: db.nextId.product++,
      sku: body.sku,
      name: body.name,
      description: body.description || '',
      unit: body.unit || '',
      unitPrice: Number(body.unitPrice) || 0,
      costPrice: Number(body.costPrice) || 0,
      taxRate: Number(body.taxRate) || 0,
      stockQuantity: Number(body.stockQuantity) || 0,
      minStockLevel: Number(body.minStockLevel) || 0,
      categoryId: catId,
      categoryName: db.categories.find((c) => c.id === catId)?.name || null,
      supplierId: supId,
      supplierName: db.suppliers.find((s) => s.id === supId)?.name || null,
      hasImage: false,
      isActive: body.isActive !== false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.products.push(n);
    saveDb();
    return created(n);
  }

  // ── Catalog: categories ─────────────────────────────────────────────────
  if (method === 'GET' && path === '/categories/stats/summary') {
    return ok({
      totalCategories: db.categories.length,
      totalProducts: db.products.length,
      totalInventoryValue: round2(db.products.reduce((s, p) => s + (Number(p.costPrice) || 0) * (Number(p.stockQuantity) || 0), 0)),
    });
  }
  if (method === 'GET' && /^\/categories\/\d+$/.test(path)) {
    const c = db.categories.find((x) => x.id === Number(path.split('/')[2]));
    if (!c) notFound('Category not found');
    return ok(c);
  }
  if (method === 'PUT' && /^\/categories\/\d+$/.test(path)) {
    const c = db.categories.find((x) => x.id === Number(path.split('/')[2]));
    if (!c) notFound('Category not found');
    Object.assign(c, body, { updatedAt: nowIso() });
    db.products.forEach((p) => { if (String(p.categoryId) === String(c.id)) p.categoryName = c.name; });
    saveDb();
    return ok(c);
  }
  if (method === 'DELETE' && /^\/categories\/\d+$/.test(path)) {
    const id = Number(path.split('/')[2]);
    if (db.products.some((p) => Number(p.categoryId) === id)) fail('Cannot delete a category that still has products', 409);
    db.categories = db.categories.filter((c) => c.id !== id);
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/categories') {
    const rows = db.categories.map((c) => {
      const prods = db.products.filter((p) => Number(p.categoryId) === c.id);
      let revenue = 0;
      db.sales.forEach((s) => {
        if (s.isVoided) return;
        (s.items || []).forEach((it) => {
          const p = prods.find((x) => x.id === Number(it.productId));
          if (p) revenue += Number(it.totalPrice);
        });
      });
      return { ...c, productCount: prods.length, revenue: round2(revenue) };
    });
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'POST' && path === '/categories') {
    if (db.categories.some((c) => c.name.toLowerCase() === String(body.name || '').toLowerCase())) fail('A category with this name already exists', 409);
    const n = { id: db.nextId.category++, name: body.name, description: body.description || '', isActive: true, productCount: 0, revenue: 0, createdAt: nowIso(), updatedAt: nowIso() };
    db.categories.push(n);
    saveDb();
    return created(n);
  }

  // ── Suppliers & purchases ───────────────────────────────────────────────
  if (method === 'GET' && path === '/suppliers/search') {
    const kw = String(query.query || '').toLowerCase();
    const rows = kw
      ? db.suppliers.filter((s) => (s.name || '').toLowerCase().includes(kw) || (s.contactPerson || '').toLowerCase().includes(kw))
      : db.suppliers;
    return ok(paginate(rows, 0, 20));
  }
  if (method === 'GET' && /^\/suppliers\/\d+$/.test(path)) {
    const s = db.suppliers.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Supplier not found');
    return ok(s);
  }
  if (method === 'PUT' && /^\/suppliers\/\d+$/.test(path)) {
    const s = db.suppliers.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Supplier not found');
    Object.assign(s, body, { updatedAt: nowIso() });
    db.products.forEach((p) => { if (String(p.supplierId) === String(s.id)) p.supplierName = s.name; });
    db.purchases.forEach((pr) => { if (String(pr.supplierId) === String(s.id)) pr.supplierName = s.name; });
    saveDb();
    return ok(s);
  }
  if (method === 'DELETE' && /^\/suppliers\/\d+$/.test(path)) {
    const id = Number(path.split('/')[2]);
    db.suppliers = db.suppliers.filter((s) => s.id !== id);
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/suppliers') return ok(paginate(db.suppliers, q('page', 0), q('size', 20)));
  if (method === 'POST' && path === '/suppliers') {
    const n = { id: db.nextId.supplier++, name: body.name, contactPerson: body.contactPerson || '', email: body.email || '', phone: body.phone || '', address: body.address || '', city: body.city || '', isActive: true, createdAt: nowIso(), updatedAt: nowIso() };
    db.suppliers.push(n);
    saveDb();
    return created(n);
  }

  if (method === 'GET' && path === '/purchases/number' && query.number) {
    const p = db.purchases.find((x) => x.purchaseNumber === query.number);
    if (!p) notFound('Purchase not found');
    return ok(p);
  }
  if (method === 'GET' && /^\/purchases\/supplier\/\d+\/top-products$/.test(path)) {
    const sid = Number(path.split('/')[3]);
    const map = {};
    db.purchases.forEach((pr) => {
      if (Number(pr.supplierId) !== sid) return;
      (pr.items || []).forEach((it) => {
        map[it.productId] = map[it.productId] || { productId: it.productId, productName: it.productName, totalQuantity: 0, totalAmount: 0 };
        map[it.productId].totalQuantity += Number(it.quantity) || 0;
        map[it.productId].totalAmount = round2(map[it.productId].totalAmount + (Number(it.totalCost) || 0));
      });
    });
    return ok(Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount));
  }
  if (method === 'GET' && /^\/purchases\/supplier\/\d+\/stats$/.test(path)) {
    const sid = Number(path.split('/')[3]);
    const rows = db.purchases.filter((pr) => Number(pr.supplierId) === sid);
    return ok({
      totalPurchases: rows.length,
      totalSpent: round2(rows.reduce((s, pr) => s + Number(pr.totalAmount || 0), 0)),
      outstandingBalance: round2(rows.filter((pr) => pr.paymentStatus === 'PENDING').reduce((s, pr) => s + Number(pr.totalAmount || 0), 0)),
      lastPurchaseDate: rows.map((r) => r.purchaseDate).sort().pop() || null,
    });
  }
  if (method === 'GET' && /^\/purchases\/\d+$/.test(path)) {
    const p = db.purchases.find((x) => x.id === Number(path.split('/')[2]));
    if (!p) notFound('Purchase not found');
    return ok(p);
  }
  if (method === 'PATCH' && /^\/purchases\/\d+\/payment-status$/.test(path)) {
    const p = db.purchases.find((x) => x.id === Number(path.split('/')[2]));
    if (!p) notFound('Purchase not found');
    p.paymentStatus = body.paymentStatus || p.paymentStatus;
    saveDb();
    return ok(p);
  }
  if (method === 'DELETE' && /^\/purchases\/\d+$/.test(path)) {
    db.purchases = db.purchases.filter((x) => x.id !== Number(path.split('/')[2]));
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/purchases') {
    const rows = sortDescBy(db.purchases, 'purchaseDate');
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'POST' && path === '/purchases') {
    const items = (body.items || []).map((raw, idx) => {
      const p = raw.productId ? findProduct(db, raw.productId) : null;
      if (!p) fail('Invalid product in purchase', 400);
      return {
        id: idx + 1,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: Number(raw.quantity) || 0,
        unitCost: Number(raw.unitCost) || 0,
        totalCost: round2((Number(raw.quantity) || 0) * (Number(raw.unitCost) || 0)),
      };
    });
    const total = round2(items.reduce((s, it) => s + it.totalCost, 0));
    const sup = db.suppliers.find((s) => s.id === Number(body.supplierId || 0));
    const purchaseDate = dayOf(body.purchaseDate || nowIso());
    const n = {
      id: db.nextId.purchase++,
      purchaseNumber: `PO-${purchaseDate.replace(/-/g, '')}-${String(db.purchases.length + 1).padStart(4, '0')}`,
      supplierId: sup?.id || null,
      supplierName: sup?.name || null,
      purchaseDate,
      subtotal: total,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: total,
      paymentStatus: 'PENDING',
      createdBy: user?.id || 1,
      createdByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
      items,
      notes: body.notes || '',
      createdAt: nowIso(),
    };
    db.purchases.unshift(n);
    items.forEach((it) => {
      const p = findProduct(db, it.productId);
      p.stockQuantity = (p.stockQuantity || 0) + it.quantity;
    });
    db.movements = db.movements || [];
    items.forEach((it) => {
      db.movements.unshift({
        id: db.nextId.movement++,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantityChange: it.quantity,
        type: 'PURCHASE',
        reason: `Purchase ${n.purchaseNumber}`,
        movementDate: nowIso(),
        performedByName: n.createdByName,
      });
    });
    saveDb();
    return created(n);
  }

  // ── Customers & AR ──────────────────────────────────────────────────────
  if (method === 'GET' && path === '/customers/cities') {
    return ok([...new Set(db.customers.map((c) => c.city).filter(Boolean))]);
  }
  if (method === 'GET' && path === '/customers/search') {
    const kw = String(query.keyword || '').toLowerCase();
    const city = String(query.city || '');
    let rows = db.customers;
    if (kw) rows = rows.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(kw) || (c.phone || '').includes(kw));
    if (city) rows = rows.filter((c) => c.city === city);
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'GET' && /^\/customers\/\d+$/.test(path)) {
    const c = findCustomer(db, path.split('/')[2]);
    if (!c) notFound('Customer not found');
    return ok(c);
  }
  if (method === 'PUT' && /^\/customers\/\d+$/.test(path)) {
    const c = findCustomer(db, path.split('/')[2]);
    if (!c) notFound('Customer not found');
    Object.assign(c, body, { updatedAt: nowIso() });
    saveDb();
    return ok(c);
  }
  if (method === 'DELETE' && /^\/customers\/\d+$/.test(path)) {
    db.customers = db.customers.filter((c) => c.id !== Number(path.split('/')[2]));
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/customers') return ok(paginate(db.customers, q('page', 0), q('size', 20)));
  if (method === 'POST' && path === '/customers') {
    const n = {
      id: db.nextId.customer++,
      customerCode: `CUST-${String(1000 + db.customers.length + 1)}`,
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      email: body.email || '',
      phone: body.phone || '',
      address: body.address || '',
      city: body.city || '',
      creditLimit: body.creditLimit != null ? Number(body.creditLimit) : 0,
      currentBalance: 0,
      isQuickAdd: false,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.customers.push(n);
    saveDb();
    return created(n);
  }

  // AR
  if (method === 'GET' && path === '/ar/outstanding') {
    let rows = db.sales.filter((s) => !s.isVoided && s.saleType === 'CREDIT' && (s.balanceDue || 0) > 0);
    const kw = String(query.keyword || '').toLowerCase();
    if (kw) rows = rows.filter((s) => (s.customerName || '').toLowerCase().includes(kw));
    const mapped = rows.map((s) => ({
      invoiceId: s.id,
      invoiceNumber: s.invoiceNumber,
      customerId: s.customerId,
      customerName: s.customerName,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      balanceDue: s.balanceDue,
      dueDate: s.dueDate,
      saleDate: s.saleDate,
      paymentStatus: (s.balanceDue || 0) > 0 ? 'CREDIT' : 'PAID',
    }));
    return ok(paginate(mapped, q('page', 0), q('size', 20)));
  }
  if (method === 'GET' && /^\/ar\/customer\/\d+$/.test(path)) {
    const cid = Number(path.split('/')[3]);
    const rows = db.sales
      .filter((s) => !s.isVoided && Number(s.customerId) === cid && s.saleType === 'CREDIT')
      .map((s) => ({
        invoiceId: s.id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        dueDate: s.dueDate,
        totalAmount: s.totalAmount,
        amountPaid: s.amountPaid,
        balanceDue: s.balanceDue,
        paymentStatus: (s.balanceDue || 0) > 0 ? 'CREDIT' : 'PAID',
      }));
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'POST' && /^\/ar\/\d+\/payment$/.test(path)) {
    const sale = db.sales.find((s) => s.id === Number(path.split('/')[2]));
    if (!sale) notFound('Invoice not found');
    const amount = Number(body.amount) || 0;
    if (amount <= 0 || amount > sale.balanceDue) fail('Invalid payment amount', 400);
    sale.balanceDue = round2((sale.balanceDue || 0) - amount);
    sale.amountPaid = round2((sale.amountPaid || 0) + amount);
    if (sale.balanceDue <= 0) { sale.balanceDue = 0; sale.paymentStatus = 'PAID'; }
    const c = findCustomer(db, sale.customerId);
    if (c) c.currentBalance = round2((c.currentBalance || 0) - amount);
    const pay = {
      id: db.nextId.payment++,
      invoiceId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      amount,
      paymentDate: nowIso(),
      recordedByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
      notes: body.notes || '',
    };
    db.arPayments = db.arPayments || [];
    db.arPayments.push(pay);
    saveDb();
    return created(pay);
  }
  if (method === 'GET' && /^\/ar\/\d+\/payments$/.test(path)) {
    const id = Number(path.split('/')[2]);
    return ok((db.arPayments || []).filter((p) => p.invoiceId === id));
  }

  // ── Sales ───────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/sales/verify-cart') {
    const itemsOut = (body.items || []).map((it) => {
      const p = findProduct(db, it.productId);
      const availableStock = p ? p.stockQuantity || 0 : 0;
      const unitPrice = p ? Number(p.unitPrice) || 0 : 0;
      return { ...it, productId: it.productId, unitPrice, availableStock, insufficientStock: Number(it.quantity || 1) > availableStock };
    });
    let subtotal = 0;
    itemsOut.forEach((it) => { subtotal += it.unitPrice * (Number(it.quantity) || 1); });
    subtotal = round2(subtotal);
    const taxAmount = round2(subtotal * ((Number(db.shopInfo.taxPercentage) || 0) / 100));
    let discount = Number(body.discountAmount) || 0;
    if (!discount && db.shopInfo.discountEnabled && db.shopInfo.discountType === 'PERCENTAGE') {
      discount = round2(subtotal * ((Number(db.shopInfo.discountValue) || 0) / 100));
    }
    if (discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;
    const invalid = itemsOut.filter((it) => it.insufficientStock);
    if (invalid.length) {
      return ok({
        valid: false,
        subtotal,
        taxAmount,
        discountAmount: discount,
        totalAmount: round2(subtotal + taxAmount - discount),
        items: itemsOut,
        messages: invalid.map((it) => `Insufficient stock for ${findProduct(db, it.productId)?.name || it.productId}`),
      });
    }
    return ok({
      valid: true,
      subtotal,
      taxAmount,
      discountAmount: discount,
      totalAmount: round2(subtotal + taxAmount - discount),
      items: itemsOut,
      messages: [],
    });
  }

  if (method === 'POST' && path === '/sales') {
    const sale = buildSaleFromPayload(db, body, user);
    saveDb();
    return created(sale);
  }

  if (method === 'GET' && path === '/sales/date-range') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    return ok({ content: sortDescBy(rows, 'saleDate'), page: { totalElements: rows.length } });
  }
  if (method === 'GET' && /^\/sales\/customer\/\d+\/daily-spending\/\d+$/.test(path)) {
    const cid = Number(path.split('/')[3]);
    const year = Number(path.split('/')[5]);
    const map = {};
    db.sales.forEach((s) => {
      if (s.customerId !== cid || s.isVoided) return;
      const y = Number(dayOf(s.saleDate).slice(0, 4));
      if (y !== year) return;
      const dd = dayOf(s.saleDate);
      map[dd] = round2((map[dd] || 0) + Number(s.totalAmount || 0));
    });
    return ok(Object.keys(map).sort().map((date) => ({ date, amount: map[date] })));
  }
  if (method === 'GET' && /^\/sales\/customer\/\d+\/top-products$/.test(path)) {
    const cid = Number(path.split('/')[3]);
    const map = {};
    db.sales.forEach((s) => {
      if (s.customerId !== cid || s.isVoided) return;
      (s.items || []).forEach((it) => {
        map[it.productId] = map[it.productId] || { productId: it.productId, productName: it.productName, totalQuantity: 0, totalAmount: 0 };
        map[it.productId].totalQuantity += Number(it.quantity) || 0;
        map[it.productId].totalAmount = round2(map[it.productId].totalAmount + Number(it.totalPrice || 0));
      });
    });
    return ok(Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10));
  }
  if (method === 'GET' && /^\/sales\/customer\/\d+\/stats$/.test(path)) {
    const cid = Number(path.split('/')[3]);
    const arr = db.sales.filter((s) => s.customerId === cid && !s.isVoided);
    const totalSpent = round2(arr.reduce((s, x) => s + Number(x.totalAmount || 0) - Number(x.totalReturned || 0), 0));
    const c = findCustomer(db, cid);
    return ok({
      totalSales: arr.length,
      totalSpent,
      averageOrderValue: arr.length ? round2(totalSpent / arr.length) : 0,
      lastVisitDate: arr.map((s) => s.saleDate).sort().pop() || null,
      outstandingBalance: round2(c?.currentBalance || 0),
    });
  }
  if (method === 'GET' && /^\/sales\/invoice\/.+/.test(path) && !path.includes('/print')) {
    const num = decodeURIComponent(path.split('/')[3]);
    const s = db.sales.find((x) => x.invoiceNumber === num);
    if (!s) notFound(`Sale with invoice ${num} not found`);
    return ok(s);
  }
  if (method === 'GET' && path === '/sales/old') {
    return ok([]);
  }
  if (method === 'DELETE' && path === '/sales/old') {
    const cutoff = demoNow();
    cutoff.setFullYear(cutoff.getFullYear() - (Number(query.olderThanYears) || 1));
    const cutoffStr = dayOf(cutoff.toISOString());
    const before = db.sales.length;
    db.sales = db.sales.filter((s) => dayOf(s.saleDate) >= cutoffStr);
    saveDb();
    return ok({ deletedSales: before - db.sales.length, cutoffDate: cutoffStr });
  }
  if (method === 'POST' && /^\/sales\/\d+\/void$/.test(path)) {
    const s = db.sales.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Sale not found');
    s.isVoided = true;
    s.voidedReason = query.reason || body?.reason || 'Voided';
    saveDb();
    return ok(s);
  }
  if (method === 'GET' && /^\/sales\/\d+\/returnable-items$/.test(path)) {
    const s = db.sales.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Sale not found');
    const items = (s.items || []).map((it, idx) => ({
      saleItemId: it.saleItemId ?? idx + 1,
      productId: it.productId,
      productName: it.productName,
      unitPrice: it.unitPrice,
      quantitySold: it.quantity,
      quantityAlreadyReturned: it.quantityRefunded || 0,
      quantityReturnable: Math.max(0, (Number(it.quantity) || 0) - (Number(it.quantityRefunded) || 0)),
      unitRefundAmount: it.unitPrice,
      totalPrice: it.totalPrice,
    }));
    return ok(items);
  }
  if (method === 'POST' && /^\/sales\/\d+\/returns$/.test(path)) {
    const s = db.sales.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Sale not found');
    let totalRefund = 0;
    const returnItems = (body.items || []).map((ri) => {
      const it = (s.items || []).find((x) => (x.saleItemId ?? x.productId) === Number(ri.saleItemId ?? ri.productId));
      if (!it) fail('Invalid return item', 400);
      const qty = Number(ri.quantity) || 0;
      const refund = round2((Number(ri.unitRefundAmount) ?? it.unitPrice) * qty);
      it.quantityRefunded = (it.quantityRefunded || 0) + qty;
      it.quantityAlreadyReturned = it.quantityRefunded;
      it.quantityReturnable = Math.max(0, Number(it.quantity) - it.quantityRefunded);
      totalRefund += refund;
      const p = findProduct(db, it.productId);
      if (p) p.stockQuantity = (p.stockQuantity || 0) + qty;
      return { productId: it.productId, productName: it.productName, quantity: qty, refundAmount: refund };
    });
    totalRefund = round2(totalRefund);
    s.totalReturned = round2((s.totalReturned || 0) + totalRefund);
    const allReturned = (s.items || []).every((it) => (it.quantityRefunded || 0) >= Number(it.quantity));
    s.returnStatus = s.items?.length ? (allReturned ? 'FULL' : 'PARTIAL') : null;
    if (s.saleType === 'CREDIT' && totalRefund > 0) {
      s.balanceDue = round2((s.balanceDue || 0) - totalRefund);
      const c = findCustomer(db, s.customerId);
      if (c) c.currentBalance = round2((c.currentBalance || 0) - totalRefund);
      if (s.balanceDue <= 0) { s.balanceDue = 0; s.paymentStatus = 'PAID'; }
    }
    const ret = { id: db.nextId.saleReturn++ || 1, saleId: s.id, invoiceNumber: s.invoiceNumber, returnDate: nowIso().split(' ')[0], totalRefund, items: returnItems, paymentMethod: body.paymentMethod || 'CASH' };
    db.saleReturns = db.saleReturns || [];
    db.saleReturns.unshift(ret);
    saveDb();
    return created(ret);
  }
  if (method === 'GET' && /^\/sales\/\d+$/.test(path)) {
    const s = db.sales.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Sale not found');
    return ok(s);
  }
  if (method === 'DELETE' && /^\/sales\/\d+$/.test(path)) {
    db.sales = db.sales.filter((x) => x.id !== Number(path.split('/')[2]));
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/sales') {
    let rows = [...db.sales];
    if (query.customerId) rows = rows.filter((s) => String(s.customerId) === String(query.customerId));
    if (query.invoice) rows = rows.filter((s) => (s.invoiceNumber || '').toLowerCase().includes(String(query.invoice).toLowerCase()));
    if (query.startDate) rows = rows.filter((s) => dayOf(s.saleDate) >= query.startDate);
    if (query.endDate) rows = rows.filter((s) => dayOf(s.saleDate) <= query.endDate);
    rows = sortDescBy(rows, query.sortBy || 'saleDate');
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }

  // ── Sale returns ────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/sale-returns') {
    let rows = sortDescBy(db.saleReturns || [], 'returnDate');
    if (query.invoice) rows = rows.filter((r) => (r.invoiceNumber || '').toLowerCase().includes(String(query.invoice).toLowerCase()));
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'GET' && /^\/sale-returns\/\d+$/.test(path)) {
    const r = (db.saleReturns || []).find((x) => x.id === Number(path.split('/')[2]));
    if (!r) notFound('Return not found');
    return ok(r);
  }

  // ── Receipts ────────────────────────────────────────────────────────────
  if (method === 'GET' && /^\/receipts\/invoice\/[^/]+\/print$/.test(path)) {
    const num = decodeURIComponent(path.split('/')[3]);
    const s = db.sales.find((x) => x.invoiceNumber === num);
    if (!s) notFound('Receipt not found');
    const lines = [
      `<style>*{font-family:sans-serif}table{width:100%;border-collapse:collapse}td{padding:2px 4px}</style>`,
      `<h3>${db.shopInfo.shopName}</h3>`,
      `<p>Invoice: ${s.invoiceNumber}</p>`,
      `<table><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Total</th></tr>`,
      ...(s.items || []).map((it) => `<tr><td>${it.productName}</td><td align="right">${it.quantity}</td><td align="right">${it.totalPrice}</td></tr>`),
      `</table><hr/><p><b>TOTAL: ${s.totalAmount}</b> (Paid ${s.amountPaid})</p>`,
    ].join('\n');
    return raw(lines);
  }
  if (method === 'GET' && /^\/receipts\/invoice\/[^/]+\/(pdf|html)$/.test(path)) {
    const num = decodeURIComponent(path.split('/')[3]);
    const s = db.sales.find((x) => x.invoiceNumber === num);
    if (!s) notFound('Receipt not found');
    const lines = [
      `DESHOP RECEIPT — ${db.shopInfo.shopName}`,
      `Invoice: ${s.invoiceNumber}`,
      `Date: ${s.saleDate}`,
      `Customer: ${s.customerName || 'Walk-in'}`,
      '--------------------------------',
      ...(s.items || []).map((it) => `${it.productName} x${it.quantity} @ ${it.unitPrice} = ${it.totalPrice}`),
      '--------------------------------',
      `Subtotal: ${s.subtotal}`,
      `Tax: ${s.taxAmount}`,
      `Discount: ${s.discountAmount}`,
      `TOTAL: ${s.totalAmount}`,
      `Paid: ${s.amountPaid}`,
      `Change: ${s.changeGiven}`,
      `Thank you for your business!`,
    ].join('\n');
    return raw(toBlob(lines, 'text/plain'));
  }
  if (method === 'GET' && /^\/receipts\/invoice\/.+/.test(path)) {
    const num = decodeURIComponent(path.split('/')[3]);
    const s = db.sales.find((x) => x.invoiceNumber === num);
    if (!s) notFound('Receipt not found');
    return ok(s);
  }
  if (method === 'GET' && /^\/receipts\/\d+$/.test(path)) {
    const s = db.sales.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Receipt not found');
    return ok(s);
  }
  if (method === 'GET' && /^\/receipts\/ar-payment\/\d+\/print$/.test(path)) {
    const pay = (db.arPayments || []).find((x) => x.id === Number(path.split('/')[3]));
    return raw(`<html><body style="font-family:sans-serif">Payment receipt<br/>Amount: ${pay?.amount || ''}</body></html>`);
  }

  // ── Counter print ───────────────────────────────────────────────────────
  if (method === 'GET' && path === '/counter-print/receipt-jobs/next') return ok(null);
  if (method === 'POST' && /^\/counter-print\/receipt-jobs\/.+/.test(path)) return ok(true);
  if (method === 'GET' && path === '/counter-print/printers') return ok({ printers: ['POS-58-USB (Demo)'] });
  if (method === 'GET' && path === '/counter-print/config') return ok({ printerName: '', default: 'POS-58-USB (Demo)' });
  if (method === 'PUT' && path === '/counter-print/config') return ok(body);
  if (method === 'POST' && path === '/counter-print/test') return ok({ success: true });
  if (method === 'POST' && /^\/counter-print\/receipt\/.+/.test(path)) {
    const num = decodeURIComponent(path.split('/')[2]);
    return ok({ queued: true, jobId: `job-${num}` });
  }

  // ── Shop info & receipt customization ───────────────────────────────────
  if (method === 'GET' && path === '/shop-info/logo') {
    const s = db.shopInfo;
    if (!s?.hasLogo) return raw(toBlob('', 'image/svg+xml'));
    if (s.logoDataUrl) return raw(dataUrlToBlob(s.logoDataUrl));
    if (s.logoUrl) {
      return fetch(s.logoUrl)
        .then((r) => {
          if (!r.ok) throw new Error('logo fetch failed');
          return r.blob();
        })
        .then((blob) => raw(blob))
        .catch(() => raw(toBlob(s.logoSvg || '', 'image/svg+xml')));
    }
    return raw(toBlob(s.logoSvg || '', 'image/svg+xml'));
  }
  if (method === 'POST' && path === '/shop-info/logo') {
    const file = body instanceof FormData ? body.get('file') : null;
    if (!file) fail('No logo file provided', 400);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        db.shopInfo.logoDataUrl = reader.result;
        db.shopInfo.logoSvg = null;
        db.shopInfo.logoUrl = null;
        db.shopInfo.hasLogo = true;
        saveDb();
        resolve(created({ id: db.shopInfo.id }));
      };
      reader.onerror = () => reject(fail('Could not read logo file', 400));
      reader.readAsDataURL(file);
    });
  }
  if (method === 'DELETE' && path === '/shop-info/logo') {
    db.shopInfo.hasLogo = false;
    db.shopInfo.logoSvg = null;
    db.shopInfo.logoDataUrl = null;
    db.shopInfo.logoUrl = null;
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/shop-info') return ok(db.shopInfo);
  if (method === 'PUT' && path === '/shop-info') {
    Object.assign(db.shopInfo, body);
    saveDb();
    return ok(db.shopInfo);
  }

  if (method === 'GET' && path === '/receipt-customization') return ok(db.receiptCustomization);
  if (method === 'PUT' && path === '/receipt-customization') {
    Object.assign(db.receiptCustomization, body);
    saveDb();
    return ok(db.receiptCustomization);
  }

  // ── Orders ──────────────────────────────────────────────────────────────
  if (method === 'POST' && /^\/orders\/\d+\/convert$/.test(path)) {
    const o = db.orders.find((x) => x.id === Number(path.split('/')[2]));
    if (!o) notFound('Order not found');
    o.status = 'CONVERTED';
    o.updatedAt = nowIso();
    const sale = buildSaleFromPayload(db, { items: (o.items || []).map((it) => ({ productId: it.productId, quantity: it.quantity })), customerId: o.customerId, customerName: null, paymentMethod: body.paymentMethod || 'CASH', saleType: body.paymentMethod === 'CREDIT' ? 'CREDIT' : 'CASH', amountPaid: body.amountPaid || 0, dueDate: body.dueDate || null }, user);
    o.convertedInvoiceNumber = sale.invoiceNumber;
    saveDb();
    return created(sale);
  }
  if (method === 'POST' && /^\/orders\/\d+\/cancel$/.test(path)) {
    const o = db.orders.find((x) => x.id === Number(path.split('/')[2]));
    if (!o) notFound('Order not found');
    o.status = 'CANCELLED';
    o.updatedAt = nowIso();
    saveDb();
    return ok(o);
  }
  if (method === 'GET' && /^\/orders\/\d+$/.test(path)) {
    const o = db.orders.find((x) => x.id === Number(path.split('/')[2]));
    if (!o) notFound('Order not found');
    return ok(o);
  }
  if (method === 'GET' && path === '/orders') {
    let rows = sortDescBy(db.orders, 'createdAt');
    if (query.status) rows = rows.filter((o) => o.status === query.status);
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'POST' && path === '/orders') {
    const items = (body.items || []).map((raw) => {
      const p = findProduct(db, raw.productId);
      if (!p) fail('Invalid product in order', 400);
      return { productId: p.id, productName: p.name, sku: p.sku, quantity: Number(raw.quantity) || 1, unitPrice: Number(p.unitPrice) || 0 };
    });
    const total = round2(items.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
    const c = body.customerId ? findCustomer(db, body.customerId) : null;
    const o = {
      id: db.nextId.order++,
      orderNumber: `ORD-${String(1000 + db.orders.length + 1)}`,
      items,
      customerId: c?.id || null,
      customerName: c ? `${c.firstName} ${c.lastName}` : null,
      cashierId: user?.id || 1,
      cashierName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
      notes: body.notes || '',
      status: 'OPEN',
      totalAmount: total,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.orders.unshift(o);
    saveDb();
    return created(o);
  }

  // ── Shifts ──────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/shifts/open') {
    if (db.shifts.some((s) => s.status === 'OPEN')) fail('A shift is already open', 400);
    const o = {
      id: db.nextId.shift++,
      cashierId: user?.id || 1,
      cashierName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
      openingAmount: Number(body.openingAmount) || 0,
      openingTime: nowIso(),
      cashSalesTotal: 0,
      expectedAmount: Number(body.openingAmount) || 0,
      closingAmount: null,
      variance: null,
      closingTime: null,
      notes: '',
      status: 'OPEN',
    };
    db.shifts.unshift(o);
    saveDb();
    return created(o);
  }
  if (method === 'GET' && path === '/shifts/current') {
    const s = db.shifts.find((x) => x.status === 'OPEN');
    if (!s) return ok(null);
    s.cashSalesTotal = round2(db.sales.filter((x) => !x.isVoided && x.saleType === 'CASH' && dayOf(x.saleDate) === dayOf(s.openingTime)).reduce((sum, x) => sum + Number(x.totalAmount || 0), 0));
    s.expectedAmount = round2((Number(s.openingAmount) || 0) + (s.cashSalesTotal || 0));
    return ok(s);
  }
  if (method === 'POST' && /^\/shifts\/\d+\/close$/.test(path)) {
    const s = db.shifts.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Shift not found');
    s.cashSalesTotal = round2(db.sales.filter((x) => !x.isVoided && x.saleType === 'CASH' && dayOf(x.saleDate) === dayOf(s.openingTime)).reduce((sum, x) => sum + Number(x.totalAmount || 0), 0));
    s.expectedAmount = round2((Number(s.openingAmount) || 0) + (s.cashSalesTotal || 0));
    s.closingAmount = Number(body.closingAmount) ?? s.expectedAmount;
    s.variance = round2(Number(s.closingAmount) - s.expectedAmount);
    s.closingTime = nowIso();
    s.notes = body.notes || '';
    s.status = 'CLOSED';
    saveDb();
    return ok(s);
  }
  if (method === 'GET' && /^\/shifts\/\d+$/.test(path)) {
    const s = db.shifts.find((x) => x.id === Number(path.split('/')[2]));
    if (!s) notFound('Shift not found');
    return ok(s);
  }
  if (method === 'GET' && path === '/shifts') {
    let rows = sortDescBy(db.shifts, 'openingTime');
    if (query.cashierId) rows = rows.filter((s) => String(s.cashierId) === String(query.cashierId));
    if (query.startDate) rows = rows.filter((s) => dayOf(s.openingTime) >= query.startDate);
    if (query.endDate) rows = rows.filter((s) => dayOf(s.openingTime) <= query.endDate);
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }

  // ── Inventory ───────────────────────────────────────────────────────────
  if (method === 'POST' && /^\/inventory\/products\/\d+\/adjust$/.test(path)) {
    const p = findProduct(db, path.split('/')[3]);
    if (!p) notFound('Product not found');
    const change = Number(body.quantityChange) || 0;
    p.stockQuantity = Math.max(0, (p.stockQuantity || 0) + change);
    ensureMovements(db);
    db.movements.unshift({
      id: db.nextId.movement++,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      quantityChange: change,
      type: 'ADJUSTMENT',
      reason: body.reason || 'Stock adjustment',
      movementDate: nowIso(),
      performedByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
    });
    saveDb();
    return created({ id: p.id, stockQuantity: p.stockQuantity });
  }
  if (method === 'GET' && path === '/inventory/products/low-stock') {
    return ok(db.products.filter((p) => p.stockQuantity <= p.minStockLevel));
  }
  if (method === 'GET' && path === '/inventory/products') {
    let rows = [...db.products];
    if (query.categoryId) rows = rows.filter((p) => String(p.categoryId) === String(query.categoryId));
    return ok(paginate(rows, q('page', 0), q('size', 1000)));
  }
  if (method === 'GET' && path === '/inventory/summary') {
    const lowStock = db.products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel);
    const outOfStock = db.products.filter((p) => p.stockQuantity <= 0);
    const lowItems = db.products
      .filter((p) => p.stockQuantity <= p.minStockLevel)
      .map((p) => ({ productId: p.id, sku: p.sku, productName: p.name, stockQuantity: p.stockQuantity, minStockLevel: p.minStockLevel, shortage: Math.max(0, p.minStockLevel - p.stockQuantity) }));
    const byCat = {};
    let costValue = 0;
    let retailValue = 0;
    let totalUnits = 0;
    db.products.forEach((p) => {
      const k = p.categoryName || 'Uncategorized';
      const qty = Number(p.stockQuantity) || 0;
      const retail = (Number(p.unitPrice) || 0) * qty;
      byCat[k] = round2((byCat[k] || 0) + retail);
      costValue += (Number(p.costPrice) || 0) * qty;
      retailValue += retail;
      totalUnits += qty;
    });
    const activeProducts = db.products.filter((p) => p.isActive !== false);
    const inStockCount = db.products.filter((p) => Number(p.stockQuantity) > 0).length;
    return ok({
      totalProducts: db.products.length,
      activeProducts: activeProducts.length,
      inactiveProducts: db.products.length - activeProducts.length,
      lowStock: lowStock.length,
      lowStockCount: lowStock.length,
      outOfStock: outOfStock.length,
      outOfStockCount: outOfStock.length,
      totalUnits: round2(totalUnits),
      inStockCount,
      costValue: round2(costValue),
      retailValue: round2(retailValue),
      potentialProfit: round2(retailValue - costValue),
      totalValuation: round2(retailValue),
      categoryBreakdown: Object.keys(byCat).map((name) => ({ categoryName: name, retailValue: byCat[name] })),
      lowStockItems: lowItems,
    });
  }
  if (method === 'GET' && path === '/inventory/movements') {
    ensureMovements(db);
    let rows = [...db.movements];
    if (query.productId) rows = rows.filter((m) => String(m.productId) === String(query.productId));
    if (query.type) rows = rows.filter((m) => m.type === query.type);
    if (query.search) {
      const kw = String(query.search).toLowerCase();
      rows = rows.filter((m) => (m.productName || '').toLowerCase().includes(kw) || (m.sku || '').toLowerCase().includes(kw));
    }
    if (query.dateFrom) rows = rows.filter((m) => dayOf(m.movementDate) >= query.dateFrom);
    if (query.dateTo) rows = rows.filter((m) => dayOf(m.movementDate) <= query.dateTo);
    return ok(paginate(rows, q('page', 0), q('size', 20)));
  }
  if (method === 'GET' && path === '/inventory/movement-stats') {
    ensureMovements(db);
    const days = Number(query.days) || 30;
    const daily = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = addDays(todayLocal(), -i);
      let inQty = 0; let outQty = 0;
      db.movements.forEach((m) => {
        if (dayOf(m.movementDate) !== date) return;
        const v = Number(m.quantityChange) || 0;
        if (v > 0) inQty += v; else outQty += -v;
      });
      daily.push({ date, inQty, outQty });
    }
    const totalIn = round2(daily.reduce((s, d) => s + d.inQty, 0));
    const totalOut = round2(daily.reduce((s, d) => s + d.outQty, 0));
    return ok({ totalIn, totalOut, netChange: round2(totalIn - totalOut), daily });
  }

  // ── Expenses ────────────────────────────────────────────────────────────
  if (method === 'GET' && /^\/expenses\/\d+\/receipt-image$/.test(path)) {
    const e = db.expenses.find((x) => x.id === Number(path.split('/')[2]));
    if (!e?.hasReceiptImage) return raw(toBlob('', 'image/png'));
    if (e.receiptImageDataUrl) return raw(dataUrlToBlob(e.receiptImageDataUrl));
    return raw(toBlob('', 'image/png'));
  }
  if (method === 'POST' && /^\/expenses\/\d+\/receipt-image$/.test(path)) {
    const e = db.expenses.find((x) => x.id === Number(path.split('/')[2]));
    if (!e) notFound('Expense not found');
    const file = body instanceof FormData ? body.get('file') : null;
    if (!file) fail('No image file provided', 400);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        e.receiptImageDataUrl = reader.result;
        e.hasReceiptImage = true;
        saveDb();
        resolve(created({ id: e.id }));
      };
      reader.onerror = () => reject(fail('Could not read image file', 400));
      reader.readAsDataURL(file);
    });
  }
  if (method === 'DELETE' && /^\/expenses\/\d+\/receipt-image$/.test(path)) {
    const e = db.expenses.find((x) => x.id === Number(path.split('/')[2]));
    if (e) { e.hasReceiptImage = false; e.receiptImageDataUrl = null; saveDb(); }
    return ok(true);
  }
  if (method === 'GET' && /^\/expenses\/\d+$/.test(path)) {
    const e = db.expenses.find((x) => x.id === Number(path.split('/')[2]));
    if (!e) notFound('Expense not found');
    return ok(e);
  }
  if (method === 'PUT' && /^\/expenses\/\d+$/.test(path)) {
    const e = db.expenses.find((x) => x.id === Number(path.split('/')[2]));
    if (!e) notFound('Expense not found');
    Object.assign(e, body);
    e.expenseDate = dayOf(e.expenseDate || body.expenseDate || nowIso());
    saveDb();
    return ok(e);
  }
  if (method === 'DELETE' && /^\/expenses\/\d+$/.test(path)) {
    db.expenses = db.expenses.filter((x) => x.id !== Number(path.split('/')[2]));
    saveDb();
    return ok(true);
  }
  if (method === 'GET' && path === '/expenses') {
    const start = query.startDate || '0000-01-01';
    const end = query.endDate || '9999-12-31';
    const rows = db.expenses.filter((e) => dayOf(e.expenseDate) >= start && dayOf(e.expenseDate) <= end);
    return ok(sortDescBy(rows, 'expenseDate'));
  }
  if (method === 'POST' && path === '/expenses') {
    const e = {
      id: db.nextId.expense++,
      category: body.category || 'OTHER',
      description: body.description || '',
      amount: Number(body.amount) || 0,
      expenseDate: dayOf(body.expenseDate || nowIso()),
      createdBy: user?.id || 1,
      createdByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Admin',
      hasReceiptImage: false,
      createdAt: nowIso(),
    };
    db.expenses.push(e);
    saveDb();
    return created(e);
  }

  // ── Reports ─────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/reports/daily-sales') {
    const date = query.date || todayLocal();
    const rows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate) === date);
    const revenue = round2(rows.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
    return ok({
      date,
      totalTransactions: rows.length,
      totalRevenue: revenue,
      totalRefunds: round2(rows.reduce((s, x) => s + Number(x.totalReturned || 0), 0)),
      averageTransactionValue: rows.length ? round2(revenue / rows.length) : 0,
    });
  }
  if (method === 'GET' && path === '/reports/monthly-sales') {
    const year = Number(query.year) || demoYear();
    const month = Number(query.month) || 1;
    const rows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate).startsWith(`${year}-${String(month).padStart(2, '0')}`));
    return ok({ year, month, totalSales: rows.length, totalRevenue: round2(rows.reduce((s, x) => s + Number(x.totalAmount || 0), 0)) });
  }
  if (method === 'GET' && path === '/reports/product-performance') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const map = {};
    rows.forEach((s) => (s.items || []).forEach((it) => {
      map[it.productId] = map[it.productId] || { productId: it.productId, productName: it.productName, categoryName: findProduct(db, it.productId)?.categoryName || '', totalQuantitySold: 0, totalRevenue: 0, totalProfit: 0 };
      map[it.productId].totalQuantitySold += Number(it.quantity) || 0;
      map[it.productId].totalRevenue = round2(map[it.productId].totalRevenue + Number(it.totalPrice || 0));
      map[it.productId].totalProfit = round2(map[it.productId].totalProfit + (Number(it.totalPrice || 0) - (Number(it.costPriceAtSale) || 0) * (Number(it.quantity) || 0)));
    }));
    return ok(Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue));
  }
  if (method === 'GET' && path === '/reports/top-selling-products') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const map = {};
    rows.forEach((s) => (s.items || []).forEach((it) => {
      map[it.productId] = map[it.productId] || { productId: it.productId, productName: it.productName, totalQuantitySold: 0, totalRevenue: 0 };
      map[it.productId].totalQuantitySold += Number(it.quantity) || 0;
      map[it.productId].totalRevenue = round2(map[it.productId].totalRevenue + Number(it.totalPrice || 0));
    }));
    return ok(Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, Number(query.limit) || 10));
  }
  if (method === 'GET' && path === '/reports/top-products') {
    const result = db.products.map((p) => {
      let revenue = 0; let qty = 0;
      db.sales.forEach((s) => {
        if (s.isVoided) return;
        (s.items || []).forEach((it) => {
          if (Number(it.productId) !== p.id) return;
          revenue += Number(it.totalPrice || 0);
          qty += Number(it.quantity) || 0;
        });
      });
      return { productId: p.id, productName: p.name, totalQuantitySold: qty, revenue: round2(revenue), changePercent: round2(stableRatio(`p${p.id}`) * 40 - 10) };
    });
    return ok(result.sort((a, b) => b.revenue - a.revenue).slice(0, Number(query.limit) || 10));
  }
  if (method === 'GET' && path === '/reports/top-categories') {
    const map = {};
    db.sales.forEach((s) => {
      if (s.isVoided) return;
      (s.items || []).forEach((it) => {
        const p = findProduct(db, it.productId);
        const k = p?.categoryId;
        map[k] = map[k] || { categoryId: k, categoryName: p?.categoryName || 'Uncategorized', revenue: 0, quantitySold: 0 };
        map[k].revenue = round2(map[k].revenue + Number(it.totalPrice || 0));
        map[k].quantitySold += Number(it.quantity) || 0;
      });
    });
    return ok(Object.values(map).sort((a, b) => b.revenue - a.revenue));
  }
  if (method === 'GET' && path === '/reports/compare-categories') {
    const ids = query.categoryIds || [];
    const out = db.categories
      .filter((c) => ids.map(String).includes(String(c.id)))
      .map((c) => {
        let revenue = 0;
        db.sales.forEach((s) => {
          if (s.isVoided) return;
          (s.items || []).forEach((it) => {
            const p = findProduct(db, it.productId);
            if (Number(p?.categoryId) === c.id) revenue += Number(it.totalPrice || 0);
          });
        });
        return { categoryId: c.id, categoryName: c.name, revenue: round2(revenue), changePercent: round2(stableRatio(`c${c.id}`) * 30 - 10) };
      });
    return ok(out);
  }
  if (method === 'GET' && path === '/reports/cashier-performance') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const map = {};
    rows.forEach((s) => {
      const k = s.cashierId;
      map[k] = map[k] || { cashierId: k, cashierName: s.cashierName, totalSales: 0, transactionCount: 0, totalItems: 0 };
      map[k].totalSales = round2(map[k].totalSales + Number(s.totalAmount || 0));
      map[k].transactionCount += 1;
      map[k].totalItems += (s.items || []).reduce((x, it) => x + (Number(it.quantity) || 0), 0);
    });
    const out = Object.values(map).map((r) => ({ ...r, averageTransactionValue: r.transactionCount ? round2(r.totalSales / r.transactionCount) : 0, averageItemsPerSale: r.transactionCount ? round2(r.totalItems / r.transactionCount) : 0 }));
    return ok(out);
  }
  if (method === 'GET' && path === '/reports/sales-trend') {
    const days = Number(query.days) || 7;
    const daily = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = addDays(todayLocal(), -i);
      const rows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate) === date);
      daily.push({ date, totalSales: round2(rows.reduce((s, x) => s + Number(x.totalAmount || 0), 0)), transactionCount: rows.length });
    }
    return ok(daily);
  }
  if (method === 'GET' && path === '/reports/inventory') {
    const low = db.products.filter((p) => p.stockQuantity <= p.minStockLevel);
    return ok({
      totalProducts: db.products.length,
      totalInventoryValue: round2(db.products.reduce((s, p) => s + (Number(p.costPrice) || 0) * (Number(p.stockQuantity) || 0), 0)),
      lowStockProductsCount: low.length,
      lowStockItems: low.map((p) => ({ productId: p.id, productName: p.name, currentStock: p.stockQuantity, minStockLevel: p.minStockLevel, shortage: Math.max(0, p.minStockLevel - p.stockQuantity) })),
    });
  }
  if (method === 'GET' && path === '/reports/profit-summary') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const { revenue, totalCogs, grossProfit } = financialNumbers(db, rows);
    const exps = expensesIn(db, query.startDate || '0000-01-01', query.endDate || '9999-12-31');
    const totalExpenses = round2(exps.reduce((s, e) => s + Number(e.amount || 0), 0));
    const netProfit = round2(grossProfit - totalExpenses);
    return ok({ revenue, totalCogs, grossProfit, totalExpenses, netProfit, profitMargin: revenue ? round2((netProfit / revenue) * 100) : 0, totalSales: rows.length });
  }
  if (method === 'GET' && path === '/reports/profit-trend') {
    const out = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = demoNow(); d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(); const m = d.getMonth() + 1;
      const rows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate).startsWith(`${y}-${String(m).padStart(2, '0')}`));
      const revenue = round2(rows.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
      out.push({ label: `${y}-${String(m).padStart(2, '0')}`, revenue, cost: salesCost(db, rows), profit: round2(revenue - salesCost(db, rows)) });
    }
    return ok(out);
  }
  if (method === 'GET' && path === '/reports/profit-by-supplier') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const map = {};
    rows.forEach((s) => (s.items || []).forEach((it) => {
      const p = findProduct(db, it.productId);
      const sid = p?.supplierId;
      map[sid] = map[sid] || { supplierId: sid, supplierName: p?.supplierName || 'Unknown', revenue: 0, cost: 0 };
      map[sid].revenue = round2(map[sid].revenue + Number(it.totalPrice || 0));
      map[sid].cost = round2(map[sid].cost + (Number(it.costPriceAtSale) || 0) * (Number(it.quantity) || 0));
    }));
    const out = Object.values(map).map((x) => ({ ...x, profit: round2(x.revenue - x.cost) }));
    return ok(out);
  }
  if (method === 'GET' && path === '/reports/accounting-summary') {
    const year = Number(query.year) || demoYear();
    const month = Number(query.month) || demoMonth();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate).startsWith(prefix));
    const exps = db.expenses.filter((e) => dayOf(e.expenseDate).startsWith(prefix));
    const totalIncome = round2(rows.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
    const totalRefunds = round2(rows.reduce((s, x) => s + Number(x.totalReturned || 0), 0));
    const totalCogs = salesCost(db, rows);
    const grossProfit = round2(totalIncome - totalCogs);
    const totalExpenses = round2(exps.reduce((s, e) => s + Number(e.amount || 0), 0));
    const netProfit = round2(grossProfit - totalExpenses);
    const prev = shiftMonths(year, month, -1);
    const prevRows = db.sales.filter((s) => !s.isVoided && dayOf(s.saleDate).startsWith(`${prev.year}-${String(prev.month).padStart(2, '0')}`));
    const prevIncome = round2(prevRows.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
    const byCat = {};
    exps.forEach((e) => { byCat[e.category] = round2((byCat[e.category] || 0) + Number(e.amount || 0)); });
    return ok({
      totalIncome,
      incomeChangePercent: prevIncome ? round2(((totalIncome - prevIncome) / prevIncome) * 100) : null,
      totalRefunds,
      grossProfit,
      totalExpenses,
      netProfit,
      profitChangePercent: null,
      outstandingAr: round2(db.sales.filter((s) => !s.isVoided && s.saleType === 'CREDIT').reduce((s, x) => s + Number(x.balanceDue || 0), 0)),
      expensesByCategory: Object.keys(byCat).map((k) => ({ category: k, amount: byCat[k] })),
    });
  }
  if (method === 'GET' && path === '/reports/financial-summary') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const { revenue, grossProfit } = financialNumbers(db, rows);
    const exps = expensesIn(db, query.startDate || '0000-01-01', query.endDate || '9999-12-31');
    const totalExpenses = round2(exps.reduce((s, e) => s + Number(e.amount || 0), 0));
    const netProfit = round2(grossProfit - totalExpenses);
    const { startDate, endDate } = rangeWindow(query.startDate, query.endDate);
    const prevRows = salesInRange(db, startDate, endDate);
    const prevIncome = round2(prevRows.reduce((s, x) => s + Number(x.totalAmount || 0), 0));
    return ok({
      totalIncome: revenue,
      incomeChangePercent: prevIncome ? round2(((revenue - prevIncome) / prevIncome) * 100) : null,
      grossProfit,
      totalExpenses,
      netProfit,
      profitChangePercent: null,
    });
  }
  if (method === 'GET' && path === '/reports/dead-stock') {
    const days = Number(query.daysThreshold) || 30;
    return ok(
      db.products
        .filter((p) => (p.stockQuantity || 0) > 0)
        .map((p) => {
          let last = null;
          db.sales.forEach((s) => {
            if (s.isVoided) return;
            if ((s.items || []).some((it) => Number(it.productId) === p.id) && (!last || s.saleDate > last)) last = s.saleDate;
          });
          const daysSince = last ? Math.max(0, Math.round((new Date(todayLocal()) - new Date(dayOf(last))) / 86400000)) : 999;
          return { productId: p.id, productName: p.name, categoryName: p.categoryName, stockQuantity: p.stockQuantity, stockValue: round2((Number(p.costPrice) || 0) * (Number(p.stockQuantity) || 0)), lastSoldDate: last, daysSinceLastSale: daysSince };
        })
        .filter((x) => x.daysSinceLastSale >= days)
    );
  }
  if (method === 'GET' && path === '/reports/sales-timing') {
    const rows = salesInRange(db, query.startDate, query.endDate);
    const map = {};
    rows.forEach((s) => {
      const d = new Date(s.saleDate);
      const key = `${d.getDay()}_${d.getHours()}`;
      map[key] = (map[key] || 0) + 1;
    });
    const out = [];
    for (let dow = 0; dow < 7; dow += 1) {
      for (let h = 0; h < 24; h += 1) {
        out.push({ dayOfWeek: dow, hour: h, transactions: map[`${dow}_${h}`] || 0 });
      }
    }
    return ok(out);
  }
  if (method === 'GET' && path === '/reports/customer-lifetime-value') {
    return ok(
      db.customers.map((c) => {
        const arr = db.sales.filter((s) => s.customerId === c.id && !s.isVoided);
        const totalSpent = round2(arr.reduce((s, x) => s + Number(x.totalAmount || 0) - Number(x.totalReturned || 0), 0));
        const visits = arr.length;
        return {
          customerId: c.id,
          customerName: `${c.firstName} ${c.lastName}`,
          phone: c.phone,
          totalSpent,
          visitCount: visits,
          averageBasketSize: visits ? round2(totalSpent / visits) : 0,
          firstPurchaseDate: arr.map((x) => x.saleDate).sort()[0] || null,
          lastPurchaseDate: arr.map((x) => x.saleDate).sort().pop() || null,
        };
      })
    );
  }
  if (method === 'GET' && path === '/reports/customer-retention') {
    const cutoff = addDays(todayLocal(), -30);
    const lapsed = db.customers
      .filter((c) => {
        const last = db.sales.filter((s) => s.customerId === c.id).map((s) => dayOf(s.saleDate)).sort().pop();
        return last && last < cutoff;
      })
      .map((c) => ({
        customerId: c.id,
        customerName: `${c.firstName} ${c.lastName}`,
        phone: c.phone,
        totalHistoricalSpend: customerTotalSpend(db, c.id),
        lastPurchaseDate: db.sales.filter((s) => s.customerId === c.id).map((s) => dayOf(s.saleDate)).sort().pop() || null,
      }));
    return ok({ overallRetentionRate: round2(Math.min(100, (db.customers.length ? Math.max(1, 6) / db.customers.length : 0) * 100)), lapsedCustomers: lapsed, activeCustomers: db.customers.length - lapsed.length, newCustomers: 0 });
  }
  if (method === 'GET' && /^\/reports\/products\/\d+\/frequently-bought-with$/.test(path)) {
    const pid = Number(path.split('/')[3]);
    const limit = Number(query.limit) || 5;
    const countByProduct = {};
    db.sales.forEach((sale) => {
      if (sale.isVoided) return;
      const ids = (sale.items || []).map((it) => Number(it.productId)).filter((x) => x === pid);
      if (!ids.length || (sale.items || []).length < 2) return;
      (sale.items || []).forEach((it) => {
        const otherId = Number(it.productId);
        if (otherId === pid) return;
        countByProduct[otherId] = (countByProduct[otherId] || 0) + 1;
      });
    });
    const rows = Object.keys(countByProduct)
      .map((otherId) => ({
        productId: Number(otherId),
        productName: db.products.find((p) => p.id === Number(otherId))?.name || 'Unknown product',
        coOccurrenceCount: countByProduct[otherId],
      }))
      .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
      .slice(0, limit);
    return ok(rows);
  }

  // ── Backup / data ───────────────────────────────────────────────────────
  if (method === 'GET' && path === '/backups/export') {
    return raw(toBlob(JSON.stringify({ demo: true, exportedAt: nowIso() }), 'application/json'));
  }
  if (method === 'GET' && path === '/backups/settings') return ok(db.backupSettings);
  if (method === 'PUT' && path === '/backups/settings') {
    Object.assign(db.backupSettings, body);
    saveDb();
    return ok(db.backupSettings);
  }
  if (method === 'POST' && path === '/backups/run-now') return ok({ started: true, backupDate: nowIso() });
  if (method === 'GET' && path === '/backups/google/connect') {
    return raw('https://accounts.google.com/o/oauth2/auth?client_id=DEMO');
  }
  if (method === 'GET' && path === '/backups/google/auth-url') {
    return ok({ authUrl: 'https://accounts.google.com/o/oauth2/auth?client_id=DEMO', callerIsServer: 'true' });
  }
  if (method === 'GET' && path === '/backups/google/status') return ok({ connected: false });
  if (method === 'POST' && path === '/backups/google/disconnect') return ok(true);
  if (method === 'GET' && path === '/data/export') {
    return raw(toBlob(JSON.stringify(db), 'application/json'));
  }
  if (method === 'POST' && path === '/data/import') {
    const { mode, data: incoming } = body || {};
    const t = mode === 'REPLACE';
    if (t && incoming) {
      const parsed = typeof incoming === 'string' ? JSON.parse(incoming) : incoming;
      if (parsed.products) Object.assign(db, parsed);
      saveDb();
      return ok({ imported: true });
    }
    return ok({ imported: false, message: 'Import modes handled in Demo at runtime' });
  }

  // ── System ──────────────────────────────────────────────────────────────
  if (path === '/system/shutdown') return ok(true);

  // Fallback for anything we left out: echo a sane empty result so the demo never hard-crashes.
  // eslint-disable-next-line no-console
  console.warn('[mock-api] Unhandled route', method, path, query);
  if (method === 'GET') return ok(paginate([], 0, 20));
  return ok(true);
}

// Public entry — mimics the axios instance used by apiClient.
export function mockRequest(method, url, config = {}) {
  const { params, data, responseType, headers } = config || {};
  const raw = (url || '').replace(/^\/api/, '');
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = { ...(params || {}) };
  if (qIndex >= 0) {
    raw.slice(qIndex + 1).split('&').forEach((pair) => {
      if (!pair) return;
      const eq = pair.indexOf('=');
      const k = eq >= 0 ? pair.slice(0, eq) : pair;
      const v = eq >= 0 ? pair.slice(eq + 1) : '';
      query[decodeURIComponent(k)] = decodeURIComponent(v).replace(/\+/g, ' ');
    });
  }
  return Promise.resolve().then(() => {
    const res = dispatch(method.toUpperCase(), path, data, { params: query, responseType, headers });
    return res;
  });
}