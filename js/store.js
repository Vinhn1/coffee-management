(function (root, factory) {
  const deps = (typeof require === "function" && typeof module === "object" && module.exports)
    ? Object.assign({}, require("./data.js"), require("./quick.js"))
    : (root.BuiCoffee || {});
  const api = factory(deps);
  root.BuiCoffee = Object.assign(root.BuiCoffee || {}, api);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
const { BEST_SELLER_IDS, DRINK_CATEGORY_DEFAULT_IMAGES, INITIAL_MENU, INITIAL_TABLES, QUICK_GRID_SIZE, SHIFT_DEFS, SHOP_INFO, buildSpeedGrid, calcChange } = deps;

const STORAGE_KEY = "bui_coffee_app_state_v1";

class CoffeeStore {
  constructor() {
    this.state = this.loadState();

    // Trang thai khong luu ben vung (dung cho Ban nhanh)
    this.menuVersion = 0;      // tang moi khi thuc don thay doi de chi muc tim kiem duoc dung lai
    this._salesCache = null;   // { days, map } doanh so theo mon
    this._gridCache = null;    // danh sach id luoi mon ban chay
    this._saveTimer = null;

    // Dam bao gio hang Ban nhanh duoc ghi xuong ngay khi roi trang / an tab
    if (typeof document !== "undefined" && typeof window !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushSave();
      });
      window.addEventListener("pagehide", () => this.flushSave());
    }
  }

  // Bo sung cac khoa moi cho du lieu cu (khong doi STORAGE_KEY de khong mat hoa don)
  _normalizeState(parsed) {
    const initialById = new Map((INITIAL_MENU || []).map(m => [m.id, m]));
    const fallbackImgs = DRINK_CATEGORY_DEFAULT_IMAGES || {};

    if (!Array.isArray(parsed.menu) || parsed.menu.length === 0) {
      parsed.menu = (INITIAL_MENU || []).map(m => ({ ...m }));
    } else {
      const existingIds = new Set();
      parsed.menu = parsed.menu.map(item => {
        if (!item || !item.id) return item;
        existingIds.add(item.id);
        const seed = initialById.get(item.id);
        let img = item.image;
        if (item.isCustomCreated) {
          if (!img || img === fallbackImgs.coffee || img === "assets/drinks/other.jpg") {
            img = "assets/drinks/placeholder.svg";
          }
        } else if (!img) {
          img = (seed && seed.image) || fallbackImgs[item.category] || "assets/drinks/placeholder.svg";
        }
        return item.image === img ? item : Object.assign({}, item, { image: img });
      });
      // Bo sung cac mon moi trong INITIAL_MENU (chua co trong localStorage cu) theo nhom danh muc
      (INITIAL_MENU || []).forEach(seed => {
        if (existingIds.has(seed.id)) return;
        const copy = { ...seed };
        let lastCatIdx = -1;
        for (let i = 0; i < parsed.menu.length; i++) {
          if (parsed.menu[i] && parsed.menu[i].category === seed.category) lastCatIdx = i;
        }
        if (lastCatIdx >= 0) {
          parsed.menu.splice(lastCatIdx + 1, 0, copy);
        } else {
          parsed.menu.push(copy);
        }
        existingIds.add(seed.id);
      });
    }

    if (!Array.isArray(parsed.invoices)) parsed.invoices = [];

    if (!parsed.quickOrder || !Array.isArray(parsed.quickOrder.items)) {
      parsed.quickOrder = { items: [], note: "" };
    } else {
      if (typeof parsed.quickOrder.note !== "string") parsed.quickOrder.note = "";
      parsed.quickOrder.items = parsed.quickOrder.items.filter(
        i => i && i.itemId && Number(i.quantity) > 0 && Number.isFinite(Number(i.price))
      ).map(i => {
        if (typeof i.note !== "string") i.note = "";
        return i;
      });
    }

    if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = {};
    if (!Array.isArray(parsed.settings.speedGrid)) parsed.settings.speedGrid = [];

    return parsed;
  }

  loadState() {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Đảm bảo đủ 50 bàn nếu dữ liệu cũ chưa đủ
          if (!parsed.tables || parsed.tables.length < 50) {
            parsed.tables = INITIAL_TABLES;
          } else {
            parsed.tables.forEach(t => {
              if (typeof t.note !== "string") t.note = "";
            });
          }
          if (!parsed.menu || parsed.menu.length === 0) {
            parsed.menu = INITIAL_MENU;
          }
          if (!parsed.invoices) {
            parsed.invoices = [];
          }
          return this._normalizeState(parsed);
        }
      }
    } catch (e) {
      console.error("Lỗi khi đọc LocalStorage, khôi phục mặc định:", e);
    }

    return this._normalizeState({
      shop: SHOP_INFO,
      menu: INITIAL_MENU,
      tables: INITIAL_TABLES,
      invoices: [],
      activeTableId: 1
    });
  }

  saveState() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error("Lỗi khi lưu LocalStorage:", e);
    }
  }

  getTables() {
    return this.state.tables;
  }

  getTable(id) {
    return this.state.tables.find(t => t.id === Number(id));
  }

  getMenu() {
    return this.state.menu;
  }

  getActiveTable() {
    return this.getTable(this.state.activeTableId) || this.state.tables[0];
  }

  setActiveTableId(id) {
    this.state.activeTableId = Number(id);
    this.saveState();
  }

  // Thêm món vào bàn
  addItemToTable(tableId, menuItem, quantity = 1, note = "") {
    const table = this.getTable(tableId);
    if (!table) return false;

    const existingIndex = table.orderItems.findIndex(item => item.itemId === menuItem.id && item.note === note);

    if (existingIndex > -1) {
      table.orderItems[existingIndex].quantity += quantity;
    } else {
      table.orderItems.push({
        itemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        category: menuItem.category,
        quantity: quantity,
        note: note
      });
    }

    this._recalculateTable(table);
    table.status = "occupied";
    if (!table.createdAt) {
      table.createdAt = new Date().toISOString();
    }

    this.saveState();
    return true;
  }

  // Thêm món ngoài menu (món tự do / phụ thu) vào bàn
  addCustomItemToTable(tableId, { name, price, quantity = 1, note = "" }) {
    const table = this.getTable(tableId);
    if (!table || !name || Number(price) < 0) return false;

    const trimmedName = name.trim();
    const cleanPrice = Number(price);
    const cleanQty = Math.max(1, Number(quantity) || 1);
    const cleanNote = (note || "").trim();

    // Kiểm tra xem món tự do này cùng tên, giá, ghi chú đã có trên bàn chưa
    const existingIndex = table.orderItems.findIndex(
      item => item.isCustom && item.name === trimmedName && item.price === cleanPrice && (item.note || "") === cleanNote
    );

    if (existingIndex > -1) {
      table.orderItems[existingIndex].quantity += cleanQty;
    } else {
      const customId = "custom_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      table.orderItems.push({
        itemId: customId,
        name: trimmedName,
        price: cleanPrice,
        category: "other",
        quantity: cleanQty,
        note: cleanNote,
        isCustom: true
      });
    }

    this._recalculateTable(table);
    table.status = "occupied";
    if (!table.createdAt) {
      table.createdAt = new Date().toISOString();
    }

    this.saveState();
    return true;
  }

  // Cập nhật ghi chú riêng cho bàn
  updateTableNote(tableId, note = "") {
    const table = this.getTable(tableId);
    if (!table) return false;
    table.note = (note || "").trim();
    this.saveState();
    return true;
  }

  // Thêm sản phẩm mới vào danh mục thực đơn
  addMenuItem({ name, price, category, image }) {
    if (!name || Number(price) <= 0) return null;

    const cat = category || "other";
    const cleanImg = typeof image === "string" ? image.trim() : "";
    const newItem = {
      id: "m_" + Date.now(),
      name: name.trim(),
      price: Number(price),
      category: cat,
      image: cleanImg || "assets/drinks/placeholder.svg",
      isCustomCreated: true
    };

    this.state.menu.unshift(newItem);
    this._invalidateMenu();
    this.saveState();
    return newItem;
  }

  // Xóa món đã thêm khỏi thực đơn
  deleteMenuItem(id) {
    this.state.menu = this.state.menu.filter(m => m.id !== id);
    this._invalidateMenu();
    this.saveState();
    return true;
  }

  // Tăng giảm số lượng món của bàn
  updateItemQuantity(tableId, itemId, note = "", delta = 1) {
    const table = this.getTable(tableId);
    if (!table) return;

    const itemIndex = table.orderItems.findIndex(i => i.itemId === itemId && (i.note || "") === (note || ""));
    if (itemIndex === -1) return;

    table.orderItems[itemIndex].quantity += delta;
    if (table.orderItems[itemIndex].quantity <= 0) {
      table.orderItems.splice(itemIndex, 1);
    }

    this._recalculateTable(table);
    if (table.orderItems.length === 0) {
      table.status = "empty";
      table.createdAt = null;
    }

    this.saveState();
  }

  // Xóa một món cụ thể khỏi bàn
  removeItem(tableId, itemId, note = "") {
    const table = this.getTable(tableId);
    if (!table) return;

    table.orderItems = table.orderItems.filter(i => !(i.itemId === itemId && (i.note || "") === (note || "")));
    this._recalculateTable(table);
    if (table.orderItems.length === 0) {
      table.status = "empty";
      table.createdAt = null;
    }
    this.saveState();
  }

  // Chuyển bàn
  transferTable(fromTableId, toTableId) {
    const fromTable = this.getTable(fromTableId);
    const toTable = this.getTable(toTableId);
    if (!fromTable || !toTable || fromTable.orderItems.length === 0) return false;

    // Nếu bàn đích đang có món, ta gộp vào bàn đích
    fromTable.orderItems.forEach(item => {
      const exist = toTable.orderItems.find(i => i.itemId === item.itemId && i.note === item.note);
      if (exist) {
        exist.quantity += item.quantity;
      } else {
        toTable.orderItems.push({ ...item });
      }
    });

    toTable.status = "occupied";
    if (!toTable.createdAt) toTable.createdAt = fromTable.createdAt || new Date().toISOString();
    if (fromTable.note && fromTable.note.trim()) {
      if (toTable.note && toTable.note.trim()) {
        toTable.note = `${toTable.note} | ${fromTable.note}`;
      } else {
        toTable.note = fromTable.note;
      }
    }
    this._recalculateTable(toTable);

    // Dọn bàn nguồn
    fromTable.orderItems = [];
    fromTable.totalAmount = 0;
    fromTable.status = "empty";
    fromTable.createdAt = null;
    fromTable.note = "";

    this.setActiveTableId(toTableId);
    this.saveState();
    return true;
  }

  // Hoàn tất thanh toán
  completePayment(tableId, paymentMethod = "cash", customerCash = 0, staffNote = "") {
    const table = this.getTable(tableId);
    if (!table || table.orderItems.length === 0) return null;

    const invoiceId = "HD" + Date.now().toString().slice(-6);
    const total = table.totalAmount;
    const change = paymentMethod === "cash" && customerCash > total ? customerCash - total : 0;

    const invoice = {
      id: invoiceId,
      tableId: table.id,
      tableName: table.name,
      items: JSON.parse(JSON.stringify(table.orderItems)),
      totalAmount: total,
      paymentMethod,
      customerCash: paymentMethod === "cash" ? customerCash : total,
      changeAmount: change,
      staffNote,
      tableNote: table.note || "",
      paidAt: new Date().toISOString(),
      wifiPass: this.state.shop.wifiPass
    };

    this.state.invoices.unshift(invoice);
    this._invalidateSales();

    // Trả bàn về trạng thái trống
    table.orderItems = [];
    table.totalAmount = 0;
    table.status = "empty";
    table.createdAt = null;
    table.note = "";

    this.saveState();
    return invoice;
  }

  // Xóa trắng bàn (hủy bàn)
  clearTable(tableId) {
    const table = this.getTable(tableId);
    if (!table) return;
    table.orderItems = [];
    table.totalAmount = 0;
    table.status = "empty";
    table.createdAt = null;
    table.note = "";
    this.saveState();
  }

  _recalculateTable(table) {
    table.totalAmount = table.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // -------------------------------------------------------------------------
  // BAN NHANH (quick register): gio hang quay / mang ve, khong dung den ban
  // -------------------------------------------------------------------------

  _invalidateMenu() {
    this.menuVersion += 1;
    this._gridCache = null;
  }

  _invalidateSales() {
    this._salesCache = null;
    this._gridCache = null;
  }

  // Khoa ngay theo gio dia phuong (tranh lech ngay do UTC)
  _localDateKey(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // Ghi tre cho cac thao tac gio hang (checkout van ghi ngay)
  saveStateDebounced(ms = 300) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveState();
    }, ms);
  }

  flushSave() {
    if (this._saveTimer) this.saveState();
  }

  getQuickOrder() {
    return this.state.quickOrder;
  }

  getQuickNote() {
    return (this.state.quickOrder && this.state.quickOrder.note) || "";
  }

  setQuickNote(note) {
    if (!this.state.quickOrder) this.state.quickOrder = { items: [], note: "" };
    this.state.quickOrder.note = String(note || "").trim();
    this.saveStateDebounced();
  }

  quickSetItemNote(itemId, note) {
    const line = this.state.quickOrder.items.find(i => i.itemId === itemId);
    if (!line) return false;
    line.note = String(note || "").trim();
    this.saveStateDebounced();
    return true;
  }

  _normalizeQty(qty) {
    const n = Math.floor(Number(qty));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : 1;
  }

  _quickAddLine(menuItem, qty) {
    const items = this.state.quickOrder.items;
    const line = items.find(i => i.itemId === menuItem.id);
    if (line) {
      line.quantity = Math.min(line.quantity + qty, 999);
      return line;
    }
    const created = {
      itemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      category: menuItem.category,
      quantity: qty,
      note: ""
    };
    items.push(created);
    return created;
  }

  quickAdd(menuItem, qty = 1) {
    if (!menuItem || !menuItem.id) return null;
    const line = this._quickAddLine(menuItem, this._normalizeQty(qty));
    this.saveStateDebounced();
    return line;
  }

  // lines: [{ item, qty }]
  quickAddBatch(lines) {
    (lines || []).forEach(l => {
      if (l && l.item && l.item.id) this._quickAddLine(l.item, this._normalizeQty(l.qty));
    });
    this.saveStateDebounced();
    return this.state.quickOrder.items;
  }

  // Them mon ngoai menu / cong tien nhanh vao gio hang Ban nhanh
  quickAddCustom({ name = "", price, quantity = 1, note = "" } = {}) {
    const cleanPrice = Math.round(Number(price));
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) return null;

    const trimmedName = String(name || "").trim() || "Món ngoài menu";
    const cleanQty = this._normalizeQty(quantity);
    const cleanNote = String(note || "").trim();
    const items = this.state.quickOrder.items;

    const existing = items.find(
      i => i.isCustom && i.name === trimmedName && i.price === cleanPrice && (i.note || "") === cleanNote
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + cleanQty, 999);
      this.saveStateDebounced();
      return existing;
    }

    const created = {
      itemId: "custom_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: trimmedName,
      price: cleanPrice,
      category: "other",
      quantity: cleanQty,
      note: cleanNote,
      isCustom: true
    };
    items.push(created);
    this.saveStateDebounced();
    return created;
  }

  quickSetQty(itemId, qty) {
    const items = this.state.quickOrder.items;
    const idx = items.findIndex(i => i.itemId === itemId);
    if (idx === -1) return;
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n <= 0) {
      items.splice(idx, 1);
    } else {
      items[idx].quantity = Math.min(n, 999);
    }
    this.saveStateDebounced();
  }

  quickChangeQty(itemId, delta) {
    const line = this.state.quickOrder.items.find(i => i.itemId === itemId);
    if (!line) return;
    this.quickSetQty(itemId, line.quantity + delta);
  }

  quickRemove(itemId) {
    this.state.quickOrder.items = this.state.quickOrder.items.filter(i => i.itemId !== itemId);
    this.saveStateDebounced();
  }

  quickClear() {
    this.state.quickOrder.items = [];
    this.state.quickOrder.note = "";
    this.saveStateDebounced();
  }

  getQuickTotal() {
    return this.state.quickOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  getQuickCount() {
    return this.state.quickOrder.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  // Thanh toan gio hang Ban nhanh va tao hoa don (tableId = null)
  // customerCash null = khach dua du. Tra ve { ok, invoice } hoac { ok: false, reason }
  quickCheckout({ orderType = "takeaway", paymentMethod = "cash", customerCash = null } = {}) {
    const items = this.state.quickOrder.items;
    if (items.length === 0) return { ok: false, reason: "empty" };

    const total = this.getQuickTotal();
    const method = paymentMethod === "qr" ? "qr" : "cash";
    let received = total;
    let change = 0;

    if (method === "cash") {
      const calc = calcChange(total, customerCash);
      if (!calc.enough) return { ok: false, reason: "short" };
      received = calc.received;
      change = calc.change;
    }

    const type = orderType === "counter" ? "counter" : "takeaway";
    let invoiceId = "HD" + Date.now().toString().slice(-6);
    while (this.state.invoices.some(inv => inv.id === invoiceId)) {
      invoiceId = "HD" + (Date.now() + Math.floor(Math.random() * 1000)).toString().slice(-6);
    }

    const orderNote = this.getQuickNote();
    const invoice = {
      id: invoiceId,
      tableId: null,
      tableName: type === "counter" ? "Tại quầy" : "Mang về",
      orderType: type,
      isQuick: true,
      items: JSON.parse(JSON.stringify(items)),
      totalAmount: total,
      paymentMethod: method,
      customerCash: received,
      changeAmount: change,
      staffNote: orderNote,
      tableNote: orderNote,
      paidAt: new Date().toISOString(),
      wifiPass: (this.state.shop || SHOP_INFO).wifiPass
    };

    this.state.invoices.unshift(invoice);
    this.state.quickOrder.items = [];
    this.state.quickOrder.note = "";
    this._invalidateSales();
    this.saveState();
    return { ok: true, invoice };
  }

  // Chuyen gio hang Ban nhanh vao 1 ban (dung lai addItemToTable de gop mon dung cach)
  quickSendToTable(tableId) {
    const table = this.getTable(tableId);
    if (!table) return { ok: false, reason: "no_table" };

    const lines = this.state.quickOrder.items.slice();
    if (lines.length === 0) return { ok: false, reason: "empty" };

    const count = lines.reduce((s, l) => s + l.quantity, 0);
    lines.forEach(l => {
      if (l.isCustom) {
        this.addCustomItemToTable(table.id, {
          name: l.name,
          price: l.price,
          quantity: l.quantity,
          note: l.note || ""
        });
      } else {
        this.addItemToTable(
          table.id,
          { id: l.itemId, name: l.name, price: l.price, category: l.category },
          l.quantity,
          l.note || ""
        );
      }
    });

    const quickNote = this.getQuickNote();
    if (quickNote) {
      table.note = table.note ? `${table.note} | ${quickNote}` : quickNote;
    }

    this.state.quickOrder.items = [];
    this.state.quickOrder.note = "";
    this.setActiveTableId(table.id);
    this.saveState();
    return { ok: true, table, count };
  }

  // So luong ban theo mon trong N ngay gan nhat (Map itemId -> qty), co cache
  getSalesQty(days = 30) {
    if (this._salesCache && this._salesCache.days === days) return this._salesCache.map;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const map = new Map();
    this.state.invoices.forEach(inv => {
      if (!inv.paidAt || new Date(inv.paidAt).getTime() < cutoff) return;
      (inv.items || []).forEach(item => {
        if (item.isCustom) return;
        map.set(item.itemId, (map.get(item.itemId) || 0) + item.quantity);
      });
    });

    this._salesCache = { days, map };
    return map;
  }

  // Danh sach id cho luoi mon ban chay (on dinh, chi tinh lai sau khi co hoa don moi / doi menu)
  getSpeedGridIds() {
    if (!this._gridCache) {
      this._gridCache = buildSpeedGrid({
        menu: this.state.menu,
        salesQty: this.getSalesQty(30),
        pinned: this.state.settings.speedGrid,
        defaults: BEST_SELLER_IDS,
        size: QUICK_GRID_SIZE
      });
    }
    return this._gridCache;
  }

  // Lấy thống kê trong ngày
  getDailyStats() {
    const todayStr = this._localDateKey(new Date());
    const todayInvoices = this.state.invoices.filter(inv => inv.paidAt && this._localDateKey(inv.paidAt) === todayStr);

    const totalRevenue = todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalOrders = todayInvoices.length;

    // Đếm món bán chạy
    const itemMap = {};
    todayInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].revenue += item.price * item.quantity;
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      todayRevenue: totalRevenue,
      todayOrders: totalOrders,
      topItems,
      allInvoices: this.state.invoices
    };
  }

  // Lấy dữ liệu chấm công của 1 tuần
  getTimekeepingWeek(weekKey) {
    if (!this.state.timekeeping) this.state.timekeeping = {};
    if (!this.state.timekeeping[weekKey]) {
      this.state.timekeeping[weekKey] = {
        weekKey,
        days: {} // [dateStr]: { morning: false, afternoon: false, evening: false, holidayMultiplier: 1 }
      };
    }
    return this.state.timekeeping[weekKey];
  }

  // Bật/tắt 1 ca làm việc
  toggleShift(weekKey, dateStr, shiftKey) {
    const week = this.getTimekeepingWeek(weekKey);
    if (!week.days[dateStr]) {
      week.days[dateStr] = { morning: false, afternoon: false, evening: false, holidayMultiplier: 1 };
    }
    week.days[dateStr][shiftKey] = !week.days[dateStr][shiftKey];
    this.saveState();
    return week;
  }

  // Chọn nhanh combo 2 ca trong ngày (morning-afternoon, afternoon-evening, morning-evening)
  setShiftCombo(weekKey, dateStr, combo) {
    const week = this.getTimekeepingWeek(weekKey);
    if (!week.days[dateStr]) {
      week.days[dateStr] = { morning: false, afternoon: false, evening: false, holidayMultiplier: 1 };
    }
    const day = week.days[dateStr];
    if (combo === "morning-afternoon") {
      const isCur = Boolean(day.morning && day.afternoon && !day.evening);
      day.morning = !isCur;
      day.afternoon = !isCur;
      if (!isCur) day.evening = false;
    } else if (combo === "afternoon-evening") {
      const isCur = Boolean(day.afternoon && day.evening && !day.morning);
      day.afternoon = !isCur;
      day.evening = !isCur;
      if (!isCur) day.morning = false;
    } else if (combo === "morning-evening") {
      const isCur = Boolean(day.morning && day.evening && !day.afternoon);
      day.morning = !isCur;
      day.evening = !isCur;
      if (!isCur) day.afternoon = false;
    }
    this.saveState();
    return week;
  }

  // Đặt hệ số ngày lễ (1, 2, 3)
  setHolidayMultiplier(weekKey, dateStr, multiplier) {
    const week = this.getTimekeepingWeek(weekKey);
    if (!week.days[dateStr]) {
      week.days[dateStr] = { morning: false, afternoon: false, evening: false, holidayMultiplier: 1 };
    }
    week.days[dateStr].holidayMultiplier = Math.max(1, Number(multiplier) || 1);
    this.saveState();
    return week;
  }

  // Xóa toàn bộ chấm công của tuần
  clearTimekeepingWeek(weekKey) {
    if (this.state.timekeeping && this.state.timekeeping[weekKey]) {
      this.state.timekeeping[weekKey].days = {};
      this.saveState();
    }
  }

  // Thêm khoảng thời gian tùy chỉnh (đi trước ca làm, tăng ca, giờ không cố định)
  addCustomShift(weekKey, dateStr, { timeLabel, hours, name = "" }) {
    const week = this.getTimekeepingWeek(weekKey);
    if (!week.days[dateStr]) {
      week.days[dateStr] = { morning: false, afternoon: false, evening: false, holidayMultiplier: 1, customShifts: [] };
    }
    if (!Array.isArray(week.days[dateStr].customShifts)) {
      week.days[dateStr].customShifts = [];
    }

    const cleanHours = Math.max(0.1, Number(hours) || 0);
    const cleanLabel = (timeLabel || `${cleanHours}h`).trim();

    week.days[dateStr].customShifts.push({
      id: "cs_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timeLabel: cleanLabel,
      hours: cleanHours,
      name: (name || "").trim()
    });

    this.saveState();
    return week;
  }

  // Xóa khoảng thời gian tùy chỉnh
  removeCustomShift(weekKey, dateStr, customShiftId) {
    const week = this.getTimekeepingWeek(weekKey);
    if (week.days[dateStr] && Array.isArray(week.days[dateStr].customShifts)) {
      week.days[dateStr].customShifts = week.days[dateStr].customShifts.filter(cs => cs.id !== customShiftId);
      this.saveState();
    }
    return week;
  }

  // Tính lương tuần theo quy tắc của quán
  calculateSalary(weekKey, weekDates) {
    const week = this.getTimekeepingWeek(weekKey);
    const shiftList = [SHIFT_DEFS.morning, SHIFT_DEFS.afternoon, SHIFT_DEFS.evening];

    let totalShifts = 0;
    let totalHours = 0;
    let totalBaseHours = 0;
    const dayDetails = [];

    weekDates.forEach(d => {
      const dayData = week.days[d.dateStr] || { morning: false, afternoon: false, evening: false, holidayMultiplier: 1, customShifts: [] };
      const mult = Number(dayData.holidayMultiplier) || 1;
      const activeShifts = [];

      // Ca cố định (xử lý nối ca Trưa + Tối tránh trùng 0,5h từ 16h30-17h)
      const hasAfternoonAndEvening = Boolean(dayData.afternoon && dayData.evening);
      shiftList.forEach(s => {
        if (dayData[s.id]) {
          totalShifts += 1;
          let shiftHours = s.hours;
          let timeLabel = s.timeLabel;
          if (s.id === "evening" && hasAfternoonAndEvening) {
            shiftHours = 6.0;
            timeLabel = "17h - 23h";
          }
          totalBaseHours += shiftHours;
          const effectiveHours = shiftHours * mult;
          totalHours += effectiveHours;
          activeShifts.push({
            shiftId: s.id,
            name: s.name,
            timeLabel,
            hours: shiftHours,
            effectiveHours,
            multiplier: mult,
            isCustom: false
          });
        }
      });

      // Khoảng thời gian tùy chỉnh (đi sớm, ngoài ca...)
      if (Array.isArray(dayData.customShifts)) {
        dayData.customShifts.forEach(cs => {
          totalBaseHours += cs.hours;
          const effectiveHours = cs.hours * mult;
          totalHours += effectiveHours;
          // Nếu ca làm việc tùy chỉnh từ 4 tiếng trở lên hoặc ngày đó chưa có ca cố định nào, tính là 1 ca
          if (activeShifts.filter(s => !s.isCustom).length === 0 || cs.hours >= 4) {
            totalShifts += 1;
          }
          activeShifts.push({
            shiftId: cs.id,
            name: cs.name || "Đi sớm / Tùy chỉnh",
            timeLabel: cs.timeLabel,
            hours: cs.hours,
            effectiveHours,
            multiplier: mult,
            isCustom: true
          });
        });
      }

      dayDetails.push({
        dateStr: d.dateStr,
        dayName: d.dayName,
        dateFormatted: d.dateFormatted,
        isToday: d.isToday,
        holidayMultiplier: mult,
        shifts: activeShifts,
        totalDayHours: activeShifts.reduce((acc, s) => acc + s.effectiveHours, 0)
      });
    });

    // Mức lương theo số ca làm trong tuần:
    // Làm <= 3 ca/tuần: 16.000đ/giờ
    // Làm >= 4 ca/tuần: 20.000đ/giờ
    const ratePerHour = totalShifts <= 3 ? 16000 : 20000;
    const baseSalary = totalHours * ratePerHour;

    // Thưởng chuyên cần: làm từ 7 ca/tuần trở lên (>= 7 ca): cộng 100.000đ
    const bonus = totalShifts >= 7 ? 100000 : 0;
    const finalSalary = baseSalary + bonus;

    // Chuỗi tuần "2/11 - 8/11"
    const startDate = new Date(weekDates[0].dateStr);
    const endDate = new Date(weekDates[weekDates.length - 1].dateStr);
    const weekRangeText = `${startDate.getDate()}/${startDate.getMonth() + 1} - ${endDate.getDate()}/${endDate.getMonth() + 1}`;

    return {
      weekKey,
      weekRangeText,
      totalShifts,
      totalBaseHours,
      totalHours,
      ratePerHour,
      baseSalary,
      bonus,
      finalSalary,
      dayDetails
    };
  }

  // Định dạng xuất mẫu tính lương văn bản theo đúng yêu cầu
  formatSalaryReport(weekKey, weekDates) {
    const calc = this.calculateSalary(weekKey, weekDates);
    const lines = [];
    lines.push(calc.weekRangeText);

    calc.dayDetails.forEach(day => {
      if (day.shifts.length > 0) {
        day.shifts.forEach((s, idx) => {
          const hoursFormatted = (s.hours + "").replace(".", ",");
          const multText = s.multiplier > 1 ? ` (x${s.multiplier} Lễ = ${(s.effectiveHours + "").replace(".", ",")}h)` : "";
          if (idx === 0) {
            lines.push(`${day.dayName}: ${s.timeLabel} = ${hoursFormatted}h${multText}`);
          } else {
            lines.push(`      ${s.timeLabel} = ${hoursFormatted}h${multText}`);
          }
        });
      }
    });

    const totalHoursFormatted = (calc.totalHours + "").replace(".", ",");
    const rateK = calc.ratePerHour / 1000 + "k";
    const salaryK = (calc.baseSalary / 1000) + "k";
    lines.push(`Tổng: ${totalHoursFormatted}h x ${rateK} = ${salaryK}`);

    if (calc.bonus > 0) {
      lines.push(`+ Thưởng chuyên cần (>= 7 ca): ${calc.bonus / 1000}k`);
      lines.push(`Tổng nhận: ${(calc.finalSalary / 1000)}k`);
    }

    return lines.join("\n");
  }

  // Xuất dữ liệu ra file JSON
  exportData() {
    return JSON.stringify(this.state, null, 2);
  }

  // Nhập dữ liệu từ file JSON
  importData(jsonContent) {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.tables || !parsed.menu) {
        throw new Error("Cấu trúc file sao lưu không hợp lệ.");
      }
      parsed.tables.forEach(t => {
        if (typeof t.note !== "string") t.note = "";
      });
      this.state = this._normalizeState(parsed);
      this._invalidateMenu();
      this._invalidateSales();
      this.saveState();
      return true;
    } catch (e) {
      console.error("Lỗi import:", e);
      return false;
    }
  }

  // Khôi phục cài đặt gốc
  resetData() {
    this.state = this._normalizeState({
      shop: SHOP_INFO,
      menu: INITIAL_MENU,
      tables: INITIAL_TABLES,
      invoices: [],
      activeTableId: 1
    });
    this._invalidateMenu();
    this._invalidateSales();
    this.saveState();
  }
}

const store = new CoffeeStore();

return { CoffeeStore, store };
});
