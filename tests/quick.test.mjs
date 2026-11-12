// Chay: node --test tests/quick.test.mjs
// Dat mui gio Viet Nam truoc khi tao bat ky Date nao (kiem tra loi lech ngay UTC)
process.env.TZ = "Asia/Ho_Chi_Minh";

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CATEGORIES, DRINK_CATEGORY_DEFAULT_IMAGES, INITIAL_MENU, PAYMENT_QR, QUICK_ALIASES, BEST_SELLER_IDS, QUICK_GRID_SIZE } = require("../js/data.js");
const {
  autoInitials,
  buildIndex,
  buildSpeedGrid,
  calcChange,
  foldText,
  formatShortPrice,
  parseMoneyInput,
  parseQuery,
  resolveInput,
  search
} = require("../js/quick.js");

const menuIds = new Set(INITIAL_MENU.map(m => m.id));
const index = buildIndex(INITIAL_MENU, { aliasMap: QUICK_ALIASES, bestSellerIds: BEST_SELLER_IDS });
const top = text => (search(index, text, 1)[0] || {}).item;

test("alias hygiene", () => {
  Object.entries(QUICK_ALIASES).forEach(([id, list]) => {
    assert.ok(menuIds.has(id), `alias id ${id} must exist in INITIAL_MENU`);
    list.forEach(a => {
      assert.ok(!/\d/.test(a), `alias ${a} must not contain digits`);
      assert.ok(!a.startsWith("x"), `alias ${a} must not start with x`);
      assert.equal(a, foldText(a).replace(/\s+/g, ""), `alias ${a} must be folded`);
    });
  });
  BEST_SELLER_IDS.forEach(id => assert.ok(menuIds.has(id), `best seller ${id} must exist`));
});

test("explicit aliases are unique across items", () => {
  const seen = new Map();
  Object.entries(QUICK_ALIASES).forEach(([id, list]) => {
    list.forEach(a => {
      assert.ok(!seen.has(a), `alias ${a} used by ${seen.get(a)} and ${id}`);
      seen.set(a, id);
    });
  });
});

test("autoInitials examples", () => {
  const byId = id => INITIAL_MENU.find(m => m.id === id).name;
  assert.equal(autoInitials(byId("c2")), "cfs");
  assert.equal(autoInitials(byId("c1")), "cfd");
  assert.equal(autoInitials(byId("c3")), "bx");
  assert.equal(autoInitials(byId("t4")), "td");
  assert.equal(autoInitials(byId("t5")), "tdcx");
  assert.equal(autoInitials(byId("ib3")), "cdx");
  assert.equal(autoInitials(byId("y1")), "yd");
  assert.equal(autoInitials(byId("j8")), "nc");
  assert.equal(autoInitials(byId("j10")), "dt");
});

test("search acceptance", () => {
  assert.equal(top("cfs").id, "c2");
  assert.equal(top("cfd").id, "c1");
  assert.equal(top("bx").id, "c3");
  assert.equal(top("td").id, "t4");
  assert.equal(top("cam").id, "j8");
  assert.equal(top("tdcx").id, "t5");
  assert.equal(top("cf").id, "c2");
  assert.equal(top("bac xiu").id, "c3");
  assert.equal(top("BẠC XỈU").id, "c3");
  assert.deepEqual(search(index, "xyz"), []);
  assert.deepEqual(search(index, ""), []);
});

test("td never ranks Tra duong first", () => {
  const ids = search(index, "td", 6).map(r => r.item.id);
  assert.equal(ids[0], "t4");
  assert.ok(ids.indexOf("t4") < ids.indexOf("t9") || !ids.includes("t9"));
});

test("sales rank boosts ties within a tier", () => {
  // "nc" la viet tat tu dong cua Nuoc ep cam (j8, co boost mac dinh) va Nuoc ep chanh tuoi (j12)
  const base = search(index, "nc", 6).map(r => r.item.id);
  assert.equal(base[0], "j8");
  assert.ok(base.includes("j12"));

  const salesQty = new Map([["j12", 50]]);
  const idx = buildIndex(INITIAL_MENU, { aliasMap: QUICK_ALIASES, bestSellerIds: BEST_SELLER_IDS, salesQty });
  assert.equal(search(idx, "nc", 6)[0].item.id, "j12");
});

