import { INITIAL_MENU, INITIAL_TABLES, SHIFT_DEFS, SHOP_INFO } from "./data.js";

const STORAGE_KEY = "bui_coffee_app_state_v1";

class CoffeeStore {
  constructor() {
    this.state = this.loadState();
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
          return parsed;
        }
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
  addMenuItem({ name, price, category }) {
    if (!name || Number(price) <= 0) return null;

    const newItem = {
      id: "m_" + Date.now(),
      name: name.trim(),
      price: Number(price),
      category: category || "coffee",
      isCustomCreated: true
    };

    this.state.menu.unshift(newItem);
    this.saveState();
    return newItem;
  }

  // Xóa món đã thêm khỏi thực đơn
  deleteMenuItem(id) {
    this.state.menu = this.state.menu.filter(m => m.id !== id);
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

      // Ca cố định
      shiftList.forEach(s => {
        if (dayData[s.id]) {
          totalShifts += 1;
          totalBaseHours += s.hours;
          const effectiveHours = s.hours * mult;
          totalHours += effectiveHours;
          activeShifts.push({
            shiftId: s.id,
            name: s.name,
            timeLabel: s.timeLabel,
            hours: s.hours,
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

    // Thưởng chuyên cần: nếu làm trên 7 ca/tuần (> 7 ca, tức là từ 8 ca trở lên): cộng 100.000đ
    const bonus = totalShifts > 7 ? 100000 : 0;
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
      lines.push(`+ Thưởng chuyên cần (>7 ca): ${calc.bonus / 1000}k`);
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
