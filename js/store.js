import { INITIAL_MENU, INITIAL_TABLES, SHOP_INFO } from "./data.js";

const STORAGE_KEY = "bui_coffee_app_state_v1";

class CoffeeStore {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Đảm bảo đủ 50 bàn nếu dữ liệu cũ chưa đủ
        if (!parsed.tables || parsed.tables.length < 50) {
          parsed.tables = INITIAL_TABLES;
        }
        if (!parsed.menu || parsed.menu.length === 0) {
          parsed.menu = INITIAL_MENU;
        }
        if (!parsed.invoices) {
          parsed.invoices = [];
        }
        return parsed;
      }
    } catch (e) {
      console.error("Lỗi khi đọc LocalStorage, khôi phục mặc định:", e);
    }

    return {
      shop: SHOP_INFO,
      menu: INITIAL_MENU,
      tables: INITIAL_TABLES,
      invoices: [],
      activeTableId: 1
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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
    this._recalculateTable(toTable);

    // Dọn bàn nguồn
    fromTable.orderItems = [];
    fromTable.totalAmount = 0;
    fromTable.status = "empty";
    fromTable.createdAt = null;

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
      paidAt: new Date().toISOString(),
      wifiPass: this.state.shop.wifiPass
    };

    this.state.invoices.unshift(invoice);

    // Trả bàn về trạng thái trống
    table.orderItems = [];
    table.totalAmount = 0;
    table.status = "empty";
    table.createdAt = null;

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
    this.saveState();
  }

  _recalculateTable(table) {
    table.totalAmount = table.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Lấy thống kê trong ngày
  getDailyStats() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayInvoices = this.state.invoices.filter(inv => inv.paidAt && inv.paidAt.slice(0, 10) === todayStr);

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
      this.state = parsed;
      this.saveState();
      return true;
    } catch (e) {
      console.error("Lỗi import:", e);
      return false;
    }
  }

  // Khôi phục cài đặt gốc
  resetData() {
    this.state = {
      shop: SHOP_INFO,
      menu: INITIAL_MENU,
      tables: INITIAL_TABLES,
      invoices: [],
      activeTableId: 1
    };
    this.saveState();
  }
}

export const store = new CoffeeStore();