test("parseQuery forms", () => {
  const one = raw => parseQuery(raw).segments[0];
  assert.deepEqual(one("2cfs"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("2 cfs"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("2x cfs"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("2*cfs"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("cfs 2"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("cfs*2"), { text: "cfs", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("cfs"), { text: "cfs", qty: 1, qtyExplicit: false });
  assert.deepEqual(one("2"), { text: "", qty: 2, qtyExplicit: true });
  assert.deepEqual(one("0cfs"), { text: "cfs", qty: 1, qtyExplicit: true });
  assert.deepEqual(one("12cfs"), { text: "cfs", qty: 12, qtyExplicit: true });
  assert.deepEqual(one("100cfs"), { text: "100cfs", qty: 1, qtyExplicit: false });
  assert.deepEqual(one("tdcx2"), { text: "tdcx2", qty: 1, qtyExplicit: false });
  assert.equal(parseQuery("   ").segments.length, 0);

  const batch = parseQuery("2cfs+1bx, 3td").segments;
  assert.equal(batch.length, 3);
  assert.deepEqual(batch.map(s => [s.text, s.qty]), [["cfs", 2], ["bx", 1], ["td", 3]]);
});

test("resolveInput batch", () => {
  const ok = resolveInput(index, "2cfs+1bx");
  assert.equal(ok.allResolved, true);
  assert.deepEqual(ok.lines.map(l => [l.item.id, l.qty]), [["c2", 2], ["c3", 1]]);

  const bad = resolveInput(index, "2cfs+zzz");
  assert.equal(bad.allResolved, false);
  assert.equal(bad.lines[1].item, null);

  assert.equal(resolveInput(index, "").allResolved, false);
});

test("calcChange", () => {
  assert.deepEqual(calcChange(64000, null), { received: 64000, change: 0, shortfall: 0, enough: true, exact: true });
  assert.deepEqual(calcChange(64000, 100000), { received: 100000, change: 36000, shortfall: 0, enough: true, exact: false });
  assert.deepEqual(calcChange(64000, 50000), { received: 50000, change: 0, shortfall: 14000, enough: false, exact: false });
  assert.equal(calcChange(64000, 64000).enough, true);
  assert.equal(calcChange(64000, 64000).exact, true);
});

test("parseMoneyInput", () => {
  assert.equal(parseMoneyInput("70"), 70000);
  assert.equal(parseMoneyInput("700"), 700000);
  assert.equal(parseMoneyInput("20000"), 20000);
  assert.equal(parseMoneyInput("20.000"), 20000);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("abc"), null);
  assert.equal(parseMoneyInput("0"), null);
  assert.equal(parseMoneyInput(null), null);
});

test("formatShortPrice", () => {
  assert.equal(formatShortPrice(20000), "20k");
  assert.equal(formatShortPrice(27500), "27.500\u0111");
});

test("buildSpeedGrid", () => {
  const grid = (extra = {}) => buildSpeedGrid({ menu: INITIAL_MENU, defaults: BEST_SELLER_IDS, size: QUICK_GRID_SIZE, ...extra });

  const plain = grid();
  assert.equal(plain.length, QUICK_GRID_SIZE);
  assert.deepEqual(plain.slice(0, BEST_SELLER_IDS.length), BEST_SELLER_IDS);
  assert.equal(new Set(plain).size, plain.length);

  const sold = grid({ salesQty: new Map([["s1", 9], ["c1", 5], ["gone", 99]]) });
  assert.deepEqual(sold.slice(0, 2), ["s1", "c1"]);
  assert.ok(!sold.includes("gone"));
  assert.equal(sold.length, QUICK_GRID_SIZE);

  const pinned = grid({ pinned: ["b5", "nope", "j1"], salesQty: new Map([["s1", 9]]) });
  assert.deepEqual(pinned.slice(0, 2), ["b5", "j1"]);
  assert.ok(!pinned.includes("nope"));

  assert.equal(grid({ size: 4 }).length, 4);
});

// ---------------------------------------------------------------------------
// Store (localStorage gia lap)
// ---------------------------------------------------------------------------

function installLocalStorageStub() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k)
  };
  return data;
}

function loadFreshStoreModule() {
  const storePath = require.resolve("../js/store.js");
  delete require.cache[storePath];
  return require("../js/store.js");
}

async function freshStore() {
  const data = installLocalStorageStub();
  const mod = loadFreshStoreModule();
  const store = mod.store;
  store.state.invoices = [];
  store.state.quickOrder = { items: [] };
  return { store, data };
}

const menuItem = id => INITIAL_MENU.find(m => m.id === id);

test("store: cart add, merge, set, remove, totals", async () => {
  const { store } = await freshStore();
  store.quickAdd(menuItem("c2"), 2);
  store.quickAdd(menuItem("c2"));
  store.quickAdd(menuItem("c3"));
  assert.equal(store.getQuickOrder().items.length, 2);
  assert.equal(store.getQuickCount(), 4);
  assert.equal(store.getQuickTotal(), 3 * 20000 + 24000);

  store.quickChangeQty("c2", -1);
  assert.equal(store.getQuickCount(), 3);
  store.quickSetQty("c3", 0);
  assert.equal(store.getQuickOrder().items.length, 1);
  store.quickRemove("c2");
  assert.equal(store.getQuickCount(), 0);

  store.quickAddBatch([{ item: menuItem("c1"), qty: 2 }, { item: menuItem("t4"), qty: 1 }, { item: null, qty: 1 }]);
  assert.equal(store.getQuickCount(), 3);
  store.quickClear();
  assert.equal(store.getQuickCount(), 0);
  store.flushSave();
});

test("store: quickCheckout empty, short, ok, double call", async () => {
  const { store } = await freshStore();

  assert.deepEqual(store.quickCheckout({ customerCash: 50000 }), { ok: false, reason: "empty" });

  store.quickAdd(menuItem("c2"), 2); // 40.000
  const short = store.quickCheckout({ paymentMethod: "cash", customerCash: 20000 });
  assert.deepEqual(short, { ok: false, reason: "short" });
  assert.equal(store.getQuickCount(), 2, "short must not clear the cart");
  assert.equal(store.state.invoices.length, 0);

  const res = store.quickCheckout({ orderType: "takeaway", paymentMethod: "cash", customerCash: 50000 });
  assert.equal(res.ok, true);
  const inv = res.invoice;
  assert.equal(inv.tableId, null);
  assert.equal(inv.tableName, "Mang về");
  assert.equal(inv.isQuick, true);
  assert.equal(inv.totalAmount, 40000);
  assert.equal(inv.customerCash, 50000);
  assert.equal(inv.changeAmount, 10000);
  assert.equal(inv.items.length, 1);
  assert.equal(inv.items[0].itemId, "c2");
  assert.equal(store.state.invoices.length, 1);
  assert.equal(store.getQuickCount(), 0);

  assert.deepEqual(store.quickCheckout({ customerCash: 50000 }), { ok: false, reason: "empty" });
  assert.equal(store.state.invoices.length, 1);

  store.quickAdd(menuItem("t4"));
  const exact = store.quickCheckout({ orderType: "counter", paymentMethod: "cash" });
  assert.equal(exact.ok, true);
  assert.equal(exact.invoice.tableName, "Tại quầy");
  assert.equal(exact.invoice.customerCash, 25000);
  assert.equal(exact.invoice.changeAmount, 0);

  store.quickAdd(menuItem("b4"));
  const qr = store.quickCheckout({ paymentMethod: "qr" });
  assert.equal(qr.ok, true);
  assert.equal(qr.invoice.paymentMethod, "qr");
  assert.equal(qr.invoice.customerCash, 10000);

  const ids = store.state.invoices.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length, "invoice ids must be unique");
});

test("store: quick invoice persists and feeds sales rank", async () => {
  const { store, data } = await freshStore();
  store.quickAdd(menuItem("s1"), 3);
  store.quickCheckout({ paymentMethod: "cash" });

  const saved = JSON.parse(data.get("bui_coffee_app_state_v1"));
  assert.equal(saved.invoices.length, 1);
  assert.deepEqual(saved.quickOrder.items, []);

  assert.equal(store.getSalesQty(30).get("s1"), 3);
  assert.equal(store.getSpeedGridIds()[0], "s1");
});

test("store: cart survives reload through localStorage", async () => {
  const { store, data } = await freshStore();
  store.quickAdd(menuItem("c1"), 2);
  store.flushSave();
  const saved = JSON.parse(data.get("bui_coffee_app_state_v1"));
  assert.equal(saved.quickOrder.items[0].quantity, 2);
});

test("store: quickSendToTable merges into occupied table and clears cart", async () => {
  const { store } = await freshStore();
  const tableId = 37;
  store.clearTable(tableId);
  store.addItemToTable(tableId, menuItem("c2"), 1, "");

  store.quickAdd(menuItem("c2"), 2);
  store.quickAdd(menuItem("t4"), 1);
  const res = store.quickSendToTable(tableId);

  assert.equal(res.ok, true);
  assert.equal(res.count, 3);
  const table = store.getTable(tableId);
  assert.equal(table.status, "occupied");
  assert.equal(table.orderItems.find(i => i.itemId === "c2").quantity, 3);
  assert.equal(table.orderItems.find(i => i.itemId === "t4").quantity, 1);
  assert.equal(table.totalAmount, 3 * 20000 + 25000);
  assert.equal(store.getQuickCount(), 0);
  assert.equal(store.state.activeTableId, tableId);

  assert.deepEqual(store.quickSendToTable(tableId), { ok: false, reason: "empty" });
  assert.deepEqual(store.quickSendToTable(9999), { ok: false, reason: "no_table" });
  store.clearTable(tableId);
});

test("store: migration fills new keys on old data", async () => {
  const data = installLocalStorageStub();
  data.set("bui_coffee_app_state_v1", JSON.stringify({
    shop: { wifiPass: "x" },
    menu: INITIAL_MENU,
    tables: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Ban ${i + 1}`, status: "empty", orderItems: [], totalAmount: 0 })),
    activeTableId: 1
  }));
  const mod = loadFreshStoreModule();
  const s = mod.store.state;
  assert.deepEqual(s.invoices, []);
  assert.deepEqual(s.quickOrder, { items: [], note: "" });
  assert.deepEqual(s.settings.speedGrid, []);
});

test("store: menuVersion bumps on menu changes", async () => {
  const { store } = await freshStore();
  const v0 = store.menuVersion;
  const added = store.addMenuItem({ name: "Ca phe muoi", price: 25000, category: "coffee" });
  assert.equal(store.menuVersion, v0 + 1);
  store.deleteMenuItem(added.id);
  assert.equal(store.menuVersion, v0 + 2);
});

test("store: getDailyStats uses local date (early morning sale counts today)", async () => {
  const { store } = await freshStore();
  const now = new Date();
  const earlyLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0).toISOString();
  store.state.invoices = [{
    id: "HDTEST",
    tableName: "Mang về",
    items: [{ itemId: "c2", name: "Cà phê sữa đá", price: 20000, quantity: 1 }],
    totalAmount: 20000,
    paidAt: earlyLocal
  }];
  const stats = store.getDailyStats();
  assert.equal(stats.todayOrders, 1);
  assert.equal(stats.todayRevenue, 20000);
});

test("menu completeness, other category, drink images, and store migration", () => {
  assert.ok(CATEGORIES.some(c => c.id === "other" && c.name === "Khác"), "must have 'Khác' category");
  assert.equal(PAYMENT_QR.image, "assets/qr-payment.png");
  assert.equal(PAYMENT_QR.accountName, "HKD BUI COFFEE PHUONG");

  const expectedNew = [
    ["c5", "Cacao cà phê", "cccf"],
    ["y6", "Yaourt hạt đác", "yhd"],
    ["b6", "Olong", "olongchai"],
    ["j16", "Chanh dây hạt đác", "cdhd"],
    ["j17", "Đá me hạt đác", "dmhd"]
  ];
  for (const [id, name, alias] of expectedNew) {
    const item = INITIAL_MENU.find(m => m.id === id);
    assert.ok(item, `missing ${id}`);
    assert.equal(item.name, name);
    assert.ok(item.image && item.image.startsWith("assets/drinks/"), `${id} must have image path`);
    assert.equal(top(alias).id, id, `alias ${alias} must resolve to ${id}`);
  }

  // Legacy localStorage migration: old menu with only c1 + custom item must merge missing INITIAL_MENU + backfill image
  const data = installLocalStorageStub();
  data.set("bui_coffee_app_state_v1", JSON.stringify({
    shop: { wifiPass: "68686868" },
    menu: [
      { id: "m_legacy", name: "Bánh tráng", price: 15000, category: "other", isCustomCreated: true },
      { id: "c1", name: "Cà phê đen đá", price: 19000, category: "coffee" }
    ],
    tables: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Ban ${i + 1}`, status: "empty", orderItems: [], totalAmount: 0 })),
    activeTableId: 1
  }));
  const mod = loadFreshStoreModule();
  const migratedMenu = mod.store.getMenu();
  const custom = migratedMenu.find(m => m.id === "m_legacy");
  assert.ok(custom, "custom item preserved");
  assert.equal(custom.image, DRINK_CATEGORY_DEFAULT_IMAGES.other);
  const c1 = migratedMenu.find(m => m.id === "c1");
  assert.equal(c1.price, 19000, "existing customized price preserved");
  assert.equal(c1.image, "assets/drinks/c1.jpg");
  assert.ok(migratedMenu.some(m => m.id === "c5"), "missing c5 merged");
  assert.ok(migratedMenu.some(m => m.id === "j17"), "missing j17 merged");

  const added = mod.store.addMenuItem({ name: "Khoai tây chiên", price: 30000, category: "other" });
  assert.equal(added.category, "other");
  assert.equal(added.image, DRINK_CATEGORY_DEFAULT_IMAGES.other);
  const addedNoImg = mod.store.addMenuItem({ name: "Món mới test", price: 20000, category: "coffee" });
  assert.equal(addedNoImg.image, "assets/drinks/placeholder.svg", "new custom item must not auto-assign coffee image");
});

test("timekeeping: continuous shifts Trưa + Tối deducts overlap and >= 7 ca awards 100k bonus", async () => {
  const { store } = await freshStore();
  const weekKey = "2026-W45";
  const weekDates = [
    { dateStr: "2026-11-02", dayName: "T2", dateFormatted: "02/11", fullDateLabel: "T2 - 02/11" },
    { dateStr: "2026-11-03", dayName: "T3", dateFormatted: "03/11", fullDateLabel: "T3 - 03/11" },
    { dateStr: "2026-11-04", dayName: "T4", dateFormatted: "04/11", fullDateLabel: "T4 - 04/11" },
    { dateStr: "2026-11-05", dayName: "T5", dateFormatted: "05/11", fullDateLabel: "T5 - 05/11" },
    { dateStr: "2026-11-06", dayName: "T6", dateFormatted: "06/11", fullDateLabel: "T6 - 06/11" },
    { dateStr: "2026-11-07", dayName: "T7", dateFormatted: "07/11", fullDateLabel: "T7 - 07/11" },
    { dateStr: "2026-11-08", dayName: "CN", dateFormatted: "08/11", fullDateLabel: "CN - 08/11" }
  ];

  // Test setShiftCombo: afternoon-evening
  store.setShiftCombo(weekKey, "2026-11-03", "afternoon-evening");
  const d3 = store.getTimekeepingWeek(weekKey).days["2026-11-03"];
  assert.equal(d3.morning, false);
  assert.equal(d3.afternoon, true);
  assert.equal(d3.evening, true);

  // Single day with afternoon + evening: afternoon (11h-17h = 6h), evening (17h-23h = 6h) -> total 12h, 2 shifts
  let calc = store.calculateSalary(weekKey, weekDates);
  const detail3 = calc.dayDetails.find(d => d.dateStr === "2026-11-03");
  assert.equal(detail3.totalDayHours, 12);
  assert.equal(detail3.shifts.length, 2);
  assert.equal(detail3.shifts[0].timeLabel, "11h - 17h");
  assert.equal(detail3.shifts[0].hours, 6);
  assert.equal(detail3.shifts[1].timeLabel, "17h - 23h");
  assert.equal(detail3.shifts[1].hours, 6);
  assert.equal(calc.totalShifts, 2);
  assert.equal(calc.bonus, 0, "2 shifts -> no bonus");

  // Add more shifts up to 6 shifts (below 7 ca)
  store.toggleShift(weekKey, "2026-11-04", "morning");   // 3 shifts
  store.toggleShift(weekKey, "2026-11-04", "afternoon"); // 4 shifts
  store.toggleShift(weekKey, "2026-11-05", "morning");   // 5 shifts
  store.toggleShift(weekKey, "2026-11-05", "afternoon"); // 6 shifts
  calc = store.calculateSalary(weekKey, weekDates);
  assert.equal(calc.totalShifts, 6);
  assert.equal(calc.bonus, 0, "6 shifts must have 0 bonus (< 7 ca)");

  // Add 7th shift -> >= 7 ca must award 100k bonus
  store.toggleShift(weekKey, "2026-11-06", "morning");   // 7 shifts
  calc = store.calculateSalary(weekKey, weekDates);
  assert.equal(calc.totalShifts, 7);
  assert.equal(calc.bonus, 100000, ">= 7 shifts must award 100.000 bonus");
  assert.equal(calc.ratePerHour, 20000);

  // Check report format includes >= 7 ca note
  const report = store.formatSalaryReport(weekKey, weekDates);
  assert.ok(report.includes("Thưởng chuyên cần (>= 7 ca)"), "report must state >= 7 ca");
  assert.ok(report.includes("100k"), "report must show 100k bonus");
});

test("quick order: order note and per-item notes persist and transfer to invoice and table", async () => {
  const { store } = await freshStore();
  store.quickAdd(menuItem("c2"), 1);
  store.setQuickNote("Giao mang ve gap");
  assert.equal(store.getQuickNote(), "Giao mang ve gap");

  store.quickSetItemNote("c2", "it da 30%");
  const order = store.getQuickOrder();
  assert.equal(order.items[0].note, "it da 30%");

  // Checkout transfers notes to invoice
  const res = store.quickCheckout({ orderType: "takeaway", paymentMethod: "cash", customerCash: 50000 });
  assert.equal(res.ok, true);
  assert.equal(res.invoice.tableNote, "Giao mang ve gap");
  assert.equal(res.invoice.staffNote, "Giao mang ve gap");
  assert.equal(res.invoice.items[0].note, "it da 30%");
  assert.equal(store.getQuickNote(), "", "checkout must reset quick note");

  // Send to table merges quick note into table note
  store.quickAdd(menuItem("t4"), 1);
  store.setQuickNote("Khach quen ban 2");
  const sendRes = store.quickSendToTable(2);
  assert.equal(sendRes.ok, true);
  const table2 = store.getTable(2);
  assert.ok(table2.note.includes("Khach quen ban 2"), "table note must contain transferred quick note");
  assert.equal(store.getQuickNote(), "", "sendToTable must reset quick note");
});

test("cash input field: markup attributes, styling contract, and parseMoneyInput", async () => {
  const fs = await import("node:fs");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const quickUi = fs.readFileSync(new URL("../js/quick-ui.js", import.meta.url), "utf8");

  // Markup checks
  assert.ok(html.includes('id="quickCashInputRow"'), "must have quickCashInputRow container");
  assert.ok(html.includes('id="quickCustomCashInput"'), "must have quickCustomCashInput element");
  assert.ok(html.includes('for="quickCustomCashInput"'), "must have label associated with cash input");
  assert.ok(html.includes('inputmode="numeric"'), "must specify inputmode numeric for virtual keypad");
  assert.ok(html.includes('pattern="[0-9]*"'), "must specify pattern for iOS virtual keypad");

  // Anti-regression: customCashInput must never be hidden via .hidden = true
  assert.ok(!quickUi.includes("customCashInput.hidden = true"), "customCashInput must never be set to hidden = true");
  assert.ok(quickUi.includes("customCashInput.hidden = false"), "customCashInput must be kept visible when cash is active");

  // Money parser checks
  assert.equal(parseMoneyInput("50"), 50000);
  assert.equal(parseMoneyInput("70"), 70000);
  assert.equal(parseMoneyInput("100"), 100000);
  assert.equal(parseMoneyInput("50k"), 50000);
  assert.equal(parseMoneyInput("50.000"), 50000);
  assert.equal(parseMoneyInput("200000"), 200000);
  assert.equal(parseMoneyInput(""), null);
});
